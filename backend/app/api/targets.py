from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User, Project, TargetWebsite
from app.schemas.schemas import TargetCreate, TargetResponse, VerificationResult
from app.api.deps import get_current_user
from app.services.verifier import verify_domain_ownership, clean_domain

router = APIRouter(tags=["targets"])

@router.post("/projects/{project_id}/targets", response_model=TargetResponse, status_code=status.HTTP_201_CREATED)
def add_target(
    project_id: str,
    target_in: TargetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    domain_cleaned = clean_domain(target_in.domain)
    if not domain_cleaned:
        raise HTTPException(status_code=400, detail="Invalid domain specified")

    target = TargetWebsite(
        project_id=project_id,
        domain=domain_cleaned
    )
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


@router.get("/projects/{project_id}/targets", response_model=List[TargetResponse])
def get_targets(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return project.targets


@router.post("/targets/{target_id}/verify", response_model=VerificationResult)
async def verify_target(
    target_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target = db.query(TargetWebsite).join(Project).filter(
        TargetWebsite.id == target_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not target:
        raise HTTPException(status_code=404, detail="Target website not found")

    is_verified, message, checked_url = await verify_domain_ownership(target)
    
    if is_verified:
        target.is_verified = True
        target.verified_at = datetime.utcnow()
        db.commit()
        db.refresh(target)

    return VerificationResult(
        target_id=target.id,
        domain=target.domain,
        is_verified=is_verified,
        message=message,
        checked_url=checked_url,
        verified_at=target.verified_at
    )


@router.delete("/targets/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_target(
    target_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target = db.query(TargetWebsite).join(Project).filter(
        TargetWebsite.id == target_id,
        Project.owner_id == current_user.id
    ).first()

    if not target:
        raise HTTPException(status_code=404, detail="Target website not found")

    db.delete(target)
    db.commit()
    return None
