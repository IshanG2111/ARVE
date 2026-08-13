# ARVE --- AI Security Code Discovery Engine

> **Discover vulnerabilities. Trace the evidence. Understand the code.**

ARVE is an AI-assisted security code discovery engine designed to
analyze a GitHub or local repository and produce an evidence-backed
security assessment.

It combines repository ingestion, static security analysis, code
intelligence, finding normalization, correlation, risk prioritization,
graph-based visualization, vulnerability code lineage, AI-assisted
triage, and reporting.

------------------------------------------------------------------------

## 🚀 Current Implementation Status & Progress Record

> **Last Updated:** August 2026 | **Branch Status:** Unified & Fully Tested (`27/27 Pytest Passed`, `0 TypeScript Errors`)

### Phase 1: Foundation, Authentication & Infrastructure — [COMPLETED]
- [x] **Firebase Authentication Architecture**: Enforced Firebase Auth with GitHub as primary provider (`signInWithPopup`). Deprecated direct GitHub OAuth fallback for unified identity management (`ADR-010`).
- [x] **Firebase Admin SDK & Session Management**: Server-side token verification via `firebase-admin` v7.5.0 (`POST /api/auth/firebase`), issuing HTTP-only, `sameSite=lax` JWT session cookies for XSS protection (`ADR-003`).
- [x] **Data Layer & Migrations**: Configured SQLAlchemy 2.0 ORM with dual SQLite (local dev & tests) and Neon PostgreSQL (cloud deployment) backed by Alembic schema migration management (`ADR-005`).
- [x] **Secret Management**: Integrated Infisical (`.infisical.json`) across backend and frontend environments for zero plain-text secret storage in Git.
- [x] **Canonical CRUD APIs**: Implemented synchronized project and target management endpoints (`/api/projects`, `/api/projects/{id}/targets`, `/api/targets/{id}/verify`) with cascade deletion integrity.
- [x] **Modern UI/UX Dashboard**: Built single-page React 19 + Vite + TypeScript interface with custom modal components (`ConfirmModal`, `ProjectWizardModal`), private repository confirmation checks, and halftone visual design system.

### Phase 2: Repository Ingestion Engine — [COMPLETED & MERGED]
- [x] **Commit-Pinned Snapshot Engine**: Implemented `AnalysisRun` and `RepositoryFile` metadata models for deterministic repository versioning (`ADR-011`).
- [x] **Dual-Mode Ingestion Pipeline**: In-memory Tarball streaming (`GET /repos/{owner}/{repo}/tarball/{ref}`) delivering <1s snapshot creation, with an async semaphore-bounded fallback worker pool (`ADR-008`).
- [x] **Multi-Ecosystem Intelligence**: Framework detection for Node (`package.json`), Python (`pyproject.toml`, `requirements.txt`), and Go (`go.mod`) with expanded multi-language parsing (Vue, Svelte, Kotlin, Swift, SQL, Shell) (`ADR-009`).
- [x] **Smart Guard Scoping**: Automated repository file-count (5,000 files) and size (200MB) checks scoped strictly against source files, ignoring non-ingested git/build blobs.
- [x] **Verified Integration & Quality Assurance**: Fully validated with a 27/27 passing Pytest suite and zero-error Vite production build.

------------------------------------------------------------------------

## What is ARVE?

Traditional security scanners can produce a list of findings, but a
finding is much more useful when the developer can understand:

``` text
Where is the issue?
        ↓
What code contains it?
        ↓
What security evidence supports it?
        ↓
What is connected to it?
        ↓
How did the relevant code change over time?
        ↓
How should it be fixed?
```

ARVE is designed around that evidence chain.

The core principle is:

> **Static analysis and code intelligence provide the evidence; AI
> reasons over that evidence.**

ARVE is therefore not an LLM-only vulnerability scanner.

------------------------------------------------------------------------

# Core Pipeline

``` text
GitHub Auth
     ↓
Repository Selection
     ↓
Repository Ingestion
     ↓
Pinned Commit
     ↓
Repository Snapshot
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
Security Graph
     ↓
AI Triage
     ↓
Dashboard / Reports
```

