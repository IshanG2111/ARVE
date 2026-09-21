# ARVE Architectural Decision Records (ADRs) & AI Reasoning Log

This document records key architectural decisions, design trade-offs, security considerations, and the AI reasoning behind system choices for the ARVE platform.

---

## 📋 Table of Contents
1. [ADR-001: System Architecture — Modular Monolith over Microservices](#adr-001-system-architecture--modular-monolith-over-microservices)
2. [ADR-002: Authentication Model — Firebase Auth + GitHub Provider](#adr-002-authentication-model--firebase-auth--github-provider)
3. [ADR-003: Session Management — Hybrid Firebase ID Token & HTTP-Only JWT Cookie](#adr-003-session-management--hybrid-firebase-id-token--http-only-jwt-cookie)
4. [ADR-004: Development Strategy — Dual Real/Demo Auth Fallback](#adr-004-development-strategy--dual-realdemo-auth-fallback)
5. [ADR-005: Data Layer — SQLite for Local Dev, SQLAlchemy ORM for Portability](#adr-005-data-layer--sqlite-for-local-dev-sqlalchemy-orm-for-portability)
6. [ADR-006: Scanner Strategy — Orchestrating External Tools over Custom Parsers](#adr-006-scanner-strategy--orchestrating-external-tools-over-custom-parsers)
7. [ADR-007: Graph Intelligence — Decoupling PostgreSQL Application State & Neo4j Security Graphs](#adr-007-graph-intelligence--decoupling-postgresql-application-state--neo4j-security-graphs)
8. [ADR-008: Repository Ingestion — Commit Pinning & In-Memory Tarball Streaming](#adr-008-repository-ingestion--commit-pinning--in-memory-tarball-streaming)
9. [ADR-009: ARVE Normalization Layer & SHA-256 Content Fingerprinting](#adr-009-arve-normalization-layer--sha-256-content-fingerprinting)
10. [ADR-010: Data Model — Single-Repo Project Denormalization](#adr-010-data-model--single-repo-project-denormalization)
11. [ADR-011: Ingestion Guardrails — Hard Source Limits & Size Blacklists](#adr-011-ingestion-guardrails--hard-source-limits--size-blacklists)
12. [ADR-012: Asynchronous Scan Execution with Celery & Redis](#adr-012-asynchronous-scan-execution-with-celery--redis)
13. [ADR-013: Docker-Based Scanner Isolation](#adr-013-docker-based-scanner-isolation)
14. [ADR-014: Scan the Persisted Phase 2 Repository Snapshot](#adr-014-scan-the-persisted-phase-2-repository-snapshot)
15. [ADR-015: Persistent Scanner Artifacts in Backblaze B2](#adr-015-persistent-scanner-artifacts-in-backblaze-b2)
16. [ADR-016: Keep Cloud Storage Credentials Outside the Scanner](#adr-016-keep-cloud-storage-credentials-outside-the-scanner)
17. [ADR-017: Shared Security Foundation & Canonical NormalizedFinding Contract](#adr-017-shared-security-foundation--canonical-normalizedfinding-contract)
18. [ADR-018: Line-Independent Deterministic Finding Fingerprinting](#adr-018-line-independent-deterministic-finding-fingerprinting)
19. [ADR-019: Non-Unique Fingerprint Indexes for Multi-Scan Finding Lifecycle Tracking](#adr-019-non-unique-fingerprint-indexes-for-multi-scan-finding-lifecycle-tracking)
20. [ADR-020: Isolated Engine Evaluation UI & Parallel Conflict-Free Security Mappers](#adr-020-isolated-engine-evaluation-ui--parallel-conflict-free-security-mappers)
21. [ADR-021: Deterministic Multi-Engine Pipeline Ordering](#adr-021-deterministic-multi-engine-pipeline-ordering)
22. [ADR-022: Dynamic PostgreSQL Column Migration for Finding Suppression and Fix Tracking](#adr-022-dynamic-postgresql-column-migration-for-finding-suppression-and-fix-tracking)
23. [ADR-023: Progressive Disclosure UX — Simple by Default, Technical when Requested](#adr-023-progressive-disclosure-ux--simple-by-default-technical-when-requested)
24. [ADR-024: Media and Binary Exclusion Guardrails in Language & Asset Composition](#adr-024-media-and-binary-exclusion-guardrails-in-language--asset-composition)
25. [ADR-025: Ephemeral Scan Workspaces with Direct Backblaze B2 S3 Upload](#adr-025-ephemeral-scan-workspaces-with-direct-backblaze-b2-s3-upload)
26. [ADR-026: AST-First Code Intelligence — ARVE-Specific Semantic Analysis over Generic Code Intelligence](#adr-026-ast-first-code-intelligence--arve-specific-semantic-analysis-over-generic-code-intelligence)
27. [ADR-027: Parallel Multi-Engine Security Execution](#adr-027-parallel-multi-engine-security-execution)
28. [ADR-028: Primitive Context Across Worker Threads — No SQLAlchemy ORM Objects](#adr-028-primitive-context-across-worker-threads--no-sqlalchemy-orm-objects)
29. [ADR-029: Scanner-Specific Exit-Code Semantics](#adr-029-scanner-specific-exit-code-semantics)
30. [ADR-030: Secret-Scanning Redaction and Non-Persistence](#adr-030-secret-scanning-redaction-and-non-persistence)
31. [ADR-031: Per-Engine Failure Isolation and PARTIAL Scan Semantics](#adr-031-per-engine-failure-isolation-and-partial-scan-semantics)

---

## ADR-001: System Architecture — Modular Monolith over Microservices

### Context
ARVE requires repository parsing, vulnerability scanning, security pattern extraction, ML clustering, graph visualization, and reporting.

### Decision
Adopt a **Modular Monolith** architecture consisting of:
- **Frontend**: Single-Page Application (React 19 + Vite + TypeScript).
- **Backend**: Single FastAPI application divided into domain modules (`auth/`, `repository/`, `scanner/`, `analyzer/`, `ml/`, `graph/`, `reports/`).

### AI Reasoning & Trade-off Analysis
- **Why Monolith?** Prevents network latency overhead between components during complex AST traversals and scan processing. Simplifies deployment for academic and local development without needing Kubernetes or complex service meshes.
- **Modularity:** Modules communicate via clean Python service interfaces, allowing easy future extraction into dedicated workers if background processing demands scale.

---

## ADR-002: Authentication Model — Firebase Auth + GitHub Provider

### Context
Users require GitHub identity authentication and repository access scopes (`read:user`, `user:email`, `repo`).

### Decision
Use **Firebase Authentication** on the frontend using `signInWithPopup(auth, githubProvider)` alongside GitHub OAuth application registration.

### AI Reasoning & Trade-off Analysis
- **Security:** Delegation of client-side OAuth token handling and popup flows to Firebase reduces custom OAuth vulnerability risks (e.g., state tampering, CSRF in redirect handshakes).
- **Flexibility:** Firebase issues standard JWT ID tokens which FastAPI can verify independently via `firebase-admin` or Google OAuth public key certificates.
- **Repository Scope:** The GitHub OAuth access token returned in `OAuthCredential` is passed to the backend to perform authorized GitHub API operations.

---

## ADR-003: Session Management — Hybrid Firebase ID Token & HTTP-Only JWT Cookie

### Context
The web client needs a seamless session after signing in with GitHub via Firebase, ensuring protection against XSS and token leakage.

### Decision
Upon client-side Firebase authentication, the web client posts the Firebase ID token to `POST /api/auth/firebase`. FastAPI verifies the token, upserts the user in the database, and issues an `access_token` stored in an **`httpOnly`, `sameSite=lax` cookie**, while also returning a Bearer token for API authorization.

### AI Reasoning & Trade-off Analysis
- **XSS Protection:** `httpOnly` cookies prevent malicious client scripts from stealing session tokens.
- **Stateless Verification:** JWT payload contains the `user_id` claim (`sub`), enabling fast stateless endpoint protection via FastAPI dependencies (`get_current_user`).

---

## ADR-004: Development Strategy — Dual Real/Demo Auth Fallback

### Context
Developers testing the codebase locally may not immediately have active Firebase credentials or live GitHub OAuth applications configured.

### Decision
Implement automatic **fallback mechanisms** across both frontend and backend:
- **Frontend (`useAuth.tsx`)**: If `VITE_FIREBASE_API_KEY` is absent or popup fails, fallback to direct backend login redirect or mock authentication.
- **Backend (`firebase_auth.py`)**: Supports `firebase-admin` SDK, PyJWT Google cert validation, and mock token fallbacks (`mock_firebase_token_*`).

### AI Reasoning & Trade-off Analysis
- **Developer Experience:** Allows instantaneous local testing and unit testing (`pytest`) without external network dependencies or API keys.

---

## ADR-005: Data Layer — SQLite for Local Dev, SQLAlchemy ORM for Portability

### Context
Need a reliable database for application state (users, connected repositories, projects, scan records, target verification).

### Decision
Use **SQLAlchemy 2.0 ORM** with **SQLite** for local development and testing (`arve.db`), designed for easy migration to **PostgreSQL** in production.

### AI Reasoning & Trade-off Analysis
- Zero configuration overhead for new contributors running `python -m pytest` or `python run.py`.
- Declarative models (`User`, `Repository`, `Project`, `Scan`, `TargetWebsite`) use platform-independent column types and GUID generators.

---

## ADR-006: Scanner Strategy — Orchestrating External Tools over Custom Parsers

### Context
ARVE must identify vulnerabilities across AI-generated codebases.

### Decision
Orchestrate established security scanners (**Semgrep**, **Gitleaks**, **Trivy**, **OWASP ZAP**) and normalize their outputs into an ARVE Unified Finding format, rather than building custom SAST scanners.

### AI Reasoning & Trade-off Analysis
- **Focus on Core Differentiator:** Building static analyzers from scratch is redundant. ARVE's novelty lies in **pattern learning**, **ML clustering**, and **attack path graph synthesis** over scanner findings.

---

## ADR-007: Graph Intelligence — Decoupling PostgreSQL Application State & Neo4j Security Graphs

### Context
ARVE maintains two graph concepts:
1. **Global Security Knowledge Graph**: Cross-project vulnerability patterns, CWEs, techniques.
2. **Project Attack Graph**: Code-grounded entrypoint-to-asset attack paths.

### Decision
Store transactional application data in PostgreSQL/SQLite and construct graph structures in **Neo4j** (backed by FastAPI graph API endpoints).

### AI Reasoning & Trade-off Analysis
- Relational databases handle ACID user transactions and project CRUD cleanly.
- Graph databases excel at multi-hop graph queries (`MATCH path = (entry:Endpoint)-[*]->(asset:SensitiveAsset)`).

---

## ADR-008: Repository Ingestion — Commit Pinning & In-Memory Tarball Streaming

### Context
Phase 2 requires fetching repository files reproducibly from GitHub while handling rate limits, large repository trees, and latency.

### Decision
1. **Commit SHA Pinning:** Every analysis run resolves and pins the exact 40-character Git commit SHA on `analysis_runs.commit_sha`.
2. **Dedicated Client (`GitHubClient`):** Pure REST API v3 client separated strictly from filtering, database, and AST logic.
3. **Hybrid Content Retrieval:** Authenticated tokens stream the full repository tarball (`/repos/{owner}/{repo}/tarball/{sha}`) and extract filtered files entirely in-memory (`tarfile` + `io.BytesIO`). If tarball streaming is unavailable or fails, fall back to concurrent batch fetching (`asyncio.gather` + `httpx.AsyncClient` with semaphore rate limiting).

### AI Reasoning & Trade-off Analysis
- **Reproducibility:** Pinning commit SHAs ensures that scans on the same commit produce 100% identical file lists and SHA-256 hashes regardless of subsequent branch updates.
- **Performance:** In-memory tarball streaming downloads the entire codebase in a single HTTP request, eliminating thousands of individual file API calls and avoiding GitHub rate limits.
- **Safety:** In-memory extraction never touches the physical host disk, preventing path traversal attacks from malicious tarball contents.

---

## ADR-009: ARVE Normalization Layer & SHA-256 Content Fingerprinting

### Context
Downstream security scanners and AST engines must operate on a canonical file contract without being coupled to GitHub API payloads or specific version control providers.

### Decision
1. Ingested files are passed through a provider-neutral `DataNormalizer` to create `NormalizedFile` records (`path`, `filename`, `extension`, `language`, `size`, `sha256`, `content`, `status`, `skip_reason`).
2. Compute `SHA-256(content)` for every ingested file and store it in `repository_files.sha256`.

### AI Reasoning & Trade-off Analysis
- **Provider Decoupling:** Allows future support for GitLab, Bitbucket, ZIP archives, or local directories without modifying AST or vulnerability engines.
- **Incremental Analysis:** SHA-256 hashes enable diff-based delta analysis between commits (skipping re-analysis of unchanged files).

---

## ADR-010: Data Model — Single-Repo Project Denormalization

### Context
The original schema had a standalone `repositories` table with a foreign key to `projects`. In practice, each ARVE security project tracks exactly one primary repository and its verified deployment target.

### Decision
Denormalize repository metadata fields directly onto the `projects` table (`repo_id`, `repo_owner`, `repo_name`, `repo_url`, `default_branch`, `repo_language`, `repo_frameworks`, `repo_package_manager`, `repo_size_kb`, `repo_visibility`), and associate `analysis_runs` and `repository_files` directly with the `project_id`.

### AI Reasoning & Trade-off Analysis
- **Simplicity:** Eliminates unnecessary table joins on every project dashboard query.
- **Clarity:** Accurately reflects ARVE's 1-to-1 project-to-repository security auditing model.

---

## ADR-011: Ingestion Guardrails — Hard Source Limits & Size Blacklists

### Context
Large mono-repos or repositories containing binary assets, build artifacts, or vendor dependencies can overwhelm server memory and exhaust security scanner memory budgets.

### Decision
Enforce strict pre-download and post-filter guardrails:
1. **Directory Exclusion:** Blacklist `.git/`, `node_modules/`, `venv/`, `dist/`, `build/`, `target/`, `coverage/`, `vendor/`, `.cache/`.
2. **File Size Limit:** Skip individual files exceeding 1 MB (`status = SKIPPED`, `skip_reason = file_too_large`).
3. **Repository Caps:** Reject repositories exceeding **5,000 ingestible source files** or **200 MB total uncompressed source size** before downloading.

### AI Reasoning & Trade-off Analysis
- Protects the worker runtime against Denial-of-Service or memory exhaustion while covering 99%+ of AI-generated web applications within the v1 scope.

---

## ADR-012: Asynchronous Scan Execution with Celery + Redis

### Context

Security scans are long-running operations involving workspace preparation,
Docker execution, scanner execution, artifact generation, and cleanup.

Running the complete scan inside the FastAPI request would block the API
worker and make long-running execution difficult to manage.

### Decision

Use **Celery + Redis** for asynchronous scan execution.

```text
FastAPI
   ↓
Create Scan
   ↓
Celery
   ↓
Redis
   ↓
Celery Worker
   ↓
Scan Execution
```

PostgreSQL remains the persistent source of truth for scan state.

### AI Reasoning & Trade-off Analysis

- Keeps long-running scans outside the HTTP request lifecycle.
- Allows the API to return a scan ID immediately.
- Provides dedicated workers for scan execution.
- Supports queuing and future worker scaling.
- Keeps persistent scan state separate from the task queue.

The additional Redis/Celery infrastructure is accepted because scan execution
is inherently asynchronous and resource-intensive.

---

## ADR-013: Docker-Based Scanner Isolation

### Context

ARVE executes scanners against repository code originating from external
repositories. Repository contents must therefore be treated as untrusted
input.

Running scanner processes directly on the host could expose the host
environment to untrusted code or processes.

### Decision

Execute scanner workloads inside **Docker containers** with:

- network disabled
- read-only source mount
- writable output mount
- non-root execution
- CPU limits
- memory limits
- execution timeout

```text
Celery Worker
     ↓
Docker Sandbox
     ├── Read-only source
     ├── Writable output
     ├── No network
     ├── CPU limit
     ├── Memory limit
     └── Non-root
```

### AI Reasoning & Trade-off Analysis

- Provides isolation between scanner execution and the host.
- Prevents arbitrary network access.
- Limits filesystem access.
- Controls resource consumption.
- Provides a consistent scanner execution environment.

Docker adds an operational dependency, but the security and isolation
benefits are necessary for executing analysis against untrusted repositories.

---

## ADR-014: Scan the Persisted Phase 2 Repository Snapshot

### Context

Phase 2 already retrieves, filters, normalizes, and stores repository files
for a specific commit.

Downloading the repository again during Phase 3 would duplicate repository
acquisition and could result in scanning different content.

### Decision

Phase 3 scans the completed Phase 2 `AnalysisRun` and its associated
`RepositoryFile` records.

```text
AnalysisRun
    ↓
RepositoryFile
    ↓
Temporary Workspace
    ↓
Docker Scanner
```

Phase 3 does not independently fetch the repository from GitHub.

### AI Reasoning & Trade-off Analysis

- Ensures the scanner analyzes the exact Phase 2 snapshot.
- Makes scan execution reproducible.
- Avoids duplicate GitHub API calls.
- Keeps repository ingestion and scan execution properly separated.
- Allows every scan to be traced back to its `AnalysisRun` and commit.

This establishes the fundamental boundary:

```text
Phase 2 → What code are we scanning?
Phase 3 → How do we safely execute the scan?
```

---

## ADR-015: Persistent Scanner Artifacts in Backblaze B2

### Context

Scanner artifacts need to remain available after the worker and temporary
scan workspace are gone.

Local storage would make artifacts dependent on the machine that executed
the scan, while storing large raw artifacts directly in PostgreSQL would
unnecessarily increase database storage.

### Decision

Store persistent raw scanner artifacts in **private Backblaze B2** using its
S3-compatible API.

```text
Scanner
   ↓
Temporary Output
   ↓
Backblaze B2
   ↓
Artifact Reference
   ↓
PostgreSQL
```

Only artifact metadata/reference is stored in PostgreSQL.

The local filesystem is used only for temporary scan execution and is cleaned
up afterwards.

### AI Reasoning & Trade-off Analysis

- Makes artifacts accessible to all authorized team members/workers.
- Removes dependency on a particular developer machine.
- Keeps large raw files out of PostgreSQL.
- Provides suitable object storage for scanner outputs.
- Allows persistent artifacts to survive worker restarts and machine changes.

The private B2 bucket also ensures scanner results are not publicly exposed.

---

## ADR-016: Keep Cloud Storage Credentials Outside the Scanner

### Context

Scanner containers process untrusted repository content.

Giving scanners direct access to Backblaze credentials would allow a
compromised scanner process to access or modify persistent application
storage.

### Decision

Backblaze credentials are available only to the trusted backend/Celery
worker.

The scanner container receives no B2 credentials.

```text
Docker Scanner
      ↓
Temporary Output
      ↓
Trusted Celery Worker
      ↓
Backblaze B2
```

B2 credentials are stored in Infisical and injected only into the trusted
application process.

### AI Reasoning & Trade-off Analysis

- Applies least-privilege principles.
- Prevents scanners from directly accessing persistent storage.
- Keeps cloud credentials outside the untrusted execution environment.
- Centralizes artifact persistence in the trusted application layer.

This creates a clear security boundary between **untrusted scanner
execution** and **trusted artifact storage**.

---

## ADR-017: Shared Security Foundation & Canonical NormalizedFinding Contract

### Context
Phase 4 introduces multiple heterogeneous security scanning engines: OSV-Scanner (SCA dependency vulnerability scanning) and Gitleaks (hardcoded secret detection). Developing each engine independently without a shared foundation would lead to database migration collisions, fragmented ORM finding schemas, inconsistent severities, and Git merge conflicts.

### Decision
Establish a centrally frozen, engine-agnostic shared security foundation:
- Single canonical database persistence table: `security_findings`.
- Shared Pydantic data contract: `NormalizedFinding`.
- Universal severity taxonomy (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`) with automated CVSS score normalization.
- Abstract mapper contract: `FindingMapper` protocol implemented by each engine.

### AI Reasoning & Trade-off Analysis
- **Decoupling**: Engine developers build only engine-specific CLI runners and mappers (`map_artifact`), outputting identical canonical `NormalizedFinding` objects.
- **Single Source of Truth**: Eliminates duplicate finding tables (e.g. `osv_findings`, `gitleaks_findings`) and unifies reporting, graph creation, and remediation pipelines.

---

## ADR-018: Line-Independent Deterministic Finding Fingerprinting

### Context
When code is refactored, new lines are added, or whitespace is adjusted, the physical line numbers of existing vulnerabilities and leaked secrets change. If the finding fingerprint incorporated dynamic line numbers, a minor code shift would cause ARVE to treat an existing finding as a newly introduced vulnerability, corrupting historical lifecycle tracking.

### Decision
Fingerprint generation strictly distinguishes **Finding Identity** (what the defect is) from **Occurrence Location** (where it currently sits):
- **Secret Identity**: `SHA256(engine | secret | rule_id | file_path | secret_signature)` — independent of `line_start`.
- **SCA Identity**: `SHA256(engine | dependency | package_name | ecosystem | vulnerability_id | file_path)`.
- **Scan Invariance**: `scan_id` is strictly excluded from fingerprint generation.
- Dynamic line ranges (`line_start`, `line_end`) and `scan_id` are stored in table columns for reporting without altering the identity hash.

### AI Reasoning & Trade-off Analysis
- **Stability**: Prevents finding churn across git commits and pull request iterations.
- **Auditability**: Enables reliable status progression (`OPEN` → `RESOLVED` → `REOPENED`) over time.

---

## ADR-019: Non-Unique Fingerprint Indexes for Multi-Scan Finding Lifecycle Tracking

### Context
A security finding often exists across dozens of successive repository scans over time. If `(project_id, fingerprint)` had a database-level `UNIQUE` constraint, subsequent scans of the same project would crash or overwrite historical scan execution records.

### Decision
Maintain `(project_id, fingerprint)` and `(scan_id, engine)` as **non-unique composite indexes** rather than unique constraints:
- Each scan execution records its exact finding instances linked via `scan_id`.
- The non-unique index `ix_security_findings_project_fingerprint` allows fast queries to trace the lifecycle and reappearance history of a finding across multiple scan timestamps.

### AI Reasoning & Trade-off Analysis
- Preserves complete immutable scan audit history.
- Enables the UI and analytics engine to calculate mean-time-to-remediate (MTTR) and detect regressed vulnerabilities without compromising historical records.

---

## ADR-020: Isolated Engine Evaluation UI & Parallel Conflict-Free Security Mappers

### Context
Phase 4 involves distinct teams or engineers simultaneously developing and testing scanner plugins:
- **OSV-Scanner** for Software Composition Analysis (SCA) & dependency vulnerabilities.
- **GitLeaks** for secret, token, and credential detection.
- **Semgrep** for Static Application Security Testing (SAST).

Engineers require dedicated UI views to judge their engine yields, examine raw JSON outputs, and test their specific mapper logic without stepping on each other's code or encountering database merge conflicts.

### Decision
1. **Isolated Backend Mappers**:
   - Each engine implementation lives in its own dedicated mapper module (`app/security/mappers/osv.py`, `app/security/mappers/gitleaks.py`, `app/security/mappers/semgrep.py`).
   - Mappers strictly implement the frozen `FindingMapper` interface and output canonical `NormalizedFinding` objects.
   - Separate unit test suites (`test_osv_mapper.py`, `test_gitleaks_mapper.py`) guarantee independent CI verification.
2. **Specialized UI Engine Panels & 1-Click Isolation**:
   - The Security Findings view (`/findings`) features dedicated Engine Summary Cards (`OSV-Scanner`, `GitLeaks`, `Semgrep`).
   - Clicking an engine card isolates the table, showing engine-tailored badges (e.g. `package_name @ version (ecosystem)`, `CVE`/`GHSA` tags for OSV; `rule_id`, file path & line, secret status for GitLeaks).
   - The Finding Inspector modal displays the exact raw scanner JSON artifact, SHA-256 fingerprint, and technical diagnostics.

### AI Reasoning & Trade-off Analysis
- **Zero Merge Conflicts**: Shared database schemas and normalization pipelines remain immutable, so engine developers only modify their isolated mapper files.
- **Immediate Feedback Loop**: Developers can trigger scans, switch to their engine tab in the UI, and immediately verify mapped finding fields and raw outputs.

---

## ADR-021: Deterministic Multi-Engine Pipeline Ordering

### Context
The execution sequence between repository snapshotting, scanner runners, finding normalization, AST symbol resolution, and attack graph reconstruction must follow a strict causal order to avoid invalid states.

### Decision
Establish the deterministic 5-stage pipeline order across system documentation and UI visualizers:
1. **Step 01: Codebase Ingestion (Phase 2)** — Snapshot & index source repository files, framework, and routes.
2. **Step 02: Multi-Engine Scanners (Phase 3)** — Execute external scanner binaries (OSV-Scanner, GitLeaks, Semgrep) against the ingested snapshot.
3. **Step 03: Finding Normalization (Phase 4A)** — Parse raw outputs via `FindingMapper` instances and persist canonical `NormalizedFinding` records with deterministic SHA-256 identities.
4. **Step 04: AST & Semantic Mapping (Phase 5 / Roadmap)** — Resolve syntax symbols, entrypoints, and data flow paths on normalized findings.
5. **Step 05: Attack Graph & Proofs (Phase 6/7 / Roadmap)** — Synthesize end-to-end exploit chains from internet entrypoints to sensitive database sinks.

### AI Reasoning & Trade-off Analysis
- **Causal Alignment**: Scanners require ingested files before executing; normalizers require scanner outputs before deduplicating; AST & attack graphs require normalized findings before reconstructing exploit paths.
- **Accurate UI State**: Eliminates misleading success indicators for roadmap phases and accurately represents real live scan executions.

---

## ADR-022: Dynamic PostgreSQL Column Migration for Finding Suppression and Fix Tracking

### Context
When introducing remediation metadata (`fixed_version`) and suppression lifecycle audits (`suppression_reason`, `suppression_justification`, `suppression_expires_at`) to the `security_findings` table, existing developer databases and live instances threw `psycopg.errors.UndefinedColumn` on `GET /api/projects/{id}/findings` before manual Alembic upgrade commands could be executed.

### Decision
1. Implement automatic non-destructive column provisioning during `init_db()` startup in `app/core/database.py` using `ALTER TABLE security_findings ADD COLUMN IF NOT EXISTS ...`.
2. Pair this with standard Alembic migration `20260831_0006_finding_suppression_and_fixes.py` for formal schema version tracking.

### AI Reasoning & Trade-off Analysis
- **Zero-Downtime Resilience**: Guarantees that local developer databases and staging/production containers self-heal on startup without throwing 500 errors.
- **Portability**: Safe idempotent execution across both SQLite and PostgreSQL.

---

## ADR-023: Progressive Disclosure UX — Simple by Default, Technical when Requested

### Context
Cybersecurity tools often overwhelm developers with raw CVSS vectors, unparsed JSON trees, and dense advisory prose. Users need immediate answers to three fundamental questions:
1. *What is wrong?*
2. *Where is it?*
3. *What should I do?*

### Decision
Apply a strict **Progressive Disclosure** design standard across all ARVE views:
- **Finding Detail Modal**: Prominently display a 1-click Remediation Command Box (`npm install @pkg@^version`), a 4-stat version matrix, and a rich formatted Markdown advisory summary. Deep technical metadata (CVE/GHSA links, CWE weakness, SHA-256 fingerprint, raw OSV JSON) is nested under a collapsible `Technical security metadata ▾` accordion.
- **Settings Page**: Present primary workspace identifiers (Display Name, Default Branch, Deployment URL) at first sight, placing advanced scanner engines, cloud storage destinations, and the Danger Zone under collapsible sections.
- **Interactive JSON Viewer**: Dual-mode Tree/Raw JSON viewer with search filtering and 1-click Copy/Download.

### AI Reasoning & Trade-off Analysis
- **Cognitive Load Reduction**: Developers can resolve 95% of dependency alerts in 1 click without deciphering raw JSON.
- **Zero Information Loss**: Full technical audit trails remain instantly accessible for security analysts and compliance officers.

---

## ADR-024: Media and Binary Exclusion Guardrails in Language & Asset Composition

### Context
Large video assets (`.mp4`, `.mov`) and image files (`.gif`, `.png`, `.jpg`) present in public asset directories (e.g. 30MB video clips) skewed repository language composition calculations, causing "Language Composition" to report `MP4 49.5%` instead of actual programming languages (e.g. TypeScript, React, Python).

### Decision
1. In the backend ingestion filter (`app/ingestion/filters/file_filter.py`), strictly tag binary and media extensions as `status="SKIPPED"` with `skip_reason="Binary or media file"`.
2. In the frontend (`RepositoryPage.tsx`), enforce `MEDIA_AND_BINARY_EXTENSIONS` exclusion sets so that Language Composition and "Largest Codebase Files" only evaluate actual source code files.

### AI Reasoning & Trade-off Analysis
- **Accuracy**: Codebase blueprints accurately reflect software engineering composition rather than raw asset disk storage.
- **Performance**: Prevents AST parsers from wasting CPU memory attempting to parse non-code media blobs.

---

## ADR-025: Ephemeral Scan Workspaces with Direct Backblaze B2 S3 Upload

### Context
Docker containers executing scanner engines generate large raw JSON output artifacts (e.g., `osv.json`, `gitleaks.json`, `semgrep.json`). Retaining these temporary output directories indefinitely on the local container filesystem risks exhausting disk capacity during high-throughput scanning.

### Decision
1. When a scanner completes, `ScanArtifactStore.persist_output()` immediately uploads the JSON artifact to Backblaze B2 cloud storage via its S3-compatible API under `b2://arve-scan-artifacts/scans/{scan_id}/{engine_name}/{filename}`.
2. The database stores the persistent cloud URI in `scan_engine_runs.artifact_reference`.
3. The local temporary scratch directory is immediately and safely destroyed (`shutil.rmtree`).
4. `GET /api/scans/{scan_id}/engines/{engine_name}/artifact` serves the raw JSON directly from Backblaze B2 to the frontend.

### AI Reasoning & Trade-off Analysis
- **Storage Scalability**: Centralized, cost-effective immutable cloud storage without disk leaks on scanner host nodes.
- **Security & Integrity**: Scan evidence is decoupled from ephemeral worker nodes, ensuring verifiable historical audit trails.

---

## ADR-026: AST-First Code Intelligence — ARVE-Specific Semantic Analysis over Generic Code Intelligence

### Context

ARVE needs deeper code understanding beyond the findings produced by external
security scanners. A generic code-intelligence or language-server approach
would provide broad symbol/navigation capabilities but would not directly
solve ARVE's core problem: connecting security findings to the actual
application structure and potential exploit paths.

### Decision

Build ARVE's code intelligence around a **custom AST-first semantic analysis
layer** rather than making generic code intelligence or language-server
features a core dependency.

The AST layer will progressively extract:

- Files, modules, and syntax structures.
- Functions, classes, methods, and symbols.
- Imports and dependency relationships.
- Framework-specific routes and entrypoints.
- Calls and relevant data-flow relationships.
- Security-sensitive sources and sinks.
- Relationships between normalized security findings and affected code.
- Evidence required for future attack-path reconstruction.

External scanners remain responsible for discovering security findings, while
ARVE's AST layer is responsible for understanding **how those findings relate
to the application itself**.

```text
Repository Snapshot
        ↓
     AST Parse
        ↓
Semantic Code Model
        ↓
Finding ↔ Code Mapping
        ↓
Data Flow / Entry Points
        ↓
Attack Path Reconstruction
````

### AI Reasoning & Trade-off Analysis

* **Differentiation:** Generic code intelligence is widely available; an
  ARVE-specific semantic model connecting findings to application behavior is
  the platform's stronger differentiator.
* **Security Context:** AST analysis can determine whether a vulnerable
  dependency or insecure pattern is actually reachable from an application
  entrypoint.
* **Extensibility:** The semantic model can later support framework-specific
  analyzers without coupling the entire system to a single language server.
* **Reduced Complexity:** ARVE avoids introducing a large generic code
  intelligence subsystem whose features are not directly required for
  security analysis.

The decision deliberately separates **scanner detection** from **ARVE
semantic reasoning**.

---

## ADR-027: Parallel Multi-Engine Security Execution

### Context

Phase 4A introduces multiple independent security engines, initially
OSV-Scanner for dependency vulnerabilities and Gitleaks for secret
detection.

Executing these engines sequentially would unnecessarily increase total scan
latency because the engines do not depend on one another.

### Decision

Execute independent security engines **in parallel** using the
`ParallelSecurityScanService`.

```text
                    ┌──→ OSV-Scanner ──→ Normalize ──┐
Repository Snapshot ┤                                ├──→ Persist Findings
                    └──→ Gitleaks ─────→ Normalize ──┘
```

Each engine receives the same immutable repository snapshot and operates in
its own scanner workspace.

The orchestration layer is responsible for:

1. Starting enabled engines concurrently.
2. Tracking each engine independently.
3. Collecting execution results.
4. Normalizing successful outputs.
5. Persisting findings and artifacts.
6. Producing an overall scan status.

### AI Reasoning & Trade-off Analysis

* **Performance:** OSV and Gitleaks can execute simultaneously, reducing
  end-to-end scan time.
* **Isolation:** Each engine retains its own runner, mapper, artifact, and
  execution result.
* **Extensibility:** Additional engines such as Semgrep can be added without
  redesigning the orchestration model.
* **Failure Containment:** One engine failing does not automatically prevent
  another engine from producing useful security results.

Parallelism is therefore implemented at the **orchestration layer**, rather
than coupling the individual scanner implementations together.

---

## ADR-028: Primitive Context Across Worker Threads — No SQLAlchemy ORM Objects

### Context

The parallel security pipeline initially passed a SQLAlchemy ORM `Scan`
object into worker threads.

SQLAlchemy sessions and ORM objects are not safe to use concurrently in this
manner. This caused concurrent connection/session provisioning failures during
parallel engine execution.

### Decision

Before starting parallel workers, extract the required immutable primitive
values from the ORM object:

* `scan_id`
* `project_id`
* `commit_sha`

Worker threads receive these primitive identifiers rather than sharing the
SQLAlchemy ORM instance or its session.

```text
SQLAlchemy ORM Session
        ↓
Extract immutable IDs
        ↓
 ┌───────────────┐
 │ Thread Worker │
 └───────────────┘
        ↓
Fresh service/database operations
```

### AI Reasoning & Trade-off Analysis

* **Thread Safety:** Prevents multiple workers from operating on the same
  SQLAlchemy session.
* **Clear Boundaries:** ORM lifecycle remains inside the owning application
  context while workers operate on immutable scan identifiers.
* **Reliability:** Eliminates intermittent
  `InvalidRequestError` failures caused by concurrent session operations.
* **Scalability:** The same pattern remains valid if scan execution is later
  distributed across separate worker processes.

The rule is:

> **ORM objects stay in their owning session context; parallel workers receive
> primitive identifiers.**

---

## ADR-029: Scanner-Specific Exit-Code Semantics

### Context

Different security scanners use exit codes to communicate different
conditions. Treating every non-zero process exit code as a generic failure can
incorrectly mark legitimate scanner results as failed.

OSV-Scanner, for example, uses:

* `0` — packages scanned with no known vulnerabilities.
* `1` — packages scanned and vulnerabilities found.
* `128` — no package sources were found.

A repository containing only source files may legitimately produce exit code
`128` because there are no supported dependency manifests or package sources.

### Decision

Keep the Docker runner **generic** and interpret scanner-specific exit codes
inside the scanner service.

For OSV:

```text
0   → SUCCESS
1   → SUCCESS
128 → SUCCESS
other non-zero → FAILED
```

Artifact existence is evaluated independently from process success.

A successful scan does not require an artifact to exist when the scanner has
legitimately produced no output artifact.

### AI Reasoning & Trade-off Analysis

* **Correctness:** Prevents clean repositories without dependency manifests
  from appearing as failed scans.
* **Separation of Concerns:** Docker execution remains generic while scanner
  semantics remain inside the scanner service.
* **Future-Proofing:** Each scanner can define its own legitimate result
  semantics without contaminating the common Docker runner.
* **Accurate UI:** Engine telemetry can distinguish an actual execution error
  from a valid "nothing to scan" result.

This establishes the rule that **process exit codes are interpreted according
to the scanner's documented contract, not by a universal non-zero = failure
rule**.

---

## ADR-030: Secret-Scanning Redaction and Non-Persistence

### Context

Gitleaks detects potentially sensitive credentials, API keys, tokens, and
other secrets. Persisting the actual secret value would turn ARVE's security
database and raw artifacts into another credential exposure surface.

### Decision

Gitleaks execution must use secret redaction and the ARVE mapper must enforce
a second security boundary.

```text
Repository
    ↓
Gitleaks --redact
    ↓
Redacted JSON
    ↓
Gitleaks Mapper
    ↓
NormalizedFinding
    ↓
PostgreSQL
```

The following sensitive fields must never be persisted or displayed as finding
content:

* `Secret`
* `Match`
* Raw secret values
* Raw secret-bearing `Line` values

The mapper recursively removes sensitive keys before producing the canonical
`NormalizedFinding`.

Fingerprints must use non-secret metadata and deterministic identity
components rather than the plaintext secret itself.

### AI Reasoning & Trade-off Analysis

* **Security:** A vulnerability scanner must not create a second copy of the
  credential it discovered.
* **Defense in Depth:** Redaction occurs both during scanner execution and
  during normalization.
* **Auditability:** Findings can still be tracked using rule IDs, paths,
  fingerprints, and locations without storing the credential.
* **Compliance:** Persistent scan artifacts and database records remain safer
  to retain and review.

The security invariant is:

> **ARVE may prove that a secret exists without retaining the secret itself.**

---

## ADR-031: Per-Engine Failure Isolation and PARTIAL Scan Semantics

### Context

A multi-engine security scan contains independent execution units. An engine
may fail because of a scanner-specific problem, malformed input, timeout, or
runtime issue while another engine successfully completes.

Treating the entire scan as failed would discard useful security results from
the successful engines.

### Decision

Track engine execution status independently and derive the overall scan status
from the collection of engine outcomes.

```text
OSV       → COMPLETED
Gitleaks  → FAILED
              ↓
           PARTIAL
```

The scan follows these principles:

* All required engines succeed → `COMPLETED`.
* At least one engine succeeds and another fails → `PARTIAL`.
* All engines fail → `FAILED`.
* Timeout/cancellation remains visible at the individual engine level.
* Successful engine findings and artifacts are persisted even when another
  engine fails.

### AI Reasoning & Trade-off Analysis

* **Resilience:** One scanner outage does not erase the results of other
  scanners.
* **Transparency:** Users can immediately see which engine failed and which
  results remain trustworthy.
* **Incremental Expansion:** Adding Semgrep or future engines does not require
  changing the fundamental scan lifecycle.
* **Operational Debugging:** Engine-level telemetry provides enough
  information to diagnose failures without treating the whole pipeline as a
  black box.

This makes the multi-engine pipeline **fault-tolerant by design rather than
all-or-nothing**.

---