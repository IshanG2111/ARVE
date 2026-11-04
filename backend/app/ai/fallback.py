"""Deterministic answers used when AI is off, blocked, or its output fails validation."""
from __future__ import annotations

import re

from app.ai.schemas import FindingContext, FindingExplanation, ScanSummary
from app.security.models import FindingType

_WHY = {
    FindingType.DEPENDENCY.value: "A known vulnerability affects this package version. Whether it can be exploited "
                                  "depends on how the application uses the package.",
    FindingType.SECRET.value: "Anyone with read access to the repository, including its history, can use this "
                              "credential.",
}
_WHY_DEFAULT = "The code matches a known insecure pattern. Its real impact depends on whether untrusted input " \
               "reaches it."
# SAST rules for hardcoded secrets (Semgrep often omits the CWE, so the title is checked too).
_CREDENTIAL_CWES = {"CWE-798", "CWE-259", "CWE-321"}
_CREDENTIAL_TITLE = re.compile(r"hard-?coded|credential|secret key|private key|api key", re.IGNORECASE)


def _why(ctx: FindingContext) -> str:
    if ctx.finding_type in _WHY:
        return _WHY[ctx.finding_type]
    cwes = set(re.findall(r"CWE-\d+", (ctx.cwe or "").upper()))
    if cwes & _CREDENTIAL_CWES or _CREDENTIAL_TITLE.search(ctx.title):
        return _WHY[FindingType.SECRET.value]
    return _WHY_DEFAULT


def _first_sentence(text: str | None, limit: int = 300) -> str | None:
    if not text:
        return None
    flat = " ".join(text.split())
    end = flat.find(". ")
    sentence = flat[: end + 1] if 0 < end < limit else flat[:limit]
    return sentence


def fallback_explanation(ctx: FindingContext) -> FindingExplanation:
    location = f" in {ctx.file_path}" if ctx.file_path else ""
    title = ctx.title.rstrip(" .")
    summary = f"{title}{location}."
    detail = _first_sentence(ctx.message)
    # Some engines (e.g. Gitleaks) repeat the title as the message; don't say it twice.
    if detail and detail.rstrip(" .").lower() != title.lower():
        summary = f"{summary} {detail}"

    steps: list[str] = []
    if ctx.finding_type == FindingType.DEPENDENCY.value:
        if ctx.package_name and ctx.fixed_version:
            steps.append(f"Upgrade {ctx.package_name} to {ctx.fixed_version} or later.")
            steps.append("Regenerate the lockfile and re-run the scan.")
        else:
            steps.append("No fixed version is recorded. Check the advisory for mitigations or replace the package.")
    if ctx.catalog_fix:
        steps.append(ctx.catalog_fix)
    if not steps:
        steps.append("Review the code at the reported location and apply the fix recommended by the scanner rule.")

    return FindingExplanation(
        summary=summary,
        why_it_matters=_why(ctx),
        fix_steps=steps,
        suggested_code=None,
        references_used=[ctx.ref],
        caveats=["This is standard guidance, not an AI explanation."],
    )


def fallback_summary(contexts: list[FindingContext]) -> ScanSummary:
    if not contexts:
        return ScanSummary(
            overview="No open findings were reported for this scan. Check scan coverage before treating this as clean.",
            top_risks=[],
            first_actions=[],
        )
    top = contexts[:5]
    return ScanSummary(
        overview="These are the most severe open findings in this scan, ordered by severity. "
                 "An AI summary is not available, so standard guidance is shown.",
        top_risks=[f"[{c.ref}] {c.severity}: {c.title}" + (f" ({c.file_path})" if c.file_path else "") for c in top],
        first_actions=[fallback_explanation(c).fix_steps[0] for c in top],
    )
