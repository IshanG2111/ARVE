from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import declarative_base, sessionmaker
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from app.core.config import settings

db_url = settings.database_url

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
elif db_url.startswith("postgresql"):
    # Enable SSL for cloud database hosts if sslmode or remote host is detected
    if "sslmode" in db_url or "neon.tech" in db_url or "supabase.co" in db_url or "render.com" in db_url:
        connect_args["sslmode"] = "require"

engine = create_engine(
    db_url, connect_args=connect_args, pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_postgres_db_exists():
    """Checks if target PostgreSQL database exists; creates it if missing (for local PG)."""
    current_url = settings.database_url
    if not current_url.startswith(("postgresql", "postgres")):
        return

    # Skip DB auto-creation attempt for cloud databases where permissions or ssl prohibit superuser connection
    if any(cloud_domain in current_url for cloud_domain in ["neon.tech", "supabase.co", "render.com", "railway.app", "aivencloud.com"]):
        return

    url = make_url(current_url)
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
            port=port,
            connect_timeout=3
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

    current_url = settings.database_url
    if current_url.startswith(("postgresql", "postgres")):
        ensure_postgres_db_exists()

    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)

    if current_url.startswith("sqlite"):
        with engine.begin() as conn:
            for table_name, table in Base.metadata.tables.items():
                if inspector.has_table(table_name):
                    existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
                    for col in table.columns:
                        if col.name not in existing_cols:
                            col_type = col.type.compile(engine.dialect)
                            conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {col_type} NULL'))

