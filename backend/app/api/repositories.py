"""
Repository endpoints — Sprint 1.
GET  /repositories            — list repositories for authenticated user
GET  /repositories/{id}       — get single repository by internal ID
GET  /repositories/{id}/branches — list branches from GitHub API
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
import httpx
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, Repository
from app.schemas.schemas import RepositoryResponse, BranchResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.get("", response_model=List[RepositoryResponse])
def list_repositories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all Repository records that belong to projects owned by
    the current user, de-duplicated by github_repo_id.
    If the user has connected repositories via the wizard those appear here.
    """
    # Collect unique repos linked to this user's projects
    from app.models.models import Project
    projects = db.query(Project).filter(Project.user_id == current_user.id).all()
    repo_ids = {p.repository_id for p in projects if p.repository_id}
    repos = db.query(Repository).filter(Repository.id.in_(repo_ids)).all()
    return repos


@router.get("/{repo_id}", response_model=RepositoryResponse)
def get_repository(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


@router.get("/{repo_id}/branches", response_model=List[BranchResponse])
async def list_branches(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Proxy GitHub API to return available branches for the repository.
    Falls back to [main, develop] demo list if no real token is configured.
    """
    repo = db.query(Repository).filter(Repository.id == repo_id).first()

    # GitHub API branch list via full_name
    full_name = None
    if repo:
        full_name = repo.full_name

    token = current_user.github_access_token
    is_real_token = token and token != "mock_github_access_token_123"

    if full_name and is_real_token:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{full_name}/branches?per_page=50",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                return [
                    BranchResponse(
                        name=b["name"],
                        protected=b.get("protected", False),
                    )
                    for b in resp.json()
                ]

    # Demo / fallback branches
    return [
        BranchResponse(name="main", protected=True),
        BranchResponse(name="develop", protected=False),
        BranchResponse(name="staging", protected=False),
    ]


@router.get("/github/list", response_model=List[dict])
async def list_github_repos_for_wizard(
    current_user: User = Depends(get_current_user),
):
    """
    Return GitHub repos for the wizard repo-picker (raw GitHub API passthrough).
    """
    token = current_user.github_access_token
    login = current_user.username or current_user.github_login or "user"

    if token and token != "mock_github_access_token_123":
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.github.com/user/repos?sort=updated&per_page=50",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                return [
                    {
                        "id": str(r["id"]),
                        "name": r["name"],
                        "full_name": r["full_name"],
                        "html_url": r["html_url"],
                        "default_branch": r.get("default_branch", "main"),
                        "private": r.get("private", False),
                        "language": r.get("language"),
                        "description": r.get("description"),
                        "updated_at": r.get("updated_at", ""),
                    }
                    for r in resp.json()
                ]

    # Demo repos
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
