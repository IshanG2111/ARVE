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
