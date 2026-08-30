# ARVE Phase 4A: OSV-Scanner & Gitleaks Integration and Normalization

## Executive Summary  
This report presents a **detailed implementation plan** for ARVE Phase 4A, integrating the OSV-Scanner and Gitleaks engines into a modular scanning pipeline. We propose separate *engine adapter modules* for OSV-Scanner (for dependency vulnerabilities) and Gitleaks (for secret leaks), each running as an isolated Docker task.  Each engine will produce its raw findings (as JSON) into a standardized location, followed by a **Normalization** step that maps raw fields into a unified “finding” schema.  The design emphasizes security (sandboxing containers with limited capabilities and no Docker socket), clear interfaces (a common `ScannerEngine` contract), and modern CI/CD support. 

Key details include **step-by-step tasks** for two developers (parallel OSV vs Gitleaks implementation, then integration), **field-mapping tables** from each engine’s output to the normalized schema, the complete normalized schema (field names, types, examples), and realistic **mock repos** (with contents and expected findings) for validation.  We outline an **end-to-end test plan**, sample CI pipeline commands, and a security checklist (e.g. `--cap-drop all`, `--network none`, `no-new-privileges`).  Deployment advice covers Vercel and Render’s free-plan limits (Vercel: 1M function invocations, 4 CPU-hours/month, 45-minute build cap, non‑commercial only; Render: 750 free instance-hours/month). Finally, we confirm both engines’ licenses (OSV-Scanner: Apache 2.0; Gitleaks: MIT) permit use in a public SaaS without commercial restrictions (aside from including license text).

## 1. Implementation Steps & Tasks

1. **Define ScannerEngine interface** (common contract) and project workspace layout (1–2 days).  
   - Specify methods/fields: `Name()`, `BuildCommand()`, `ArtifactPath()`, etc.  
   - Decide folder layout: each scan ID has a workspace (cloned repo) and an output directory for each engine.  
2. **OSV-Scanner adapter (Engine OSV)** – Dev A (2–3 days):  
   - Use official Docker image (`ghcr.io/google/osv-scanner:latest`).  
   - Implement `OSVScannerEngine` with `build_command = ["osv-scanner","scan","--format=json","/workspace"]`. Mount workspace to `/workspace`.  
   - Configure resource limits (CPU, memory) and add `--timeout` if supported.  
   - Parse/collect output file (`results.json`).  
   - Write unit tests with a small Go/Node repo containing known vulnerabilities.  
3. **Gitleaks adapter (Engine Gitleaks)** – Dev B (2–3 days):  
   - Use official Docker image (`ghcr.io/gitleaks/gitleaks:latest`).  
   - Implement `GitleaksEngine` with `build_command = ["gitleaks","detect","--source","/workspace","--report-format","json","--report-path","/output/report.json"]`.  
   - Limit container capabilities, disable network, set timeouts.  
   - Capture JSON output to `report.json`.  
   - Write unit tests against a repo containing dummy secrets.  
4. **Error/Timeout handling** (0.5 day each):  
   - In each engine runner, catch non-zero exit codes and timeouts. Record errors for each scan.  
   - Return partial results if possible.  
5. **Normalize & Integrate Findings** (Integration phase, 3–4 days):  
   - Implement a `Normalizer` module that reads raw JSON (OSV and Gitleaks) and maps them into the **NormalizedFinding** schema (fields below).  
   - Build mapping tables (see next section).  
   - Ensure idempotent merging: multiple vulnerabilities in one package or secret at multiple lines handled correctly.  
6. **End-to-End Testing** (2 days):  
   - Create mock repositories (see “Mock Repos” below) and run full pipeline.  
   - Verify all expected findings appear in normalized output; no false positives.  
   - Include regression cases (no findings).  
7. **CI/CD Pipeline Setup** (1–2 days):  
   - Set up automated tests: run unit tests, linting, engine Docker commands on sample repos.  
   - Commands example:  
     ```bash
     git clone ... && cd arve
     ./gradlew test        # or equivalent
     docker build osv-engine/ .   # if building own image
     docker build gitleaks-engine/ . 
     # Sample scan test:
     arve scan --engine osv --repo path/to/mock1 --out result.json
     arve scan --engine gitleaks --repo path/to/mock2 --out result2.json
     diff expected1.json result.json
     diff expected2.json result2.json
     ```  
8. **Documentation & DevOps** (0.5–1 day):  
   - Document new modules, schema, and how to deploy.  
   - Ensure license compliance (include text in project as needed).  

