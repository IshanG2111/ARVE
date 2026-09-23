"""Unit tests for Semgrep defensive parser."""
import json
from pathlib import Path

from app.security.semgrep.parser import parse_semgrep_output

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "semgrep"


def test_parse_clean_output():
    raw = (FIXTURES_DIR / "semgrep_clean.json").read_text(encoding="utf-8")
    output = parse_semgrep_output(raw)
    assert output.version == "1.90.0"
    assert len(output.results) == 0
    assert len(output.errors) == 0
    assert len(output.paths_scanned) == 2


def test_parse_findings_output():
    raw = (FIXTURES_DIR / "semgrep_findings.json").read_text(encoding="utf-8")
    output = parse_semgrep_output(raw)
    assert output.version == "1.90.0"
    assert len(output.results) == 5

    first = output.results[0]
    assert first.check_id == "arve.python.sql-injection"
    assert first.path == "/code/app/users.py"
    assert first.start.line == 42
    assert first.end.line == 42
    assert first.severity == "ERROR"
    assert "CWE-89" in first.metadata.cwe[0]
    assert first.metadata.confidence == "HIGH"
    assert first.dataflow_trace is not None
    assert first.fix is not None


def test_parse_malformed_json():
    raw = (FIXTURES_DIR / "semgrep_malformed.json").read_text(encoding="utf-8")
    output = parse_semgrep_output(raw)
    assert len(output.results) == 0
    assert len(output.errors) > 0
    assert "Malformed JSON" in output.errors[0]["message"]


def test_parse_error_json():
    raw = (FIXTURES_DIR / "semgrep_error.json").read_text(encoding="utf-8")
    output = parse_semgrep_output(raw)
    assert len(output.results) == 0
    assert len(output.errors) == 1
    assert "syntax error" in output.errors[0]["message"]


def test_parse_empty_string():
    output = parse_semgrep_output("")
    assert len(output.results) == 0
    assert len(output.errors) == 0


def test_parse_none():
    output = parse_semgrep_output(None)
    assert len(output.results) == 0


def test_parse_defensive_missing_fields():
    partial = {
        "results": [
            {
                "check_id": "test.rule",
                "path": "test.py",
                # missing start, end, extra
            },
            {
                # missing check_id and path
                "start": {"line": "not-an-int"},
                "end": {"line": -5},
                "extra": {
                    "severity": "info",
                    "metadata": {"cwe": "CWE-999"},
                },
            },
        ]
    }
    output = parse_semgrep_output(partial)
    assert len(output.results) == 2
    assert output.results[0].start.line == 1
    assert output.results[0].end.line == 1
    assert output.results[0].severity == "WARNING"

    assert output.results[1].check_id == "semgrep.unknown"
    assert output.results[1].start.line == 1
    assert output.results[1].end.line == 1
    assert output.results[1].severity == "INFO"
    assert output.results[1].metadata.cwe == ["CWE-999"]
