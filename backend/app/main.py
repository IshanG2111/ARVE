from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.api.auth import router as auth_router
from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import init_db
from app.models.models import User
from app.schemas.schemas import UserResponse

# Register SQLAlchemy models only. Schema changes are handled by Alembic.
init_db()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Adaptive Remediation & Verification Engine (ARVE) API",
    version="0.1.5 - Foundation Stabilization",
)

allowed_origins = list(dict.fromkeys([
    *settings.BACKEND_CORS_ORIGINS,
    settings.effective_frontend_url,
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(auth_router)


@app.get("/me", response_model=UserResponse, tags=["me"])
@app.get(f"{settings.API_V1_STR}/me", response_model=UserResponse, tags=["me"])
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/")
def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "docs": "/docs",
        "version": "0.1.5 - Foundation Stabilization",
    }


@app.get("/mock-verification-file/{token}", response_class=Response)
def mock_verification_file(token: str):
    """Development-only helper; never expose it in production."""
    if not settings.is_development:
        return Response(status_code=404)
    return Response(content=token, media_type="text/plain")
