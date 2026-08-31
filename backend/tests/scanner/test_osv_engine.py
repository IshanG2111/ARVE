"""Unit tests for OsvEngine and its integration into the scanner service."""
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

from app.core.config import settings
from app.scanner.docker_runner import DockerRunResult
from app.scanner.engines.osv import OsvEngine
from app.scanner.interfaces import (
    EngineExecutionStatus,
    ScannerExecutionContext,
    ScannerExecutionResult,
)
from app.scanner.service import ScanEngineRegistry, ScanExecutionService, build_default_registry


@pytest.fixture
def mock_context(tmp_path: Path) -> ScannerExecutionContext:
    workspace_dir = tmp_path / "workspace"
    output_dir = tmp_path / "output"
    workspace_dir.mkdir()
    output_dir.mkdir()
    return ScannerExecutionContext(
        scan_id="scan-osv-test-1",
        workspace_path=workspace_dir,
        output_path=output_dir,
        timeout_seconds=180,
    )


class TestOsvEngine:
    """Validate OsvEngine configuration and ScannerEngine protocol implementation."""

    def test_engine_identity(self):
        engine = OsvEngine()
        assert engine.name == "osv"

    def test_engine_image_pinned(self):
        engine = OsvEngine()
        assert engine.image == settings.SCANNER_OSV_IMAGE
        assert "ghcr.io/google/osv-scanner" in engine.image

    def test_build_command(self, mock_context):
        engine = OsvEngine()
        cmd = list(engine.build_command(mock_context))
        assert cmd == ["--format", "json", "--output", "/output/osv.json", "-r", "/code"]

    def test_artifact_path(self, mock_context):
        engine = OsvEngine()
        expected = mock_context.output_path / "osv.json"
        assert engine.artifact_path(mock_context) == expected


class TestOsvRegistryIntegration:
    """Validate registry activation when SCANNER_ENABLE_OSV is toggled."""

    def test_registry_includes_osv_when_enabled(self, monkeypatch):
        monkeypatch.setattr(settings, "SCANNER_ENABLE_OSV", True)
        monkeypatch.setattr(settings, "SCANNER_ENABLE_TEST_ENGINE", False)

        registry = build_default_registry()
        engines = registry.list()
        assert len(engines) == 1
        assert engines[0].name == "osv"
        assert isinstance(engines[0], OsvEngine)

    def test_registry_excludes_osv_when_disabled(self, monkeypatch):
        monkeypatch.setattr(settings, "SCANNER_ENABLE_OSV", False)
        monkeypatch.setattr(settings, "SCANNER_ENABLE_TEST_ENGINE", False)

        registry = build_default_registry()
        engines = registry.list()
        assert len(engines) == 0


class TestOsvExecutionResultSemantics:
    """Validate exit-code and artifact-validity evaluation in ScanExecutionService._run_engine."""

    def test_exit_0_with_artifact_evaluates_to_success(self, mock_context):
        engine = OsvEngine()
        artifact = mock_context.output_path / "osv.json"
        artifact.write_text('{"results": []}', encoding="utf-8")

        mock_runner = MagicMock()
        mock_runner.run.return_value = DockerRunResult(
            status=EngineExecutionStatus.SUCCESS,
            exit_code=0,
            duration_ms=1200,
            stdout="",
            stderr="",
        )

        mock_db = MagicMock()
        service = ScanExecutionService(db=mock_db, docker_runner=mock_runner)

        workspace_mock = MagicMock()
        workspace_mock.source = mock_context.workspace_path
        workspace_mock.output = mock_context.output_path.parent

        scan_mock = MagicMock()
        scan_mock.id = mock_context.scan_id

        result = service._run_engine(
            scan=scan_mock,
            workspace=workspace_mock,
            engine=engine,
            timeout_seconds=180,
        )

        assert result.status == EngineExecutionStatus.SUCCESS
        assert result.exit_code == 0
        assert result.error_message is None

    def test_exit_1_with_valid_artifact_evaluates_to_success(self, mock_context):
        """OSV returns exit code 1 when findings are present; with valid artifact this is SUCCESS."""
        engine = OsvEngine()
        # Engine writes osv.json into engine-specific output dir
        engine_output_dir = mock_context.output_path.parent / "osv"
        engine_output_dir.mkdir(parents=True, exist_ok=True)
        artifact = engine_output_dir / "osv.json"
        artifact.write_text('{"results": [{"packages": [{"vulnerabilities": [{"id": "GHSA-1"}]}]}]}', encoding="utf-8")

        mock_runner = MagicMock()
        mock_runner.run.return_value = DockerRunResult(
            status=EngineExecutionStatus.FAILED,
            exit_code=1,
            duration_ms=2500,
            stdout="vulnerabilities found",
            stderr="",
            error_message="process failed",
        )

        mock_db = MagicMock()
        service = ScanExecutionService(db=mock_db, docker_runner=mock_runner)

        workspace_mock = MagicMock()
        workspace_mock.source = mock_context.workspace_path
        workspace_mock.output = mock_context.output_path.parent

        scan_mock = MagicMock()
        scan_mock.id = mock_context.scan_id

        result = service._run_engine(
            scan=scan_mock,
            workspace=workspace_mock,
            engine=engine,
            timeout_seconds=180,
        )

        assert result.status == EngineExecutionStatus.SUCCESS
        assert result.exit_code == 1
        assert result.error_message is None
        assert result.artifact_path is not None

    def test_exit_1_without_artifact_evaluates_to_failed(self, mock_context):
        """When exit code is 1 and artifact is missing, it must be treated as FAILED."""
        engine = OsvEngine()

        mock_runner = MagicMock()
        mock_runner.run.return_value = DockerRunResult(
            status=EngineExecutionStatus.FAILED,
            exit_code=1,
            duration_ms=100,
            stdout="",
            stderr="fatal error: invalid configuration",
            error_message="fatal error: invalid configuration",
        )

        mock_db = MagicMock()
        service = ScanExecutionService(db=mock_db, docker_runner=mock_runner)

        workspace_mock = MagicMock()
        workspace_mock.source = mock_context.workspace_path
        workspace_mock.output = mock_context.output_path.parent

        scan_mock = MagicMock()
        scan_mock.id = mock_context.scan_id

        result = service._run_engine(
            scan=scan_mock,
            workspace=workspace_mock,
            engine=engine,
            timeout_seconds=180,
        )

        assert result.status == EngineExecutionStatus.FAILED
        assert result.exit_code == 1
        assert result.error_message == "fatal error: invalid configuration"
        assert result.artifact_path is None

    def test_timeout_evaluates_to_timeout(self, mock_context):
        engine = OsvEngine()

        mock_runner = MagicMock()
        mock_runner.run.return_value = DockerRunResult(
            status=EngineExecutionStatus.TIMEOUT,
            exit_code=None,
            duration_ms=180000,
            stdout="",
            stderr="",
            error_message="Engine timed out after 180s",
        )

        mock_db = MagicMock()
        service = ScanExecutionService(db=mock_db, docker_runner=mock_runner)

        workspace_mock = MagicMock()
        workspace_mock.source = mock_context.workspace_path
        workspace_mock.output = mock_context.output_path.parent

        scan_mock = MagicMock()
        scan_mock.id = mock_context.scan_id

        result = service._run_engine(
            scan=scan_mock,
            workspace=workspace_mock,
            engine=engine,
            timeout_seconds=180,
        )

        assert result.status == EngineExecutionStatus.TIMEOUT
        assert result.error_message == "Engine timed out after 180s"
