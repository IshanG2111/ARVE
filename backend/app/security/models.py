"""Canonical security finding contract and enums for ARVE Phase 4A."""
from __future__ import annotations

from enum import Enum
from typing import Any, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.security.severity import FindingSeverity, normalize_severity


class EngineName(str, Enum):
    """Canonical identifiers for supported security scanner engines."""
    OSV = "osv"
    GITLEAKS = "gitleaks"
    SEMGREP = "semgrep"


class FindingType(str, Enum):
    """Canonical security finding categories."""
    DEPENDENCY = "dependency"
    SECRET = "secret"
    SAST = "sast"
    IAC = "iac"
    CONTAINER = "container"
    CONFIGURATION = "configuration"


class FindingStatus(str, Enum):
    """Lifecycle status for a security finding."""
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"
    REOPENED = "REOPENED"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    SUPPRESSED = "SUPPRESSED"


class FindingConfidence(str, Enum):
    """Confidence rating for finding accuracy."""
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


def normalize_engine_name(raw: str | None) -> str:
    """Normalize raw engine names into canonical lowercase engine strings."""
    if not raw or not isinstance(raw, str):
        return "unknown"
    cleaned = raw.strip().lower()
    if cleaned in {"osv-scanner", "osv_scanner", "osv"}:
        return EngineName.OSV.value
    if cleaned in {"gitleaks", "git-leaks", "git_leaks"}:
        return EngineName.GITLEAKS.value
    if cleaned in {"semgrep", "semgrep-sast", "semgrep_sast"}:
        return EngineName.SEMGREP.value
    return cleaned


class NormalizedFinding(BaseModel):
    """Engine-agnostic canonical security finding contract.

    Produced by all engine mappers and consumed by normalization,
    fingerprinting, and database persistence layers.
    """
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    engine: str = Field(..., description="Canonical engine identifier (e.g. 'osv', 'gitleaks')")
    finding_type: str = Field(..., description="Canonical finding type (e.g. 'dependency', 'secret')")
    title: str = Field(..., min_length=1, description="Concise human-readable finding title")
    description: Optional[str] = Field(None, description="Detailed vulnerability/finding description")
    severity: FindingSeverity = Field(FindingSeverity.MEDIUM, description="Canonical severity level")
    confidence: Optional[FindingConfidence] = Field(None, description="Optional finding confidence")
    status: FindingStatus = Field(FindingStatus.OPEN, description="Finding lifecycle status")

    # Spatial context (occurrence location)
    file_path: Optional[str] = Field(None, description="File path relative to repository snapshot root")
    line_start: Optional[int] = Field(None, ge=1, description="1-indexed starting line number")
    line_end: Optional[int] = Field(None, ge=1, description="1-indexed ending line number")

    # SCA (Dependency) specific metadata
    package_name: Optional[str] = Field(None, description="Vulnerable dependency package name")
    package_version: Optional[str] = Field(None, description="Vulnerable package version string")
    ecosystem: Optional[str] = Field(None, description="Package ecosystem (e.g. 'npm', 'PyPI', 'Go')")
    cve: Optional[str] = Field(None, description="Common Vulnerabilities and Exposures identifier")
    ghsa: Optional[str] = Field(None, description="GitHub Security Advisory identifier")
    cwe: Optional[str] = Field(None, description="Common Weakness Enumeration identifier")

    # SAST & Secret specific metadata
    rule_id: Optional[str] = Field(None, description="Scanner rule or signature identifier")
    secret_hash: Optional[str] = Field(
        None,
        description="Non-secret signature hash for line-independent secret identity",
    )

    # Deterministic fingerprint & raw engine output
    fingerprint: Optional[str] = Field(None, description="Deterministic SHA-256 finding identity hash")
    raw_json: Optional[Union[dict[str, Any], list[Any], str]] = Field(
        None,
        description="Original raw scanner output for auditability (secrets must be redacted)",
    )

    @field_validator("engine", mode="before")
    @classmethod
    def validate_engine(cls, v: Any) -> str:
        return normalize_engine_name(str(v) if v is not None else "")

    @field_validator("finding_type", mode="before")
    @classmethod
    def validate_finding_type(cls, v: Any) -> str:
        if isinstance(v, FindingType):
            return v.value
        if isinstance(v, str):
            return v.strip().lower()
        return "unknown"

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity(cls, v: Any) -> FindingSeverity:
        return normalize_severity(v)

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Any) -> FindingStatus:
        if isinstance(v, FindingStatus):
            return v
        if isinstance(v, str):
            try:
                return FindingStatus(v.strip().upper())
            except ValueError:
                return FindingStatus.OPEN
        return FindingStatus.OPEN

    @field_validator("confidence", mode="before")
    @classmethod
    def validate_confidence(cls, v: Any) -> Optional[FindingConfidence]:
        if v is None:
            return None
        if isinstance(v, FindingConfidence):
            return v
        if isinstance(v, str):
            try:
                return FindingConfidence(v.strip().upper())
            except ValueError:
                return None
        return None

    @field_validator("file_path", mode="before")
    @classmethod
    def normalize_file_path(cls, v: Any) -> Optional[str]:
        if not v or not isinstance(v, str):
            return None
        # Normalize Windows backslashes to forward slashes and strip leading slashes/dots
        cleaned = v.replace("\\", "/").strip()
        while cleaned.startswith("./"):
            cleaned = cleaned[2:]
        return cleaned.lstrip("/") or None

    @model_validator(mode="after")
    def validate_line_range(self) -> NormalizedFinding:
        if self.line_start is not None and self.line_end is not None:
            if self.line_end < self.line_start:
                raise ValueError(
                    f"line_end ({self.line_end}) must be greater than or equal to line_start ({self.line_start})"
                )
        return self
