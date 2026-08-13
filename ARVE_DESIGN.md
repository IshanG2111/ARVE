# ARVE --- High-Level System Design & Project Vision

> **Project:** ARVE --- AI Security Code Discovery Engine\
> **Purpose:** Evidence-backed security analysis of GitHub or local
> repositories.\
> **Document role:** High-level architecture, system design, product
> vision, core concepts, and major system boundaries.

------------------------------------------------------------------------

## 1. Project Vision

ARVE is an AI-assisted security code discovery engine that takes a
repository and produces an evidence-backed security analysis.

The central objective is:

> **Given a repository, discover security vulnerabilities and explain
> every important result through traceable code evidence.**

ARVE is not intended to behave like an LLM-only scanner. Static-analysis
engines and code intelligence provide the evidence; AI reasons over that
evidence.

The intended end-to-end pipeline is:

``` text
GitHub Auth
    ↓
Repository Selection
    ↓
Repository Ingestion
    ↓
Commit-Pinned Snapshot
    ↓
Scan Orchestration
    ↓
Security Engines
    ↓
Finding Normalization
    ↓
AST / Code Intelligence
    ↓
Finding Correlation
    ↓
Risk Analysis
    ↓
Security Knowledge Graph
    ↓
AI Triage / Explanation
    ↓
Dashboard / Reports
```

The GitHub-first ingestion path is:

```text
GitHub OAuth
     ↓
Access Token
     ↓
Repository Selection
     ↓
Create Analysis Run
     ↓
GitHub API Client
     ↓
Repository Metadata + Default Branch + Exact Commit SHA
     ↓
Repository Tree
     ↓
File Filtering
     ↓
Language Detection
     ↓
Relevant File Contents
     ↓
SHA-256
     ↓
ARVE Normalizer
     ↓
PostgreSQL
     ↓
AST Engine + Security Engines
```

The broader system-design view also represents the analysis pipeline as:

``` text
Repository
    ↓
Pinned Commit
    ↓
Repository Snapshot
    ↓
AST / Code Intelligence
    ↓
Semgrep + CodeQL
    ↓
Raw Findings
    ↓
Correlation
    ↓
Deduplication
    ↓
CWE / OWASP / Confidence
    ↓
Canonical Finding
    ↓
┌───────────────────────────────┐
│                               │
▼                               ▼
Security Relationship Graph   Code-Lineage Tree
│                               │
└───────────────┬───────────────┘
                ▼
          AI Triage / Explanation
                ↓
           Evidence View
                ↓
          Dashboard / Reports
```

------------------------------------------------------------------------

## 2. Product Concept

ARVE should let a user:

1.  Authenticate with GitHub.
2.  Select a repository and exact commit.
3.  Create a reproducible repository snapshot.
4.  Run security analysis asynchronously.
5.  Inspect normalized findings.
6.  Understand the evidence behind each finding.
7.  Explore the current security/code relationships around a
    vulnerability.
8.  Trace relevant vulnerable code through code changes and commits.
9.  Review AI-generated explanations grounded in scanner and code
    evidence.
10. Export machine-readable and human-readable results.

The product therefore combines:

-   Repository intelligence
-   Static security analysis
-   Code structure analysis
-   Finding correlation
-   Risk prioritization
-   Security graph visualization
-   Vulnerability code lineage
-   Evidence-backed AI analysis
-   Security reporting

------------------------------------------------------------------------

## 3. System Boundaries

### Input

ARVE accepts:

``` text
GitHub repository URL
```

or:

``` text
Local repository
```

Optional parameters include:

``` text
branch
commit SHA
language
framework
scan profile
```

Example:

``` json
{
  "repository": "https://github.com/example/project",
  "branch": "main",
  "commit": "abc123"
}
```

### Core v1 scope

