"""CodeQL SARIF 2.1.0 -> ARVE canonical finding mapper."""
from __future__ import annotations

import json
import logging
import re
from pathlib import PurePosixPath
from typing import Any, Optional
from urllib.parse import unquote, urlparse

from app.security.mappers.base import FindingMapper
from app.security.models import (
    EngineName,
    FindingConfidence,
    FindingStatus,
    FindingType,
    NormalizedFinding,
)
from app.security.severity import FindingSeverity, normalize_severity

logger = logging.getLogger(__name__)

_CWE_RE = re.compile(r"(?i)\bCWE[-_ ]?(\d+)\b")
_CONFIDENCE_MAP = {
    "very-high": FindingConfidence.HIGH,
    "very_high": FindingConfidence.HIGH,
    "high": FindingConfidence.HIGH,
    "medium": FindingConfidence.MEDIUM,
    "low": FindingConfidence.LOW,
    "very-low": FindingConfidence.LOW,
    "very_low": FindingConfidence.LOW,
}


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _text(value: Any) -> Optional[str]:
    if isinstance(value, dict):
        value = value.get("text") or value.get("markdown")
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _clean_file_path(raw_uri: Any) -> Optional[str]:
    if not raw_uri or not isinstance(raw_uri, str):
        return None
    uri = unquote(raw_uri.strip()).replace("\\", "/")
    parsed = urlparse(uri)
    if parsed.scheme == "file":
        uri = parsed.path or parsed.netloc
    elif parsed.scheme and parsed.path:
        uri = parsed.path
    for prefix in ("/code/", "code/", "/workspace/", "workspace/"):
        if uri.startswith(prefix):
            uri = uri[len(prefix):]
            break
    while uri.startswith("./"):
        uri = uri[2:]
    cleaned = str(PurePosixPath(uri)).lstrip("/")
    return cleaned or None


