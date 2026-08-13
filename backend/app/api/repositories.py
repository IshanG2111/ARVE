"""GitHub repository discovery endpoints used by the project wizard.

There is intentionally no Repository ORM/table anymore. A selected repository
is stored directly on its Project because every ARVE project owns one repo.
"""
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.models import User
from app.schemas.schemas import BranchResponse

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.get("/github/list", response_model=List[dict])
async def list_github_repos_for_wizard(
    current_user: User = Depends(get_current_user),
):
    """Return repositories accessible through the Firebase-derived GitHub token."""
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
                "description": "FastAPI gateway for security analysis",
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