The first working vertical slice is intentionally smaller:

``` text
GitHub
  ↓
Repository
  ↓
Pinned Commit
  ↓
Async Scan
  ↓
Semgrep
  ↓
Normalized Finding
  ↓
Finding displayed with file, line, severity, CWE
```

------------------------------------------------------------------------

# Key Features

## 1. Commit-Pinned Repository Analysis

ARVE does not scan an ambiguous "current repository".

A scan is associated with an exact commit SHA.

``` text
Repository
    ↓
Branch
    ↓
Exact Commit SHA
    ↓
Reproducible Snapshot
```

The snapshot records:

-   Repository
-   Branch
-   Commit SHA
-   File list
-   SHA-256 file hashes
-   Language information
-   Framework information
-   Dependency/configuration metadata

Scanning the same commit twice should produce the same manifest and
hashes.

------------------------------------------------------------------------

## 2. Repository Ingestion

ARVE creates an isolated scan workspace:

``` text
/workspaces/{scan_id}/
```

The ingestion layer:

-   Clones the selected repository.
-   Resolves the exact commit.
-   Filters generated and binary content.
-   Detects languages.
-   Detects supported frameworks.
-   Detects package managers.
-   Identifies dependency/configuration files.
-   Creates a file manifest.
-   Cleans the workspace after the scan.

v1 supports:

``` text
JavaScript
TypeScript

Express
Next.js
React
Node.js
```

Repository limits:

``` text
≤ 5,000 source files
≤ 200 MB
≤ 15 minutes total scan
```

------------------------------------------------------------------------

# 3. GitHub Ingestion Engine

The ingestion engine is the first data-processing layer after GitHub authentication.

Its job is to convert GitHub repository data into a stable ARVE repository representation.

```text
GitHub OAuth
     ↓
Repository Selection
     ↓
GitHub API
     ↓
Repository Metadata
     ↓
Exact Commit SHA
     ↓
Repository Tree
     ↓
File Filtering
     ↓
Language Detection
     ↓
File Contents
     ↓
SHA-256
     ↓
ARVE Normalization
     ↓
PostgreSQL
     ↓
AST + Security Engines
```

The ingestion engine:

- verifies repository access
- retrieves repository metadata
- resolves the exact commit SHA
- retrieves the repository tree before downloading files
- filters irrelevant/generated/binary files
- detects languages
- retrieves relevant file contents
- validates file size/type
- calculates SHA-256 hashes
- normalizes GitHub data into ARVE's internal format
- stores the normalized repository
- creates/updates an analysis run

It does **not** perform vulnerability detection or AST analysis.

### Why tree-first ingestion?

ARVE should not blindly download every repository file.

The tree is used to identify relevant files first:

```text
Repository Tree
      ↓
File Filter
      ↓
Relevant Files
      ↓
File Content Fetch
```

This reduces unnecessary API requests and processing.

### Normalized repository boundary

```text
GitHub API
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

Downstream engines should not depend directly on GitHub API response formats or GitHub tokens.

### File recognition

The ingestion layer can recognize broader source/configuration files such as:

```text
.js  .jsx  .ts  .tsx
.py  .java  .go  .rs
.c   .h    .cpp .hpp
.php .rb
```

and important configuration files such as:

```text
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

The executable v1 security-analysis scope remains **JavaScript and TypeScript**.

Ignored/generated content includes:

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

Binary/media/archive files are also ignored.

### File hashing

Every ingested file receives:

```text
SHA-256(file_content)
```

This supports reproducibility and future incremental analysis.

### Example normalized file

```text
RepositoryFile
├── path
├── filename
├── extension
├── language
├── size
├── sha256
├── content
└── status
```

# 3. Security Analysis

ARVE's executable v1 security engines are:

### Semgrep

Used for:

-   JavaScript security patterns
-   TypeScript security patterns
-   OWASP-oriented patterns
-   Injection
-   Broken access control patterns
-   Security misconfiguration
-   Other supported registry-rule detections

Primary rulesets:

