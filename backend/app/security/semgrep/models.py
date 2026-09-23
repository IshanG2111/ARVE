"""Internal data models for Semgrep SAST output.

These models encapsulate raw Semgrep structures and prevent Semgrep-specific
JSON formatting from leaking into canonical ARVE contracts.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class SemgrepLocation:
    """Line and column position within a source file."""
    line: int
    col: Optional[int] = None
    offset: Optional[int] = None


@dataclass
class SemgrepMetadata:
    """Security metadata attached to a Semgrep rule."""
    cwe: list[str] = field(default_factory=list)
    owasp: list[str] = field(default_factory=list)
    confidence: Optional[str] = None
    category: Optional[str] = None
    technology: list[str] = field(default_factory=list)
    references: list[str] = field(default_factory=list)
    shortlink: Optional[str] = None
    arve_title: Optional[str] = None
    arve_remediation: Optional[str] = None
    remediation_id: Optional[str] = None
    provenance: Optional[str] = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class SemgrepResult:
    """Individual finding produced by Semgrep."""
    check_id: str
    path: str
    start: SemgrepLocation
    end: SemgrepLocation
    message: str
    severity: str
    metadata: SemgrepMetadata
    lines: Optional[str] = None
    dataflow_trace: Optional[dict[str, Any]] = None
    fix: Optional[str] = None
    metavars: dict[str, Any] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class SemgrepOutput:
    """Structured representation of a complete Semgrep CLI run."""
    results: list[SemgrepResult] = field(default_factory=list)
    errors: list[dict[str, Any]] = field(default_factory=list)
    paths_scanned: list[str] = field(default_factory=list)
    paths_skipped: list[dict[str, Any]] = field(default_factory=list)
    version: Optional[str] = None
