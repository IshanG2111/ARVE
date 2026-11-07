"""Unified report generator combining canonical scan results, AST intelligence, and AI summaries."""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from app.ai.summarizer import AISummarizerService
from app.models.models import (
    ASTAnalysisRun,
    Project,
    Scan,
    ScanEngineRun,
    ScanReport,
    SecurityFinding,
)
from app.reports.markdown_generator import generate_markdown_report
from app.reports.pdf_generator import generate_pdf_report
from app.reports.schemas import (
    AIProvenanceMetadata,
    ASTCoverageInfo,
    EngineCoverageItem,
    PriorityActionItem,
    PriorityRiskItem,
    ReportFindingItem,
    ScanReportData,
)
from app.reports.validator import ReportValidator

logger = logging.getLogger(__name__)


def _clean_issue_summary(finding: SecurityFinding) -> str:
    """Extract a concise, clean 1-2 sentence plain-language issue summary.
    
    Strips raw markdown syntax (### headers, backticks, asterisks, URLs, code blocks)
    and avoids abrupt mid-word truncation.
    """
    title = (finding.title or "").strip()
    raw_desc = (finding.description or "").strip()
    if not raw_desc:
        return title

    # Remove code blocks
    text = re.sub(r"```[\s\S]*?```", "", raw_desc)
    # Remove HTML tags if any
    text = re.sub(r"<[^>]+>", "", text)
    # Remove URLs
    text = re.sub(r"https?://\S+", "", text)
    # Remove markdown headers like ### Impact, ## Summary, # Overview
    text = re.sub(r"#+\s*(?:Impact|Summary|Overview|Description|Details|Vulnerability Details|Vulnerability)?\s*", "", text, flags=re.IGNORECASE)
    # Remove leading section labels like "Impact:", "Summary:", "Description:"
    text = re.sub(r"^(?:Impact|Summary|Overview|Description|Details):\s*", "", text, flags=re.IGNORECASE)
    # Remove markdown emphasis and backticks
    text = text.replace("`", "").replace("**", "").replace("*", "").replace("__", "")
    # Normalize whitespace and newlines
    text = re.sub(r"\s+", " ", text).strip()

    # Split into clean sentences
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    if sentences:
        summary = sentences[0]
        if len(summary) < 60 and len(sentences) > 1:
            summary = f"{summary} {sentences[1]}"

        # Truncate cleanly at a word boundary if too long
        if len(summary) > 220:
            truncated = summary[:220].rsplit(" ", 1)[0]
            truncated = re.sub(r"[\s,\(;:\-]+$", "", truncated)
            return f"{truncated}."
        return summary

    return title


def _infer_potential_impact(finding: SecurityFinding) -> str:
    """Determine realistic potential impact based on finding class and context."""
    title_lower = (finding.title or "").lower()
    cwe = (finding.cwe or "").upper()
    engine = (finding.engine or "").lower()
    sev = (finding.severity or "LOW").upper()

    if "gitleaks" in engine or "cwe-798" in cwe or "secret" in title_lower or "api key" in title_lower:
        return "Unauthorized cloud infrastructure or API service access using leaked authentication credentials."

    if "auth" in title_lower or "cwe-287" in cwe or "cwe-180" in cwe or "normalizer" in title_lower or "bypass" in title_lower:
        return "Account takeover under the affected authentication configuration."

    if "rce" in title_lower or "remote code" in title_lower or "cwe-94" in cwe:
        return "Arbitrary code execution if an unauthenticated attacker can control input to the vulnerable library function."

    if "sql" in title_lower or "cwe-89" in cwe:
        return "Database extraction, modification, or authentication bypass via unauthorized SQL query manipulation."

    if "ssrf" in title_lower or "cwe-918" in cwe:
        return "Server-Side Request Forgery leading to internal cloud metadata access or lateral network scanning."

    if "xss" in title_lower or "cwe-79" in cwe:
        return "Execution of arbitrary client-side JavaScript in user session context."

    if sev in {"CRITICAL", "HIGH"}:
        return "Severe component compromise under advisory stated conditions."

    return "Degrades application defense-in-depth posture."