``` text
p/javascript
p/typescript
p/owasp-top-ten
```

### OSV-Scanner

Used for dependency vulnerabilities.

It identifies:

``` text
OSV/CVE
Package
Affected version range
Fixed version
```

### Gitleaks

Used for secret detection.

ARVE must redact secret values before storage.

Only safe evidence such as location and fingerprint/hash should be
retained.

### Broader analysis

The wider system design also identifies CodeQL as a deeper analysis
engine for data-flow, taint tracking, source-to-sink relationships, and
cross-function analysis. CodeQL remains outside the initial v1 execution
order and can be introduced when the scoped pipeline is stable.

------------------------------------------------------------------------

# 4. Canonical Findings

Scanner results are not directly treated as final ARVE findings.

They are normalized into a common structure containing:

``` text
Finding ID
Scan ID
Engine
Title
Description
Severity
Confidence
File
Line
Function
Rule
CWE
CVE/OSV
Component
Evidence
Remediation
Fingerprint
```

This allows different security engines to feed one ARVE dashboard.

Severity and confidence are deterministic. The AI does not arbitrarily
assign them.

------------------------------------------------------------------------

# 5. Code Intelligence

ARVE builds a structured representation of the repository.

Conceptually:

``` text
Repository
 └── File
      ├── Imports
      ├── Classes
      ├── Functions
      ├── Routes
      ├── Variables
      ├── Sources
      └── Sinks
```

The v1 AST implementation uses:

``` text
tree-sitter-javascript
tree-sitter-typescript
```

The most important extraction is:

> Given a finding at `file:line`, identify the enclosing function.

ARVE also identifies HTTP routes/endpoints from Express and Next.js
structures.

------------------------------------------------------------------------

# 6. Finding Correlation

ARVE connects findings with relevant code structure using evidence such
as:

``` text
Same file
Same function
Same class
Same dependency
Same CWE
Same route
```

The purpose is to turn isolated scanner results into useful security
context.

For example:

``` text
POST /api/users/:id
        ↓
updateUser()
        ↓
SQL Injection Finding
        +
Missing Authorization Finding
```

This creates a useful cluster without claiming unsupported full
data-flow relationships.

------------------------------------------------------------------------

# 7. Security Relationship Graph

ARVE has a dedicated current-state security visualization.

### Question it answers

> **What is connected to this vulnerability?**

It is an Obsidian-style knowledge graph.

Example:

``` text
             CWE-862
                |
                |
             Finding
                |
             route.ts
                |
              GET()
             /     \
      params.id    import
           |
           ↓
          id
           |
           ↓
   User.findById(id)
```

Possible nodes include:

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

The graph is evidence-driven rather than decorative.

------------------------------------------------------------------------

# 8. Vulnerability Code-Lineage Tree

The second visualization is intentionally different.

### Question it answers

> **How did the vulnerable code/flow move through code changes?**

It should look like a Git branch/commit tree.

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

The tree can show transitions such as:

``` text
MOVED
MODIFIED
RENAMED
SPLIT
MERGED
COPIED
PROPAGATED
```

It should expose:

``` text
Commit
Old code location
New code location
Transition type
Transition code point
Git diff
Evidence
```

This is **not** an attack graph or generic impact graph.

The two visualizations answer different questions:

``` text
Relationship Graph
"What is connected?"

Code-Lineage Tree
"How did it get here?"
```

------------------------------------------------------------------------

# 9. Evidence-First Architecture

Every important result should point to evidence.

Example evidence:

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

The evidence chain is:

``` text
Scanner
   ↓
Evidence
   ↓
Canonical Finding
   ↓
Graph / Lineage
   ↓
Risk
   ↓
AI Explanation
```

ARVE should not present unsupported AI conclusions.

------------------------------------------------------------------------

# 10. Risk Scoring

The initial risk engine uses a transparent weighted model:

``` text
risk = w1·severity
     + w2·confidence
     + w3·exposure
     + w4·cluster_size
```

Where:

``` text
exposure = finding inside route handler
cluster_size = findings sharing function/endpoint
```

