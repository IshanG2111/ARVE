"""Build the redacted ``FindingContext`` the LLM is allowed to see.

Inputs are persisted engine findings and the scanned commit's source in
``RepositoryFile.content``. Code comes from the AST's enclosing symbol when one
is available, otherwise from a fixed line window around the finding.
"""
from __future__ import annotations

import re
from typing import Optional

from sqlalchemy.orm import Session

from app.ai.ast_adapter import AstSymbol, get_enclosing_symbol
from app.ai.redaction import MASK, is_sensitive_file, redact_text
from app.ai.schemas import CodeContext, FindingContext
from app.models.models import RepositoryFile, Scan, SecurityFinding
from app.security.models import EngineName, FindingStatus, FindingType
from app.security.semgrep.remediation import CWE_TO_CATEGORY, REMEDIATION_CATALOG
from app.security.severity import FindingSeverity

LINE_WINDOW = 15
MAX_CODE_LINES = 80
MAX_RELATED = 10

ACTIVE_STATUSES = (FindingStatus.OPEN.value, FindingStatus.REOPENED.value, FindingStatus.ACKNOWLEDGED.value)
_SEVERITY_RANK = {s.value: i for i, s in enumerate(FindingSeverity)}
_CONFIDENCE_RANK = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
# Finding types whose location points at application code worth showing.
_CODE_FINDING_TYPES = {FindingType.SAST.value, FindingType.IAC.value, FindingType.CONFIGURATION.value}
_CWE_PATTERN = re.compile(r"CWE-\d+", re.IGNORECASE)


def catalog_fix(finding: SecurityFinding) -> Optional[str]:
    """Return static fix guidance by direct CWE match only; keyword matching is too loose here."""
    if finding.finding_type == FindingType.SECRET.value:
        return REMEDIATION_CATALOG["HARDCODED_SECRET"].recommended_action
    for cwe in _CWE_PATTERN.findall(finding.cwe or ""):
        category = CWE_TO_CATEGORY.get(cwe.upper())
        if category:
            return REMEDIATION_CATALOG[category].recommended_action
    return None


def _secret_lines(db: Session, scan_id: str, file_path: str) -> set[int]:
    """Lines in this file that a secret finding flagged in the same scan."""
    rows = (
        db.query(SecurityFinding.line_start, SecurityFinding.line_end)
        .filter(
            SecurityFinding.scan_id == scan_id,
            SecurityFinding.file_path == file_path,
            (SecurityFinding.finding_type == FindingType.SECRET.value)
            | (SecurityFinding.engine == EngineName.GITLEAKS.value),
        )
        .all()
    )
    lines: set[int] = set()
    for start, end in rows:
        if start is None:
            continue
        lines.update(range(start, (end or start) + 1))
    return lines


def _window(line_start: int, line_end: int, total: int, window: int = LINE_WINDOW) -> tuple[int, int]:
    start = max(1, line_start - window)
    end = min(total, line_end + window)
    if end - start + 1 > MAX_CODE_LINES:
        end = start + MAX_CODE_LINES - 1
    return start, end


