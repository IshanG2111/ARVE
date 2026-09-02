import hashlib
import uuid

import pytest

from app.models.models import AnalysisRun, Project, RepositoryFile, Scan, User
from app.scanner.artifacts import ScanArtifactStore
from app.scanner.exceptions import ScanStateTransitionError, ScanValidationError
from app.scanner.interfaces import EngineExecutionStatus, ScannerExecutionContext
from app.scanner.service import ScanEngineRegistry, ScanExecutionService
from app.scanner.state_machine import ScanStateMachine
from app.scanner.workspace import ScanWorkspaceManager


class FakeEngine:
    name = "fake-engine"
    image = "fake:image"

    def build_command(self, context: ScannerExecutionContext):
        return ["fake", "scan"]

    def artifact_path(self, context: ScannerExecutionContext):
        return context.output_path / "result.json"


class FakeArtifactStore:
    def __init__(self, root):
        self.root = root

    def persist_output(self, scan_id, engine_name, output_dir):
        dest = self.root / scan_id / engine_name
        dest.mkdir(parents=True, exist_ok=True)
        for p in output_dir.rglob("*"):
            if p.is_file():
                target = dest / p.name
                target.write_bytes(p.read_bytes())
        import shutil
        shutil.rmtree(output_dir, ignore_errors=True)
        return f"fake://{scan_id}/{engine_name}"


class FakeRunner:
    def __init__(self, status=EngineExecutionStatus.SUCCESS):
        self.status = status
        self.calls = []

    def run(self, context, engine_name, image, engine_command):
        self.calls.append((context, engine_name, image, list(engine_command)))
        context.output_path.mkdir(parents=True, exist_ok=True)
        artifact = context.output_path / "result.json"
        artifact.write_text('{"ok":true}', encoding="utf-8")
        return type(
            "DockerResult",
            (),
            {
                "status": self.status,
                "exit_code": 0 if self.status == EngineExecutionStatus.SUCCESS else 1,
                "duration_ms": 10,
                "stdout": "ok",
                "stderr": "" if self.status == EngineExecutionStatus.SUCCESS else "failed",
                "error_message": None if self.status == EngineExecutionStatus.SUCCESS else "fake failure",
            },
        )()

    def cancel(self, scan_id):
        return True


def _make_snapshot(db):
    user = User(email=f"phase3-{uuid.uuid4().hex}@example.com", username="phase3")
    db.add(user)
    db.commit()

    project = Project(
        user_id=user.id,
        name="Phase 3 Project",
        repo_id="123",
        repo_owner="owner",
        repo_name="owner/repo",
        repo_url="https://github.com/owner/repo",
        default_branch="main",
    )
    db.add(project)
    db.commit()

    content = "export function hello() { return 'world'; }\n"
    run = AnalysisRun(
        project_id=project.id,
        commit_sha="a" * 40,
        status="COMPLETED",
        files_found=2,
        files_ingested=1,
        files_skipped=1,
    )
    db.add(run)
    db.commit()

    db.add(
        RepositoryFile(
            project_id=project.id,
            analysis_run_id=run.id,
            path="src/hello.ts",
            filename="hello.ts",
            extension=".ts",
            language="TypeScript",
            size=len(content.encode()),
            sha256=hashlib.sha256(content.encode()).hexdigest(),
            content=content,
            status="INGESTED",
        )
    )
    db.add(
        RepositoryFile(
            project_id=project.id,
            analysis_run_id=run.id,
            path="image.png",
            filename="image.png",
            extension=".png",
            size=10,
            status="SKIPPED",
            skip_reason="binary_file",
        )
    )
    db.commit()
    return project, run


def test_state_machine_allows_expected_transitions():
    assert ScanStateMachine.can_transition("QUEUED", "INGESTING")
    assert ScanStateMachine.can_transition("INGESTING", "SCANNING")
    assert ScanStateMachine.can_transition("SCANNING", "NORMALIZING")
    assert ScanStateMachine.can_transition("SCANNING", "PARTIAL")
    assert not ScanStateMachine.can_transition("COMPLETED", "SCANNING")
    with pytest.raises(ScanStateTransitionError):
        ScanStateMachine.transition("FAILED", "SCANNING")


