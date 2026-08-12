import json
import logging
from typing import Dict, Any, Optional
import httpx
import jwt
from app.core.config import settings

logger = logging.getLogger(__name__)

# Cache for Google OAuth2 public certificates
_GOOGLE_PUBLIC_KEYS: Dict[str, str] = {}

try:
    import firebase_admin
    from firebase_admin import auth as fb_auth, credentials

    # Initialize Firebase Admin SDK if credentials or project ID are provided
    if not firebase_admin._apps:
        if settings.firebase_service_account_json:
            cred_dict = json.loads(settings.firebase_service_account_json)
            firebase_admin.initialize_app(credentials.Certificate(cred_dict))
        elif settings.firebase_credentials_path:
            firebase_admin.initialize_app(credentials.Certificate(settings.firebase_credentials_path))
        elif settings.effective_firebase_project_id:
            firebase_admin.initialize_app(options={"projectId": settings.effective_firebase_project_id})
        else:
            # Fallback initialization for default app
            firebase_admin.initialize_app()
    FIREBASE_ADMIN_AVAILABLE = True
except Exception as e:
    logger.warning(f"Firebase Admin SDK not initialized: {e}. Falling back to PyJWT Google public cert verification.")
    FIREBASE_ADMIN_AVAILABLE = False


async def get_google_public_keys() -> Dict[str, str]:
    global _GOOGLE_PUBLIC_KEYS
    if not _GOOGLE_PUBLIC_KEYS:
        url = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                _GOOGLE_PUBLIC_KEYS = resp.json()
    return _GOOGLE_PUBLIC_KEYS


async def verify_firebase_token(id_token: str) -> Dict[str, Any]:
    """
    Verifies a Firebase ID token and returns decoded claims:
    {
       'uid': str,
       'email': str,
       'name': str,
       'picture': str,
       'github_username': Optional[str],
       ...
    }
    """
    # Demo / mock mode handling (gated by ARVE_ENV=dev)
    if settings.arve_env == "dev" and id_token.startswith("mock_firebase_token_"):
        return {
            "uid": f"firebase_uid_{id_token}",
            "email": "octocat@github.com",
            "name": "Octocat Security Tester",
            "picture": "https://avatars.githubusercontent.com/u/583231?v=4",
            "github_username": "octocat-dev",
            "github_id": "10293847",
        }

    # Strategy 1: Try firebase_admin SDK
    if FIREBASE_ADMIN_AVAILABLE:
        try:
            decoded_token = fb_auth.verify_id_token(id_token)
            firebase_user = {
                "uid": decoded_token.get("uid"),
                "email": decoded_token.get("email"),
                "name": decoded_token.get("name"),
                "picture": decoded_token.get("picture"),
            }
            # Firebase GitHub provider user info
            firebase_user["github_username"] = (
                decoded_token.get("firebase", {}).get("identities", {}).get("github.com", [None])[0]
            )
            return firebase_user
        except Exception as err:
            logger.debug(f"firebase_admin verification failed: {err}. Attempting PyJWT fallback.")

    # Strategy 2: Direct PyJWT verification against Google public keys
    try:
        header = jwt.get_unverified_header(id_token)
        kid = header.get("kid")
        keys = await get_google_public_keys()
        
        if kid and kid in keys:
            cert_str = keys[kid]
            decoded = jwt.decode(
                id_token,
                key=cert_str,
                algorithms=["RS256"],
                options={"verify_aud": False}, # Verified below if project_id is set
            )
            project_id = settings.effective_firebase_project_id
            if project_id and decoded.get("aud") != project_id:
                raise ValueError(f"Invalid audience {decoded.get('aud')}, expected {project_id}")
                
            return {
                "uid": decoded.get("sub") or decoded.get("user_id"),
                "email": decoded.get("email"),
                "name": decoded.get("name"),
                "picture": decoded.get("picture"),
                "github_username": decoded.get("firebase", {}).get("identities", {}).get("github.com", [None])[0],
            }
    except Exception as e:
        logger.error(f"PyJWT Google public key token verification failed: {e}")

    # Strategy 3: Unverified decode fallback for local development testing (gated by ARVE_ENV=dev)
    if settings.arve_env == "dev":
        try:
            unverified_payload = jwt.decode(id_token, options={"verify_signature": False})
            return {
                "uid": unverified_payload.get("sub") or unverified_payload.get("user_id") or "dev_user_uid",
                "email": unverified_payload.get("email") or "dev@arve.local",
                "name": unverified_payload.get("name") or "ARVE Dev User",
                "picture": unverified_payload.get("picture"),
                "github_username": unverified_payload.get("firebase", {}).get("identities", {}).get("github.com", [None])[0],
            }
        except Exception as e:
            logger.warning(f"Unverified decode fallback failed: {e}")

    raise ValueError("Invalid Firebase ID token")
