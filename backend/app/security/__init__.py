"""ARVE Shared Security Foundation.

Provides engine-agnostic contracts, severity taxonomy, deterministic
fingerprinting, mapper interfaces, and finding normalizers.
"""
from app.security.fingerprint import compute_finding_fingerprint, generate_fingerprint_from_parts
from app.security.mappers import FindingMapper, OsvFindingMapper
from app.security.models import (
    EngineName,
    FindingConfidence,
    FindingSeverity,
    FindingStatus,
    FindingType,
    NormalizedFinding,
    normalize_engine_name,
)
from app.security.normalizer import FindingNormalizer
from app.security.severity import (
    normalize_cvss_score,
    normalize_severity,
    normalize_textual_severity,
)

__all__ = [
    "EngineName",
    "FindingConfidence",
    "FindingMapper",
    "FindingNormalizer",
    "FindingSeverity",
    "FindingStatus",
    "FindingType",
    "NormalizedFinding",
    "OsvFindingMapper",
    "compute_finding_fingerprint",
    "generate_fingerprint_from_parts",
    "normalize_cvss_score",
    "normalize_engine_name",
    "normalize_severity",
    "normalize_textual_severity",
]
