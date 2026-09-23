"""Semgrep rule registry, profile management, and manifest resolution for ARVE."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

import yaml

logger = logging.getLogger(__name__)

PACKAGE_DIR = Path(__file__).resolve().parent
RULES_DIR = PACKAGE_DIR / "rules"
MANIFEST_FILE = PACKAGE_DIR / "rulepack-manifest.json"

DEFAULT_RULEPACK_VERSION = "2026.09.1"


def get_default_rules_directory() -> Path:
    """Return the absolute path to ARVE's bundled Semgrep rule definitions."""
    return RULES_DIR


def get_rulepack_manifest() -> dict[str, Any]:
    """Return the parsed rulepack manifest or a fallback structure if missing."""
    if MANIFEST_FILE.exists():
        try:
            return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed to parse rulepack manifest %s: %s", MANIFEST_FILE, exc)

    return {
        "rulepack_version": DEFAULT_RULEPACK_VERSION,
        "semgrep_version": "1.90.0",
        "upstream_revision": "unknown",
        "profiles": {},
        "rules": {},
    }


def get_rulepack_version() -> str:
    """Return the active rulepack version string (e.g. '2026.09.1')."""
    manifest = get_rulepack_manifest()
    return str(manifest.get("rulepack_version", DEFAULT_RULEPACK_VERSION))


def list_rule_files(profile: str = "standard") -> list[Path]:
    """Return list of YAML rule file paths recursively discovered for the given profile."""
    if not RULES_DIR.exists():
        return []

    all_rule_files = sorted(list(RULES_DIR.rglob("*.yml")) + list(RULES_DIR.rglob("*.yaml")))
    # If no profile filtering is needed, return all files
    if profile in ("all", "extended"):
        return all_rule_files

    manifest = get_rulepack_manifest()
    profiles = manifest.get("profiles", {})
    profile_data = profiles.get(profile)

    if not profile_data or "rule_ids" not in profile_data:
        return all_rule_files

    allowed_rule_ids = set(profile_data["rule_ids"])
    rules_index = manifest.get("rules", {})

    # Determine files that contain allowed rules for this profile
    allowed_rel_files = {
        rinfo["file"]
        for rid, rinfo in rules_index.items()
        if rid in allowed_rule_ids and "file" in rinfo
    }

    matched_files = [
        f for f in all_rule_files
        if str(f.relative_to(RULES_DIR)).replace("\\", "/") in allowed_rel_files
    ]

    return matched_files if matched_files else all_rule_files


def load_all_rules(profile: str = "standard") -> list[dict[str, Any]]:
    """Load and parse bundled rule definitions filtered by profile."""
    rule_files = list_rule_files(profile)
    all_rules: list[dict[str, Any]] = []

    manifest = get_rulepack_manifest()
    profiles = manifest.get("profiles", {})
    profile_data = profiles.get(profile)
    allowed_ids = set(profile_data["rule_ids"]) if profile_data and "rule_ids" in profile_data else None

    for rule_file in rule_files:
        try:
            content = rule_file.read_text(encoding="utf-8")
            data = yaml.safe_load(content)
            if isinstance(data, dict) and "rules" in data and isinstance(data["rules"], list):
                for r in data["rules"]:
                    if allowed_ids is None or r.get("id") in allowed_ids or profile in ("all", "extended"):
                        all_rules.append(r)
        except Exception as exc:
            logger.warning("Failed to load rule file %s: %s", rule_file, exc)

    return all_rules
