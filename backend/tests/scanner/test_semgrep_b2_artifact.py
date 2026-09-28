"""Focused tests for Semgrep SARIF artifact persistence and retrieval."""

from pathlib import Path
from unittest.mock import MagicMock

from app.scanner.artifacts import ScanArtifactStore
from app.core.config import settings


def test_sarif_content_type():
    assert ScanArtifactStore._content_type(Path("semgrep.sarif")) == "application/sarif+json"


def test_persist_semgrep_sarif_uploads_exact_file(monkeypatch, tmp_path):
    output_dir = tmp_path / "semgrep"
    output_dir.mkdir()
    artifact = output_dir / "semgrep.sarif"
    artifact.write_text('{"version":"2.1.0","runs":[]}', encoding="utf-8")

    client = MagicMock()
    store = ScanArtifactStore(client=client)

    monkeypatch.setattr(store, "bucket", "arve-scan-artifacts")
    monkeypatch.setattr(store, "prefix", "scans")
    monkeypatch.setattr(settings, "ARVE_ENV", "dev")

    reference = store.persist_output("scan-123", "semgrep", output_dir)

    assert reference == "b2://arve-scan-artifacts/scans/scan-123/semgrep"
    client.upload_file.assert_called_once()

    args, kwargs = client.upload_file.call_args
    assert args[1] == "arve-scan-artifacts"
    assert args[2] == "scans/scan-123/semgrep/semgrep.sarif"
    assert kwargs["ExtraArgs"]["ContentType"] == "application/sarif+json"
    assert not output_dir.exists()


def test_persist_semgrep_sarif_skips_empty_output(tmp_path):
    output_dir = tmp_path / "semgrep"
    output_dir.mkdir()

    client = MagicMock()
    store = ScanArtifactStore(client=client)
    assert store.persist_output("scan-123", "semgrep", output_dir) is None
    client.upload_file.assert_not_called()
