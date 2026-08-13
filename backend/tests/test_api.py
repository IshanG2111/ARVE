import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

from app.main import app
from app.core.database import Base, get_db

from tests.conftest import client, TestingSessionLocal, engine


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
    # 5. Create Project without Deployment URL (Optional deployment link)
    proj_no_dep_resp = client.post(
        "/api/projects",
        json={
            "name": "Backend Library",
            "description": "Library without deployed target",
            "repo_name": "octocat-dev/backend-lib",
            "repo_url": "https://github.com/octocat-dev/backend-lib",
            "repo_id": "103",
            "default_branch": "main",
        },
        headers=headers
    )
    assert proj_no_dep_resp.status_code == 201
    proj_no_dep_data = proj_no_dep_resp.json()
    assert proj_no_dep_data["repo_name"] == "octocat-dev/backend-lib"
    assert proj_no_dep_data["deployment_url"] is None
    assert len(proj_no_dep_data["targets"]) == 0

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


def test_firebase_auth():
    # Test Firebase login with mock token
    fb_resp = client.post(
        "/api/auth/firebase",
        json={
            "id_token": "mock_firebase_token_test123",
            "github_access_token": "mock_gh_token_456"
        }
    )
    assert fb_resp.status_code == 200
    token = fb_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

def test_delete_project_cascades_db_entries():
    random_email = f"deleter_{uuid.uuid4().hex[:6]}@example.com"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": random_email, "password": "password123", "full_name": "Deleter User"}
    )
    assert reg_resp.status_code == 201
    login_resp = client.post(
        "/api/auth/login/json",
        json={"email": random_email, "password": "password123"}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create project with target
    proj_resp = client.post(
        "/api/projects",
        json={
            "name": "Delete Me Project",
            "repo_name": "test-owner/test-repo-delete",
            "repo_url": "https://github.com/test-owner/test-repo-delete",
            "target_domain": "https://delete-me.com"
        },
        headers=headers
    )
    assert proj_resp.status_code == 201
    proj_data = proj_resp.json()
    project_id = proj_data["id"]
    repo_id = proj_data["repository_id"]

    # Delete project
    del_resp = client.delete(f"/api/projects/{project_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify project is gone
    get_proj = client.get(f"/api/projects/{project_id}", headers=headers)
    assert get_proj.status_code == 404

    # Verify orphaned repo is also gone from DB
    get_repo = client.get(f"/api/repositories/{repo_id}", headers=headers)
    assert get_repo.status_code == 404


