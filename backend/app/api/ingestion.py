"""Project-scoped repository ingestion endpoints."""
import json
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import SessionLocal, get_db
from app.ingestion.service import IngestionService, run_ingestion_background
from app.models.models import AnalysisRun, Project, RepositoryFile, User
from app.schemas.schemas import (
    AnalysisRunCreate,
    AnalysisRunResponse,
    IngestionSummaryResponse,
    RepositoryFileResponse,
)

router = APIRouter(tags=["ingestion"])


def _owned_project(db: Session, project_id: str, user_id: str) -> Project:
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user_id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.repo_name or not project.repo_owner:
        raise HTTPException(status_code=400, detail="Project has no connected GitHub repository")
    return project


@router.post(
    "/projects/{project_id}/ingest",
    response_model=AnalysisRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_project_ingestion(
    project_id: str,
    background_tasks: BackgroundTasks,
    payload: Optional[AnalysisRunCreate] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an ingestion run for the project's pinned repository."""
    project = _owned_project(db, project_id, current_user.id)

    if not current_user.github_access_token:
        raise HTTPException(status_code=403, detail="GitHub access token is unavailable")

    commit_sha = payload.commit_sha if payload else None
    service = IngestionService(db)
    analysis_run = service.create_analysis_run(project_id=project.id, commit_sha=commit_sha)

    background_tasks.add_task(
        run_ingestion_background,
        SessionLocal,
        analysis_run.id,
        current_user.github_access_token,
    )
    return analysis_run


@router.get("/analysis-runs/{run_id}", response_model=AnalysisRunResponse)
def get_analysis_run_status(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(AnalysisRun)
        .join(Project, Project.id == AnalysisRun.project_id)
        .filter(AnalysisRun.id == run_id, Project.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    return run


@router.get("/analysis-runs/{run_id}/summary", response_model=IngestionSummaryResponse)
def get_analysis_run_summary(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(AnalysisRun)
        .join(Project, Project.id == AnalysisRun.project_id)
        .filter(AnalysisRun.id == run_id, Project.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")

    languages = json.loads(run.languages_summary) if run.languages_summary else {}
    return IngestionSummaryResponse(
        project_id=run.project_id,
        commit_sha=run.commit_sha,
        files_found=run.files_found,
        files_ingested=run.files_ingested,
        files_skipped=run.files_skipped,
        languages=languages,
        frameworks=run.frameworks,
        package_manager=run.package_manager,
        status=run.status,
        run_id=run.id,
    )


@router.get("/analysis-runs/{run_id}/files", response_model=List[RepositoryFileResponse])
def list_analysis_run_files(
    run_id: str,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(AnalysisRun)
        .join(Project, Project.id == AnalysisRun.project_id)
        .filter(AnalysisRun.id == run_id, Project.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")

    query = db.query(RepositoryFile).filter(RepositoryFile.analysis_run_id == run_id)
    if status_filter:
        query = query.filter(RepositoryFile.status == status_filter.upper())
    return query.order_by(RepositoryFile.path.asc()).all()


@router.get("/projects/{project_id}/analysis-runs", response_model=List[AnalysisRunResponse])
def list_project_analysis_runs(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_project(db, project_id, current_user.id)
    return (
        db.query(AnalysisRun)
        .filter(AnalysisRun.project_id == project_id)
        .order_by(AnalysisRun.started_at.desc())
        .all()
    )
