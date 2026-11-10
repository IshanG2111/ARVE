# ARVE Architectural Decision Records (ADRs)

> **Canonical Document Reference:** For the complete historical ADR log (ADR-001 through ADR-057), see [docs/decisions.md](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/docs/decisions.md).

---

## Executive Summary of Core Architectural Decisions

| ADR | Topic | Decision |
|---|---|---|
| **ADR-001** | Architecture Pattern | Modular Monolith (FastAPI + React 19 + TypeScript) |
| **ADR-008** | Ingestion Engine | Commit SHA pinning & in-memory streaming tarball extraction |
| **ADR-013** | Sandbox Security | Isolated Docker containers with `--network=none`, read-only mounts, non-root user |
| **ADR-017** | Canonical Findings | Single normalized finding schema (`NormalizedFinding`) as single source of truth |
| **ADR-018** | Finding Fingerprints | Line-independent deterministic SHA-256 fingerprinting |
| **ADR-026** | Code Intelligence | Custom AST-first semantic analysis for 6 languages (Python, TS, JS, Java, PHP, Go) |
| **ADR-034** | Scanner Orchestration | Multi-engine parallel scanner pipeline (OSV-Scanner, Gitleaks, Semgrep, CodeQL) |
| **ADR-035** | Background Tasks | Celery + Redis task queue with `late_ack=True` and worker prefetch limits |
| **ADR-050** | Artifact Storage | Hybrid persistence: metadata in PostgreSQL, raw SARIF/JSON artifacts in Backblaze B2 |
| **ADR-053** | AI Report Synthesis | Multi-provider LLM reports (Groq + Gemini) with automatic deterministic fallback |
| **ADR-054** | Token Optimization | Payload compression and exemplar clustering (<4,000 tokens) for ~2s inference |
| **ADR-055** | Truth in Engineering | Decommissioned premature Attack Graph mockups in favor of verifiable AST Code Intelligence |
| **ADR-056** | Typography Standards | Dual-layer markdown sanitization (`### Impact` removal) and minimalist sans-serif typography |
| **ADR-057** | Production Persistence | Neon Serverless PostgreSQL with repository list deduplication |

---

For the full detailed reasoning, trade-offs, and diagrams for each decision, refer to [decisions.md](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/docs/decisions.md).

