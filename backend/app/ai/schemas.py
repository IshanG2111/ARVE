"""Pydantic schemas for structured AI security summaries."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class AIPriorityItem(BaseModel):
    """Actionable remediation task with engineering triage priority."""

    priority: str = Field(..., description="Triage priority: P0 (immediate), P1 (urgent), P2 (scheduled), P3 (backlog).")
    action: str = Field(..., description="Concrete, actionable remediation command or code change.")
    target: Optional[str] = Field(None, description="Specific package, file, or component affected.")
    rationale: Optional[str] = Field(None, description="Brief technical justification for this priority level.")


class AISummary(BaseModel):
    """Structured AI security evaluation for a completed ARVE scan."""

    overall_summary: str = Field(
        ...,
        description="Concise executive synthesis (~100-150 words) of repository security posture and findings breakdown.",
    )
    main_concerns: List[str] = Field(
        default_factory=list,
        description="Key high-impact security exposures formatted as '[SEVERITY] Flaw in <target>: brief reason'.",
    )
    risk_overview: str = Field(
        ...,
        description="Where vulnerabilities and defect density concentrate (e.g. auth dependencies, specific routes).",
    )
    impact: str = Field(
        ...,
        description="Realistic, evidence-based blast radius without hypothetical zero-day speculation.",
    )
    reachability_assessment: Optional[str] = Field(
        None,
        description="Distinction between code-level reachability (via AST/routes) and passive dependency presence.",
    )
    consolidated_remediations: List[str] = Field(
        default_factory=list,
        description="Consolidated upgrade actions resolving multiple advisories under shared parent packages.",
    )
    prioritized_actions: List[AIPriorityItem] = Field(
        default_factory=list,
        description="Actionable tasks sorted by triage priority (P0, P1, P2, P3).",
    )
    priority_actions: List[str] = Field(
        default_factory=list,
        description="Backward-compatible list of prioritized action strings.",
    )
    positive_observations: List[str] = Field(
        default_factory=list,
        description="Factual, verifiable security strengths observed in the scan (empty if none verified).",
    )


class AISummaryMetadata(BaseModel):
    """Metadata regarding AI generation, token consumption, and caching."""

    provider: str = "gemini"
    cache_key: str
    cache_hit: bool = False
    is_fallback: bool = False
    model: str
    served_model: Optional[str] = None
    prompt_version: str
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    thought_tokens: Optional[int] = None
    latency_ms: Optional[int] = None


class AISummaryResult(BaseModel):
    """Combined output containing validated AI summary and generation metadata."""

    summary: AISummary
    metadata: AISummaryMetadata
