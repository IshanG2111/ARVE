from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.models import User
from app.schemas.schemas import BranchResponse

router = APIRouter(prefix="/github", tags=["github"])


@router.get("/branches", response_model=List[BranchResponse])
async def get_branches_by_full_name(
    full_name: str,
    current_user: User = Depends(get_current_user),
):
    """Return branches for a repository before it is stored on a Project."""
    if not full_name or "/" not in full_name:
        raise HTTPException(status_code=400, detail="Repository must be in owner/name format")

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
            f"https://api.github.com/repos/{full_name}/branches?per_page=50",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )

    if response.status_code in {401, 403}:
        raise HTTPException(status_code=403, detail="GitHub access to this repository was denied")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="GitHub repository not found or not accessible")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Unable to retrieve GitHub branches")

    return [
        BranchResponse(name=item["name"], protected=item.get("protected", False))
        for item in response.json()
    ]
