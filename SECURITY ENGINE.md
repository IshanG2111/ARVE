# Phase 1 — SAST Security Engine Implementation Plan

## Goal Description
Build ARVE's first security engine: a **Static Application Security Testing (SAST) engine** that consumes the repository snapshot produced by ingestion and scan orchestration, analyzes relevant source files, runs curated Semgrep and ARVE custom security rules, normalizes scanner output into canonical security findings, extracts evidence (source, sink, reason), deduplicates findings, and persists structured records in the database.

---

## Architecture Overview

```text
Repository Snapshot (Phase 2 Filesystem)
        │
        ▼
Scan Orchestration (Phase 3 Celery Worker)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                       SAST ENGINE                           │
│                                                             │
│  1. File Selector      ──> Classify & filter source files   │
│  2. Language Detector  ──> Determine target languages        │
│  3. Semgrep Scanner    ──> Dockerized Semgrep + ARVE Rules  │
│  4. Result Parser      ──> Structured JSON extraction       │
│  5. Normalizer         ──> Canonical Finding Schema         │
│  6. Evidence Extractor ──> Source / Sink / Context Reason   │
│  7. Deduplicator       ──> SHA256 Fingerprinting            │
│  8. Persistence        ──> PostgreSQL (security_findings)   │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
Canonical Security Findings API
        │
        ├── Dashboard / Frontend
        ├── Risk Scoring Engine (Future)
        ├── Attack-Path & Graph Analysis (Future)
        └── LLM Explanation & Remediation (Future)
```

---

## User Review Required

> [!IMPORTANT]
> **Docker Engine & Semgrep Image:** The SAST engine runs Semgrep in an isolated Docker container (`semgrep/semgrep:latest` by default, or an embedded `arve-sast-scanner` image) with `--network=none` and read-only mounts matching ARVE's sandbox standards. For environments where Docker is not available during unit tests, a mock runner and test fixture are provided to ensure 100% test reliability.

> [!NOTE]
> **Database Schema Changes:** A new table `security_findings` will be added via Alembic migration (`20260827_0005_phase1_sast_findings.py`). This table is designed as the canonical finding store shared by all future security engines (SCA, Secrets, IaC).

---

## Open Questions

- None blocking. The architecture strictly adheres to the 7 Phase 1 milestones and engine-agnostic contracts established in Phase 3.

---

## Proposed Changes

### 1. Common Security Foundation (`backend/app/security/common/`)

