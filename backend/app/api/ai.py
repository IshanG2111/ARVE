"""AI explanation API. Every route checks scan ownership; answers fall back to standard guidance."""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ai.schemas import FindingExplanation, ScanSummary
from app.ai.service import explain_finding, summarize_scan
from app.api.deps import get_current_user
from app.api.scans import _owned_scan
from app.core.config import settings
from app.core.database import get_db
from app.models.models import SecurityFinding, User

router = APIRouter(tags=["ai"])


class AIStatusResponse(BaseModel):
    enabled: bool
    model: Optional[str]
    private_repos_allowed: bool


class FindingExplanationResponse(BaseModel):
    status: Literal["VALIDATED", "FALLBACK"]
    reason: Optional[str]
    cached: bool
    model: Optional[str]
    prompt_version: Optional[str]
    scan_id: str
    finding_id: str
    commit_sha: str
    code_source: Optional[Literal["ast", "lines"]]
    code_symbol: Optional[str]
    explanation: FindingExplanation


class SummaryRef(BaseModel):
    finding_id: str
    title: str
    severity: str


class ScanSummaryResponse(BaseModel):
    status: Literal["VALIDATED", "FALLBACK"]
    reason: Optional[str]
    cached: bool
    model: Optional[str]
    prompt_version: Optional[str]
    scan_id: str
    commit_sha: str
    refs: dict[str, SummaryRef]
    summary: ScanSummary


@router.get("/ai/status", response_model=AIStatusResponse)
def get_ai_status(current_user: User = Depends(get_current_user)):
    return AIStatusResponse(
        enabled=settings.AI_ENABLED and bool(settings.GEMINI_API_KEY),
        model=settings.GEMINI_MODEL if settings.AI_ENABLED else None,
        private_repos_allowed=settings.AI_ALLOW_PRIVATE_REPOS,
    )


@router.post("/scans/{scan_id}/findings/{finding_id}/explain", response_model=FindingExplanationResponse)
def explain_scan_finding(
    scan_id: str,
    finding_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scan = _owned_scan(db, scan_id, current_user.id)
    finding = (
        db.query(SecurityFinding)
        .filter(SecurityFinding.id == finding_id, SecurityFinding.scan_id == scan.id)
        .first()
    )
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")

    result, ctx = explain_finding(db, scan, finding)
    return FindingExplanationResponse(
        status=result.status,
        reason=result.reason,
        cached=result.cached,
        model=result.model,
        prompt_version=result.prompt_version,
        scan_id=scan.id,
        finding_id=finding.id,
        commit_sha=scan.commit_sha,
        code_source=ctx.code.source if ctx.code else None,
        code_symbol=ctx.code.symbol_name if ctx.code else None,
        explanation=result.payload,
    )


@router.post("/scans/{scan_id}/ai-summary", response_model=ScanSummaryResponse)
def summarize_owned_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scan = _owned_scan(db, scan_id, current_user.id)
    if scan.status not in ("COMPLETED", "PARTIAL"):
        raise HTTPException(status_code=409, detail="A summary is only available for a finished scan.")

    result, contexts, ref_map = summarize_scan(db, scan)
    return ScanSummaryResponse(
        status=result.status,
        reason=result.reason,
        cached=result.cached,
        model=result.model,
        prompt_version=result.prompt_version,
        scan_id=scan.id,
        commit_sha=scan.commit_sha,
        refs={ctx.ref: SummaryRef(finding_id=ref_map[ctx.ref], title=ctx.title, severity=ctx.severity)
              for ctx in contexts},
        summary=result.payload,
    )
