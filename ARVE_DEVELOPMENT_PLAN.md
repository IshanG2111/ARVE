# ARVE --- Detailed Development Plan

> **Document role:** Executable 15-week development plan for ARVE.\
> **Source basis:** ARVE Development Plan (Revised), expanded system
> design, and the current Neon + Infisical database decision.

------------------------------------------------------------------------

# 0. Scope Contract

Everything below is bounded by these limits.

  -----------------------------------------------------------------------
  Dimension               v1 scope                Deferred
  ----------------------- ----------------------- -----------------------
  Languages               JavaScript, TypeScript  Python (v1.1),
                                                  Java/Go/C#

  Frameworks              Express, Next.js,       Everything else
                          React, Node.js          

  Vulnerability classes   Injection               XSS, SSRF,
                          (SQL/NoSQL/command),    deserialization, path
                          Broken Access Control,  traversal may be added
                          Hardcoded Secrets,      opportunistically
                          Vulnerable              through Semgrep rules
                          Dependencies, Security  
                          Misconfiguration        

  Engines                 Semgrep, OSV-Scanner,   Checkov Tier 2, CodeQL,
                          Gitleaks                ZAP

  Repo size               ≤ 5,000 source files, ≤ Larger repos rejected
                          200 MB, ≤ 15 min total  clearly
                          scan                    

  Scale                   Single-repo scans, one  Concurrent scans,
                          at a time per user      org-wide scanning

  Graph store             PostgreSQL adjacency    Neo4j unless Phase 8
                          tables                  proves a concrete need
  -----------------------------------------------------------------------

Rule of thumb:

> If a task cannot be completed and demoed by one person in under a
> week, it is too large and must be split.

------------------------------------------------------------------------

# 1. Current Objective

Build the first working ARVE security-analysis pipeline:

``` text
GitHub Auth
→ Repository Selection
→ Repository Ingestion
→ Scan Orchestration
→ Security Engines
→ Finding Normalization
→ AST / Code Intelligence
→ Correlation
→ Risk Analysis
→ Graph
→ LLM
→ Dashboard
```

The immediate goal is to scan a repository end-to-end before building
advanced AI features.

The revised order deliberately moves AST/Code Intelligence after Finding
Normalization and adds Scan Orchestration because a scan takes minutes
and cannot be implemented as one long HTTP request.

------------------------------------------------------------------------

# 2. Phase 1 --- GitHub Authentication

## Status

The following foundation is already considered complete:

-   GitHub OAuth via Firebase Auth + GitHub provider
-   Session storage using httpOnly JWT cookie + Bearer token
-   Fetch authenticated user's repositories
-   Display repository list
-   Repository selection through the 3-step project wizard
-   Branch selection

Carry forward:

-   Commit pinning
-   `scan_id` creation

## Remaining debt

-   Fix `addTarget` path mismatch:
    -   Frontend: `POST /api/targets/projects/{id}`
    -   Backend: `POST /api/projects/{id}/targets`
-   Fix `firebase_auth.py` settings attribute bug.
-   Gate mock/demo auth behind `ARVE_ENV=dev`.

## Done When

A user logs in, selects a repository and a specific commit SHA, and
receives a `scan_id`.

------------------------------------------------------------------------

# 3. Phase 2 — GitHub Repository Ingestion

**Owner:** Backend/Auth  
**Estimate:** 1 week  
**Blocks:** scan orchestration and downstream analysis

## Goal

Create a reproducible, normalized repository representation using the authenticated GitHub API.

The ingestion engine is responsible for:

- GitHub authentication reuse
- Repository access validation
- Repository metadata retrieval
- Branch resolution
- Exact commit SHA resolution
- Repository tree retrieval
- File filtering
- Language detection
- Relevant file-content retrieval
- File-size/type validation
- SHA-256 hashing
- ARVE normalization
- PostgreSQL persistence
- Analysis-run status updates

It does **not** perform AST parsing or vulnerability detection.

## 3.1 GitHub client

Create a dedicated GitHub client with responsibilities such as:

```text
GitHubClient
├── get_repository()
├── get_repository_metadata()
├── get_default_branch()
├── get_latest_commit()
├── get_repository_tree()
└── get_file()
```

