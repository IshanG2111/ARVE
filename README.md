# ARVE — Adaptive Remediation & Verification Engine

<p align="center">
  <img src="home/arve-hero-1920x1080.png" alt="ARVE Hero Banner" width="100%" />
</p>

<p align="center">
  <strong>Next-Generation Application Security & Code Intelligence Platform for Modern and AI-Generated Web Codebases</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12+-3776AB?style=flat&logo=python&logoColor=white" alt="Python 3.12+" />
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon_Cloud-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Sandboxed_Engines-2496ED?style=flat&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Task_Queue-Celery_%2B_Redis-37814A?style=flat&logo=celery&logoColor=white" alt="Celery" />
  <img src="https://img.shields.io/badge/AI_Engine-Groq_GPT--OSS--120B-F55036?style=flat" alt="Groq AI" />
</p>

---

## 🎯 What is ARVE?

Modern software engineering and AI-assisted code generation (LLM copilots, automated code generators) produce applications at unprecedented velocity. However, this velocity introduces severe security blind spots: insecure dependency combinations, hardcoded credentials, unchecked query concatenations, and unvalidated data flows.

**ARVE** (*Adaptive Remediation & Verification Engine*) is a unified application security auditing and code intelligence platform. It integrates containerized multi-engine security scanners (SCA, SAST, secret detection, and deep dataflow analysis) with an in-house **AST Code Intelligence Engine** and ultra-fast **AI Executive Report Synthesis** powered by Groq and Google Gemini.

Rather than drowning developers in disjointed scanner outputs and raw alert dumps, ARVE normalizes every finding into a single canonical source of truth, performs deterministic fingerprinting that survives refactorings, correlates vulnerabilities with AST code symbols, and delivers executive security assessments with actionable SLA timelines and concrete code remediations.

---

## 📸 Platform Walkthrough & Screenshots

### 1. Executive Security Assessment Report
ARVE synthesizes hundreds of cross-engine findings into an executive-ready posture overview with SLA compliance windows (24h Critical, 7d High), categorized risk distributions, and 1-click **Download PDF** / **Markdown** exports. If external AI endpoints are unreachable, an integrated deterministic rule engine constructs an authoritative assessment instantly.

<p align="center">
  <img src="docs/screenshots/security-report.png" alt="ARVE Executive Security Assessment Report" width="95%" />
</p>

---

### 2. Canonical Security Findings & Concrete Remediation
Every vulnerability detected across OSV-Scanner, Semgrep, Gitleaks, or CodeQL is unified into clean, non-intrusive cards. Raw markdown headers (`### Impact`) are automatically stripped, displaying sanitized descriptions, affected package versions, target fix versions, and verified location paths with 1-click raw evidence inspection.

<p align="center">
  <img src="docs/screenshots/security-findings.png" alt="ARVE Security Findings View" width="95%" />
</p>

---

### 3. Repository Overview & Ingestion Telemetry
ARVE streams repository tarballs in-memory, extracts commit metadata, and computes precise language breakdowns, framework identifiers, and content-addressed SHA-256 fingerprints across all source files while excluding non-code binaries and large media assets.

<p align="center">
  <img src="docs/screenshots/overview-dashboard.png" alt="ARVE Ingestion and Codebase Blueprint" width="95%" />
</p>

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Ingestion ["1. Codebase Ingestion (Phase 2)"]
        GH[GitHub OAuth / REST API] -->|Stream Tarball in Memory| INGEST[Ingestion & Normalizer]
        INGEST -->|Exclude Binaries / Size Limits| SNAPSHOT[(Phase 2 Source Snapshot)]
        SNAPSHOT -->|Pin 40-char Commit SHA| DB_RUN[AnalysisRun & RepositoryFiles]
    end

    subgraph SecurityEngines ["2. Containerized Multi-Engine Scanners (Phase 3 & 4A)"]
        SNAPSHOT --> OSV[OSV-Scanner Container<br/>SCA Dependency Audit]
        SNAPSHOT --> GL[Gitleaks Container<br/>Secret & Token Detection]
        SNAPSHOT --> SG[Semgrep Container<br/>Polyglot SAST Rulepacks]
        SNAPSHOT --> CQL[CodeQL Container 2.27.1<br/>Deep Interprocedural SAST]
    end

    subgraph ASTEngine ["3. AST Code Intelligence Engine"]
        SNAPSHOT --> AST_PARSER[Multi-Language AST Engine<br/>Python, TS/JS, Java, Go, PHP]
        AST_PARSER --> SYMBOLS[Functions, Classes, Imports]
        AST_PARSER --> ROUTES[Web Endpoints & Call Graphs]
        AST_PARSER --> REACH[Security Reachability Mapping]
    end

    subgraph Normalization ["4. Canonical Security Normalization"]
        OSV --> MAP_OSV[OSV Finding Mapper]
        GL -->|In-Flight Redaction| MAP_GL[Gitleaks Finding Mapper]
        SG --> MAP_SG[Semgrep Finding Mapper]
        CQL --> MAP_CQL[CodeQL SARIF Mapper]
        
        MAP_OSV & MAP_GL & MAP_SG & MAP_CQL --> CANONICAL[Canonical NormalizedFinding Contract]
        CANONICAL --> FP[Deterministic SHA-256 Fingerprinting<br/>Line-Independent Identity]
    end

    subgraph Persistence ["5. Storage & Cloud Artifacts"]
        FP --> NEON[(Neon Serverless PostgreSQL<br/>security_findings)]
        SYMBOLS & ROUTES --> NEON
        OSV & GL & SG & CQL -->|Raw SARIF & JSON| B2[(Backblaze B2 Object Storage)]
    end

    subgraph Synthesis ["6. Report Synthesis & UI Presentation"]
        NEON --> REPORT_GEN[Report Generator Service]
        REPORT_GEN -->|Compressed Payload <4k Tokens| GROQ[Groq AI: openai/gpt-oss-120b]
        REPORT_GEN -.->|Fallback on Quota/Offline| DET_ENG[Deterministic Rule-Based Engine]
        GROQ & DET_ENG --> SEC_REPORT[Executive Security Report]
        
        SEC_REPORT & NEON --> UI[React 19 Dashboard<br/>PDF Export & Remediation UI]
    end
