"""Unified AI Provider abstraction supporting Gemini, Ollama, Groq, and custom LLM backends."""
from __future__ import annotations

from abc import ABC, abstractmethod
import json
import logging
import time
from typing import Any, Dict, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIProviderError(Exception):
    """Base exception for all AI provider communication and parsing errors."""
    pass


class BaseAIProvider(ABC):
    """Abstract interface for security report AI summary providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Identifier for the provider (e.g. 'gemini', 'ollama', 'groq')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Underlying model identifier."""
        pass

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if credentials and endpoints are available."""
        pass

    @abstractmethod
    def generate_json_summary(
        self,
        system_instruction: str,
        user_prompt: str,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Execute request and return (parsed_json_dict, metadata_dict)."""
        pass


class GeminiProvider(BaseAIProvider):
    """Google Gemini Flash integration with retry and token tracking."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        max_retries: Optional[int] = None,
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL or "gemini-3.5-flash"
        self.timeout_seconds = timeout_seconds or settings.GEMINI_TIMEOUT_SECONDS or 30
        self.max_retries = max_retries if max_retries is not None else settings.GEMINI_MAX_RETRIES

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self.model

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def generate_json_summary(
        self,
        system_instruction: str,
        user_prompt: str,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        # Delegate to GeminiClient logic
        from app.ai.gemini_client import GeminiClient
        client = GeminiClient(
            api_key=self.api_key,
            model=self.model,
            timeout_seconds=self.timeout_seconds,
            max_retries=self.max_retries,
        )
        data, meta = client.generate_json_summary(system_instruction, user_prompt)
        meta["provider"] = "gemini"
        return data, meta


class OllamaProvider(BaseAIProvider):
    """Local Ollama LLM provider (e.g. llama3, mistral, codellama)."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
    ):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL or "http://localhost:11434").rstrip("/")
        self.model = model or settings.OLLAMA_MODEL or "llama3:latest"
        self.timeout_seconds = timeout_seconds or settings.GEMINI_TIMEOUT_SECONDS or 60

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self.model

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url and self.model)

    def generate_json_summary(
        self,
        system_instruction: str,
        user_prompt: str,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "format": "json",
            "stream": False,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
            "options": {"temperature": 0.1},
        }

        start_time = time.time()
        try:
            with httpx.Client(timeout=float(self.timeout_seconds)) as client:
                res = client.post(url, json=payload)
                if res.status_code != 200:
                    raise AIProviderError(f"Ollama returned HTTP {res.status_code}: {res.text}")
                
                resp_data = res.json()
                content = resp_data.get("message", {}).get("content", "{}")
                parsed = json.loads(content)
                latency_ms = int((time.time() - start_time) * 1000)

                metadata = {
                    "provider": "ollama",
                    "input_tokens": resp_data.get("prompt_eval_count"),
                    "output_tokens": resp_data.get("eval_count"),
                    "latency_ms": latency_ms,
                    "served_model": self.model,
                }
                return parsed, metadata
        except Exception as exc:
            raise AIProviderError(f"Ollama request failed: {exc}") from exc


class GroqProvider(BaseAIProvider):
    """Groq high-speed cloud inference provider (Llama-3.3, Mixtral)."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
    ):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or settings.GROQ_MODEL or "llama-3.3-70b-versatile"
        self.timeout_seconds = timeout_seconds or 30

    @property
    def provider_name(self) -> str:
        return "groq"

    @property
    def model_name(self) -> str:
        return self.model

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def generate_json_summary(
        self,
        system_instruction: str,
        user_prompt: str,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        if not self.is_configured:
            raise AIProviderError("Groq API key is not configured.")

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
        }

        start_time = time.time()
        try:
            with httpx.Client(timeout=float(self.timeout_seconds)) as client:
                res = client.post(url, headers=headers, json=payload)
                if res.status_code != 200:
                    raise AIProviderError(f"Groq returned HTTP {res.status_code}: {res.text}")
                
                resp_data = res.json()
                content = resp_data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                usage = resp_data.get("usage", {})
                latency_ms = int((time.time() - start_time) * 1000)

                metadata = {
                    "provider": "groq",
                    "input_tokens": usage.get("prompt_tokens"),
                    "output_tokens": usage.get("completion_tokens"),
                    "latency_ms": latency_ms,
                    "served_model": resp_data.get("model", self.model),
                }
                return parsed, metadata
        except Exception as exc:
            raise AIProviderError(f"Groq request failed: {exc}") from exc


def get_ai_provider(provider_type: Optional[str] = None) -> BaseAIProvider:
    """Factory creating an AI provider instance based on configured settings."""
    chosen = (provider_type or settings.AI_PROVIDER or "groq").lower()
    if chosen == "ollama":
        return OllamaProvider()
    if chosen == "gemini":
        return GeminiProvider()
    # Default to Groq
    return GroqProvider()