def _infer_applicability(finding: SecurityFinding, has_ast: bool = False) -> str:
    """Classify reachability and applicability status."""
    engine = (finding.engine or "").lower()

    if "gitleaks" in engine or "secret" in (finding.title or "").lower():
        return "Direct Active Exposure\nCredential token detected directly in repository source code."

    if engine in {"semgrep", "codeql"}:
        return "Application Source Flaw\nStatic analysis detected vulnerable code construct in application repository."

    # Dependency engines (OSV, npm, etc.)
    return "Reachability unverified\nThe scan confirms the dependency version, but does not establish whether the vulnerable configuration or code paths are active in this deployment."


def _infer_remediation_guidance(finding: SecurityFinding) -> str:
    """Provide specific, actionable remediation guidance for canonical findings."""
    title_lower = (finding.title or "").lower()
    cwe = (finding.cwe or "").upper()
    engine = (finding.engine or "").lower()

    if "secret" in title_lower or "gitleaks" in engine or "cwe-798" in cwe:
        return "Verify whether the credential is active, restrict permissions, and rotate it immediately. Move keys to an enterprise secrets manager."

    if "osv" in engine or finding.package_name:
        pkg = finding.package_name or "package"
        if finding.fixed_version:
            return f"Upgrade {pkg} to compatible patched version >={finding.fixed_version} and verify configuration."
        return f"Upgrade {pkg} to the latest compatible non-vulnerable release."

    if "injection" in title_lower or "cwe-89" in cwe:
        return "Use parameterized queries or ORM query bindings. Disallow string concatenation in query construction."

    if "ssrf" in title_lower or "cwe-918" in cwe:
        return "Validate target URLs against an explicit strict destination whitelist; disallow loopback/RFC1918 IPs."

    if "xss" in title_lower or "cwe-79" in cwe:
        return "Apply contextual output encoding and enforce a restrictive Content Security Policy (CSP)."

    return "Inspect affected source lines, validate untrusted inputs, and apply defense-in-depth controls."


def _deduplicate_findings(findings: List[SecurityFinding], has_ast: bool = False) -> List[ReportFindingItem]:
    """Deduplicate findings based on vulnerability ID, package, and location.
    
    Assigns sequential stable identifiers ARVE-F001, ARVE-F002, etc.
    Preserves distinct advisories affecting the same package, but eliminates
    duplicate records pointing to the identical alert.
    """
    seen_keys: Set[Tuple[str, str, str, str, int]] = set()
    items: List[ReportFindingItem] = []
    counter = 1

    for f in findings:
        sev = (f.severity or "LOW").upper()
        vuln_id = f.ghsa or f.cve or f.rule_id or f.title or ""
        pkg = f.package_name or ""
        file_p = f.file_path or ""
        line_s = f.line_start or 0

        dedup_key = (f.engine, pkg, vuln_id, file_p, line_s)
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        display_id = f"ARVE-F{counter:03d}"
        counter += 1

        issue_summary = _clean_issue_summary(f)
        potential_impact = _infer_potential_impact(f)
        remediation = _infer_remediation_guidance(f)
        applicability = _infer_applicability(f, has_ast=has_ast)

        item = ReportFindingItem(
            id=f.id,
            display_id=display_id,
            title=f.title,
            severity=sev,
            file_path=f.file_path,
            line_start=f.line_start,
            line_end=f.line_end,
            engine=f.engine,
            rule_id=f.rule_id,
            package_name=f.package_name,
            package_version=f.package_version,
            fixed_version=f.fixed_version,
            cwe=f.cwe,
            cve=f.cve,
            ghsa=f.ghsa,
            description=issue_summary,
            issue_summary=issue_summary,
            potential_impact=potential_impact,
            recommended_fix=remediation,
            applicability=applicability,
            raw_evidence=f.description or "",
            fingerprint=f.fingerprint,
            status=f.status,
        )
        items.append(item)

    return items


