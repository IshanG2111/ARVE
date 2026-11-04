# ARVE Security Audit Report --- Format & Website Implementation Plan

> **Document type:** Product and engineering implementation plan\
> **Status:** Proposed implementation baseline\
> **Scope:** Generate, store, preview and download professional security
> audit reports from persisted ARVE scan evidence.

------------------------------------------------------------------------

## 1. Objective

Build a report-generation system that turns a completed ARVE scan into a
professional, readable and evidence-backed security audit that users can
preview and download from the ARVE website.

The report must serve two audiences:

1.  **Decision-makers:** need an executive overview, business impact,
    risk priorities and remediation status.
2.  **Developers/security reviewers:** need exact findings, affected
    code, evidence, attack paths, technical context and validation
    steps.

The report is a formal presentation of ARVE's analysis. It must not
create new findings or alter the underlying scan.

### Core rule

``` text
PERSISTED SCAN DATA
       ↓
REPORT DATA SNAPSHOT
       ↓
DETERMINISTIC CALCULATIONS + VERIFIED REFERENCES
       ↓
OPTIONAL AI-GENERATED EXPLANATIONS
       ↓
SCHEMA / EVIDENCE VALIDATION
       ↓
HTML PREVIEW
       ↓
PDF DOWNLOAD
```

The AI may improve readability, explain technical context and draft
remediation narratives. Counts, severity, risk scores, finding IDs,
source locations and attack-path relationships must come from persisted
ARVE data.

------------------------------------------------------------------------

## 2. Product Requirements

The report system must:

-   Generate a report only for an eligible completed scan.
-   Identify the repository, branch/commit and scan time.
-   Summarise findings by severity and category.
-   Explain the most important risks in plain language.
-   Show attack paths when validated paths exist.
-   Include security patterns only when backed by persisted pattern
    records.
-   Include exact code evidence and source references.
-   Prioritise remediation transparently.
-   Show scan coverage and analysis limitations.
-   Support a polished on-site preview.
-   Support PDF download.
-   Preserve historical reports even if a later scan changes the current
    project state.
-   Enforce report ownership and project authorization.
-   Clearly distinguish missing analysis from zero detected findings.

------------------------------------------------------------------------

## 3. Report Generation Architecture

Implement inside the existing FastAPI modular monolith.

``` text
Next.js Reports UI
       |
       v
FastAPI Reports API
       |
       v
Report Orchestrator
       |
       +--> Authorization / scan status
       |
       +--> Report Snapshot Builder
       |      |
       |      +--> PostgreSQL: project, scan, findings, risk
       |      +--> AST/code evidence
       |      +--> Neo4j: validated graph/path data
       |      +--> Pattern engine records
       |      +--> Remediation records
       |
       +--> Deterministic Report Aggregator
       |
       +--> Optional AI Narrative Service
       |      |
       |      +--> AI Assistant / LLM Gateway
       |      +--> Structured narrative validation
       |
       +--> Report Schema Validator
       |
       +--> HTML Renderer
       |
       +--> PDF Renderer
       |
       v
Report Storage + Metadata
       |
       v
Preview / Download
```

### Important implementation decision

Reuse the AI Assistant's LLM Gateway and evidence rules. Do not create a
second independent LLM integration for reports.

The report module should own: - report snapshot creation; -
report-specific aggregation; - section composition; - rendering; - file
storage; - report versioning; - download authorization.

The AI Assistant should own: - explanation generation; - finding/path
interpretation; - remediation narratives.

------------------------------------------------------------------------

## 4. Canonical Report Format

Use a consistent, professional document structure. The report should be
concise at the top and progressively more technical in later sections.

### Cover page

**ARVE SECURITY AUDIT**

-   Repository name and owner.
-   Project name.
-   Branch and commit SHA.
-   Scan ID.
-   Scan completion timestamp.
-   Report generation timestamp.
-   Report version.
-   Confidentiality label, such as "Confidential --- Security
    Assessment".
-   ARVE branding.

Do not display a security certification, compliance attestation or
"secure" badge unless ARVE has actually performed and validated the
relevant assessment.

### 1. Executive Summary

Purpose: communicate the security posture without requiring the reader
to understand scanner terminology.

Include: - Overall assessment statement based on available evidence. -
Finding counts by severity. - Highest-priority risks. - Whether
validated attack paths were found. - Most important affected application
areas. - Recommended immediate actions. - Key limitations.

Suggested presentation:

``` text
EXECUTIVE SUMMARY

ARVE analyzed: owner/repository
Commit: abc123...
Scan completed: 2026-...

Findings
Critical:  2
High:      5
Medium:    9
Low:       4

Priority attention
1. Public API route with missing object-level authorization.
2. User-controlled input reaching a sensitive query.
3. Vulnerable dependency affecting an exposed application component.

Assessment
The scan identified issues requiring remediation. The highest-priority
items are those supported by strong evidence and/or connected to
validated paths toward sensitive assets.
```

The example is illustrative only. Real reports must populate values from
the actual scan.

Do not use a single unexplained "security score" as the whole
assessment. If a score is shown, document its formula/version and
explain that it is an ARVE prioritisation indicator, not a guarantee of
security.

### 2. Application Overview

Include: - Repository and project identity. - Languages and frameworks
detected. - Application type where known. - Relevant routes/endpoints
discovered. - Dependency and infrastructure context. - Commit SHA and
branch. - Scan scope and excluded areas.

Use "not detected" or "not analyzed" where appropriate. Do not infer
frameworks or architecture that the ingestion engine did not identify.

### 3. Analysis Coverage & Methodology

Explain which engines ran and their status.

Suggested table:

  ---------------------------------------------------------------------------
  Analysis area     Engine/module     Status            Coverage note
  ----------------- ----------------- ----------------- ---------------------
  Static analysis   Semgrep / CodeQL  Completed /       Rules/languages
                                      Partial / Failed  covered
                                      / Not run         

  AST/code          ARVE AST          Status            Files/symbols
  intelligence                                          analyzed

  Data flow         ARVE data-flow    Status            Supported source/sink
                                                        types

  Dependencies      Dependency        Status            Manifests/lockfiles
                    scanner                             analyzed

  Secrets           Secret scanner    Status            Files and exclusions

  Web testing       OWASP ZAP, if     Status            Target and test scope
                    enabled                             

  Pattern           ARVE pattern      Status            Patterns evaluated
  intelligence      engine                              

  Attack paths      ARVE attack-path  Status            Graph/path coverage
                    engine                              
  ---------------------------------------------------------------------------

Include: - Tools and engine versions where recorded. - Scan
configuration. - Exclusions. - Failed or skipped engines. - Known
language/framework limitations. - Whether results are static, dynamic or
inferred.

A failed engine must never be displayed as "no vulnerabilities found."

### 4. Attack Surface Overview

Summarise the application areas ARVE identified: - Public
routes/endpoints. - Authentication-sensitive routes where detected. -
Data stores and sensitive assets where modeled. - External
integrations. - Relevant entry points and sinks. - High-risk components.

Use a compact table and, where appropriate, a simple diagram. Do not
expose a full graph dump in the executive report.

### 5. Security Findings

Provide an overview followed by detailed finding records.

#### 5.1 Finding summary

Counts by: - Severity. - Finding type/category. - CWE. - Source engine.

Only count canonical deduplicated findings. If engine-level raw matches
are useful, label them separately from canonical findings.

#### 5.2 Detailed finding format

Each finding should have:

``` text
FINDING: ARVE-FINDING-ID
Title:
Severity:
ARVE risk priority:
Status:
Confidence:
CWE / OWASP:
Source engine:
Affected file:
Line range:

What was detected
Plain-language description.

Why it matters
Potential consequence, qualified by evidence.

Evidence
Relevant source excerpt and exact location.

Technical context
AST / data-flow / rule context, when available.

Recommended remediation
Concrete fix guidance.

Validation
How the developer can verify the fix.

References
CWE, vendor advisory or other validated sources.
```

Do not include large, unrelated source files. Use short, relevant
excerpts and preserve exact line references.

### 6. Security Pattern Insights

Include only when the pattern engine has persisted results.

For each selected pattern: - Pattern ID and name. - Plain-language
description. - Number of matched findings/projects, scoped to the
report. - Affected framework/language if recorded. - Related finding
IDs. - Why the pattern matters. - Recommended systemic prevention.

Do not describe a pattern as a confirmed vulnerability unless the linked
finding evidence supports that claim. Clearly distinguish learned
similarity/clustering from verified security impact.

### 7. Critical Attack Paths

Include only persisted and validated attack paths. Candidate or
incomplete paths must be labelled accordingly and should not be
presented as confirmed exploit chains.

For each path: - Path ID and risk priority. - Entry point. - Ordered
nodes/steps. - Supporting finding IDs. - Relevant source locations. -
Sensitive asset or impact. - Validation status and confidence. -
Explanation of why the path matters. - Remediation actions that break
the path.

