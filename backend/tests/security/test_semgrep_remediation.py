"""Unit tests for Semgrep remediation knowledge base."""
from app.security.semgrep.remediation import (
    REMEDIATION_CATALOG,
    lookup_remediation,
)


def test_remediation_catalog_completeness():
    required_keys = [
        "SQL_INJECTION",
        "COMMAND_INJECTION",
        "XSS",
        "SSRF",
        "PATH_TRAVERSAL",
        "WEAK_CRYPTO",
        "INSECURE_TLS",
        "UNSAFE_DESERIALIZATION",
        "HARDCODED_SECRET",
        "CODE_INJECTION",
    ]
    for key in required_keys:
        assert key in REMEDIATION_CATALOG
        entry = REMEDIATION_CATALOG[key]
        assert len(entry.title) > 0
        assert len(entry.summary) > 0
        assert len(entry.why_it_matters) > 0
        assert len(entry.recommended_action) > 0
        assert entry.cwe is not None
        assert len(entry.references) > 0


def test_lookup_by_cwe():
    adv = lookup_remediation("some.custom.rule", cwes=["CWE-89: SQL Injection"])
    assert adv.title == "SQL Injection Risk"
    assert "parameterized" in adv.recommended_action.lower()

    adv_xss = lookup_remediation("another.rule", cwes=["CWE-79"])
    assert "Cross-Site Scripting" in adv_xss.title

    adv_cmd = lookup_remediation("runner.rule", cwes=["CWE-78"])
    assert "Command Injection" in adv_cmd.title


def test_lookup_by_keyword_heuristics():
    adv = lookup_remediation("rules.python.audit.insecure-deserialization", message="Found pickle usage")
    assert adv.title == "Unsafe Deserialization"

    adv_tls = lookup_remediation("python.requests.verify-false", message="verify=False found")
    assert adv_tls.title == "Insecure TLS Configuration"


def test_lookup_fallback_for_unknown():
    adv = lookup_remediation("custom.internal.rule.xyz", cwes=[], message="Custom internal lint")
    assert "Security Finding: Xyz" in adv.title
    assert "Review the code context" in adv.recommended_action
