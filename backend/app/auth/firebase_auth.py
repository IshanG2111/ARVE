import json
import logging
from typing import Any, Dict

from cryptography.x509 import load_pem_x509_certificate
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


async def get_google_public_keys(force_refresh: bool = False) -> Dict[str, str]:
    global _GOOGLE_PUBLIC_KEYS
    if not _GOOGLE_PUBLIC_KEYS or force_refresh:
        url = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            _GOOGLE_PUBLIC_KEYS = response.json()
    return _GOOGLE_PUBLIC_KEYS


async def verify_firebase_token(id_token: str) -> Dict[str, Any]:
    """Verify a Firebase ID token; never trust an unverified JWT payload."""
    if settings.is_development and id_token.startswith("mock_firebase_token_"):
        return {
            "uid": f"firebase_uid_{id_token}",
            "email": "octocat@github.com",
            "name": "Octocat Security Tester",
            "picture": "https://avatars.githubusercontent.com/u/583231?v=4",
            "github_username": "octocat-dev",
            "github_id": "10293847",
        }

    if FIREBASE_ADMIN_AVAILABLE:
        try:
            decoded_token = fb_auth.verify_id_token(id_token)
            identities = decoded_token.get("firebase", {}).get("identities", {})
            github_identities = identities.get("github.com", [])
            github_id = str(github_identities[0]) if github_identities else None
            email = decoded_token.get("email")
            if not email:
                email_identities = identities.get("email", [])
                if email_identities:
                    email = str(email_identities[0])
            username = (
                decoded_token.get("screen_name")
                or decoded_token.get("preferred_username")
                or (email.split("@", 1)[0] if email else None)
                or (f"gh_{github_id}" if github_id else None)
                or f"user_{decoded_token.get('uid', '')[:8]}"
            )
            return {
                "uid": decoded_token.get("uid"),
                "email": email,
                "name": decoded_token.get("name") or username,
                "picture": decoded_token.get("picture"),
                "github_username": username,
                "github_id": github_id,
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
            keys = await get_google_public_keys(force_refresh=True)
            cert_str = keys.get(kid)
            if not cert_str:
                raise ValueError(f"Firebase signing key '{kid}' was not found")

        cert_obj = load_pem_x509_certificate(cert_str.encode("utf-8"))
        public_key = cert_obj.public_key()

        project_id = settings.effective_firebase_project_id
        decoded = jwt.decode(
            id_token,
            key=public_key,
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

        identities = decoded.get("firebase", {}).get("identities", {})
        github_identities = identities.get("github.com", [])
        github_id = str(github_identities[0]) if github_identities else None

        email = decoded.get("email")
        if not email:
            email_identities = identities.get("email", [])
            if email_identities:
                email = str(email_identities[0])

        username = (
            decoded.get("screen_name")
            or decoded.get("preferred_username")
            or (decoded.get("name") if decoded.get("name") and " " not in decoded.get("name") else None)
            or (email.split("@", 1)[0] if email else None)
            or (f"gh_{github_id}" if github_id else None)
            or f"user_{decoded.get('sub', '')[:8]}"
        )

        return {
            "uid": decoded.get("sub") or decoded.get("user_id"),
            "email": email,
            "name": decoded.get("name") or username,
            "picture": decoded.get("picture"),
            "github_username": username,
            "github_id": github_id,
        }
    except Exception as exc:
        logger.error("Firebase token verification failed: %s", exc)
        raise ValueError("Invalid Firebase ID token") from exc