def _build_priority_risks(deduped_findings: List[ReportFindingItem]) -> List[PriorityRiskItem]:
    """Group canonical findings into high-level priority concerns for Section 02."""
    risks: List[PriorityRiskItem] = []

    # 1. Authentication vulnerabilities (Auth.js, @auth/core, next-auth)
    auth_findings = [
        f for f in deduped_findings
        if "auth" in f.title.lower() or "auth" in (f.package_name or "").lower()
    ]
    if auth_findings:
        pkgs = sorted(list({f.package_name for f in auth_findings if f.package_name}))
        target_str = ", ".join(f"`{p}`" for p in pkgs) if pkgs else "Authentication modules"
        highest_sev = "Critical" if any(f.severity == "CRITICAL" for f in auth_findings) else "High"
        risks.append(
            PriorityRiskItem(
                index="01",
                title="Authentication vulnerabilities",
                severity=highest_sev,
                description="Auth.js dependency vulnerabilities may affect email authentication and access-control behaviour under specific configurations.",
                target=target_str,
                related_finding_ids=[f.display_id for f in auth_findings],
                related_finding_uuids=[f.id for f in auth_findings],
            )
        )

    # 2. Remote code execution exposure (Next.js, RCE)
    rce_findings = [
        f for f in deduped_findings
        if "rce" in f.title.lower() or "remote code" in f.title.lower() or (f.package_name == "next" and f.severity in {"CRITICAL", "HIGH"})
    ]
    if rce_findings:
        pkgs = sorted(list({f.package_name for f in rce_findings if f.package_name}))
        target_str = ", ".join(f"`{p}`" for p in pkgs) if pkgs else "`next`"
        highest_sev = "Critical" if any(f.severity == "CRITICAL" for f in rce_findings) else "High"
        risks.append(
            PriorityRiskItem(
                index=f"0{len(risks) + 1}",
                title="Remote code execution exposure",
                severity=highest_sev,
                description="Next.js dependency advisories identify potential remote code execution risks under their respective conditions.",
                target=target_str,
                related_finding_ids=[f.display_id for f in rce_findings],
                related_finding_uuids=[f.id for f in rce_findings],
            )
        )

    # 3. Exposed API key / Secret detection (Gitleaks / Scanner confirmed)
    secret_findings = [
        f for f in deduped_findings
        if f.engine.lower() == "gitleaks" or "cwe-798" in (f.cwe or "").lower() or ("secret" in f.title.lower() and "key" in f.title.lower())
    ]
    if secret_findings:
        sf = secret_findings[0]
        loc = sf.file_path or "source file"
        if sf.line_start:
            loc += f":{sf.line_start}"
        engine_label = "Gitleaks" if sf.engine.lower() == "gitleaks" else "Secret scanner"
        risks.append(
            PriorityRiskItem(
                index=f"0{len(risks) + 1}",
                title="Exposed API key",
                severity=f"{sf.severity.capitalize()}*",
                description=f"{engine_label} detected an API key in a source file. Verify whether it is active, restrict its permissions and rotate it if necessary.",
                target=f"`{loc}`",
                severity_footnote="*Severity shown as recorded in the scanner output, not an independently assessed risk rating.",
                related_finding_ids=[f.display_id for f in secret_findings],
                related_finding_uuids=[f.id for f in secret_findings],
            )
        )

    # 4. Application-level flaws (SSRF / SQL Injection / XSS)
    sast_findings = [f for f in deduped_findings if f.engine.lower() in {"semgrep", "codeql"}]
    if sast_findings and len(risks) < 4:
        sf = sast_findings[0]
        loc = sf.file_path or "source code"
        if sf.line_start:
            loc += f":{sf.line_start}"
        risks.append(
            PriorityRiskItem(
                index=f"0{len(risks) + 1}",
                title=sf.title,
                severity=sf.severity.capitalize(),
                description=f"Static analysis detected an application-level flaw in {loc}. Review request validation and parameter bindings.",
                target=f"`{loc}`",
                related_finding_ids=[sf.display_id],
                related_finding_uuids=[sf.id],
            )
        )

    return risks