The dashboard can then show:

``` text
Repository Risk Score
Finding Risk
Priority
Score Breakdown
```

ML-based risk scoring is not part of v1.

------------------------------------------------------------------------

# 11. AI-Assisted Analysis

ARVE uses AI for interpretation.

The AI can:

-   Explain findings.
-   Summarize related findings.
-   Suggest fixes.
-   Explain security/business impact.
-   Generate an executive summary.

The AI receives bounded context:

``` text
Finding
±30 lines of code
Enclosing function
Imports
Route
CWE description
Raw scanner evidence
```

It does not receive the entire repository.

AI output must be:

``` text
Structured
Schema-validated
Evidence-backed
```

The AI does not set:

``` text
Severity
Confidence
```

------------------------------------------------------------------------

# 12. Database

ARVE uses:

> **PostgreSQL hosted on Neon**

The database is centralized for development.

``` text
Infisical
    ↓
Development
    ↓
DATABASE_URL
    ↓
Neon PostgreSQL
    ↑
    ├── Developer 1
    ├── Developer 2
    ├── Developer 3
    ├── Developer 4
    ├── Developer 5
    └── Developer 6
```

This means all six developers work against the same development
database.

Neon branches can still be used for isolated experiments when necessary.

The database contains structured application data such as:

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
findings
evidence
relationships
lineage_nodes
lineage_edges
ai_explanations
```

Large raw scanner artifacts should not unnecessarily be stored in
PostgreSQL.

------------------------------------------------------------------------

# 13. Secret Management

ARVE uses:

> **Infisical**

Development secrets include:

``` text
DATABASE_URL
JWT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
FIREBASE_PROJECT_ID
FRONTEND_URL
```

The application obtains them at runtime.

Example:

``` bash
infisical run -- python run.py
```

or:

``` bash
infisical run -- python -m uvicorn app.main:app --reload --port 8000
```

No database credentials or other secrets should be committed to Git.

------------------------------------------------------------------------

# 14. Backend Architecture

The backend is based on:

``` text
FastAPI
Python
PostgreSQL
SQLAlchemy
Alembic
Redis
Celery
```

The scan pipeline is asynchronous.

Conceptually:

``` text
Frontend
   ↓
FastAPI
   ↓
Redis / Job Queue
   ↓
Celery Worker
   ↓
Repository + Security Engines
   ↓
PostgreSQL
```

Scanner execution is isolated using Docker.

------------------------------------------------------------------------

# 15. Frontend Architecture

The dashboard is built with:

``` text
React
```

Recommended major pages:

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

The scan-progress interface uses polling rather than WebSockets in v1.

------------------------------------------------------------------------

# 16. API Overview

Project/scan:

``` text
POST /projects
POST /projects/{id}/scan
GET /projects/{id}/status
```

Findings:

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

Lineage:

``` text
GET /findings/{id}/lineage
```

Commit/evidence:

``` text
GET /commits/{sha}
GET /commits/{sha}/findings
GET /commits/{sha}/diff
GET /nodes/{id}
GET /nodes/{id}/neighbors
```

------------------------------------------------------------------------

# 17. Project Roadmap

The project is organized into the following major phases:

``` text
Phase 1  — GitHub Authentication
Phase 2  — GitHub Repository Ingestion
Phase 3  — Scan Orchestration
Phase 4  — Security Engines
Phase 5  — Finding Normalization
Phase 6  — AST / Code Intelligence
Phase 7  — Finding Correlation
Phase 8  — Security Knowledge Graph
Phase 9  — Risk Engine
Phase 10 — LLM Analysis
Phase 11 — Dashboard
```

The first major milestone is the Semgrep vertical slice.

------------------------------------------------------------------------

# 18. MVP

The MVP is intentionally not the complete ARVE vision.

``` text
GitHub Login
     ↓
Select Repository + Commit
     ↓
GitHub API Ingestion
     ↓
Normalized Repository
     ↓
Async Scan
     ↓
Semgrep
     ↓
Normalize Finding
     ↓
