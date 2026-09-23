# ARVE — AI Security Pattern & Attack Intelligence

**ARVE** (Adaptive Remediation & Verification Engine) is an AI-assisted cybersecurity platform that analyzes AI-generated web applications, detects security vulnerabilities, learns recurring vulnerability patterns across applications, and visualizes how those weaknesses can combine into realistic attack paths.

> **Core Idea:** ARVE learns how AI-generated code tends to become vulnerable, identifies recurring security patterns in new applications, and reconstructs code-grounded attack paths from external entry points to sensitive assets.

---

## 🚀 Project Phase Progress & Roadmap

| Phase | Description | Status | Key Deliverables |
|---|---|---|---|
| **Phase 0** | **Project Foundation** | ✅ **Completed** | Shared dev environment, FastAPI backend, React (Vite/TS) frontend, SQLite/PostgreSQL DB setup, environment config. |
| **Phase 1** | **Authentication + GitHub Integration** | ✅ **Completed** | Firebase Authentication + GitHub OAuth Provider, Firebase ID Token validation in FastAPI, User session management, GitHub repo listing & selection. |
| **Phase 2** | **Repository Ingestion & Normalization** | ✅ **Completed** | GitHub authenticated tree ingestion, file filtering, language/framework detection, SHA-256 normalization, and analysis run state machine. |
| **Phase 3** | **Security Detection Orchestration** | ✅ **Completed** | Docker container scanner orchestrator, Celery task distribution, execution telemetry, and Backblaze B2 cloud storage. |
| **Phase 4A** | **Multi-Engine Security (OSV, Gitleaks, Semgrep)** | ✅ **Completed** | Canonical finding contract, CVSS normalizer, OSV-Scanner (SCA), Gitleaks (Secrets with redaction), Semgrep (SAST with remediation), deterministic fingerprinting, and unified PostgreSQL persistence. |
| **Phase 4B** | **ARVE Security Dataset** | 📅 **Planned** | Security pattern corpus combining OWASP/Juliet ground truth, AI-generated apps, and vulnerability mutations. |
| **Phase 5** | **ML Security Pattern Engine** | 📅 **Planned** | Code/security embeddings, HDBSCAN/K-Means vector clustering, and LLM pattern interpretation. |
| **Phase 6** | **Security Knowledge Graph** | 📅 **Planned** | Neo4j security graph, Obsidian-style interactive node visualization (vulnerabilities, CWEs, frameworks, attack techniques). |
| **Phase 7** | **Project Attack Graph** | 📅 **Planned** | Code-grounded application-specific attack path reconstruction from entry points to sensitive assets. |
| **Phase 8** | **Risk Intelligence** | 📅 **Planned** | Context-aware vulnerability prioritization based on attack path reachability and asset sensitivity. |
| **Phase 9** | **Final ARVE Dashboard** | 📅 **Planned** | Integrated security score, findings explorer, interactive attack graph, and global knowledge graph pages. |
| **Phase 10** | **Security Audit Reports** | 📅 **Planned** | Automated audit report generation grounded in verified scanner evidence and LLM summaries. |
| **Phase 11** | **Validation & Research Evaluation** | 📅 **Planned** | Empirical ML cluster purity evaluation, precision/recall benchmarks, and scanner baseline comparisons. |

---

## 📚 Specialized Architecture Documentation
- [Infisical Environment Setup & Essential Keys](INFISICAL_ENV_SETUP.md)
- [CodeQL & Security Engines Handover Document](HANDOVER_CODEQL_AND_SECURITY_ENGINES.md)
- [OSV-Scanner Architecture & Complete Implementation Guide](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/docs/OSV_SCANNER_ARCHITECTURE_AND_IMPLEMENTATION.md)
- [Backblaze B2 Cloud Artifact Storage Guide](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/docs/BACKBLAZE_B2_ARTIFACT_STORAGE.md)
- [Database Coordination and Migration Strategy](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/docs/phase-3(IG)/ARVE_Database_Coordination_and_Migration_Strategy.md)

---

## 🏗 High-Level Architecture

```text
                    +---------------------+
                    |   React (Vite/TS)   |
                    |     Web Client      |
                    +----------+----------+
                               |
                               v
                    +---------------------+
                    |       FastAPI       |
                    |     Core Backend    |
                    +----------+----------+
                               |
          +--------------------+--------------------+
          |                    |                    |
          v                    v                    v
  Repository Analyzer    Security Engine      ML/Pattern Engine
          |                    |                    |
          +--------------------+--------------------+
                               |
                               v
                    +---------------------+
                    | PostgreSQL + Neo4j  |
                    | Data + Knowledge    |
                    | Graph               |
                    +---------------------+
```

---

## 🛠 Technology Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Lucide Icons, React Router 7.
- **Backend**: FastAPI, Python 3.12, Pydantic v2, SQLAlchemy 2.0, HTTPX, PyJWT.
- **Asynchronous Task Queue**: Celery 5.6, Redis 7 (Broker & Backend).
- **Authentication**: Firebase Authentication + GitHub OAuth Provider, Firebase Admin / PyJWT token verification.
- **Database**: PostgreSQL (Neon cloud pooler) / SQLite (dev fallback), Neo4j (Knowledge Graph).
- **Security Engines (Phase 4A)**:
  - **OSV-Scanner** (`ghcr.io/google/osv-scanner:v1.9.2`): Software Composition Analysis (SCA).
  - **Gitleaks** (`ghcr.io/gitleaks/gitleaks:v8.24.2`): Hardcoded secrets & credential leak detection.
  - **Semgrep** (`semgrep/semgrep:1.90.0`): Static Application Security Testing (SAST) with remediation catalogs.
- **ML / AI**: scikit-learn, sentence/code embeddings, HDBSCAN / K-Means, LLM explanation engine.

---

## ⚡ Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- Docker Desktop (running)

### 2. Unified One-Click Start (Recommended)

From the ARVE project root:
```bash
python run.py
# or
npm start
```
This automatically verifies Docker, boots Redis (`arve-redis`), builds scanner images, applies database migrations, starts the Celery worker, launches FastAPI on `:8000`, and starts Vite on `:5173`.

### 3. Manual Step-by-Step Execution

#### Step A: Start Redis (Docker)
```bash
docker compose up -d redis
```

#### Step B: Run Celery Worker
```bash
# On Linux/macOS
celery -A app.celery_app worker --loglevel=info --concurrency=4 --workdir backend

# On Windows
npm run worker
```

#### Step C: Run Backend (FastAPI)
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
Interactive OpenAPI docs: [http://localhost:8000/docs](http://localhost:8000/docs)  
System health endpoint: [http://localhost:8000/health](http://localhost:8000/health)

#### Step D: Run Frontend (React + Vite)
```bash
cd frontend
npm run dev
```
Web application: [http://localhost:5173](http://localhost:5173)

---

## 🧪 Testing

```bash
# Run backend scanner & security test suites (151 tests)
cd backend
python -m pytest tests/scanner tests/security

# Run frontend type-check & production build
cd frontend
npm run build
```
