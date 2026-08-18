"""Celery application for long-running ARVE scan orchestration."""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "arve",
    broker=settings.effective_celery_broker_url,
    backend=settings.effective_celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_time_limit=settings.SCANNER_GLOBAL_TIMEOUT_SECONDS + 60,
    task_soft_time_limit=settings.SCANNER_GLOBAL_TIMEOUT_SECONDS + 30,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    task_eager_propagates=settings.CELERY_TASK_EAGER_PROPAGATES,
    include=["app.scanner.tasks"],
)