*(Total effort: ~8–12 days for two devs in parallel, ~3–5 days integration.)*

## 2. Field Mapping (Raw Output → Normalized Schema)

### OSV-Scanner (JSON output) ⇒ NormalizedFinding
OSV-Scanner’s `--format json` output (see example) has a structure of `results[] → packages[] → vulnerabilities/groups`. Key mappings:

| Raw JSON Field                               | Meaning                                            | NormalizedFinding Field | Notes/Example                                            |
|----------------------------------------------|----------------------------------------------------|-------------------------|----------------------------------------------------------|
| `results[].source.path`                      | Path of scanned lockfile or sbom                   | `file_path`             | e.g. `"path/to/go.mod"`                   |
| `results[].source.type`                      | Source type (“lockfile”, “sbom”, etc.)             | `file_type`             | e.g. `"lockfile"`                         |
| `results[].packages[].package.name`          | Package name                                       | `package_name`          | e.g. `"github.com/gogo/protobuf"`         |
| `results[].packages[].package.version`       | Package version                                    | `package_version`       | e.g. `"1.3.1"`                            |
| `results[].packages[].package.ecosystem`     | Ecosystem (package manager)                        | `ecosystem`             | e.g. `"Go"`                                |
| `results[].packages[].vulnerabilities[].id`  | Vulnerability ID (OSV/GHSA/CVE)                    | `vulnerability_id`      | e.g. `"GHSA-c3h9-896r-86jm"`              |
| `results[].packages[].vulnerabilities[].aliases` | Alternate IDs (CVE, RUSTSEC)                     | `aliases`               | e.g. `["CVE-2021-3121"]`                 |
| `results[].packages[].vulnerabilities[].source` or `id`* | Primary ID or name                           | `id` (normalized)       | Typically use first ID or alias as unique ID.            |
| `results[].packages[].groups[].ids`          | Group of related IDs (alias grouping)              | *Used to group**        | If multiple IDs alias each other.                        |
| (not in snippet) Vulnerability details        | Title/description, severity, etc.                 | `description`, `severity` | OSV-Scanner’s JSON includes summary/details (implied by full OSV data). We map ID/alias to CVE/GHSA in fields. |

*Note: The JSON sample truncates “full OSV”. The `vulnerabilities` entries contain advisory details (title/description, CVSS vector in `ratings`, etc.). In normalization, we would set `title` = (e.g.) CVE text from advisory and parse `ratings` for severity. `cve` and `ghsa` fields can be filled from IDs/aliases (e.g. if an ID starts with “GHSA” or “CVE”).* 

### Gitleaks (JSON output) ⇒ NormalizedFinding
Gitleaks’ `--report-format=json` produces an array of findings. Based on documentation and examples, key fields include:

| Raw JSON Field          | Meaning                                  | NormalizedFinding Field | Notes/Example                        |
|-------------------------|------------------------------------------|-------------------------|--------------------------------------|
| `results[].ruleId`      | ID of the detection rule                 | `rule_id`               | e.g. `"aws-access-key-id"`|
| `results[].description` | Rule description/name                    | `title`/`description`   | e.g. `"AWS Access Key"`               |
| `results[].file` or `path` | File path containing secret           | `file_path`             | e.g. `"config/settings.py"`          |
| `results[].start_line`  | Starting line of match                   | `line_start`            | e.g. `42`            |
| `results[].end_line`    | Ending line of match (same as start if single-line) | `line_end`             | e.g. `42`                           |
| `results[].match` or `secret` | Matched secret string (redacted)**  | (omit or hash)**      | For security, we do not store raw secret; may store a SHA256 hash or omit. |
| `results[].entropy`     | Entropy score (unused)                  | *ignored*              |                                      
| `results[].commit`      | Git commit SHA where found              | `commit`                | e.g. `"a1b2c3d4e5f6"`               |
| `results[].author`      | Commit author                            | `commit_author`         | e.g. `"John Doe"`                   |
| `results[].email`       | Commit author email                      | `commit_email`          | e.g. `john@example.com`             |
| `results[].date`        | Commit timestamp                         | `commit_date`           | e.g. `"2024-01-15T10:30:00Z"`|
| `results[].Fingerprint` | Unique fingerprint of finding           | `fingerprint`           | Used as normalized `id`.            |

**We must avoid storing secrets in the normalized DB.** The `match` field can be redacted or replaced by a fingerprint (as Gitleaks does). We include `rule_id` and context instead. The normalized `description` can note the secret type (e.g. “AWS access key in code”). 

