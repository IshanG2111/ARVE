"""
Ingestion API Endpoints.
POST /repositories/{id}/ingest         — Trigger repository ingestion
GET  /analysis-runs/{run_id}           — Check ingestion status & counters
GET  /analysis-runs/{run_id}/summary   — Language breakdown & file stats
GET  /analysis-runs/{run_id}/files     — List ingested/skipped files
GET  /repositories/{id}/analysis-runs  — List all runs for a repository
"""
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.models.models import User, Repository, AnalysisRun, RepositoryFile
from app.schemas.schemas import (
    AnalysisRunCreate,
    AnalysisRunResponse,
    RepositoryFileResponse,
    IngestionSummaryResponse,
)
from app.api.deps import get_current_user
from app.ingestion.service import IngestionService, run_ingestion_background

router = APIRouter(tags=["ingestion"])


@router.post("/repositories/{repo_id}/ingest", response_model=AnalysisRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_repository_ingestion(
    repo_id: str,
    payload: Optional[AnalysisRunCreate] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Trigger repository ingestion against the real GitHub API.
    Requires the authenticated user to have a valid GitHub access token.
    """
    # Validate GitHub access token exists
    token = current_user.github_access_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="GitHub access token not found. Authenticate via GitHub OAuth first.",
        )

    # Validate repository exists in DB
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    commit_sha = payload.commit_sha if payload else None
    service = IngestionService(db)
    analysis_run = service.create_analysis_run(repository_id=repo.id, commit_sha=commit_sha)

    # Schedule real background ingestion
    background_tasks.add_task(run_ingestion_background, SessionLocal, analysis_run.id, token)

    return analysis_run


@router.get("/analysis-runs/{run_id}", response_model=AnalysisRunResponse)
def get_analysis_run_status(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get status, counters, language breakdown, and timing for an analysis run."""
    run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    return run


@router.get("/analysis-runs/{run_id}/summary", response_model=IngestionSummaryResponse)
def get_analysis_run_summary(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get clean JSON summary — languages, file counts, status."""
    run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")

    languages = json.loads(run.languages_summary) if run.languages_summary else {}

    return IngestionSummaryResponse(
        repository_id=run.repository_id,
        commit_sha=run.commit_sha,
        files_found=run.files_found,
        files_ingested=run.files_ingested,
        files_skipped=run.files_skipped,
        languages=languages,
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
    """List files for an analysis run. Optional status_filter: INGESTED | SKIPPED | FAILED."""
    run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")

    query = db.query(RepositoryFile).filter(RepositoryFile.analysis_run_id == run_id)
    if status_filter:
        query = query.filter(RepositoryFile.status == status_filter.upper())

    return query.all()


@router.get("/repositories/{repo_id}/analysis-runs", response_model=List[AnalysisRunResponse])
def list_repository_analysis_runs(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all historical analysis runs for a repository."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    return (
        db.query(AnalysisRun)
        .filter(AnalysisRun.repository_id == repo_id)
        .order_by(AnalysisRun.started_at.desc())
        .all()
    )
