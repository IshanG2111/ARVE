"""Input and output contracts for ARVE AI assistance."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class CodeContext(BaseModel):
    """Redacted code shown to the model for one finding."""
    model_config = ConfigDict(extra="forbid")

    source: Literal["ast", "lines"]
    file_path: str
    start_line: int = Field(..., ge=1)
    end_line: int = Field(..., ge=1)
    symbol_name: Optional[str] = None
    symbol_kind: Optional[str] = None
    code: str
    related: list[str] = Field(default_factory=list)


class FindingContext(BaseModel):
    """Everything the prompt is allowed to see about one finding.

    ``ref`` is a request-local alias such as ``F1``; database IDs never reach the model.
    """
    model_config = ConfigDict(extra="forbid")

    ref: str
    engine: str
    finding_type: str
    rule_id: Optional[str] = None
    title: str
    message: Optional[str] = None
    severity: str
    file_path: Optional[str] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    cwe: Optional[str] = None
    cve: Optional[str] = None
    package_name: Optional[str] = None
    package_version: Optional[str] = None
    fixed_version: Optional[str] = None
    ecosystem: Optional[str] = None
    catalog_fix: Optional[str] = None
    code: Optional[CodeContext] = None


class FindingExplanation(BaseModel):
    """Structured model answer for one finding."""
    model_config = ConfigDict(extra="forbid")

    summary: str
    why_it_matters: str
    fix_steps: list[str]
    suggested_code: Optional[str] = None
    references_used: list[str]
    caveats: list[str] = Field(default_factory=list)


class ScanSummary(BaseModel):
    """Structured model answer for the top findings of a scan."""
    model_config = ConfigDict(extra="forbid")

    overview: str
    top_risks: list[str]
    first_actions: list[str]