A compact path illustration is useful:

``` text
External Request
      ↓
Public API Route
      ↓
User-Controlled Identifier
      ↓
Missing Authorization Check
      ↓
Sensitive Data Query
      ↓
Potential Data Exposure
```

Every displayed step must map to actual graph records and evidence.
Label inferred edges.

### 8. Risk Prioritization

Explain why some findings should be addressed before others.

Use ARVE's persisted risk model and show its version/inputs where
available: - Severity / CVSS. - Exploitability indicators. - Exposure
and entry-point context. - Attack-path participation. - Asset
sensitivity. - Pattern context. - Confidence / validation status.

Include a priority table:

  -----------------------------------------------------------------------
  Priority          Finding/path      Reason            Recommended
                                                        action
  ----------------- ----------------- ----------------- -----------------
  P1                Finding or path   Evidence-backed   Immediate
                    ID                reason            remediation

  P2                Finding or path   Evidence-backed   Planned
                    ID                reason            remediation
  -----------------------------------------------------------------------

Do not invent a risk score in the report-generation layer. Do not
silently recompute a different score from the one shown in ARVE.

### 9. Remediation Roadmap

Group recommendations into practical time horizons, but avoid arbitrary
deadlines presented as policy.

Suggested groups: - **Immediate:** critical issues and high-impact
validated attack paths. - **Next:** high-priority findings and systemic
authorization/input-validation weaknesses. - **Planned:** medium/low
issues, hardening and preventive controls.

For each action: - Related finding/path IDs. - Owner field if ARVE
supports assignment. - Suggested implementation. - Validation test. -
Status if tracked.

Recommendations should be deduplicated where one systemic fix addresses
multiple findings.

### 10. Technical Evidence Appendix

Include detailed evidence for users who need to reproduce or review the
result: - Finding IDs and engine rule IDs. - File paths and line
ranges. - Short source excerpts. - Data-flow source-to-sink records. -
AST references where useful. - CWE/OWASP/CVE references. - Dependency
package/version/advisory details. - Graph node/edge identifiers for
selected paths. - Engine metadata and timestamps.

Do not expose secrets or sensitive values. Redact credentials and tokens
even if a scanner detected them.

### 11. Limitations & Disclaimers

Include: - Scan scope and exclusions. - Engines not run or partially
completed. - Unsupported languages/frameworks or source/sink types. -
Static-analysis limitations. - Dynamic-testing limitations. - Inferred
versus directly observed relationships. - AI-generated narrative
disclaimer. - A statement that a clean scan does not prove the
application is secure.

### 12. References

Use validated references attached to findings: - CWE entries. - OWASP
references. - CVE/NVD or OSV advisories. - Vendor advisories. - Relevant
official framework security guidance.

Only include links and metadata actually retrieved or stored by ARVE.
Never fabricate citations.

------------------------------------------------------------------------

## 5. Report Length and Presentation Strategy

Avoid making every report excessively long.

### Standard report

Recommended default: - Executive summary. - Application and coverage
overview. - Findings summary. - Selected detailed findings. - Validated
attack paths. - Risk priorities. - Remediation roadmap. - Limitations
and references.

### Technical appendix

Detailed code excerpts, full finding metadata and extended evidence can
be placed in an appendix. If a scan has many findings, include all
findings in a machine-readable export or paginated appendix rather than
making the executive section unreadable.

### Report variants (later)

-   **Executive report:** shorter, management-focused.
-   **Technical audit:** full evidence and remediation detail.
-   **Delta report:** changes between two scans.

Start with one well-designed standard report. Add variants only after
the standard report is reliable.

------------------------------------------------------------------------

## 6. Report Data Snapshot and Schema

Reports must be reproducible even if the project changes later.

At generation time, create an immutable logical snapshot containing: -
Report ID and schema version. - Project ID and scan ID. - Repository
identity, branch and commit SHA. - Scan completion timestamp. - Engine
statuses and versions. - Canonical finding IDs and relevant immutable
field values. - Risk model version and persisted scores. - Selected
pattern IDs and versions. - Selected attack-path IDs and graph
evidence. - Remediation records. - Reference metadata. - AI narrative
version/model metadata, if used. - Generation timestamp.

Do not rely on a live dashboard query when a user later downloads an old
report. The historical report must represent the scan that was
originally assessed.

### Suggested report metadata table