def _build_remediation_plan(deduped_findings: List[ReportFindingItem]) -> List[PriorityActionItem]:
    """Build a consolidated 3-tier remediation plan (Priority 1, 2, 3) for Section 03."""
    actions: List[PriorityActionItem] = []

    has_secrets = any(f.engine == "gitleaks" for f in deduped_findings)
    has_crit = any(f.severity == "CRITICAL" for f in deduped_findings)
    has_auth = any("auth" in f.title.lower() or "auth" in (f.package_name or "").lower() for f in deduped_findings)

    # Priority 1 — Immediate attention
    if has_secrets:
        actions.append(
            PriorityActionItem(
                priority="Priority 1",
                action="Verify and rotate detected credentials if active; restrict cloud permissions.",
                target="Exposed credentials",
                rationale="Immediate attention: active credentials present immediate risk of unauthorized access.",
            )
        )
    if has_crit:
        actions.append(
            PriorityActionItem(
                priority="Priority 1",
                action="Upgrade affected critical dependencies to compatible patched versions.",
                target="Critical dependencies",
                rationale="Immediate attention: mitigates documented critical vulnerabilities in core dependencies.",
            )
        )
    if has_auth:
        actions.append(
            PriorityActionItem(
                priority="Priority 1",
                action="Review authentication configuration and affected code paths.",
                target="Auth configuration",
                rationale="Immediate attention: verify email normalization and session verification handling.",
            )
        )

    # Priority 2 — Next
    actions.append(
        PriorityActionItem(
            priority="Priority 2",
            action="Investigate application-level SSRF and XSS findings.",
            target="Application source code",
            rationale="Next: confirm whether affected routes and APIs are reachable from external input.",
        )
    )
    actions.append(
        PriorityActionItem(
            priority="Priority 2",
            action="Review high-severity dependency vulnerabilities and assess reachability.",
            target="High severity dependencies",
            rationale="Next: determine if vulnerable library functions are invoked in runtime execution paths.",
        )
    )

    # Priority 3 — Maintenance
    actions.append(
        PriorityActionItem(
            priority="Priority 3",
            action="Resolve remaining medium and low findings and improve security hygiene.",
            target="Maintenance backlog",
            rationale="Maintenance: scheduled sprint updates for non-critical advisories.",
        )
    )
    actions.append(
        PriorityActionItem(
            priority="Priority 3",
            action="Run a follow-up ARVE scan to verify remediation.",
            target="CI/CD Pipeline",
            rationale="Maintenance: confirm resolution of all addressed vulnerabilities across engines.",
        )
    )

    return actions