The GitHub client must not contain:

- file filtering logic
- AST logic
- vulnerability detection
- database persistence

## 3.2 Repository selection and authorization

The selected repository must be verified using the authenticated user's GitHub access token.

Conceptual flow:

```text
User
 ↓
GitHub OAuth
 ↓
Access Token
 ↓
Repository Selection
 ↓
Verify Access
 ↓
Create Analysis Run
```

Do not trust arbitrary repository access without validation.

## 3.3 Repository metadata and commit pinning

Retrieve:

```text
GitHub ID
Name
Full Name
Owner
URL
Default Branch
Visibility
```

Most importantly, record:

```text
branch
commit SHA
```

Every analysis run must be associated with the exact commit SHA.

## 3.4 Repository tree

Fetch the repository tree before downloading file contents.

Conceptually:

```text
project/
├── src/
│   ├── auth.ts
│   ├── database.ts
│   └── utils.ts
├── tests/
├── package.json
└── README.md
```

Convert tree entries into internal file records before content retrieval.

## 3.5 File filtering

Initially relevant source/configuration types include:

```text
.js
.jsx
.ts
.tsx
.py
.java
.go
.rs
.c
.h
.cpp
.hpp
.php
.rb

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

The executable v1 security-analysis scope remains JavaScript/TypeScript.

Ignore:

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

Ignore binary/media/archive files such as:

```text
*.png
*.jpg
*.jpeg
*.gif
*.mp4
*.zip
*.tar
*.pdf
```

Filtering must live in a dedicated component such as:

```text
ingestion/filters/file_filter.py
```

## 3.6 File-size validation

Define:

```text
MAX_FILE_SIZE
```

If a file exceeds the limit:

```text
status = SKIPPED
reason = file_too_large
```

The ingestion result must report skipped files and reasons.

## 3.7 Language detection

Implement a dedicated language detector:

```text
auth.py       → Python
login.js      → JavaScript
server.ts     → TypeScript
Main.java     → Java
main.go       → Go
parser.rs     → Rust
```

The broader detector may recognize languages beyond v1 so future support does not require redesigning ingestion.

## 3.8 File content retrieval

Fetch only relevant files after filtering.

Normalized representation:

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

## 3.9 SHA-256

Calculate:

```text
SHA-256(file_content)
```

for every ingested file.

This provides reproducibility and enables future incremental analysis.

## 3.10 ARVE normalization

GitHub API data should not be exposed as the permanent internal contract:

```text
GitHub API
     ↓
GitHub Adapter
     ↓
ARVE Normalized Repository
     ↓
PostgreSQL
```

Future sources can therefore become:

```text
GitHub ──┐
GitLab ──┼──> ARVE Normalized Format
ZIP ─────┤
Local ───┘
```

without rewriting the AST/security engines.

## 3.11 Database model

Initial ingestion tables:

### `repositories`

```text
id
github_id
owner
name
full_name
url
default_branch
visibility
created_at
updated_at
```

### `analysis_runs`

```text
id
repository_id
commit_sha
status
started_at
completed_at
```

Initial ingestion statuses may include:

```text
PENDING
FETCHING
PROCESSING
COMPLETED
FAILED
```

These map into the broader scan state machine later.

### `repository_files`

```text
id
repository_id
path
filename
extension
language
size
sha256
content
status
created_at
```

Possible file statuses:

```text
INGESTED
SKIPPED
FAILED
```

## 3.12 Pipeline

Implement:

```text
start_ingestion(repository)
        ↓
Create analysis_run
        ↓
Verify repository access
        ↓
Get repository metadata
        ↓
Get branch
        ↓
Get exact commit SHA
        ↓
Get repository tree
        ↓
Filter files
        ↓
Detect languages
        ↓
Fetch file contents
        ↓
Validate files
        ↓
Calculate SHA-256
        ↓
Normalize
        ↓
Store in DB
        ↓
