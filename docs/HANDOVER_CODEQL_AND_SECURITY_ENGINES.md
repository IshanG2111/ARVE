# ARVE Security Engines & CodeQL Handover Document

> **Target Audience:** Engineers taking over or extending ARVE's security scanning pipeline, specifically focused on integrating **GitHub CodeQL (Deep SAST)** alongside existing engines (**Semgrep, OSV-Scanner, Gitleaks**).

---

## 1. System Overview & Engine Pipeline

ARVE uses a modular, containerized multi-engine security scanning pipeline orchestrated via Celery and Docker.

```text
Repository Snapshot (Phase 2 Cloned Workspace)
                     │
                     ▼
       Scan Orchestration Service (Phase 3)
                     │
  ┌──────────────────┼──────────────────┬──────────────────┬──────────────────┐
  │                  │                  │                  │                  │
  ▼                  ▼                  ▼                  ▼                  ▼
Semgrep Engine   OSV Engine     Gitleaks Engine     [CodeQL Engine]      [Future Engine]
(Lightweight)       (SCA)           (Secrets)         (Deep SAST)
  │                  │                  │                  │
  │ semgrep.sarif    │ osv.json         │ gitleaks.json    │ codeql.sarif
  ▼                  ▼                  ▼                  ▼
SemgrepMapper     OsvMapper       GitleaksMapper     [CodeqlMapper]
  │                  │                  │                  │
  └──────────────────┴──────────────────┴──────────────────┘
                     │
                     ▼
             FindingNormalizer
  ┌────────────────────────────────────────────────────────┐
  │ 1. Validate canonical NormalizedFinding contract       │
  │ 2. Standardize severity (CRITICAL, HIGH, MEDIUM, ...)  │
  │ 3. Compute line-shift resilient SHA-256 fingerprint    │
  │ 4. Attach remediation guidance & code diffs            │
  │ 5. Convert to SQLAlchemy SecurityFinding models        │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
         PostgreSQL Database (`security_findings`)
                             │
                             ▼
     REST API (`/api/scans/{scan_id}/findings`) ──> Frontend UI
```

---

## 2. Environment Variables & Infisical Setup

If you are deploying or configuring secrets in **Infisical**, the keys are partitioned into `/backend` and `/frontend`.

### A. Backend Scope (`/backend`)

Add these keys in Infisical under environment `dev` / `staging` / `prod`:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `ARVE_ENV` | `dev` or `production` | Environment mode (gates test endpoints/demo tokens) |
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | PostgreSQL / Neon DB connection string |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection for Celery broker & result backend |
| `SCAN_QUEUE_BACKEND` | `celery` | Task queue backend (`celery` or `fastapi`) |
| `JWT_SECRET` | `arve-secret-key-super-secure...` | Secret key for JWT session cookies |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_EXPIRE_MINUTES` | `10080` (7 days) | Token lifespan |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed origin for CORS & OAuth redirects |
| `GITHUB_CLIENT_ID` | `Ov23li...` | GitHub OAuth application client ID |
| `GITHUB_CLIENT_SECRET` | `435d6...` | GitHub OAuth client secret |
| `GITHUB_REDIRECT_URI` | `http://localhost:8000/auth/github/callback` | Callback URL registered with GitHub |
| `GITHUB_OAUTH_SCOPE` | `read:user user:email repo` | Permissions requested during login |
| `FIREBASE_PROJECT_ID` | `arve-fe63b` | Firebase project identifier |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `{"type": "service_account", ...}` | Optional Firebase admin credential JSON |
| **Scanner Engine Controls** | | |
| `SCANNER_ENABLE_SEMGREP` | `true` | Enable/disable Semgrep SAST engine |
| `SCANNER_SEMGREP_IMAGE` | `semgrep/semgrep:1.90.0` | Pinned Semgrep container image |
| `SCANNER_SEMGREP_NETWORK` | `none` | Network isolation for Semgrep container |
| `SCANNER_ENABLE_OSV` | `true` | Enable/disable OSV-Scanner (SCA) |
| `SCANNER_OSV_IMAGE` | `ghcr.io/google/osv-scanner:v1.9.2` | OSV container image |
| `SCANNER_OSV_NETWORK` | `bridge` | Outbound network mode for OSV vulnerability queries |
| `SCANNER_ENABLE_GITLEAKS` | `true` | Enable/disable Gitleaks secret scanner |
| `SCANNER_ENABLE_CODEQL` | `true` | Enable/disable CodeQL deep SAST engine |
| `SCANNER_CODEQL_IMAGE` | `arve-codeql:2.27.1` | Pinned local ARVE CodeQL container image |
| `SCANNER_CODEQL_QUERY_SUITE` | `security-extended` | CodeQL security query suite |

