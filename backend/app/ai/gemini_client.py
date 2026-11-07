"""Gemini Flash client with bounded retry handling, strict timeouts, and token metrics."""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiAPIError(Exception):
    """Raised when Gemini API request fails or returns an error response."""
    pass


class GeminiClient:
    """Dedicated HTTP client for Google Gemini Flash."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        max_retries: Optional[int] = None,
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL or "gemini-1.5-flash"
        self.timeout_seconds = timeout_seconds or settings.GEMINI_TIMEOUT_SECONDS or 30
        self.max_retries = max_retries if max_retries is not None else settings.GEMINI_MAX_RETRIES

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def generate_json_summary(
        self,
        system_instruction: str,
        user_prompt: str,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Call Gemini Flash and return parsed JSON data along with usage metadata.
        
        Returns:
            (parsed_dict, {
                "input_tokens": int,
                "output_tokens": int,
                "latency_ms": int,
                "served_model": str,
            })
        """
        if not self.is_configured:
            raise GeminiAPIError("GEMINI_API_KEY is not configured")

        url = GEMINI_API_URL_TEMPLATE.format(model=self.model)
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key,
        }

        payload: Dict[str, Any] = {
            "system_instruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.2,
                "maxOutputTokens": settings.GEMINI_MAX_OUTPUT_TOKENS,
            },
        }

        last_error: Optional[Exception] = None
        start_time = time.time()

        for attempt in range(self.max_retries + 1):
            try:
                with httpx.Client(timeout=float(self.timeout_seconds)) as client:
                    response = client.post(url, headers=headers, json=payload)
                    
                    if response.status_code == 200:
                        latency_ms = int((time.time() - start_time) * 1000)
                        resp_data = response.json()
                        return self._parse_gemini_response(resp_data, latency_ms)

                    # Retryable HTTP status codes: 429, 500, 502, 503, 504
                    if response.status_code in {429, 500, 502, 503, 504} and attempt < self.max_retries:
                        backoff = (2 ** attempt) * 0.5
                        logger.warning(
                            "Gemini API returned status %d on attempt %d/%d; retrying in %.2fs",
                            response.status_code,
                            attempt + 1,
                            self.max_retries,
                            backoff,
                        )
                        time.sleep(backoff)
                        continue

                    raise GeminiAPIError(
                        f"Gemini API error (HTTP {response.status_code}): {response.text[:500]}"
                    )

            except (httpx.TimeoutException, httpx.NetworkError) as net_err:
                last_error = net_err
                if attempt < self.max_retries:
                    backoff = (2 ** attempt) * 0.5
                    logger.warning(
                        "Gemini connection error (%s) on attempt %d/%d; retrying in %.2fs",
                        net_err,
                        attempt + 1,
                        self.max_retries,
                        backoff,
                    )
                    time.sleep(backoff)
                    continue
                break
            except Exception as exc:
                last_error = exc
                break

        latency_ms = int((time.time() - start_time) * 1000)
        raise GeminiAPIError(f"Gemini API call failed after retries ({latency_ms}ms): {last_error}")

    def _parse_gemini_response(
        self,
        resp_data: Dict[str, Any],
        latency_ms: int,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Extract text JSON and token usage from Gemini generateContent response."""
        candidates = resp_data.get("candidates", [])
        if not candidates:
            feedback = resp_data.get("promptFeedback", {})
            raise GeminiAPIError(f"No response candidate returned. Prompt feedback: {feedback}")

        first_candidate = candidates[0]
        content_parts = first_candidate.get("content", {}).get("parts", [])
        if not content_parts or "text" not in content_parts[0]:
            raise GeminiAPIError("Empty content returned in Gemini candidate parts")

        raw_text = content_parts[0]["text"].strip()
        # Clean potential markdown wrapping if returned
        if raw_text.startswith("```"):
            lines = raw_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            raw_text = "\n".join(lines).strip()

        try:
            parsed_json = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            raise GeminiAPIError(f"Failed to parse Gemini response as JSON: {exc}. Raw: {raw_text[:200]}") from exc

        usage_metadata = resp_data.get("usageMetadata", {})
        metadata = {
            "provider": "gemini",
            "input_tokens": usage_metadata.get("promptTokenCount"),
            "output_tokens": usage_metadata.get("candidatesTokenCount"),
            "thought_tokens": usage_metadata.get("thoughtsTokenCount"),
            "latency_ms": latency_ms,
            "served_model": resp_data.get("modelVersion") or self.model,
        }

        return parsed_json, metadata