Mark ingestion complete
```

## 3.13 Result

Return useful metadata:

```json
{
  "repository_id": "123",
  "analysis_run_id": "run_001",
  "commit_sha": "abc123",
  "files_found": 248,
  "files_ingested": 181,
  "files_skipped": 67,
  "languages": {
    "JavaScript": 120,
    "TypeScript": 42
  },
  "status": "completed"
}
```

## 3.14 API

Initial ingestion contracts:

```text
POST /repositories/{repository_id}/ingest
GET /analysis-runs/{run_id}
```

These can later be consolidated into the main scan API so ingestion remains an internal stage of an ARVE scan.

## 3.15 Error handling

Handle at least:

```text
Invalid repository
Repository not accessible
GitHub API failure
GitHub rate limit
Missing file
File too large
Unsupported file type
Database failure
Network failure
```

Never leave an analysis permanently stuck in `PROCESSING`.

## 3.16 Logging

Include:

```text
scan_id / analysis_run_id
repository
commit_sha
```

Example:

```text
[INFO] Starting ingestion
[INFO] Repository: owner/project
[INFO] Commit: abc123
[INFO] Files discovered: 248
[INFO] Files filtered: 67
[INFO] Files ingested: 181
[INFO] Languages: JavaScript, TypeScript
[INFO] Ingestion completed
```

## 3.17 Tests

Repository tests:

```text
[ ] Repository metadata extraction
[ ] Default branch detection
[ ] Commit SHA extraction
[ ] Repository tree retrieval
```

File tests:

```text
[ ] Source file detection
[ ] Binary file rejection
[ ] Ignored directory handling
[ ] Large file handling
[ ] Language detection
[ ] SHA-256 generation
```

Database tests:

```text
[ ] Repository insertion
[ ] File insertion
[ ] Analysis run creation
[ ] Duplicate handling
[ ] Failed run handling
```

Failure tests:

```text
[ ] Invalid repository
[ ] Inaccessible repository
[ ] GitHub API failure
[ ] Rate limit
[ ] Missing file
[ ] Database failure
```

## Done When

The same repository commit produces the same:

- commit SHA
- file list
- file hashes

and the normalized repository is persisted with a clear execution status.

# 4. Phase 3 --- Scan Orchestration

**Owner:** Graph/DevOps\
**Estimate:** 1 week\
**Blocks:** everything after it

## Goal

Run scans asynchronously, in isolation, with observable progress.

## Tasks

-   Add job runner:
    -   Celery + Redis preferred once scans exceed roughly 60 seconds.
    -   FastAPI `BackgroundTasks` can be used temporarily if dependency
        deferral is necessary.
-   Persist scan state transitions.
-   `POST /api/projects/{id}/scan` returns `202 Accepted` + `scan_id`.
-   `GET /api/scans/{scan_id}/status` returns:
    -   status
    -   progress
    -   message
    -   started_at
-   Frontend polls every 2 seconds.
-   No WebSockets required for v1.
-   Add per-engine timeout.
-   Add global scan timeout.
-   Handle partial failures.
-   Add structured logging with `scan_id`.

## State machine

``` text
QUEUED → INGESTING → SCANNING → NORMALIZING → INDEXING
       → CORRELATING → SCORING → GRAPH_BUILD → COMPLETED