class ReportGenerator:
    """Coordinates canonical scan data, validated AI summaries, and report artifact exports."""

    def __init__(self, db: Session, ai_summarizer: Optional[AISummarizerService] = None):
        self.db = db
        self.ai_summarizer = ai_summarizer or AISummarizerService(db)

    def generate_report_data(self, scan_id: str, force_refresh_ai: bool = False) -> ScanReportData:
        """Build the complete, self-contained ScanReportData model with one canonical truth."""
        scan = self.db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            raise ValueError(f"Scan {scan_id} not found")

        project = self.db.query(Project).filter(Project.id == scan.project_id).first()
        project_name = project.name if project else "Unknown"
        repo_name = project.repo_name if project else None

        # 1. Fetch raw findings and deduplicate into the SOLE CANONICAL TRUTH
        raw_findings = (
            self.db.query(SecurityFinding)
            .filter(SecurityFinding.scan_id == scan_id)
            .order_by(
                SecurityFinding.severity.asc(),
                SecurityFinding.created_at.asc(),
            )
            .all()
        )

        ast_run = self.db.query(ASTAnalysisRun).filter(ASTAnalysisRun.scan_id == scan_id).first()
        has_ast = bool(ast_run and ast_run.status in {"COMPLETED", "PARTIAL"})

        # Canonical deduplication with stable IDs (ARVE-F001, ARVE-F002, ...)
        deduped_findings = _deduplicate_findings(raw_findings, has_ast=has_ast)

        # Canonical severity counts directly from deduplicated findings
        severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
        for f in deduped_findings:
            sev = f.severity if f.severity in severity_counts else "LOW"
            severity_counts[sev] += 1

        total_deduped_count = len(deduped_findings)

        # 2. Build canonical finding dictionaries for AI summarizer
        canonical_findings_for_ai = [
            {
                "id": f.id,
                "title": f.title,
                "description": f.description,
                "severity": f.severity,
                "engine": f.engine,
                "file_path": f.file_path,
                "line_start": f.line_start,
                "line_end": f.line_end,
                "rule_id": f.rule_id,
                "package_name": f.package_name,
                "cwe": f.cwe,
                "cve": f.cve,
            }
            for f in deduped_findings
        ]

        # 3. Fetch or generate AI summary using canonical deduplicated data
        ai_result = self.ai_summarizer.get_or_generate_scan_summary(
            scan_id=scan_id,
            force_refresh=force_refresh_ai,
            canonical_findings=canonical_findings_for_ai,
        )
        ai_summary = ai_result.summary
        ai_meta = ai_result.metadata

        # 4. Build Priority Risks (Section 02) and Remediation Plan (Section 03)
        priority_risks = _build_priority_risks(deduped_findings)
        prioritized_actions = _build_remediation_plan(deduped_findings)

        # 5. Top 5-10 prioritized detailed findings for Section 04
        crit_high = [f for f in deduped_findings if f.severity in {"CRITICAL", "HIGH"}]
        med_low = [f for f in deduped_findings if f.severity not in {"CRITICAL", "HIGH"}]
        key_findings = (crit_high + med_low)[:10]

        # 6. Engine coverage details (OSV, Gitleaks, Semgrep)
        engine_runs = (
            self.db.query(ScanEngineRun)
            .filter(ScanEngineRun.scan_id == scan_id)
            .order_by(ScanEngineRun.started_at.asc())
            .all()
        )

        engine_purposes = {
            "osv": "Third-party dependency vulnerability scanning",
            "gitleaks": "Hardcoded secret and credential detection",
            "semgrep": "Static Application Security Testing (SAST)",
            "codeql": "Deep semantic code dataflow and taint analysis",
        }

        engine_coverage: List[EngineCoverageItem] = []
        covered_engines = set()
        for er in engine_runs:
            engine_findings_count = sum(1 for f in deduped_findings if f.engine and f.engine.lower() == er.engine_name.lower())
            engine_coverage.append(
                EngineCoverageItem(
                    engine_name=er.engine_name,
                    status=er.status.capitalize() if er.status else "Completed",
                    purpose=engine_purposes.get(er.engine_name.lower(), "Security analysis engine"),
                    duration_ms=er.duration_ms,
                    findings_count=engine_findings_count,
                    notes=er.error_message,
                )
            )
            covered_engines.add(er.engine_name.lower())

        # If any engine produced findings but lacked an explicit engine_run record, synthesize coverage
        finding_engines = {f.engine.lower() for f in deduped_findings if f.engine}
        for eng in sorted(finding_engines - covered_engines):
            engine_coverage.append(
                EngineCoverageItem(
                    engine_name=eng,
                    status="Completed",
                    purpose=engine_purposes.get(eng.lower(), "Security analysis engine"),
                    duration_ms=None,
                    findings_count=sum(1 for f in deduped_findings if f.engine and f.engine.lower() == eng.lower()),
                    notes=None,
                )
            )

        # 7. AST Code Intelligence status
        ast_coverage: Optional[ASTCoverageInfo] = None
        if ast_run and ast_run.status in {"COMPLETED", "PARTIAL"}:
            ast_coverage = ASTCoverageInfo(
                status="Completed",
                total_functions=ast_run.total_functions,
                total_classes=ast_run.total_classes,
                total_imports=ast_run.total_imports,
                total_relationships=ast_run.total_relationships,
                files_discovered=ast_run.files_discovered,
                files_parsed=ast_run.files_parsed,
                files_failed=ast_run.files_failed,
                data_available=True,
                error_summary=ast_run.error_summary,
            )
            ast_status_label = "Completed"
            ast_notes = f"{ast_run.total_relationships} caller/callee relationships mapped across {ast_run.files_parsed} files."
        else:
            ast_status_label = "Not indexed"
            ast_notes = "AST structural indexing was not executed for this repository snapshot. Cross-symbol caller/callee relationships are unavailable."
            ast_coverage = ASTCoverageInfo(
                status="Not indexed",
                data_available=False,
                notes=ast_notes,
            )

        # Add AST explicitly to the engine coverage table
        engine_coverage.append(
            EngineCoverageItem(
                engine_name="AST — Code Intelligence",
                status=ast_status_label,
                purpose="Code structure, symbol relationships, and call mapping",
                duration_ms=None,
                findings_count=0,
                notes=ast_notes,
            )
        )

        scan_timestamp_str = (
            scan.completed_at.strftime("%Y-%m-%d %H:%M:%S UTC")
            if scan.completed_at
            else scan.created_at.strftime("%Y-%m-%d %H:%M:%S UTC")
        )

        # AI and fallback status message
        provider_name = getattr(ai_meta, "provider", None) or ("deterministic-engine" if ai_meta.is_fallback else "gemini")
        if ai_meta.is_fallback:
            ai_status_message = "Deterministic engine fallback active: AI service quota or endpoint unreachable. Report generated from canonical engine rules."
        else:
            ai_status_message = f"AI assessment generated by {provider_name.capitalize()} ({ai_meta.served_model or ai_meta.model}) over canonical scanner evidence."

        provenance = AIProvenanceMetadata(
            provider=provider_name,
            model=ai_meta.served_model or ai_meta.model,
            prompt_version=ai_meta.prompt_version,
            generation_status="fallback" if ai_meta.is_fallback else "success",
            generated_at=datetime.utcnow().isoformat() + "Z",
            cache_status="cached" if ai_meta.cache_hit else ("fallback" if ai_meta.is_fallback else "fresh"),
            input_hash=ai_meta.cache_key,
            input_tokens=ai_meta.input_tokens,
            output_tokens=ai_meta.output_tokens,
            thought_tokens=ai_meta.thought_tokens,
            latency_ms=ai_meta.latency_ms,
        )

        report_data = ScanReportData(
            scan_id=scan.id,
            project_id=scan.project_id,
            project_name=project_name,
            repository_name=repo_name,
            commit_sha=scan.commit_sha,
            scan_timestamp=scan_timestamp_str,
            scan_status=scan.status,
            executive_summary=ai_summary.overall_summary,
            main_concerns=ai_summary.main_concerns,
            risk_overview=ai_summary.risk_overview,
            impact=ai_summary.impact,
            reachability_assessment=ai_summary.reachability_assessment,
            positive_observations=ai_summary.positive_observations,
            is_ai_fallback=ai_meta.is_fallback,
            ai_model=ai_meta.served_model or ai_meta.model,
            ai_status_message=ai_status_message,
            provenance=provenance,
            severity_counts=severity_counts,
            total_findings=total_deduped_count,
            priority_risks=priority_risks,
            prioritized_actions=prioritized_actions,
            consolidated_remediations=ai_summary.consolidated_remediations,
            ai_recommendations=[f"[{a.priority}] {a.action}" for a in prioritized_actions],
            important_findings=key_findings,
            engine_coverage=engine_coverage,
            ast_coverage=ast_coverage,
            ast_status_label=ast_status_label,
            limitations=[
                "Dependency detection does not automatically establish exploitability.",
                "Runtime behaviour and deployment configuration are not necessarily covered.",
                "AST relationships are only available when indexing has successfully completed.",
            ],
            appendix_findings=deduped_findings,
        )

        # Run automated report validation suite
        validation_res = ReportValidator.validate(report_data, raise_on_error=False)
        if not validation_res.is_valid:
            logger.warning("scan=%s Report validation issues: %s", scan_id, validation_res.errors)

        return report_data

    def get_or_create_persisted_report(
        self,
        scan_id: str,
        force_refresh: bool = False,
    ) -> Tuple[ScanReportData, ScanReport]:
        """Retrieve existing persisted report or generate and persist a new one."""
        scan_id_str = str(scan_id)
        existing = (
            self.db.query(ScanReport)
            .filter(ScanReport.scan_id == scan_id_str)
            .first()
        )

        if existing and not force_refresh:
            try:
                report_dict = json.loads(existing.report_json)
                report_data = ScanReportData.model_validate(report_dict)
                return report_data, existing
            except Exception as exc:
                logger.warning("scan=%s corrupt ScanReport record: %s; regenerating", scan_id, exc)

        # Generate fresh report data
        report_data = self.generate_report_data(scan_id, force_refresh_ai=force_refresh)
        markdown_text = generate_markdown_report(report_data)

        if existing:
            existing.report_json = report_data.model_dump_json()
            existing.markdown_content = markdown_text
            existing.status = "READY"
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(existing)
            return report_data, existing

        new_report = ScanReport(
            scan_id=scan_id,
            project_id=report_data.project_id,
            status="READY",
            title=f"ARVE Security Report - {report_data.project_name}",
            report_json=report_data.model_dump_json(),
            markdown_content=markdown_text,
        )
        self.db.add(new_report)
        self.db.commit()
        self.db.refresh(new_report)
        return report_data, new_report

    def export_pdf(self, scan_id: str) -> bytes:
        """Generate PDF binary content for the specified scan report."""
        report_data, _ = self.get_or_create_persisted_report(scan_id)
        return generate_pdf_report(report_data)

    def export_markdown(self, scan_id: str) -> str:
        """Generate Markdown string for the specified scan report."""
        report_data, persisted = self.get_or_create_persisted_report(scan_id)
        if persisted.markdown_content:
            return persisted.markdown_content
        return generate_markdown_report(report_data)