The executable v1 scope is intentionally bounded:

  -----------------------------------------------------------------------
  Dimension                           v1
  ----------------------------------- -----------------------------------
  Languages                           JavaScript, TypeScript

  Frameworks                          Express, Next.js, React, Node.js

  Vulnerability classes               Injection (SQL/NoSQL/command),
                                      Broken Access Control, Hardcoded
                                      Secrets, Vulnerable Dependencies,
                                      Security Misconfiguration

  Engines                             Semgrep, OSV-Scanner, Gitleaks

  Repository size                     ≤ 5,000 source files, ≤ 200 MB, ≤
                                      15 min total scan

  Scale                               Single-repo scans, one at a time
                                      per user

  Graph store                         PostgreSQL adjacency tables
  -----------------------------------------------------------------------

The broader design can accommodate additional analysis such as CodeQL,
deeper data-flow, and other vulnerability families, but these are not
automatically part of the v1 commitment.

------------------------------------------------------------------------

## 4. Reproducible Repository Snapshot

A scan must mean:

``` text
scan repository at exact commit SHA
```

rather than:

``` text
scan whatever is currently on GitHub
```

Snapshot pipeline:

``` text
Repository URL
      ↓
Clone
      ↓
Resolve branch
      ↓
Resolve commit SHA
      ↓
Checkout exact commit
      ↓
Ignore generated/binary files
      ↓
Hash source files
      ↓
Detect languages/frameworks
      ↓
Build manifest
      ↓
Create Scan ID
```

Snapshot metadata includes:

``` json
{
  "project_id": "proj_001",
  "scan_id": "scan_001",
  "repository": "owner/repo",
  "branch": "main",
  "commit_sha": "abc123",
  "created_at": "...",
  "files": 431,
  "languages": {
    "TypeScript": 0.71,
    "Python": 0.29
  }
}
```

Every finding, graph node, and AI explanation must be associated with
the exact code version that produced it.

------------------------------------------------------------------------

## 5. Scan Lifecycle

The backend exposes a persistent scan state machine:

``` text
QUEUED
  ↓
INGESTING
  ↓
SCANNING / INDEXING
  ↓
NORMALIZING
  ↓
CORRELATING
  ↓
SCORING
  ↓
GRAPH_BUILD
  ↓
COMPLETED
```

The broader design also uses:

``` text
QUEUED → INGESTING → INDEXING → ANALYZING → CORRELATING
       → AI_REVIEW → GRAPH_BUILD → OUTPUT → COMPLETED
```

Terminal failure states are:

``` text
FAILED
PARTIAL
CANCELLED
```

A status response contains:

``` json
{
  "scan_id": "scan_001",
  "status": "ANALYZING",
  "progress": 67,
  "message": "Running security analysis"
}
```

A failed scanner must not silently produce `COMPLETED`.

------------------------------------------------------------------------

## 6. Repository Ingestion

Repository ingestion is the first data-processing layer after GitHub authentication.

Its responsibility is to:

- Connect to GitHub using the authenticated user's access token.
- Verify repository accessibility.
- Fetch repository metadata.
- Determine the default/requested branch.
- Resolve the exact commit SHA.
- Fetch the repository tree.
- Filter irrelevant/generated/binary files.
- Detect programming languages.
- Fetch relevant source/configuration contents.
- Validate file size/type.
- Calculate SHA-256 hashes.
- Normalize GitHub data into the ARVE format.
- Store normalized repository data.
- Create and update an analysis run.
- Provide clean input to AST and security engines.

The ingestion engine **does not perform vulnerability detection or AST analysis**.

### Ingestion boundary

```text
GitHub
  ↓
GitHub Connector
  ↓
Ingestion Engine
  ↓
ARVE Normalized Repository
  ↓
+-------------------+
|                   |
▼                   ▼
AST Engine      Security Engines
```

### GitHub client

The GitHub client is responsible only for GitHub communication:

```text
GitHubClient
├── get_repository()
├── get_repository_metadata()
├── get_default_branch()
├── get_latest_commit()
├── get_repository_tree()
└── get_file()
```

It must not contain file-filtering, AST, vulnerability-detection, or database-persistence logic.

### File filtering

The ingestion layer can recognize a broader set of source/configuration files so the repository structure remains useful for future expansion:

```text
.js  .jsx  .ts  .tsx
.py  .java  .go  .rs
.c   .h    .cpp .hpp
.php .rb

package.json
requirements.txt
pyproject.toml
pom.xml
go.mod
Cargo.toml
Dockerfile
docker-compose.yml
.github/workflows/*.yml
```

