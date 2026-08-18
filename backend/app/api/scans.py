"""Scan orchestration API."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import Project, Scan, ScanEngineRun, User
from app.scanner.exceptions import ScanValidationError
from app.scanner.queue import enqueue_scan
from app.scanner.service import ScanExecutionService
from app.schemas.schemas import ScanCreate, ScanEngineRunResponse, ScanResponse, ScanStatusResponse

router = APIRouter(tags=["scans"])


def _owned_scan(db: Session, scan_id: str, user_id: str) -> Scan:
    scan = (
        db.query(Scan)
        .join(Project, Project.id == Scan.project_id)
        .filter(Scan.id == scan_id, Project.user_id == user_id)
        .first()
    )
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.post(
    "/projects/{project_id}/scan",
    response_model=ScanResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_project_scan(
    project_id: str,
    background_tasks: BackgroundTasks,
    payload: ScanCreate | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        project = (
            db.query(Project)
            .filter(Project.id == project_id, Project.user_id == current_user.id)
            .first()
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        service = ScanExecutionService(db)
        scan = service.create_scan(project_id, payload.analysis_run_id if payload else None)
        try:
            enqueue_scan(scan.id, background_tasks)
        except Exception as exc:
            # A scan must never remain QUEUED when the configured queue cannot
            # accept it. Mark it failed before returning the infrastructure error.
            db.rollback()
            failed = db.query(Scan).filter(Scan.id == scan.id).first()
            if failed and failed.status == "QUEUED":
                failed.status = "FAILED"
                failed.current_stage = "Queue submission failed"
                failed.error_message = str(exc)
                failed.completed_at = __import__("datetime").datetime.utcnow()
                db.commit()
            raise HTTPException(status_code=503, detail=f"Scan queue unavailable: {exc}") from exc
        return scan
    except ScanValidationError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/scans/{scan_id}/status", response_model=ScanStatusResponse)
def get_scan_status(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scan = _owned_scan(db, scan_id, current_user.id)
    engine_runs = (
        db.query(ScanEngineRun)
        .filter(ScanEngineRun.scan_id == scan.id)
        .order_by(ScanEngineRun.started_at.asc())
        .all()
    )
    return ScanStatusResponse.from_scan(
        scan,
        engine_statuses={run.engine_name: run.status for run in engine_runs},
        engine_runs=engine_runs,
    )


@router.post("/scans/{scan_id}/cancel", response_model=ScanResponse)
def cancel_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_scan(db, scan_id, current_user.id)
    try:
        return ScanExecutionService(db).cancel_scan(scan_id)
    except ScanValidationError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/projects/{project_id}/scans", response_model=List[ScanResponse])
def list_project_scans(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(Scan).filter(Scan.project_id == project_id).order_by(Scan.created_at.desc()).all()
