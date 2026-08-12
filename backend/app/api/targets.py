from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import Project, TargetWebsite, User
from app.schemas.schemas import TargetCreate, TargetResponse, VerificationResult
from app.services.verifier import clean_domain, verify_domain_ownership

router = APIRouter(tags=["targets"])


def _owned_project(db: Session, project_id: str, user_id: str) -> Project | None:
    return db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user_id,
    ).first()


def _owned_target(db: Session, target_id: str, user_id: str) -> TargetWebsite | None:
    return (
        db.query(TargetWebsite)
        .join(Project, TargetWebsite.project_id == Project.id)
        .filter(
            TargetWebsite.id == target_id,
            Project.user_id == user_id,
        )
        .first()
    )


def _sync_project_verification(project: Project) -> None:
    """Project verification is derived from its current targets."""
    project.verified = any(target.is_verified for target in project.targets)


@router.post(
    "/projects/{project_id}/targets",
    response_model=TargetResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_target(
    project_id: str,
    target_in: TargetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _owned_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        domain_cleaned = clean_domain(target_in.domain)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not domain_cleaned:
        raise HTTPException(status_code=400, detail="Invalid domain specified")

    duplicate = db.query(TargetWebsite).filter(
        TargetWebsite.project_id == project.id,
        TargetWebsite.domain == domain_cleaned,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="This target is already linked to the project")

    target = TargetWebsite(project_id=project.id, domain=domain_cleaned)
    db.add(target)
    try:
        db.commit()
        db.refresh(target)
    except Exception:
        db.rollback()
        raise
    return target


@router.get("/projects/{project_id}/targets", response_model=List[TargetResponse])
def get_targets(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _owned_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.targets


@router.post("/targets/{target_id}/verify", response_model=VerificationResult)
async def verify_target(
    target_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = _owned_target(db, target_id, current_user.id)
    if not target:
        raise HTTPException(status_code=404, detail="Target website not found")

    is_verified, message, checked_url = await verify_domain_ownership(target)

    if is_verified:
        target.is_verified = True
        target.verified_at = datetime.utcnow()
        _sync_project_verification(target.project)
        try:
            db.commit()
            db.refresh(target)
        except Exception:
            db.rollback()
            raise

    return VerificationResult(
        target_id=target.id,
        domain=target.domain,
        is_verified=target.is_verified,
        message=message,
        checked_url=checked_url,
        verified_at=target.verified_at,
    )


@router.delete("/targets/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_target(
    target_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = _owned_target(db, target_id, current_user.id)
    if not target:
        raise HTTPException(status_code=404, detail="Target website not found")

    project = target.project
    db.delete(target)
    try:
        db.flush()
        _sync_project_verification(project)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return None
