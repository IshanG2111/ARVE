"""In-memory ``LLMClient`` for tests. Never touches the network."""
from __future__ import annotations

import json
from typing import Any, Union

from app.ai.gemini_client import LLMRequest, LLMResult, Outcome


class FakeLLMClient:
    """Returns queued responses in order and records every request it receives.

    Queue entries are a dict (returned as JSON text), a raw string, or an ``LLMResult``.
    """

    def __init__(self, *responses: Union[dict[str, Any], str, LLMResult], model: str = "fake-model"):
        self.model = model
        self.responses = list(responses)
        self.requests: list[LLMRequest] = []

    def generate(self, request: LLMRequest) -> LLMResult:
        self.requests.append(request)
        if not self.responses:
            raise AssertionError("FakeLLMClient called more times than expected")
        item = self.responses.pop(0)
        if isinstance(item, LLMResult):
            return item
        text = item if isinstance(item, str) else json.dumps(item)
        return LLMResult(
            Outcome.OK, text=text, model=self.model, served_model=self.model,
            input_tokens=100, output_tokens=50, thought_tokens=0, latency_ms=5,
        )