*(All raw field names are illustrative; actual JSON keys may vary by Gitleaks version. We recommend running a quick scan to confirm exact keys.)*

## 3. Normalized Finding Schema

All engine findings are transformed into a common schema (**NormalizedFinding**). Below is the **table schema** (field, type, required, example):

| Field             | Type            | Required? | Description                                 | Example                             |
|-------------------|-----------------|-----------|---------------------------------------------|-------------------------------------|
| `id`              | string          | Yes       | Unique identifier for this finding. Usually a fingerprint or primary ID. | `"GHSA-c3h9-896r-86jm"`           |
| `engine`          | string          | Yes       | Scanner that produced this finding (`"osv-scanner"` or `"gitleaks"`). | `"osv-scanner"`                    |
| `type`            | string enum     | Yes       | Finding category (`"dependency"` for OSV, `"secret"` for Gitleaks). | `"dependency"` or `"secret"`       |
| `package_name`    | string          | if dependency | Name of affected package (OSV only).        | `"lodash"`                          |
| `package_version` | string          | if dependency | Version of affected package (OSV only).     | `"4.17.20"`                         |
| `ecosystem`       | string          | if dependency | Package ecosystem (OSV only).               | `"npm"`                            |
| `cve`             | string          | No        | CVE ID if available.                        | `"CVE-2020-8203"` (if alias)       |
| `ghsa`            | string          | No        | GitHub Advisory ID if available.            | `"GHSA-xxxx-xxxx"`                 |
| `rule_id`         | string          | if secret   | Gitleaks rule ID (e.g. `"aws-access-key-id"`). | `"aws-access-key-id"`           |
| `title`           | string          | No        | Short title or rule name.                   | `"AWS Access Key"`                |
| `description`     | string          | No        | Human-readable description of finding.      | `"Hardcoded AWS secret key"`      |
| `severity`        | string (or enum)| No        | Severity score (e.g. OSV CVSS or risk level).| `"HIGH"` (if CVSS >7)            |
| `file_path`       | string          | Yes for secrets, optional for dependency | File or artifact where issue is found. | `"src/config.js"`                |
| `line_start`      | integer         | No (for secrets) | Line number in file (Gitleaks only).        | `42`                              |
| `line_end`        | integer         | No (for secrets) | End line number (same as start if one line). | `42`                              |
| `commit`          | string          | No (for secrets) | Git commit SHA (Gitleaks only).             | `"a1b2c3d4e5"`                    |
| `commit_author`   | string          | No (for secrets) | Commit author (Gitleaks).                   | `"John Doe"`                      |
| `commit_email`    | string          | No (for secrets) | Commit email (Gitleaks).                   | `"john@example.com"`             |
| `commit_date`     | timestamp       | No (for secrets) | Commit date/time.                         | `"2024-01-15T10:30:00Z"`         |
| `url`             | string          | No        | Reference link (OSV advisory or VCS file URL). | `"https://osv.dev/CVE-2020-8203"` |
| `fingerprint`     | string          | Yes       | Unique fingerprint of this finding.         | `"fab12e...ef"`                   |
| `raw_output`      | JSON blob or string | Yes   | Raw engine output (or path to it) for audit. | JSON object (full JSON record)    |

*Optional fields* are omitted if not applicable. For example, `package_name`, `cve`, `ghsa` apply only to OSV findings, while `file_path`, `line_start`, and commit fields apply only to Gitleaks findings.  

## 4. Mock Repository Scenarios

To validate the integration **end-to-end**, we design *realistic* mock repos (multiple languages/packages):

- **Repo A (Node.js app)**:  
  - `package.json` with dependency `"lodash": "4.17.20"` (has CVE-2020-8203).  
  - `index.js` contains `module.exports = require('lodash');`.  
  - `config.js` contains a dummy secret: `const AWS_KEY = "AKIAEXAMPLEKEY123";`.  
  - **Expected findings**:  
    - OSV: Vulnerability for lodash 4.17.20 (e.g. CVE-2020-8203, GHSA from GitHub advisory).  
    - Gitleaks: Secret in `config.js`, flagged by the AWS access key rule.  
- **Repo B (Python/Ruby multi-lockfile)**:  
  - `requirements.txt` listing `"requests==2.25.0"` (has a known vulnerability CVE-2020-XXXX).  
  - `Gemfile` listing `gem "rails", "5.2.3"` (has known Rails CVEs).  
  - Contains a `.env.example` with a Slack webhook URL: `https://hooks.slack.com/services/T123/BUCKE/secret`.  
  - **Expected findings**:  
    - OSV: Vulnerabilities in requests and rails gems (mapped to advisory IDs).  
    - Gitleaks: Slack webhook detected in `.env.example`.  
