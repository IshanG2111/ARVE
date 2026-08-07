import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

from app.main import app
from app.core.database import Base, get_db

from sqlalchemy.pool import StaticPool

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_auth_and_project_flow():
    random_email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    password = "secretpassword123"

    # 1. Register User
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": random_email, "password": password, "full_name": "Security Tester"}
    )
    assert reg_resp.status_code == 201, reg_resp.text
    user_data = reg_resp.json()
    assert user_data["email"] == random_email

    # 2. Login
    login_resp = client.post(
        "/api/auth/login/json",
        json={"email": random_email, "password": password}
    )
    assert login_resp.status_code == 200, login_resp.text
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get /me
    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == random_email

    # 4. Create Project with GitHub Repository
    proj_resp = client.post(
        "/api/projects",
        json={
            "name": "Fintech Portal",
            "description": "Security audit project",
            "repo_name": "octocat-dev/fintech-api-gateway",
            "repo_url": "https://github.com/octocat-dev/fintech-api-gateway",
            "repo_id": "102",
            "default_branch": "main",
            "target_domain": "https://mysite.com"
        },
        headers=headers
    )
    assert proj_resp.status_code == 201
    proj_data = proj_resp.json()
    assert proj_data["repo_name"] == "octocat-dev/fintech-api-gateway"
    assert len(proj_data["targets"]) == 1
    assert proj_data["targets"][0]["domain"] == "mysite.com"

def test_github_oauth_mock():
    # Test mock GitHub login callback
    login_resp = client.post(
        "/api/github/callback",
        json={"code": "mock_code", "is_mock": True}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify user profile has github_login
    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["github_login"] == "octocat-dev"

    # Verify repos endpoint
    repos_resp = client.get("/api/github/repos", headers=headers)
    assert repos_resp.status_code == 200
    assert len(repos_resp.json()) >= 1

