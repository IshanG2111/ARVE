# ARVE Documentation Directory

This directory contains the complete technical specifications, architecture decision records (ADRs), execution runbooks, and subsystem handoff guides for the ARVE platform.

---

## 📚 Documentation Index

### 1. Operations & Getting Started
- **[HOW_TO_RUN.md](HOW_TO_RUN.md)** — Comprehensive step-by-step setup guide for running ARVE locally (Docker, Redis, Celery, FastAPI, Vite, environment flags).
- **[BACKBLAZE_B2_ARTIFACT_STORAGE.md](BACKBLAZE_B2_ARTIFACT_STORAGE.md)** — Cloud object storage configuration for raw scan outputs (`.sarif`, `.json`).
- **[SMS-Setup.md](SMS-Setup.md)** — Twilio SMS notification integration for critical findings.

### 2. Architecture Decision Records (ADRs)
- **[decision.md](decision.md)** — Executive table index of all Architectural Decision Records.
- **[decisions.md](decisions.md)** — Comprehensive historical decision log covering ADR-001 through ADR-057 (multi-engine scanning, AST separation, Groq/Gemini AI reports, deterministic fallbacks, and Neon PostgreSQL).

### 3. System Design & Roadmaps
- **[ARVE_DESIGN.md](ARVE_DESIGN.md)** — High-level system architecture, component boundaries, and pipeline dataflow.
- **[ARVE_DEVELOPMENT_PLAN.md](ARVE_DEVELOPMENT_PLAN.md)** — Multi-phase engineering roadmap and deliverables contract.
- **[DESIGN.md](DESIGN.md)** — Frontend Minimalist Editorial Halftone Design System tokens, typography, and palette.

### 4. Engine & Subsystem Specifications
- **[AST_HANDOFF.md](AST_HANDOFF.md)** — Multi-language Abstract Syntax Tree (AST) engine architecture, Tree-sitter parsers, symbol resolution, and context mapping.
- **[SECURITY_ENGINE.md](SECURITY_ENGINE.md)** — Static Application Security Testing (SAST) engine architecture and Semgrep rulepack design.
- **[HANDOVER_CODEQL_AND_SECURITY_ENGINES.md](HANDOVER_CODEQL_AND_SECURITY_ENGINES.md)** — Pinned CodeQL container integration, multi-language detection, and SARIF 2.1.0 normalization.
- **[phase-4a-shared-security-foundation.md](phase-4a-shared-security-foundation.md)** — Canonical `NormalizedFinding` contract and deterministic fingerprinting standard.

---

## 🖼️ System Architecture Diagrams & Assets
- **[screenshots/](screenshots/)** — Production screenshots of the Executive Security Assessment Report, Findings UI, and Dashboard.
- **`ARVE_DFD_01_COMPLETE_SYSTEM.png`** — Complete Data Flow Diagram (DFD Level 1).
- **`ARVE_DFD_02_COMPLETED_TILL_PHASE_3.png`** — Execution snapshot dataflow.
