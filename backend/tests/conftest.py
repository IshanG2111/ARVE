import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.core.database as app_db
from app.core.database import Base, get_db
from app.core.config import settings
from app.main import app as fastapi_app
from app.models import models as _models  # noqa: F401

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Tests do not require Redis/Celery. Real development uses Celery + Redis.
settings.SCAN_QUEUE_BACKEND = "background"
settings.SCANNER_ENABLE_TEST_ENGINE = False

# Rebind app's database engine and SessionLocal
app_db.engine = engine
app_db.SessionLocal.configure(bind=engine)
app_db.SessionLocal = TestingSessionLocal


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


fastapi_app.dependency_overrides[get_db] = override_get_db

# Ensure all database tables exist in the in-memory database
Base.metadata.create_all(bind=engine)

client = TestClient(fastapi_app)


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    client.cookies = httpx.Cookies()
    yield
    # Truncate tables between tests safely
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    client.cookies = httpx.Cookies()





@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client_fixture():
    return client
