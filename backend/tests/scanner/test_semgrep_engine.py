"""Unit tests for SemgrepEngine."""
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.core.config import settings
from app.scanner.docker_runner import DockerRunResult
from app.scanner.engines.semgrep import SemgrepEngine
from app.scanner.interfaces import EngineExecutionStatus, ScannerExecutionContext
from app.scanner.service import ScanExecutionService, build_default_registry


@pytest.fixture
def context(tmp_path: Path):
    workspace = tmp_path / "workspace"
    output = tmp_path / "output"
    workspace.mkdir()
    output.mkdir()
    return ScannerExecutionContext(
        scan_id="scan-semgrep-test",
        workspace_path=workspace,
        output_path=output,
        timeout_seconds=180,
    )


def test_engine_identity_and_image(context):
    engine = SemgrepEngine()
    assert engine.name == "semgrep"
    assert engine.image == settings.SCANNER_SEMGREP_IMAGE
    assert "semgrep" in engine.image


def test_build_command(context):
    command = list(SemgrepEngine().build_command(context))
    assert command[0] == "semgrep"
    assert command[1] == "scan"
    assert "--json" in command
    assert "--output" in command
    assert "/output/semgrep.json" in command
    assert "--metrics=off" in command
    assert "--disable-version-check" in command
    assert "/code" in command


def test_artifact_path(context):
    assert SemgrepEngine().artifact_path(context) == context.output_path / "semgrep.json"


def test_registry_includes_semgrep_when_enabled(monkeypatch):
    monkeypatch.setattr(settings, "SCANNER_ENABLE_TEST_ENGINE", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_OSV", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_GITLEAKS", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_SEMGREP", True)

    registry = build_default_registry()
    engines = registry.list()
    assert len(engines) == 1
    assert engines[0].name == "semgrep"
    assert isinstance(engines[0], SemgrepEngine)


def test_registry_excludes_semgrep_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "SCANNER_ENABLE_TEST_ENGINE", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_OSV", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_GITLEAKS", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_SEMGREP", False)

    registry = build_default_registry()
    engines = registry.list()
    assert len(engines) == 0


def test_exit_code_zero_with_artifact_is_success(context):
    engine = SemgrepEngine()
    artifact = context.output_path / "semgrep" / "semgrep.json"
    artifact.parent.mkdir(parents=True, exist_ok=True)
    artifact.write_text('{"results": []}', encoding="utf-8")

    runner = MagicMock()
    runner.run.return_value = DockerRunResult(
        status=EngineExecutionStatus.SUCCESS,
        exit_code=0,
        duration_ms=500,
        stdout="",
        stderr="",
    )
    service = ScanExecutionService(db=MagicMock(), docker_runner=runner)
    workspace = MagicMock()
    workspace.source = context.workspace_path
    workspace.output = context.output_path
    scan = MagicMock(id=context.scan_id)

    result = service._run_engine(scan, workspace, engine, 180)
    assert result.status == EngineExecutionStatus.SUCCESS
    assert result.exit_code == 0
    assert result.artifact_path == artifact


def test_exit_code_one_with_artifact_is_success(context):
    engine = SemgrepEngine()
    artifact = context.output_path / "semgrep" / "semgrep.json"
    artifact.parent.mkdir(parents=True, exist_ok=True)
    artifact.write_text('{"results": [{"check_id": "test"}]}', encoding="utf-8")

    runner = MagicMock()
    runner.run.return_value = DockerRunResult(
        status=EngineExecutionStatus.FAILED,
        exit_code=1,
        duration_ms=600,
        stdout="",
        stderr="findings detected",
        error_message="findings detected",
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


def test_exit_code_one_without_artifact_is_failure(context):
    engine = SemgrepEngine()
    runner = MagicMock()
    runner.run.return_value = DockerRunResult(
        status=EngineExecutionStatus.FAILED,
        exit_code=1,
        duration_ms=100,
        stdout="",
        stderr="fatal error: invalid profile",
        error_message="fatal error: invalid profile",
    )
    service = ScanExecutionService(db=MagicMock(), docker_runner=runner)
    workspace = MagicMock()
    workspace.source = context.workspace_path
    workspace.output = context.output_path
    scan = MagicMock(id=context.scan_id)

    result = service._run_engine(scan, workspace, engine, 180)
    assert result.status == EngineExecutionStatus.FAILED
    assert result.artifact_path is None
