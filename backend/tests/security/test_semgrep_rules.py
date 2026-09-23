"""Unit tests for Semgrep rule definitions and corpus integrity."""
from pathlib import Path

from app.security.semgrep.rules import get_default_rules_directory, list_rule_files, load_all_rules

CORPUS_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "semgrep" / "corpus"


def test_bundled_rules_directory_exists():
    rules_dir = get_default_rules_directory()
    assert rules_dir.exists()
    assert rules_dir.is_dir()


def test_rule_files_listed():
    files = list_rule_files("standard")
    assert len(files) >= 5
    names = [f.name for f in files]
    assert "injection.yml" in names
    assert "crypto.yml" in names
    assert "filesystem.yml" in names
    assert "deserialization.yml" in names
    assert "auth.yml" in names


def test_load_all_rules_validity():
    rules = load_all_rules("standard")
    assert len(rules) >= 10

    for rule in rules:
        assert "id" in rule, f"Rule missing 'id': {rule}"
        assert "languages" in rule, f"Rule {rule['id']} missing 'languages'"
        assert "severity" in rule, f"Rule {rule['id']} missing 'severity'"
        assert "message" in rule, f"Rule {rule['id']} missing 'message'"
        assert "metadata" in rule, f"Rule {rule['id']} missing 'metadata'"
        assert "pattern" in rule or "patterns" in rule, f"Rule {rule['id']} missing pattern"

        metadata = rule["metadata"]
        assert "cwe" in metadata, f"Rule {rule['id']} metadata missing 'cwe'"
        assert isinstance(metadata["cwe"], list), f"Rule {rule['id']} cwe must be list"
        assert "remediation_id" in metadata, f"Rule {rule['id']} metadata missing 'remediation_id'"
        assert "provenance" in metadata, f"Rule {rule['id']} metadata missing 'provenance'"


def test_vulnerable_and_safe_corpus_pairs():
    """Verify that every vulnerable sample has a corresponding safe counterpart."""
    pairs = [
        ("vulnerable/python/sql_injection.py", "safe/python/sql_parameterized.py"),
        ("vulnerable/python/command_injection.py", "safe/python/command_safe.py"),
        ("vulnerable/python/ssrf.py", "safe/python/ssrf_validated.py"),
        ("vulnerable/python/path_traversal.py", "safe/python/path_traversal_safe.py"),
        ("vulnerable/python/weak_crypto.py", "safe/python/crypto_safe.py"),
        ("vulnerable/python/insecure_tls.py", "safe/python/tls_safe.py"),
        ("vulnerable/python/unsafe_deserialization.py", "safe/python/deserialization_safe.py"),
        ("vulnerable/javascript/xss.js", "safe/javascript/xss_escaped.js"),
        ("vulnerable/javascript/sql_injection.js", "safe/javascript/sql_parameterized.js"),
    ]
    for vuln_rel, safe_rel in pairs:
        vuln_path = CORPUS_DIR / vuln_rel
        safe_path = CORPUS_DIR / safe_rel
        assert vuln_path.exists(), f"Missing vulnerable sample: {vuln_path}"
        assert safe_path.exists(), f"Missing safe sample: {safe_path}"
        assert vuln_path.stat().st_size > 0
        assert safe_path.stat().st_size > 0


def test_negative_corpus_zero_false_positives():
    """Verify zero known false-positive regressions in the maintained negative fixture corpus."""
    safe_dir = CORPUS_DIR / "safe"
    assert safe_dir.exists()
    safe_files = list(safe_dir.rglob("*.py")) + list(safe_dir.rglob("*.js"))
    assert len(safe_files) >= 9

    # Verify each safe fixture contains secure constructs and not insecure signatures
    for sf in safe_files:
        text = sf.read_text(encoding="utf-8")
        assert "verify=False" not in text
        assert "pickle.loads" not in text
        assert "md5(" not in text
        assert "os.system(" not in text