`security_reports` - `id` - `project_id` - `scan_id` -
`requested_by_user_id` - `status` (`queued`, `generating`, `completed`,
`failed`) - `report_type` - `schema_version` - `template_version` -
`snapshot_json` or snapshot reference - `storage_key` - `mime_type` -
`file_size` - `sha256` - `created_at` - `completed_at` - `error_code`
(safe, non-sensitive)

Add indexes for project, scan, status and creation time. Enforce foreign
keys and ownership constraints.

If the snapshot is too large for the relational row, store it in
controlled object storage and persist its key, hash and schema version.

------------------------------------------------------------------------

## 7. Generation Workflow

1.  User opens Reports for a project/scan.
2.  Frontend requests report generation.
3.  Backend authenticates the user and verifies project/scan access.
4.  Backend verifies the scan is complete and eligible.
5.  Backend creates a report job/record with idempotency protection.
6.  Snapshot builder fetches the persisted scan data.
7.  Deterministic aggregator calculates counts and selects report
    sections.
8.  Optional AI narrative generation receives only the relevant evidence
    pack.
9.  AI narrative output is schema- and evidence-validated.
10. Report composer combines deterministic values and approved
    narratives.
11. HTML renderer creates the canonical report representation.
12. PDF renderer converts the validated HTML to PDF.
13. Backend stores the PDF and report metadata.
14. Backend marks the report completed.
15. Frontend shows preview and download actions.

### Failure handling

-   If AI narrative generation fails, generate a report using
    deterministic templates and verified data.
-   If PDF rendering fails, preserve the report job error and allow a
    safe retry.
-   Do not mark a report complete until the artifact is stored and
    verified.
-   Do not expose internal stack traces or provider errors to the user.
-   Make generation idempotent so repeated clicks do not create
    uncontrolled duplicate jobs.

For the initial scale, use the existing background-task/job approach if
one is already available. Do not add a distributed queue solely for
report generation without a demonstrated need.

------------------------------------------------------------------------

## 8. PDF and HTML Rendering

### Recommended approach

Create one semantic HTML report template and use it for: - Website
preview. - PDF rendering.

This reduces divergence between what the user sees online and what they
download.

### Rendering requirements

-   A4 page size.
-   Professional typography and consistent spacing.
-   ARVE visual identity, restrained colours and clear severity
    indicators.
-   Cover page and table of contents.
-   Repeating headers/footers with report ID and page number.
-   Page breaks before major sections.
-   Tables that wrap safely.
-   Code blocks with readable monospace typography.
-   Clickable external references in the PDF where supported.
-   No clipped content or unreadable tiny text.
-   Good contrast in print and screen modes.

Use a maintained HTML-to-PDF renderer compatible with the deployment
environment. Evaluate Chromium-based rendering (for example, Playwright)
against a dedicated PDF library using representative long reports.
Select one renderer and standardise it; do not maintain two independent
layout systems.

Sanitize rendered content and escape repository-provided text. Do not
allow report content to execute scripts or load arbitrary remote
resources.

### HTML preview

The website preview should use the same report data and section
components. It can offer navigation and collapsible technical details,
while preserving the PDF's content hierarchy.

------------------------------------------------------------------------

## 9. Website UI and User Flow

### Reports entry point

Add a Reports area at project/scan level, and optionally a global
Reports page listing reports the user is authorized to access.

Suggested routes:

``` text
/projects/[projectId]/scans/[scanId]/reports
/reports
/reports/[reportId]
```

Adapt to the existing Next.js route conventions.

### Reports list

Show: - Report title. - Repository/project. - Scan ID or commit. -
Report type. - Generated date. - Status. - File format. - Actions:
Preview, Download, Regenerate where allowed.

### Scan page action

After a scan completes, display a clear action:

``` text
Security analysis completed

[ View findings ]   [ Generate security report ]
```

Do not offer report generation while required analysis is still running.
If partial reports are later supported, label them explicitly as
partial.

### Report generation state

Use clear states: - Preparing report. - Collecting scan evidence. -
Generating explanations (if AI is enabled). - Rendering PDF. - Ready to
view. - Failed --- retry available.

Do not imply that the AI is "scanning again"; report generation is
assembling and explaining existing scan evidence.

### Report preview layout

