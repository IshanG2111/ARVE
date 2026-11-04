"""Thin Gemini wrapper. All Google SDK use lives in this file.

``LLMClient`` exists so tests can use ``FakeLLMClient`` and never touch the network.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional, Protocol

from app.core.config import settings

logger = logging.getLogger(__name__)

# Gemini reports blocked content either as an HTTP 400 carrying one of these
# codes, as prompt_feedback.block_reason, or as a candidate finish_reason.
_BLOCK_MARKERS = ("safety", "jailbreak", "prohibited_content", "blocklist", "spii", "recitation", "model_armor")
_RETRY_DELAY_SECONDS = 2.0


class Outcome(str, Enum):
    OK = "OK"
    REFUSED = "REFUSED"
    TRUNCATED = "TRUNCATED"
    TIMEOUT = "TIMEOUT"
    RATE_LIMITED = "RATE_LIMITED"
    PROVIDER_ERROR = "PROVIDER_ERROR"
    NOT_CONFIGURED = "NOT_CONFIGURED"


@dataclass
class LLMRequest:
    system: str
    prompt: str
    response_schema: dict[str, Any]
    max_output_tokens: int


@dataclass
class LLMResult:
    outcome: Outcome
    text: Optional[str] = None
    model: Optional[str] = None
    served_model: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    thought_tokens: Optional[int] = None
    latency_ms: Optional[int] = None
    detail: Optional[str] = None  # short, safe description for logs; never prompt content


class LLMClient(Protocol):
    model: str

    def generate(self, request: LLMRequest) -> LLMResult: ...


def _is_block(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in _BLOCK_MARKERS)


class GeminiClient:
    """Calls ``client.models.generate_content`` with a JSON response schema (google-genai 2.x)."""

    def __init__(self, api_key: str, model: str, timeout_seconds: int):
        from google import genai
        from google.genai import types

        self.model = model
        self._types = types
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=timeout_seconds * 1000),
        )

    def generate(self, request: LLMRequest) -> LLMResult:
        result = self._attempt(request)
        if result.outcome in (Outcome.RATE_LIMITED, Outcome.TIMEOUT, Outcome.PROVIDER_ERROR) and result.detail != "client_error":
            time.sleep(_RETRY_DELAY_SECONDS)
            result = self._attempt(request)
        logger.info(
            "gemini call outcome=%s model=%s served=%s in=%s out=%s thought=%s latency_ms=%s detail=%s",
            result.outcome.value, self.model, result.served_model, result.input_tokens,
            result.output_tokens, result.thought_tokens, result.latency_ms, result.detail,
        )
        return result

    def _attempt(self, request: LLMRequest) -> LLMResult:
        from google.genai import errors

        types = self._types
        config = types.GenerateContentConfig(
            system_instruction=request.system,
            response_mime_type="application/json",
            response_json_schema=request.response_schema,
            max_output_tokens=request.max_output_tokens,
            temperature=0.2,
        )
        started = time.monotonic()
        try:
            response = self._client.models.generate_content(
                model=self.model, contents=request.prompt, config=config
            )
        except errors.APIError as exc:
            latency = int((time.monotonic() - started) * 1000)
            code = getattr(exc, "code", None)
            summary = f"{code} {getattr(exc, 'status', '')}".strip()
            if code == 429:
                return LLMResult(Outcome.RATE_LIMITED, model=self.model, latency_ms=latency, detail=summary)
            if code == 400 and _is_block(f"{getattr(exc, 'status', '')} {getattr(exc, 'message', '')} {exc.details}"):
                return LLMResult(Outcome.REFUSED, model=self.model, latency_ms=latency, detail=summary)
            if code is not None and 400 <= code < 500:
                return LLMResult(Outcome.PROVIDER_ERROR, model=self.model, latency_ms=latency, detail="client_error")
            return LLMResult(Outcome.PROVIDER_ERROR, model=self.model, latency_ms=latency, detail=summary)
        except Exception as exc:  # noqa: BLE001 - network errors and timeouts from the HTTP layer
            latency = int((time.monotonic() - started) * 1000)
            name = type(exc).__name__
            outcome = Outcome.TIMEOUT if "timeout" in name.lower() else Outcome.PROVIDER_ERROR
            return LLMResult(outcome, model=self.model, latency_ms=latency, detail=name)

        latency = int((time.monotonic() - started) * 1000)
        usage = response.usage_metadata
        base = dict(
            model=self.model,
            served_model=response.model_version,
            input_tokens=getattr(usage, "prompt_token_count", None),
            output_tokens=getattr(usage, "candidates_token_count", None),
            thought_tokens=getattr(usage, "thoughts_token_count", None),
            latency_ms=latency,
        )

        feedback = response.prompt_feedback
        if feedback is not None and feedback.block_reason:
            return LLMResult(Outcome.REFUSED, detail=f"prompt blocked: {feedback.block_reason}", **base)
        if not response.candidates:
            return LLMResult(Outcome.PROVIDER_ERROR, detail="no candidates", **base)

        finish = response.candidates[0].finish_reason
        finish_name = getattr(finish, "name", str(finish or ""))
        if finish_name == "MAX_TOKENS":
            return LLMResult(Outcome.TRUNCATED, detail="max tokens", **base)
        if finish_name and finish_name not in ("STOP", "FINISH_REASON_UNSPECIFIED"):
            outcome = Outcome.REFUSED if _is_block(finish_name) else Outcome.PROVIDER_ERROR
            return LLMResult(outcome, detail=f"finish {finish_name}", **base)

        text = response.text
        if not text:
            return LLMResult(Outcome.PROVIDER_ERROR, detail="empty response", **base)
        return LLMResult(Outcome.OK, text=text, **base)


_client: Optional[LLMClient] = None


def get_llm_client() -> Optional[LLMClient]:
    """The process-wide Gemini client, or ``None`` when no API key is configured."""
    global _client
    if _client is None and settings.GEMINI_API_KEY:
        _client = GeminiClient(settings.GEMINI_API_KEY, settings.GEMINI_MODEL, settings.AI_TIMEOUT_SECONDS)
    return _client