Terminal:
FAILED
PARTIAL
CANCELLED
```

If Gitleaks succeeds but Semgrep times out:

``` text
PARTIAL
```

not:

``` text
COMPLETED
```

## Docker isolation

Scanning untrusted third-party code is a security requirement.

Scanner containers must have:

``` text
--network=none
read-only workspace mount
memory cap
non-root user
```

Create:

``` text
docker-compose.yml
```

with:

``` text
api
worker
postgres
redis
```

Create a scanner base image with:

``` text
Semgrep
OSV-Scanner
Gitleaks
```

and resource/network isolation.

## Done When

A scan runs in the background, the UI displays progress, and killing one
engine produces `PARTIAL`.

------------------------------------------------------------------------

# 5. Phase 4 --- Security Engines

**Owner:** Security/Backend\
**Estimate:** 1.5 weeks

## Goal

Run specialized scanners against the isolated workspace.

## 5.1 Semgrep --- Build First

Integrate:

``` text
semgrep --sarif
```

Use:

``` text
p/javascript
p/typescript
p/owasp-top-ten
```

Do not write custom rules in v1.

Capture:

-   SARIF output
-   file
-   line
-   rule
-   severity
-   message
-   timeout/non-zero exit status

## 5.2 OSV-Scanner

Run against dependency lockfiles.

Capture:

-   CVE/OSV ID
-   package
-   affected version range
-   fixed version

## 5.3 Gitleaks

Scan workspace for secrets.

Store:

-   finding location
-   rule
-   fingerprint/hash

Never store the secret value.

## 5.4 Checkov

Tier 2.

Only add if Dockerfiles/IaC exist in test repositories and time remains.

## SARIF contract

Semgrep and future Checkov output SARIF 2.1.0.

OSV-Scanner and Gitleaks use dedicated adapters.

## Done When

Each engine can run inside its container against a known-vulnerable
repository and produce persisted machine-readable output.

------------------------------------------------------------------------

# 6. Phase 5 --- Finding Normalization

**Owner:** Security/Backend\
**Estimate:** 1 week

## Goal

Convert scanner output into one ARVE finding format.

Canonical schema:

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

## Tasks

-   Define canonical schema.

-   Create Alembic migration.

-   Build SARIF adapter.

-   Build OSV adapter.

-   Build Gitleaks adapter.

-   Document severity mapping.

-   Compute stable fingerprint:

    ``` text
    engine + rule_id + file + normalized_code_hash
    ```

-   Deduplicate within a scan by fingerprint.

-   Validate using Pydantic.

-   Reject malformed findings rather than storing them.

## Non-goal

Cross-engine correlation is not required in v1.

## Done When

Every engine produces the same ARVE finding structure and a real-scan
schema-validation test passes.

------------------------------------------------------------------------

# 7. Phase 6 --- AST / Code Intelligence

**Owner:** Security/Backend + Cybersecurity Lead\
**Estimate:** 2 weeks\
**Risk:** Highest

## Goal

Understand code structure well enough to attach findings to functions.

## Implementation

Use:

``` text
tree-sitter
tree-sitter-javascript
tree-sitter-typescript
```

Extract:

-   files
-   functions/methods
-   classes
-   imports
-   routes/endpoints

Function fields:

``` text
name
line_start
line_end
file
enclosing class
```

Route extraction:

``` text
Express app.get/post/...
Next.js file-based routes
```

Build line-range index:

``` text
file:line → enclosing function
```

Complexity:

``` text
O(log n)
```

Use stable node IDs:

``` text
{scan_id}:{file_path}:{node_type}:{name}:{line_start}
```

Store code-intelligence data.

Parse failures must log a warning and continue.

## Deferred to v2

-   Function-call graphs
-   Variable/symbol tracking
-   Data-flow/taint analysis
-   Cross-file resolution
-   Source/sink research beyond the constrained scope

## Done When

ARVE can answer:

-   Which functions exist?
-   Which HTTP endpoints exist?
-   Given `file:line`, which function contains it?

------------------------------------------------------------------------

# 8. Phase 7 --- Finding Correlation

**Owner:** Cybersecurity Lead\
**Estimate:** 1 week

## Goal

Connect findings to code structure and group related findings.

v1 signals:

``` text
same file
same function
same class
same dependency/package
same CWE
same route/endpoint
```

Deferred:

``` text
function-call relationships
data-flow relationships
application-component grouping
configuration linking
```

Realistic output:

``` text
POST /api/users/:id
    ↓
updateUser()
    ↓
SQL Injection
    +
Missing Auth Check
    ↓
same function / endpoint cluster
```

Do not claim a proven source-to-sink path without evidence.

## Done When

Every finding with a resolvable location is attached to its enclosing
function and route, and clusters are visible in the UI.

------------------------------------------------------------------------

# 9. Phase 8 --- Security Knowledge Graph

**Owner:** Graph/DevOps\
**Estimate:** 1 week

## Storage decision

Start with:

``` text
PostgreSQL
```

using:

``` text
graph_nodes
graph_edges
```

and recursive CTEs.

Do not add Neo4j unless a concrete query proves PostgreSQL inadequate.

## v1 node types

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
```

## v1 relationships