def _extract_properties(rule: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    for source in (rule.get("properties"), result.get("properties")):
        if isinstance(source, dict):
            properties.update(source)
    return properties


def _extract_cwe(properties: dict[str, Any], rule: dict[str, Any]) -> Optional[str]:
    candidates: list[Any] = []
    for source in (properties, rule):
        if not isinstance(source, dict):
            continue
        for key in ("tags", "cwe", "cwe_ids"):
            candidates.extend(_as_list(source.get(key)))
    for item in candidates:
        match = _CWE_RE.search(str(item))
        if match:
            return f"CWE-{match.group(1)}"
    return None


def _extract_owasp(properties: dict[str, Any]) -> list[str]:
    values = []
    for item in _as_list(properties.get("tags")) + _as_list(properties.get("owasp")):
        raw = str(item).strip()
        if raw and "owasp" in raw.lower():
            values.append(raw)
    return sorted(set(values))


def _severity_from_sarif(result: dict[str, Any], properties: dict[str, Any]) -> FindingSeverity:
    security_severity = properties.get("security-severity") or properties.get("security_severity")
    if security_severity is not None:
        try:
            return normalize_severity(float(str(security_severity).strip()))
        except (TypeError, ValueError):
            pass

    for key in ("problem.severity", "problem_severity", "severity"):
        raw = properties.get(key)
        if raw:
            return normalize_severity(raw)

    raw_level = result.get("level")
    if raw_level:
        return normalize_severity(str(raw_level))

    return FindingSeverity.MEDIUM


def _confidence_from_sarif(result: dict[str, Any], properties: dict[str, Any]) -> Optional[FindingConfidence]:
    result_properties = result.get("properties")
    result_properties = result_properties if isinstance(result_properties, dict) else {}
    raw = properties.get("precision") or properties.get("Precision") or result_properties.get("precision")
    mapped = _CONFIDENCE_MAP.get(str(raw).strip().lower()) if raw else None
    return mapped


class CodeqlFindingMapper(FindingMapper):
    """Map native CodeQL SARIF into ARVE canonical NormalizedFinding objects."""

    @property
    def engine_name(self) -> str:
        return EngineName.CODEQL.value

    def map_artifact(
        self,
        raw_content: Any,
        context: Optional[dict[str, Any]] = None,
    ) -> list[NormalizedFinding]:
        if raw_content is None:
            return []

        data = raw_content
        if isinstance(raw_content, str):
            content = raw_content.strip()
            if not content:
                return []
            try:
                data = json.loads(content)
            except json.JSONDecodeError as exc:
                logger.warning("Failed to parse CodeQL SARIF: %s", exc)
                return []

        if not isinstance(data, dict) or data.get("runs") is None:
            return []
        if data.get("version") not in {None, "2.1.0"}:
            logger.warning("CodeQL artifact is not SARIF 2.1.0")
            return []

        runs = data.get("runs") or []
        if not isinstance(runs, list):
            return []

        findings: list[NormalizedFinding] = []
        for run in runs:
            if not isinstance(run, dict):
                continue

            tool = run.get("tool") or {}
            driver = tool.get("driver") if isinstance(tool, dict) else {}
            driver = driver if isinstance(driver, dict) else {}
            engine_version = _text(driver.get("version"))

            rule_index: dict[str, dict[str, Any]] = {}
            for rule in _as_list(driver.get("rules")):
                if isinstance(rule, dict):
                    rid = str(rule.get("id") or "").strip()
                    if rid:
                        rule_index[rid] = rule

            for result in _as_list(run.get("results")):
                if not isinstance(result, dict):
                    continue

                rule_id = str(result.get("ruleId") or "").strip() or "codeql-finding"
                rule = rule_index.get(rule_id, {})
                properties = _extract_properties(rule, result)

                message = _text(result.get("message")) or f"CodeQL finding: {rule_id}"
                title = (
                    _text(rule.get("shortDescription"))
                    or _text(rule.get("name"))
                    or f"CodeQL: {rule_id}"
                )
                description = _text(rule.get("fullDescription")) or message

                locations = _as_list(result.get("locations"))
                primary = locations[0] if locations and isinstance(locations[0], dict) else {}
                physical = primary.get("physicalLocation") if isinstance(primary, dict) else {}
                physical = physical if isinstance(physical, dict) else {}
                region = physical.get("region") if isinstance(physical, dict) else {}
                region = region if isinstance(region, dict) else {}
                artifact_location = physical.get("artifactLocation") if isinstance(physical, dict) else {}
                artifact_location = artifact_location if isinstance(artifact_location, dict) else {}

                file_path = _clean_file_path(artifact_location.get("uri"))

                try:
                    line_start = int(region.get("startLine")) if region.get("startLine") is not None else None
                except (TypeError, ValueError):
                    line_start = None
                try:
                    line_end = int(region.get("endLine")) if region.get("endLine") is not None else line_start
                except (TypeError, ValueError):
                    line_end = line_start

                if line_start is not None and line_start < 1:
                    line_start = None
                if line_end is not None and line_end < 1:
                    line_end = line_start
                if line_start is not None and line_end is not None and line_end < line_start:
                    line_end = line_start

                cwe = _extract_cwe(properties, rule)
                owasp = _extract_owasp(properties)

                findings.append(
                    NormalizedFinding(
                        engine=self.engine_name,
                        finding_type=FindingType.SAST.value,
                        title=title,
                        description=description,
                        severity=_severity_from_sarif(result, properties),
                        confidence=_confidence_from_sarif(result, properties),
                        status=FindingStatus.OPEN,
                        file_path=file_path,
                        line_start=line_start,
                        line_end=line_end,
                        cwe=cwe,
                        rule_id=rule_id,
                        raw_json={
                            "rule_id": rule_id,
                            "message": message,
                            "level": result.get("level"),
                            "security_severity": properties.get("security-severity"),
                            "precision": properties.get("precision"),
                            "cwe": cwe,
                            "owasp": owasp,
                            "engine_version": engine_version,
                            "help_uri": _text(rule.get("helpUri")),
                            "result": result,
                        },
                    )
                )

        return findings
