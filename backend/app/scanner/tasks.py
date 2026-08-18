"""Celery task entrypoint for Phase 3 scans."""
from __future__ import annotations

import logging

from app.celery_app import celery_app
import app.core.database as app_db
from app.scanner.service import ScanExecutionService, build_default_registry
from app.models.models import Scan

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="arve.scans.execute",
    autoretry_for=(),
    ignore_result=False,
)
def execute_scan_task(self, scan_id: str) -> str:
    """Execute one scan in a dedicated Celery worker process."""
    db = app_db.SessionLocal()
    try:
        logger.info("scan=%s celery task started task_id=%s", scan_id, self.request.id)
        scan = ScanExecutionService(db, registry=build_default_registry()).execute_scan(scan_id)
        logger.info("scan=%s celery task finished status=%s", scan_id, scan.status if scan else None)
        return scan.status if scan else "UNKNOWN"
    except Exception:
        logger.exception("scan=%s celery task crashed", scan_id)
        # If the process reached this handler, persist a terminal state so a
        # transient worker/application exception does not leave the scan stuck
        # in QUEUED/INGESTING/SCANNING forever.
        try:
            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            if scan and scan.status in {"QUEUED", "INGESTING", "SCANNING", "NORMALIZING"}:
                scan.status = "FAILED"
                scan.current_stage = "Celery task failed"
                scan.error_message = "Celery worker failed while executing the scan"
                from datetime import datetime
                scan.completed_at = datetime.utcnow()
                db.commit()
        except Exception:
            logger.exception("scan=%s failed to persist Celery failure state", scan_id)
        raise
    finally:
        db.close()
