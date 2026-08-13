from typing import List
from fastapi import APIRouter, Depends
import httpx
from app.models.models import User
from app.schemas.schemas import GitHubRepo
from app.api.deps import get_current_user

router = APIRouter(prefix="/github", tags=["github"])



@router.get("/repos", response_model=List[GitHubRepo])
async def list_github_repositories(
    current_user: User = Depends(get_current_user)
):
    """
    Returns GitHub repositories for the authenticated user.
    If authenticated via GitHub OAuth, queries GitHub REST API.
    Otherwise, returns sample repositories for seamless project creation.
    """
    if current_user.github_access_token and current_user.github_access_token != "mock_github_access_token_123":
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.github.com/user/repos?sort=updated&per_page=30",
                headers={"Authorization": f"Bearer {current_user.github_access_token}"}
            )
            if resp.status_code == 200:
                repos = resp.json()
                return [
                    GitHubRepo(
                        id=str(r["id"]),
                        name=r["name"],
                        full_name=r["full_name"],
                        html_url=r["html_url"],
                        default_branch=r.get("default_branch", "main"),
                        private=r.get("private", False),
                        updated_at=r.get("updated_at", ""),
                        language=r.get("language"),
                        description=r.get("description")
                    )
                    for r in repos
                ]

    # Sample/Demo repositories for instant selection
    login = current_user.github_login or current_user.email.split("@")[0]
    return [
        GitHubRepo(
            id="101",
            name="arve-sec-demo-app",
            full_name=f"{login}/arve-sec-demo-app",
            html_url=f"https://github.com/{login}/arve-sec-demo-app",
            default_branch="main",
            language="TypeScript",
            description="Next.js e-commerce app requiring security verification"
        ),
        GitHubRepo(
            id="102",
            name="fintech-api-gateway",
            full_name=f"{login}/fintech-api-gateway",
            html_url=f"https://github.com/{login}/fintech-api-gateway",
            default_branch="main",
            language="Python",
            description="FastAPI microservices gateway for financial transactions"
        ),
        GitHubRepo(
            id="103",
            name="auth-portal-v2",
            full_name=f"{login}/auth-portal-v2",
            html_url=f"https://github.com/{login}/auth-portal-v2",
            default_branch="main",
            language="JavaScript",
            description="Identity and access management portal"
        ),
    ]


@router.get("/branches")
async def get_branches_by_full_name(
    full_name: str,
    current_user: User = Depends(get_current_user),
):
    """
    Returns branches for a given repo full_name (owner/repo).
    Used by the wizard before the repository is persisted in the DB.
    """
    from app.schemas.schemas import BranchResponse
    token = current_user.github_access_token
    is_real = token and token != "mock_github_access_token_123"

    if is_real and full_name:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{full_name}/branches?per_page=50",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                return [
                    BranchResponse(name=b["name"], protected=b.get("protected", False))
                    for b in resp.json()
                ]

    # Demo fallback
    return [
        BranchResponse(name="main", protected=True),
        BranchResponse(name="develop", protected=False),
        BranchResponse(name="staging", protected=False),
    ]