```

---

## ✨ Implemented Core Features

### 1. Multi-Engine Containerized Security Scanners
- **OSV-Scanner (SCA)**: Scans dependency manifests and lockfiles (`package-lock.json`, `requirements.txt`, `go.sum`, `pom.xml`, `yarn.lock`, `pnpm-lock.yaml`) against Google's Open Source Vulnerabilities database.
- **Gitleaks (Secret Detection)**: Identifies leaked private keys, API credentials, and authorization tokens with mandatory in-flight redaction (never persists raw secrets to disk or database).
- **Semgrep (Polyglot SAST)**: Curated ARVE security rules covering SQL injection, command execution, path traversal, SSRF, XSS, insecure TLS verification, and unsafe deserialization across **Python, JavaScript/TypeScript, Go, and PHP**.
- **CodeQL (Deep SAST)**: Pinned `arve-codeql:2.27.1` container performing deep taint tracking and interprocedural dataflow analysis, emitting standard SARIF 2.1.0 output.
- **Docker Hardening & Isolation**: Scanners execute with `--network=none` (offline), read-only source mounts (`:ro`), in-memory `/tmp` tmpfs volumes, non-root users (`1000:1000`), CPU/memory limits, and strict process timeouts.

### 2. Multi-Language AST Code Intelligence Engine
- **Dedicated Parser**: Built under `backend/app/ast/engine/`, independent of third-party language servers.
- **Language Coverage**: Parses **Python, TypeScript, JavaScript, Java, PHP, and Go**.
- **Semantic Extraction**: Extracts declared functions, methods, classes, module imports, framework routes, and intra-project function calls.
- **Conservative Symbol Resolution**: Unambiguous cross-file resolution (Python module resolution and TypeScript/JavaScript relative paths: `.ts`, `.tsx`, `.js`, `.jsx`, `index.*`). Leaves ambiguous calls unresolved rather than guessing.
- **Finding Correlation**: Maps normalized security findings to the exact enclosing code function or class context.

### 3. Canonical Finding Normalization & Deterministic Fingerprints
- **Single Source of Truth**: Unified Pydantic schema `NormalizedFinding` persisted into PostgreSQL (`security_findings`).
- **Line-Independent Identity**: Fingerprint computed via `SHA256(engine | type | rule_id | file_path | package_name | vulnerability_id)`. Vulnerabilities retain their identity across code edits and line-number shifts.
- **Fault-Tolerant Partial Scans**: If one scanner container fails or times out, healthy engines persist their findings under a `PARTIAL` scan state without losing scan data.

### 4. High-Speed AI Security Assessment Reports
- **Multi-Provider LLM Integration**: Fast synthesis powered by **Groq** (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`) and **Google Gemini**.
- **Token-Optimized Compression**: Aggressive payload serialization clusters hundreds of findings by package/CWE, selecting top representative exemplars to compress prompt payloads under 4,000 tokens for ~2-second generation.
- **Deterministic Rule-Based Fallback**: If LLM endpoints face rate limits, network outages, or quota exhaustion, an integrated fallback engine generates an authoritative security assessment directly from canonical rules and CVSS distributions.
- **Sanitized Typography**: Dual-layer regex filtering removes unescaped markdown headers (`### Impact`) and formats package names and fixed versions in minimalist, high-contrast UI typography.
- **Export Formats**: One-click **PDF Generation** (browser-native printable stylesheet) and raw **Markdown Export**.

