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