``` text
CONTAINS
IMPORTS
DEPENDS_ON
AFFECTED_BY
RELATED_TO
```

Defer:

``` text
CALLS
FLOWS_TO
VULNERABLE_TO
```

when they require unavailable call/data-flow evidence.

## API

``` text
GET /api/scans/{id}/graph?depth=&node_types=
```

Cap graph output:

``` text
default depth = 2
maximum ≈ 300 nodes
```

## Done When

Selecting a finding returns its connected subgraph, including relevant
file/function/route/sibling findings, in under 500 ms.

------------------------------------------------------------------------

# 10. Phase 9 --- Risk Engine

**Owner:** Cybersecurity Lead\
**Estimate:** 3--4 days

## Goal

Prioritize vulnerabilities.

Use transparent weighted scoring:

``` text
risk = w1·severity + w2·confidence + w3·exposure + w4·cluster_size
```

Where:

``` text
exposure = inside route handler?
cluster_size = findings sharing function/endpoint
```

## Tasks

-   Put weights in config.
-   Finding-level risk.
-   File/component-level aggregation.
-   Repository score from 0--100.
-   Ranked remediation order.
-   Per-factor score breakdown.

## Deferred

-   EPSS/KEV exploitability
-   Attack-path position

## Done When

Dashboard shows ranked fixes and a per-finding score explanation.

------------------------------------------------------------------------

# 11. Phase 10 --- LLM Analysis

**Owner:** ML/Data\
**Estimate:** 1 week

## Goal

Use AI for interpretation, not detection.

Responsibilities:

-   Plain-language finding explanation.
-   Cluster summary.
-   Concrete remediation.
-   Business/security impact.
-   Executive summary.

## Context builder

The LLM receives:

``` text
finding
±30 lines of code
enclosing function signature
file imports
route
CWE description
raw engine evidence
```

Never send the full repository.

## Hard constraints

-   Structured JSON.
-   Schema validation.
-   Reject/retry malformed output.
-   Every claim cites an `evidence_id`.
-   AI never sets severity.
-   AI never sets confidence.
-   Cache by finding fingerprint.
-   Handle rate limits/timeouts/malformed JSON.

## Done When

A finding page shows a schema-valid explanation tied to real
scanner/code evidence.

------------------------------------------------------------------------

# 12. Phase 11 --- Dashboard

**Owner:** Frontend\
**Estimate:** 2 weeks\
**Strategy:** Build incrementally alongside backend phases.

## Repository

Already mostly exists:

-   Repository selection

Add:

-   Scan history
-   Scan status

## Scan progress

-   Polling-based live status.
-   Per-engine status.
-   Clear `PARTIAL` state.

## Security overview

-   Repository risk score.
-   Severity counts.
-   Most affected files/components.

## Findings

Filters:

``` text
severity
engine
file
CWE
```

Finding detail:

``` text
source location
code snippet
evidence
remediation
score breakdown
```

## Security graph

Use:

``` text
React Flow or Cytoscape
```

Provide table/tree fallback first.

## AI report

-   Executive summary
-   Prioritized fixes
-   Markdown/JSON export first
-   PDF only if time remains

------------------------------------------------------------------------

# 13. Database and Development Environment

## Database

Use:

> Neon PostgreSQL

No local PostgreSQL is required for normal development.

## Secret management

Use:

> Infisical

Development environment contains:

``` text
DATABASE_URL
JWT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
FIREBASE_PROJECT_ID
FRONTEND_URL
```

The current team workflow uses one centralized development database:

``` text
Infisical Development
        ↓
DATABASE_URL
        ↓
Neon ARVE Development DB
        ↑
        ├── Developer 1
        ├── Developer 2
        ├── Developer 3
        ├── Developer 4
        ├── Developer 5
        └── Developer 6
```

Neon branches may be used for isolated experiments but are not required
as six permanent developer databases.

## Driver

Use:

``` text
psycopg[binary]>=3.2.0
```

with:

``` text
postgresql+psycopg://
```

## SQLAlchemy

Use:

``` python
engine = create_engine(
    settings.sqlalchemy_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,
)
```

