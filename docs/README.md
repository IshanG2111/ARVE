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
| **Phase 4A** | **Shared Security Foundation & OSV** | ✅ **Completed** | Canonical finding contract, CVSS normalizer, deterministic SemVer evaluation, OSV engine, 1-click remediation, and Markdown/JSON viewers. *(See [OSV Implementation Guide](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/docs/OSV_SCANNER_ARCHITECTURE_AND_IMPLEMENTATION.md))* |
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
- **Authentication**: Firebase Authentication + GitHub OAuth Provider, Firebase Admin / PyJWT token verification.
- **Database**: SQLite (dev) / PostgreSQL (production), Neo4j (Knowledge Graph).
- **Security Tools (Targeted)**: Semgrep, Gitleaks, Trivy, OWASP ZAP.
- **ML / AI**: scikit-learn, sentence/code embeddings, HDBSCAN / K-Means, LLM explanation engine.

---

## ⚡ Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Environment Setup

Copy example environment files for backend and frontend:

```bash
# Backend configuration
cp backend/.env.example backend/.env

# Frontend configuration
cp frontend/.env.example frontend/.env
```

#### Firebase & GitHub Auth Setup (Phase 1)
1. Register a GitHub OAuth App with callback URL:  
   `https://arve-fe63b.firebaseapp.com/__/auth/handler`
2. In [Firebase Console](https://console.firebase.google.com/), enable GitHub Authentication provider and enter your Client ID & Secret.

3. Update `frontend/.env` with your Firebase web configuration (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, etc.).

### 3. Run Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
Interactive OpenAPI documentation will be accessible at [http://localhost:8000/docs](http://localhost:8000/docs).

### 4. Run Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```
Web application will be accessible at [http://localhost:5173](http://localhost:5173).

---

## 🧪 Testing

```bash
# Run backend pytest suite
cd backend
python -m pytest tests

# Run frontend type-check & production build
cd frontend
npm run build
```
