import uuid
import pytest
from tests.conftest import client, TestingSessionLocal, engine
from app.models.models import Project, Repository, TargetWebsite


def get_auth_headers():
    token_str = f"test_token_{uuid.uuid4().hex[:8]}"
    fb_resp = client.post(
        "/api/auth/firebase",
        json={
            "id_token": f"mock_firebase_{token_str}",
            "github_access_token": f"mock_gh_{token_str}"
        }
    )
    assert fb_resp.status_code == 200, fb_resp.text
    token = fb_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_firebase_auth_and_project_flow():
    headers = get_auth_headers()

    # Verify user profile via /api/auth/me
    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    user_data = me_resp.json()
    assert "firebase_uid" in user_data
    assert "email" in user_data

    # Create Project with GitHub Repository & Target Website
    proj_resp = client.post(
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
    assert proj_resp.status_code == 201, proj_resp.text
    proj_data = proj_resp.json()
    project_id = proj_data["id"]
    repository_id = proj_data["repository_id"]
    assert proj_data["repository"]["github_repo_id"] == "test-102"
    assert len(proj_data["targets"]) == 1

    # Get Project
    get_resp = client.get(f"/api/projects/{project_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["branch"] == "main"

    # Update Project
    patch_resp = client.patch(
        f"/api/projects/{project_id}",
        json={"name": "Updated Fintech Gateway", "branch": "develop"},
        headers=headers
    )
    assert patch_resp.status_code == 200, patch_resp.text
    assert patch_resp.json()["name"] == "Updated Fintech Gateway"
    assert patch_resp.json()["branch"] == "develop"

    # Verify database state
    db = TestingSessionLocal()
    try:
        db_project = db.query(Project).filter(Project.id == project_id).first()
        assert db_project is not None
        assert db_project.name == "Updated Fintech Gateway"
        assert db_project.branch == "develop"
    finally:
        db.close()

    # Delete Project
    del_resp = client.delete(f"/api/projects/{project_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify deleted
    get_after = client.get(f"/api/projects/{project_id}", headers=headers)
    assert get_after.status_code == 404

    db = TestingSessionLocal()
    try:
        assert db.query(Project).filter(Project.id == project_id).first() is None
        assert db.query(TargetWebsite).filter(TargetWebsite.project_id == project_id).first() is None
        assert db.query(Repository).filter(Repository.id == repository_id).first() is not None
    finally:
        db.close()


def test_target_crud_and_ownership():
    headers = get_auth_headers()

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
    owner_headers = get_auth_headers()
    other_headers = get_auth_headers()

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
