"""OSV-Scanner FindingMapper implementation for ARVE Phase 4A.

Transforms native OSV-Scanner JSON artifacts into canonical ARVE NormalizedFinding
instances, strictly adhering to the shared security contract without touching ORM
models or generating fingerprints.
"""
from __future__ import annotations

import json
import logging
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
from app.security.severity import normalize_severity

logger = logging.getLogger(__name__)


def clean_osv_file_path(raw_path: Optional[str]) -> Optional[str]:
    """Clean container mount prefixes and normalize slashes to relative repo path."""
    if not raw_path or not isinstance(raw_path, str):
        return None
    cleaned = raw_path.strip().replace("\\", "/")
    # Strip common container mount prefixes
    for prefix in ("/code/", "code/", "/workspace/", "workspace/"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
    while cleaned.startswith("./"):
        cleaned = cleaned[2:]
    return cleaned.lstrip("/") or None


def extract_cve_and_ghsa(vuln_id: str, aliases: list[str]) -> tuple[Optional[str], Optional[str]]:
    """Deterministically extract primary CVE and GHSA identifiers."""
    all_ids = [vuln_id] + aliases
    cves = sorted({ident.strip() for ident in all_ids if ident.strip().upper().startswith("CVE-")})
    ghsas = sorted({ident.strip() for ident in all_ids if ident.strip().upper().startswith("GHSA-")})
    primary_cve = cves[0] if cves else None
    primary_ghsa = ghsas[0] if ghsas else None
    return primary_cve, primary_ghsa


def extract_fixed_version(vuln_data: dict[str, Any], target_pkg: Optional[str] = None) -> Optional[str]:
    """Extract the earliest fixed version from OSV affected ranges."""
    affected_list = vuln_data.get("affected") or []
    fixed_versions = []
    if isinstance(affected_list, list):
        for aff in affected_list:
            if not isinstance(aff, dict):
                continue
            if target_pkg:
                aff_pkg = aff.get("package") or {}
                if isinstance(aff_pkg, dict):
                    name = aff_pkg.get("name")
                    if name and str(name).strip().lower() != target_pkg.strip().lower():
                        continue
            ranges = aff.get("ranges") or []
            if isinstance(ranges, list):
                for r in ranges:
                    if isinstance(r, dict):
                        events = r.get("events") or []
                        if isinstance(events, list):
                            for ev in events:
                                if isinstance(ev, dict) and "fixed" in ev:
                                    fix = str(ev["fixed"]).strip()
                                    if fix:
                                        fixed_versions.append(fix)
    if fixed_versions:
        return fixed_versions[0]
    return None


def extract_cwe(vuln_data: dict[str, Any]) -> Optional[str]:
    """Extract primary CWE identifier from vulnerability metadata."""
    db_spec = vuln_data.get("database_specific") or {}
    if isinstance(db_spec, dict):
        cwes = db_spec.get("cwe_ids") or db_spec.get("cwes") or []
        if isinstance(cwes, list):
            valid_cwes = sorted({str(c).strip() for c in cwes if str(c).strip().upper().startswith("CWE-")})
            if valid_cwes:
                return valid_cwes[0]
            if cwes and isinstance(cwes[0], str) and cwes[0].strip():
                return cwes[0].strip()
        elif isinstance(cwes, str) and cwes.strip():
            return cwes.strip()
    return None


def extract_osv_severity(vuln_data: dict[str, Any]) -> FindingSeverity:
    """Extract and normalize severity following strict precedence:
    1. Valid CVSS numeric score in severity list or database_specific
    2. Valid textual severity in database_specific or ecosystem_specific
    3. Top-level string severity
    4. Fallback to FindingSeverity.MEDIUM via shared normalize_severity()
    """
    # 1. Check numeric score in severity array
    severity_entries = vuln_data.get("severity") or []
    if isinstance(severity_entries, list):
        for entry in severity_entries:
            if isinstance(entry, dict):
                score = entry.get("score")
                if isinstance(score, (int, float)):
                    return normalize_severity(score)
                if isinstance(score, str):
                    try:
                        return normalize_severity(float(score.strip()))
                    except ValueError:
                        # Vector string (e.g. CVSS:3.1/...)
                        pass

    # 1b. Check database_specific numeric CVSS score
    db_spec = vuln_data.get("database_specific") or {}
    if isinstance(db_spec, dict):
        cvss_score = db_spec.get("cvss_score") or db_spec.get("score")
        if isinstance(cvss_score, (int, float)):
            return normalize_severity(cvss_score)
        if isinstance(cvss_score, str):
            try:
                return normalize_severity(float(cvss_score.strip()))
            except ValueError:
                pass

        # 2. Check database_specific textual severity (e.g. "CRITICAL", "MODERATE", "HIGH", "LOW")
        textual_sev = db_spec.get("severity")
        if textual_sev and isinstance(textual_sev, str):
            return normalize_severity(textual_sev)

    eco_spec = vuln_data.get("ecosystem_specific") or {}
    if isinstance(eco_spec, dict):
        eco_sev = eco_spec.get("severity")
        if eco_sev and isinstance(eco_sev, str):
            return normalize_severity(eco_sev)

    # 3. Top-level severity if string
    top_sev = vuln_data.get("severity")
    if isinstance(top_sev, str):
        return normalize_severity(top_sev)

    # 4. Fallback
    return FindingSeverity.MEDIUM


class OsvFindingMapper(FindingMapper):
    """Maps raw OSV-Scanner JSON outputs into canonical NormalizedFinding objects."""

    @property
    def engine_name(self) -> str:
        return EngineName.OSV.value

    def map_artifact(
        self,
        raw_content: Any,
        context: Optional[dict[str, Any]] = None,
    ) -> list[NormalizedFinding]:
        """Parse raw OSV-Scanner output and return canonical NormalizedFindings.

        Parameters:
            raw_content: Raw OSV-Scanner output (dict, list, or JSON string).
            context: Optional execution context metadata.

        Returns:
            List of validated NormalizedFinding instances with fingerprint=None.
        """
        if raw_content is None:
            return []

        data: Any = raw_content
        if isinstance(raw_content, str):
            content_str = raw_content.strip()
            if not content_str:
                return []
            try:
                data = json.loads(content_str)
            except Exception as exc:
                logger.warning("Failed to parse OSV raw content as JSON: %s", exc)
                return []

        if not isinstance(data, dict):
            logger.warning("OSV output is not a dictionary structure: %s", type(data))
            return []

        # Validate top-level results structure
        results = data.get("results")
        if results is None:
            # Clean scan or empty structure
            return []
        if not isinstance(results, list):
            logger.warning("OSV 'results' field is not a list: %s", type(results))
            return []

        findings: list[NormalizedFinding] = []

        for result in results:
            if not isinstance(result, dict):
                continue

            source = result.get("source") or {}
            raw_file_path = source.get("path") if isinstance(source, dict) else None
            file_path = clean_osv_file_path(raw_file_path)

            packages = result.get("packages") or []
            if not isinstance(packages, list):
                continue

            for pkg_entry in packages:
                if not isinstance(pkg_entry, dict):
                    continue

                pkg_info = pkg_entry.get("package") or {}
                if not isinstance(pkg_info, dict):
                    pkg_info = {}

                pkg_name = pkg_info.get("name")
                pkg_version = pkg_info.get("version")
                ecosystem = pkg_info.get("ecosystem")

                vulns = pkg_entry.get("vulnerabilities") or []
                if not isinstance(vulns, list):
                    continue

                for vuln in vulns:
                    if not isinstance(vuln, dict):
                        continue

                    vuln_id = str(vuln.get("id") or "").strip()
                    aliases_raw = vuln.get("aliases") or []
                    aliases = [str(a).strip() for a in aliases_raw if a]

                    cve, ghsa = extract_cve_and_ghsa(vuln_id, aliases)
                    cwe = extract_cwe(vuln)
                    severity = extract_osv_severity(vuln)
                    fixed_version = extract_fixed_version(vuln, pkg_name)

                    rule_id = vuln_id or cve or ghsa or "osv-vulnerability"

                    # Title construction with clean human-readable naming
                    summary = vuln.get("summary")
                    if summary and isinstance(summary, str) and summary.strip():
                        title = summary.strip()
                    elif pkg_name and vuln_id:
                        title = f"Vulnerability {vuln_id} in {pkg_name}"
                    elif vuln_id:
                        title = f"Vulnerability {vuln_id}"
                    elif pkg_name:
                        title = f"Vulnerability in {pkg_name}"
                    else:
                        title = "Vulnerable dependency"

                    # Description construction
                    details = vuln.get("details")
                    if details and isinstance(details, str) and details.strip():
                        description = details.strip()
                    else:
                        description = summary.strip() if summary and isinstance(summary, str) else title

                    finding = NormalizedFinding(
                        engine=self.engine_name,
                        finding_type=FindingType.DEPENDENCY.value,
                        title=title,
                        description=description,
                        severity=severity,
                        confidence=FindingConfidence.HIGH,
                        status=FindingStatus.OPEN,
                        file_path=file_path,
                        line_start=None,
                        line_end=None,
                        package_name=pkg_name,
                        package_version=str(pkg_version) if pkg_version is not None else None,
                        fixed_version=fixed_version,
                        ecosystem=str(ecosystem) if ecosystem is not None else None,
                        cve=cve,
                        ghsa=ghsa,
                        cwe=cwe,
                        rule_id=rule_id,
                        fingerprint=None,  # Solely computed by FindingNormalizer
                        raw_json=vuln,
                    )
                    findings.append(finding)

        return findings
