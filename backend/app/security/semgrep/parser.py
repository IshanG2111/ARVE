"""Defensive JSON parser for Semgrep SAST artifacts."""
from __future__ import annotations

import json
import logging
from typing import Any, Union

from app.security.semgrep.models import (
    SemgrepLocation,
    SemgrepMetadata,
    SemgrepOutput,
    SemgrepResult,
)

logger = logging.getLogger(__name__)


def _normalize_string_list(raw_value: Any) -> list[str]:
    """Coerce string, list of strings, or mixed types into a clean list of strings."""
    if not raw_value:
        return []
    if isinstance(raw_value, str):
        cleaned = raw_value.strip()
        return [cleaned] if cleaned else []
    if isinstance(raw_value, (list, tuple, set)):
        result: list[str] = []
        for item in raw_value:
            if item is not None:
                val = str(item).strip()
                if val:
                    result.append(val)
        return result
    return [str(raw_value).strip()]


def _parse_location(raw: Any, default_line: int = 1) -> SemgrepLocation:
    """Safely extract line and column from a Semgrep position object."""
    if not isinstance(raw, dict):
        return SemgrepLocation(line=default_line)

    raw_line = raw.get("line")
    try:
        line = int(raw_line) if raw_line is not None else default_line
        if line < 1:
            line = default_line
    except (ValueError, TypeError):
        line = default_line

    col: int | None = None
    raw_col = raw.get("col")
    if raw_col is not None:
        try:
            col = int(raw_col)
        except (ValueError, TypeError):
            col = None

    offset: int | None = None
    raw_offset = raw.get("offset")
    if raw_offset is not None:
        try:
            offset = int(raw_offset)
        except (ValueError, TypeError):
            offset = None

    return SemgrepLocation(line=line, col=col, offset=offset)


def _parse_metadata(raw_metadata: Any) -> SemgrepMetadata:
    """Parse and normalize Semgrep metadata dictionary."""
    if not isinstance(raw_metadata, dict):
        return SemgrepMetadata()

    cwe = _normalize_string_list(raw_metadata.get("cwe"))
    owasp = _normalize_string_list(raw_metadata.get("owasp"))
    technology = _normalize_string_list(raw_metadata.get("technology"))
    references = _normalize_string_list(raw_metadata.get("references"))

    confidence = raw_metadata.get("confidence")
    if confidence is not None:
        confidence = str(confidence).strip().upper() or None

    category = raw_metadata.get("category")
    if category is not None:
        category = str(category).strip().lower() or None

    shortlink = raw_metadata.get("shortlink")
    if shortlink is not None:
        shortlink = str(shortlink).strip() or None

    arve_title = raw_metadata.get("arve_title")
    if arve_title is not None:
        arve_title = str(arve_title).strip() or None

    arve_remediation = raw_metadata.get("arve_remediation")
    if arve_remediation is not None:
        arve_remediation = str(arve_remediation).strip() or None

    remediation_id = raw_metadata.get("remediation_id")
    if remediation_id is not None:
        remediation_id = str(remediation_id).strip() or None

    provenance = raw_metadata.get("provenance")
    if provenance is not None:
        provenance = str(provenance).strip() or None

    return SemgrepMetadata(
        cwe=cwe,
        owasp=owasp,
        confidence=confidence,
        category=category,
        technology=technology,
        references=references,
        shortlink=shortlink,
        arve_title=arve_title,
        arve_remediation=arve_remediation,
        remediation_id=remediation_id,
        provenance=provenance,
        raw=raw_metadata,
    )


def parse_semgrep_output(raw_content: Union[str, dict[str, Any], list[Any], None]) -> SemgrepOutput:
    """Parse raw Semgrep CLI JSON artifact safely without throwing unexpected exceptions."""
    if raw_content is None:
        return SemgrepOutput()

    data: Any = raw_content
    if isinstance(raw_content, str):
        cleaned = raw_content.strip()
        if not cleaned:
            return SemgrepOutput()
        try:
            data = json.loads(cleaned)
        except Exception as exc:
            logger.warning("Failed to parse Semgrep output as JSON: %s", exc)
            return SemgrepOutput(errors=[{"message": f"Malformed JSON: {exc}"}])

    if isinstance(data, list):
        # Alternate/older Semgrep format: list of matches directly
        raw_results = data
        raw_errors: list[Any] = []
        raw_paths: dict[str, Any] = {}
        version = None
    elif isinstance(data, dict):
        raw_results = data.get("results") or []
        raw_errors = data.get("errors") or []
        raw_paths = data.get("paths") or {}
        version = str(data.get("version")) if data.get("version") else None
    else:
        logger.warning("Semgrep output is neither a JSON object nor array: %s", type(data))
        return SemgrepOutput(errors=[{"message": f"Unexpected JSON type: {type(data).__name__}"}])

    results: list[SemgrepResult] = []
    if isinstance(raw_results, list):
        for item in raw_results:
            if not isinstance(item, dict):
                continue

            check_id = str(item.get("check_id") or "semgrep.unknown").strip()
            path = str(item.get("path") or "").strip()

            start = _parse_location(item.get("start"), default_line=1)
            end = _parse_location(item.get("end"), default_line=start.line)
            if end.line < start.line:
                end.line = start.line

            extra = item.get("extra") if isinstance(item.get("extra"), dict) else {}
            message = str(extra.get("message") or "Semgrep finding").strip()
            severity = str(extra.get("severity") or "WARNING").strip().upper()

            metadata = _parse_metadata(extra.get("metadata"))
            lines = str(extra.get("lines")) if extra.get("lines") is not None else None
            dataflow_trace = extra.get("dataflow_trace") if isinstance(extra.get("dataflow_trace"), dict) else None
            fix = str(extra.get("fix")) if extra.get("fix") is not None else None
            metavars = extra.get("metavars") if isinstance(extra.get("metavars"), dict) else {}

            results.append(
                SemgrepResult(
                    check_id=check_id,
                    path=path,
                    start=start,
                    end=end,
                    message=message,
                    severity=severity,
                    metadata=metadata,
                    lines=lines,
                    dataflow_trace=dataflow_trace,
                    fix=fix,
                    metavars=metavars,
                    raw=item,
                )
            )

    scanned_paths: list[str] = []
    skipped_paths: list[dict[str, Any]] = []
    if isinstance(raw_paths, dict):
        raw_scanned = raw_paths.get("scanned")
        if isinstance(raw_scanned, list):
            scanned_paths = [str(p) for p in raw_scanned if p]
        raw_skipped = raw_paths.get("skipped")
        if isinstance(raw_skipped, list):
            skipped_paths = [s for s in raw_skipped if isinstance(s, dict)]

    errors_list: list[dict[str, Any]] = []
    if isinstance(raw_errors, list):
        for err in raw_errors:
            if isinstance(err, dict):
                errors_list.append(err)
            elif err:
                errors_list.append({"message": str(err)})

    return SemgrepOutput(
        results=results,
        errors=errors_list,
        paths_scanned=scanned_paths,
        paths_skipped=skipped_paths,
        version=version,
    )
