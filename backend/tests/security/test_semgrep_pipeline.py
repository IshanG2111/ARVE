"""End-to-end normalized output regression tests for Semgrep SAST pipeline.

Verifies: Raw Semgrep Output -> Parser -> Mapper -> NormalizedFinding
Ensuring rulepack_version, remediation_id, provenance, and dataflow traces are preserved.
"""
import json
from pathlib import Path

from app.security.mappers.semgrep import SemgrepFindingMapper
from app.security.models import FindingConfidence, FindingSeverity, FindingType
from app.security.semgrep.parser import parse_semgrep_output
from app.security.semgrep.rules import get_rulepack_version


def test_semgrep_pipeline_end_to_end_normalization():
    fixture_path = (
        Path(__file__).resolve().parent.parent
        / "fixtures"
        / "semgrep"
        / "semgrep_findings.json"
    )
    assert fixture_path.exists()
    raw_content = fixture_path.read_text(encoding="utf-8")

    # Step 1: Parser
    parsed_output = parse_semgrep_output(raw_content)
    assert len(parsed_output.results) >= 2
    assert parsed_output.version == "1.90.0"

    # Step 2: Mapper
    mapper = SemgrepFindingMapper()
    findings = mapper.map_artifact(raw_content)
    assert len(findings) >= 2

    # Step 3: Verify NormalizedFinding properties
    active_rulepack_version = get_rulepack_version()
    assert active_rulepack_version == "2026.09.1"

    sql_finding = next(f for f in findings if f.rule_id == "arve.python.sql-injection")
    assert sql_finding.finding_type == FindingType.SAST.value
    assert sql_finding.severity == FindingSeverity.HIGH
    assert sql_finding.confidence == FindingConfidence.HIGH
    assert sql_finding.file_path == "app/users.py"
    assert sql_finding.line_start == 42
    assert sql_finding.cwe == "CWE-89"

    # Step 4: Verify metadata and audit traceability
    meta = sql_finding.raw_json
    assert meta["rule_id"] == "arve.python.sql-injection"
    assert meta["rulepack_version"] == active_rulepack_version
    assert "provenance" in meta
    assert "remediation" in meta
    assert meta["remediation"]["why_it_matters"] != ""
    assert "dataflow_trace" in meta
    assert meta["dataflow_trace"]["taint_source"] == "request.args['id']"
    assert meta["dataflow_trace"]["taint_sink"] == "cursor.execute"


def test_semgrep_pipeline_with_custom_remediation_id():
    custom_raw = {
        "version": "1.90.0",
        "results": [
            {
                "check_id": "arve.upstream.javascript.eval-injection",
                "path": "/code/src/runner.js",
                "start": {"line": 15, "col": 1},
                "end": {"line": 15, "col": 20},
                "extra": {
                    "message": "Dangerous eval usage.",
                    "severity": "ERROR",
                    "metadata": {
                        "cwe": ["CWE-95"],
                        "owasp": ["A03:2021 - Injection"],
                        "confidence": "HIGH",
                        "provenance": "upstream",
                        "remediation_id": "code-injection",
                    },
                    "lines": "eval(userInput)",
                },
            }
        ],
    }

    mapper = SemgrepFindingMapper()
    findings = mapper.map_artifact(custom_raw)
    assert len(findings) == 1

    finding = findings[0]
    assert finding.title == "Code Injection Risk"
    assert finding.cwe == "CWE-95"
    assert finding.raw_json["provenance"] == "upstream"
    assert finding.raw_json["remediation_id"] == "code-injection"
    assert finding.raw_json["rulepack_version"] == "2026.09.1"
    assert "ast.literal_eval" in finding.raw_json["remediation"]["example_diff"]
