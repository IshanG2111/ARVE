"""Orchestrates AI explanations: gate, cache, prompt, call, validate, fall back.

The user always gets an answer. Only validated model output is cached.
"""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ai.context import build_finding_context, build_scan_contexts
from app.ai.fallback import fallback_explanation, fallback_summary
from app.ai.gemini_client import LLMClient, LLMRequest, Outcome, get_llm_client
from app.ai.prompts import (
    FINDING_RESPONSE_SCHEMA,
    PROMPT_VERSION,
    SUMMARY_PROMPT_VERSION,
    SUMMARY_RESPONSE_SCHEMA,
    SYSTEM_PROMPT,
    build_finding_prompt,
    build_repair_prompt,
    build_summary_prompt,
)
from app.ai.schemas import FindingContext, FindingExplanation, ScanSummary
from app.ai.validate import validate_finding_explanation, validate_scan_summary
from app.core.config import settings
from app.models.models import AIExplanation, Project, Scan, SecurityFinding
from app.security.severity import FindingSeverity

logger = logging.getLogger(__name__)

# Defined here rather than imported from the report builder, which imports this module.
SEVERITY_ORDER = [s.value for s in FindingSeverity]

KIND_FINDING = "FINDING_EXPLANATION"
KIND_SUMMARY = "SCAN_SUMMARY"


@dataclass
class AIResult:
    status: str                     # VALIDATED or FALLBACK
    payload: object                 # FindingExplanation or ScanSummary
    reason: Optional[str] = None    # why a fallback was used
    cached: bool = False
    model: Optional[str] = None
    prompt_version: Optional[str] = None


def _gate(project: Project) -> Optional[str]:
    """Return a reason code when AI must not run for this project."""
    if not settings.AI_ENABLED:
        return "AI_DISABLED"
    if project.repo_private and not settings.AI_ALLOW_PRIVATE_REPOS:
        return "PRIVATE_REPO"
    return None


def _cache_key(kind: str, target_id: str, prompt_version: str, model: str, prompt: str) -> str:
    # The prompt is part of the key, so new AST context or a new prompt version gives a new answer.
    digest = hashlib.sha256("\x1f".join((kind, target_id, prompt_version, model, prompt)).encode("utf-8"))
    return digest.hexdigest()


def _run(client: LLMClient, prompt: str, schema: dict, validate) -> tuple[Optional[object], Optional[str], object]:
    """Call the model, validate, allow one repair. Returns ``(parsed, failure_reason, last_result)``."""
    request = LLMRequest(SYSTEM_PROMPT, prompt, schema, settings.AI_MAX_OUTPUT_TOKENS)
    result = client.generate(request)
    if result.outcome != Outcome.OK:
        return None, result.outcome.value, result
    parsed, problems = validate(result.text)
    if parsed is not None:
        return parsed, None, result

    logger.info("AI answer rejected, attempting one repair: %s", problems)
    repair = LLMRequest(SYSTEM_PROMPT, build_repair_prompt(prompt, problems), schema, settings.AI_MAX_OUTPUT_TOKENS)
    repaired = client.generate(repair)
    if repaired.outcome != Outcome.OK:
        return None, repaired.outcome.value, repaired
    parsed, problems = validate(repaired.text)
    if parsed is None:
        logger.info("AI answer rejected after repair: %s", problems)
        return None, "INVALID_OUTPUT", repaired
    return parsed, None, repaired


