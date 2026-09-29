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
| **Phase 4A** | **Multi-Engine Security (OSV, Gitleaks, Semgrep, CodeQL)** | ✅ **Completed** | Canonical finding contract, CVSS normalizer, OSV-Scanner (SCA), Gitleaks (Secrets with redaction), Semgrep (SAST with remediation), CodeQL (deep SAST), deterministic fingerprinting, and unified PostgreSQL persistence. |
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