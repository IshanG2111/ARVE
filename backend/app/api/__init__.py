from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.projects import router as projects_router
from app.api.targets import router as targets_router
from app.api.github import router as github_router
from app.api.repositories import router as repositories_router
from app.api.ingestion import router as ingestion_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(github_router)
api_router.include_router(projects_router)
api_router.include_router(targets_router)
api_router.include_router(repositories_router)
api_router.include_router(ingestion_router)