The executable v1 security-analysis scope remains **JavaScript and TypeScript**. Broader language recognition does not expand the v1 security-analysis commitment.

Initially ignored content includes:

```text
.git/
node_modules/
venv/
.venv/
__pycache__/
dist/
build/
target/
coverage/
vendor/
.cache/
```

Binary/media/archive files such as images, videos, PDFs, ZIPs, and TAR files are also ignored.

Filtering must remain in a dedicated filtering component rather than inside the GitHub client.

### File validation

A configurable maximum file size is enforced.

Files exceeding the limit are represented as skipped rather than silently discarded:

```text
status = SKIPPED
reason = file_too_large
```

The ingestion result reports skipped files and their reasons.

### Language detection

Language detection is performed after filtering:

```text
auth.py       → Python
login.js      → JavaScript
server.ts     → TypeScript
Main.java     → Java
main.go       → Go
parser.rs     → Rust
```

The detected language is stored with each normalized file.

### File representation

A normalized repository file conceptually contains:

```text
RepositoryFile
├── id
├── repository_id
├── path
├── filename
├── extension
├── language
├── size
├── sha256
├── content
└── status
```

### SHA-256

Each ingested file is hashed from its content:

```text
SHA-256(file_content)
```

This provides reproducibility and enables future incremental analysis.

### Normalization

GitHub API data must not become the permanent internal contract:

```text
GitHub API
     ↓
GitHub Adapter
     ↓
ARVE Normalized Repository
     ↓
PostgreSQL
```

This boundary allows future sources such as GitLab, ZIP, or local repositories to feed the same AST/security pipeline.

## 7. Code Intelligence

The code-intelligence layer creates an internal representation used by:

-   Security analysis
-   Relationship graph
-   Code-lineage tree
-   Evidence viewer
-   AI context builder

Core model:

``` text
Repository
 └── File
      ├── imports
      ├── exports
      ├── classes
      ├── functions
      ├── variables
      ├── calls
      ├── routes
      ├── sources
      └── sinks
```

For the executable v1 AST phase, tree-sitter is limited to:

-   `tree-sitter-javascript`
-   `tree-sitter-typescript`

The primary extracted structures are:

-   Files
-   Functions/methods
-   Classes
-   Imports
-   Routes/endpoints
-   Line-range indexes

The highest-value extraction is route/endpoint detection for Express and
Next.js.

A finding location such as `file:line` must resolve to its enclosing
function in `O(log n)` using a line-range index.

Stable node IDs follow:

``` text
{scan_id}:{file_path}:{node_type}:{name}:{line_start}
```

Parse failures on individual files must degrade gracefully and not stop
the entire scan.

Deep call graphs, variable/symbol tracking, taint analysis, cross-file
resolution, and source/sink analysis beyond the v1 scope are deferred.

------------------------------------------------------------------------

## 8. Security Engines

### Semgrep

Semgrep provides broad, fast pattern-based detection.

The v1 development plan prioritizes:

-   `p/javascript`
-   `p/typescript`
-   `p/owasp-top-ten`

Registry rules should be used first; v1 does not require custom rule
authoring.

Semgrep output is captured as SARIF.

### OSV-Scanner

OSV-Scanner analyzes dependency lockfiles and returns:

-   OSV/CVE IDs
-   Affected package
-   Version range
-   Fixed version

### Gitleaks

Gitleaks scans for secrets.

Secret values must never be stored as raw credentials. Store a
fingerprint/hash and location instead.

### Checkov

Checkov is Tier 2 and should only be added if Dockerfiles/IaC are
present in test repositories and schedule permits.

### Broader design: CodeQL

The broader system design identifies CodeQL as the deeper
program-analysis engine for:

-   Taint tracking
-   Source-to-sink flows
-   Cross-function relationships
-   Data-flow analysis
-   CWE-oriented queries

CodeQL is therefore part of the broader system vision, while the revised
v1 development plan deliberately prioritizes Semgrep, OSV-Scanner, and
Gitleaks first.

