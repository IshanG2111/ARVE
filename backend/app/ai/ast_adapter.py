"""Bridge between ARVE AI assistance and the AST teammate's output.

The AST tool ("ARVE Tree-sitter AST", schema 1.0.0) writes one JSON file per
analysis. Each entry in ``files`` has a repo-relative POSIX ``path``, a
``status`` and lists of ``functions`` (methods carry ``enclosing_class_id``),
``classes`` and ``imports``. Locations are 1-indexed and inclusive. Resolved
call edges are top-level ``relationships`` of type ``CALLS``.

Files are looked up as ``<AST_OUTPUT_DIR>/<analysis_run_id>.json``, then
``<commit_sha>.json``. Any problem returns ``None`` so callers fall back to a
plain line window.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Languages the AST covers, as named by app.ingestion.detector.language_detector.
AST_LANGUAGES = frozenset({"PHP", "Java", "TypeScript", "JavaScript", "Go", "Python"})
SUPPORTED_SCHEMA_MAJOR = "1"
MAX_NAME_CHARS = 120
ANONYMOUS = "<anonymous>"


@dataclass(frozen=True)
class AstSymbol:
    """A function, method or class from the AST output. Lines are 1-indexed and inclusive."""
    name: str
    kind: str
    start_line: int
    end_line: int
    qualified_name: Optional[str] = None
    callers: list[str] = field(default_factory=list)
    calls: list[str] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)


def _short(text: Any) -> str:
    value = " ".join(str(text).split())
    return value if len(value) <= MAX_NAME_CHARS else value[: MAX_NAME_CHARS - 3] + "..."


def _lines(entity: dict[str, Any]) -> tuple[int, int]:
    location = entity["location"]
    return int(location["start_line"]), int(location["end_line"])


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(v for v in values if v))


def parse_ast_document(document: dict[str, Any]) -> dict[str, list[AstSymbol]]:
    """Index an AST JSON document as ``{file_path: [symbols]}``.

    Only files that parsed successfully are indexed; syntax-error files may have
    wrong ranges.
    """
    schema_version = str(document.get("schema_version", ""))
    if schema_version.split(".")[0] != SUPPORTED_SCHEMA_MAJOR:
        raise ValueError(f"unsupported AST schema_version {schema_version!r}")

    function_names: dict[str, str] = {}
    for file_entry in document.get("files", []):
        for function in file_entry.get("functions", []):
            function_names[function["id"]] = function.get("name") or ANONYMOUS

    callers_by_function: dict[str, list[str]] = {}
    for relation in document.get("relationships", []):
        if relation.get("type") != "CALLS" or relation.get("resolution_status") != "resolved":
            continue
        caller = function_names.get(relation.get("source_id", ""))
        if caller and caller != ANONYMOUS:
            callers_by_function.setdefault(relation.get("target_id", ""), []).append(caller)

    index: dict[str, list[AstSymbol]] = {}
    for file_entry in document.get("files", []):
        if file_entry.get("status") != "success":
            continue
        path = str(file_entry["path"]).replace("\\", "/")
        imports = _unique([_short(i.get("name", "")) for i in file_entry.get("imports", [])])
        class_names: dict[str, str] = {}
        symbols: list[AstSymbol] = []

        for cls in file_entry.get("classes", []):
            class_names[cls["id"]] = cls.get("name") or ANONYMOUS
            start, end = _lines(cls)
            symbols.append(AstSymbol(
                name=class_names[cls["id"]],
                kind=cls.get("kind") or "class",
                start_line=start,
                end_line=end,
                qualified_name=class_names[cls["id"]],
                imports=imports,
            ))

        for function in file_entry.get("functions", []):
            name = function.get("name") or ANONYMOUS
            owner = class_names.get(function.get("enclosing_class_id") or "")
            start, end = _lines(function)
            symbols.append(AstSymbol(
                name=name,
                kind="method" if owner else "function",
                start_line=start,
                end_line=end,
                qualified_name=f"{owner}.{name}" if owner else name,
                callers=_unique(callers_by_function.get(function["id"], [])),
                calls=_unique([_short(c.get("name", "")) for c in function.get("calls", [])]),
                imports=imports,
            ))
        index[path] = symbols
    return index


def _ast_file_for(analysis_run_id: str, commit_sha: str | None) -> Optional[Path]:
    if not settings.AST_OUTPUT_DIR:
        return None
    base = Path(settings.AST_OUTPUT_DIR)
    for key in (analysis_run_id, commit_sha):
        if key and "/" not in key and "\\" not in key and ".." not in key:
            candidate = base / f"{key}.json"
            if candidate.is_file():
                return candidate
    return None


@lru_cache(maxsize=4)
def _load_index(path: str, mtime_ns: int) -> tuple[Optional[str], dict[str, list[AstSymbol]]]:
    """Parse one AST file into ``(commit_sha, index)``. ``mtime_ns`` keys the cache so rewrites are picked up."""
    with open(path, encoding="utf-8") as handle:
        document = json.load(handle)
    commit = (document.get("analysis") or {}).get("commit_sha")
    return (str(commit).strip().lower() if commit else None), parse_ast_document(document)


def load_symbols(analysis_run_id: str, commit_sha: str | None, file_path: str) -> Optional[list[AstSymbol]]:
    """Return the AST symbols for one file, or ``None`` when no usable AST output exists.

    A file that records a different ``analysis.commit_sha`` than the scan is stale and ignored.
    """
    ast_file = _ast_file_for(analysis_run_id, commit_sha)
    if ast_file is None:
        return None
    file_commit, index = _load_index(str(ast_file), os.stat(ast_file).st_mtime_ns)
    if file_commit and commit_sha and file_commit != commit_sha.strip().lower():
        logger.warning("Ignoring AST output %s: commit %s does not match scan commit %s", ast_file.name, file_commit, commit_sha)
        return None
    return index.get(file_path.replace("\\", "/"))


def find_enclosing_symbol(
    symbols: list[AstSymbol], start_line: int, end_line: int
) -> Optional[AstSymbol]:
    """Pick the smallest symbol whose range contains the whole finding."""
    containing = [s for s in symbols if s.start_line <= start_line and s.end_line >= end_line]
    if not containing:
        return None
    return min(containing, key=lambda s: (s.end_line - s.start_line, -s.start_line))


def get_enclosing_symbol(
    analysis_run_id: str,
    commit_sha: str | None,
    file_path: str,
    language: str | None,
    start_line: int,
    end_line: int,
) -> Optional[AstSymbol]:
    """Return the enclosing symbol for a finding, or ``None`` to use the line-window fallback.

    Never raises: AST problems must not break AI assistance.
    """
    if language not in AST_LANGUAGES:
        return None
    try:
        symbols = load_symbols(analysis_run_id, commit_sha, file_path)
    except Exception:  # noqa: BLE001 - any AST failure falls back to the line window
        logger.warning("AST output unusable for analysis run %s", analysis_run_id, exc_info=True)
        return None
    if not symbols:
        return None
    return find_enclosing_symbol(symbols, start_line, end_line)
