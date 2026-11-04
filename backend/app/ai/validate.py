"""Checks applied to every model answer before it is shown or cached.

Gemini ignores length limits in response schemas, so all limits are enforced here.
"""
from __future__ import annotations

import json
import re
from typing import Optional

from pydantic import ValidationError

from app.ai.schemas import FindingContext, FindingExplanation, ScanSummary

_URL = re.compile(r"\bhttps?://|\bwww\.", re.IGNORECASE)
_IDENTIFIER = re.compile(r"\b(?:CVE-\d{4}-\d{3,}|CWE-\d+|GHSA(?:-[0-9a-z]{4}){3})\b", re.IGNORECASE)
_FILE_PATH = re.compile(
    r"(?<![\w@])[\w.\-/]*[\w\-]\.(?:py|js|jsx|mjs|cjs|ts|tsx|java|kt|go|php|rb|cs|json|lock|ya?ml|toml|xml|"
    r"gradle|cfg|ini|sql|sh|html|vue)\b",
    re.IGNORECASE,
)
_LINE_REF = re.compile(r"\blines?\s+(\d+)(?:\s*(?:-|to|and)\s*(\d+))?", re.IGNORECASE)
_REF = re.compile(r"\[?\b(F\d+)\b\]?")
_FALSE_ASSURANCE = re.compile(
    r"\b(?:code|application|app|repository|repo|project|it|this)\s+(?:is|are)\s+(?:now\s+)?"
    r"(?:secure|safe|fixed|not vulnerable|no longer vulnerable)\b"
    r"|\bhas\s+been\s+(?:fixed|resolved|patched|remediated)\b",
    re.IGNORECASE,
)
_COUNT_CLAIM = re.compile(r"\b\d+\s+(?:\w+\s+)?(?:findings|issues|vulnerabilities|secrets|alerts)\b", re.IGNORECASE)

# Manifest and config names a fix may reasonably mention even when the finding points at a lockfile.
_COMMON_FILES = {
    "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "requirements.txt", "pyproject.toml",
    "poetry.lock", "pipfile.lock", "go.mod", "go.sum", "composer.json", "composer.lock", "pom.xml",
    "build.gradle", "gemfile.lock", ".env", ".env.example", ".gitignore",
}

LIMITS = {
    "summary": 450,
    "why_it_matters": 1000,
    "step": 350,
    "steps": 5,
    "suggested_code_chars": 2500,
    "caveat": 300,
    "caveats": 4,
    "overview": 1200,
    "summary_items": 5,
    "summary_item": 350,
}


def _parse(text: str, model):
    try:
        return model.model_validate(json.loads(text)), []
    except (json.JSONDecodeError, TypeError) as exc:
        return None, [f"the answer was not valid JSON ({type(exc).__name__})"]
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) for err in exc.errors()})
        return None, [f"the answer did not match the schema (fields: {', '.join(fields)})"]


def _length_problems(label: str, text: str, limit: int) -> list[str]:
    return [f"{label} is longer than {limit} characters"] if len(text) > limit else []


def _text_guards(label: str, text: str, allowed_text: str, allowed_lines: set[int], check_counts: bool) -> list[str]:
    problems: list[str] = []
    lowered_allowed = allowed_text.lower()
    if _URL.search(text):
        problems.append(f"{label} contains a URL; URLs are not allowed")
    for ident in {m.group(0) for m in _IDENTIFIER.finditer(text)}:
        if ident.lower() not in lowered_allowed:
            problems.append(f"{label} mentions {ident}, which is not in the finding")
    for path in {m.group(0) for m in _FILE_PATH.finditer(text)}:
        name = path.rsplit("/", 1)[-1].lower()
        if path.lower() not in lowered_allowed and name not in lowered_allowed and name not in _COMMON_FILES:
            problems.append(f"{label} mentions the file {path}, which is not in the finding")
    for match in _LINE_REF.finditer(text):
        numbers = {int(n) for n in match.groups() if n}
        if allowed_lines and not numbers <= allowed_lines:
            problems.append(f"{label} cites line numbers that are not part of the code shown")
        elif not allowed_lines:
            problems.append(f"{label} cites line numbers but no code was provided")
    if _FALSE_ASSURANCE.search(text):
        problems.append(f"{label} claims the code is secure or fixed; give advice only")
    if check_counts and _COUNT_CLAIM.search(text):
        problems.append(f"{label} states a count of findings; counts come from the app, not the summary")
    return problems


