"""Tests for Semgrep rule profile resolution and inclusion/exclusion behavior."""
from app.security.semgrep.rules import (
    get_rulepack_manifest,
    get_rulepack_version,
    list_rule_files,
    load_all_rules,
)


def test_rulepack_manifest_structure():
    manifest = get_rulepack_manifest()
    assert manifest["rulepack_version"] == "2026.09.1"
    assert manifest["semgrep_version"] == "1.90.0"
    assert "profiles" in manifest
    assert "standard" in manifest["profiles"]
    assert "extended" in manifest["profiles"]
    assert "ci" in manifest["profiles"]
    assert manifest["provenance_summary"]["arve"] > 0
    assert manifest["provenance_summary"]["upstream"] > 0


def test_standard_profile_rules():
    rules = load_all_rules("standard")
    rule_ids = {r["id"] for r in rules}
    manifest = get_rulepack_manifest()
    expected_ids = set(manifest["profiles"]["standard"]["rule_ids"])

    # Ensure all manifest standard rule IDs are loaded
    assert expected_ids.issubset(rule_ids)

    # Standard profile excludes taint mode rules
    assert "arve.python.sql-injection-taint" not in rule_ids
    assert "arve.python.command-injection-taint" not in rule_ids


def test_extended_profile_includes_taint_rules():
    rules = load_all_rules("extended")
    rule_ids = {r["id"] for r in rules}

    # Extended profile must include taint mode rules
    assert "arve.python.sql-injection-taint" in rule_ids
    assert "arve.python.command-injection-taint" in rule_ids
    assert len(rules) >= len(load_all_rules("standard"))


def test_ci_profile_contains_only_high_confidence():
    rules = load_all_rules("ci")
    for r in rules:
        confidence = r.get("metadata", {}).get("confidence")
        assert confidence == "HIGH", f"CI profile rule {r['id']} has non-HIGH confidence: {confidence}"


def test_profile_rule_files_listing():
    standard_files = list_rule_files("standard")
    extended_files = list_rule_files("extended")

    assert len(standard_files) >= 5
    assert len(extended_files) >= len(standard_files)
