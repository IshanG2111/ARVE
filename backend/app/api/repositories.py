"""Repository read/access endpoints."""

from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.models import Project, Repository, User
from app.schemas.schemas import BranchResponse, RepositoryResponse

router = APIRouter(prefix="/repositories", tags=["repositories"])


def _owned_repository_query(db: Session, repo_id: str, user_id: str):
    return (
        db.query(Repository)
        .join(Project, Project.repository_id == Repository.id)
        .filter(Repository.id == repo_id, Project.user_id == user_id)
    )


@router.get("", response_model=List[RepositoryResponse])
def list_repositories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Repository)
        .join(Project, Project.repository_id == Repository.id)
        .filter(Project.user_id == current_user.id)
        .distinct()
        .order_by(Repository.name.asc())
        .all()
    )


@router.get("/{repo_id}", response_model=RepositoryResponse)
def get_repository(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = _owned_repository_query(db, repo_id, current_user.id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


@router.get("/{repo_id}/branches", response_model=List[BranchResponse])
async def list_branches(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = _owned_repository_query(db, repo_id, current_user.id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    token = current_user.github_access_token
    if settings.is_development and token == "mock_github_access_token_123":
        return [
            BranchResponse(name="main", protected=True),
            BranchResponse(name="develop", protected=False),
            BranchResponse(name="staging", protected=False),
        ]

    if not token:
        raise HTTPException(status_code=403, detail="GitHub access token is unavailable")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"https://api.github.com/repos/{repo.full_name}/branches?per_page=50",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )

    if response.status_code in {401, 403}:
        raise HTTPException(status_code=403, detail="GitHub access to this repository was denied")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Unable to retrieve GitHub branches")

    return [
        BranchResponse(name=item["name"], protected=item.get("protected", False))
        for item in response.json()
    ]


@router.get("/github/list", response_model=List[dict])
async def list_github_repos_for_wizard(
    current_user: User = Depends(get_current_user),
):
    """Return repositories accessible through the authenticated GitHub token."""
    token = current_user.github_access_token

    if settings.is_development and token == "mock_github_access_token_123":
        login = current_user.username or current_user.github_login or "user"
        return [
            {
                "id": "101",
                "name": "arve-demo-app",
                "full_name": f"{login}/arve-demo-app",
                "html_url": f"https://github.com/{login}/arve-demo-app",
                "default_branch": "main",
                "private": False,
                "language": "TypeScript",
                "description": "Next.js app requiring security analysis",
                "updated_at": "2026-08-01T00:00:00Z",
            },
            {
                "id": "102",
                "name": "fintech-api",
                "full_name": f"{login}/fintech-api",
                "html_url": f"https://github.com/{login}/fintech-api",
                "default_branch": "main",
                "private": False,
                "language": "Python",
                "description": "FastAPI gateway for financial services",
                "updated_at": "2026-07-28T00:00:00Z",
            },
            {
                "id": "103",
                "name": "auth-portal",
                "full_name": f"{login}/auth-portal",
                "html_url": f"https://github.com/{login}/auth-portal",
                "default_branch": "develop",
                "private": True,
                "language": "JavaScript",
                "description": "Identity and access management portal",
                "updated_at": "2026-07-15T00:00:00Z",
            },
        ]

    if not token:
        raise HTTPException(status_code=403, detail="GitHub access token is unavailable")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            "https://api.github.com/user/repos?sort=updated&per_page=50",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )

    if response.status_code in {401, 403}:
        raise HTTPException(status_code=403, detail="GitHub access was denied")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Unable to retrieve GitHub repositories")

    return [
        {
            "id": str(repo["id"]),
            "name": repo["name"],
            "full_name": repo["full_name"],
            "html_url": repo["html_url"],
            "default_branch": repo.get("default_branch", "main"),
            "private": repo.get("private", False),
            "language": repo.get("language"),
            "description": repo.get("description"),
            "updated_at": repo.get("updated_at", ""),
        }
        for repo in response.json()
    ]