``` text
┌──────────────────────────────────────────────────────────────┐
│ ARVE / Reports / Security Audit                              │
├──────────────────────────────────────────────────────────────┤
│ Repository: owner/repository       Scan: scan_123             │
│ Commit: abc123                     Generated: date             │
│                                      [ Download PDF ]          │
├───────────────┬──────────────────────────────────────────────┤
│ Contents      │  ARVE SECURITY AUDIT                          │
│               │                                               │
│ Executive     │  Executive Summary                             │
│ Overview      │  Concise assessment and key priorities         │
│ Coverage      │                                               │
│ Attack Surface│  Findings                                      │
│ Findings      │  Severity breakdown and finding details        │
│ Patterns      │                                               │
│ Attack Paths  │  Attack Paths                                  │
│ Risk           │  Evidence-backed path explanation              │
│ Remediation   │                                               │
│ Appendix      │  Remediation Roadmap                            │
│ Limitations   │                                               │
└───────────────┴──────────────────────────────────────────────┘
```

### UI design principles

-   Keep the executive summary easy to scan.
-   Use severity colour consistently with the existing ARVE UI.
-   Do not rely on colour alone; always show severity text.
-   Use collapsible technical details.
-   Make finding IDs link to the corresponding finding page.
-   Make attack-path IDs link to the attack graph/detail view.
-   Preserve report metadata and scope visibly.
-   Provide a clear empty state when no report exists.
-   Provide a clear error state and retry action.

------------------------------------------------------------------------

## 10. API Design

Suggested endpoints; adapt to current API naming.

  ------------------------------------------------------------------------------------------------------
  Method                  Endpoint                                               Purpose
  ----------------------- ------------------------------------------------------ -----------------------
  POST                    `/api/projects/{project_id}/scans/{scan_id}/reports`   Request report
                                                                                 generation

  GET                     `/api/projects/{project_id}/scans/{scan_id}/reports`   List reports for a scan

  GET                     `/api/reports/{report_id}`                             Get report metadata and
                                                                                 preview data

  GET                     `/api/reports/{report_id}/download`                    Authorized PDF download

  POST                    `/api/reports/{report_id}/retry`                       Retry eligible failed
                                                                                 generation

  DELETE                  `/api/reports/{report_id}`                             Delete report if
                                                                                 product retention
                                                                                 policy permits
  ------------------------------------------------------------------------------------------------------

### Generation request

``` json
{
  "report_type": "standard",
  "include_ai_narrative": true
}
```

The backend must derive user identity from the authenticated
session/token. Do not trust client-supplied ownership or storage paths.

### API behaviour

-   Return a report ID and generation status for asynchronous work.
-   Use polling or the application's existing job-status mechanism.
-   Return safe error codes.
-   Check authorization for metadata, preview and download
    independently.
-   Never expose a raw object-storage key as an unrestricted public URL.

------------------------------------------------------------------------

## 11. File Storage and Download Security

Store generated reports in private object storage or the application's
established private file-storage layer.

Requirements: - Private by default. - Server-side authorization before
download. - Short-lived signed download URLs only if appropriate. -
Random or opaque storage keys; do not use user input as a path. -
Content type and file-size validation. - SHA-256 checksum stored for
integrity verification. - Retention and deletion policy. - No public
bucket access. - No cross-user report enumeration. - Audit download and
deletion events where required.

If the deployment initially stores files locally, use a dedicated
non-public storage directory and a storage abstraction so it can be
moved to object storage later.

------------------------------------------------------------------------

## 12. AI Narrative Integration: Minimal, Bounded and Evidence-Grounded

AI is an optional narrative service—not the report author, data processor, calculator or layout engine. The report must be complete and usable if the model provider is unavailable.

### 12.1 Exactly what AI should produce

Use the model only for content that benefits from language understanding:

1. **Executive interpretation:** a short plain-language paragraph describing the meaning of the deterministic results. It may identify the most important concerns, but it must cite the finding IDs supplied to it.
2. **Finding explanation:** for each included finding, a short explanation of what the issue means and why it matters.
3. **Remediation rationale:** concise, finding-specific explanation of the intended correction. The actual file location and evidence are rendered separately from ARVE data.
4. **Attack-path explanation:** a short narrative explaining how the steps in an already-persisted and validated path relate to one another.
5. **Pattern interpretation:** optional short explanation of a persisted pattern and its supporting findings.

Do not ask the model to write the cover page, metadata, tables, chart labels, finding titles, evidence blocks, severity labels, technical appendix, references list, page headers, footers or report structure.

### 12.2 Exactly what the application generates deterministically