### 5. Enterprise Data & Queue Infrastructure
- **Neon Cloud PostgreSQL**: Serverless database handling multi-scan lifecycle tracking, project metadata, and finding suppression records.
- **Backblaze B2 S3 Storage**: Ephemeral scan workspaces upload raw engine artifacts (`codeql.sarif`, `semgrep.sarif`, `osv.json`, `gitleaks.json`, `ast-output.json`) directly to private cloud storage.
- **Celery + Redis Distributed Queue**: Scan jobs run outside the HTTP lifecycle with late task acknowledgments (`task_acks_late=True`) and fair distribution (`worker_prefetch_multiplier=1`).

---

## 🗂️ Repository Structure

```text
ARVE/
├── backend/
│   ├── alembic/                      # Database schema migrations
│   ├── app/
│   │   ├── ai/                       # Multi-provider LLM adapters (Groq, Gemini)
│   │   ├── analyzer/                 # Project language & framework detection
│   │   ├── api/                      # REST API routes (auth, scans, findings, reports, ast)
│   │   ├── ast/                      # AST Code Intelligence Engine
│   │   │   ├── engine/               # Polyglot parsers (Python, TS/JS, Java, Go, PHP)
│   │   │   ├── models/               # Semantic symbol, call, and graph models
│   │   │   └── services/             # AST run orchestration & finding context mapping
│   │   ├── core/                     # Database engine, settings, and Celery setup
│   │   ├── ingestion/                # GitHub client, in-memory tarball extractor, filters
│   │   ├── models/                   # SQLAlchemy ORM models (Scan, SecurityFinding, Project)
│   │   ├── reports/                  # AI report generator & deterministic fallback engine
│   │   ├── scanner/                  # Docker container runner, artifact store, execution service
│   │   ├── schemas/                  # Pydantic validation schemas
│   │   └── security/                 # Engine mappers (OSV, Gitleaks, Semgrep, CodeQL)
│   └── tests/                        # Pytest suite (AST, AI reports, mappers, normalizers)
├── docker/
│   ├── codeql/                       # Pinned CodeQL Dockerfile & execution script
│   └── semgrep/                      # Semgrep execution definitions
├── docs/                             # Architecture documentation & decisions
│   ├── decisions.md                  # Comprehensive ADR log (ADR-001 to ADR-057)
│   ├── decision.md                   # Quick-reference architectural index
│   ├── HOW_TO_RUN.md                 # Step-by-step local & production run instructions
│   ├── ARVE_DESIGN.md                # High-level architecture & system design
│   ├── ARVE_DEVELOPMENT_PLAN.md      # Detailed multi-phase engineering roadmap
│   ├── AST_HANDOFF.md                # AST code intelligence subsystem handoff
│   ├── SECURITY_ENGINE.md            # SAST security engine specifications
│   └── screenshots/                  # Verified platform UI screenshots
├── frontend/
│   ├── src/
│   │   ├── components/               # UI components (Navbar, ScanReportView, Findings)
│   │   ├── context/                  # AuthContext, RepositoryContext (with deduplication)
│   │   ├── pages/                    # Overview, Repository, Code Intelligence, Findings, Settings
│   │   └── services/                 # Axios backend API client
│   ├── package.json
│   └── vite.config.ts
├── home/                             # Design artwork, SVG logos, and vector assets
├── docker-compose.yml                # Multi-service container orchestration
├── package.json                      # Unified root script configuration
└── run.py                            # Unified local dev server launcher
```

---

## 🚀 Getting Started

> **Detailed Setup Guide:** For complete step-by-step local execution, Docker daemon configuration, Celery worker flags, and troubleshooting, see [docs/HOW_TO_RUN.md](docs/HOW_TO_RUN.md).

### Prerequisites
- **Python**: 3.12 or newer
- **Node.js**: 20.x or newer (with `npm`)
- **Docker**: Docker Engine 24+ (for containerized scanners)
- **Redis**: 7.x (for Celery scan queue)

### 1. Clone & Configure Environment

```bash
git clone https://github.com/IshanG2111/ARVE.git
cd ARVE
```

#### Backend Environment (`backend/.env`):
Create `backend/.env` from `backend/.env.example`:

