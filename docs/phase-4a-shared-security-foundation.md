# Phase 4A.0 — Shared Security Foundation Reference

## Overview

Phase 4A establishes the shared security foundation for ARVE. It guarantees that parallel development of **OSV-Scanner** (SCA), **Gitleaks** (Secret Detection), and **Semgrep** (SAST Code Security) proceeds without database migration conflicts, schema duplication, or inconsistent finding taxonomies.

---

## 1. Core Architecture & Pipeline

```text
               Phase 2 Ingested Snapshot (source workspace)
                                    |
                                    v
                  Scan Orchestration (Phase 3 Celery Worker)
                                    |
             +----------------------+----------------------+
             |                      |                      |
             v                      v                      v
     OSV-Scanner Runner      Gitleaks Runner        Semgrep Runner
(Dependency Vulnerabilities) (Hardcoded Secrets)   (SAST Code Security)
             |                      |                      |
             | raw JSON artifact    | raw JSON artifact    | raw JSON artifact
             v                      v                      v
      OsvFindingMapper      GitleaksFindingMapper  SemgrepFindingMapper
      (FindingMapper)        (FindingMapper)        (FindingMapper)
             |                      |                      |
             +----------------------+----------------------+
                                    |
                                    v
                            FindingNormalizer
      +-----------------------------------------------------------+
      | 1. Validate canonical NormalizedFinding contract          |
      | 2. Map severities to CRITICAL, HIGH, MEDIUM, LOW, INFO     |
      | 3. Compute deterministic SHA-256 finding identity         |
      | 4. Map to SQLAlchemy SecurityFinding models               |
      +-----------------------------+-----------------------------+
                                    |
                                    v
                    PostgreSQL / SQLite Database
                       (security_findings)
```

---

## 2. Shared Data Contracts

### Canonical Enums (`app.security.models`)
- `FindingSeverity`: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`
- `FindingType`: `DEPENDENCY` ("dependency"), `SECRET` ("secret"), `SAST` ("sast"), `IAC` ("iac"), `CONTAINER` ("container"), `CONFIGURATION` ("configuration")
- `FindingStatus`: `OPEN`, `RESOLVED`, `REOPENED`, `FALSE_POSITIVE`, `SUPPRESSED`
- `FindingConfidence`: `HIGH`, `MEDIUM`, `LOW`
- `EngineName`: `OSV = "osv"`, `GITLEAKS = "gitleaks"`, `SEMGREP = "semgrep"`

### NormalizedFinding Contract
```python
class NormalizedFinding(BaseModel):
    engine: str
    finding_type: str
    title: str
    description: Optional[str] = None
    severity: FindingSeverity = FindingSeverity.MEDIUM
    confidence: Optional[FindingConfidence] = None
    status: FindingStatus = FindingStatus.OPEN
    file_path: Optional[str] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    package_name: Optional[str] = None
    package_version: Optional[str] = None
    ecosystem: Optional[str] = None
    cve: Optional[str] = None
    ghsa: Optional[str] = None
    cwe: Optional[str] = None
    rule_id: Optional[str] = None
    secret_hash: Optional[str] = None
    fingerprint: Optional[str] = None
    raw_json: Optional[Union[dict[str, Any], list[Any], str]] = None
