"""Celery task entrypoint for Phase 4A security scans."""
from __future__ import annotations

import logging

from app.celery_app import celery_app
import app.core.database as app_db
from app.models.models import Scan
from app.scanner.parallel import ParallelSecurityScanService, build_security_registry

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="arve.scans.execute",
    autoretry_for=(),
    ignore_result=False,
)
def execute_scan_task(self, scan_id: str) -> str:
    """Execute one security scan with all enabled engines in parallel."""
    db = app_db.SessionLocal()
    try:
        logger.info("scan=%s celery task started task_id=%s", scan_id, self.request.id)
        scan = ParallelSecurityScanService(
            db,
            registry=build_security_registry(),
        ).execute_scan(scan_id)
        logger.info("scan=%s celery task finished status=%s", scan_id, scan.status if scan else None)
        return scan.status if scan else "UNKNOWN"
    except Exception:
        logger.exception("scan=%s celery task crashed", scan_id)
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