The report service must generate all of the following from the immutable scan snapshot:
- Cover page, repository identity, branch, commit, scan date and report metadata.
- Overall counts, severity/category/engine distributions and charts.
- Finding identifiers, titles, severity, confidence, CWE/CVSS and risk values.
- Exact file paths, line/column ranges, function/symbol references and source snippets.
- Engine provenance, engine versions, run status, scan scope and coverage limitations.
- Pattern names, IDs, match counts and supporting finding links.
- Attack-path names/IDs, path status, entry points, assets, nodes, edges and risk metadata.
- Remediation priority ordering and roadmap grouping, using ARVE's persisted risk/priority data and documented deterministic rules.
- Technical evidence appendix, references, page numbering, headers, footers, tables, charts and PDF layout.
- All URLs/deep links to repository files or ARVE finding details.

No LLM output may overwrite these values.

### 12.3 Token-efficient generation workflow

Do not submit the complete report snapshot or all scan findings to the LLM.

1. The report aggregator computes all statistics, selects report sections and ranks findings deterministically.
2. Build a compact narrative evidence pack containing only:
   - scan identity and commit reference where needed;
   - a compact aggregate summary;
   - the selected highest-priority finding summaries and evidence IDs;
   - only the code/data-flow/AST context necessary to explain those selected findings;
   - persisted attack-path and pattern summaries only when present.
3. Generate the executive interpretation in one bounded call.
4. Generate finding narratives in bounded batches (for example, 5–10 findings per batch, subject to measured token size). Keep each finding's evidence isolated and require the output to map unambiguously to its finding ID.
5. Generate attack-path narratives only for validated paths selected for the report. Do not send the entire graph.
6. Enforce per-call input/output budgets, batch concurrency, retries and an overall per-report cost ceiling.
7. Cache validated narratives against scan/commit, evidence IDs and versions, model, prompt version and narrative schema version.
8. Validate each returned narrative independently. A bad narrative must not invalidate otherwise valid report data.

The batch size is a starting configuration, not a fixed requirement. Use token estimates and actual usage telemetry to tune it.

### 12.4 Compact output contract

Use task-specific structured output. Do not require a large universal JSON object. A finding narrative should return only:

```json
{
  "finding_id": "ARVE-FINDING-ID",
  "plain_language_summary": "One or two concise sentences.",
  "why_it_matters": "A short explanation grounded in supplied evidence.",
  "recommended_actions": [
    "Specific action supported by the finding and supplied context."
  ],
  "validation_steps": [
    "A concrete verification step."
  ],
  "evidence_ids": ["finding_id", "code_evidence_id"],
  "limitations": []
}
```

The report renderer obtains the finding title, severity, priority, file path, line range, code snippet, engine, CWE/CVSS and other technical metadata from the snapshot. Do not ask AI to repeat these values.

Apply practical output limits: normally 60–120 words for a finding explanation, 3–5 remediation actions, and 1–3 validation steps. Executive interpretation should normally be 100–180 words. Keep attack-path explanations concise and proportional to path complexity.

### 12.5 Validation and fallback

- Validate JSON against Pydantic schemas.
- Confirm each finding/path/evidence ID exists in the report snapshot.
- Reject any AI-produced file path, line number, severity, score, count, engine status or graph relationship; those fields are not accepted in the narrative schema.
- Reject unsupported claims and narratives that do not map to the supplied evidence.
- Permit at most one constrained repair attempt.
- On failure, use a concise deterministic template for that section and continue report generation.
- Mark AI-generated narrative as AI-assisted in report methodology or metadata, without implying that the underlying findings were detected by AI.

The PDF must remain professional and complete when every AI narrative is replaced by deterministic fallback text.

------------------------------------------------------------------------

## 13. Versioning and Reproducibility

A report must be tied to: - Scan ID. - Commit SHA. - Report schema
version. - Template version. - Risk model version. - Relevant engine
versions. - AI model/prompt version when AI is used.

Regenerating a report should create a new report version or a new report
record. Do not silently overwrite a previously downloaded audit. Clearly
show whether the user is viewing the original report or a regenerated
version.

A report should be reproducible from its stored snapshot and template
version, even if the current project has advanced to a newer commit.

------------------------------------------------------------------------

## 14. Implementation Phases

### Phase 0 --- Existing-system audit

-   [ ] Inspect canonical finding schema and deduplication.
-   [ ] Confirm scan completion/status model.
-   [ ] Confirm persisted risk scores and model version.
-   [ ] Confirm pattern records and evidence references.
-   [ ] Confirm Neo4j attack-path persistence and validation status.
-   [ ] Confirm remediation data and references.
-   [ ] Confirm user/project authorization.
-   [ ] Confirm current file/object storage approach.
-   [ ] Agree report schema and template structure.