`pool_pre_ping=True` is important because Neon can scale compute to
zero.

## Schema management

Use Alembic.

Initial schema:

``` bash
infisical run -- alembic upgrade head
```

New model change:

``` bash
infisical run -- alembic revision --autogenerate -m "describe change"
infisical run -- alembic upgrade head
```

Do not use SQLite-specific auto-`ADD COLUMN` hacks.

## Storage policy

Neon Free storage is limited, so:

-   Do not store large raw SARIF/JSON artifacts directly in PostgreSQL.
-   Keep raw artifacts in external/object/file storage.
-   Store references in PostgreSQL.
-   Add retention/cleanup for generated scan artifacts.
-   Monitor database storage.

------------------------------------------------------------------------

# 14. MVP Definition

The MVP is:

``` text
GitHub Login
     ↓
Select Repository + Commit
     ↓
Clone Repository
     ↓
Async Scan Job
     ↓
Semgrep
     ↓
Normalized Finding
     ↓
Displayed in UI
     ├── file
     ├── line
     ├── severity
     └── CWE
```

The LLM comes after this pipeline works.

------------------------------------------------------------------------

# 15. Development Priority

Build in this exact order:

  -----------------------------------------------------------------------------------
  \#             Task              Owner                Estimate       Cumulative
  -------------- ----------------- -------------------- -------------- --------------
  1              GitHub            Backend/Auth         done           done
                 Authentication                                        

  2              Auth debt +       Backend/Auth         0.5w           0.5w
                 `ARVE_ENV`                                            

  3              Docker Compose +  DevOps               1w             1.5w
                 CI + Alembic                                          

  4              Repository        Backend/Auth         1w             2.5w
                 Ingestion                                             

  5              Scan              DevOps               1w             3.5w
                 Orchestration                                         

  6              Semgrep           Security/Backend     1w             4.5w
                 integration                                           

  7              Finding           Security/Backend +   1w             5.5w
                 normalization +   Frontend                            
                 findings UI                                           

  8              Vertical Slice    ---                  ---            5.5w
                 Complete                                              

  9              OSV-Scanner       Security/Backend     0.5w           6w

  10             Gitleaks          Security/Backend     0.5w           6.5w

  11             AST / Code        Security/Backend     2w             8.5w
                 Intelligence                                          

  12             Finding           Cyber Lead           1w             9.5w
                 correlation                                           

  13             Security graph    DevOps               1w             10.5w

  14             Risk engine       Cyber Lead           0.5w           11w

  15             LLM analysis      ML/Data              1w             12w

  16             Dashboard         Frontend             1w             13w
                 completion                                            

  17             Testing,          All                  2w             15w
                 hardening,                                            
                 evaluation, docs                                      
  -----------------------------------------------------------------------------------

Frontend work runs continuously in parallel.

------------------------------------------------------------------------

# 16. First Milestone

``` text
GitHub
  ↓
Repository
  ↓
Pinned commit
  ↓
Async scan
  ↓
Semgrep
  ↓
Normalized Finding
  ↓
Displayed in UI
```

Target:

> **Week 5.5**

Do not build the graph, risk engine, or LLM before this works reliably.

------------------------------------------------------------------------

# 17. Two Visualization Milestones

## Relationship Graph

Question:

> What is connected to this vulnerability?

It should show current-state relationships between:

``` text
Finding
File
Function
Route
Source
Sink
CWE
OWASP
Related findings
```

## Vulnerability Code-Lineage Tree

Question:

> How did the vulnerable code/flow move through code changes?

It should resemble a Git branch/commit tree and expose:

``` text
commit
code node
transition type
old location
new location
transition code point
git diff
```

These are different visualizations and must not be conflated.

------------------------------------------------------------------------

# 18. Week-by-Week Plan

## Week 1 --- Architecture and Contracts

Build:

``` text
repository structure
FastAPI skeleton
React skeleton
PostgreSQL/Neon connection
Infisical integration
Docker
CI
configuration
logging
```

Define:

``` text
Project
Scan
Finding
Evidence
CodeNode
Relationship
LineageNode
LineageEdge
AIExplanation
```

Deliverable:

> All services start and database schema/migration foundation exists.

