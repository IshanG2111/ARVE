"""Tests for CodeQL SARIF normalization."""
import json
from pathlib import Path

from app.security.mappers import CodeqlFindingMapper
from app.security.models import FindingSeverity
from app.security.normalizer import FindingNormalizer

FIXTURE_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "codeql"

def _fixture(name: str) -> str:
    return (FIXTURE_DIR / name).read_text(encoding="utf-8")

def test_codeql_sarif_maps_findings_with_metadata():
    findings = CodeqlFindingMapper().map_artifact(_fixture("codeql_findings.sarif"))
    assert len(findings) == 2
    first = findings[0]
    assert first.engine == "codeql"
    assert first.finding_type == "sast"
    assert first.rule_id == "py/sql-injection"
    assert first.file_path == "src/app.py"
    assert first.line_start == 42
    assert first.line_end == 44
    assert first.cwe == "CWE-89"
    assert first.severity == FindingSeverity.CRITICAL
    assert first.confidence is not None
    assert first.confidence.name == "HIGH"

def test_codeql_mapper_uses_rule_metadata_and_result_level():
    data = json.loads(_fixture("codeql_findings.sarif"))
    data["runs"][0]["rules"][1]["properties"].pop("security-severity")
    findings = CodeqlFindingMapper().map_artifact(data)
    assert findings[1].severity == FindingSeverity.HIGH
    assert findings[1].confidence is not None
    assert findings[1].confidence.name == "MEDIUM"

def test_codeql_clean_and_malformed_artifacts():
    assert CodeqlFindingMapper().map_artifact(_fixture("codeql_clean.sarif")) == []
    assert CodeqlFindingMapper().map_artifact(_fixture("codeql_malformed.sarif")) == []

def test_normalizer_computes_deterministic_fingerprint():
    finding = FindingNormalizer([CodeqlFindingMapper()]).normalize_artifact(
        "codeql", _fixture("codeql_findings.sarif")
    )[0]
    assert finding.fingerprint is not None
    assert len(finding.fingerprint) == 64


def test_codeql_mapper_normalizes_zero_padded_cwe():
    data = json.loads(_fixture("codeql_findings.sarif"))
    data["runs"][0]["rules"][0]["properties"]["tags"] = ["security", "external/cwe/cwe-089"]
    findings = CodeqlFindingMapper().map_artifact(data)
    assert findings[0].cwe == "CWE-89"