```ini
# Application
PROJECT_NAME="ARVE Security Platform"
ENVIRONMENT="development"
SECRET_KEY="your-secure-random-secret-key"

# Database (Neon Serverless PostgreSQL or local PostgreSQL)
DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Task Queue (Redis + Celery)
REDIS_URL="redis://localhost:6379/0"
SCAN_QUEUE_BACKEND="celery"

# AI Executive Report Generation
GROQ_API_KEY="gsk_your_groq_api_key_here"
GROQ_MODEL="openai/gpt-oss-120b"
# GEMINI_API_KEY="your_gemini_api_key"  # Optional secondary provider

# Scanner Engine Toggles
SCANNER_ENABLE_OSV=true
SCANNER_ENABLE_GITLEAKS=true
SCANNER_ENABLE_SEMGREP=true
SCANNER_ENABLE_CODEQL=true

# Cloud Artifact Storage (Backblaze B2 / S3 compatible)
B2_APPLICATION_KEY_ID="your_b2_key_id"
B2_APPLICATION_KEY="your_b2_application_key"
B2_BUCKET_NAME="arve-scan-artifacts"
B2_ENDPOINT_URL="https://s3.us-east-005.backblazeb2.com"
```

#### Frontend Environment (`frontend/.env`):
```ini
VITE_API_URL="http://127.0.0.1:8000"
```

---

### 2. Run Locally

#### Option A: Unified Launcher
Use the built-in development runner:

```bash
python run.py
```

#### Option B: Manual Service Startup

**Terminal 1 — Redis Server:**
```bash
redis-server
```

**Terminal 2 — Celery Worker:**
```bash
cd backend
celery -A app.core.celery_app worker --loglevel=info --pool=threads --concurrency=4
```

**Terminal 3 — FastAPI Backend:**
```bash
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 4 — React Frontend:**
```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Visit **`http://localhost:5173`** in your browser.

---

## 🧪 Testing & Verification

The backend includes a comprehensive test suite covering the multi-engine normalization pipeline, AST language parsers, and AI report synthesis:

```bash
# Run all backend unit and integration tests
pytest backend/tests/ -v

# Run AST engine and AI reporting tests specifically
pytest backend/tests/test_ast_*.py backend/tests/test_ai_and_reports.py -v
```

To verify the frontend TypeScript build:

```bash
cd frontend
npm run build
```

---

## 🏛️ Architectural Decision Records (ADRs)

ARVE enforces a strict Architecture Decision Record standard. Key decisions are documented under [`docs/decisions.md`](docs/decisions.md):

- **ADR-001**: Modular Monolith over Microservices
- **ADR-008**: Commit Pinning & In-Memory Streaming Tarball Extraction
- **ADR-013**: Docker-Based Scanner Isolation (`--network=none`, non-root)
- **ADR-017**: Canonical NormalizedFinding Schema Contract
- **ADR-018**: Line-Independent Deterministic SHA-256 Fingerprinting
- **ADR-026**: Custom AST-First Semantic Code Intelligence
- **ADR-030**: Secret Redaction and Non-Persistence
- **ADR-034**: Parallel Tri-Scanner Orchestration (OSV, Gitleaks, Semgrep)
- **ADR-040**: CodeQL Deep SAST Integration with SARIF 2.1.0
- **ADR-053**: Multi-Provider LLM Security Reports (Groq + Gemini + Fallback)
- **ADR-054**: Token-Optimized Payload Serialization for High-Speed Inference
- **ADR-055**: Decommissioning Premature Attack Graph in Favor of True AST Intelligence
- **ADR-056**: Dual-Layer Markdown Sanitization & Clean UI Typography
- **ADR-057**: Neon Serverless PostgreSQL Data Layer & Repository Deduplication

---

## 🧭 Engineering Truth & Scope Boundaries

In accordance with our commitment to engineering integrity, here is an explicit distinction between what ARVE **has implemented** and what remains on the **future research roadmap**:

| Capability | Status | Implementation Details |
|---|---|---|
| **SCA Dependency Scanning** | ✅ **Implemented** | Containerized OSV-Scanner for Python, JS/TS, Go, Java |
| **Secret & Token Detection** | ✅ **Implemented** | Containerized Gitleaks with automated in-flight redaction |
| **Pattern-Based SAST** | ✅ **Implemented** | Semgrep with curated rules for Python, TS/JS, Go, PHP |
| **Deep Dataflow SAST** | ✅ **Implemented** | Pinned CodeQL 2.27.1 container emitting merged SARIF |
| **Multi-Language AST Engine** | ✅ **Implemented** | In-house AST extraction for Python, TS/JS, Java, PHP, Go |
| **Executive Security Reports** | ✅ **Implemented** | Groq & Gemini AI synthesis + deterministic fallback + PDF |
| **Canonical Fingerprinting** | ✅ **Implemented** | Deterministic SHA-256 identity hash surviving code shifts |
| **Automated Exploit Generation** | 📅 **Roadmap** | Full synthetic exploit path execution (mockups removed) |
| **Autonomous Git Pull Request Fixes**| 📅 **Roadmap** | ARVE provides reviewable code diffs; auto-PRs are planned |
| **Dynamic Web Crawling (DAST)** | 📅 **Roadmap** | Cryptographic domain ownership verification implemented; active crawler planned |

---

## 📄 License

This project is licensed under the terms of the MIT License. See `LICENSE` for details.