------------------------------------------------------------------------

## Week 2 — Repository Ingestion

Implement:

```text
GitHub API client
repository authorization check
metadata retrieval
branch resolution
commit resolution
repository tree
file filtering
file-size guards
language detection
file-content retrieval
SHA-256 hashing
ARVE normalization
database persistence
ingestion status
```

Test the same commit twice:

```text
same SHA
same files
same hashes
```

Deliverable:

> Reproducible normalized repository snapshot.

## Week 3 --- AST Foundation

Implement:

``` text
file extraction
function extraction
class extraction
import extraction
export extraction
```

Generate stable IDs.

Deliverable:

``` text
File → Function/Class/Import
```

------------------------------------------------------------------------

## Week 4 --- Code Relationships

Add the scoped route/function relationships needed for the first useful
CodeModel.

Deliverable:

> Queryable CodeModel.

Do not expand into a research-grade call graph.

------------------------------------------------------------------------

## Week 5 --- Semgrep

Implement:

``` text
Semgrep execution
rule configuration
registry rule packs
raw result parser
```

Start with:

``` text
3–5 vulnerability families
```

Deliverable:

> First scanner findings through the API.

------------------------------------------------------------------------

## Week 6 --- Semgrep Expansion

Add:

``` text
positive tests
negative tests
rule metadata
CWE mapping
OWASP mapping
severity
```

Deliverable:

> Stable Semgrep security-rule integration.

------------------------------------------------------------------------

## Week 7 --- Additional Security Engine Layer

Implement OSV-Scanner integration:

``` text
lockfile detection
scanner execution
OSV/CVE parsing
package/version mapping
```

Deliverable:

> Dependency vulnerabilities enter the normalized pipeline.

------------------------------------------------------------------------

## Week 8 --- Gitleaks + Code Intelligence Completion

Implement:

``` text
Gitleaks
secret fingerprinting
redaction
route extraction
line-range index
```

Deliverable:

> Three-engine pipeline plus useful code-location intelligence.

------------------------------------------------------------------------

## Week 9 --- Correlation + Deduplication

Build:

``` text
raw finding ingestion
canonical findings
fingerprints
deduplication
correlation
```

Test:

``` text
multiple raw results
        ↓
canonical Finding
```

Deliverable:

> Reliable canonical Finding output.

------------------------------------------------------------------------

## Week 10 --- Enrichment + Confidence + Graph Model

Implement:

``` text
CWE
OWASP
confidence
risk inputs
evidence model
graph schema
```

Generate:

``` text
Finding
 ↓
File
 ↓
Function
 ↓
Route
 ↓
CWE/OWASP
```

Deliverable:

> Every finding can produce explainable structured evidence.

------------------------------------------------------------------------

## Week 11 --- Relationship Graph

Implement:

``` text
node rendering
edge rendering
zoom
pan
drag
filter
focus
expand
collapse
evidence selection
```

Deliverable:

> User can inspect what is connected to a finding.

------------------------------------------------------------------------

## Week 12 --- Vulnerability Code-Lineage Tree

Implement the scoped historical workflow:

``` text
Git commit traversal
git diff extraction
line history
AST/symbol matching where reliable
transition detection
lineage construction
```

Deliverable:

``` text
Node 1
 ↓
Commit
 ↓
Node 2
 ↓
Commit
 ↓
Node 3
```

with transition code points and evidence.

Do not claim transitions where evidence is insufficient.

------------------------------------------------------------------------

## Week 13 --- AI + Evidence Viewer

Implement:

``` text
context builder
LLM gateway
structured response
validation
explanation
triage
```

Connect:

``` text
Finding
 ↓
Code
 ↓
Graph node
 ↓
Lineage node
 ↓
Commit
 ↓
Diff
```

Deliverable:

> Complete evidence-backed finding workflow.

------------------------------------------------------------------------

## Week 14 --- Dashboard + Reports

Complete:

``` text
repository page
scan progress
findings table
finding detail
relationship graph
lineage tree
AI panel
analytics
JSON export
CSV export
PDF if time remains
```

Deliverable:

> End-to-end dashboard.

------------------------------------------------------------------------