- **Repo C (Monorepo: Node + Go)**:  
  - `frontend/package-lock.json` with vulnerable `minimist` version.  
  - `backend/go.mod` with vulnerable `github.com/fatih/color v1.7.0`.  
  - No secrets.  
  - **Expected findings**: Two OSV findings (one in JS, one in Go), none from Gitleaks.  
- **Repo D (Edge case - No vulnerabilities)**:  
  - Simple project with up-to-date deps and no credentials.  
  - **Expected**: Zero findings; sanity check for no false positives.

Each mock repo should include exact file contents and be committed in Git (for Gitleaks commit history tests). We run the scanners on these and assert that every expected finding appears in the normalized output, with correct fields (and that no unexpected findings appear).

## 5. End-to-End Test Plan and Acceptance Criteria

- **Unit Tests**: For each engine adapter, write unit tests mocking container output: e.g. feed a small JSON and verify the adapter parses fields correctly.  
- **Integration Tests**: For each mock repo above, run the full ARVE pipeline and verify normalized JSON:  
  - *OSV findings*: Check that `vulnerability_id`, `package_name`, etc. match expectations (e.g. CVE-2020-8203 for lodash).  
  - *Gitleaks findings*: Check `rule_id`, `file_path`, `line_start`, `description`. Ensure secrets content is *not* present, only safe fields and fingerprints.  
- **Performance/Timeout**: Use a large repo sample (e.g. Linux kernel dependencies) to test that each engine respects configured timeouts and does not hang. If an engine times out, pipeline should log an error and proceed.  
- **Security**: Attempt to include a malicious file (e.g. a script that tries to exfiltrate data) in a mock repo; confirm that the sandboxed scanning container cannot reach the network or host.  

**Acceptance:** All expected vulnerabilities/secrets are found and normalized; no missed cases. CI should fail if any deviation. Unit test coverage of mapper logic must be high (90%+). Container resource limits must prevent CPU/memory exhaustion.

## 6. CI Pipeline Steps (Sample)

We recommend a CI workflow (e.g. GitHub Actions) with steps:

1. **Checkout & Setup**:  
   ```bash
   actions/checkout@v3
   # Set up environment (e.g., install Go if building Go code)
   ```
2. **Lint/Static Analysis**:  
   ```bash
   go fmt ./... && go vet ./...
   # (or other language-specific lint commands)
   ```
3. **Unit Tests**:  
   ```bash
   go test ./...           # test engine code and normalizer
   ```
4. **Build (if needed)**:  
   ```bash
   # Optionally build Docker images for custom code
   docker build -t arve/osv-engine:latest ./osv_engine
   docker build -t arve/gitleaks-engine:latest ./gitleaks_engine
   ```
5. **Mock Repo Scans**:  
   For each mock repo (in test fixtures), run scans:  
   ```bash
   arve-scan --engine osv --repo ./test/mock-repo-A --out result-osv-A.json
   arve-scan --engine gitleaks --repo ./test/mock-repo-A --out result-git-A.json
   diff expected/osv-A-normalized.json result-osv-A.json
   diff expected/gitleaks-A-normalized.json result-git-A.json
   ```
6. **Artifact Publishing**: (optional)  
   Save test results or raw scan outputs as CI artifacts for inspection.

*(Commands above are illustrative; adapt to actual CLI names. Use of `diff` assumes known expected files.)*

## 7. Security Checklist (Untrusted Code)

When running scans on arbitrary repositories (untrusted code), enforce strong container sandboxing:  
- **Non-root user**: Don’t run as root. Use a dedicated low-privilege UID/GID inside the container.  
- **Drop capabilities**: Use `--cap-drop ALL` and only add minimal required (e.g. `CHOWN`, `SETUID`, `SETGID`).  
- **No new privileges**: Use `--security-opt no-new-privileges` so the container cannot gain extra privileges.  
- **No Docker socket**: Never mount `/var/run/docker.sock` into the container (prevents container escape to host).  
- **Network isolation**: Use `--network none` (or Docker’s equivalent) so the container cannot access the internet or internal networks.  
- **Resource limits**: Enforce memory and CPU limits (e.g. `--memory=1g`, `--cpus=1`) to avoid denial-of-service attacks.  
- **Read-only FS**: Mount the workspace read-only if the engine only needs to read code (and use a separate tmpfs for output).  
- **Ephemeral tmp dirs**: Use `--tmpfs` mounts for `/tmp`, `/var/tmp`, `/run` so all temp writes are wiped on exit.  
- **Timeouts**: Impose a hard timeout per scan process (e.g. 5 minutes) to avoid endless loops or crypto mining.  
- **Keep engine updated**: Regularly update Docker images to patch CVEs (e.g. OS vulnerabilities, container escape bugs).  
- **Logging & Monitoring**: Capture container stderr/stdout for auditing. Monitor scans for anomalies (e.g. excessive CPU).  

