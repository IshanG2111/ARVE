from fastapi import FastAPI, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api import api_router
from app.api.auth import router as auth_router
from app.api.deps import get_current_user
from app.schemas.schemas import UserResponse
from app.models.models import User

# Create database tables & apply schema updates automatically
init_db()

# Safe startup debug check for .env loading
print("==================================================")
print("ARVE Backend Environment Check:")
print("GitHub Client ID:", settings.github_client_id)
print("GitHub Secret loaded:", bool(settings.github_client_secret and settings.github_client_secret != "arve_demo_client_secret"))
print("GitHub Secret length:", len(settings.github_client_secret))
print("GitHub Redirect:", settings.github_redirect_uri)
print("==================================================")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Adaptive Remediation & Verification Engine (ARVE) - Phase 1 API"
)

# Set up CORS with explicit origins & credentials support for httpOnly cookies
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.effective_frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,  # Mandatory for httpOnly cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(auth_router)

@app.get("/me", response_model=UserResponse, tags=["me"])
@app.get(f"{settings.API_V1_STR}/me", response_model=UserResponse, tags=["me"])
def read_me(current_user: User = Depends(get_current_user)):
    """Top level /me and /api/me endpoint."""
    return current_user

@app.get("/")
def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "docs": "/docs",
        "version": "0.1.0 - Phase 1 Foundation & Authorization"
    }

# Developer helper for testing verification locally without setting up an external web server
@app.get("/mock-verification-file/{token}", response_class=Response)
def mock_verification_file(token: str):
    """
    Mock endpoint simulating http://domain/.well-known/arve-verification.txt
    Usage: Point domain or test localhost to this endpoint to test verification!
    """
    return Response(content=token, media_type="text/plain")
