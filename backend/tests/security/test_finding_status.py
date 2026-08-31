"""Tests for Security Finding status transitions, fixed_version extraction, and suppression metadata."""
import pytest
from app.models.models import Project, Scan, SecurityFinding, User
from app.security.mappers.osv import OsvFindingMapper, extract_fixed_version
from tests.conftest import TestingSessionLocal, client


def test_extract_fixed_version():
    vuln_data = {
        "id": "GHSA-35jh-r3h4-6jhm",
        "affected": [
            {
                "package": {"name": "lodash", "ecosystem": "npm"},
                "ranges": [
                    {
                        "type": "SEMVER",
                        "events": [
                            {"introduced": "0"},
                            {"fixed": "4.17.21"},
                        ],
                    }
                ],
            }
        ],
    }
    fixed = extract_fixed_version(vuln_data, "lodash")
    assert fixed == "4.17.21"

    # Non-matching package
    assert extract_fixed_version(vuln_data, "axios") is None


def test_update_finding_status_flow():
    # 1. Login via auth endpoint
    fb_resp = client.post(
        "/api/auth/firebase",
        json={
            "id_token": "mock_firebase_token_finding_status_test",
            "github_access_token": "mock_github_access_token_status_test",
        },
    )
    assert fb_resp.status_code == 200
    token = fb_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get authenticated user
    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    user_id = me_resp.json()["id"]

    # 3. Setup mock project, scan, and finding
    db = TestingSessionLocal()
    from app.models.models import AnalysisRun

    project = Project(
        user_id=user_id,
        repo_id="999",
        repo_name="org/secure-app",
        default_branch="main",
    )
    db.add(project)
    db.commit()

    run = AnalysisRun(
        project_id=project.id,
        commit_sha="a1b2c3d4e5",
        status="COMPLETED",
    )
    db.add(run)
    db.commit()

    scan = Scan(
        project_id=project.id,
        analysis_run_id=run.id,
        commit_sha="a1b2c3d4e5",
        status="COMPLETED",
    )
    db.add(scan)
    db.commit()

    finding = SecurityFinding(
        scan_id=scan.id,
        project_id=project.id,
        engine="osv",
        finding_type="dependency",
        title="Command injection in lodash",
        severity="HIGH",
        status="OPEN",
        package_name="lodash",
        package_version="4.17.20",
        fixed_version="4.17.21",
        fingerprint="fp-test-12345",
    )
    db.add(finding)
    db.commit()
    finding_id = finding.id
    scan_id = scan.id
    run_id = run.id
    project_id = project.id
    db.close()

    # 4. Test Acknowledge status
    ack_resp = client.patch(
        f"/api/findings/{finding_id}/status",
        json={"status": "ACKNOWLEDGED"},
        headers=headers,
    )
    assert ack_resp.status_code == 200
    data = ack_resp.json()
    assert data["status"] == "ACKNOWLEDGED"
    assert data["fixed_version"] == "4.17.21"

    # 5. Test Suppress status with reason and justification
    sup_resp = client.patch(
        f"/api/findings/{finding_id}/status",
        json={
            "status": "SUPPRESSED",
            "suppression_reason": "Not exploitable in this application",
            "suppression_justification": "Template function not exposed to untrusted input.",
        },
        headers=headers,
    )
    assert sup_resp.status_code == 200
    data = sup_resp.json()
    assert data["status"] == "SUPPRESSED"
    assert data["suppression_reason"] == "Not exploitable in this application"
    assert data["suppression_justification"] == "Template function not exposed to untrusted input."

    # 6. Test Reopen status
    reopen_resp = client.patch(
        f"/api/findings/{finding_id}/status",
        json={"status": "OPEN"},
        headers=headers,
    )
    assert reopen_resp.status_code == 200
    assert reopen_resp.json()["status"] == "OPEN"

    # Cleanup
    db = TestingSessionLocal()
    db.query(SecurityFinding).filter(SecurityFinding.id == finding_id).delete()
    db.query(Scan).filter(Scan.id == scan_id).delete()
    db.query(AnalysisRun).filter(AnalysisRun.id == run_id).delete()
    db.query(Project).filter(Project.id == project_id).delete()
    db.commit()
    db.close()