def _allowed(contexts: list[FindingContext]) -> tuple[str, set[int]]:
    text_parts: list[str] = []
    lines: set[int] = set()
    for ctx in contexts:
        text_parts.append(ctx.model_dump_json())
        if ctx.line_start:
            lines.update(range(ctx.line_start, (ctx.line_end or ctx.line_start) + 1))
        if ctx.code is not None:
            lines.update(range(ctx.code.start_line, ctx.code.end_line + 1))
    return "\n".join(text_parts), lines


def validate_finding_explanation(text: str, ctx: FindingContext) -> tuple[Optional[FindingExplanation], list[str]]:
    """Return ``(explanation, [])`` when the answer is acceptable, otherwise ``(None, problems)``."""
    parsed, problems = _parse(text, FindingExplanation)
    if parsed is None:
        return None, problems

    if parsed.suggested_code is not None and not parsed.suggested_code.strip():
        parsed.suggested_code = None
    parsed.fix_steps = [s.strip() for s in parsed.fix_steps if s and s.strip()]
    parsed.caveats = [c.strip() for c in parsed.caveats if c and c.strip()]

    allowed_text, allowed_lines = _allowed([ctx])
    problems += _length_problems("summary", parsed.summary, LIMITS["summary"])
    problems += _length_problems("why_it_matters", parsed.why_it_matters, LIMITS["why_it_matters"])
    if not parsed.summary.strip() or not parsed.why_it_matters.strip():
        problems.append("summary and why_it_matters must not be empty")
    if not 1 <= len(parsed.fix_steps) <= LIMITS["steps"]:
        problems.append(f"fix_steps must have 1 to {LIMITS['steps']} items")
    for step in parsed.fix_steps:
        problems += _length_problems("a fix step", step, LIMITS["step"])
    if len(parsed.caveats) > LIMITS["caveats"]:
        problems.append(f"caveats must have at most {LIMITS['caveats']} items")
    for caveat in parsed.caveats:
        problems += _length_problems("a caveat", caveat, LIMITS["caveat"])
    if parsed.suggested_code:
        problems += _length_problems("suggested_code", parsed.suggested_code, LIMITS["suggested_code_chars"])
        if _URL.search(parsed.suggested_code):
            problems.append("suggested_code contains a URL")
    if parsed.references_used != [ctx.ref] and set(parsed.references_used) != {ctx.ref}:
        problems.append(f"references_used must be [\"{ctx.ref}\"]")

    prose = {"summary": parsed.summary, "why_it_matters": parsed.why_it_matters}
    prose.update({f"fix step {i + 1}": s for i, s in enumerate(parsed.fix_steps)})
    prose.update({f"caveat {i + 1}": c for i, c in enumerate(parsed.caveats)})
    for label, value in prose.items():
        problems += _text_guards(label, value, allowed_text, allowed_lines, check_counts=False)

    if problems:
        return None, problems
    parsed.references_used = [ctx.ref]
    return parsed, []


def validate_scan_summary(text: str, contexts: list[FindingContext]) -> tuple[Optional[ScanSummary], list[str]]:
    parsed, problems = _parse(text, ScanSummary)
    if parsed is None:
        return None, problems

    parsed.top_risks = [r.strip() for r in parsed.top_risks if r and r.strip()]
    parsed.first_actions = [a.strip() for a in parsed.first_actions if a and a.strip()]
    known_refs = {ctx.ref for ctx in contexts}
    allowed_text, allowed_lines = _allowed(contexts)

    problems += _length_problems("overview", parsed.overview, LIMITS["overview"])
    if not parsed.overview.strip():
        problems.append("overview must not be empty")
    for name, items in (("top_risks", parsed.top_risks), ("first_actions", parsed.first_actions)):
        if not 1 <= len(items) <= LIMITS["summary_items"]:
            problems.append(f"{name} must have 1 to {LIMITS['summary_items']} items")
        for item in items:
            problems += _length_problems(f"an item in {name}", item, LIMITS["summary_item"])
    for i, risk in enumerate(parsed.top_risks):
        refs = set(_REF.findall(risk))
        if not refs:
            problems.append(f"top_risks item {i + 1} must start with a finding ref such as [F1]")
    for label, value in [("overview", parsed.overview)] + \
            [(f"top_risks item {i + 1}", r) for i, r in enumerate(parsed.top_risks)] + \
            [(f"first_actions item {i + 1}", a) for i, a in enumerate(parsed.first_actions)]:
        unknown = set(_REF.findall(value)) - known_refs
        if unknown:
            problems.append(f"{label} cites unknown refs {sorted(unknown)}")
        problems += _text_guards(label, value, allowed_text, allowed_lines, check_counts=True)

    return (None, problems) if problems else (parsed, [])
