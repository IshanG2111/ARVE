"""Unit tests for SemgrepFindingMapper."""
from pathlib import Path

from app.security.mappers.semgrep import SemgrepFindingMapper, clean_semgrep_file_path, extract_primary_cwe
from app.security.models import FindingConfidence, FindingSeverity, FindingStatus, FindingType

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "semgrep"


def test_clean_semgrep_file_path():
    assert clean_semgrep_file_path("/code/app/users.py") == "app/users.py"
    assert clean_semgrep_file_path("code/app/users.py") == "app/users.py"
    assert clean_semgrep_file_path("/workspace/src/index.ts") == "src/index.ts"
    assert clean_semgrep_file_path("./frontend/views/profile.js") == "frontend/views/profile.js"
    assert clean_semgrep_file_path("app\\models\\user.py") == "app/models/user.py"
    assert clean_semgrep_file_path(None) is None


def test_extract_primary_cwe():
    assert extract_primary_cwe(["CWE-89: SQL Injection", "CWE-20"]) == "CWE-89"
    assert extract_primary_cwe(["CWE-78"]) == "CWE-78"
    assert extract_primary_cwe(["none", "custom"]) is None
    assert extract_primary_cwe([]) is None


def test_map_clean_artifact():
    raw = (FIXTURES_DIR / "semgrep_clean.json").read_text(encoding="utf-8")
    mapper = SemgrepFindingMapper()
    findings = mapper.map_artifact(raw)
    assert findings == []


def test_map_findings_artifact():
    raw = (FIXTURES_DIR / "semgrep_findings.json").read_text(encoding="utf-8")
    mapper = SemgrepFindingMapper()
    findings = mapper.map_artifact(raw)
    assert len(findings) == 5

    # 1. SQL Injection finding
    sqli = findings[0]
    assert sqli.engine == "semgrep"
    assert sqli.finding_type == FindingType.SAST.value
    assert sqli.title == "SQL Injection Risk"
    assert sqli.severity == FindingSeverity.HIGH
    assert sqli.confidence == FindingConfidence.HIGH
    assert sqli.status == FindingStatus.OPEN
    assert sqli.file_path == "app/users.py"
    assert sqli.line_start == 42
    assert sqli.line_end == 42
    assert sqli.rule_id == "arve.python.sql-injection"
    assert sqli.cwe == "CWE-89"
    assert isinstance(sqli.raw_json, dict)
    assert sqli.raw_json["rule_id"] == "arve.python.sql-injection"
    assert "remediation" in sqli.raw_json
    assert "parameterized" in sqli.raw_json["remediation"]["recommended_action"]
    assert sqli.raw_json["engine_version"] == "1.90.0"

    # 2. Command Injection finding
    cmdi = findings[1]
    assert cmdi.title == "Command Injection Risk"
    assert cmdi.severity == FindingSeverity.HIGH
    assert cmdi.file_path == "app/system.py"
    assert cmdi.line_start == 18
    assert cmdi.line_end == 18
    assert cmdi.cwe == "CWE-78"

    # 3. XSS finding
    xss = findings[2]
    assert xss.title == "Cross-Site Scripting (XSS)"
    assert xss.severity == FindingSeverity.HIGH
    assert xss.file_path == "frontend/views/profile.js"
    assert xss.cwe == "CWE-79"

    # 4. Insecure TLS finding
    tls = findings[3]
    assert tls.title == "Insecure TLS Configuration"
    assert tls.severity == FindingSeverity.HIGH
    assert tls.file_path == "app/client.py"
    assert tls.cwe == "CWE-295"

    # 5. Weak Crypto finding
    crypto = findings[4]
    assert crypto.title == "Weak Cryptographic Algorithm"
    assert crypto.severity == FindingSeverity.MEDIUM
    assert crypto.file_path == "app/auth.py"
    assert crypto.cwe == "CWE-327"


def test_map_malformed_json():
    raw = (FIXTURES_DIR / "semgrep_malformed.json").read_text(encoding="utf-8")
    mapper = SemgrepFindingMapper()
    findings = mapper.map_artifact(raw)
    assert findings == []


def test_map_error_json():
    raw = (FIXTURES_DIR / "semgrep_error.json").read_text(encoding="utf-8")
    mapper = SemgrepFindingMapper()
    findings = mapper.map_artifact(raw)
    assert findings == []


def test_map_line_range_safety():
    content = {
        "results": [
            {
                "check_id": "test.rule",
                "path": "/code/test.py",
                "start": {"line": 10},
                "end": {"line": 5},  # inverted line range
                "extra": {
                    "message": "Inverted lines",
                    "severity": "WARNING",
                },
            }
        ]
    }
    mapper = SemgrepFindingMapper()
    findings = mapper.map_artifact(content)
    assert len(findings) == 1
    assert findings[0].line_start == 10
    assert findings[0].line_end == 10  # normalized to >= line_start