These practices (following OWASP Docker security guidelines and best-practice sandbox commands) ensure that even if the code being scanned is malicious, it cannot harm the host or exfiltrate data. 

## 8. Deployment Architecture & Hosting Limits

A suggested deployment splits frontend and backend for scalability:

```mermaid
flowchart LR
  User -->|clicks "Scan"| WebUI[Vercel Frontend (React/Next.js)]
  WebUI --> API[Backend API (e.g. Render service)]
  API --> DB[(Database)]
  API -->|enqueues| Queue[(Task Queue)]
  Queue --> WorkerOSV[OSV-Scanner Worker]
  Queue --> WorkerGL[Gitleaks Worker]
  WorkerOSV --> DB
  WorkerGL  --> DB
  API -->|serves| Backend[Backend API]
  WebUI -->|fetch results| Backend
  API -->|reads/writes| DB
  subgraph Vercel
    WebUI
  end
  subgraph Render/AWS/etc
    API
    Queue
    WorkerOSV
    WorkerGL
    DB
  end
```

- **Frontend (Vercel)**: Host the user interface on Vercel (Hobby or Pro). The UI allows users to connect GitHub repos and view scans. 
- **Backend (Render or similar)**: The API and workers run on Render (or AWS/GCP). A web service (Node/Go) receives webhooks or API calls, enqueues jobs, and serves results from DB.
- **Workers**: Containerized workers (or serverless functions) pick tasks, run Docker scans (OSV/Gitleaks), normalize results, and store in DB.
- **Database**: Use a managed DB (Postgres) to store findings. 
- **Queue**: Use a lightweight queue (Redis, RabbitMQ, or even a DB table with polling) to coordinate tasks.

### Hosting Limits & Costs:
- **Vercel (Hobby Free)**: 100,000 edge invocations and 4 CPU-hours of function execution per month. Build limits: 100 deployments/day, 1 concurrent, 45 min max per build. **Crucial**: Hobby is *non-commercial only*. Any revenue-generating usage requires Pro ($20+/month/seat). 
- **Render (Free)**: 750 free instance-hours/month (enough for one service ~24/7). Static sites are also free. Free services spin down after idle, have no persistent disk, and limited outbound bandwidth (tracked but billable if exceeded). Render’s free tier can run backend + queue/workers, but background jobs (cron) are *not supported on free tier*. Also, free services auto-sleep after 15m idle. 
- **Alternatives**: For greater control/cost efficiency, consider self-hosting on a VPS (e.g. using an open-source PaaS like [Temps](https://temps.sh), which mimics Vercel workflow without per-seat fees) or other cloud (AWS Fargate, Google Cloud Run, Railway). Each has its own free tiers.

Cost/limit summary (approx): Vercel Hobby (free, no $ cost but not for commercial use), Vercel Pro (from $20/mo plus usage), Render Free (effectively free up to 750h, then suspend).  Plan capacity accordingly if ARVE becomes production.

## 9. Licensing & Commercial Use

- **OSV-Scanner**: Licensed Apache 2.0 (Google). This is a permissive open-source license allowing free use, modification, and distribution (even commercially) as long as license text is included. *Conclusion:* Can be used in a SaaS with no additional fees.  
- **Gitleaks**: Licensed MIT (Zachary Rice). Also fully permissive (free to use/modify/sell). *Conclusion:* Can be used in a public SaaS for any user. 

In both cases, there are *no “hidden” usage limits or proprietary components*. We only rely on official releases (the Docker images mentioned above).  (Note: The Gitleaks “Action” had a proprietary license clause, but we are using the CLI directly, so that does not apply.)  We must include the respective licenses in ARVE’s documentation to comply.

*Sources:* Official repos/docs for licenses and product pages (OSV-Scanner by Google, Gitleaks by Zach Rice).

---

*This report synthesizes official documentation (Google’s OSV-Scanner docs, Gitleaks docs, etc.) and best practices into a concrete plan for Phase 4A. All cited references are authoritative.*