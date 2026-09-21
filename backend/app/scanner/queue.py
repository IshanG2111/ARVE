"""Queue abstraction for ARVE security scan execution."""
from __future__ import annotations

import logging

from fastapi import BackgroundTasks

from app.core.config import settings
import app.core.database as app_db
from app.scanner.parallel import ParallelSecurityScanService, build_security_registry

logger = logging.getLogger(__name__)


def enqueue_scan(scan_id: str, background_tasks: BackgroundTasks | None = None) -> str:
    backend = settings.SCAN_QUEUE_BACKEND.lower().strip()
    if backend == "celery":
        from app.scanner.tasks import execute_scan_task

        result = execute_scan_task.delay(scan_id)
        logger.info("scan=%s queued celery_task=%s", scan_id, result.id)
        return result.id

    if backend in {"background", "background_tasks", "asyncio"}:
        if background_tasks is None:
            raise RuntimeError("BackgroundTasks queue backend requires a BackgroundTasks instance")
        background_tasks.add_task(run_scan_background, scan_id)
        logger.info("scan=%s queued using FastAPI BackgroundTasks", scan_id)
        return scan_id

    raise RuntimeError(f"Unsupported SCAN_QUEUE_BACKEND: {settings.SCAN_QUEUE_BACKEND}")


def run_scan_background(scan_id: str) -> None:
    db = app_db.SessionLocal()
    try:
        ParallelSecurityScanService(
            db,
            registry=build_security_registry(),
        ).execute_scan(scan_id)
    finally:
        db.close()
