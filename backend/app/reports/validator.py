"""Automated Report Validation Suite ensuring 100% data correctness and cross-section consistency.

Validates:
1. Canonical scan data parity (sum of severities == total findings == len(appendix_findings)).
2. Finding ID references (all priority risk links exist in canonical findings).
3. Secret detection cross-check (Gitleaks coverage findings == actual Gitleaks findings).
4. Analysis coverage parity (engine finding counts match canonical engine distribution).
5. AST execution and indexing status representation.
6. Fixed version and advisory accuracy (no invented versions).
"""
from __future__ import annotations

import logging
from typing import List, Set
from pydantic import BaseModel, Field

from app.reports.schemas import ScanReportData

logger = logging.getLogger(__name__)


class ReportValidationError(Exception):
    """Raised when scan report data fails strict cross-section consistency validation."""
    pass


class ValidationCheckResult(BaseModel):
    check_name: str
    passed: bool
    details: str


class ReportValidationResult(BaseModel):
    is_valid: bool
    total_checks: int
    passed_checks: int
    failed_checks: int
    errors: List[str] = Field(default_factory=list)
    checks: List[ValidationCheckResult] = Field(default_factory=list)


class ReportValidator:
    """Enforces strict multi-point integrity checks across canonical report data."""

    @classmethod
    def validate(cls, report: ScanReportData, raise_on_error: bool = False) -> ReportValidationResult:
        errors: List[str] = []
        checks: List[ValidationCheckResult] = []

        def record_check(name: str, passed: bool, details: str):
            checks.append(ValidationCheckResult(check_name=name, passed=passed, details=details))
            if not passed:
                errors.append(f"[{name}] {details}")

        # 1. Total findings vs Appendix length
        app_len = len(report.appendix_findings)
        tot_match = (report.total_findings == app_len)
        record_check(
            "canonical_total_match",
            tot_match,
            f"Total findings ({report.total_findings}) equals appendix count ({app_len})"
            if tot_match
            else f"Total findings ({report.total_findings}) does not match appendix count ({app_len})"
        )

        # 2. Severity sum equals total findings
        sev_sum = sum(report.severity_counts.values())
        sev_sum_match = (sev_sum == report.total_findings)
        record_check(
            "severity_sum_parity",
            sev_sum_match,
            f"Severity breakdown sum ({sev_sum}) matches total findings ({report.total_findings})"
            if sev_sum_match
            else f"Severity breakdown sum ({sev_sum}) differs from total findings ({report.total_findings})"
        )

        # 3. Canonical severity counts match actual findings in appendix
        actual_sev_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
        for f in report.appendix_findings:
            s = (f.severity or "LOW").upper()
            if s in actual_sev_counts:
                actual_sev_counts[s] += 1
            else:
                actual_sev_counts["LOW"] += 1

        sev_dist_match = (actual_sev_counts == report.severity_counts)
        record_check(
            "severity_distribution_parity",
            sev_dist_match,
            f"Severity distribution matches canonical inventory: {report.severity_counts}"
            if sev_dist_match
            else f"Severity distribution mismatch: recorded {report.severity_counts} vs actual {actual_sev_counts}"
        )

        # 4. Priority risk finding ID references
        known_display_ids: Set[str] = {f.display_id for f in report.appendix_findings}
        known_uuids: Set[str] = {f.id for f in report.appendix_findings}
        orphan_refs: List[str] = []
        for risk in report.priority_risks:
            for ref in risk.related_finding_ids:
                if ref not in known_display_ids:
                    orphan_refs.append(ref)
            for ref_uuid in risk.related_finding_uuids:
                if ref_uuid not in known_uuids:
                    orphan_refs.append(ref_uuid)

        refs_valid = len(orphan_refs) == 0
        record_check(
            "priority_risk_id_references",
            refs_valid,
            "All priority risk finding references exist in canonical inventory"
            if refs_valid
            else f"Priority risks reference nonexistent finding IDs: {orphan_refs}"
        )

        # 5. Secret detection cross-check (Gitleaks consistency)
        gitleaks_coverage = next((ec for ec in report.engine_coverage if ec.engine_name.lower() == "gitleaks"), None)
        gitleaks_actual_findings = sum(1 for f in report.appendix_findings if f.engine.lower() == "gitleaks")

        secret_risks = [
            r for r in report.priority_risks
            if "gitleaks" in r.description.lower() or "secret" in r.title.lower() or "api key" in r.title.lower()
        ]

        if gitleaks_actual_findings == 0:
            # If Gitleaks found 0 secrets, no priority risk may claim Gitleaks detected an exposed secret/key
            invalid_claims = [r.title for r in secret_risks if "gitleaks" in r.description.lower()]
            gitleaks_valid = len(invalid_claims) == 0
            record_check(
                "secret_detection_cross_check",
                gitleaks_valid,
                "No secret detection claimed since Gitleaks reported 0 findings"
                if gitleaks_valid
                else f"Priority risk claims Gitleaks detected exposed secrets but Gitleaks found 0 items: {invalid_claims}"
            )
        else:
            # Gitleaks found secrets -> engine coverage must reflect findings_count > 0
            cov_count_match = bool(gitleaks_coverage and gitleaks_coverage.findings_count == gitleaks_actual_findings)
            record_check(
                "secret_detection_cross_check",
                cov_count_match,
                f"Gitleaks findings count ({gitleaks_actual_findings}) matches engine coverage"
                if cov_count_match
                else f"Gitleaks coverage count mismatch: actual {gitleaks_actual_findings} vs coverage {getattr(gitleaks_coverage, 'findings_count', None)}"
            )

        # 6. Engine coverage findings count parity
        engine_mismatches: List[str] = []
        for ec in report.engine_coverage:
            if "ast" in ec.engine_name.lower():
                continue
            eng_actual = sum(1 for f in report.appendix_findings if f.engine.lower() == ec.engine_name.lower())
            if ec.findings_count != eng_actual:
                engine_mismatches.append(f"{ec.engine_name}: coverage={ec.findings_count} vs actual={eng_actual}")

        eng_parity = len(engine_mismatches) == 0
        record_check(
            "engine_coverage_parity",
            eng_parity,
            "All engine coverage finding counts equal canonical engine findings"
            if eng_parity
            else f"Engine coverage count mismatches: {engine_mismatches}"
        )

        # 7. AST Execution vs Indexing status consistency
        ast_valid = True
        ast_details = "AST status valid"
        if report.ast_status_label == "Not indexed":
            if report.ast_coverage and report.ast_coverage.data_available:
                ast_valid = False
                ast_details = "AST labeled 'Not indexed' but ast_coverage reports data_available=True"
        elif report.ast_status_label == "Completed":
            if not report.ast_coverage or not report.ast_coverage.data_available:
                ast_valid = False
                ast_details = "AST labeled 'Completed' but ast_coverage reports data_available=False"

        record_check("ast_status_consistency", ast_valid, ast_details)

        # 8. Fixed version accuracy
        invented_versions: List[str] = []
        for f in report.appendix_findings:
            if not f.fixed_version and f.recommended_fix:
                # Check for invented specific semver in fix when fixed_version is None
                import re
                if re.search(r">=\d+\.\d+\.\d+", f.recommended_fix):
                    invented_versions.append(f"{f.display_id} ({f.package_name}): {f.recommended_fix}")

        no_invented = len(invented_versions) == 0
        record_check(
            "fixed_version_accuracy",
            no_invented,
            "No invented fixed versions detected in remediation guidance"
            if no_invented
            else f"Invented versions detected: {invented_versions[:3]}"
        )

        is_valid = len(errors) == 0
        result = ReportValidationResult(
            is_valid=is_valid,
            total_checks=len(checks),
            passed_checks=sum(1 for c in checks if c.passed),
            failed_checks=len(errors),
            errors=errors,
            checks=checks,
        )

        if not is_valid and raise_on_error:
            raise ReportValidationError(f"Report validation failed with {len(errors)} errors: {'; '.join(errors)}")

        return result

