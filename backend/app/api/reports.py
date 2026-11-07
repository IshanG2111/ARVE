"""Authenticated API endpoints for ARVE security reports and exports."""
from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import Project, Scan, ScanReport, User
from app.reports.generator import ReportGenerator
from app.reports.schemas import ScanReportData

logger = logging.getLogger(__name__)

router = APIRouter(tags=["reports"])


def _get_user_scan(db: Session, scan_id: str, user_id: str) -> Scan:
    """Ensure scan exists and belongs to the authenticated user's project."""
    scan = (
        db.query(Scan)
        .join(Project, Project.id == Scan.project_id)
        .filter(Scan.id == scan_id, Project.user_id == user_id)
        .first()
    )
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.get("/scans/{scan_id}/report", response_model=ScanReportData)
def get_scan_report(
    scan_id: str,
    generate_if_missing: bool = Query(False, description="Whether to automatically generate if report does not exist"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the unified security assessment report for a scan.
    
    If no report has been generated yet for this scan and generate_if_missing is False,
    returns 404 REPORT_NOT_GENERATED so the client can present an explicit generation UI.
    """
    scan = _get_user_scan(db, scan_id, current_user.id)
    if scan.status in {"QUEUED", "RUNNING", "NORMALIZING"}:
        raise HTTPException(
            status_code=400,
            detail=f"Report cannot be generated while scan status is {scan.status}. Await completion.",
        )

    # 1. Check if report is already persisted
    existing = db.query(ScanReport).filter(ScanReport.scan_id == str(scan_id)).first()
    if existing and existing.report_json:
        try:
            report_dict = json.loads(existing.report_json)
            return ScanReportData.model_validate(report_dict)
        except Exception as exc:
            logger.warning("Corrupt persisted report for scan %s: %s; re-evaluating", scan_id, exc)

    # 2. If not persisted and auto-generation not requested, signal that user action is required
    if not generate_if_missing:
        raise HTTPException(
            status_code=404,
            detail="REPORT_NOT_GENERATED",
        )

    generator = ReportGenerator(db)
    report_data, _ = generator.get_or_create_persisted_report(scan_id, force_refresh=False)
    return report_data


@router.post(
    "/scans/{scan_id}/report/generate",
    response_model=ScanReportData,
    status_code=status.HTTP_200_OK,
)
def generate_scan_report(
    scan_id: str,
    force_refresh: bool = Query(False, description="Force re-generation of AI summary and report"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate or reuse a security assessment report."""
    scan = _get_user_scan(db, scan_id, current_user.id)
    if scan.status in {"QUEUED", "RUNNING", "NORMALIZING"}:
        raise HTTPException(
            status_code=400,
            detail=f"Scan is currently {scan.status}. Reports can only be generated for completed scans.",
        )

    generator = ReportGenerator(db)
    report_data, _ = generator.get_or_create_persisted_report(scan_id, force_refresh=force_refresh)
    return report_data


@router.get("/scans/{scan_id}/report/download")
def download_scan_report(
    scan_id: str,
    format: str = Query("pdf", pattern="^(pdf|md)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download the assessment report formatted as PDF or Markdown."""
    scan = _get_user_scan(db, scan_id, current_user.id)
    if scan.status in {"QUEUED", "RUNNING", "NORMALIZING"}:
        raise HTTPException(
            status_code=400,
            detail=f"Scan status is {scan.status}. Cannot download report before scan completes.",
        )

    generator = ReportGenerator(db)
    short_id = scan.id[:8]

    if format.lower() == "pdf":
        pdf_bytes = generator.export_pdf(scan_id)
        filename = f"ARVE_Security_Report_{short_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
    elif format.lower() == "md":
        md_text = generator.export_markdown(scan_id)
        filename = f"ARVE_Security_Report_{short_id}.md"
        return Response(
            content=md_text.encode("utf-8"),
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid format specified. Must be 'pdf' or 'md'.")