**Exit criterion:** every proposed report field has an authoritative
source or is explicitly marked unavailable.

### Phase 1 --- Report data and backend foundation

-   [ ] Create report Pydantic schemas.
-   [ ] Create report metadata model and migration.
-   [ ] Implement report snapshot builder.
-   [ ] Implement deterministic aggregation.
-   [ ] Implement report authorization.
-   [ ] Add report generation API.
-   [ ] Add idempotency and status tracking.

**Exit criterion:** a completed scan can produce a validated report data
snapshot.

### Phase 2 --- HTML report template

-   [ ] Build cover page.
-   [ ] Build executive summary.
-   [ ] Build application overview and coverage.
-   [ ] Build findings summary and detail sections.
-   [ ] Build pattern insights.
-   [ ] Build attack-path section.
-   [ ] Build risk prioritisation and remediation roadmap.
-   [ ] Build evidence appendix and limitations.
-   [ ] Add report schema/template versioning.

**Exit criterion:** a complete HTML report can be rendered from a fixed
test snapshot without calling an LLM.

### Phase 3 --- PDF generation and storage

-   [ ] Select and integrate the PDF renderer.
-   [ ] Implement print stylesheet and page layout.
-   [ ] Add headers, footers and page numbers.
-   [ ] Add code/table overflow handling.
-   [ ] Add private file storage.
-   [ ] Verify generated file and checksum.
-   [ ] Add authorized download endpoint.

**Exit criterion:** a user can download a readable, complete PDF for a
completed scan.

### Phase 4 --- Website integration

-   [ ] Add Reports navigation.
-   [ ] Add scan-level Generate Report action.
-   [ ] Add generation progress and failure states.
-   [ ] Add report list.
-   [ ] Add HTML preview.
-   [ ] Add PDF download action.
-   [ ] Add links from report findings to finding details.
-   [ ] Add links from report paths to attack graph details.
-   [ ] Test responsive layout and accessibility.

**Exit criterion:** end-to-end report generation, preview and download
work from the ARVE website.

### Phase 5 --- AI narrative and quality

-   [ ] Integrate the existing AI Assistant service.
-   [ ] Generate structured report narratives.
-   [ ] Validate every evidence reference.
-   [ ] Add deterministic fallback text.
-   [ ] Add AI-assisted disclosure.
-   [ ] Evaluate factuality and usefulness.
-   [ ] Add prompt-injection and data-isolation tests.

**Exit criterion:** AI improves readability without changing
authoritative scan data or blocking report generation.

### Phase 6 --- Advanced report features

-   [ ] Executive and technical report variants.
-   [ ] Scan-to-scan delta reports.
-   [ ] Report regeneration/version history.
-   [ ] Optional CSV/JSON evidence export.
-   [ ] Optional remediation status tracking.
-   [ ] Optional report sharing with controlled permissions.

Do not add sharing or public links until authorization and storage
controls are fully tested.

------------------------------------------------------------------------

## 15. Testing and Acceptance Criteria

### Data correctness

-   Counts match canonical deduplicated findings.
-   Severity breakdown matches the scan record.
-   Risk values match the persisted risk engine output.
-   Attack paths match persisted validated paths.
-   All finding/path references resolve to the correct scan.
-   Missing engine results are shown as missing/failed, not zero.
-   Historical report snapshots do not change after a later scan.

### Rendering

-   Short and very long reports render correctly.
-   Tables and code blocks do not clip.
-   Page numbers and section headings are correct.
-   Links work.
-   Fonts and contrast remain readable.
-   PDF content matches the website preview.
-   No blank or corrupted PDF is marked completed.

### Security

-   User A cannot view or download User B's report.
-   Report IDs cannot be enumerated to access other projects.
-   Storage is private.
-   Repository text cannot inject scripts into HTML.
-   Secrets are redacted.
-   Client-supplied paths are never used directly for file access.
-   Download endpoints enforce authorization.

### AI quality

-   AI cannot alter deterministic counts, scores or severity.
-   Invalid evidence references are rejected.
-   Model failure does not block deterministic report generation.
-   Unsupported claims are omitted or qualified.
-   AI-generated narrative is clearly disclosed.

### Definition of Done

