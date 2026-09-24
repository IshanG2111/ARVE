"""Performance benchmark tests for Semgrep rule loading and normalization pipeline."""
import time
from pathlib import Path

from app.security.mappers.semgrep import SemgrepFindingMapper
from app.security.semgrep.rules import get_default_rules_directory, load_all_rules
from app.security.semgrep.validator import validate_all_rules


def test_rule_loading_performance():
    """Verify that loading all bundled rules completes in sub-50ms."""
    start = time.perf_counter()
    rules = load_all_rules("extended")
    duration = time.perf_counter() - start

    assert len(rules) >= 15
    # Strict latency threshold for local rule loading
    assert duration < 0.100, f"Rule loading took {duration:.4f}s, expected < 0.100s"


def test_rule_validation_performance():
    """Verify that schema validation across all rules completes quickly."""
    rules_dir = get_default_rules_directory()
    start = time.perf_counter()
    errors = validate_all_rules(rules_dir)
    duration = time.perf_counter() - start

    assert errors == {}
    assert duration < 0.200, f"Rule validation took {duration:.4f}s, expected < 0.200s"


def test_normalization_throughput_performance():
    """Verify high-throughput mapping of findings without memory or CPU bottleneck."""
    single_match = {
        "check_id": "arve.python.sql-injection",
        "path": "/code/app/users.py",
        "start": {"line": 10, "col": 1},
        "end": {"line": 10, "col": 30},
        "extra": {
            "message": "SQL Injection",
            "severity": "ERROR",
            "metadata": {
                "cwe": ["CWE-89"],
                "owasp": ["A03:2021 - Injection"],
                "confidence": "HIGH",
                "provenance": "arve",
                "remediation_id": "sql-injection",
            },
            "lines": "cursor.execute(query)",
        },
    }

    synthetic_payload = {
        "version": "1.90.0",
        "results": [single_match] * 200,  # 200 findings
    }

    mapper = SemgrepFindingMapper()
    start = time.perf_counter()
    findings = mapper.map_artifact(synthetic_payload)
    duration = time.perf_counter() - start

    assert len(findings) == 200
    assert duration < 0.150, f"Mapping 200 findings took {duration:.4f}s, expected < 0.150s"