------------------------------------------------------------------------

## 9. Canonical Finding

Scanner output must not be shown directly as the final ARVE finding.

The canonical finding contains:

``` text
Finding
├── id
├── scan_id
├── engine
├── title
├── description
├── severity
├── confidence
├── file
├── line_start
├── line_end
├── function
├── rule_id
├── cwe[]
├── cve_osv_id
├── component
├── evidence
├── remediation
└── fingerprint
```

The broader design additionally represents:

``` json
{
  "finding_id": "F-102",
  "title": "Potential Missing Authorization",
  "severity": "high",
  "confidence": 0.91,
  "state": "probable",
  "file": "users/[id]/route.ts",
  "line_start": 21,
  "line_end": 21,
  "cwe": ["CWE-862"],
  "owasp": ["A01"],
  "source_engines": ["semgrep", "codeql"]
}
```

Severity and confidence remain deterministic. The LLM does not set them.

------------------------------------------------------------------------

## 10. Correlation and Deduplication

The correlation layer combines evidence from scanners without claiming
unsupported data-flow relationships.

v1 correlation signals include:

-   Same file
-   Same function
-   Same class
-   Same dependency/package
-   Same CWE
-   Same route/endpoint

The broader design also considers:

-   Same line
-   Same source
-   Same sink
-   Same data-flow
-   Semantic similarity

Cross-engine deduplication is deferred in the executable v1 plan; if
multiple engines report the same underlying issue, the raw results
should remain accessible as evidence.

The stable fingerprint uses:

``` text
engine + rule_id + file + normalized_code_hash
```

and allows repeated issues to be recognized across scans and commits.

------------------------------------------------------------------------

## 11. CWE / OWASP Enrichment

Findings are enriched with:

``` text
CWE
OWASP
Severity
Confidence
Description
```

Example:

``` text
CWE-862 — Missing Authorization
OWASP A01 — Broken Access Control
Severity: HIGH
Confidence: 91%
```

------------------------------------------------------------------------

## 12. Security Relationship Graph

### Purpose

The Security Relationship Graph answers:

> **"What is connected to this vulnerability?"**

It is an Obsidian-style knowledge graph representing the current
security/code structure.

Example:

``` text
Finding F-102
     |
     | FOUND_IN
     ↓
route.ts
     |
     | CONTAINS
     ↓
GET()
     |
     | SOURCE_TO
     ↓
params.id
     |
     | FLOWS_TO
     ↓
id
     |
     | SINK_AT
     ↓
User.findById(id)
```

Node types can include:

``` text
Repository
File
Class
Function
Route
Dependency
Finding
Vulnerability
Secret
CWE
OWASP
Source
Sink
```

v1 graph relationships are intentionally limited to evidence that can
actually be populated.

The primary v1 relationship types are:

``` text
CONTAINS
IMPORTS
DEPENDS_ON
AFFECTED_BY
RELATED_TO
```

The broader design can represent:

``` text
FOUND_IN
CALLS
READS
WRITES
SOURCE_TO
FLOWS_TO
SINK_AT
MAPS_TO_CWE
MAPS_TO_OWASP
INTRODUCED_AT
MODIFIED_AT
```

`CALLS`, `FLOWS_TO`, and similar deep relationships are deferred from
the v1 graph when they require deferred call-graph/taint capabilities.

------------------------------------------------------------------------

## 13. Vulnerability Code-Lineage Tree

This is deliberately separate from the relationship graph.

It answers:

> **"How did this vulnerable code/flow move from one code node to
> another across code changes?"**

It should look like a Git branch/commit tree rather than an attack
graph.

Example:

``` text
Commit A
   |
 Node 1
   |
   | changed in Commit B
   v
 Node 2
   |
   | propagated in Commit C
   v
 Node 3
   |
 Finding
```

Possible transition types:

``` text
MOVED
MODIFIED
RENAMED
SPLIT
MERGED
COPIED
PROPAGATED
CALLED_FROM
FLOWED_TO
```

The lineage view must distinguish:

``` text
GIT_CHANGE
CODE_FLOW
SECURITY_FINDING
```

It must not be described as an "Impact Graph" or "Attack Graph".