Display Finding
```

The MVP proves that ARVE can go from:

``` text
Repository
```

to:

``` text
Evidence-backed security finding
```

before advanced AI and graph capabilities are built.

------------------------------------------------------------------------

# 19. Evaluation

ARVE should be evaluated against known vulnerable repositories/datasets.

Measure:

``` text
Precision
Recall
F1
False positives
False negatives
Findings/KLOC
Scan time
Deduplication rate
```

For the two visualizations:

``` text
Relationship correctness
Lineage transition correctness
Transition code-point correctness
Evidence coverage
```

Evaluation is part of the project, not a final-week afterthought.

------------------------------------------------------------------------

# 20. Security

ARVE analyzes untrusted third-party repositories.

Therefore scanner execution must use:

``` text
Docker isolation
No network access where possible
Read-only workspace
Non-root execution
Memory/resource limits
Timeouts
```

The AI must not:

``` text
execute arbitrary shell commands
modify the repository
access credentials
call arbitrary URLs
```

External input and AI output must be validated.

------------------------------------------------------------------------

# 21. Reporting

The final reporting system is intended to contain:

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

Export formats:

``` text
JSON
CSV
PDF
```

Markdown/JSON should be prioritized before PDF if schedule is
constrained.

------------------------------------------------------------------------

# 22. What Makes ARVE Different?

ARVE is not only:

``` text
"run a scanner and show vulnerabilities"
```

The project is built around three layers of understanding:

### 1. Detection

``` text
Semgrep
OSV-Scanner
Gitleaks
```

### 2. Understanding

``` text
AST
Functions
Routes
Files
Relationships
Evidence
```

### 3. Explanation

``` text
Risk
Relationship Graph
Code-Lineage Tree
AI Triage
Reports
```

The intended user journey is:

``` text
Find the vulnerability
        ↓
Understand the evidence
        ↓
Understand what is connected
        ↓
Understand how the relevant code evolved
        ↓
Understand why it matters
        ↓
Know what to fix
```

------------------------------------------------------------------------

# 23. Final Vision

ARVE's long-term vision is an evidence-backed security analysis platform
where a developer can move from a repository to an explainable
vulnerability without losing the connection to the underlying code.

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
          SECURITY              DEPENDENCY
          ANALYSIS              ANALYSIS
             |                     |
             +----------+----------+
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
             +----------+----------+
                        |
                        v
                    EVIDENCE
                        |
                        v
                  AI ANALYSIS
                        |
                        v
                    DASHBOARD
                        |
                        v
                    REPORTS
```

ARVE's core promise is:

> **Don't just tell the developer that a vulnerability exists. Show the
> evidence, show the code relationships, show the relevant history, and
> explain what the developer should do next.**

------------------------------------------------------------------------

# 24. Repository Structure --- Target Direction

A high-level project organization should evolve around the system
boundaries:

``` text
ARVE/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── ingestion/
│   │   │   ├── github/
│   │   │   ├── filters/
│   │   │   ├── detector/
│   │   │   ├── normalizer/
│   │   │   └── service.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routes/
│   │   ├── services/
│   │   └── ...
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   └── ...
│
├── scanners/
│   ├── semgrep/
│   ├── osv/
│   └── gitleaks/
│
├── docker/
├── scripts/
├── docs/
└── README.md
```

The exact implementation structure may evolve with the existing
repository, but the architecture should preserve the separation between
API, scanning, code intelligence, evidence, graph, AI, and frontend
responsibilities.

------------------------------------------------------------------------

# 25. Project Status Philosophy

ARVE development should prioritize a working vertical slice before
advanced features.

The order is:

``` text
Reliable GitHub repository access
        ↓
Reliable repository ingestion
        ↓
Reproducible commit snapshot
        ↓
Reliable asynchronous scan
        ↓
Reliable security finding
        ↓
Reliable normalized evidence
        ↓
Code intelligence
        ↓
Correlation
        ↓
Graph
        ↓
Risk
        ↓
AI
        ↓
Advanced reporting
```

The system should never sacrifice reproducibility, evidence integrity,
or security isolation just to add a visually impressive feature earlier.