| `SCANNER_GITLEAKS_IMAGE` | `ghcr.io/gitleaks/gitleaks:v8.24.2` | Gitleaks container image |
| `SCANNER_NETWORK_MODE` | `none` | Default sandbox container network mode |
| `SCANNER_MEMORY_LIMIT` | `1g` | Memory cap per engine container |
| `SCANNER_CPU_LIMIT` | `1.5` | CPU core cap per engine container |
| `SCANNER_ENGINE_TIMEOUT_SECONDS` | `180` | Max duration per engine before cancellation |
| `SCANNER_GLOBAL_TIMEOUT_SECONDS` | `600` | Max total duration for the entire scan job |
| **Backblaze B2 (Artifacts)** | *(Optional in dev, required in prod)* | |
| `B2_ENDPOINT` | `https://s3.<region>.backblazeb2.com` | S3-compatible B2 endpoint |
| `B2_REGION` | `us-west-004` | Bucket region |
| `B2_BUCKET_NAME` | `arve-scan-artifacts` | Storage bucket name |
| `B2_ACCESS_KEY_ID` | `your-b2-key-id` | B2 Application Key ID |
| `B2_SECRET_ACCESS_KEY` | `your-b2-application-key` | B2 Application Key |

### B. Frontend Scope (`/frontend`)

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `arve-fe63b.firebaseapp.com` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | `arve-fe63b` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET`| `arve-fe63b.firebasestorage.app` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `1062714082926` | Cloud messaging sender ID |
| `VITE_FIREBASE_APP_ID` | `1:1062714082926:web:...` | Web app identifier |

> [!TIP]
> In local development, the backend automatically reads `backend/.env` and the frontend reads `frontend/.env` even if Infisical CLI is offline or unauthenticated.

---

## 3. Semgrep Polyglot Rulepack (Go, PHP, Python, JS/TS)

Semgrep operates strictly **offline** (`--network=none`) using bundled ARVE security rules mounted into `/rules:ro`.

### Supported Languages
1. **Python**: SQL injection, command injection, path traversal, SSRF, weak hashing (MD5/SHA1), insecure TLS verification, unsafe YAML/pickle deserialization, taint dataflow traces.
2. **JavaScript / TypeScript**: SQL injection, command injection (`child_process.exec`), XSS (`innerHTML`), eval injection.
3. **Go**:
   - `arve.go.sql-injection` (`fmt.Sprintf` / concatenation in `db.Query`, `db.Exec`)
   - `arve.go.command-injection` (`exec.Command` with `sh -c` / `bash -c`)
   - `arve.go.path-traversal` (`os.Open`, `os.ReadFile`, `ioutil.ReadFile`)
   - `arve.go.insecure-tls-verify-false` (`InsecureSkipVerify: true`)
4. **PHP**:
   - `arve.php.sql-injection` (`$db->query()`, `mysqli_query()`)
   - `arve.php.command-injection` (`system()`, `exec()`, `shell_exec()`, `passthru()`)
   - `arve.php.eval-injection` (`eval()`)
   - `arve.php.path-traversal` (`include`, `require`, `file_get_contents`)

### Rule Maintenance Workflow
When adding or altering rules in `backend/app/security/semgrep/rules/`:
1. **Rule ID Format**: Must match `arve.<lang>.<vulnerability-id>` (e.g. `arve.go.sql-injection`).
2. **Metadata Contract**: Every rule requires `cwe`, `owasp`, `category: security`, `confidence`, `provenance`, and `remediation_id`.
3. **Validation & Sync Command**:
   ```bash
   cd backend
   python -c "from app.security.semgrep.sync import generate_rulepack_manifest; generate_rulepack_manifest()"
   ```
4. **Run Unit Tests**:
   ```bash
   python -m pytest tests/security/test_semgrep_*.py
   ```

---

## 4. CodeQL Integration — Implemented

CodeQL is implemented as one ARVE scanner engine backed by a dedicated pinned
Docker image. The engine detects only supported languages present in the Phase
2 snapshot, creates isolated temporary databases, analyzes each database with
the configured security query suite, and merges the language reports into one
SARIF 2.1.0 artifact.

### Engine contract

```text
backend/app/scanner/engines/codeql.py
    |
    +-- name = "codeql"
    +-- image = arve-codeql:2.27.1
    +-- build_command()
    +-- artifact_path() -> /output/codeql.sarif