def _store(db: Session, *, project_id: str, scan_id: str, finding_id: Optional[str], kind: str,
           cache_key: str, prompt_version: str, model: str, payload, result) -> None:
    row = AIExplanation(
        project_id=project_id, scan_id=scan_id, finding_id=finding_id, kind=kind, cache_key=cache_key,
        prompt_version=prompt_version, model=model, served_model=result.served_model,
        response_json=payload.model_dump_json(), input_tokens=result.input_tokens,
        output_tokens=result.output_tokens, thought_tokens=result.thought_tokens, latency_ms=result.latency_ms,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # a concurrent request cached the same answer first


def _cached(db: Session, cache_key: str, model_cls):
    row = db.query(AIExplanation).filter(AIExplanation.cache_key == cache_key).first()
    if row is None:
        return None
    try:
        return model_cls.model_validate_json(row.response_json)
    except ValueError:
        return None


def explain_finding(db: Session, scan: Scan, finding: SecurityFinding,
                    client: Optional[LLMClient] = None) -> tuple[AIResult, FindingContext]:
    ctx = build_finding_context(db, finding, "F1", scan)
    reason = _gate(scan.project)
    if reason:
        return AIResult("FALLBACK", fallback_explanation(ctx), reason=reason), ctx

    client = client or get_llm_client()
    if client is None:
        return AIResult("FALLBACK", fallback_explanation(ctx), reason="NOT_CONFIGURED"), ctx

    prompt = build_finding_prompt(ctx)
    key = _cache_key(KIND_FINDING, finding.id, PROMPT_VERSION, client.model, prompt)
    cached = _cached(db, key, FindingExplanation)
    if cached is not None:
        return AIResult("VALIDATED", cached, cached=True, model=client.model, prompt_version=PROMPT_VERSION), ctx

    parsed, failure, result = _run(
        client, prompt, FINDING_RESPONSE_SCHEMA, lambda text: validate_finding_explanation(text, ctx)
    )
    if parsed is None:
        return AIResult("FALLBACK", fallback_explanation(ctx), reason=failure, model=client.model,
                        prompt_version=PROMPT_VERSION), ctx

    _store(db, project_id=scan.project_id, scan_id=scan.id, finding_id=finding.id, kind=KIND_FINDING,
           cache_key=key, prompt_version=PROMPT_VERSION, model=client.model, payload=parsed, result=result)
    return AIResult("VALIDATED", parsed, model=client.model, prompt_version=PROMPT_VERSION), ctx


def summarize_scan(db: Session, scan: Scan, client: Optional[LLMClient] = None,
                   limit: int = 10) -> tuple[AIResult, list[FindingContext], dict[str, str]]:
    """Summarise the top open findings. Also returns ``{ref: finding_id}`` so the UI can link refs."""
    contexts, ref_map = _summary_inputs(db, scan, limit)

    reason = _gate(scan.project)
    if reason is None and not contexts:
        reason = "NO_OPEN_FINDINGS"
    if reason:
        return AIResult("FALLBACK", fallback_summary(contexts), reason=reason), contexts, ref_map

    client = client or get_llm_client()
    if client is None:
        return AIResult("FALLBACK", fallback_summary(contexts), reason="NOT_CONFIGURED"), contexts, ref_map

    prompt = build_summary_prompt(contexts, _open_counts(db, scan))
    key = _cache_key(KIND_SUMMARY, scan.id, SUMMARY_PROMPT_VERSION, client.model, prompt)
    cached = _cached(db, key, ScanSummary)
    if cached is not None:
        return AIResult("VALIDATED", cached, cached=True, model=client.model,
                        prompt_version=SUMMARY_PROMPT_VERSION), contexts, ref_map

    parsed, failure, result = _run(
        client, prompt, SUMMARY_RESPONSE_SCHEMA, lambda text: validate_scan_summary(text, contexts)
    )
    if parsed is None:
        return AIResult("FALLBACK", fallback_summary(contexts), reason=failure, model=client.model,
                        prompt_version=SUMMARY_PROMPT_VERSION), contexts, ref_map

    _store(db, project_id=scan.project_id, scan_id=scan.id, finding_id=None, kind=KIND_SUMMARY, cache_key=key,
           prompt_version=SUMMARY_PROMPT_VERSION, model=client.model, payload=parsed, result=result)
    return AIResult("VALIDATED", parsed, model=client.model, prompt_version=SUMMARY_PROMPT_VERSION), contexts, ref_map


def _summary_inputs(db: Session, scan: Scan, limit: int = 10) -> tuple[list[FindingContext], dict[str, str]]:
    from app.ai.context import select_top_findings

    findings = select_top_findings(db, scan, limit)
    contexts = build_scan_contexts(db, scan, limit)
    return contexts, {ctx.ref: f.id for ctx, f in zip(contexts, findings)}


def _open_counts(db: Session, scan: Scan) -> dict[str, int]:
    counts = {sev: 0 for sev in SEVERITY_ORDER}
    for row in db.query(SecurityFinding.severity, SecurityFinding.fingerprint).filter(
        SecurityFinding.scan_id == scan.id, SecurityFinding.status.in_(("OPEN", "REOPENED", "ACKNOWLEDGED"))
    ).distinct():
        counts[row.severity] = counts.get(row.severity, 0) + 1
    return counts


# ── Read-only cache lookups for the report ─────────────────────────────────
# These rebuild the exact cache key the Explain/Summary buttons would use now, so the report only shows an
# answer that matches the current code context, prompt and model. They never call the model.

def _cache_usable(scan: Scan) -> bool:
    return _gate(scan.project) is None and bool(settings.GEMINI_API_KEY)


def cached_finding_explanations(db: Session, scan: Scan) -> dict[str, FindingExplanation]:
    """``{finding_id: explanation}`` for this scan's findings that already have a current, validated answer."""
    if not _cache_usable(scan):
        return {}
    candidate_ids = {
        row.finding_id
        for row in db.query(AIExplanation.finding_id).filter(
            AIExplanation.scan_id == scan.id,
            AIExplanation.kind == KIND_FINDING,
            AIExplanation.prompt_version == PROMPT_VERSION,
            AIExplanation.model == settings.GEMINI_MODEL,
        )
    }
    out: dict[str, FindingExplanation] = {}
    if not candidate_ids:
        return out
    for finding in db.query(SecurityFinding).filter(SecurityFinding.id.in_(candidate_ids)):
        ctx = build_finding_context(db, finding, "F1", scan)
        key = _cache_key(KIND_FINDING, finding.id, PROMPT_VERSION, settings.GEMINI_MODEL, build_finding_prompt(ctx))
        explanation = _cached(db, key, FindingExplanation)
        if explanation is not None:
            out[finding.id] = explanation
    return out


def cached_scan_summary(db: Session, scan: Scan) -> Optional[tuple[ScanSummary, dict[str, str]]]:
    """The current cached summary and its ``{ref: finding_id}`` map, or None."""
    if not _cache_usable(scan):
        return None
    has_any = db.query(AIExplanation.id).filter(
        AIExplanation.scan_id == scan.id,
        AIExplanation.kind == KIND_SUMMARY,
        AIExplanation.prompt_version == SUMMARY_PROMPT_VERSION,
        AIExplanation.model == settings.GEMINI_MODEL,
    ).first()
    if has_any is None:
        return None
    contexts, ref_map = _summary_inputs(db, scan)
    if not contexts:
        return None
    prompt = build_summary_prompt(contexts, _open_counts(db, scan))
    key = _cache_key(KIND_SUMMARY, scan.id, SUMMARY_PROMPT_VERSION, settings.GEMINI_MODEL, prompt)
    summary = _cached(db, key, ScanSummary)
    return (summary, ref_map) if summary is not None else None


def payload_json(result: AIResult) -> dict:
    return json.loads(result.payload.model_dump_json())