## Week 15 --- Evaluation + Hardening

Measure:

``` text
precision
recall
F1
false-positive rate
false-negative rate
findings/KLOC
scan time
deduplication rate
relationship correctness
lineage correctness
evidence coverage
```

Then:

``` text
bug fixing
security hardening
performance
documentation
demo preparation
final report
```

Deliverable:

> Reproducible final release.

------------------------------------------------------------------------

# 19. Explicit Non-Goals

Cut these from v1 unless they become free/low-risk extensions:

-   Custom Semgrep rule authoring.
-   Full data-flow/taint analysis.
-   Function call graphs.
-   Cross-engine finding correlation.
-   Neo4j without demonstrated need.
-   Multi-language support beyond JS/TS.
-   Attack-path reconstruction.
-   ML-based risk scoring.
-   Concurrent multi-repository scanning.
-   PDF before Markdown/JSON export.
-   WebSocket updates.
-   Autofix/PR generation.

------------------------------------------------------------------------

# 20. Risk Register

  ---------------------------------------------------------------------------------
  Risk              Likelihood        Impact            Mitigation
  ----------------- ----------------- ----------------- ---------------------------
  AST phase         High              High              Cap extraction to
  overruns                                              functions/routes/imports;
                                                        run after vertical slice

  Untrusted code    Medium            Critical          Docker, `--network=none`,
  compromises host                                      non-root, read-only mounts

  Semgrep noise     Medium            Medium            Registry rules first;
                                                        evaluate against known
                                                        vulnerable repos

  Scan time too     Medium            Medium            Size guards, per-engine
  long                                                  timeout, partial status

  Graph UI          Medium            Low               Table/tree fallback
  unfinished                                            

  LLM cost/rate     Low               Medium            Cache by fingerprint;
  limits                                                on-demand explanation

  Team member       Medium            High              Named owners and early
  unavailable                                           vertical slice
  ---------------------------------------------------------------------------------

------------------------------------------------------------------------

# 21. Testing Strategy

Unit test:

``` text
Git parser
AST parser
source extractor
sink extractor
Semgrep parser
OSV parser
Gitleaks parser
correlator
deduplicator
CWE mapper
confidence engine
risk engine
graph builder
lineage builder
AI schema validator
report generator
```

Integration test:

``` text
Repository
 ↓
Snapshot
 ↓
AST
 ↓
Semgrep
 ↓
OSV
 ↓
Gitleaks
 ↓
Normalization
 ↓
Correlation
 ↓
Finding
 ↓
Graph
 ↓
Lineage
 ↓
AI
 ↓
Report
```

------------------------------------------------------------------------

# 22. Evaluation

Use known-vulnerable repositories/datasets appropriate to the selected
vulnerability scope.

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

For visualizations:

``` text
Relationship precision
Relationship recall
Lineage transition correctness
Correct transition code point
Evidence coverage
```

The project must plan evaluation from the beginning rather than leaving
it to the final week.

------------------------------------------------------------------------

# 23. Project-Level Definition of Done

ARVE is demonstrable when:

1.  A user scans a public GitHub repository end-to-end without manual
    intervention.
2.  Scanning the same commit twice produces identical findings.
3.  Findings from the selected security engines appear in one normalized
    schema.
4.  Every finding resolves to its enclosing function and route where one
    exists.
5.  Dashboard shows a ranked fix list with explainable score breakdown.
6.  LLM explanations cite real evidence IDs and are schema-validated.
7.  Known vulnerabilities in benchmark repositories are detected with
    measured precision/recall.
8.  A failed engine produces `PARTIAL`, never a false `COMPLETED`.
9.  `docker compose up` brings the system up from a clean checkout.
10. CI runs the test suite on every pull request.

------------------------------------------------------------------------

# 24. Final MVP Demo

The first meaningful demo should be:

``` text
GitHub Login
    ↓
Repository Selection
    ↓
Exact Commit
    ↓
Async Scan
    ↓
Semgrep
    ↓
Normalized Finding
    ↓
Finding Table
    ↓
File + Line + Severity + CWE
```

The graph, risk engine, lineage, and AI should come after this vertical
slice is reliable.
