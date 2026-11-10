"""ARVE AI Intelligence Package."""
from app.ai.gemini_client import GeminiClient, GeminiAPIError
from app.ai.schemas import AISummary, AISummaryMetadata, AISummaryResult
from app.ai.summarizer import AISummarizerService
from app.ai.cache import compute_cache_key, get_cached_summary, persist_ai_summary
from app.ai.fallback import generate_fallback_summary

__all__ = [
    "GeminiClient",
    "GeminiAPIError",
    "AISummary",
    "AISummaryMetadata",
    "AISummaryResult",
    "AISummarizerService",
    "compute_cache_key",
    "get_cached_summary",
    "persist_ai_summary",
    "generate_fallback_summary",
]