#### [NEW] `backend/app/security/__init__.py`
#### [NEW] `backend/app/security/common/__init__.py`
#### [NEW] `backend/app/security/common/finding_schema.py`
- Pydantic models for `CanonicalFinding`, `FindingSeverity` (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`), `FindingConfidence` (`HIGH`, `MEDIUM`, `LOW`), `FindingCategory` (`injection`, `web`, `auth`, `crypto`, `dangerous_api`, `file_handling`, `other`), `FindingEvidence` (`source`, `sink`, `reason`, `data_flow`), `FindingStatus` (`OPEN`, `RESOLVED`, `FALSE_POSITIVE`, `SUPPRESSED`).

#### [NEW] `backend/app/security/common/engine_interface.py`
- `SecurityEngine` interface definition extending the Phase 3 `ScannerEngine` protocol with scanning, parsing, normalizing, and persistence capabilities.

#### [NEW] `backend/app/security/common/severity.py`
- Taxonomy mapping from scanner-native levels (e.g. Semgrep `ERROR`, `WARNING`, `INFO`) to ARVE canonical severity levels.

#### [NEW] `backend/app/security/common/fingerprint.py`
- Deterministic SHA256 fingerprinting: `SHA256(project_id + file_path + line_start + category + rule_id)`.

---

### 2. Database Models & Migrations

#### [MODIFY] [`backend/app/models/models.py`](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/backend/app/models/models.py)
- Add `SecurityFinding` SQLAlchemy model:
  - `id` (String UUID PK)
  - `scan_id` (FK to `scans.id`, ondelete="CASCADE", indexed)
  - `project_id` (FK to `projects.id`, ondelete="CASCADE", indexed)
  - `analysis_run_id` (FK to `analysis_runs.id`, indexed)
  - `engine` (String, default `"sast"`, indexed)
  - `rule_id` (String, indexed)
  - `title` (String)
  - `description` (Text)
  - `severity` (String, indexed)
  - `scanner_severity` (String)
  - `confidence` (String, indexed)
  - `category` (String, indexed)
  - `cwe` (String, indexed)
  - `cve` (String, nullable)
  - `file_path` (String, indexed)
  - `line_start` (Integer)
  - `line_end` (Integer)
  - `code_snippet` (Text)
  - `evidence` (Text / JSON serialized)
  - `remediation` (Text)
  - `fingerprint` (String, indexed)
  - `status` (String, default `"OPEN"`, indexed)
  - `created_at`, `updated_at` (DateTime)
- Add relationships on `Scan.findings` and `Project.findings`.

#### [MODIFY] [`backend/app/schemas/schemas.py`](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/backend/app/schemas/schemas.py)
- Add `SecurityFindingResponse`, `SecurityFindingListResponse`, `SecurityFindingUpdate` Pydantic schemas.

#### [NEW] `backend/alembic/versions/20260827_0005_phase1_sast_findings.py`
- Alembic revision creating `security_findings` table and associated indexes.

---

### 3. SAST Engine Implementation (`backend/app/security/sast/`)

#### [NEW] `backend/app/security/sast/__init__.py`

#### [NEW] `backend/app/security/sast/scanner/file_selector.py`
- Filter repository files based on target source code extensions (`.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.java`, `.go`, `.php`, `.rb`, `.cs`, `.c`, `.cpp`).
- Exclude ignored patterns: `.git/`, `node_modules/`, `vendor/`, `dist/`, `build/`, `coverage/`, `.cache/`, lockfiles, minified bundles, binary files.

#### [NEW] `backend/app/security/sast/scanner/language_detector.py`
- Identifies languages in the filtered workspace to activate language-specific SAST rule packs (Python, JavaScript/TypeScript, Java, Go).

#### [NEW] `backend/app/security/sast/scanner/semgrep_runner.py`
- Implements `ScannerEngine` protocol for Semgrep container execution.
- Configures Semgrep CLI command: `semgrep scan --config /rules --json --output /output/sast/semgrep-results.json /code`.

#### [NEW] `backend/app/security/sast/rules/`
- Directory containing curated security rule configs:
  - `rules/arve/injection.yaml` (SQLi, Command Injection, Code Injection)
  - `rules/arve/web.yaml` (XSS, SSRF, Open Redirect, Path Traversal)
  - `rules/arve/auth.yaml` (Insecure Auth, Missing Checks, Weak Sessions)
  - `rules/arve/crypto.yaml` (Weak Hashing MD5/SHA1, Insecure Random, Hardcoded Keys)
  - `rules/arve/dangerous_api.yaml` (eval, exec, os.system, subprocess misuse, pickle/yaml unsafe deserialization)
  - `rules/arve/file_handling.yaml` (Arbitrary file read/write, path traversal in file ops)

#### [NEW] `backend/app/security/sast/parser/semgrep_parser.py`
- Parses raw Semgrep JSON results: extracting rule IDs, messages, file paths, line ranges, matched code lines, CWE mappings, and taint flow traces.

#### [NEW] `backend/app/security/sast/normalizer/finding_normalizer.py`
- Maps raw Semgrep outputs into `CanonicalFinding` objects.
- Standardizes severities, categorizes into vulnerability taxonomy, extracts CWEs, formats clear titles, and attaches remediation guidance.

#### [NEW] `backend/app/security/sast/evidence/evidence_extractor.py`
- Extracts source, sink, code snippet context, and generates human-readable vulnerability reasoning.

#### [NEW] `backend/app/security/sast/dedup/deduplicator.py`
- Deduplicates findings using `fingerprint` and merges overlapping rules on the same file/line.

#### [NEW] `backend/app/security/sast/controller/scan_controller.py`
- Orchestrates SAST scan lifecycle: file classification -> engine execution -> artifact loading -> parsing -> normalization -> deduplication -> persistence in `security_findings`.

---

### 4. Integration with Scan Orchestration & Celery

#### [MODIFY] [`backend/app/core/config.py`](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/backend/app/core/config.py)
- Add SAST settings: `SEMGREP_DOCKER_IMAGE: str = "semgrep/semgrep:latest"`, `SAST_ENABLE_SEMGREP: bool = True`, `SAST_CUSTOM_RULES_PATH: Optional[str] = None`.

#### [MODIFY] [`backend/app/scanner/service.py`](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/backend/app/scanner/service.py)
- Register `SemgrepEngine` in `build_default_registry()`.
- After engine execution completes, execute SAST normalization and persistence to store findings in `security_findings`.

#### [MODIFY] [`backend/app/scanner/tasks.py`](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/backend/app/scanner/tasks.py)
- Ensure Celery tasks log finding counts upon completion.

---

### 5. API Layer

#### [NEW] `backend/app/api/findings.py`
- `GET /api/scans/{scan_id}/findings` (List findings for a scan with severity/category filters)
- `GET /api/projects/{project_id}/findings` (List findings across project scans)
- `GET /api/findings/{finding_id}` (Get finding details with evidence & snippet)
- `PATCH /api/findings/{finding_id}/status` (Update status to RESOLVED / FALSE_POSITIVE / SUPPRESSED)

#### [NEW] `backend/app/api/sast.py`
- `POST /api/security/sast/scan` (Explicit endpoint to trigger SAST analysis)
- `GET /api/security/sast/scans/{scan_id}` (Get SAST scan details)

#### [MODIFY] [`backend/app/api/__init__.py`](file:///c:/Users/KIIT0001/Desktop/STUDY/Github/ARVE/backend/app/api/__init__.py)
- Register `findings_router` and `sast_router` in `api_router`.

---

### 6. Security Test Corpus & Test Suite

#### [NEW] `backend/tests/security/corpus/`
- Vulnerable samples:
  - `vulnerable/sql_injection.py` (String concatenation SQLi)
  - `vulnerable/command_injection.py` (`os.system` / `subprocess.Popen(shell=True)`)
  - `vulnerable/xss.js` (`innerHTML` assignment with user input)
  - `vulnerable/ssrf.py` (Unvalidated `requests.get(url)`)
  - `vulnerable/path_traversal.py` (Unsanitized `open(filepath)`)
  - `vulnerable/crypto.py` (MD5 hashing passwords, hardcoded secret key)
- Safe samples:
  - `safe/parameterized_sql.py` (Parameterized query execution)
  - `safe/escaped_output.js` (Sanitized DOM updates)
  - `safe/safe_path.py` (Path validation & safe path resolution)

#### [NEW] `backend/tests/security/test_sast_engine.py`
- Comprehensive tests verifying:
  1. File selector & language detection accuracy
  2. Semgrep parser against standard JSON results
  3. Finding normalization & severity taxonomy mapping
  4. Deduplication & SHA256 fingerprinting
  5. Evidence extraction (source, sink, reason)
  6. Database persistence of `SecurityFinding` models
  7. API retrieval and status updates
  8. End-to-end SAST scan execution against test corpus

---

## Verification Plan

### Automated Tests
```bash
# Run the entire backend test suite including Phase 1 SAST tests
python -m pytest backend/tests

# Run specifically the security and SAST test suite
python -m pytest backend/tests/security
```

### Manual Verification
1. Run database migration: `infisical run --env=dev --path=/backend -- alembic upgrade head`
2. Start the services via `run.bat` or `python run.py`.
3. Ingest a test repository and trigger a scan.
4. Verify in the Celery terminal:
   - Semgrep container startup and execution.
   - Result extraction, normalization into canonical findings.
   - `security_findings` persisted with correct CWE, severity, and evidence.
5. Query `GET /api/scans/{scan_id}/findings` to inspect structured finding payloads.
