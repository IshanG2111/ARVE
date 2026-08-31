from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def _sqlalchemy_url(database_url: str) -> str:
    """Normalize PostgreSQL URLs to the driver selected by the project plan."""
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
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


def init_db() -> None:
    """Import models so metadata is registered and ensure schema columns exist."""
    from app.models import models  # noqa: F401
    from sqlalchemy import text

    try:
        with engine.begin() as conn:
            if engine.dialect.name == "postgresql":
                conn.execute(
                    text("""
                        ALTER TABLE security_findings ADD COLUMN IF NOT EXISTS fixed_version VARCHAR(128);
                        ALTER TABLE security_findings ADD COLUMN IF NOT EXISTS suppression_reason VARCHAR(128);
                        ALTER TABLE security_findings ADD COLUMN IF NOT EXISTS suppression_justification TEXT;
                        ALTER TABLE security_findings ADD COLUMN IF NOT EXISTS suppression_expires_at TIMESTAMP;
                    """)
                )
    except Exception:
        # Table might not exist yet or running against different backend
        pass
