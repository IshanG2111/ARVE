from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def _sqlalchemy_url(database_url: str) -> str:
    """Normalize PostgreSQL URLs for SQLAlchemy driver."""
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql://", 1)
    return database_url


database_url = _sqlalchemy_url(settings.DATABASE_URL)
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}

engine_kwargs = {
    "connect_args": connect_args,
}
if database_url.startswith("postgresql+"):
    engine_kwargs.update(
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_recycle=300,
    )

engine = create_engine(database_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_postgres_db_exists():
    """Checks if the PostgreSQL database exists and creates it if it doesn't."""
    if not settings.DATABASE_URL.startswith(("postgresql", "postgres")):
        return

    url = make_url(settings.DATABASE_URL)
    db_name = url.database
    if not db_name:
        return

    user = url.username or "postgres"
    password = url.password or ""
    host = url.host or "localhost"
    port = url.port or 5432

    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=user,
            password=password,
            host=host,
            port=port
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (db_name,))
        exists = cur.fetchone()

        if not exists:
            print(f"[DB] PostgreSQL database '{db_name}' does not exist. Creating database...")
            cur.execute(f'CREATE DATABASE "{db_name}";')
            print(f"[DB] PostgreSQL database '{db_name}' created successfully.")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"[DB] Note on PostgreSQL auto-create check: {e}")


def init_db():
    """Initializes PostgreSQL / SQLite database tables and applies migrations."""
    from app.models import models  # noqa: F401 - ensure models register with Base.metadata

    try:
        if settings.DATABASE_URL.startswith(("postgresql", "postgres")):
            ensure_postgres_db_exists()

        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)

        if settings.DATABASE_URL.startswith("sqlite"):
            with engine.begin() as conn:
                for table_name, table in Base.metadata.tables.items():
                    if inspector.has_table(table_name):
                        existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
                        for col in table.columns:
                            if col.name not in existing_cols:
                                col_type = col.type.compile(engine.dialect)
                                conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {col_type} NULL'))
    except Exception as e:
        print(f"[DB] Note on init_db execution: {e}")
