"""Semgrep SAST JSON -> ARVE canonical NormalizedFinding mapper."""
from __future__ import annotations

import logging
import re
from typing import Any, Optional

from app.security.mappers.base import FindingMapper
from app.security.models import (
    EngineName,
    FindingConfidence,
    FindingSeverity,
    FindingStatus,
    FindingType,
    NormalizedFinding,
)
from app.security.semgrep.parser import parse_semgrep_output
from app.security.semgrep.remediation import lookup_remediation
from app.security.semgrep.rules import get_rulepack_version
from app.security.severity import normalize_severity

logger = logging.getLogger(__name__)


def clean_semgrep_file_path(raw_path: Optional[str]) -> Optional[str]:
    """Convert container mount path or absolute path into a repository-relative path."""
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


def extract_primary_cwe(cwes: list[str]) -> Optional[str]:
    """Extract standard 'CWE-XYZ' identifier from a list of CWE strings."""
    if not cwes:
        return None

    for entry in cwes:
        match = re.search(r"CWE-(\d+)", str(entry), re.IGNORECASE)
        if match:
            return f"CWE-{match.group(1)}"

    return None


class SemgrepFindingMapper(FindingMapper):
    """Maps native Semgrep JSON output into ARVE canonical NormalizedFinding objects."""

    @property
    def engine_name(self) -> str:
        return EngineName.SEMGREP.value

    def map_artifact(
        self,
        raw_content: Any,
        context: Optional[dict[str, Any]] = None,
    ) -> list[NormalizedFinding]:
        """Parse raw Semgrep output and return normalized ARVE security findings."""
        semgrep_output = parse_semgrep_output(raw_content)
        if not semgrep_output.results:
            return []

        findings: list[NormalizedFinding] = []
        for res in semgrep_output.results:
            file_path = clean_semgrep_file_path(res.path)
            primary_cwe = extract_primary_cwe(res.metadata.cwe)

            # Retrieve rich developer-friendly remediation advice
            remediation = lookup_remediation(
                check_id=res.check_id,
                cwes=res.metadata.cwe,
                message=res.message,
                rule_category=res.metadata.category,
                remediation_id=res.metadata.remediation_id,
            )

            # Title prioritization: rule metadata override -> remediation title -> clean check_id
            title = res.metadata.arve_title or remediation.title

            # Severity normalization
            severity = normalize_severity(res.severity)

            # Confidence normalization
            confidence: Optional[FindingConfidence] = None
            if res.metadata.confidence:
                try:
                    confidence = FindingConfidence(res.metadata.confidence.upper())
                except ValueError:
                    confidence = None
            if confidence is None:
                # If taint / dataflow trace is present, assign HIGH confidence
                if res.dataflow_trace:
                    confidence = FindingConfidence.HIGH
                else:
                    confidence = FindingConfidence.MEDIUM

            start_line = res.start.line if res.start and res.start.line >= 1 else None
            end_line = res.end.line if res.end and res.end.line >= 1 else start_line
            if start_line is not None and end_line is not None and end_line < start_line:
                end_line = start_line

            # Safe, structured engine metadata for UI / auditability
            engine_metadata: dict[str, Any] = {
                "rule_id": res.check_id,
                "semgrep_severity": res.severity,
                "cwe": res.metadata.cwe,
                "owasp": res.metadata.owasp,
                "provenance": res.metadata.provenance or "arve",
                "remediation_id": res.metadata.remediation_id or remediation.cwe,
                "rulepack_version": get_rulepack_version(),
                "references": res.metadata.references or remediation.references,
                "lines": res.lines,
                "fix": res.fix,
                "remediation": {
                    "summary": remediation.summary,
                    "why_it_matters": remediation.why_it_matters,
                    "recommended_action": remediation.recommended_action,
                    "example_diff": remediation.example_diff,
                    "references": remediation.references,
                },
            }
            if res.dataflow_trace:
                engine_metadata["dataflow_trace"] = res.dataflow_trace
            if semgrep_output.version:
                engine_metadata["engine_version"] = semgrep_output.version

            finding = NormalizedFinding(
                engine=self.engine_name,
                finding_type=FindingType.SAST.value,
                title=title,
                description=res.message,
                severity=severity,
                confidence=confidence,
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
                cwe=primary_cwe,
                rule_id=res.check_id,
                secret_hash=None,
                fingerprint=None,  # Computed deterministically in normalizer
                raw_json=engine_metadata,
            )
            findings.append(finding)

        return findings
