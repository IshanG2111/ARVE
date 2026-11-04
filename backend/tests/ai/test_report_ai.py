"""Cached AI answers appear in the report, marked AI-assisted; the report never calls the model."""
import pytest

from app.ai import prompts, service
from app.core.config import settings
from app.models.models import ScanEngineRun
from app.reports import builder
from app.reports.renderer import render_html, render_pdf
from tests.ai.test_ai_service import GOOD, add_finding, ai_on, fake, make_scan, make_user  # noqa: F401 (fixtures)


@pytest.fixture(autouse=True)
def ai_cache_settings(monkeypatch):
    # The report looks up the cache with the configured model; the fake client reports "fake-model".
    monkeypatch.setattr(settings, "GEMINI_MODEL", "fake-model")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")


SUMMARY = {
    "overview": "String-built SQL in lookup() is the main risk.",
    "top_risks": ["[F1] lookup() builds SQL from input."],
    "first_actions": ["Parameterize the query in app/db.py."],
}


def build_report(db, scan, **kwargs):
    if not db.query(ScanEngineRun).filter(ScanEngineRun.scan_id == scan.id).first():
        db.add(ScanEngineRun(scan_id=scan.id, engine_name="semgrep", status="COMPLETED", exit_code=0))
        db.commit()
    return builder.build_report(db, scan, **kwargs)


def explained_scan(db, fake):
    user, _ = make_user(db)
    scan = make_scan(db, user)
    finding = add_finding(db, scan)
    other = add_finding(db, scan, title="Unexplained weakness", severity="LOW", line_start=3, line_end=3, cwe=None)
    fake(GOOD, SUMMARY)
    assert service.explain_finding(db, scan, finding)[0].status == "VALIDATED"
    assert service.summarize_scan(db, scan)[0].status == "VALIDATED"
    return scan, finding, other


def by_title(report, title):
    return next(f for f in report.findings if f.title == title)


def test_cached_answers_are_included_without_calling_the_model(db, fake, monkeypatch):
    scan, _, _ = explained_scan(db, fake)
    monkeypatch.setattr(service, "get_llm_client", lambda: pytest.fail("report must not call the model"))

    report = build_report(db, scan)

    explained = by_title(report, "SQL injection")
    assert explained.ai is not None and explained.ai.summary == GOOD["summary"]
    assert by_title(report, "Unexplained weakness").ai is None  # keeps the deterministic text only
    assert report.ai_summary is not None and report.has_ai
    # [F1] in the AI summary is replaced by the report's own finding ID.
    assert report.ai_summary.top_risks == [f"[{explained.display_id}] lookup() builds SQL from input."]

    html = render_html(report)
    assert "AI-assisted explanation" in html and "AI-assisted overview (fake-model)" in html
    assert "Suggested change, not applied" in html
    assert "This report contains no AI-generated text." not in html
    assert render_pdf(report).startswith(b"%PDF")


def test_ai_off_or_excluded_gives_deterministic_report(db, fake, monkeypatch):
    scan, _, _ = explained_scan(db, fake)

    assert not build_report(db, scan, include_ai=False).has_ai
    monkeypatch.setattr(settings, "AI_ENABLED", False)
    report = build_report(db, scan)
    assert not report.has_ai
    assert "This report contains no AI-generated text." in render_html(report)


def test_stale_answers_are_not_used(db, fake, monkeypatch):
    scan, _, _ = explained_scan(db, fake)

    monkeypatch.setattr(service, "PROMPT_VERSION", "finding-v999")
    monkeypatch.setattr(service, "SUMMARY_PROMPT_VERSION", "summary-v999")
    assert not build_report(db, scan).has_ai

    monkeypatch.undo()
    monkeypatch.setattr(settings, "GEMINI_MODEL", "another-model")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    assert not build_report(db, scan).has_ai


def test_changed_code_context_invalidates_the_answer(db, fake, monkeypatch):
    scan, _, _ = explained_scan(db, fake)
    # Any change to what the model would be sent (here the prompt text) means the cached answer no longer applies.
    original = prompts.build_finding_prompt
    monkeypatch.setattr(service, "build_finding_prompt", lambda ctx: original(ctx) + "\nchanged")
    assert by_title(build_report(db, scan), "SQL injection").ai is None


def test_warm_cache_fills_what_the_report_reads(db, fake, monkeypatch, capsys):
    from app.ai import warm_cache

    user, _ = make_user(db)
    scan = make_scan(db, user)
    add_finding(db, scan)
    monkeypatch.setattr(warm_cache, "PAUSE_SECONDS", 0)
    monkeypatch.setattr(warm_cache, "SessionLocal", lambda: db)
    monkeypatch.setattr(db, "close", lambda: None)
    fake_client = fake(GOOD, SUMMARY)

    assert warm_cache.main([scan.id]) == 0
    report = build_report(db, scan)
    assert report.ai_summary is not None and all(f.ai for f in report.findings)

    assert warm_cache.main([scan.id]) == 0  # second run is served from the cache
    assert len(fake_client.requests) == 2
    assert "cached" in capsys.readouterr().out


def test_warm_cache_stops_at_rate_limit(db, fake, monkeypatch):
    from app.ai import warm_cache
    from app.ai.gemini_client import LLMResult, Outcome

    user, _ = make_user(db)
    scan = make_scan(db, user)
    add_finding(db, scan)
    add_finding(db, scan, severity="LOW", line_start=3, line_end=3)
    monkeypatch.setattr(warm_cache, "PAUSE_SECONDS", 0)
    monkeypatch.setattr(warm_cache, "SessionLocal", lambda: db)
    monkeypatch.setattr(db, "close", lambda: None)
    fake_client = fake(LLMResult(Outcome.RATE_LIMITED, model="fake-model"))

    assert warm_cache.main([scan.id]) == 1
    assert len(fake_client.requests) == 1  # no further findings or summary attempted


def test_ai_text_is_escaped_in_html(db, fake):
    user, _ = make_user(db)
    scan = make_scan(db, user)
    finding = add_finding(db, scan)
    fake(dict(GOOD, summary="lookup() <img src=x onerror=alert(1)> builds SQL in app/db.py."))
    assert service.explain_finding(db, scan, finding)[0].status == "VALIDATED"

    html = render_html(build_report(db, scan))
    assert "<img src=x" not in html and "&lt;img src=x" in html
