"""Security Audit Report API. Reports are generated on request from the database."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.scans import _owned_scan
from app.core.database import get_db
from app.models.models import User
from app.reports.builder import ReportNotAvailable, build_report
from app.reports.renderer import ReportRenderError, render_html, render_pdf, report_filename

logger = logging.getLogger(__name__)

router = APIRouter(tags=["reports"])

# The preview is static: no scripts, no external loads, no framing by other sites.
_HTML_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
}


def _report_for(scan_id: str, db: Session, user: User):
    scan = _owned_scan(db, scan_id, user.id)
    try:
        return build_report(db, scan)
    except ReportNotAvailable as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/scans/{scan_id}/report.html", response_class=HTMLResponse)
def get_scan_report_html(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = _report_for(scan_id, db, current_user)
    return HTMLResponse(render_html(report), headers=_HTML_HEADERS)


@router.get("/scans/{scan_id}/report.pdf")
def get_scan_report_pdf(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = _report_for(scan_id, db, current_user)
    try:
        pdf = render_pdf(report)
    except ReportRenderError as exc:
        logger.exception("PDF rendering failed for scan %s", scan_id)
        raise HTTPException(status_code=500, detail="The PDF could not be generated.") from exc
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{report_filename(report, "pdf")}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )
