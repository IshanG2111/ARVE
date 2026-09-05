"""Unit tests for GitleaksEngine."""
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.core.config import settings
from app.scanner.docker_runner import DockerRunResult
from app.scanner.engines.gitleaks import GitleaksEngine
from app.scanner.interfaces import EngineExecutionStatus, ScannerExecutionContext
from app.scanner.service import ScanExecutionService, build_default_registry


@pytest.fixture
def context(tmp_path: Path):
    workspace = tmp_path / "workspace"
    output = tmp_path / "output"
    workspace.mkdir()
    output.mkdir()
    return ScannerExecutionContext(
        scan_id="scan-gitleaks-test",
        workspace_path=workspace,
        output_path=output,
        timeout_seconds=180,
    )


def test_engine_identity_and_image(context):
    engine = GitleaksEngine()
    assert engine.name == "gitleaks"
    assert engine.image == settings.SCANNER_GITLEAKS_IMAGE
    assert "gitleaks" in engine.image


def test_build_command(context):
    command = list(GitleaksEngine().build_command(context))
    assert command == [
        "dir", "/code",
        "--report-format", "json",
        "--report-path", "/output/gitleaks.json",
        "--redact",
    ]


def test_artifact_path(context):
    assert GitleaksEngine().artifact_path(context) == context.output_path / "gitleaks.json"


def test_registry_includes_gitleaks_when_enabled(monkeypatch):
    monkeypatch.setattr(settings, "SCANNER_ENABLE_TEST_ENGINE", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_OSV", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_GITLEAKS", True)

    # Import locally to avoid changing the Phase 3 registry contract.
    from app.scanner.parallel import build_security_registry
    registry = build_security_registry()
    engines = registry.list()
    assert len(engines) == 1
    assert engines[0].name == "gitleaks"


def test_exit_code_one_with_artifact_is_success(context):
    engine = GitleaksEngine()
    artifact = context.output_path / "gitleaks" / "gitleaks.json"
    artifact.parent.mkdir(parents=True, exist_ok=True)
    artifact.write_text("[]", encoding="utf-8")

    runner = MagicMock()
    runner.run.return_value = DockerRunResult(
        status=EngineExecutionStatus.FAILED,
        exit_code=1,
        duration_ms=100,
        stdout="",
        stderr="leaks found",
        error_message="leaks found",
    )
    service = ScanExecutionService(db=MagicMock(), docker_runner=runner)
    workspace = MagicMock()
    workspace.source = context.workspace_path
    workspace.output = context.output_path
    scan = MagicMock(id=context.scan_id)

    result = service._run_engine(scan, workspace, engine, 180)
    assert result.status == EngineExecutionStatus.SUCCESS
    assert result.exit_code == 1
    assert result.artifact_path == artifact


def test_exit_code_two_without_artifact_is_failure(context):
    engine = GitleaksEngine()
    runner = MagicMock()
    runner.run.return_value = DockerRunResult(
        status=EngineExecutionStatus.FAILED,
        exit_code=2,
        duration_ms=100,
        stdout="",
        stderr="invalid invocation",
        error_message="invalid invocation",
    )
    service = ScanExecutionService(db=MagicMock(), docker_runner=runner)
    workspace = MagicMock()
    workspace.source = context.workspace_path
    workspace.output = context.output_path
    scan = MagicMock(id=context.scan_id)

    result = service._run_engine(scan, workspace, engine, 180)
    assert result.status == EngineExecutionStatus.FAILED
    assert result.artifact_path is None
