from pydantic_settings import BaseSettings
from typing import List, Union
from pydantic import AnyHttpUrl, validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "ARVE - Adaptive Remediation & Verification Engine"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "arve-secret-key-super-secure-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # SQLite default, can be overridden by ENV variable
    DATABASE_URL: str = "sqlite:///./arve.db"
    
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    GITHUB_CLIENT_ID: str = "arve_demo_client_id"
    GITHUB_CLIENT_SECRET: str = "arve_demo_client_secret"
    GITHUB_REDIRECT_URI: str = "http://localhost:5173/auth/github/callback"

    class Config:
        case_sensitive = True

settings = Settings()
