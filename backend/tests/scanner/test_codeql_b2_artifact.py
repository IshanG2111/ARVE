"""CodeQL native SARIF artifact contract tests."""
from pathlib import Path
from unittest.mock import MagicMock

from app.scanner.artifacts import ScanArtifactStore


def test_codeql_sarif_uses_expected_content_type():
    assert ScanArtifactStore._content_type(Path("codeql.sarif")) == "application/sarif+json"


def test_codeql_artifact_upload_contract(tmp_path, monkeypatch):
    output = tmp_path / "output"
    output.mkdir()
    artifact = output / "codeql.sarif"
    artifact.write_text('{"version":"2.1.0","runs":[]}', encoding="utf-8")

    uploaded = []

    class Client:
        def upload_file(self, filename, bucket, key, ExtraArgs=None):
            uploaded.append((filename, bucket, key, ExtraArgs))

    store = ScanArtifactStore(client=Client())
    monkeypatch.setattr(store, "bucket", "arve-scan-artifacts")
    monkeypatch.setattr(store, "_get_client", lambda: store.client)

    reference = store.persist_output("scan-123", "codeql", output)
    assert reference == "b2://arve-scan-artifacts/scans/scan-123/codeql"
    assert len(uploaded) == 1
    assert uploaded[0][2] == "scans/scan-123/codeql/codeql.sarif"
    assert uploaded[0][3]["ContentType"] == "application/sarif+json"
    assert not output.exists()
