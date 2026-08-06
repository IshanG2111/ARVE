from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.api import api_router

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Adaptive Remediation & Verification Engine (ARVE) - Phase 1 API"
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

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
