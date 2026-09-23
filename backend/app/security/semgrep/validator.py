"""Semgrep rule validation engine for ARVE.

Enforces schema conformity, metadata presence, ID conventions,
provenance tracking, and remediation mappings across all rulepacks.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

# Valid rule ID pattern: arve.<language_or_scope>.<vulnerability-identifier>
# e.g., arve.python.sql-injection, arve.upstream.javascript.eval-injection, arve.generic.hardcoded-jwt-secret
RULE_ID_REGEX = re.compile(r"^arve(\.upstream)?\.[a-z0-9_]+\.[a-z0-9\-]+$")

VALID_SEVERITIES = {"ERROR", "WARNING", "INFO"}
VALID_CONFIDENCES = {"HIGH", "MEDIUM", "LOW"}
VALID_PROVENANCES = {"arve", "upstream"}


def validate_rule(rule: dict[str, Any], file_context: str = "") -> list[str]:
    """Validate a single Semgrep rule dictionary against ARVE standards.

    Returns a list of validation error messages. An empty list signifies a valid rule.
    """
    errors: list[str] = []
    rule_id = rule.get("id")

    if not rule_id or not isinstance(rule_id, str):
        errors.append(f"Missing or non-string 'id' in rule: {rule}")
        return errors

    # 1. Enforce ID convention
    if not RULE_ID_REGEX.match(rule_id):
        errors.append(
            f"Rule '{rule_id}' violates ARVE ID convention "
            f"('arve.<lang>.<name>' or 'arve.upstream.<lang>.<name>')"
        )

    # 2. Languages validation
    languages = rule.get("languages")
    if not languages or not isinstance(languages, list):
        errors.append(f"Rule '{rule_id}' must specify a non-empty 'languages' list")

    # 3. Severity validation
    severity = str(rule.get("severity", "")).upper()
    if severity not in VALID_SEVERITIES:
        errors.append(f"Rule '{rule_id}' has invalid severity '{severity}', must be one of {VALID_SEVERITIES}")

    # 4. Message validation
    message = rule.get("message")
    if not message or not isinstance(message, str) or not message.strip():
        errors.append(f"Rule '{rule_id}' missing required 'message' description")

    # 5. Metadata validation
    metadata = rule.get("metadata")
    if not metadata or not isinstance(metadata, dict):
        errors.append(f"Rule '{rule_id}' missing required 'metadata' dictionary")
    else:
        # CWE enforcement
        cwe = metadata.get("cwe")
        if not cwe or not isinstance(cwe, list):
            errors.append(f"Rule '{rule_id}' metadata must include a non-empty 'cwe' list")

        # OWASP mapping
        owasp = metadata.get("owasp")
        if not owasp or not isinstance(owasp, list):
            errors.append(f"Rule '{rule_id}' metadata must include a non-empty 'owasp' list")

        # Confidence enforcement
        confidence = str(metadata.get("confidence", "")).upper()
        if confidence not in VALID_CONFIDENCES:
            errors.append(f"Rule '{rule_id}' metadata has invalid confidence '{confidence}', must be one of {VALID_CONFIDENCES}")

        # Provenance enforcement
        provenance = str(metadata.get("provenance", "arve")).lower()
        if provenance not in VALID_PROVENANCES:
            errors.append(f"Rule '{rule_id}' metadata has invalid provenance '{provenance}', must be one of {VALID_PROVENANCES}")

        # Remediation ID enforcement
        remediation_id = metadata.get("remediation_id")
        if not remediation_id or not isinstance(remediation_id, str):
            errors.append(f"Rule '{rule_id}' metadata missing required 'remediation_id' (e.g. 'sql-injection')")

    # 6. Pattern validation (AST search vs Taint mode)
    mode = str(rule.get("mode", "search")).lower()
    if mode == "taint":
        has_sources = "pattern-sources" in rule
        has_sinks = "pattern-sinks" in rule
        if not (has_sources and has_sinks):
            errors.append(f"Taint rule '{rule_id}' must define both 'pattern-sources' and 'pattern-sinks'")
    else:
        has_pattern = any(
            k in rule for k in ("pattern", "patterns", "pattern-either", "pattern-regex")
        )
        if not has_pattern:
            errors.append(f"Search rule '{rule_id}' must define at least one pattern keyword (pattern, patterns, etc.)")

    return errors


def validate_rule_file(file_path: Path) -> list[str]:
    """Parse and validate all rules defined inside a single YAML file."""
    if not file_path.exists() or not file_path.is_file():
        return [f"File not found: {file_path}"]

    try:
        content = file_path.read_text(encoding="utf-8")
        data = yaml.safe_load(content)
    except Exception as exc:
        return [f"Failed to parse YAML file {file_path}: {exc}"]

    if not isinstance(data, dict) or "rules" not in data or not isinstance(data["rules"], list):
        return [f"File {file_path} does not contain a top-level 'rules' list"]

    errors: list[str] = []
    for idx, rule in enumerate(data["rules"]):
        rule_errors = validate_rule(rule, file_context=f"{file_path.name} (rule #{idx+1})")
        errors.extend(rule_errors)

    return errors


def validate_all_rules(directory: Path) -> dict[str, list[str]]:
    """Validate all YAML rule files recursively under a directory.

    Returns a dictionary mapping relative file paths to lists of error messages.
    """
    results: dict[str, list[str]] = {}
    if not directory.exists() or not directory.is_dir():
        return {"_error": [f"Directory not found: {directory}"]}

    rule_files = sorted(list(directory.rglob("*.yml")) + list(directory.rglob("*.yaml")))
    for rule_file in rule_files:
        rel_path = str(rule_file.relative_to(directory)).replace("\\", "/")
        file_errors = validate_rule_file(rule_file)
        if file_errors:
            results[rel_path] = file_errors

    return results