```

### Supported languages

```text
.js .jsx .mjs .cjs .ts .tsx  -> javascript-typescript
.java                       -> java
.py                         -> python
.go                         -> go
```

Only detected languages are executed. CodeQL databases are created under
`/tmp/codeql-db` and removed automatically after the wrapper exits.

### Container

Build the local image before running ARVE:

```bash
docker build -t arve-codeql:2.27.1 ./docker/codeql
```

The wrapper emits only:

```text
/output/codeql.sarif
```

and the normal ARVE artifact store uploads it under:

```text
scans/<scan-id>/codeql/codeql.sarif
```

### Normalization

`backend/app/security/mappers/codeql.py` parses SARIF 2.1.0, preserves rule
and tool metadata, extracts CWE/OWASP tags when present, maps CodeQL
security-severity/level into the ARVE severity taxonomy, records confidence
from SARIF precision, and produces canonical `NormalizedFinding` objects.
The existing fingerprinting and PostgreSQL persistence layers are reused.

### Orchestration

CodeQL is registered through `build_default_registry()` and
`build_security_registry()`. The parallel service executes OSV, Gitleaks,
Semgrep, and CodeQL concurrently. One engine may fail or time out without
discarding findings produced by successful engines; the scan is then marked
`PARTIAL`.

### Frontend

The analysis page shows CodeQL engine status, lists it with the other engines,
and opens its raw SARIF artifact through the existing artifact API. The
findings page includes CodeQL as an engine filter. The homepage Run Analysis
flow is unchanged because it already queues the generic security scan after a
fresh ingestion; CodeQL participates automatically through the backend
registry.

## 5. Key Architecture Constraints & Gotchas

1. **Docker Sandbox Network:**
   - Security scanners (`semgrep`, `gitleaks`) must run with `--network=none`.
   - `osv` runs with `bridge` network because it queries the live OSV vulnerability database.
   - CodeQL query packs should be pre-baked into the CodeQL Docker container so it runs completely offline.
2. **Line Number Shifts vs Fingerprint Identity:**
   - ARVE deterministic fingerprints (`compute_finding_fingerprint`) intentionally **exclude line numbers** for code findings:
     `SHA-256(engine | finding_type | rule_id | file_path)`
   - This prevents duplicate finding records from being created whenever lines are inserted above existing vulnerabilities.
3. **Database Concurrency:**
   - In production, Celery workers use `db = SessionLocal()`. Always close sessions in `finally` blocks.
   - All migrations must be recorded under `backend/alembic/versions/`.

---

## 6. Verification Checklist for New Scanners

- [ ] Implements `ScannerEngine` protocol (`name`, `build_command`, `artifact_path`).
- [ ] Container limits set (`--memory`, `--cpus`, `--read-only`, non-root user `1000:1000`).
- [ ] Output artifact parsed into `NormalizedFinding` objects.
- [ ] Deterministic fingerprint calculated and unique per vulnerability.
- [ ] Database persistence verified in `security_findings` table.
- [ ] `GET /api/scans/{scan_id}/findings` returns formatted findings with remediation metadata.
- [ ] Full test suite passes: `python -m pytest tests/`
