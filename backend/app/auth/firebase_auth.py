import json
import logging
from typing import Any, Dict

import httpx
import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)
_GOOGLE_PUBLIC_KEYS: Dict[str, str] = {}

try:
    import firebase_admin
    from firebase_admin import auth as fb_auth, credentials

    if not firebase_admin._apps:
        if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
            cred_dict = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
            firebase_admin.initialize_app(credentials.Certificate(cred_dict))
        elif settings.FIREBASE_CREDENTIALS_PATH:
            firebase_admin.initialize_app(credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH))
        elif settings.effective_firebase_project_id:
            firebase_admin.initialize_app(options={"projectId": settings.effective_firebase_project_id})
        else:
            firebase_admin.initialize_app()
    FIREBASE_ADMIN_AVAILABLE = True
except Exception as exc:
    logger.warning("Firebase Admin SDK not initialized: %s", exc)
    FIREBASE_ADMIN_AVAILABLE = False


async def get_google_public_keys() -> Dict[str, str]:
    global _GOOGLE_PUBLIC_KEYS
    if not _GOOGLE_PUBLIC_KEYS:
        url = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            _GOOGLE_PUBLIC_KEYS = response.json()
    return _GOOGLE_PUBLIC_KEYS


async def verify_firebase_token(id_token: str) -> Dict[str, Any]:
    """Verify a Firebase ID token; never trust an unverified JWT payload."""
    if settings.is_development and (id_token.startswith("mock_firebase_token_") or id_token.startswith("mock_firebase_")):
        is_fixed = id_token == "mock_firebase_token_test123"
        return {
            "uid": f"firebase_uid_{id_token}",
            "email": "octocat@github.com" if is_fixed else f"{id_token}@example.com",
            "name": "Octocat Security Tester",
            "picture": "https://avatars.githubusercontent.com/u/583231?v=4",
            "github_username": "octocat-dev",
            "github_id": "10293847" if is_fixed else f"gh_{id_token}",
        }

    if FIREBASE_ADMIN_AVAILABLE:
        try:
            decoded_token = fb_auth.verify_id_token(id_token)
            return {
                "uid": decoded_token.get("uid"),
                "email": decoded_token.get("email"),
                "name": decoded_token.get("name"),
                "picture": decoded_token.get("picture"),
                "github_username": decoded_token.get("firebase", {}).get("identities", {}).get("github.com", [None])[0],
            }
        except Exception as exc:
            logger.debug("Firebase Admin verification failed: %s", exc)

    try:
        header = jwt.get_unverified_header(id_token)
        kid = header.get("kid")
        if not kid:
            raise ValueError("Firebase token is missing key ID")

        keys = await get_google_public_keys()
        cert_str = keys.get(kid)
        if not cert_str:
            raise ValueError("Firebase signing key was not found")

        project_id = settings.effective_firebase_project_id
        decoded = jwt.decode(
            id_token,
            key=cert_str,
            algorithms=["RS256"],
            audience=project_id if project_id else None,
            issuer=f"https://securetoken.google.com/{project_id}" if project_id else None,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": bool(project_id),
                "verify_iss": bool(project_id),
            },
        )

        return {
            "uid": decoded.get("sub") or decoded.get("user_id"),
            "email": decoded.get("email"),
            "name": decoded.get("name"),
            "picture": decoded.get("picture"),
            "github_username": decoded.get("firebase", {}).get("identities", {}).get("github.com", [None])[0],
        }
    except Exception as exc:
        logger.error("Firebase token verification failed: %s", exc)
        raise ValueError("Invalid Firebase ID token") from exc
