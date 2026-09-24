"""Production health check endpoint monitoring DB, Redis, and Celery worker connectivity."""
from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, Response, status
import redis
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(response: Response, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Production health check verifying DB, Redis, and Celery worker connectivity."""
    health: Dict[str, Any] = {
        "status": "healthy",
        "queue_backend": settings.SCAN_QUEUE_BACKEND,
        "services": {},
    }
    is_healthy = True

    # 1. Database check
    try:
        db.execute(text("SELECT 1"))
        health["services"]["database"] = {"status": "ok"}
    except Exception as exc:
        is_healthy = False
        health["services"]["database"] = {"status": "error", "error": str(exc)}
        logger.error("Health check database error: %s", exc)

    # 2. Redis check
    try:
        r = redis.from_url(settings.REDIS_URL, socket_timeout=2.0)
        r.ping()
        health["services"]["redis"] = {"status": "ok"}
    except Exception as exc:
        is_healthy = False
        health["services"]["redis"] = {"status": "error", "error": str(exc)}
        logger.error("Health check Redis error: %s", exc)

    # 3. Celery worker check (if celery is configured)
    if settings.SCAN_QUEUE_BACKEND.lower() == "celery":
        try:
            inspector = celery_app.control.inspect(timeout=1.5)
            ping_result = inspector.ping() if inspector else None
            if ping_result:
                worker_names = list(ping_result.keys())
                health["services"]["celery"] = {
                    "status": "ok",
                    "active_workers": len(worker_names),
                    "workers": worker_names,
                }
            else:
                health["services"]["celery"] = {
                    "status": "warning",
                    "active_workers": 0,
                    "message": "No active Celery workers responded to ping",
                }
        except Exception as exc:
            health["services"]["celery"] = {"status": "error", "error": str(exc)}
            logger.warning("Health check Celery ping failed: %s", exc)

    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        health["status"] = "unhealthy"

    return health
