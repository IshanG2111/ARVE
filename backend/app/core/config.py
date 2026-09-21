from pathlib import Path
import tempfile
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
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:3000", "http://127.0.0.1:3000",
    ]

    SCAN_WORKSPACE_ROOT: str = str(Path(tempfile.gettempdir()) / "arve_scans")
    DOCKER_BINARY: str = "docker"
    SCANNER_MEMORY_LIMIT: str = "1g"
    SCANNER_CPU_LIMIT: float = 1.5
    SCANNER_CONTAINER_USER: str = "1000:1000"
    SCANNER_ENGINE_TIMEOUT_SECONDS: int = 180
    SCANNER_GLOBAL_TIMEOUT_SECONDS: int = 600
    SCANNER_LOG_MAX_CHARS: int = 8000

    SCAN_QUEUE_BACKEND: str = "celery"
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: Optional[str] = None
    CELERY_RESULT_BACKEND: Optional[str] = None
    CELERY_TASK_ALWAYS_EAGER: bool = False
    CELERY_TASK_EAGER_PROPAGATES: bool = True
    SCANNER_ENABLE_TEST_ENGINE: bool = False
    SCANNER_TEST_IMAGE: str = "arve-phase3-test-scanner:latest"
    SCANNER_TEST_MODE: str = "success"

    # Phase 4A Security Engines
    SCANNER_ENABLE_OSV: bool = True
    SCANNER_OSV_IMAGE: str = "ghcr.io/google/osv-scanner:v1.9.2"
    SCANNER_ENABLE_GITLEAKS: bool = True
    SCANNER_GITLEAKS_IMAGE: str = "ghcr.io/gitleaks/gitleaks:v8.24.2"
    SCANNER_NETWORK_MODE: str = "none"
    SCANNER_OSV_NETWORK: str = "bridge"

    B2_ENDPOINT: Optional[str] = None
    B2_REGION: Optional[str] = None
    B2_BUCKET_NAME: Optional[str] = None
    B2_ACCESS_KEY_ID: Optional[str] = None
    B2_SECRET_ACCESS_KEY: Optional[str] = None
    B2_ARTIFACT_PREFIX: str = "scans"

    model_config = SettingsConfigDict(case_sensitive=False, env_file=ENV_FILES, extra="ignore")

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
    def effective_celery_broker_url(self) -> str:
        return self.CELERY_BROKER_URL or self.REDIS_URL

    @property
    def effective_celery_result_backend(self) -> str:
        return self.CELERY_RESULT_BACKEND or self.REDIS_URL

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
