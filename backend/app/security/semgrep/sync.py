"""Offline rulepack preparation, filtering, and manifest generator for ARVE.

Separates rule synchronization and preparation from runtime scanning:
- Sync/vendor preparation runs out-of-band.
- Runtime scanning runs 100% offline inside Docker with `--network=none`.
"""
from __future__ import annotations

import argparse
import datetime
import json
import logging
from pathlib import Path
from typing import Any

import yaml

from app.security.semgrep.validator import validate_all_rules, validate_rule

logger = logging.getLogger(__name__)

CURRENT_DIR = Path(__file__).resolve().parent
RULES_DIR = CURRENT_DIR / "rules"
MANIFEST_PATH = CURRENT_DIR / "rulepack-manifest.json"

DEFAULT_RULEPACK_VERSION = "2026.09.1"
PINNED_SEMGREP_VERSION = "1.90.0"
UPSTREAM_REVISION = "8f1a23c"


def generate_rulepack_manifest(
    rulepack_version: str = DEFAULT_RULEPACK_VERSION,
    semgrep_version: str = PINNED_SEMGREP_VERSION,
    upstream_revision: str = UPSTREAM_REVISION,
    rules_dir: Path = RULES_DIR,
    output_path: Path = MANIFEST_PATH,
) -> dict[str, Any]:
    """Inspect all rules under rules_dir and compile an authoritative rulepack manifest."""
    rule_files = sorted(list(rules_dir.rglob("*.yml")) + list(rules_dir.rglob("*.yaml")))
    all_rules: list[dict[str, Any]] = []
    rule_index: dict[str, dict[str, Any]] = {}
    provenance_counts = {"arve": 0, "upstream": 0}
    languages_seen: set[str] = set()

    for rule_file in rule_files:
        try:
            content = rule_file.read_text(encoding="utf-8")
            data = yaml.safe_load(content)
            if not isinstance(data, dict) or "rules" not in data or not isinstance(data["rules"], list):
                continue

            rel_file = str(rule_file.relative_to(rules_dir)).replace("\\", "/")
            for rule in data["rules"]:
                rule_id = rule.get("id")
                if not rule_id:
                    continue

                metadata = rule.get("metadata", {})
                prov = str(metadata.get("provenance", "arve")).lower()
                provenance_counts[prov] = provenance_counts.get(prov, 0) + 1

                for lang in rule.get("languages", []):
                    languages_seen.add(lang)

                mode = str(rule.get("mode", "search")).lower()
                rule_info = {
                    "id": rule_id,
                    "file": rel_file,
                    "languages": rule.get("languages", []),
                    "severity": rule.get("severity"),
                    "confidence": metadata.get("confidence"),
                    "category": metadata.get("category", "security"),
                    "cwe": metadata.get("cwe", []),
                    "owasp": metadata.get("owasp", []),
                    "remediation_id": metadata.get("remediation_id"),
                    "provenance": prov,
                    "mode": mode,
                }
                rule_index[rule_id] = rule_info
                all_rules.append(rule_info)
        except Exception as exc:
            logger.warning("Error reading rule file %s: %s", rule_file, exc)

    standard_ids = [
        r["id"] for r in all_rules if r["mode"] == "search"
    ]
    extended_ids = [r["id"] for r in all_rules]
    ci_ids = [
        r["id"] for r in all_rules if r.get("confidence") == "HIGH" and r["mode"] == "search"
    ]

    manifest = {
        "$schema": "https://json-schema.arve.dev/rulepack-manifest.v1.json",
        "rulepack_version": rulepack_version,
        "semgrep_version": semgrep_version,
        "upstream_revision": upstream_revision,
        "sync_date": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_rules": len(all_rules),
        "languages": sorted(list(languages_seen)),
        "provenance_summary": provenance_counts,
        "profiles": {
            "standard": {
                "description": "Default security profile for fast, high-confidence CI scanning",
                "rule_count": len(standard_ids),
                "rule_ids": sorted(standard_ids),
            },
            "extended": {
                "description": "Comprehensive security audit profile including deep taint dataflow analysis",
                "rule_count": len(extended_ids),
                "rule_ids": sorted(extended_ids),
            },
            "ci": {
                "description": "Strict low-false-positive profile for PR blocking gates",
                "rule_count": len(ci_ids),
                "rule_ids": sorted(ci_ids),
            },
        },
        "rules": rule_index,
    }

    output_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="ARVE Semgrep Rule Sync and Manifest Tool")
    parser.add_argument("--validate", action="store_true", help="Validate all rule definitions")
    parser.add_argument("--manifest", action="store_true", help="Regenerate rulepack-manifest.json")
    args = parser.parse_args()

    validation_errors = validate_all_rules(RULES_DIR)
    if validation_errors:
        print(f"Validation failed with {len(validation_errors)} error files:")
        for path, errors in validation_errors.items():
            print(f"  {path}:")
            for err in errors:
                print(f"    - {err}")
        exit(1)
    else:
        print("All rule definitions passed schema validation.")

    if args.manifest or not MANIFEST_PATH.exists():
        manifest = generate_rulepack_manifest()
        print(f"Generated manifest: {MANIFEST_PATH} (Version: {manifest['rulepack_version']}, Rules: {manifest['total_rules']})")


if __name__ == "__main__":
    main()
