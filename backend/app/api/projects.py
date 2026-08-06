from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User, Project
from app.schemas.schemas import ProjectCreate, ProjectResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("", response_model=List[ProjectResponse])
def get_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    projects = db.query(Project).filter(Project.owner_id == current_user.id).all()
    return projects

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = Project(
        name=project_in.name,
        description=project_in.description,
        owner_id=current_user.id,
        repo_name=project_in.repo_name,
        repo_url=project_in.repo_url,
        repo_id=project_in.repo_id,
        default_branch=project_in.default_branch or "main"
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Automatically add target domain if provided during wizard
    if project_in.target_domain:
        from app.services.verifier import clean_domain
        domain_cleaned = clean_domain(project_in.target_domain)
        if domain_cleaned:
            from app.models.models import TargetWebsite
            target = TargetWebsite(
                project_id=project.id,
                domain=domain_cleaned
            )
            db.add(target)
            db.commit()
            db.refresh(project)

    return project

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return None
