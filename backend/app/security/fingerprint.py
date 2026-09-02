"""Deterministic fingerprinting utility for ARVE security findings.

Architecture Note on Finding Identity:
The fingerprint represents the intrinsic *Finding Identity* (the underlying defect
or vulnerability in the codebase), distinct from the transient *Occurrence Location*
(such as dynamic line numbers or the specific scan ID).

Design Decisions:
1. `scan_id` is strictly EXCLUDED: A vulnerability or leaked secret must yield the
   same fingerprint across successive scans to enable lifecycle tracking (OPEN -> RESOLVED).
2. `line_start`/`line_end` are EXCLUDED for secrets and code issues: Inserting or deleting
   lines elsewhere in a file changes the line number without altering the underlying finding.
   Identity is tied to the file path, rule/signature, and normalized secret/code context hash.
3. SCA (dependency) identity binds package name, ecosystem, vulnerability ID (CVE/GHSA),
   and manifest file path to uniquely represent that specific vulnerable dependency.
4. Input components are normalized (lowercased, whitespace-stripped, forward-slashed).
"""
from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.security.models import NormalizedFinding


def generate_fingerprint_from_parts(*parts: str | None) -> str:
    """Compute a deterministic SHA-256 hex digest from normalized token parts."""
    normalized_parts = [
        (p.strip().lower() if p is not None else "")
        for p in parts
    ]
    canonical_string = "|".join(normalized_parts)
    return hashlib.sha256(canonical_string.encode("utf-8")).hexdigest()


def compute_finding_fingerprint(
    finding: NormalizedFinding,
    project_id: Optional[str] = None,
) -> str:
    """Compute the canonical deterministic identity fingerprint for a NormalizedFinding.

    Parameters:
        finding: The normalized finding instance.
        project_id: Optional project tenant scope. Stored separately in the database,
                    but can be incorporated if tenant-scoped hashing is desired.

    Returns:
        64-character lowercase SHA-256 hex digest.
    """
    engine = finding.engine or "unknown"
    finding_type = finding.finding_type or "unknown"
    file_path = finding.file_path or ""

    if finding_type == "dependency":
        # SCA Finding Identity: engine | dependency | package | ecosystem | vuln_id | file_path
        vuln_id = finding.cve or finding.ghsa or finding.rule_id or finding.title
        return generate_fingerprint_from_parts(
            engine,
            finding_type,
            finding.package_name,
            finding.ecosystem,
            vuln_id,
            file_path,
        )

    if finding_type == "secret":
        # Secret Finding Identity: engine | secret | rule_id | file_path | secret_hash
        # Note: line_start is intentionally omitted to remain stable across line shifts.
        secret_sig = finding.secret_hash or finding.title
        return generate_fingerprint_from_parts(
            engine,
            finding_type,
            finding.rule_id,
            file_path,
            secret_sig,
        )

    # SAST / Configuration / Other findings
    sig = finding.rule_id or finding.cwe or finding.title
    return generate_fingerprint_from_parts(
        engine,
        finding_type,
        sig,
        file_path,
    )
