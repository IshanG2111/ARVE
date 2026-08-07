from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "ARVE - Adaptive Remediation & Verification Engine"
    API_V1_STR: str = "/api"

    # JWT Settings
    jwt_secret: str = "arve-secret-key-super-secure-change-in-production-2026"
    SECRET_KEY: Optional[str] = None
    jwt_algorithm: str = "HS256"
    ALGORITHM: Optional[str] = None
    jwt_expire_minutes: int = 10080  # 7 days
    ACCESS_TOKEN_EXPIRE_MINUTES: Optional[int] = None

    # Database
    database_url: str = "sqlite:///./arve.db"
    DATABASE_URL: Optional[str] = None

    # GitHub OAuth
    github_client_id: str = "arve_demo_client_id"
    GITHUB_CLIENT_ID: Optional[str] = None

    github_client_secret: str = "arve_demo_client_secret"
    GITHUB_CLIENT_SECRET: Optional[str] = None

    github_redirect_uri: str = "http://localhost:8000/auth/github/callback"
    GITHUB_REDIRECT_URI: Optional[str] = None

    github_oauth_scope: str = "read:user user:email repo"
    GITHUB_OAUTH_SCOPE: Optional[str] = None

    # Frontend
    frontend_url: str = "http://localhost:5173"
    FRONTEND_URL: Optional[str] = None

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    class Config:
        case_sensitive = False
        env_file = ".env"
        extra = "allow"

    @property
    def effective_jwt_secret(self) -> str:
        return self.jwt_secret or self.SECRET_KEY or "arve-secret-key-super-secure-change-in-production-2026"

    @property
    def effective_jwt_algorithm(self) -> str:
        return self.jwt_algorithm or self.ALGORITHM or "HS256"

    @property
    def effective_jwt_expire_minutes(self) -> int:
        return self.jwt_expire_minutes or self.ACCESS_TOKEN_EXPIRE_MINUTES or 10080

    @property
    def effective_github_client_id(self) -> str:
        return self.github_client_id or self.GITHUB_CLIENT_ID or "arve_demo_client_id"

    @property
    def effective_github_client_secret(self) -> str:
        return self.github_client_secret or self.GITHUB_CLIENT_SECRET or "arve_demo_client_secret"

    @property
    def effective_github_redirect_uri(self) -> str:
        return self.github_redirect_uri or self.GITHUB_REDIRECT_URI or "http://localhost:8000/auth/github/callback"

    @property
    def effective_github_oauth_scope(self) -> str:
        return self.github_oauth_scope or self.GITHUB_OAUTH_SCOPE or "read:user user:email repo"

    @property
    def effective_frontend_url(self) -> str:
        return self.frontend_url or self.FRONTEND_URL or "http://localhost:5173"

settings = Settings()
