from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import User, Project, Repository
from app.schemas.schemas import ProjectCreate, ProjectUpdate, ProjectResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[ProjectResponse])
def get_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = db.query(Project).filter(Project.user_id == current_user.id).all()
    return projects


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ── Resolve or create Repository record ─────────────────────────────────
    repository_id = project_in.repository_id

    if not repository_id and project_in.repo_id:
        # Check if we already have this repo stored
        existing = db.query(Repository).filter(
            Repository.github_repo_id == project_in.repo_id
        ).first()

        if existing:
            repository_id = existing.id
        else:
            # Create a new Repository record from wizard passthrough data
            full_name = project_in.repo_name or ""
            parts = full_name.split("/")
            owner = parts[0] if len(parts) > 1 else current_user.username or "unknown"
            name = parts[-1] if parts else full_name

            new_repo = Repository(
                github_repo_id=project_in.repo_id,
                owner=owner,
                name=name,
                full_name=full_name,
                html_url=project_in.repo_url,
                default_branch=project_in.default_branch or project_in.branch or "main",
                language=None,
                description=project_in.description,
                private=False,
            )
            db.add(new_repo)
            db.flush()
            repository_id = new_repo.id

    # ── Derive a display name ────────────────────────────────────────────────
    name = project_in.name or (project_in.repo_name or "").split("/")[-1] or "Untitled"

    dep_url = project_in.deployment_url.strip() if project_in.deployment_url and project_in.deployment_url.strip() else None
    target_url = dep_url or getattr(project_in, "target_domain", None)

    project = Project(
        user_id=current_user.id,
        owner_id=current_user.id,      # legacy alias
        repository_id=repository_id,
        branch=project_in.branch or project_in.default_branch or "main",
        deployment_url=target_url,
        verified=False,
        # legacy passthrough fields
        name=name,
        description=project_in.description,
        repo_name=project_in.repo_name,
        repo_url=project_in.repo_url,
        repo_id=project_in.repo_id,
        default_branch=project_in.default_branch or project_in.branch or "main",
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # ── Legacy: auto-create TargetWebsite if domain / deployment URL supplied ────────────────
    if target_url:
        try:
            from app.services.verifier import clean_domain
            domain_cleaned = clean_domain(target_url)
        except Exception:
            domain_cleaned = target_url

        if domain_cleaned:
            from app.models.models import TargetWebsite
            target = TargetWebsite(project_id=project.id, domain=domain_cleaned)
            db.add(target)
            db.commit()
            db.refresh(project)

    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project_in.name is not None:
        project.name = project_in.name
    if project_in.description is not None:
        project.description = project_in.description
    if project_in.branch is not None:
        project.branch = project_in.branch
        project.default_branch = project_in.branch
    if project_in.deployment_url is not None:
        project.deployment_url = project_in.deployment_url
    if project_in.verified is not None:
        project.verified = project_in.verified

    db.commit()
    db.refresh(project)
    return project



@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return None
