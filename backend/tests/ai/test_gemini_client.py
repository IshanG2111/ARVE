"""GeminiClient maps SDK responses and errors to outcomes. The SDK transport is stubbed; no network."""
from types import SimpleNamespace

import pytest
from google.genai import errors, types

from app.ai import gemini_client
from app.ai.gemini_client import GeminiClient, LLMRequest, Outcome

REQUEST = LLMRequest("system", "prompt", {"type": "object"}, 256)


def usage():
    return SimpleNamespace(prompt_token_count=120, candidates_token_count=40, thoughts_token_count=15)


def response(text='{"ok": true}', finish="STOP", block_reason=None, candidates=True):
    return SimpleNamespace(
        text=text,
        model_version="gemini-3.8-flash-001",
        usage_metadata=usage(),
        prompt_feedback=SimpleNamespace(block_reason=block_reason) if block_reason else None,
        candidates=[SimpleNamespace(finish_reason=SimpleNamespace(name=finish))] if candidates else [],
    )


class StubModels:
    def __init__(self, *results):
        self.results = list(results)
        self.calls = []

    def generate_content(self, *, model, contents, config):
        self.calls.append((model, contents, config))
        item = self.results.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def make_client(*results):
    client = GeminiClient.__new__(GeminiClient)
    client.model = "gemini-3.8-flash"
    client._types = types
    client._client = SimpleNamespace(models=StubModels(*results))
    return client


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr(gemini_client.time, "sleep", lambda _s: None)


def api_error(code, status, message="error"):
    return errors.APIError(code, {"error": {"code": code, "status": status, "message": message}})


def test_ok_records_usage_and_sends_schema():
    client = make_client(response())
    result = client.generate(REQUEST)

    assert result.outcome == Outcome.OK
    assert (result.input_tokens, result.output_tokens, result.thought_tokens) == (120, 40, 15)
    assert result.served_model == "gemini-3.8-flash-001"
    _, contents, config = client._client.models.calls[0]
    assert contents == "prompt"
    assert config.system_instruction == "system"
    assert config.response_mime_type == "application/json"
    assert config.response_json_schema == {"type": "object"}
    assert not config.tools  # the model is never given tools


@pytest.mark.parametrize("kwargs,expected", [
    ({"finish": "MAX_TOKENS"}, Outcome.TRUNCATED),
    ({"finish": "SAFETY"}, Outcome.REFUSED),
    ({"finish": "PROHIBITED_CONTENT"}, Outcome.REFUSED),
    ({"block_reason": "JAILBREAK"}, Outcome.REFUSED),
    ({"candidates": False}, Outcome.PROVIDER_ERROR),
    ({"text": ""}, Outcome.PROVIDER_ERROR),
])
def test_response_outcomes(kwargs, expected):
    assert make_client(response(**kwargs)).generate(REQUEST).outcome == expected


@pytest.mark.parametrize("status", ["safety", "jailbreak", "prohibited_content", "blocklist"])
def test_http_400_blocks_are_refused_and_not_retried(status):
    client = make_client(api_error(400, status, f"Request blocked: {status}"))
    assert client.generate(REQUEST).outcome == Outcome.REFUSED
    assert len(client._client.models.calls) == 1


def test_other_400_is_provider_error_without_retry():
    client = make_client(api_error(400, "INVALID_ARGUMENT", "schema too deep"))
    assert client.generate(REQUEST).outcome == Outcome.PROVIDER_ERROR
    assert len(client._client.models.calls) == 1


def test_rate_limit_retries_once():
    client = make_client(api_error(429, "RESOURCE_EXHAUSTED"), response())
    assert client.generate(REQUEST).outcome == Outcome.OK
    assert len(client._client.models.calls) == 2

    client = make_client(api_error(429, "RESOURCE_EXHAUSTED"), api_error(429, "RESOURCE_EXHAUSTED"))
    assert client.generate(REQUEST).outcome == Outcome.RATE_LIMITED


def test_server_error_and_timeout_retry_once():
    client = make_client(api_error(503, "UNAVAILABLE"), response())
    assert client.generate(REQUEST).outcome == Outcome.OK

    class ReadTimeout(Exception):
        pass

    client = make_client(ReadTimeout(), ReadTimeout())
    assert client.generate(REQUEST).outcome == Outcome.TIMEOUT
    assert len(client._client.models.calls) == 2
