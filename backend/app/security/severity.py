"""Shared severity taxonomy and normalization for ARVE security engines."""
from __future__ import annotations

from enum import Enum
from typing import Any


class FindingSeverity(str, Enum):
    """Canonical severity levels shared by all ARVE security engines."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


# Textual severity aliases mapped to canonical FindingSeverity
_TEXTUAL_MAP: dict[str, FindingSeverity] = {
    # Critical
    "critical": FindingSeverity.CRITICAL,
    "crit": FindingSeverity.CRITICAL,
    "blocker": FindingSeverity.CRITICAL,
    "p0": FindingSeverity.CRITICAL,
    "fatal": FindingSeverity.CRITICAL,
    # High
    "high": FindingSeverity.HIGH,
    "error": FindingSeverity.HIGH,
    "p1": FindingSeverity.HIGH,
    "major": FindingSeverity.HIGH,
    "severe": FindingSeverity.HIGH,
    # Medium
    "medium": FindingSeverity.MEDIUM,
    "moderate": FindingSeverity.MEDIUM,
    "mod": FindingSeverity.MEDIUM,
    "warning": FindingSeverity.MEDIUM,
    "warn": FindingSeverity.MEDIUM,
    "p2": FindingSeverity.MEDIUM,
    # Low
    "low": FindingSeverity.LOW,
    "minor": FindingSeverity.LOW,
    "p3": FindingSeverity.LOW,
    "negligible": FindingSeverity.LOW,
    # Info
    "info": FindingSeverity.INFO,
    "informational": FindingSeverity.INFO,
    "note": FindingSeverity.INFO,
    "notice": FindingSeverity.INFO,
    "none": FindingSeverity.INFO,
    "p4": FindingSeverity.INFO,
}


def normalize_cvss_score(
    score: float | int | str | None,
    default: FindingSeverity = FindingSeverity.MEDIUM,
) -> FindingSeverity:
    """Normalize a CVSS score (0.0 - 10.0) into a canonical FindingSeverity.

    Follows standard CVSS v3.1 qualitative rating scale:
    - 9.0 - 10.0: CRITICAL
    - 7.0 - 8.9:  HIGH
    - 4.0 - 6.9:  MEDIUM
    - 0.1 - 3.9:  LOW
    - 0.0:        INFO
    """
    if score is None:
        return default

    try:
        val = float(score)
    except (ValueError, TypeError):
        return default

    if val >= 9.0:
        return FindingSeverity.CRITICAL
    if val >= 7.0:
        return FindingSeverity.HIGH
    if val >= 4.0:
        return FindingSeverity.MEDIUM
    if val >= 0.1:
        return FindingSeverity.LOW
    if val >= 0.0:
        return FindingSeverity.INFO
    return default


def normalize_textual_severity(
    raw: str | None,
    default: FindingSeverity = FindingSeverity.MEDIUM,
) -> FindingSeverity:
    """Map raw engine severity text (e.g. 'MODERATE', 'error', 'high') to canonical FindingSeverity."""
    if not raw or not isinstance(raw, str):
        return default

    cleaned = raw.strip().lower()
    return _TEXTUAL_MAP.get(cleaned, default)


def normalize_severity(
    value: Any,
    default: FindingSeverity = FindingSeverity.MEDIUM,
) -> FindingSeverity:
    """Normalize any severity representation (enum, string, float CVSS) into FindingSeverity."""
    if isinstance(value, FindingSeverity):
        return value

    if isinstance(value, (int, float)):
        return normalize_cvss_score(value, default=default)

    if isinstance(value, str):
        cleaned = value.strip()
        # Check if the string is numeric (e.g. "8.5")
        try:
            numeric_val = float(cleaned)
            return normalize_cvss_score(numeric_val, default=default)
        except ValueError:
            pass

        # Otherwise map as textual severity
        return normalize_textual_severity(cleaned, default=default)

    return default
