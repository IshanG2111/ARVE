from pathlib import Path
from typing import List, Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BASE_DIR.parent
ENV_FILES = (
    str(BASE_DIR / ".env"),
    str(ROOT_DIR / ".env"),
)


class Settings(BaseSettings):
    PROJECT_NAME: str = "ARVE - Adaptive Remediation & Verification Engine"
    API_V1_STR: str = "/api"

    ARVE_ENV: str = "dev"

    JWT_SECRET: str = "arve-secret-key-super-secure-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/arve_db"


    FRONTEND_URL: str = "http://localhost:5173"

    FIREBASE_PROJECT_ID: Optional[str] = "arve-fe63b"
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = None

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        case_sensitive=False,
        env_file=ENV_FILES,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_runtime_security(self):
        if self.ARVE_ENV.lower() in {"prod", "production"}:
            if self.JWT_SECRET == "arve-secret-key-super-secure-change-in-production-2026":
                raise ValueError("JWT_SECRET must be explicitly configured in production")
        return self

    @property
    def is_development(self) -> bool:
        return self.ARVE_ENV.lower() in {"dev", "development", "test"}

    @property
    def is_production(self) -> bool:
        return self.ARVE_ENV.lower() in {"prod", "production"}


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

    @property
    def cookie_secure(self) -> bool:
        return self.is_production or self.FRONTEND_URL.lower().startswith("https://")


settings = Settings()
