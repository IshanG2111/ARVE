"""CodeQL native SARIF artifact contract tests."""
from pathlib import Path

from app.scanner.artifacts import ScanArtifactStore


def test_codeql_sarif_uses_expected_content_type_and_key():
    assert ScanArtifactStore._content_type(Path("codeql.sarif")) == "application/sarif+json"
