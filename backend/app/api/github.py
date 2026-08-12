from typing import List
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
import httpx
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core import security
from app.models.models import User
from app.schemas.schemas import Token, GitHubRepo
from app.api.deps import get_current_user

router = APIRouter(prefix="/github", tags=["github"])

class GitHubAuthCallback(BaseModel):
    code: str
    state: str | None = None
    is_mock: bool = False

@router.get("/auth-url")
def get_github_auth_url():
    url = f"https://github.com/login/oauth/authorize?client_id={settings.github_client_id}&scope=user,repo&redirect_uri={settings.github_redirect_uri}"
    return {
        "auth_url": url,
        "client_id": settings.github_client_id,
        "is_configured": settings.github_client_id != "arve_demo_client_id"
    }

@router.post("/callback", response_model=Token)
async def github_callback(
    payload: GitHubAuthCallback,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    expected_state = request.cookies.get("oauth_state")
    if not expected_state or not payload.state or not secrets.compare_digest(payload.state, expected_state):
        raise HTTPException(status_code=400, detail="Invalid or missing OAuth state")

    is_mock = settings.is_development and (payload.is_mock or payload.code == "mock_github_code")
    if is_mock:
        # Demo mode login when no real GitHub App secret is configured
        gh_user = {
            "id": "gh_10293847",
            "login": "octocat-dev",
            "email": "octocat@github.com",
            "name": "Octocat Security Tester",
            "avatar_url": "https://avatars.githubusercontent.com/u/583231?v=4"
        }
        access_token_gh = "mock_github_access_token_123"
    else:
        if payload.is_mock or payload.code == "mock_github_code":
            raise HTTPException(status_code=400, detail="Mock GitHub authentication is disabled outside development")
        # Real GitHub OAuth token exchange
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": payload.code,
                    "redirect_uri": settings.github_redirect_uri,
                }
            )
            token_data = token_resp.json()
            if "error" in token_data:
                raise HTTPException(status_code=400, detail=token_data.get("error_description", "GitHub Auth Failed"))
            
            access_token_gh = token_data.get("access_token")
            
            # Fetch user profile from GitHub
            user_resp = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token_gh}"}
            )
            if user_resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch GitHub profile")
            
            gh_data = user_resp.json()
            
            # Fetch user email if private
            email = gh_data.get("email")
            if not email:
                emails_resp = await client.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"Bearer {access_token_gh}"}
                )
                if emails_resp.status_code == 200:
                    emails = emails_resp.json()
                    primary_email = next((e["email"] for e in emails if e.get("primary")), None)
                    email = primary_email or (emails[0]["email"] if emails else f"{gh_data['login']}@users.noreply.github.com")

            gh_user = {
                "id": str(gh_data["id"]),
                "login": gh_data["login"],
                "email": email or f"{gh_data['login']}@users.noreply.github.com",
                "name": gh_data.get("name") or gh_data["login"],
                "avatar_url": gh_data.get("avatar_url")
            }

    gh_id_str = str(gh_user["id"])
    email = gh_user.get("email") or f"{gh_user['login']}@users.noreply.github.com"
    login = gh_user["login"]
    avatar = gh_user.get("avatar_url")

    # Find or create user in DB
    user = db.query(User).filter((User.github_id == gh_id_str) | (User.email == email)).first()
    if not user:
        user = User(
            email=email,
            full_name=gh_user.get("name") or login,
            github_id=gh_id_str,
            github_login=login,
            github_avatar=avatar,
            username=login,
            avatar_url=avatar,
            github_access_token=access_token_gh,
        )
        db.add(user)
    else:
        user.github_id = gh_id_str
        user.github_login = login
        user.github_avatar = avatar
        user.username = login
        user.avatar_url = avatar
        user.github_access_token = access_token_gh

    db.commit()
    db.refresh(user)

    jwt_token = security.create_access_token(subject=user.id)
    response.set_cookie(
        "access_token",
        jwt_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.effective_jwt_expire_minutes * 60,
    )
    response.delete_cookie("oauth_state", path="/")
    return {"access_token": jwt_token, "token_type": "bearer"}


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

    if not (settings.is_development and current_user.github_access_token == "mock_github_access_token_123"):
        raise HTTPException(status_code=403, detail="GitHub repository access is unavailable")

    # Development-only sample repositories
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
    is_real = bool(token and token != "mock_github_access_token_123")

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

    if not (settings.is_development and token == "mock_github_access_token_123"):
        raise HTTPException(status_code=403, detail="GitHub branch access is unavailable")

    # Development-only fallback
    return [
        BranchResponse(name="main", protected=True),
        BranchResponse(name="develop", protected=False),
        BranchResponse(name="staging", protected=False),
    ]