-   [ ] A completed ARVE scan can produce a report snapshot.
-   [ ] The standard report contains all required sections.
-   [ ] All factual values are sourced from persisted ARVE data.
-   [ ] Optional AI narrative is validated and evidence-linked.
-   [ ] HTML preview and PDF download are available on the website.
-   [ ] Reports are private and authorization-protected.
-   [ ] Historical reports are immutable and versioned.
-   [ ] Rendering and security tests pass.
-   [ ] The report is understandable to a developer without exposing raw
    engine output as the primary user experience.

------------------------------------------------------------------------

## 16. Recommended Build Order

Build in this order to avoid coupling report design to an unfinished AI
layer:

``` text
1. Audit existing data contracts
          ↓
2. Define immutable report snapshot
          ↓
3. Build deterministic report aggregation
          ↓
4. Build HTML report template
          ↓
5. Generate and store PDF
          ↓
6. Add website preview / download UI
          ↓
7. Integrate AI-written explanations
          ↓
8. Add report quality, security and regression tests
          ↓
9. Add advanced report variants
```

### Final design rule

**The report is a reproducible audit artifact generated from a specific
ARVE scan. AI improves the explanation; persisted engine evidence
remains the authority.**


------------------------------------------------------------------------

## 17. Mandatory Document-Quality and Finding-Traceability Specification

The PDF must read like a formal security assessment document prepared for a client—not like a dashboard printout. The visual design and information hierarchy are part of the product requirements.

### 17.1 Document design system

- Use a white or very light page background, dark navy/charcoal typography and restrained ARVE accent colors.
- Use a consistent type scale, spacing scale, heading hierarchy, table style, code style and severity treatment.
- Include a designed cover page, running header, footer, page numbers, report title and confidentiality marking.
- Use clear section dividers and deliberate page breaks. Avoid splitting a finding title from its explanation or separating a code location from its evidence block.
- Use charts only when they communicate a useful distribution or comparison. Charts must be generated from snapshot data.
- Avoid dashboard cards, oversized decorative graphics, excessive colored panels, gradients, neon effects and unnecessary icons.
- Use accessible contrast, readable body text and legible code excerpts.
- Ensure long repository names, paths, identifiers and code lines wrap safely without clipping.
- Include a table of contents for sufficiently long reports, with PDF bookmarks where supported.

### 17.2 Finding presentation: the central report component

Every detailed finding must use the same repeatable finding layout. It must answer, in this order:

1. **What is wrong?** A plain-language title and short explanation.
2. **Where is it?** Repository-relative path, line range, column and function/symbol when available.
3. **What did ARVE observe?** A concise source excerpt or engine evidence, with the relevant line visibly identified.
4. **Why does it matter?** A clear, proportionate impact explanation. Distinguish demonstrated impact from potential impact.
5. **How should it be fixed?** Specific, actionable remediation steps.
6. **How can the fix be verified?** A concrete test, scan or review step.
7. **How reliable is the evidence?** Detection engine, confidence, provenance and any limitation.

The finding header and location metadata must be deterministic fields. Do not ask AI to create them.

### 17.3 Precise source navigation

Where source integration is available, render a clickable repository link that opens the exact file and line range at the scanned commit—not the repository's moving default branch. Use a commit-pinned URL and encode paths safely.

If the repository provider or permissions do not allow a deep link, display the exact repository-relative path and line range as copyable text. Do not invent a URL.

The report must preserve the scanned commit SHA so the code location remains traceable even after the repository changes.

### 17.4 Report length and ordering

- Put the executive summary and key priorities first.
- Put the detailed findings in deterministic priority order: ARVE risk priority, then severity, then stable finding ID as a tie-breaker.
- Include every in-scope canonical finding in the full technical findings section or a clearly identified complete appendix. Never silently omit lower-severity findings.
- Keep the executive section concise; place exhaustive engine metadata and raw supporting evidence in the technical appendix.
- For large scans, use a summary table and a paginated detailed findings appendix. Do not compress text until it becomes unreadable.
- Clearly distinguish `0 findings`, `not analyzed`, `engine failed`, `partial coverage` and `data unavailable`.

### 17.5 Acceptance tests for document quality

Create visual regression fixtures for:
- A small report with only a few findings.
- A large report with hundreds of findings.
- A finding with a long file path and long code line.
- A finding with missing function/column metadata.
- Multiple attack paths and patterns.
- Partial/failed engine coverage.
- No findings.
- AI provider unavailable and deterministic narrative fallback.

Inspect rendered PDFs for clipping, orphan headings, broken tables, unreadable code, incorrect page breaks, missing fonts, incorrect links and inconsistent spacing. A successful PDF conversion alone is not sufficient acceptance.
