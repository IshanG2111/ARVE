"""Schemas for ARVE unified security reports."""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ReportFindingItem(BaseModel):
    """Normalized finding entry with stable identifier ARVE-F001 for cards and appendix."""

    id: str
    display_id: str = "ARVE-F001"  # Stable traceable identifier (e.g. ARVE-F001)
    title: str
    severity: str
    file_path: Optional[str] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    engine: str
    rule_id: Optional[str] = None
    package_name: Optional[str] = None
    package_version: Optional[str] = None
    fixed_version: Optional[str] = None
    cwe: Optional[str] = None
    cve: Optional[str] = None
    ghsa: Optional[str] = None
    description: Optional[str] = None

    # Structured finding card blocks (clean 6-field format)
    issue_summary: Optional[str] = None
    potential_impact: Optional[str] = None
    recommended_fix: Optional[str] = None
    applicability: str = "Reachability unverified"

    raw_evidence: Optional[str] = None
    fingerprint: str
    status: str = "OPEN"


class PriorityRiskItem(BaseModel):
    """Top security concern grouped by vulnerability or component (Section 02)."""

    index: str  # "01", "02", "03"
    title: str  # e.g. "Authentication vulnerabilities"
    severity: str  # e.g. "Critical", "Medium*"
    description: str  # Concise issue description
    target: str  # e.g. "@auth/core, next-auth"
    severity_footnote: Optional[str] = None  # Footnote for scanner severity alignment
    related_finding_ids: List[str] = Field(default_factory=list)  # Stable IDs (e.g. ["ARVE-F001", "ARVE-F003"])
    related_finding_uuids: List[str] = Field(default_factory=list)  # Canonical DB IDs


class AIProvenanceMetadata(BaseModel):
    """Internal technical provenance metadata for AI-generated assessment."""

    provider: str = "groq"  # "groq", "ollama", "deterministic-engine"
    model: str = "openai/gpt-oss-120b"
    prompt_version: str = "2026.11.02"
    schema_version: str = "2026.11.02"
    generation_status: str = "success"  # "success", "failed", "fallback"
    generated_at: str = ""
    cache_status: str = "fresh"  # "fresh", "cached", "fallback"
    input_hash: str = ""
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    thought_tokens: Optional[int] = None
    latency_ms: Optional[int] = None


class PriorityActionItem(BaseModel):
    """Structured remediation action item grouped by priority (Section 03)."""

    priority: str  # "Priority 1" (Immediate), "Priority 2" (Next), "Priority 3" (Maintenance)
    action: str
    target: Optional[str] = None
    rationale: Optional[str] = None


class EngineCoverageItem(BaseModel):
    """Engine execution summary within the analysis coverage report."""

    engine_name: str
    status: str
    purpose: str = "Security scanning"
    duration_ms: Optional[int] = None
    findings_count: int = 0
    notes: Optional[str] = None


class ASTCoverageInfo(BaseModel):
    """AST code intelligence analysis coverage metrics."""

    status: str = "Not indexed"  # "Not indexed" or "Completed"
    total_functions: int = 0
    total_classes: int = 0
    total_imports: int = 0
    total_relationships: int = 0
    files_discovered: int = 0
    files_parsed: int = 0
    files_failed: int = 0
    data_available: bool = False
    error_summary: Optional[str] = None
    notes: Optional[str] = None


class ScanReportData(BaseModel):
    """Unified, self-contained report data model."""

    scan_id: str
    project_id: str
    project_name: str
    repository_name: Optional[str] = None
    commit_sha: str
    scan_timestamp: str
    scan_status: str

    # 01 — Executive Summary (Concise ~100-150 words derived from canonical counts)
    executive_summary: str
    main_concerns: List[str] = Field(default_factory=list)
    risk_overview: str
    impact: str
    reachability_assessment: Optional[str] = None
    positive_observations: List[str] = Field(default_factory=list)
    is_ai_fallback: bool = False
    ai_model: str = "openai/gpt-oss-120b"
    ai_status_message: str = ""
    provenance: Optional[AIProvenanceMetadata] = None

    # 02 — Security Overview & Priority Risks
    severity_counts: Dict[str, int] = Field(
        default_factory=lambda: {
            "CRITICAL": 0,
            "HIGH": 0,
            "MEDIUM": 0,
            "LOW": 0,
            "INFO": 0,
        }
    )
    total_findings: int = 0
    priority_risks: List[PriorityRiskItem] = Field(default_factory=list)

    # 03 — Recommended Actions (Remediation Plan)
    prioritized_actions: List[PriorityActionItem] = Field(default_factory=list)
    consolidated_remediations: List[str] = Field(default_factory=list)
    ai_recommendations: List[str] = Field(default_factory=list)

    # 04 — Detailed Vulnerability Report
    important_findings: List[ReportFindingItem] = Field(default_factory=list)

    # 05 — Analysis Coverage (Engines + AST Code Intelligence)
    engine_coverage: List[EngineCoverageItem] = Field(default_factory=list)
    ast_coverage: Optional[ASTCoverageInfo] = None
    ast_status_label: str = "Not indexed"
    limitations: List[str] = Field(default_factory=list)

    # 06 — Complete Findings Inventory (Full deduplicated inventory)
    appendix_findings: List[ReportFindingItem] = Field(default_factory=list)
