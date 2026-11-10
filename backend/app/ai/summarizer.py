"""High-level AI summarization service coordinating cache, Gemini Flash, and fallbacks."""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.ai.cache import (
    compute_cache_key,
    get_cached_summary,
    get_inflight_lock,
    persist_ai_summary,
)
from app.ai.fallback import generate_fallback_summary
from app.ai.gemini_client import GeminiAPIError, GeminiClient
from app.ai.providers import BaseAIProvider, GeminiProvider, get_ai_provider
from app.ai.prompt import (
    OUTPUT_SCHEMA_VERSION,
    PROMPT_VERSION,
    SYSTEM_INSTRUCTION,
    build_canonical_scan_input,
    build_gemini_prompt,
)
from app.ai.schemas import AISummary, AISummaryMetadata, AISummaryResult
from app.core.config import settings
from app.models.models import (
    ASTAnalysisRun,
    Project,
    Scan,
    SecurityContext,
    SecurityFinding,
)

logger = logging.getLogger(__name__)


class _ClientAdapterProvider(BaseAIProvider):
    """Adapter wrapping a GeminiClient or mock into the BaseAIProvider interface."""

    def __init__(self, client: Any):
        self.client = client

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return getattr(self.client, "model", "gemini-1.5-flash")

    @property
    def is_configured(self) -> bool:
        return bool(getattr(self.client, "is_configured", True))

    def generate_json_summary(
        self,
        system_instruction: str,
        user_prompt: str,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        data, meta = self.client.generate_json_summary(system_instruction, user_prompt)
        meta["provider"] = "gemini"
        return data, meta


class AISummarizerService:
    """Manages scan summary generation, token budget enforcement, and persistence."""

    def __init__(
        self,
        db: Session,
        provider: Optional[BaseAIProvider] = None,
        gemini_client: Optional[Any] = None,
    ):
        self.db = db
        if provider:
            self.provider = provider
        elif gemini_client is not None:
            self.provider = _ClientAdapterProvider(gemini_client)
        else:
            self.provider = get_ai_provider()
        self.gemini_client = gemini_client

    def get_or_generate_scan_summary(
        self,
        scan_id: str,
        force_refresh: bool = False,
        canonical_findings: Optional[List[Dict[str, Any]]] = None,
    ) -> AISummaryResult:
        """Retrieve cached AI summary or generate a new validated summary with fallback.
        
        Guarantees:
        - 1 global summary request per completed scan
        - Cache hit reuses result with zero network/token cost
        - In-flight concurrency lock prevents duplicate simultaneous requests
        - Deterministic fallback prevents failure even if Gemini API is unreachable
        """
        scan = self.db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            raise ValueError(f"Scan {scan_id} not found")

        project = self.db.query(Project).filter(Project.id == scan.project_id).first()
        project_name = project.name if project else "Unknown"
        repo_name = project.repo_name if project else None
        language = project.repo_language if project else None
        frameworks = project.repo_frameworks if project else None

        # 1. Collect canonical deduplicated findings
        if canonical_findings is not None:
            findings_data = canonical_findings
        else:
            findings_query = (
                self.db.query(SecurityFinding)
                .filter(SecurityFinding.scan_id == scan_id)
                .order_by(SecurityFinding.severity.asc())
                .all()
            )
            seen_keys = set()
            findings_data = []
            for f in findings_query:
                vuln_id = f.ghsa or f.cve or f.rule_id or f.title or ""
                pkg = f.package_name or ""
                file_p = f.file_path or ""
                line_s = f.line_start or 0
                key = (f.engine, pkg, vuln_id, file_p, line_s)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                findings_data.append({
                    "id": f.id,
                    "title": f.title,
                    "description": f.description,
                    "severity": f.severity,
                    "engine": f.engine,
                    "file_path": f.file_path,
                    "line_start": f.line_start,
                    "line_end": f.line_end,
                    "rule_id": f.rule_id,
                    "package_name": f.package_name,
                    "cwe": f.cwe,
                    "cve": f.cve,
                })

        # 2. Retrieve AST context from existing scan data
        ast_run = self.db.query(ASTAnalysisRun).filter(ASTAnalysisRun.scan_id == scan_id).first()
        ast_summary: Optional[Dict[str, Any]] = None
        if ast_run:
            ast_summary = {
                "functions": ast_run.total_functions,
                "classes": ast_run.total_classes,
                "imports": ast_run.total_imports,
                "relationships": ast_run.total_relationships,
                "status": ast_run.status,
            }

        contexts_query = self.db.query(SecurityContext).filter(SecurityContext.scan_id == scan_id).all()
        security_contexts: List[Dict[str, Any]] = [
            {
                "finding_id": ctx.finding_id,
                "file_path": ctx.file_path,
                "function": ctx.function_name,
                "class": ctx.class_name,
                "route": f"{ctx.route_method} {ctx.route_path}" if ctx.route_path else None,
                "framework": ctx.framework,
            }
            for ctx in contexts_query
        ]

        # 3. Build compact canonical payload
        canonical_input = build_canonical_scan_input(
            project_name=project_name,
            repository_full_name=repo_name,
            language=language,
            frameworks=frameworks,
            findings=findings_data,
            ast_summary=ast_summary,
            security_contexts=security_contexts,
        )

        model_name = self.provider.model_name
        provider_name = self.provider.provider_name
        cache_key = compute_cache_key(
            canonical_input=canonical_input,
            prompt_version=PROMPT_VERSION,
            model_version=f"{provider_name}:{model_name}",
            output_schema_version=OUTPUT_SCHEMA_VERSION,
        )

        # 4. Check cache before calling AI
        if not force_refresh:
            cached = get_cached_summary(self.db, cache_key)
            if cached:
                logger.info("scan=%s AI summary cache hit (key=%s)", scan_id, cache_key[:12])
                return cached

        # 5. Acquire lock to prevent duplicate simultaneous calls for identical key
        lock = get_inflight_lock(cache_key)
        with lock:
            # Re-check cache inside lock in case another thread just populated it
            if not force_refresh:
                cached = get_cached_summary(self.db, cache_key)
                if cached:
                    logger.info("scan=%s AI summary cache hit after lock (key=%s)", scan_id, cache_key[:12])
                    return cached

            # 6. Attempt AI generation via configured provider (Groq, Gemini, Ollama)
            user_prompt = build_gemini_prompt(canonical_input)

            if not self.provider.is_configured:
                logger.warning("scan=%s %s not configured; using deterministic fallback", scan_id, provider_name)
                fallback_summary = generate_fallback_summary(canonical_input, reason="API key not configured")
                return AISummaryResult(
                    summary=fallback_summary,
                    metadata=AISummaryMetadata(
                        cache_key=cache_key,
                        cache_hit=False,
                        is_fallback=True,
                        model=model_name,
                        served_model="deterministic-fallback",
                        prompt_version=PROMPT_VERSION,
                        provider="deterministic-engine",
                    ),
                )

            try:
                logger.info("scan=%s invoking %s (model=%s)...", scan_id, provider_name, model_name)
                parsed_json, usage_meta = self.provider.generate_json_summary(
                    system_instruction=SYSTEM_INSTRUCTION,
                    user_prompt=user_prompt,
                )
                
                # Validate with Pydantic
                summary = AISummary.model_validate(parsed_json)

                # Persist to Neon DB
                persist_ai_summary(
                    db=self.db,
                    project_id=scan.project_id,
                    scan_id=scan.id,
                    cache_key=cache_key,
                    prompt_version=PROMPT_VERSION,
                    model=model_name,
                    served_model=usage_meta.get("served_model"),
                    summary=summary,
                    input_tokens=usage_meta.get("input_tokens"),
                    output_tokens=usage_meta.get("output_tokens"),
                    thought_tokens=usage_meta.get("thought_tokens"),
                    latency_ms=usage_meta.get("latency_ms"),
                )

                metadata = AISummaryMetadata(
                    cache_key=cache_key,
                    cache_hit=False,
                    is_fallback=False,
                    model=model_name,
                    served_model=usage_meta.get("served_model"),
                    prompt_version=PROMPT_VERSION,
                    input_tokens=usage_meta.get("input_tokens"),
                    output_tokens=usage_meta.get("output_tokens"),
                    thought_tokens=usage_meta.get("thought_tokens"),
                    latency_ms=usage_meta.get("latency_ms"),
                    provider=provider_name,
                )

                logger.info(
                    "scan=%s %s summary generated successfully (in=%s, out=%s, latency=%sms)",
                    scan_id,
                    provider_name,
                    usage_meta.get("input_tokens"),
                    usage_meta.get("output_tokens"),
                    usage_meta.get("latency_ms"),
                )
                return AISummaryResult(summary=summary, metadata=metadata)

            except Exception as exc:
                logger.error("scan=%s %s generation failed: %s; falling back to deterministic summary", scan_id, provider_name, exc)
                fallback_summary = generate_fallback_summary(canonical_input, reason=str(exc))
                return AISummaryResult(
                    summary=fallback_summary,
                    metadata=AISummaryMetadata(
                        cache_key=cache_key,
                        cache_hit=False,
                        is_fallback=True,
                        model=model_name,
                        served_model="deterministic-fallback",
                        prompt_version=PROMPT_VERSION,
                        provider="deterministic-engine",
                    ),
                )

