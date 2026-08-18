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