Recommended UI label:

> Vulnerability Code-Lineage Tree

or:

> Code History / Lineage

Historical transitions require evidence such as:

``` text
Git diff
+
line history
+
function identity
+
AST similarity
+
symbol identity
+
call relationships
+
data-flow relationship
```

When evidence is insufficient, ARVE should not invent a historical
transition.

Possible lineage states include:

``` text
ORIGIN_CONFIRMED
ORIGIN_CANDIDATE
HISTORY_INCOMPLETE
ORIGIN_UNKNOWN
```

------------------------------------------------------------------------

## 14. Evidence Model

Every important result should point to evidence.

Example:

``` json
{
  "evidence_id": "E-102",
  "type": "source_location",
  "engine": "codeql",
  "file": "route.ts",
  "line_start": 21,
  "line_end": 21,
  "description": "User-controlled route parameter reaches database query"
}
```

Evidence types include:

``` text
SOURCE_LOCATION
AST_RELATIONSHIP
SEMGREP_RESULT
CODEQL_RESULT
GIT_DIFF
GIT_HISTORY
DATA_FLOW
CALL_GRAPH
IMPORT_GRAPH
AI_CONTEXT
```

Evidence is the foundation for both visualization and AI explanation.

------------------------------------------------------------------------

## 15. Risk Engine

The executable v1 risk model is transparent and deterministic:

``` text
risk = w1·severity + w2·confidence + w3·exposure + w4·cluster_size
```

Where:

``` text
exposure     = finding is inside a route handler
cluster_size = number of findings sharing the function/endpoint
```

Weights must live in configuration, not source code.

The system calculates:

-   Finding-level risk
-   File/component-level risk
-   Repository-level score from 0--100
-   Ranked remediation order
-   Per-factor score breakdown

ML-based risk scoring and exploitability feeds such as EPSS/KEV are
deferred.

------------------------------------------------------------------------

## 16. AI Analysis

AI is used for interpretation, not primary detection.

Responsibilities:

-   Explain findings in plain language.
-   Summarize correlated clusters.
-   Suggest concrete fixes.
-   Explain business/security impact.
-   Generate an executive summary.

The AI receives bounded context:

``` text
finding
+ ±30 lines of code
+ enclosing function signature
+ file imports
+ route
+ CWE description
+ raw engine evidence
```

The AI must not receive the entire repository.

Constraints:

-   Structured JSON output.
-   Schema validation.
-   Retry/reject malformed output.
-   Every important claim references an `evidence_id`.
-   AI never sets severity or confidence.
-   Cache explanations by finding fingerprint.
-   Handle rate limits, timeouts, and malformed JSON as expected
    conditions.

------------------------------------------------------------------------

## 17. Data Architecture

Primary database:

> **PostgreSQL hosted on Neon**

Connection secrets are managed through Infisical.

Current development model:

``` text
Infisical
   ↓
Development environment
   ↓
DATABASE_URL
   ↓
Shared Neon PostgreSQL development database
   ↑
   ├── Developer 1
   ├── Developer 2
   ├── Developer 3
   ├── Developer 4
   ├── Developer 5
   └── Developer 6
```

All six developers use the same centralized development database so
development/testing data remains shared.

Neon branches remain available for isolated experiments or schema
testing, but six permanent developer databases are not required.

Production and staging must remain separate from the shared development
database.

### Core tables

``` text
projects
scans
repositories
files
functions
classes
routes
sources
sinks
commits
findings
evidence
scanner_results
relationships
lineage_nodes
lineage_edges
ai_explanations
```

### Graph storage

Use PostgreSQL adjacency tables initially:

``` text
graph_nodes
graph_edges
```

with recursive CTEs.

Neo4j is deferred until a concrete graph query demonstrates that
PostgreSQL cannot support the required workload.

### Raw artifacts

Large raw SARIF/JSON scanner outputs should not unnecessarily consume
PostgreSQL storage. Store them in external/object/file storage and keep
a reference in the database.

------------------------------------------------------------------------

## 18. Development Secret Architecture

The team uses Infisical for centralized secret management.

Development secrets include:

``` text
DATABASE_URL
JWT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
FIREBASE_PROJECT_ID
FRONTEND_URL
```

The application is started with Infisical so secrets are injected at
runtime.

Example:

``` bash
infisical run -- python run.py
```

or:

``` bash
infisical run -- python -m uvicorn app.main:app --reload --port 8000
```

No database credentials should be committed to Git.

------------------------------------------------------------------------

## 19. Dashboard Vision

Recommended pages:

``` text
/
 ├── repositories
 ├── scan/:id
 ├── findings
 ├── findings/:id
 │     ├── overview
 │     ├── evidence
 │     ├── graph
 │     ├── lineage
 │     └── ai
 ├── analytics
 └── reports
```

Finding detail should expose:

``` text
Finding
Severity
Confidence
CWE
OWASP
Evidence
Source code
AI explanation
Security Relationship Graph
Vulnerability Code-Lineage Tree
```

The graph should support:

``` text
drag
zoom
pan
expand
collapse
filter
focus
highlight
```

The lineage tree should use a deliberately different Git-style layout.

A table/tree fallback should exist before relying entirely on a complex
graph UI.

------------------------------------------------------------------------

## 20. API Vision

Core project/scan endpoints:

``` text
POST /projects
POST /projects/{id}/scan
GET /projects/{id}/status
```

Finding endpoints:

``` text
GET /projects/{id}/findings
GET /findings/{id}
GET /findings/{id}/evidence
POST /findings/{id}/explain
```

Relationship graph:

``` text
GET /findings/{id}/graph
```

with:

``` text
depth
node_types
edge_types
```

Lineage:

``` text
GET /findings/{id}/lineage
```

Commit/evidence endpoints can expose:

``` text
GET /commits/{sha}
GET /commits/{sha}/findings
GET /commits/{sha}/diff
GET /nodes/{id}
GET /nodes/{id}/neighbors
```

------------------------------------------------------------------------

## 21. Reporting Vision

Reports should contain:

1.  Executive Summary
2.  Repository Information
3.  Scan Information
4.  Language/Framework Analysis
5.  Scanner Summary
6.  Finding Summary
7.  Severity Distribution
8.  CWE/OWASP Mapping
9.  Detailed Findings
10. Source Evidence
11. AI Explanations
12. Relationship Graph
13. Vulnerability Code-Lineage Tree
14. Relevant Git Changes
15. Benchmark Results
16. False Positive Analysis
17. False Negative Analysis
18. Limitations
19. Conclusion

Export targets:

``` text
JSON
CSV
PDF
```

The v1 execution plan prioritizes Markdown/JSON export before PDF if
schedule becomes constrained.

------------------------------------------------------------------------

## 22. Final Architecture

``` text
                    REPOSITORY
                        |
                        v
                REPRODUCIBLE SNAPSHOT
                        |
                        v
                  CODE INTELLIGENCE
                        |
             +----------+----------+
             |                     |
             v                     v
          SEMGREP             OSV / GITLEAKS
             |                     |
             +----------+----------+
                        |
                        v
                 NORMALIZATION
                        |
                        v
                  CORRELATION
                        |
                        v
                 RISK ANALYSIS
                        |
                        v
               CANONICAL FINDING
                        |
             +----------+----------+
             |                     |
             v                     v
       RELATIONSHIP           CODE-LINEAGE
          GRAPH                   TREE
             |                     |
       "WHAT IS               "HOW DID IT
        CONNECTED?"             MOVE?"
             |                     |
             +----------+----------+
                        |
                        v
                 EVIDENCE VIEW
                        |
                        v
                  AI ANALYSIS
                        |
                        v
                    DASHBOARD
                        |
              +---------+---------+
              |         |         |
              v         v         v
             PDF       JSON      CSV
```

------------------------------------------------------------------------

## 23. Core Product Principle

ARVE should always preserve the chain:

``` text
Scanner Result
      ↓
Code Evidence
      ↓
Canonical Finding
      ↓
Relationship / Lineage Evidence
      ↓
Risk
      ↓
AI Interpretation
```

The system should never present an AI conclusion without traceable
evidence.
