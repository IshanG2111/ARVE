import httpx
from urllib.parse import urlencode
from app.core.config import settings

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"


def build_authorize_url(state: str) -> str:
    params = {
        "client_id": settings.effective_github_client_id,
        "redirect_uri": settings.effective_github_redirect_uri,
        "scope": settings.effective_github_oauth_scope,
        "state": state,
        "allow_signup": "true",
    }
    return f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code_for_token(code: str) -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GITHUB_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.effective_github_client_id,
                "client_secret": settings.effective_github_client_secret,
                "code": code,
                "redirect_uri": settings.effective_github_redirect_uri,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise ValueError(data.get("error_description", "GitHub token exchange failed"))
        return data["access_token"]


async def fetch_github_user(access_token: str) -> dict:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(GITHUB_USER_URL, headers=headers)
        user_resp.raise_for_status()
        user = user_resp.json()

        # Primary email is often null on /user if it's private
        if not user.get("email"):
            emails_resp = await client.get(GITHUB_EMAILS_URL, headers=headers)
            if emails_resp.status_code == 200:
                emails = emails_resp.json()
                primary = next((e["email"] for e in emails if e.get("primary")), None)
                user["email"] = primary or (emails[0]["email"] if emails else f"{user['login']}@users.noreply.github.com")

        return user
