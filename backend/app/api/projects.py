from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.models import Project, Repository, TargetWebsite, User
from app.schemas.schemas import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.verifier import clean_domain

router = APIRouter(prefix="/projects", tags=["projects"])


async def _fetch_github_repository(current_user: User, repository) -> dict:
    """Verify the selected GitHub repository belongs to the authenticated user."""
    token = current_user.github_access_token
    if settings.is_development and token == "mock_github_access_token_123":
        return {
            "id": repository.github_repo_id,
            "owner": repository.owner,
            "name": repository.name,
            "full_name": repository.full_name,
            "html_url": repository.html_url,
            "default_branch": repository.default_branch,
            "language": repository.language,
            "description": repository.description,
            "private": repository.private,
        }

    if not token:
        raise HTTPException(status_code=403, detail="GitHub access is required to connect a repository")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"https://api.github.com/repos/{repository.full_name}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="GitHub repository not found or not accessible")
    if response.status_code in {401, 403}:
        raise HTTPException(status_code=403, detail="GitHub access to this repository was denied")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="GitHub repository verification failed")

    return response.json()


def _repository_from_github_data(data: dict) -> dict:
    owner_data = data.get("owner")
    owner = owner_data.get("login") if isinstance(owner_data, dict) else owner_data
    full_name = data.get("full_name") or ""
    return {
        "github_repo_id": str(data["id"]),
        "owner": owner or full_name.split("/", 1)[0],
        "name": data.get("name") or full_name.split("/")[-1],
        "full_name": full_name,
        "html_url": data.get("html_url"),
        "default_branch": data.get("default_branch") or "main",
        "language": data.get("language"),
        "description": data.get("description"),
        "private": bool(data.get("private", False)),
    }


def _get_project_query(db: Session, project_id: str, user_id: str):
    return (
        db.query(Project)
        .options(
            selectinload(Project.repository),
            selectinload(Project.targets),
            selectinload(Project.scans),
        )
        .filter(Project.id == project_id, Project.user_id == user_id)
    )


@router.get("", response_model=List[ProjectResponse])
def get_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Project)
        .options(
            selectinload(Project.repository),
            selectinload(Project.targets),
            selectinload(Project.scans),
        )
        .filter(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
        .all()
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a project and all immediately-owned records atomically."""
    try:
        repository: Optional[Repository] = None

        if project_in.repository_id:
            # An internal repository ID is only valid if this user already has
            # a project referencing it. This prevents ID-based cross-user access.
            repository = (
                db.query(Repository)
                .join(Project, Project.repository_id == Repository.id)
                .filter(
                    Repository.id == project_in.repository_id,
                    Project.user_id == current_user.id,
                )
                .first()
            )
            if not repository:
                raise HTTPException(status_code=404, detail="Repository not found")

        elif project_in.repository:
            # Never trust the browser's repository metadata for authorization.
            verified_data = await _fetch_github_repository(current_user, project_in.repository)
            normalized = _repository_from_github_data(verified_data)

            repository = (
                db.query(Repository)
                .filter(Repository.github_repo_id == normalized["github_repo_id"])
                .first()
            )

            if repository:
                # Refresh metadata from the authoritative GitHub response.
                for field, value in normalized.items():
                    setattr(repository, field, value)
            else:
                repository = Repository(**normalized)
                db.add(repository)
                db.flush()

        project_name = (project_in.name or "").strip()
        if not project_name:
            project_name = repository.name if repository else "Untitled project"

        branch = (project_in.branch or (repository.default_branch if repository else "main")).strip()
        if not branch:
            branch = "main"

        deployment_url = project_in.deployment_url.strip() if project_in.deployment_url else None
        target_domain = clean_domain(deployment_url) if deployment_url else None
        if deployment_url and not target_domain:
            raise HTTPException(status_code=400, detail="Invalid deployment URL")

        project = Project(
            user_id=current_user.id,
            repository_id=repository.id if repository else None,
            name=project_name,
            description=project_in.description,
            branch=branch,
            deployment_url=deployment_url,
            verified=False,
        )
        db.add(project)
        db.flush()

        if target_domain:
            db.add(TargetWebsite(project_id=project.id, domain=target_domain))

        db.commit()

        project = _get_project_query(db, project.id, current_user.id).first()
        return project

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="The project could not be created because of a database constraint")
    except Exception:
        db.rollback()
        raise


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_query(db, project_id, current_user.id).first()
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
    project = _get_project_query(db, project_id, current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    values = project_in.model_dump(exclude_unset=True)

    if "name" in values:
        name = (values["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Project name cannot be empty")
        project.name = name

    if "description" in values:
        project.description = values["description"]

    if "branch" in values:
        branch = (values["branch"] or "").strip()
        if not branch:
            raise HTTPException(status_code=400, detail="Branch cannot be empty")
        project.branch = branch

    if "deployment_url" in values:
        deployment_url = values["deployment_url"]
        deployment_url = deployment_url.strip() if deployment_url else None
        if deployment_url and not clean_domain(deployment_url):
            raise HTTPException(status_code=400, detail="Invalid deployment URL")
        project.deployment_url = deployment_url

    try:
        db.commit()
        project = _get_project_query(db, project_id, current_user.id).first()
        return project
    except Exception:
        db.rollback()
        raise


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        # Targets and scans cascade from Project. Repository intentionally remains
        # because it is a reusable GitHub resource and may be referenced elsewhere.
        db.delete(project)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return None
