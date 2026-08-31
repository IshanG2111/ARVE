"""Scan orchestration API."""
from __future__ import annotations

import json
import logging
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import Project, Scan, ScanEngineRun, SecurityFinding, User
from app.scanner.artifacts import ScanArtifactStore
from app.scanner.exceptions import ScanValidationError
from app.scanner.queue import enqueue_scan
from app.scanner.service import ScanExecutionService

logger = logging.getLogger(__name__)
from app.schemas.schemas import (
    ScanCreate,
    ScanEngineRunResponse,
    ScanResponse,
    ScanStatusResponse,
    SecurityFindingResponse,
    SecurityFindingStatusUpdate,
)

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


@router.get("/projects/{project_id}/findings", response_model=List[SecurityFindingResponse])
def list_project_findings(
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
    return (
        db.query(SecurityFinding)
        .filter(SecurityFinding.project_id == project_id)
        .order_by(SecurityFinding.created_at.desc())
        .all()
    )


@router.get("/scans/{scan_id}/findings", response_model=List[SecurityFindingResponse])
def list_scan_findings(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scan = _owned_scan(db, scan_id, current_user.id)
    return (
        db.query(SecurityFinding)
        .filter(SecurityFinding.scan_id == scan.id)
        .order_by(SecurityFinding.created_at.desc())
        .all()
    )


@router.patch("/findings/{finding_id}/status", response_model=SecurityFindingResponse)
def update_finding_status(
    finding_id: str,
    payload: SecurityFindingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = (
        db.query(SecurityFinding)
        .join(Project, Project.id == SecurityFinding.project_id)
        .filter(SecurityFinding.id == finding_id, Project.user_id == current_user.id)
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    valid_statuses = {"OPEN", "ACKNOWLEDGED", "SUPPRESSED", "RESOLVED", "REOPENED"}
    target_status = payload.status.strip().upper()
    if target_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid finding status: {payload.status}")

    finding.status = target_status
    if payload.suppression_reason is not None:
        finding.suppression_reason = payload.suppression_reason
    if payload.suppression_justification is not None:
        finding.suppression_justification = payload.suppression_justification
    if payload.suppression_expires_at is not None:
        finding.suppression_expires_at = payload.suppression_expires_at

    db.commit()
    db.refresh(finding)
    return finding


@router.get("/scans/{scan_id}/engines/{engine_name}/artifact")
def get_engine_artifact(
    scan_id: str,
    engine_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scan = _owned_scan(db, scan_id, current_user.id)
    engine_run = (
        db.query(ScanEngineRun)
        .filter(ScanEngineRun.scan_id == scan.id, ScanEngineRun.engine_name == engine_name)
        .first()
    )
    if not engine_run:
        raise HTTPException(status_code=404, detail="Engine run not found")

    # If artifact is in Backblaze B2, attempt direct fetch
    if engine_run.artifact_reference:
        try:
            store = ScanArtifactStore()
            client = store._get_client()
            for cand_filename in (f"{engine_name}.json", "osv.json"):
                object_key = f"{store.prefix}/{scan.id}/{engine_name}/{cand_filename}"
                try:
                    resp = client.get_object(Bucket=store.bucket, Key=object_key)
                    content = resp["Body"].read().decode("utf-8")
                    return json.loads(content)
                except Exception:
                    continue
        except Exception as exc:
            logger.debug("Failed to fetch from B2: %s", exc)

    # Fallback to findings raw_json for audit inspection
    findings = (
        db.query(SecurityFinding)
        .filter(SecurityFinding.scan_id == scan.id, SecurityFinding.engine == engine_name)
        .all()
    )
    if findings:
        raw_list = []
        for f in findings:
            if f.raw_json:
                try:
                    raw_list.append(json.loads(f.raw_json) if isinstance(f.raw_json, str) else f.raw_json)
                except Exception:
                    raw_list.append({"title": f.title, "raw": f.raw_json})
        return {
            "scan_id": scan.id,
            "engine": engine_name,
            "artifact_reference": engine_run.artifact_reference,
            "results": raw_list,
        }

    return {
        "scan_id": scan.id,
        "engine": engine_name,
        "artifact_reference": engine_run.artifact_reference,
        "status": engine_run.status,
        "message": "No raw artifact findings available for this engine run.",
    }
