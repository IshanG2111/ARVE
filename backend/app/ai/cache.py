"""Persistent cache management and token budget enforcement for AI summaries."""
from __future__ import annotations

import hashlib
import json
import logging
import threading
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import Session
from app.ai.prompt import OUTPUT_SCHEMA_VERSION, PROMPT_VERSION
from app.ai.schemas import AISummary, AISummaryMetadata, AISummaryResult
from app.models.models import AIExplanation

logger = logging.getLogger(__name__)

# In-flight request synchronization lock to prevent duplicate simultaneous AI calls
_inflight_locks: dict[str, threading.Lock] = {}
_global_cache_lock = threading.Lock()


def get_inflight_lock(cache_key: str) -> threading.Lock:
    with _global_cache_lock:
        if cache_key not in _inflight_locks:
            _inflight_locks[cache_key] = threading.Lock()
        return _inflight_locks[cache_key]


def compute_cache_key(
    canonical_input: Dict[str, Any],
    prompt_version: str = PROMPT_VERSION,
    model_version: str = "gemini-2.5-flash",
    output_schema_version: str = OUTPUT_SCHEMA_VERSION,
) -> str:
    """Compute deterministic SHA-256 cache key.
    
    Formula: SHA256(canonical_scan_input + prompt_version + model_version + output_schema_version)
    """
    serialized_input = json.dumps(canonical_input, sort_keys=True, separators=(",", ":"))
    hasher = hashlib.sha256()
    hasher.update(serialized_input.encode("utf-8"))
    hasher.update(prompt_version.encode("utf-8"))
    hasher.update(model_version.encode("utf-8"))
    hasher.update(output_schema_version.encode("utf-8"))
    return hasher.hexdigest()


def get_cached_summary(db: Session, cache_key: str) -> Optional[AISummaryResult]:
    """Retrieve an existing validated summary from the persistent Neon DB cache."""
    record = db.query(AIExplanation).filter(AIExplanation.cache_key == cache_key).first()
    if not record:
        return None

    try:
        raw_dict = json.loads(record.response_json)
        summary = AISummary.model_validate(raw_dict)
        metadata = AISummaryMetadata(
            cache_key=record.cache_key,
            cache_hit=True,
            is_fallback=False,
            model=record.model,
            served_model=record.served_model,
            prompt_version=record.prompt_version,
            input_tokens=record.input_tokens,
            output_tokens=record.output_tokens,
            thought_tokens=record.thought_tokens,
            latency_ms=record.latency_ms,
        )
        return AISummaryResult(summary=summary, metadata=metadata)
    except Exception as exc:
        logger.warning("Corrupt AIExplanation cache entry %s: %s", cache_key, exc)
        return None


def persist_ai_summary(
    db: Session,
    project_id: str,
    scan_id: str,
    cache_key: str,
    prompt_version: str,
    model: str,
    served_model: Optional[str],
    summary: AISummary,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    thought_tokens: Optional[int] = None,
    latency_ms: Optional[int] = None,
    kind: str = "scan_summary",
) -> AIExplanation:
    """Persist a newly validated AI summary to the Neon DB database."""
    # Check if existing record exists with this cache key
    existing = db.query(AIExplanation).filter(AIExplanation.cache_key == cache_key).first()
    if existing:
        return existing

    record = AIExplanation(
        project_id=project_id,
        scan_id=scan_id,
        kind=kind,
        cache_key=cache_key,
        prompt_version=prompt_version,
        model=model,
        served_model=served_model or model,
        response_json=summary.model_dump_json(),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        thought_tokens=thought_tokens,
        latency_ms=latency_ms,
    )
    db.add(record)
    try:
        db.commit()
        db.refresh(record)
        return record
    except Exception as exc:
        db.rollback()
        # Concurrency safety: if another worker inserted simultaneously, fetch it
        existing = db.query(AIExplanation).filter(AIExplanation.cache_key == cache_key).first()
        if existing:
            return existing
        raise exc

