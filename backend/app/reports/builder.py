"""Collect a scan's engines and findings into a report model.

Everything here is deterministic and read from the database. Counts are per
scan, with one entry per fingerprint, so they can differ from the project-wide
Findings page.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.orm import Session

from app.ai.context import ACTIVE_STATUSES, build_code_context, catalog_fix
from app.ai.redaction import redact_text
from app.ai.schemas import FindingExplanation
from app.ai.service import cached_finding_explanations, cached_scan_summary
from app.core.config import settings
from app.models.models import AnalysisRun, Project, Scan, ScanEngineRun, SecurityFinding
from app.security.models import EngineName, FindingType
from app.security.severity import FindingSeverity

REPORTABLE_SCAN_STATUSES = ("COMPLETED", "PARTIAL")
EXCERPT_WINDOW = 3
EXCERPT_MAX_LINES = 15

ENGINE_LABELS = {
    EngineName.OSV.value: "OSV-Scanner (dependencies)",
    EngineName.GITLEAKS.value: "Gitleaks (secrets)",
    EngineName.SEMGREP.value: "Semgrep (code patterns)",
    EngineName.CODEQL.value: "CodeQL (code analysis)",
}
FINDING_TYPE_LABELS = {
    FindingType.DEPENDENCY.value: "Vulnerable dependency",
    FindingType.SECRET.value: "Exposed secret",
    FindingType.SAST.value: "Code weakness",
    FindingType.IAC.value: "Infrastructure as code",
    FindingType.CONTAINER.value: "Container",
    FindingType.CONFIGURATION.value: "Configuration",
}
SEVERITY_ORDER = [s.value for s in FindingSeverity]
_SEVERITY_RANK = {s: i for i, s in enumerate(SEVERITY_ORDER)}
_ACTIVE_PRIORITY = {status: i for i, status in enumerate(ACTIVE_STATUSES)}
INCOMPLETE_STATES = {"Failed", "Timed out", "Cancelled", "Incomplete", "Result unverified", "Completed with errors"}


class ReportNotAvailable(Exception):
    """The scan cannot produce a report yet; the message is safe to show users."""


@dataclass
class EngineCoverage:
    engine: str
    label: str
    state: str
    finding_count: Optional[int]
    note: Optional[str] = None

    @property
    def usable(self) -> bool:
        return self.finding_count is not None


@dataclass
class ReportFinding:
    display_id: str
    title: str
    severity: str
    engine: str
    engine_label: str
    finding_type: str
    type_label: str
    status: str
    active: bool
    locations: list[str]
    occurrence_count: int
    description: Optional[str]
    rule_id: Optional[str]
    cwe: Optional[str]
    cve: Optional[str]
    ghsa: Optional[str]
    package_name: Optional[str]
    package_version: Optional[str]
    fixed_version: Optional[str]
    ecosystem: Optional[str]
    fix: Optional[str]
    excerpt_start: Optional[int] = None
    excerpt: Optional[str] = None
    ai: Optional[FindingExplanation] = None  # cached, validated AI explanation; shown as "AI-assisted"


@dataclass
class ReportAISummary:
    model: str
    overview: str
    top_risks: list[str]
    first_actions: list[str]


@dataclass
class SecurityReport:
    generated_at: datetime.datetime
    project_name: str
    repo_name: Optional[str]
    repo_url: Optional[str]
    branch: Optional[str]
    commit_sha: str
    scan_id: str
    scan_status: str
    scan_started_at: Optional[datetime.datetime]
    scan_completed_at: Optional[datetime.datetime]
    files_ingested: Optional[int]
    languages: list[str]
    engines: list[EngineCoverage]
    severity_counts: list[tuple[str, int]]
    active_total: int
    inactive_counts: list[tuple[str, int]]
    findings: list[ReportFinding]
    limitations: list[str] = field(default_factory=list)
    ai_summary: Optional[ReportAISummary] = None
    ai_model: Optional[str] = None

    @property
    def partial(self) -> bool:
        return self.scan_status == "PARTIAL" or any(e.state in INCOMPLETE_STATES for e in self.engines)

    @property
    def has_ai(self) -> bool:
        return self.ai_summary is not None or any(f.ai for f in self.findings)


def _engine_coverage(engine: str, run: Optional[ScanEngineRun], finding_count: int) -> EngineCoverage:
    label = ENGINE_LABELS.get(engine, engine)
    if run is None:
        return EngineCoverage(engine, label, "Not run", None, "Disabled or not scheduled for this scan.")
    status = (run.status or "").upper()
    missing = "Results from this engine are missing, so no conclusion can be drawn from it."
    if status == "FAILED":
        return EngineCoverage(engine, label, "Failed", None, missing)
    if status == "TIMEOUT":
        return EngineCoverage(engine, label, "Timed out", None, missing)
    if status == "CANCELLED":
        return EngineCoverage(engine, label, "Cancelled", None, missing)
    if status != "COMPLETED":
        return EngineCoverage(engine, label, "Incomplete", None, missing)
    if engine == EngineName.OSV.value and run.exit_code == 128:
        return EngineCoverage(engine, label, "Not applicable", None, "No supported dependency manifests were found.")
    if engine in (EngineName.OSV.value, EngineName.GITLEAKS.value) and run.exit_code == 1 and finding_count == 0:
        return EngineCoverage(
            engine, label, "Result unverified", None,
            "The engine signalled findings but none were recorded. Results from this engine are unreliable.",
        )
    if run.error_message:
        return EngineCoverage(
            engine, label, "Completed with errors", finding_count,
            "Part of the analysis failed (for example one language), so coverage is incomplete.",
        )
    note = "No findings reported. This is not proof that the code is secure." if finding_count == 0 else None
    return EngineCoverage(engine, label, "Completed", finding_count, note)


def _effective_status(rows: list[SecurityFinding]) -> str:
    active = [r.status for r in rows if r.status in ACTIVE_STATUSES]
    if active:
        return min(active, key=lambda s: _ACTIVE_PRIORITY[s])
    return Counter(r.status for r in rows).most_common(1)[0][0]


def _location(row: SecurityFinding) -> Optional[str]:
    if not row.file_path:
        return None
    if row.line_start is None:
        return row.file_path
    if row.line_end and row.line_end != row.line_start:
        return f"{row.file_path}:{row.line_start}-{row.line_end}"
    return f"{row.file_path}:{row.line_start}"


def _fix_text(row: SecurityFinding) -> Optional[str]:
    if row.finding_type == FindingType.DEPENDENCY.value:
        if row.package_name and row.fixed_version:
            current = f" from {row.package_version}" if row.package_version else ""
            return f"Upgrade {row.package_name}{current} to {row.fixed_version} or later."
        return "No fixed version is recorded for this advisory. Check the advisory for mitigations."
    return catalog_fix(row)


def _display_id(fingerprint: str) -> str:
    return "ARVE-" + hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:8].upper()


def _build_finding(db: Session, scan: Scan, rows: list[SecurityFinding],
                   ai: Optional[dict[str, FindingExplanation]] = None) -> ReportFinding:
    rows = sorted(rows, key=lambda r: (r.line_start or 0, r.id))
    primary = rows[0]
    status = _effective_status(rows)
    locations = [loc for loc in dict.fromkeys(_location(r) for r in rows) if loc]

    excerpt = None
    excerpt_start = None
    code = build_code_context(db, primary, scan, window=EXCERPT_WINDOW, use_ast=False)
    if code is not None:
        lines = code.code.splitlines()
        if len(lines) > EXCERPT_MAX_LINES:
            lines = lines[:EXCERPT_MAX_LINES] + ["..."]
        excerpt = "\n".join(lines)
        excerpt_start = code.start_line

    return ReportFinding(
        display_id=_display_id(primary.fingerprint),
        title=redact_text(primary.title) or "Untitled finding",
        severity=primary.severity,
        engine=primary.engine,
        engine_label=ENGINE_LABELS.get(primary.engine, primary.engine),
        finding_type=primary.finding_type,
        type_label=FINDING_TYPE_LABELS.get(primary.finding_type, primary.finding_type),
        status=status,
        active=status in ACTIVE_STATUSES,
        locations=locations,
        occurrence_count=len(rows),
        description=_plain_description(redact_text(primary.description)),
        rule_id=redact_text(primary.rule_id),
        cwe=primary.cwe,
        cve=primary.cve,
        ghsa=primary.ghsa,
        package_name=primary.package_name,
        package_version=primary.package_version,
        fixed_version=primary.fixed_version,
        ecosystem=primary.ecosystem,
        fix=_fix_text(primary),
        excerpt_start=excerpt_start,
        excerpt=excerpt,
        ai=next((ai[r.id] for r in rows if ai and r.id in ai), None),
    )


_SUMMARY_REF = re.compile(r"\[(F\d+)\]")


def _report_ai_summary(db: Session, scan: Scan, display_by_row: dict[str, str]) -> Optional[ReportAISummary]:
    cached = cached_scan_summary(db, scan)
    if cached is None:
        return None
    summary, ref_map = cached

    def relabel(text: str) -> str:
        # [F2] in the AI text becomes the report's own finding ID, e.g. [ARVE-1A2B3C4D].
        return _SUMMARY_REF.sub(lambda m: f"[{display_by_row.get(ref_map.get(m.group(1), ''), m.group(1))}]", text)

    return ReportAISummary(
        model=settings.GEMINI_MODEL,
        overview=relabel(summary.overview),
        top_risks=[relabel(t) for t in summary.top_risks],
        first_actions=[relabel(t) for t in summary.first_actions],
    )


DESCRIPTION_MAX_CHARS = 700
_MD_HEADING = re.compile(r"^\s{0,3}#{1,6}\s*", re.MULTILINE)
_MD_EMPHASIS = re.compile(r"(\*\*|__)(.+?)\1")


def _plain_description(text: Optional[str]) -> Optional[str]:
    """Advisory text is often long markdown; show it as one short plain paragraph."""
    if not text:
        return None
    text = _MD_EMPHASIS.sub(r"\2", _MD_HEADING.sub("", text))
    text = " ".join(text.split())
    if len(text) > DESCRIPTION_MAX_CHARS:
        text = text[:DESCRIPTION_MAX_CHARS].rsplit(" ", 1)[0] + " ..."
    return text


def _languages(run: Optional[AnalysisRun]) -> list[str]:
    if run is None or not run.languages_summary:
        return []
    try:
        data = json.loads(run.languages_summary)
    except (TypeError, ValueError):
        return []
    if isinstance(data, dict):
        names = [name for name, _ in sorted(data.items(), key=lambda item: (-(item[1] or 0), item[0]))]
    elif isinstance(data, list):
        names = [str(item) for item in data]
    else:
        return []
    return [name for name in names if name and name != "Unknown"]


LIMITATIONS = [
    "This report covers one scan of one commit. Findings are grouped by fingerprint within this scan, "
    "so totals can differ from the project-wide Findings page.",
    "A finding reported by two engines is listed once per engine.",
    "An engine that reports no findings has not proven the code secure. Engines that failed, timed out "
    "or did not run are listed in Scan coverage, and their categories were not checked.",
    "Secret scanning examined the files at this commit only, not the git history.",
    "Severities are as reported by each engine. Gitleaks reports every secret as MEDIUM; treat exposed "
    "secrets as urgent regardless.",
    "Code excerpts are shortened and secrets in them are masked.",
    "Dynamic testing of the running application was not performed.",
]
AI_LIMITATION = (
    "Sections marked AI-assisted were written by a language model from the scanner result and nearby code, "
    "then checked automatically for invented identifiers, paths and claims. They are guidance only: they do not "
    "confirm a finding is exploitable or that a fix is complete. Findings without such a section use standard guidance."
)


def build_report(db: Session, scan: Scan, include_ai: bool = True) -> SecurityReport:
    """Build the report model for a terminal scan. Raises ``ReportNotAvailable`` otherwise.

    With ``include_ai``, already-cached AI answers are added; the report never calls the model itself.
    """
    if scan.status not in REPORTABLE_SCAN_STATUSES:
        raise ReportNotAvailable(f"A report is only available for a finished scan (this scan is {scan.status}).")

    project: Project = scan.project
    analysis_run = db.query(AnalysisRun).filter(AnalysisRun.id == scan.analysis_run_id).first()
    engine_runs = {run.engine_name: run for run in db.query(ScanEngineRun).filter(ScanEngineRun.scan_id == scan.id)}
    rows = db.query(SecurityFinding).filter(SecurityFinding.scan_id == scan.id).all()

    groups: dict[str, list[SecurityFinding]] = {}
    for row in rows:
        groups.setdefault(row.fingerprint, []).append(row)
    ai = cached_finding_explanations(db, scan) if include_ai else {}
    findings = [_build_finding(db, scan, group, ai) for group in groups.values()]
    findings.sort(key=lambda f: (
        not f.active,
        _SEVERITY_RANK.get(f.severity, len(SEVERITY_ORDER)),
        f.finding_type,
        f.locations[0] if f.locations else "",
        f.display_id,
    ))

    count_by_engine = Counter(f.engine for f in findings)
    engine_names = [e.value for e in EngineName] + sorted(set(engine_runs) - {e.value for e in EngineName})
    engines = [_engine_coverage(name, engine_runs.get(name), count_by_engine.get(name, 0)) for name in engine_names]
    if not any(e.usable for e in engines):
        raise ReportNotAvailable("No scanner engine completed successfully, so there is nothing reliable to report.")

    active = [f for f in findings if f.active]
    active_by_severity = Counter(f.severity for f in active)
    inactive_by_status = Counter(f.status for f in findings if not f.active)
    ai_summary = (
        _report_ai_summary(db, scan, {row.id: _display_id(row.fingerprint) for row in rows}) if include_ai else None
    )
    has_ai = ai_summary is not None or any(f.ai for f in findings)

    return SecurityReport(
        generated_at=datetime.datetime.utcnow(),
        project_name=project.name or project.repo_name or "Untitled project",
        repo_name=project.repo_name,
        repo_url=project.repo_url,
        branch=project.branch,
        commit_sha=scan.commit_sha,
        scan_id=scan.id,
        scan_status=scan.status,
        scan_started_at=scan.started_at,
        scan_completed_at=scan.completed_at,
        files_ingested=analysis_run.files_ingested if analysis_run else None,
        languages=_languages(analysis_run),
        engines=engines,
        severity_counts=[(severity, active_by_severity.get(severity, 0)) for severity in SEVERITY_ORDER],
        active_total=len(active),
        inactive_counts=sorted(inactive_by_status.items()),
        findings=findings,
        limitations=list(LIMITATIONS) + ([AI_LIMITATION] if has_ai else []),
        ai_summary=ai_summary,
        ai_model=settings.GEMINI_MODEL if has_ai else None,
    )
