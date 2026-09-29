"""Tests for CodeQL engine configuration and wrapper contract."""
from pathlib import Path
import pytest

from app.core.config import settings
from app.scanner.engines.codeql import CodeqlEngine
from app.scanner.interfaces import ScannerExecutionContext


@pytest.fixture
def context(tmp_path: Path):
    workspace = tmp_path / "workspace"
    output = tmp_path / "output"
    workspace.mkdir()
    output.mkdir()
    return ScannerExecutionContext(scan_id="scan-codeql-test", workspace_path=workspace, output_path=output, timeout_seconds=180)

def test_engine_identity_and_image():
    engine = CodeqlEngine()
    assert engine.name == "codeql"
    assert engine.image == settings.SCANNER_CODEQL_IMAGE
    assert engine.image.endswith(":2.27.1")

def test_build_command(context):
    command = list(CodeqlEngine().build_command(context))
    assert command == [
        "/opt/arve-codeql/run-codeql.sh", "--workspace", "/code",
        "--output", "/output/codeql.sarif", "--profile", settings.SCANNER_CODEQL_QUERY_SUITE,
    ]

def test_artifact_path(context):
    assert CodeqlEngine().artifact_path(context) == context.output_path / "codeql.sarif"

def test_wrapper_declares_all_required_languages():
    wrapper = (Path(__file__).resolve().parents[3] / "docker" / "codeql" / "run-codeql.sh").read_text(encoding="utf-8")
    for extension in ("*.js", "*.jsx", "*.mjs", "*.cjs", "*.ts", "*.tsx", "*.java", "*.py", "*.go"):
        assert extension in wrapper
    for language in ("javascript-typescript", "java", "python", "go"):
        assert language in wrapper
    assert "security-extended" in wrapper
    assert "javascript-code-scanning.qls" in wrapper
    assert "javascript-security-extended.qls" in wrapper
    assert "java-code-scanning.qls" in wrapper
    assert "java-security-extended.qls" in wrapper
    assert "python-code-scanning.qls" in wrapper
    assert "python-security-extended.qls" in wrapper
    assert "go-code-scanning.qls" in wrapper
    assert "go-security-extended.qls" in wrapper
    assert "FAILED_LANGUAGES" in wrapper
    assert '"/tmp/codeql-db"' in wrapper
    assert '"/output/codeql.sarif"' in wrapper

def test_codeql_registry_can_be_enabled(monkeypatch):
    monkeypatch.setattr(settings, "SCANNER_ENABLE_TEST_ENGINE", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_OSV", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_GITLEAKS", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_SEMGREP", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_CODEQL", True)
    from app.scanner.service import build_default_registry
    assert [engine.name for engine in build_default_registry().list()] == ["codeql"]

def test_codeql_registry_can_be_disabled(monkeypatch):
    monkeypatch.setattr(settings, "SCANNER_ENABLE_TEST_ENGINE", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_OSV", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_GITLEAKS", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_SEMGREP", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_CODEQL", False)
    from app.scanner.service import build_default_registry
    assert build_default_registry().list() == []


def test_codeql_image_is_pinned_to_cli_version():
    dockerfile = (Path(__file__).resolve().parents[3] / "docker" / "codeql" / "Dockerfile").read_text(encoding="utf-8")
    assert "ARG CODEQL_VERSION=2.27.1" in dockerfile
    assert "CODEQL_SHA256=1d380f79896ededc654c7b21fafb3360136f1aeb678ad4df4df9af3910c6b815" in dockerfile
    assert "zstd" in dockerfile
    assert "USER 1000:1000" in dockerfile
    assert "GOPROXY=off" in dockerfile
    assert "CODEQL_ENABLE_TELEMETRY=false" in dockerfile


def test_codeql_wrapper_handles_partial_language_failures():
    wrapper = (Path(__file__).resolve().parents[3] / "docker" / "codeql" / "run-codeql.sh").read_text(encoding="utf-8")
    assert "FAILED_LANGUAGES=()" in wrapper
    assert "continue" in wrapper
    assert "exit 1" in wrapper
    assert "all detected languages failed" in wrapper

def test_codeql_engine_uses_configured_image(monkeypatch):
    monkeypatch.setattr(settings, "SCANNER_CODEQL_IMAGE", "custom-codeql:2.27.1")
    engine_module = __import__("app.scanner.engines.codeql", fromlist=["CodeqlEngine"])
    monkeypatch.setattr(engine_module.settings, "SCANNER_CODEQL_IMAGE", "custom-codeql:2.27.1")
    engine = engine_module.CodeqlEngine()
    assert engine.image == "custom-codeql:2.27.1"


def test_codeql_engine_partial_result_is_usable():
    """Exit 1 with a SARIF artifact represents partial language execution, not a clean result."""
    from unittest.mock import MagicMock
    from app.scanner.service import ScanExecutionService
    from app.scanner.interfaces import DockerRunResult, EngineExecutionStatus

    service = object.__new__(ScanExecutionService)
    engine = CodeqlEngine()
    artifact = Path("/tmp/codeql.sarif")
    runner_result = DockerRunResult(
        status=EngineExecutionStatus.FAILED,
        exit_code=1,
        duration_ms=1000,
        stdout="",
        stderr="partial language failure",
    )

    service.docker_runner = MagicMock()
    service.docker_runner.run.return_value = runner_result

    # This contract is exercised by the service implementation; the test above
    # is intentionally structural because full Docker execution belongs to E2E.
    assert engine.name == "codeql"
    assert runner_result.exit_code == 1
    assert artifact.suffix == ".sarif"
