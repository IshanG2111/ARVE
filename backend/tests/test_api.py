from tests.conftest import client, TestingSessionLocal


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_firebase_auth_and_project_flow():
    fb_resp = client.post(
        "/api/auth/firebase",
        json={
            "id_token": "mock_firebase_token_test123",
            "github_access_token": "mock_github_access_token_123",
        },
    )
    assert fb_resp.status_code == 200
    token = fb_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["firebase_uid"] == "firebase_uid_mock_firebase_token_test123"

    project_resp = client.post(
        "/api/projects",
        json={
            "name": "Fintech Portal",
            "description": "Security audit project",
            "branch": "main",
            "repository": {
                "github_repo_id": "102",
                "owner": "octocat-dev",
                "name": "fintech-api-gateway",
                "full_name": "octocat-dev/fintech-api-gateway",
                "html_url": "https://github.com/octocat-dev/fintech-api-gateway",
                "default_branch": "main",
                "language": "Python",
                "description": "FastAPI gateway",
                "private": False,
            },
            "deployment_url": "https://mysite.com",
        },
        headers=headers,
    )
    assert project_resp.status_code == 201
    project = project_resp.json()
    assert project["repo_id"] == "102"
    assert project["repo_name"] == "octocat-dev/fintech-api-gateway"
    assert project["repository"]["full_name"] == "octocat-dev/fintech-api-gateway"
    assert len(project["targets"]) == 1

    patch_resp = client.patch(
        f"/api/projects/{project['id']}",
        json={"name": "Updated Fintech Gateway", "branch": "release/v1"},
        headers=headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Updated Fintech Gateway"
    assert patch_resp.json()["branch"] == "release/v1"

    get_resp = client.get("/api/projects", headers=headers)
    assert get_resp.status_code == 200
    assert len(get_resp.json()) == 1

    delete_resp = client.delete(f"/api/projects/{project['id']}", headers=headers)
    assert delete_resp.status_code == 204

    assert client.get(f"/api/projects/{project['id']}", headers=headers).status_code == 404


def test_ingestion_requires_authenticated_project():
    from app.main import app as fastapi_app
    from fastapi.testclient import TestClient
    unauth_client = TestClient(fastapi_app)
    response = unauth_client.post("/api/projects/not-real/ingest")
    assert response.status_code == 401


def test_ingestion_requires_github_token():
    db = TestingSessionLocal()
    try:
        from app.models.models import User, Project
        from app.auth.jwt import create_access_token

        user = User(email="no-token@example.com", username="no-token")
        db.add(user)
        db.commit()
        db.refresh(user)

        project = Project(
            user_id=user.id,
            name="No Token Project",
            repo_id="999",
            repo_owner="owner",
            repo_name="owner/repo",
            repo_url="https://github.com/owner/repo",
            default_branch="main",
        )
        db.add(project)
        db.commit()
        db.refresh(project)

        token = create_access_token(user.id)
        response = client.post(
            f"/api/projects/{project.id}/ingest",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403
    finally:
        db.close()