def build_code_context(
    db: Session,
    finding: SecurityFinding,
    scan: Scan,
    window: int = LINE_WINDOW,
    use_ast: bool = True,
) -> Optional[CodeContext]:
    """Return redacted code around a finding, or ``None`` when no code should or can be shown.

    The report uses a small ``window`` with ``use_ast=False`` for short excerpts.
    """
    if finding.finding_type not in _CODE_FINDING_TYPES:
        return None
    if not finding.file_path or not finding.line_start or is_sensitive_file(finding.file_path):
        return None

    repo_file = (
        db.query(RepositoryFile)
        .filter(
            RepositoryFile.analysis_run_id == scan.analysis_run_id,
            RepositoryFile.path == finding.file_path,
            RepositoryFile.status == "INGESTED",
        )
        .first()
    )
    if repo_file is None or not repo_file.content:
        return None

    lines = repo_file.content.splitlines()
    total = len(lines)
    line_start = finding.line_start
    line_end = max(finding.line_end or line_start, line_start)
    if line_start > total:
        return None
    line_end = min(line_end, total)

    symbol: Optional[AstSymbol] = None
    if use_ast:
        symbol = get_enclosing_symbol(
            scan.analysis_run_id, scan.commit_sha, finding.file_path, repo_file.language, line_start, line_end
        )
    use_symbol_range = (
        symbol is not None
        and symbol.end_line <= total
        and symbol.end_line - symbol.start_line + 1 <= MAX_CODE_LINES
    )
    if use_symbol_range:
        start, end = symbol.start_line, symbol.end_line
    else:
        start, end = _window(line_start, line_end, total, window)

    masked = _secret_lines(db, scan.id, finding.file_path)
    selected = [MASK if n in masked else lines[n - 1] for n in range(start, end + 1)]

    related: list[str] = []
    if symbol is not None:
        labelled = (
            [f"called by: {name}" for name in symbol.callers]
            + [f"calls: {name}" for name in symbol.calls]
            + [f"import: {name}" for name in symbol.imports]
        )
        for item in labelled[:MAX_RELATED]:
            redacted = redact_text(item)
            if redacted:
                related.append(redacted)

    return CodeContext(
        source="ast" if symbol is not None else "lines",
        file_path=finding.file_path,
        start_line=start,
        end_line=end,
        symbol_name=redact_text(symbol.qualified_name or symbol.name) if symbol else None,
        symbol_kind=symbol.kind if symbol else None,
        code=redact_text("\n".join(selected)) or "",
        related=related,
    )


def build_finding_context(
    db: Session, finding: SecurityFinding, ref: str, scan: Scan | None = None
) -> FindingContext:
    """Build the model-facing context for one persisted finding."""
    scan = scan or finding.scan
    return FindingContext(
        ref=ref,
        engine=finding.engine,
        finding_type=finding.finding_type,
        rule_id=redact_text(finding.rule_id),
        title=redact_text(finding.title) or "Untitled finding",
        message=redact_text(finding.description),
        severity=finding.severity,
        file_path=finding.file_path,
        line_start=finding.line_start,
        line_end=finding.line_end,
        cwe=finding.cwe,
        cve=finding.cve,
        package_name=finding.package_name,
        package_version=finding.package_version,
        fixed_version=finding.fixed_version,
        ecosystem=finding.ecosystem,
        catalog_fix=catalog_fix(finding),
        code=build_code_context(db, finding, scan),
    )


def _priority_key(finding: SecurityFinding) -> tuple:
    return (
        _SEVERITY_RANK.get(finding.severity, len(_SEVERITY_RANK)),
        _CONFIDENCE_RANK.get(finding.confidence or "", len(_CONFIDENCE_RANK)),
        finding.file_path or "",
        finding.line_start or 0,
        finding.id,
    )


def select_top_findings(db: Session, scan: Scan, limit: int = 10) -> list[SecurityFinding]:
    """Active findings of a scan in severity order, one row per fingerprint."""
    rows = (
        db.query(SecurityFinding)
        .filter(SecurityFinding.scan_id == scan.id, SecurityFinding.status.in_(ACTIVE_STATUSES))
        .all()
    )
    seen: set[str] = set()
    selected: list[SecurityFinding] = []
    for finding in sorted(rows, key=_priority_key):
        if finding.fingerprint in seen:
            continue
        seen.add(finding.fingerprint)
        selected.append(finding)
        if len(selected) == limit:
            break
    return selected


def build_scan_contexts(db: Session, scan: Scan, limit: int = 10) -> list[FindingContext]:
    """Contexts for the top findings of a scan, with refs ``F1``..``Fn``."""
    return [
        build_finding_context(db, finding, f"F{index}", scan)
        for index, finding in enumerate(select_top_findings(db, scan, limit), start=1)
    ]
