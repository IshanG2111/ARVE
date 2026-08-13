import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.models import Project, Repository, TargetWebsite

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
client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def register_and_login():
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "secretpassword123"

    register = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "full_name": "Security Tester"},
    )
    assert register.status_code == 201, register.text

    login = client.post(
        "/api/auth/login/json",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    db = TestingSessionLocal()
    try:
        from app.models.models import User
        user = db.query(User).filter(User.email == email).first()
        user.github_access_token = "mock_github_access_token_123"
        user.username = "test-user"
        db.commit()
    finally:
        db.close()
    return {"Authorization": f"Bearer {token}"}


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_project_full_crud_and_database_state():
    headers = register_and_login()

    create = client.post(
        "/api/projects",
        headers=headers,
        json={
            "name": "Fintech Portal",
            "description": "Security audit project",
            "branch": "main",
            "repository": {
                "github_repo_id": "test-102",
                "owner": "octocat-dev",
                "name": "fintech-api-gateway",
                "full_name": "octocat-dev/fintech-api-gateway",
                "html_url": "https://github.com/octocat-dev/fintech-api-gateway",
                "default_branch": "main",
                "language": "TypeScript",
                "description": "Test repository",
                "private": False,
            },
            "deployment_url": "https://example.com",
        },
    )
    assert create.status_code == 201, create.text
    project = create.json()
    project_id = project["id"]
    repository_id = project["repository_id"]
    assert project["repository"]["github_repo_id"] == "test-102"
    assert len(project["targets"]) == 1

    get_response = client.get(f"/api/projects/{project_id}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["branch"] == "main"

    update = client.patch(
        f"/api/projects/{project_id}",
        headers=headers,
        json={"name": "Updated Fintech Portal", "branch": "develop"},
    )
    assert update.status_code == 200, update.text
    assert update.json()["name"] == "Updated Fintech Portal"
    assert update.json()["branch"] == "develop"

    db = TestingSessionLocal()
    try:
        db_project = db.query(Project).filter(Project.id == project_id).first()
        assert db_project is not None
        assert db_project.name == "Updated Fintech Portal"
        assert db_project.branch == "develop"
    finally:
        db.close()

    delete = client.delete(f"/api/projects/{project_id}", headers=headers)
    assert delete.status_code == 204, delete.text

    get_after_delete = client.get(f"/api/projects/{project_id}", headers=headers)
    assert get_after_delete.status_code == 404

    db = TestingSessionLocal()
    try:
        assert db.query(Project).filter(Project.id == project_id).first() is None
        assert db.query(TargetWebsite).filter(TargetWebsite.project_id == project_id).first() is None
        # Repository is deliberately retained as an independent resource.
        assert db.query(Repository).filter(Repository.id == repository_id).first() is not None
    finally:
        db.close()


def test_target_crud_and_ownership():
    headers = register_and_login()

    create = client.post(
        "/api/projects",
        headers=headers,
        json={"name": "Target Test Project"},
    )
    assert create.status_code == 201
    project_id = create.json()["id"]

    add = client.post(
        f"/api/projects/{project_id}/targets",
        headers=headers,
        json={"domain": "https://example.com"},
    )
    assert add.status_code == 201, add.text
    target = add.json()

    get_targets = client.get(f"/api/projects/{project_id}/targets", headers=headers)
    assert get_targets.status_code == 200
    assert len(get_targets.json()) == 1

    duplicate = client.post(
        f"/api/projects/{project_id}/targets",
        headers=headers,
        json={"domain": "example.com"},
    )
    assert duplicate.status_code == 409

    delete = client.delete(f"/api/targets/{target['id']}", headers=headers)
    assert delete.status_code == 204

    get_after_delete = client.get(f"/api/projects/{project_id}/targets", headers=headers)
    assert get_after_delete.status_code == 200
    assert get_after_delete.json() == []


def test_repository_access_is_scoped_to_owner():
    owner_headers = register_and_login()
    other_headers = register_and_login()

    create = client.post(
        "/api/projects",
        headers=owner_headers,
        json={
            "name": "Owner Project",
            "repository": {
                "github_repo_id": "scoped-repo-1",
                "owner": "octocat-dev",
                "name": "private-test",
                "full_name": "octocat-dev/private-test",
                "html_url": "https://github.com/octocat-dev/private-test",
                "default_branch": "main",
                "private": False,
            },
        },
    )
    assert create.status_code == 201
    repository_id = create.json()["repository_id"]

    response = client.get(f"/api/repositories/{repository_id}", headers=other_headers)
    assert response.status_code == 404

    branches = client.get(f"/api/repositories/{repository_id}/branches", headers=other_headers)
    assert branches.status_code == 404


def test_firebase_mock_is_development_only_path():
    response = client.post(
        "/api/auth/firebase",
        json={
            "id_token": "mock_firebase_token_test123",
            "github_access_token": "mock_gh_token_456",
        },
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["firebase_uid"] == "firebase_uid_mock_firebase_token_test123"