```

---

## 3. Severity Taxonomy (`app.security.severity`)

- **CVSS v3.1 Score Mapping**:
  - `9.0 – 10.0` → `CRITICAL`
  - `7.0 – 8.9`  → `HIGH`
  - `4.0 – 6.9`  → `MEDIUM`
  - `0.1 – 3.9`  → `LOW`
  - `0.0`        → `INFO`
- **Textual Aliases**:
  - `"MODERATE"`, `"warn"`, `"warning"` → `MEDIUM`
  - `"crit"`, `"blocker"`, `"p0"`, `"fatal"` → `CRITICAL`
  - `"error"`, `"major"`, `"severe"`, `"p1"` → `HIGH`
  - `"minor"`, `"negligible"`, `"p3"` → `LOW`
  - `"informational"`, `"note"`, `"none"`, `"p4"` → `INFO`

---

## 4. Deterministic Fingerprinting (`app.security.fingerprint`)

The fingerprint represents the **Finding Identity** rather than transient location details:
- **Dependency (SCA)**: `SHA256(engine | dependency | package_name | ecosystem | vulnerability_id | file_path)`
- **Secret**: `SHA256(engine | secret | rule_id | file_path | secret_hash)` (Line numbers are excluded so line shifts don't create duplicate findings).
- **SAST**: `SHA256(engine | sast | rule_id | file_path | context_signature)`
- **Scan Invariance**: `scan_id` is excluded so findings are recognized across successive scans over time.

---

## 5. Database Schema & Migration (`20260830_0005`)

- **Table**: `security_findings`
- **Check Constraints**:
  - `ck_security_findings_line_order`: `line_end >= line_start OR line_end IS NULL OR line_start IS NULL`
  - `ck_security_findings_line_start_positive`: `line_start > 0 OR line_start IS NULL`
- **Composite Indexes**:
  - `ix_security_findings_scan_engine`: `["scan_id", "engine"]`
  - `ix_security_findings_project_fingerprint`: `["project_id", "fingerprint"]` (Non-unique to preserve multi-scan audit history)
- **Relationships**:
  - `Scan.findings` (`cascade="all, delete-orphan"`)
  - `Project.findings` (`cascade="all, delete-orphan"`)

---

## 6. Parallel Development Rules

| Role / Feature Branch | Permitted Files to Create / Modify | Frozen Shared Core (Do NOT Modify) |
|---|---|---|
| **OSV Developer** | `backend/app/scanner/engines/osv.py`<br>`backend/app/security/mappers/osv.py`<br>`backend/tests/security/test_osv_*.py`<br>`backend/tests/fixtures/osv/*` | `backend/alembic/versions/*`<br>`backend/app/models/models.py`<br>`backend/app/security/models.py`<br>`backend/app/security/severity.py`<br>`backend/app/security/fingerprint.py`<br>`backend/app/security/mappers/base.py` |
| **Gitleaks Developer** | `backend/app/scanner/engines/gitleaks.py`<br>`backend/app/security/mappers/gitleaks.py`<br>`backend/tests/security/test_gitleaks_*.py`<br>`backend/tests/fixtures/gitleaks/*` | `backend/alembic/versions/*`<br>`backend/app/models/models.py`<br>`backend/app/security/models.py`<br>`backend/app/security/severity.py`<br>`backend/app/security/fingerprint.py`<br>`backend/app/security/mappers/base.py` |
| **Semgrep Developer** | `backend/app/scanner/engines/semgrep.py`<br>`backend/app/security/mappers/semgrep.py`<br>`backend/app/security/semgrep/*`<br>`backend/tests/security/test_semgrep_*.py`<br>`backend/tests/fixtures/semgrep/*` | `backend/alembic/versions/*`<br>`backend/app/models/models.py`<br>`backend/app/security/models.py`<br>`backend/app/security/severity.py`<br>`backend/app/security/fingerprint.py`<br>`backend/app/security/mappers/base.py` |

---

## 7. Production Celery + Redis Asynchronous Queueing

ARVE scans run asynchronously via Celery using Redis as the message broker (`SCAN_QUEUE_BACKEND=celery`):

- **Broker**: `redis://localhost:6379/0` (configured with AOF persistence, `--maxmemory 512mb`, and `--maxmemory-policy noeviction`).
- **Fair Dispatching**: `worker_prefetch_multiplier = 1` ensures no single worker hoards heavy multi-container scan jobs.
- **Reliable Acknowledgements**: `task_acks_late = True` and `task_reject_on_worker_lost = True` ensure crashed workers return tasks to the queue.
- **Scan Idempotency**: `ParallelSecurityScanService` and `ScanExecutionService` verify scan state before execution. Duplicate or replayed Celery tasks for terminal scans (`COMPLETED`, `PARTIAL`, `FAILED`, `CANCELLED`) safely no-op without corrupting the state machine.
- **Health Observability**: `/health` and `/api/health` provide active database, Redis, and Celery worker connectivity probes.

---

## 8. Docker Security & Container Isolation Guarantees

All security engines run in sandboxed Docker containers governed by strict isolation contracts:

| Security Control | Implementation | Purpose |
|---|---|---|
| **Non-Root User** | `--user 1000:1000` | Prevents container processes from acquiring host root permissions. |
| **Read-Only Code Mount** | `--mount type=bind,source=<workspace>,target=/workspace,readonly` | Guarantees scanner engines cannot alter or corrupt repository source code. |
| **Ephemeral Memory** | `--tmpfs /tmp:rw` with `HOME=/tmp` | Gives Semgrep/OSV a writable scratchpad in RAM for caches and telemetry without touching disk. |
| **Network Air-Gap** | `--network=none` (Semgrep, Gitleaks) | Eliminates outbound telemetry leaks or remote code fetch during code analysis. |
| **Air-Gapped Rules** | `--mount type=bind,source=<rules_dir>,target=/rules,readonly` | Pre-bundled offline rule catalog mounted directly at `/rules:ro`. |

