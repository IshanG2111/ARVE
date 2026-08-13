import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings

# Absolute paths to backend/.env and workspace root/.env
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BASE_DIR.parent

ENV_FILES = (
    str(BASE_DIR / ".env"),
    str(ROOT_DIR / ".env"),
)

class Settings(BaseSettings):
    PROJECT_NAME: str = "ARVE - Adaptive Remediation & Verification Engine"
    API_V1_STR: str = "/api"

    # JWT Settings
    JWT_SECRET: str = "arve-secret-key-super-secure-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/arve_db"

    # GitHub OAuth
    GITHUB_CLIENT_ID: str = "arve_demo_client_id"
    GITHUB_CLIENT_SECRET: str = "arve_demo_client_secret"
    GITHUB_REDIRECT_URI: str = "http://localhost:8000/auth/github/callback"
    GITHUB_OAUTH_SCOPE: str = "read:user user:email repo"

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # Environment
    ARVE_ENV: str = "dev"

    # Firebase Auth Settings
    FIREBASE_PROJECT_ID: Optional[str] = "arve-fe63b"
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = None

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = {
        "case_sensitive": False,
        "env_file": ENV_FILES,
        "extra": "ignore",
    }

    @property
    def arve_env(self) -> str:
        return self.ARVE_ENV.lower()

    @property
    def database_url(self) -> str:
        url = self.DATABASE_URL
        if url and url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        return url

    @property
    def firebase_service_account_json(self) -> Optional[str]:
        return self.FIREBASE_SERVICE_ACCOUNT_JSON

    @property
    def firebase_credentials_path(self) -> Optional[str]:
        return self.FIREBASE_CREDENTIALS_PATH


    # Lowercase properties matching standard settings pattern
    @property
    def github_client_id(self) -> str:
        return self.GITHUB_CLIENT_ID

    @property
    def github_client_secret(self) -> str:
        return self.GITHUB_CLIENT_SECRET

    @property
    def github_redirect_uri(self) -> str:
        return self.GITHUB_REDIRECT_URI

    @property
    def github_oauth_scope(self) -> str:
        return self.GITHUB_OAUTH_SCOPE

    # Effective getters for backward compatibility
    @property
    def effective_github_client_id(self) -> str:
        return self.GITHUB_CLIENT_ID

    @property
    def effective_github_client_secret(self) -> str:
        return self.GITHUB_CLIENT_SECRET

    @property
    def effective_github_redirect_uri(self) -> str:
        return self.GITHUB_REDIRECT_URI

    @property
    def effective_github_oauth_scope(self) -> str:
        return self.GITHUB_OAUTH_SCOPE

    @property
    def effective_jwt_secret(self) -> str:
        return self.JWT_SECRET

    @property
    def effective_jwt_algorithm(self) -> str:
        return self.JWT_ALGORITHM

    @property
    def effective_jwt_expire_minutes(self) -> int:
        return self.JWT_EXPIRE_MINUTES

    @property
    def effective_frontend_url(self) -> str:
        return self.FRONTEND_URL

    @property
    def effective_firebase_project_id(self) -> Optional[str]:
        return self.FIREBASE_PROJECT_ID

settings = Settings()
