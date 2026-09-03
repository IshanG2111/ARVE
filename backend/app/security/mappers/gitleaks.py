"""Gitleaks JSON -> ARVE canonical finding mapper."""
from __future__ import annotations

import copy
import hashlib
import json
import logging
from typing import Any, Optional

from app.security.mappers.base import FindingMapper
from app.security.models import (
    EngineName,
    FindingSeverity,
    FindingStatus,
    FindingType,
    NormalizedFinding,
)

logger = logging.getLogger(__name__)

_SENSITIVE_KEYS = {"secret", "match", "line"}


def clean_gitleaks_file_path(raw_path: Optional[str]) -> Optional[str]:
    """Convert a container path into a repository-relative path."""
    if not raw_path or not isinstance(raw_path, str):
        return None
    cleaned = raw_path.strip().replace("\\", "/")
    for prefix in ("/code/", "code/", "/workspace/", "workspace/"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
            break
    while cleaned.startswith("./"):
        cleaned = cleaned[2:]
    return cleaned.lstrip("/") or None


def _sanitize(value: Any) -> Any:
    """Remove secret-bearing Gitleaks fields recursively before persistence."""
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if str(key).strip().lower() in _SENSITIVE_KEYS:
                continue
            result[key] = _sanitize(item)
        return result
    if isinstance(value, list):
        return [_sanitize(item) for item in value]
    return value


def sanitize_gitleaks_record(record: dict[str, Any]) -> dict[str, Any]:
    """Return a persistence-safe copy of a native Gitleaks finding."""
    return _sanitize(copy.deepcopy(record))


def _safe_fallback_signature(rule_id: str, file_path: str, description: str) -> str:
    """Build a non-secret signature when old/alternate reports lack Fingerprint."""
    canonical = "|".join((rule_id.strip().lower(), file_path.strip().lower(), description.strip().lower()))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class GitleaksFindingMapper(FindingMapper):
    """Map native Gitleaks JSON records into ARVE NormalizedFinding objects."""

    @property
    def engine_name(self) -> str:
        return EngineName.GITLEAKS.value

    def map_artifact(
        self,
        raw_content: Any,
        context: Optional[dict[str, Any]] = None,
    ) -> list[NormalizedFinding]:
        if raw_content is None:
            return []

        data: Any = raw_content
        if isinstance(raw_content, str):
            content = raw_content.strip()
            if not content:
                return []
            try:
                data = json.loads(content)
            except json.JSONDecodeError:
                logger.warning("Failed to parse Gitleaks artifact as JSON")
                return []

        if not isinstance(data, list):
            logger.warning("Gitleaks output is not a JSON array: %s", type(data))
            return []

        findings: list[NormalizedFinding] = []
        for record in data:
            if not isinstance(record, dict):
                continue

            description = str(record.get("Description") or "Secret detected by Gitleaks").strip()
            rule_id = str(record.get("RuleID") or "gitleaks-secret").strip()
            file_path = clean_gitleaks_file_path(record.get("File"))

            fingerprint = record.get("Fingerprint")
            if fingerprint is not None:
                fingerprint = str(fingerprint).strip() or None

            # Native Gitleaks fingerprint is preferred. For reports that do not
            # provide one, use a deterministic hash of non-secret metadata only.
            secret_hash = fingerprint or _safe_fallback_signature(
                rule_id,
                file_path or "",
                description,
            )

            start_line = record.get("StartLine")
            end_line = record.get("EndLine")
            try:
                start_line = int(start_line) if start_line is not None and int(start_line) > 0 else None
            except (TypeError, ValueError):
                start_line = None
            try:
                end_line = int(end_line) if end_line is not None and int(end_line) > 0 else None
            except (TypeError, ValueError):
                end_line = None

            if start_line is not None and end_line is not None and end_line < start_line:
                end_line = start_line

            safe_raw = sanitize_gitleaks_record(record)
            findings.append(
                NormalizedFinding(
                    engine=self.engine_name,
                    finding_type=FindingType.SECRET.value,
                    title=description,
                    description=description,
                    severity=FindingSeverity.MEDIUM,
                    confidence=None,
                    status=FindingStatus.OPEN,
                    file_path=file_path,
                    line_start=start_line,
                    line_end=end_line,
                    package_name=None,
                    package_version=None,
                    fixed_version=None,
                    ecosystem=None,
                    cve=None,
                    ghsa=None,
                    cwe=None,
                    rule_id=rule_id,
                    secret_hash=secret_hash,
                    fingerprint=fingerprint,
                    raw_json=safe_raw,
                )
            )

        return findings
