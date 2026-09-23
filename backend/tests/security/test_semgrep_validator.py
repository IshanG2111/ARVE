"""Unit tests for Semgrep rule schema and convention validation."""
from pathlib import Path
from typing import Any

from app.security.semgrep.validator import (
    validate_all_rules,
    validate_rule,
    validate_rule_file,
)


def test_valid_rule_passes():
    valid_rule = {
        "id": "arve.python.sql-injection",
        "languages": ["python"],
        "severity": "ERROR",
        "message": "SQL Injection detected.",
        "metadata": {
            "cwe": ["CWE-89: SQL Injection"],
            "owasp": ["A03:2021 - Injection"],
            "category": "security",
            "confidence": "HIGH",
            "provenance": "arve",
            "remediation_id": "sql-injection",
        },
        "pattern": "$DB.execute(...)",
    }
    errors = validate_rule(valid_rule)
    assert errors == [], f"Expected no errors, got: {errors}"


def test_invalid_rule_id_convention():
    invalid_rule = {
        "id": "invalid_rule_name_without_prefix",
        "languages": ["python"],
        "severity": "ERROR",
        "message": "Testing invalid ID.",
        "metadata": {
            "cwe": ["CWE-89"],
            "owasp": ["A03:2021 - Injection"],
            "confidence": "HIGH",
            "provenance": "arve",
            "remediation_id": "sql-injection",
        },
        "pattern": "foo()",
    }
    errors = validate_rule(invalid_rule)
    assert any("violates ARVE ID convention" in err for err in errors)


def test_missing_remediation_id():
    rule = {
        "id": "arve.python.path-traversal",
        "languages": ["python"],
        "severity": "ERROR",
        "message": "Path traversal.",
        "metadata": {
            "cwe": ["CWE-22"],
            "owasp": ["A01:2021 - Broken Access Control"],
            "confidence": "MEDIUM",
            "provenance": "arve",
            # missing remediation_id
        },
        "pattern": "open(...)",
    }
    errors = validate_rule(rule)
    assert any("remediation_id" in err for err in errors)


def test_missing_cwe():
    rule = {
        "id": "arve.python.weak-crypto",
        "languages": ["python"],
        "severity": "WARNING",
        "message": "Weak crypto.",
        "metadata": {
            "cwe": [],  # empty list
            "owasp": ["A02:2021 - Cryptographic Failures"],
            "confidence": "HIGH",
            "provenance": "arve",
            "remediation_id": "weak-crypto",
        },
        "pattern": "hashlib.md5()",
    }
    errors = validate_rule(rule)
    assert any("must include a non-empty 'cwe' list" in err for err in errors)


def test_invalid_provenance():
    rule = {
        "id": "arve.python.test-rule",
        "languages": ["python"],
        "severity": "INFO",
        "message": "Test.",
        "metadata": {
            "cwe": ["CWE-200"],
            "owasp": ["A01:2021"],
            "confidence": "LOW",
            "provenance": "thirdparty_unrecognized",
            "remediation_id": "sql-injection",
        },
        "pattern": "test()",
    }
    errors = validate_rule(rule)
    assert any("invalid provenance" in err for err in errors)


def test_taint_rule_requires_sources_and_sinks():
    incomplete_taint_rule = {
        "id": "arve.python.taint-test",
        "mode": "taint",
        "languages": ["python"],
        "severity": "ERROR",
        "message": "Taint test.",
        "metadata": {
            "cwe": ["CWE-89"],
            "owasp": ["A03:2021"],
            "confidence": "HIGH",
            "provenance": "arve",
            "remediation_id": "sql-injection",
        },
        "pattern-sources": [{"pattern": "request.args"}],
        # missing pattern-sinks
    }
    errors = validate_rule(incomplete_taint_rule)
    assert any("must define both 'pattern-sources' and 'pattern-sinks'" in err for err in errors)


def test_bundled_rules_directory_all_valid():
    from app.security.semgrep.rules import get_default_rules_directory

    rules_dir = get_default_rules_directory()
    assert rules_dir.exists()
    all_errors = validate_all_rules(rules_dir)
    assert all_errors == {}, f"Found validation errors in bundled rulepack: {all_errors}"