def test_workspace_uses_only_ingested_phase2_files(db, tmp_path):
    project, run = _make_snapshot(db)
    scan = Scan(project_id=project.id, analysis_run_id=run.id, commit_sha=run.commit_sha, status="QUEUED")
    db.add(scan)
    db.commit()

    manager = ScanWorkspaceManager(db, root=tmp_path / "workspaces")
    workspace = manager.build(scan)

    assert workspace.file_count == 1
    assert (workspace.source / "src" / "hello.ts").exists()
    assert not (workspace.source / "image.png").exists()
    assert hashlib.sha256((workspace.source / "src" / "hello.ts").read_bytes()).hexdigest() == db.query(RepositoryFile).filter(RepositoryFile.path == "src/hello.ts").one().sha256

    manager.cleanup(scan.id)
    assert not workspace.root.exists()


def test_workspace_rejects_sha_mismatch(db, tmp_path):
    project, run = _make_snapshot(db)
    record = db.query(RepositoryFile).filter(RepositoryFile.analysis_run_id == run.id, RepositoryFile.status == "INGESTED").one()
    record.sha256 = "0" * 64
    db.commit()

    scan = Scan(project_id=project.id, analysis_run_id=run.id, commit_sha=run.commit_sha, status="QUEUED")
    db.add(scan)
    db.commit()

    manager = ScanWorkspaceManager(db, root=tmp_path / "workspaces")
    with pytest.raises(ScanValidationError, match="SHA-256 mismatch"):
        manager.build(scan)

    assert not manager.exists(scan.id)


def test_scan_execution_completes_with_generic_engine(db, tmp_path):
    project, run = _make_snapshot(db)
    scan = Scan(project_id=project.id, analysis_run_id=run.id, commit_sha=run.commit_sha, status="QUEUED")
    db.add(scan)
    db.commit()

    fake_runner = FakeRunner()
    service = ScanExecutionService(
        db,
        registry=ScanEngineRegistry([FakeEngine()]),
        workspace_manager=ScanWorkspaceManager(db, root=tmp_path / "workspaces"),
        docker_runner=fake_runner,
        artifact_store=FakeArtifactStore(tmp_path / "artifacts"),
    )
    completed = service.execute_scan(scan.id)

    assert completed.status == "COMPLETED"
    assert completed.progress_percent == 100
    assert completed.started_at is not None
    assert completed.completed_at is not None
    assert fake_runner.calls[0][1] == "fake-engine"
    engine_run = db.query(Scan).filter(Scan.id == scan.id).one().engine_runs[0]
    assert engine_run.status == "COMPLETED"
    assert engine_run.artifact_reference is not None
    assert (tmp_path / "artifacts" / scan.id / "fake-engine" / "result.json").exists()
    assert not (tmp_path / "workspaces" / scan.id).exists()


def test_scan_execution_marks_partial_on_engine_failure(db, tmp_path):
    project, run = _make_snapshot(db)
    scan = Scan(project_id=project.id, analysis_run_id=run.id, commit_sha=run.commit_sha, status="QUEUED")
    db.add(scan)
    db.commit()

    service = ScanExecutionService(
        db,
        registry=ScanEngineRegistry([FakeEngine()]),
        workspace_manager=ScanWorkspaceManager(db, root=tmp_path / "workspaces"),
        docker_runner=FakeRunner(EngineExecutionStatus.TIMEOUT),
        artifact_store=FakeArtifactStore(tmp_path / "artifacts"),
    )
    completed = service.execute_scan(scan.id)

    assert completed.status == "PARTIAL"
    assert completed.error_message is not None
    assert db.query(Scan).filter(Scan.id == scan.id).one().engine_runs[0].status == "TIMEOUT"
    assert not (tmp_path / "workspaces" / scan.id).exists()


