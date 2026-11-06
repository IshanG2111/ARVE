"""Prompt engineering and canonical payload builder for Gemini Flash."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

PROMPT_VERSION = "2026.11.02"
OUTPUT_SCHEMA_VERSION = "1.0.0"

SYSTEM_INSTRUCTION = """You are ARVE Security Intelligence, an automated application security engine.
Your role is to produce a concise, high-density, professional technical security evaluation based strictly on canonical scanner evidence.

TONE AND STYLE CONSTRAINTS:
1. NO conversational filler, boilerplate intros/outros, or hedging (forbidden: "It is important to note", "In today's landscape", "Security is a continuous journey", "Furthermore", "In conclusion").
2. Be dense, direct, and factual. Use active voice and clear engineering terminology.
3. Every concern and priority action MUST cite the specific vulnerability type, file location, or rule from the scan data.
4. If findings exist, state the exact blast radius and exploitation mechanism concisely.
5. If zero findings exist, state clearly that static scanners detected no vulnerabilities within configured rulesets and highlight verified clean areas.
6. Return output strictly in valid JSON matching the schema. No markdown wrapping or backticks.
"""

def build_canonical_scan_input(
    project_name: str,
    repository_full_name: Optional[str],
    language: Optional[str],
    frameworks: Optional[str],
    findings: List[Dict[str, Any]],
    ast_summary: Optional[Dict[str, Any]] = None,
    security_contexts: Optional[List[Dict[str, Any]]] = None,
    max_findings_sample: int = 25,
) -> Dict[str, Any]:
    """Construct a canonical, deterministic dictionary representing the scan input.
    
    Volatile metadata like execution timestamps, scan IDs, and user IDs are excluded
    so identical repository scan results yield identical cache keys.
    """
    # 1. Severity counts breakdown
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    # Group findings by fingerprint or (rule_id, file_path) to aggregate repetitive alerts
    rule_aggregates: Dict[str, Dict[str, Any]] = {}

    sorted_findings = sorted(
        findings,
        key=lambda f: (
            {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}.get(
                str(f.get("severity", "")).upper(), 5
            ),
            f.get("rule_id") or "",
            f.get("file_path") or "",
            f.get("line_start") or 0,
        ),
    )

    for finding in sorted_findings:
        sev = str(finding.get("severity", "LOW")).upper()
        if sev in severity_counts:
            severity_counts[sev] += 1
        else:
            severity_counts["LOW"] += 1

        rule_id = finding.get("rule_id") or finding.get("title") or "UnknownRule"
        if rule_id not in rule_aggregates:
            rule_aggregates[rule_id] = {
                "rule_id": rule_id,
                "title": finding.get("title", ""),
                "severity": sev,
                "engine": finding.get("engine", ""),
                "cwe": finding.get("cwe"),
                "cve": finding.get("cve"),
                "occurrences": 0,
                "sample_locations": [],
            }
        agg = rule_aggregates[rule_id]
        agg["occurrences"] += 1
        if len(agg["sample_locations"]) < 2:
            loc = {
                "file": finding.get("file_path"),
                "line": finding.get("line_start"),
            }
            if finding.get("description"):
                loc["snippet"] = str(finding.get("description"))[:80]
            agg["sample_locations"].append(loc)

    # 2. Canonical AST summary
    ast_data: Dict[str, Any] = {}
    if ast_summary:
        ast_data = {
            "functions": ast_summary.get("functions", 0),
            "classes": ast_summary.get("classes", 0),
            "imports": ast_summary.get("imports", 0),
            "relationships": ast_summary.get("relationships", 0),
        }

    # 3. Canonical security context mapping (top routes/functions affected)
    canonical_contexts: List[Dict[str, Any]] = []
    if security_contexts:
        for ctx in security_contexts[:50]:
            canonical_contexts.append({
                "file": ctx.get("file_path"),
                "function": ctx.get("function"),
                "class": ctx.get("class"),
                "route": ctx.get("route"),
                "framework": ctx.get("framework"),
            })

    # Sort aggregated rules by severity and count
    aggregated_rules_list = sorted(
        rule_aggregates.values(),
        key=lambda r: (
            {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}.get(r["severity"], 5),
            -r["occurrences"],
        ),
    )

    return {
        "project": {
            "name": project_name,
            "repository": repository_full_name,
            "primary_language": language,
            "frameworks": frameworks,
        },
        "metrics": {
            "total_findings": len(findings),
            "severity_distribution": severity_counts,
        },
        "ast_overview": ast_data,
        "affected_contexts": canonical_contexts[:20],
        "findings_summary": aggregated_rules_list[:max_findings_sample],
    }


def build_gemini_prompt(canonical_input: Dict[str, Any]) -> str:
    """Format the canonical input into the user prompt for Gemini Flash."""
    payload_json = json.dumps(canonical_input, indent=2, sort_keys=True)
    return f"""Analyze this ARVE scan dataset and output a strict technical security assessment in valid JSON.

SCAN DATASET:
{payload_json}

SCHEMA FIELD REQUIREMENTS:
- overall_summary: 1-2 dense sentences summarizing total findings ({canonical_input.get('metrics', {}).get('total_findings', 0)} total: {json.dumps(canonical_input.get('metrics', {}).get('severity_distribution', {}))}) and top risk vectors.
- main_concerns: 2-4 concise bullets. Format each as: "[SEVERITY] Flaw Name in <path/file>: brief technical reason".
- risk_overview: 1-2 sentences identifying exact components, routes, or modules with the highest defect density.
- impact: 1-2 sentences on realistic exploitation blast radius (e.g. data exfiltration, secret compromise, service disruption).
- priority_actions: 2-4 concrete remediation directives for engineers (e.g. "Sanitize query input in <file>", "Rotate leaked secret <key>").
- positive_observations: 1-2 factual observations of safe controls (e.g. clean dependency trees, zero critical secrets, or safe frameworks). If none, empty list [].
"""

