import uuid
from tests.conftest import client, TestingSessionLocal, engine


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_firebase_auth_and_project_flow():
    # 1. Login with Firebase ID token
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

    # 2. Verify user profile via /api/auth/me
    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    user_data = me_resp.json()
    assert user_data["firebase_uid"] == "firebase_uid_mock_firebase_token_test123"
    assert user_data["email"] == "octocat@github.com"

    # 3. Create Project with GitHub Repository & Target Website
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

    # 4. Test PATCH /api/projects/{project_id} update endpoint
    patch_resp = client.patch(
        f"/api/projects/{proj_data['id']}",
        json={"name": "Updated Fintech Gateway", "branch": "release/v1"},
        headers=headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Updated Fintech Gateway"
    assert patch_resp.json()["branch"] == "release/v1"

    # 5. Create Project without Deployment URL
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