def test_scan_api_connects_to_completed_phase2_run(client_fixture, db, tmp_path, monkeypatch):
    from app.auth.jwt import create_access_token
    from app.core import config as config_module

    project, run = _make_snapshot(db)
    monkeypatch.setattr(config_module.settings, "SCAN_WORKSPACE_ROOT", str(tmp_path / "api-workspaces"))
    monkeypatch.setattr(config_module.settings, "SCANNER_ENABLE_OSV", False)

    user = db.query(User).filter(User.id == project.user_id).one()
    token = create_access_token(user.id)

    response = client_fixture.post(
        f"/api/projects/{project.id}/scan",
        headers={"Authorization": f"Bearer {token}"},
        json={"analysis_run_id": run.id},
    )
    assert response.status_code == 202, response.text
    data = response.json()
    assert data["analysis_run_id"] == run.id
    assert data["commit_sha"] == run.commit_sha
    assert data["status"] == "QUEUED"

    status_response = client_fixture.get(
        f"/api/scans/{data['id']}/status",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status_response.status_code == 200
    assert status_response.json()["analysis_run_id"] == run.id
    assert status_response.json()["status"] == "FAILED"
    assert "No scanner engines" in status_response.json()["error_message"]
    assert status_response.json()["engine_statuses"] == {}


def test_scan_api_rejects_incomplete_phase2_run(client_fixture, db):
    from app.auth.jwt import create_access_token

    user = User(email="incomplete@example.com", username="incomplete")
    db.add(user)
    db.commit()
    project = Project(user_id=user.id, name="Incomplete", repo_owner="owner", repo_name="owner/repo")
    db.add(project)
    db.commit()
    run = AnalysisRun(project_id=project.id, commit_sha="b" * 40, status="FAILED")
    db.add(run)
    db.commit()

    token = create_access_token(user.id)
    response = client_fixture.post(
        f"/api/projects/{project.id}/scan",
        headers={"Authorization": f"Bearer {token}"},
        json={"analysis_run_id": run.id},
    )
    assert response.status_code == 400
    assert "not complete" in response.json()["detail"] or "complete" in response.json()["detail"]


def test_docker_runner_builds_locked_down_command(tmp_path):
    from app.scanner.docker_runner import DockerRunner

    source = tmp_path / "src"
    output = tmp_path / "out"
    source.mkdir()
    output.mkdir()
    context = ScannerExecutionContext(
        scan_id="scan-123",
        workspace_path=source,
        output_path=output,
        timeout_seconds=180,
        environment={"ARVE_TEST_MODE": "success"},
    )
    command = DockerRunner(docker_binary="docker")._build_command(
        context,
        "fake-engine",
        "fake:image",
        ["scan", "/code"],
    )

    joined = " ".join(command)
    assert "--network=none" in joined
    assert "--read-only" in joined
    assert "--memory 1g" in joined
    assert "--cpus 1.5" in joined
    assert "--user 1000:1000" in joined
    assert "target=/code,readonly" in joined
    assert "target=/output" in joined
    assert "--env ARVE_TEST_MODE=success" in joined


def test_create_scan_uses_latest_completed_run_when_not_explicit(db):
    project, first = _make_snapshot(db)
    from datetime import datetime, timedelta

    newer = AnalysisRun(
        project_id=project.id,
        commit_sha="c" * 40,
        status="COMPLETED",
        completed_at=datetime.utcnow() + timedelta(seconds=1),
        files_found=1,
        files_ingested=1,
    )
    db.add(newer)
    db.commit()

    service = ScanExecutionService(db)
    scan = service.create_scan(project.id)
    assert scan.analysis_run_id == newer.id
    assert scan.commit_sha == newer.commit_sha


def test_container_name_is_deterministic_for_cross_process_cancellation():
    from app.scanner.docker_runner import DockerRunner

    first = DockerRunner.container_name("scan-123", "phase3-test")
    second = DockerRunner.container_name("scan-123", "phase3-test")
    assert first == second
    assert first.startswith("arve-scan-123-phase3-test")


def test_phase3_test_engine_is_opt_in(db, monkeypatch):
    from app.core import config as config_module
    from app.scanner.service import build_default_registry

    monkeypatch.setattr(config_module.settings, "SCANNER_ENABLE_TEST_ENGINE", False)
    monkeypatch.setattr(config_module.settings, "SCANNER_ENABLE_OSV", False)
    assert build_default_registry().list() == []

    monkeypatch.setattr(config_module.settings, "SCANNER_ENABLE_TEST_ENGINE", True)
    registry = build_default_registry()
    assert [engine.name for engine in registry.list()] == ["phase3-test"]
