# ARVE — Phase 4A Gitleaks Implementation Plan

> **Document role:** Complete implementation plan for the **Gitleaks security engine** in ARVE Phase 4A.
>
> **Developer ownership:** Gitleaks Engine + lightweight Gitleaks normalization
>
> **Integration ownership:** Joint with the OSV-Scanner developer after both engines are independently complete.
>
> **Phase 4A strategy:** Build OSV-Scanner and Gitleaks as independent plug-in engines first, validate each independently, then integrate both into one scan and finally complete the shared normalization/integration work.

---

# 0. Scope Contract

This plan covers only the Gitleaks portion of ARVE Phase 4A.

## In scope

- Gitleaks Docker execution
- `GitleaksEngine` implementation
- Integration with the existing `ScannerEngine` / `DockerRunner`
- Gitleaks JSON artifact generation
- Scanner timeout/error handling
- Docker security restrictions
- Lightweight Gitleaks → ARVE normalized-finding mapping
- Unit tests
- Gitleaks fixture repositories
- Engine-level integration tests
- Artifact validation
- Secret-value redaction
- Fingerprint handling
- Documentation
- Handoff to the joint OSV + Gitleaks integration stage

## Explicitly out of scope

Do **not** implement:

- OSV-Scanner
- Semgrep
- CodeQL
- AST/code intelligence
- Finding correlation
- Risk scoring
- Knowledge graph
- Code-lineage
- AI analysis
- Full dashboard work
- Cross-engine correlation

The Phase 4A research identifies Gitleaks as the secret-detection engine and recommends integrating it through the existing orchestration layer rather than creating a separate scanning system. fileciteturn4file0

---

# 1. Phase 4A Context

ARVE already has:

```text
GitHub Authentication
        ↓
Repository Selection
        ↓
Phase 2 Repository Ingestion
        ↓
Commit-Pinned Repository Snapshot
        ↓
Phase 3 Scan Orchestration
        ↓
Celery + Redis
        ↓
Docker Runner
```

Your Gitleaks work adds:

```text
Docker Runner
      ↓
GitleaksEngine
      ↓
Gitleaks Container
      ↓
gitleaks.json
      ↓
Lightweight Normalization
      ↓
ARVE Normalized Finding
```

The existing architecture deliberately separates:

```text
Phase 2 → What code are we scanning?
Phase 3 → How do we safely execute the scan?
Phase 4A → What security evidence does Gitleaks detect?
```

Phase 3 must remain responsible for lifecycle, queueing, Docker isolation, timeout infrastructure, artifact persistence, and cleanup. The Gitleaks engine should be responsible for the scanner-specific command and output contract. fileciteturn0file5

---

# 2. Gitleaks Role in ARVE

Gitleaks is responsible for detecting potential hardcoded secrets in the repository snapshot.

Examples include:

```text
API keys
Access tokens
Cloud credentials
Private keys
Passwords
Authentication secrets
Other credential-like values detected by Gitleaks rules
```

ARVE must treat repository contents as untrusted input.

The scanner should therefore execute inside the existing Docker sandbox.

The important data boundary is:

```text
Untrusted Repository
        ↓
Gitleaks Docker Container
        ↓
Raw JSON Finding
        ↓
Trusted ARVE Worker
        ↓
B2 Artifact + Normalized Finding
```

The scanner must never receive:

```text
B2 credentials
Database credentials
GitHub OAuth credentials
Infisical credentials
```

The existing architecture explicitly requires cloud-storage credentials to remain outside scanner containers. fileciteturn0file9

---

# 3. Target Architecture

```text
                         Scan Request
                              │
                              ▼
                     Scan Orchestrator
                              │
                              ▼
                    ScanEngineRegistry
                              │
                              ▼
                     GitleaksEngine
                              │
                              ▼
                         DockerRunner
                              │
                              ▼
                  ┌─────────────────────┐
                  │ Gitleaks Container  │
                  │                     │
                  │ /workspace: read-only
                  │ /output: writable   │
                  │ network: disabled   │
                  │ non-root            │
                  └──────────┬──────────┘
                             │
                             ▼
                      gitleaks.json
                             │
                             ▼
                     Trusted Worker
                       /        \
                      /          \
                     ▼            ▼
                Backblaze B2   Normalizer
                                  │
                                  ▼
                           NormalizedFinding
```

The Phase 4A architecture is intended to have OSV-Scanner and Gitleaks operate as independent engine blocks feeding the same normalization layer. fileciteturn4file5

---

# 4. Existing Contract to Reuse

Before writing Gitleaks code, inspect the existing Phase 3 implementation.

Do **not** invent a second runner abstraction.

Verify the existing interfaces for:

```text
ScannerEngine
DockerRunner
ScanEngineRun
Scan
artifact storage
engine registry
timeout handling
workspace handling
```

The Gitleaks implementation should fit the existing interface.

Conceptually:

```python
class GitleaksEngine(ScannerEngine):
    def name(self) -> str:
        ...

    def image(self) -> str:
        ...

    def build_command(self, workspace: str, output_path: str) -> list[str]:
        ...

    def artifact_path(self) -> str:
        ...
```

Use the exact method names and return types already established in the ARVE codebase.

Do not modify Phase 3 lifecycle behavior unless the existing interface has a genuine blocker.

---

# 5. Step 1 — Inspect the Existing Repository

Before implementation, inspect:

```text
backend/
├── app/
│   ├── scanner/
│   │   ├── engines/
│   │   ├── ...
│   └── ...
├── tests/
└── ...
```

The Phase 4A planning material proposes:

```text
backend/scanner/engines/gitleaks.py
```

as the Gitleaks engine module. fileciteturn4file0

Also locate:

```text
DockerRunner
ScannerEngine
ScanEngineRegistry
ScanEngineRun
artifact storage service
scan orchestration task
```

### Deliverable

Create a short implementation note for yourself containing:

```text
Existing ScannerEngine interface:
Existing DockerRunner interface:
Existing engine registration:
Workspace path:
Output path:
Artifact upload path:
Timeout configuration:
EngineRun persistence:
```

This prevents unnecessary architectural changes.

---

# 6. Step 2 — Define Gitleaks Engine Identity

The engine should have a stable identity:

```text
engine = gitleaks
```

Suggested implementation:

```python
name() -> "gitleaks"
```

Use one stable name everywhere:

```text
gitleaks
```

Do not alternate between:

```text
Gitleaks
gitleaks-engine
gitleaks_scanner
gitleaks-v8
```

The stable engine identifier will later be used by:

- normalized findings
- artifact paths
- engine status
- database records
- filtering
- reporting
- fingerprints

---

# 7. Step 3 — Select the Gitleaks Container

Use the official Gitleaks Docker image:

```text
ghcr.io/gitleaks/gitleaks:latest
```

The Phase 4A research plan explicitly proposes the official Gitleaks image and direct CLI/container execution rather than a Gitleaks GitHub Action. fileciteturn4file0

### Important version consideration

For reproducibility, the final implementation should preferably pin a tested Gitleaks version rather than relying indefinitely on:

```text
:latest
```

During initial development, `latest` can be used to validate the integration, but once the command/output contract is confirmed, record the tested version in project documentation/configuration.

---

# 8. Step 4 — Define Workspace Mounts

The Gitleaks container should receive two logical mounts:

```text
/workspace
/output
```

Recommended conceptual mapping:

```text
Host temporary scan workspace
        ↓
container /workspace
```

and:

```text
Host temporary output directory
        ↓
container /output
```

The source workspace should be mounted read-only.

The output directory must remain writable so Gitleaks can create:

```text
/output/gitleaks.json
```

Conceptually:

```text
Host
├── workspace/
│   └── repository files
│
└── output/
    └── gitleaks.json
```

Container:

```text
/workspace   → read-only
/output      → writable
```

---

# 9. Step 5 — Gitleaks Command

The Phase 4A plan proposes the following command structure:

```text
gitleaks detect
    --source /workspace
    --report-format json
    --report-path /output/report.json
```

The corresponding engine command can therefore be represented as:

```python
[
    "gitleaks",
    "detect",
    "--source",
    "/workspace",
    "--report-format",
    "json",
    "--report-path",
    "/output/report.json",
]
```

The planning document explicitly specifies this command structure for the Gitleaks adapter. fileciteturn4file0

### Implementation requirement

Validate the exact command against the **pinned/tested Gitleaks version** before finalizing the implementation because CLI flags can change between major versions.

The engine should not hard-code host-specific paths.

Use:

```text
/workspace
/output/report.json
```

inside the container.

---

# 10. Step 6 — Artifact Contract

The native Gitleaks artifact should be:

```text
gitleaks.json
```

or, if the existing Phase 4A implementation uses the planning command literally:

```text
report.json
```

Choose **one canonical ARVE artifact name** and keep it consistent.

Recommended:

```text
gitleaks.json
```

Final artifact layout:

```text
<temporary-output>/
└── gitleaks.json
```

Persistent B2 layout should follow the Phase 3 artifact convention:

```text
scans/
└── <scan-id>/
    └── gitleaks/
        └── gitleaks.json
```

The raw artifact remains native Gitleaks JSON.

Do not convert it to SARIF in this engine.

---

# 11. Step 7 — Understand Gitleaks Output

The Gitleaks JSON report is an array of findings.

Representative fields include:

```json
[
  {
    "Description": "Hardcoded AWS secret",
    "StartLine": 10,
    "EndLine": 10,
    "File": "/workspace/config.py",
    "RuleID": "generic-api-key",
    "Fingerprint": "example-fingerprint",
    "Match": "REDACTED",
    "Line": "API_KEY=REDACTED"
  }
]
```

The exact fields should be confirmed against the version used in ARVE tests.

Relevant fields for ARVE are:

```text
Description
StartLine
EndLine
File
RuleID
Fingerprint
```

Potentially useful fields may also include:

```text
Commit
Author
Email
Date
SymlinkFile
Tags
Secret
Match
Line
```

However, ARVE must not blindly persist sensitive values.

---

# 12. Critical Security Rule — Never Persist the Secret

This is one of the most important Gitleaks-specific requirements.

Do not store:

```text
Secret
Match
raw secret value
full credential
```

in the normalized database record.

The ARVE architecture explicitly says Gitleaks findings should retain safe evidence such as location, rule, and fingerprint/hash, while secret values must be redacted. fileciteturn0file8

### Safe fields

Store:

```text
engine
finding_type
title
description
severity
file_path
line_start
line_end
rule_id
fingerprint
```

Potentially store:

```text
raw metadata
```

only after ensuring the raw object does not expose the actual secret.

### If raw Gitleaks output contains the secret

Before persisting normalized/raw metadata in PostgreSQL:

```text
secret
match
line containing secret
```

must be removed or redacted where required by the storage contract.

The raw scanner artifact in B2 should also be reviewed carefully before deciding whether it can contain original secret values.

The safest ARVE policy is:

```text
Scanner may see secret
        ↓
Temporary scanner output
        ↓
Trusted worker sanitizes sensitive values
        ↓
Persistent storage
        ↓
No plaintext secret
```

---

# 13. Step 8 — Resource Limits

Gitleaks runs against untrusted repository content.

The existing Phase 3 sandbox should enforce:

```text
CPU limit
Memory limit
Timeout
No network
Read-only source
Non-root execution
```

The research material recommends approximately:

```text
1 CPU
1 GB RAM
```

as an initial per-engine baseline for OSV/Gitleaks, with a roughly:

```text
300 second
```

engine timeout. fileciteturn4file4

Use the existing centralized ARVE configuration rather than creating Gitleaks-only hardcoded constants if Phase 3 already provides these controls.

---

# 14. Step 9 — Docker Security Configuration

The Gitleaks container should run with the same security model as the other scanner containers.

Minimum requirements:

```text
--network=none
read-only workspace
writable output only
non-root
CPU limit
memory limit
timeout
```

Where supported by the existing DockerRunner, strengthen isolation with:

```text
--cap-drop=ALL
--security-opt=no-new-privileges:true
```

The Phase 4A research specifically recommends restricted containers and calls out capability dropping, no network, and `no-new-privileges`. fileciteturn4file0

Do not mount:

```text
/var/run/docker.sock
```

into the scanner.

Do not expose host filesystem paths beyond the intended workspace/output mounts.

---

# 15. Step 10 — Network Policy

Gitleaks does not need network access for normal local directory scanning.

Therefore:

```text
network = disabled
```

The container should run with:

```text
--network=none
```

This prevents a compromised scanner process from making outbound requests.

Unlike OSV-Scanner, Gitleaks should not require an external vulnerability database/API for its normal secret scan.

---

# 16. Step 11 — Non-Root Execution

The Gitleaks process should not run with unnecessary root privileges.

Use the existing DockerRunner mechanism for non-root execution if supported.

The objective is:

```text
container process
    ↓
non-root
    ↓
read-only repository
    ↓
limited writable output
```

Do not solve permission problems by giving the container unrestricted root access.

If output-directory permissions create problems, fix the ownership/UID handling in the controlled output mount rather than weakening the sandbox.

---

# 17. Step 12 — Timeout Handling

Use the existing per-engine timeout infrastructure.

Recommended initial configuration:

```text
GITLEAKS_TIMEOUT_SECONDS=300
```

or reuse:

```text
SCANNER_ENGINE_TIMEOUT_SECONDS=300
```

if the architecture already provides a common scanner timeout.

On timeout:

```text
Gitleaks
   ↓
terminated
   ↓
ScanEngineRun = FAILED/TIMED_OUT
   ↓
error recorded
```

The entire scan must not hang indefinitely.

The Phase 3 architecture already provides per-engine and global timeout infrastructure. fileciteturn0file5

---

# 18. Step 13 — Exit-Code Handling

The engine must distinguish between:

```text
scanner execution failure
```

and:

```text
scanner completed and found secrets
```

This distinction is important.

A finding is not itself an engine failure.

The implementation should interpret Gitleaks exit behavior according to the tested version's documented CLI semantics.

The adapter should capture:

```text
exit_code
stdout
stderr
duration
artifact existence
```

and pass the execution result back to the orchestrator.

Do not assume:

```text
non-zero == infrastructure failure
```

without validating Gitleaks' documented exit-code semantics for the chosen version.

The engine-specific result handling should therefore be tested explicitly with:

```text
no findings
findings present
invalid invocation
scanner failure
timeout
```

---

# 19. Step 14 — Artifact Existence Validation

After the Docker process exits:

```text
Does gitleaks.json exist?
```

If yes:

```text
validate JSON
```

If no:

```text
engine execution failure
```

Do not upload an empty/missing artifact as if scanning succeeded.

Validation should verify:

```text
file exists
file readable
valid JSON
expected top-level structure
```

The Phase 4A testing contract explicitly requires scanner artifacts to exist and contain expected entries. fileciteturn4file1

---

# 20. Step 15 — Implement `GitleaksEngine`

Target file:

```text
backend/scanner/engines/gitleaks.py
```

Responsibilities:

```text
GitleaksEngine
├── identify engine
├── provide Docker image
├── construct scanner command
├── define output artifact
└── provide lightweight parsing/normalization
```

It should **not** own:

```text
Celery lifecycle
scan status transitions
B2 credentials
B2 uploads
global scan timeout
project authorization
GitHub access
repository ingestion
```

Those remain outside the engine.

---

# 21. Suggested Engine Structure

Conceptually:

```python
class GitleaksEngine(ScannerEngine):
    ENGINE_NAME = "gitleaks"
    IMAGE = "ghcr.io/gitleaks/gitleaks:<tested-version>"
    ARTIFACT_NAME = "gitleaks.json"

    def name(self) -> str:
        return self.ENGINE_NAME

    def image(self) -> str:
        return self.IMAGE

    def build_command(
        self,
        workspace: str,
        output_path: str,
    ) -> list[str]:
        return [
            "gitleaks",
            "detect",
            "--source",
            "/workspace",
            "--report-format",
            "json",
            "--report-path",
            "/output/gitleaks.json",
        ]
```

The exact interface must follow the current Phase 3 implementation rather than copying this structure blindly.

---

# 22. Step 16 — Add Engine Registration

After implementing the engine, register it with the existing scanner registry.

Conceptually:

```text
ScanEngineRegistry
├── phase3-test
├── osv-scanner
└── gitleaks
```

Gitleaks should be independently enableable.

For example:

```text
Gitleaks enabled
OSV disabled
```

should still allow a Gitleaks-only test scan if the current orchestrator supports engine selection.

Do not make Gitleaks registration dependent on OSV implementation.

This independence is part of the Phase 4A design. fileciteturn4file5

---

# 23. Step 17 — Lightweight Normalization

The team decision is to build each engine independently and add **small engine-specific normalization** before the final joint normalization/integration stage.

The Gitleaks adapter should therefore expose a parser that converts raw Gitleaks records into an ARVE-compatible intermediate representation.

Example:

```text
Raw Gitleaks finding
        ↓
Gitleaks parser
        ↓
NormalizedFinding-like object
```

Do not implement cross-engine logic here.

---

# 24. Gitleaks → ARVE Mapping

The planned mapping is:

| Gitleaks field | ARVE field | Rule |
|---|---|---|
| Engine identity | `engine` | `"gitleaks"` |
| — | `finding_type` | `"secret"` |
| `Description` | `title` | Use description or stable secret-detection title |
| `Description` | `description` | Rule description |
| `File` | `file_path` | Convert to repository-relative path |
| `StartLine` | `line_start` | Preserve when available |
| `EndLine` | `line_end` | Preserve when available |
| `RuleID` | `rule_id` | Preserve exact rule ID |
| `Fingerprint` | `fingerprint` | Prefer Gitleaks fingerprint |
| — | `severity` | Use ARVE's agreed deterministic default |
| — | `confidence` | Leave unset unless a deterministic mapping exists |
| — | `package_name` | `NULL` |
| — | `package_version` | `NULL` |
| — | `cve_osv_id` | `NULL` |
| — | `cwe` | `NULL` unless a later enrichment stage provides it |
| — | `component` | Optional file/component metadata |
| Sensitive fields | raw/evidence | Redact before persistence |

The Phase 4A material specifically maps Gitleaks to:

```text
finding_type = secret
description = finding.Description
rule_id = finding.RuleID
file_path = finding.File
line_start = finding.StartLine
line_end = finding.EndLine
fingerprint = finding.Fingerprint
```

and recommends a deterministic default severity because Gitleaks itself does not provide the ARVE severity model. fileciteturn0file4

---

# 25. Step 18 — Repository-Relative File Paths

Gitleaks may report paths such as:

```text
/workspace/config.py
```

ARVE should store:

```text
config.py
```

not:

```text
/workspace/config.py
```

Similarly:

```text
/workspace/src/auth/config.ts
```

becomes:

```text
src/auth/config.ts
```

The normalization logic must remove the scanner container's synthetic mount prefix.

This is important because later:

```text
finding.file
        ↓
AST
        ↓
function
        ↓
route
```

must operate on the same repository-relative path contract.

---

# 26. Step 19 — Line Handling

Preserve:

```text
StartLine
EndLine
```

when available.

If a field is missing:

```text
line_start = null
line_end = null
```

Do not invent line numbers.

The broader ARVE design explicitly requires evidence-backed locations and graceful handling when scanner data is incomplete. fileciteturn0file7

---

# 27. Step 20 — Severity Policy

Gitleaks does not provide ARVE's final severity model.

Therefore use a deterministic default defined by the shared Phase 4A normalization contract.

The initial research proposal uses:

```text
severity = MEDIUM
```

for Gitleaks findings. fileciteturn0file4

Important:

```text
Gitleaks
   ↓
deterministic default severity
```

not:

```text
LLM
   ↓
severity
```

The AI is not allowed to arbitrarily determine severity in the ARVE architecture.

If the team later decides on a more detailed secret-severity mapping, update the shared normalization contract rather than embedding an undocumented policy inside the engine.

---

# 28. Step 21 — Fingerprint Policy

Prefer the native Gitleaks:

```text
Fingerprint
```

for deduplication.

This provides a stable secret finding identifier within the Gitleaks output model.

Normalized finding:

```text
fingerprint = finding.Fingerprint
```

Do not use the secret value itself as a fingerprint.

Never generate:

```text
sha256(secret)
```

if doing so would unnecessarily retain sensitive material in a recoverable form.

The Phase 4A plan explicitly identifies Gitleaks' built-in fingerprint as the preferred deduplication identifier. fileciteturn0file4

---

# 29. Step 22 — Lightweight Parser API

A clean parser can conceptually expose:

```python
parse_gitleaks_report(report_path) -> list[NormalizedFinding]
```

or:

```python
parse_gitleaks_output(data) -> list[NormalizedFinding]
```

The exact API should match the existing ARVE service architecture.

The parser should:

1. Load JSON.
2. Validate top-level structure.
3. Iterate findings.
4. Extract safe fields.
5. Convert paths to repository-relative paths.
6. Preserve line information.
7. Preserve rule ID.
8. Preserve fingerprint.
9. Apply deterministic severity.
10. Redact sensitive fields.
11. Return normalized records.
12. Reject malformed individual records safely.

---

# 30. Step 23 — Malformed Output Handling

Test malformed cases such as:

```json
null
```

```json
{}
```

```json
{"unexpected": "structure"}
```

```json
[
  {
    "RuleID": null
  }
]
```

The parser should not silently create corrupt findings.

Preferred behavior:

```text
valid record
    ↓
normalize

invalid record
    ↓
log structured warning
    ↓
skip/reject record according to shared normalizer contract
```

A malformed report should not cause an unhandled application exception.

---

# 31. Step 24 — Empty Scan Handling

A repository with no detected secrets is a successful scan.

Expected:

```text
Gitleaks execution
        ↓
success
        ↓
gitleaks.json
        ↓
[]
        ↓
0 normalized findings
```

Do not treat:

```text
0 findings
```

as:

```text
scanner failure
```

This is an essential regression test.

---

# 32. Step 25 — Gitleaks Unit Tests

Create tests for:

```text
engine identity
image selection
command construction
artifact path
JSON parsing
path normalization
line extraction
rule extraction
fingerprint extraction
severity mapping
secret redaction
empty report
malformed report
missing fields
multiple findings
duplicate fingerprints
```

Example test cases:

### Test 1 — Engine metadata

Expected:

```text
name() == "gitleaks"
```

### Test 2 — Command

Expected command contains:

```text
gitleaks
detect
--source
/workspace
--report-format
json
--report-path
/output/gitleaks.json
```

### Test 3 — Finding parsing

Input:

```json
[
  {
    "Description": "Hardcoded API key",
    "StartLine": 10,
    "EndLine": 10,
    "File": "/workspace/config.py",
    "RuleID": "generic-api-key",
    "Fingerprint": "fp-123",
    "Match": "SECRET=REDACTED"
  }
]
```

Expected:

```text
engine = gitleaks
finding_type = secret
file_path = config.py
line_start = 10
line_end = 10
rule_id = generic-api-key
fingerprint = fp-123
```

### Test 4 — Secret redaction

Input contains:

```text
Match = "API_KEY=real-secret"
Secret = "real-secret"
```

Expected persisted representation:

```text
real-secret is absent
```

### Test 5 — Empty report

Expected:

```text
[]
```

### Test 6 — Multiple findings

Expected:

```text
2 raw findings
→ 2 normalized findings
```

### Test 7 — Missing line

Expected:

```text
line_start = null
line_end = null
```

No invented values.

---

# 33. Step 26 — Gitleaks Fixture Repository

Create a dedicated fixture such as:

```text
tests/fixtures/gitleaks/
```

Example:

```text
gitleaks-positive/
├── config.py
├── .env
└── README.md
```

The fixture should contain **dummy/test-only credentials**, never real credentials.

Example conceptual content:

```python
API_KEY = "dummy-test-api-key-value"
```

and:

```text
DB_PASSWORD=dummy-test-password
```

The fixture should be deliberately designed to produce predictable Gitleaks findings.

---

# 34. Gitleaks Positive Fixture

Expected result:

```text
config.py
    ↓
secret finding

.env
    ↓
secret finding
```

Expected normalized properties:

```text
finding_type = secret
file_path != null
line_start > 0
fingerprint != null
rule_id != null
secret value not persisted
```

The Phase 4A testing material explicitly proposes a Python fixture with a fake API key and `.env` password, expecting two Gitleaks findings. fileciteturn4file3

---

# 35. Gitleaks Negative Fixture

Create:

```text
gitleaks-clean/
├── app.py
├── config.example.py
└── README.md
```

The repository should contain no real-looking credential material that accidentally triggers the scanner.

Expected:

```text
Gitleaks succeeds
0 findings
0 normalized findings
```

This prevents false assumptions that every scanner execution should produce findings.

---

# 36. Gitleaks Multiple-Finding Fixture

Create a fixture containing several independent dummy secrets:

```text
src/
├── config.py
├── settings.js
└── .env
```

Expected:

```text
3+ findings
```

This tests:

```text
array parsing
multiple rules
multiple files
multiple fingerprints
```

---

# 37. Step 27 — Docker Smoke Test

Before connecting to the complete ARVE scan pipeline, run Gitleaks manually against the fixture.

Conceptual command:

```bash
docker run --rm \
  --network=none \
  -v "$PWD/tests/fixtures/gitleaks-positive:/workspace:ro" \
  -v "$PWD/tests/output/gitleaks:/output" \
  ghcr.io/gitleaks/gitleaks:<tested-version> \
  detect \
  --source /workspace \
  --report-format json \
  --report-path /output/gitleaks.json
```

Validate:

```text
container starts
workspace readable
output writable
gitleaks.json generated
JSON valid
expected findings present
```

Use the exact command accepted by the Gitleaks version selected for ARVE.

---

# 38. Step 28 — Docker Failure Tests

Test:

```text
invalid image
invalid command
missing workspace
unwritable output
malformed configuration
timeout
```

Expected ARVE behavior:

```text
engine failure
    ↓
ScanEngineRun records error
    ↓
worker continues according to orchestrator policy
```

The scan must not become permanently stuck.

---

# 39. Step 29 — Test Timeout

Create a controlled timeout test using the existing DockerRunner timeout mechanism.

Expected:

```text
Gitleaks starts
      ↓
timeout reached
      ↓
container terminated
      ↓
execution marked failed/timed out
      ↓
error persisted
      ↓
workspace cleaned
```

This validates the Phase 3 contract rather than just Gitleaks itself.

---

# 40. Step 30 — Artifact Upload

After Gitleaks succeeds:

```text
gitleaks.json
      ↓
trusted Celery worker
      ↓
Backblaze B2
```

Expected B2 key:

```text
scans/<scan-id>/gitleaks/gitleaks.json
```

PostgreSQL should retain the artifact reference through the existing `ScanEngineRun` mechanism.

Do not put B2 credentials into the Gitleaks container.

The Phase 3 architecture explicitly defines B2 as persistent artifact storage and keeps cloud credentials only in the trusted worker. fileciteturn0file5

---

# 41. Step 31 — Artifact Integrity

Before upload:

```text
verify file exists
verify JSON
```

Optionally calculate:

```text
SHA-256(gitleaks.json)
```

if the existing artifact-storage contract supports artifact integrity metadata.

Do not alter the native JSON content unnecessarily.

---

# 42. Step 32 — Local Cleanup

After:

```text
scan complete
artifact uploaded
metadata persisted
```

the temporary workspace/output must be deleted.

Expected:

```text
temporary workspace → removed
temporary output    → removed
B2 artifact         → retained
DB metadata         → retained
```

The local filesystem is temporary execution storage, not persistent artifact storage. fileciteturn0file5

---

# 43. Step 33 — End-to-End Gitleaks-Only Test

Run:

```text
Phase 2 completed AnalysisRun
        ↓
Phase 3 Scan
        ↓
GitleaksEngine
        ↓
Docker
        ↓
gitleaks.json
        ↓
B2
        ↓
lightweight normalization
        ↓
Normalized Finding
```

Verify:

```text
Scan exists
analysis_run_id is correct
ScanEngineRun exists
engine = gitleaks
status = successful
artifact_reference exists
B2 artifact exists
normalized finding exists
secret value absent
temporary workspace cleaned
```

---

# 44. Step 34 — Integration With the Existing Orchestrator

After the Gitleaks-only path works:

```text
Scan Orchestrator
        ↓
GitleaksEngine
        ↓
DockerRunner
```

Do not immediately combine OSV.

First prove:

```text
existing Phase 3 orchestrator
+
new Gitleaks engine
```

works independently.

This isolates debugging.

If something fails, you can distinguish:

```text
Phase 3 problem
```

from:

```text
Gitleaks implementation problem
```

---

# 45. Step 35 — Handoff Contract With OSV Developer

Once both developers finish independently, compare:

```text
ScannerEngine interface usage
DockerRunner usage
artifact naming
engine registration
error handling
timeout handling
normalization structure
NormalizedFinding fields
tests
fixtures
```

The two implementations should look like sibling plug-ins:

```text
OSVScannerEngine
GitleaksEngine
```

rather than two different architectures.

---

# 46. Joint Integration Architecture

After both engines are ready:

```text
                       Scan
                        │
                        ▼
                 Scan Orchestrator
                    /        \
                   /          \
                  ▼            ▼
           OSVScannerEngine  GitleaksEngine
                  │            │
                  ▼            ▼
             osv.json     gitleaks.json
                  │            │
                  └──────┬─────┘
                         ▼
                  Finding Normalizer
                         │
                         ▼
                Normalized Findings
                         │
                         ▼
                    PostgreSQL
```

The Phase 4A architecture explicitly uses this independent-engine → common-normalizer model. fileciteturn4file5

---

# 47. Joint Mixed Repository Test

Use a repository containing:

```text
package.json
src/
├── app.js
└── config.js
.env
```

with:

```text
one known vulnerable dependency
+
one dummy secret
```

Expected:

```text
OSV
 ↓
dependency finding

Gitleaks
 ↓
secret finding
```

Then:

```text
OSV finding
+
Gitleaks finding
        ↓
common normalization
        ↓
same scan
```

The two findings must remain distinguishable:

```text
engine = osv-scanner
finding_type = dependency
```

and:

```text
engine = gitleaks
finding_type = secret
```

---

# 48. Joint Regression Tests

Run these cases:

| Case | OSV | Gitleaks | Expected |
|---|---:|---:|---|
| Clean repository | 0 | 0 | Successful scan, no findings |
| Vulnerable dependency only | >0 | 0 | OSV findings only |
| Secret only | 0 | >0 | Gitleaks findings only |
| Mixed repository | >0 | >0 | Both finding types |
| Gitleaks timeout | — | timeout | Partial/failed according to orchestrator policy |
| OSV failure | failure | success | Partial |
| Both fail | failure | failure | Failed |
| Duplicate secret | — | duplicate | Deduplication according to fingerprint policy |

The Phase 3 state model requires partial results to remain distinguishable from fully completed scans. fileciteturn0file5

---

# 49. Finding Schema Target

The shared canonical ARVE finding model is:

```text
Finding
├── id
├── scan_id
├── engine
├── title
├── description
├── severity
├── confidence
├── file
├── line_start
├── line_end
├── function
├── rule_id
├── cwe[]
├── cve_osv_id
├── component
├── evidence
├── remediation
└── fingerprint
```

Gitleaks initially populates only the fields it can actually support.

Do not invent:

```text
function
CWE
OWASP
data flow
source
sink
risk
```

Those are downstream enrichment responsibilities.

The broader ARVE design explicitly separates scanner evidence from later code intelligence, correlation, risk, graph, and AI stages. fileciteturn0file7

---

# 50. Evidence Representation

A Gitleaks finding should provide enough evidence to locate the issue without exposing the secret.

Safe evidence:

```text
engine = gitleaks
rule_id = generic-api-key
file = config.py
line = 10
fingerprint = ...
description = ...
```

Unsafe evidence:

```text
API_KEY=actual-secret-value
```

Therefore the evidence model should reference:

```text
source location
rule
fingerprint
```

rather than the secret itself.

---

# 51. API Impact

Gitleaks should not require a new public API just to execute.

The existing scan API remains:

```http
POST /api/projects/{project_id}/scan
```

and:

```http
GET /api/scans/{scan_id}/status
```

The engine should appear through:

```text
ScanEngineRun
```

and later:

```text
Finding API
```

Avoid creating:

```text
POST /api/gitleaks/scan
```

unless the existing architecture explicitly requires engine-specific endpoints.

The system is designed around one generic scan abstraction, not scanner-specific public APIs.

---

# 52. Configuration

Use centralized configuration for:

```text
Gitleaks enabled/disabled
Gitleaks image/version
Gitleaks timeout
resource limits
artifact naming
```

Example conceptual configuration:

```text
SCANNER_ENABLE_GITLEAKS=true
SCANNER_GITLEAKS_IMAGE=ghcr.io/gitleaks/gitleaks:<tested-version>
SCANNER_ENGINE_TIMEOUT_SECONDS=300
```

Follow the actual ARVE settings naming conventions already established in Phase 3.

Do not create duplicate configuration systems.

---

# 53. Secret Management

Gitleaks itself does not need ARVE secrets.

The container should receive:

```text
repository files
scanner configuration if required
output directory
```

It should **not** receive:

```text
DATABASE_URL
B2_ACCESS_KEY_ID
B2_SECRET_ACCESS_KEY
GITHUB_CLIENT_SECRET
JWT_SECRET
```

The Phase 3/ADR security boundary requires cloud credentials to remain outside untrusted scanner execution. fileciteturn0file9

---

# 54. CI Tests

Add automated tests for:

```text
unit parser tests
engine command tests
redaction tests
fixture tests
Docker smoke test
artifact validation
```

A CI flow can conceptually be:

```yaml
jobs:
  gitleaks:
    runs-on: ubuntu-latest

    steps:
      - checkout

      - run: pytest tests/scanner/gitleaks/

      - run: docker pull ghcr.io/gitleaks/gitleaks:<tested-version>

      - run: >
          docker run --rm
          --network=none
          -v $PWD/tests/fixtures/gitleaks-positive:/workspace:ro
          -v $PWD/tests/output/gitleaks:/output
          ghcr.io/gitleaks/gitleaks:<tested-version>
          detect
          --source /workspace
          --report-format json
          --report-path /output/gitleaks.json

      - run: validate gitleaks.json
```

The exact CI implementation should follow the repository's current tooling.

The Phase 4A research recommends CI smoke tests that execute both engines against controlled sample repositories and verify expected findings. fileciteturn4file3

---

# 55. Step 36 — Documentation

Create/update documentation covering:

```text
Gitleaks purpose
engine location
Docker image/version
command
artifact format
normalization mapping
security restrictions
configuration
fixture repositories
tests
known limitations
```

Document that:

```text
Gitleaks is MIT licensed
```

The Phase 4A research identifies Gitleaks as MIT-licensed and suitable for self-hosted use without per-scan fees. fileciteturn4file6

---

# 56. Step 37 — License Compliance

Maintain appropriate Gitleaks license attribution according to the project's distribution requirements.

Do not add unnecessary third-party commercial dependencies.

The selected integration is:

```text
Gitleaks CLI
+
official Docker image
```

not:

```text
Gitleaks SaaS
```

and not:

```text
Gitleaks GitHub Action
```

The Phase 4A plan explicitly recommends direct CLI/container execution. fileciteturn4file0

---

# 57. Step 38 — Performance Validation

Measure:

```text
container startup time
scan duration
JSON generation time
normalization time
artifact upload time
total engine duration
```

Test at least:

```text
small repository
medium repository
multiple secrets
no secrets
```

The initial research recommendation is to keep engine resources modest and limit worker concurrency. fileciteturn4file4

---

# 58. Step 39 — Security Review Checklist

Before merging, verify:

```text
[ ] Source mount is read-only
[ ] Output mount is the only writable location
[ ] Network is disabled
[ ] Container runs non-root
[ ] Capabilities are minimized
[ ] no-new-privileges is enabled where supported
[ ] Docker socket is not mounted
[ ] CPU limit exists
[ ] Memory limit exists
[ ] Timeout exists
[ ] B2 credentials are absent
[ ] DB credentials are absent
[ ] GitHub credentials are absent
[ ] Secret values are not stored
[ ] Secret values are not logged
[ ] Temporary workspace is cleaned
[ ] Artifact is persisted only through trusted worker
```

---

# 59. Step 40 — Logging Requirements

Logs should include:

```text
scan_id
project_id
engine = gitleaks
started_at
completed_at
duration
exit_code
artifact path/reference
finding count
error state
```

Do not log:

```text
secret value
Match
Secret
API key
password
token
```

Example:

```text
[INFO] scan_id=... engine=gitleaks starting
[INFO] scan_id=... engine=gitleaks completed exit_code=0 findings=2
[INFO] scan_id=... engine=gitleaks artifact uploaded
```

This follows the broader ARVE requirement for structured, evidence-safe scanner logging. fileciteturn4file4

---

# 60. Step 41 — Failure Matrix

| Failure | Expected behavior |
|---|---|
| Docker image unavailable | Engine fails with clear error |
| Container startup failure | Engine failed |
| Invalid command | Engine failed |
| Timeout | Engine timed out/failed |
| Output missing | Engine failed |
| Invalid JSON | Artifact/normalization failure |
| Empty JSON array | Successful scan, zero findings |
| One malformed finding | Skip/reject according to parser contract |
| B2 upload failure | Artifact persistence failure |
| Database failure | Persistence failure |
| Secret detected | Successful engine execution |
| Multiple secrets | Multiple findings |
| Duplicate fingerprint | Dedup according to normalization policy |

---

# 61. Step 42 — Definition of Done: Engine

Gitleaks implementation is complete when:

```text
[ ] GitleaksEngine exists
[ ] Uses existing ScannerEngine abstraction
[ ] Registered in scanner registry
[ ] Uses official Gitleaks container
[ ] Command works against fixture repository
[ ] Source is mounted read-only
[ ] Output is writable
[ ] Network is disabled
[ ] Resource limits apply
[ ] Timeout applies
[ ] JSON artifact is generated
[ ] Artifact is validated
[ ] Raw output is preserved appropriately
[ ] Secret values are never persisted
[ ] Gitleaks findings normalize correctly
[ ] File paths become repository-relative
[ ] Lines are preserved
[ ] Rule IDs are preserved
[ ] Fingerprints are preserved
[ ] Empty result works
[ ] Multiple findings work
[ ] Malformed output is handled
[ ] Unit tests pass
[ ] Docker smoke test passes
[ ] End-to-end Gitleaks-only scan passes
[ ] Temporary workspace is cleaned
[ ] Documentation is updated
```

---

# 62. Definition of Done: Joint Integration

After the OSV developer finishes:

```text
[ ] OSV and Gitleaks run from the same scan
[ ] Each has independent ScanEngineRun metadata
[ ] Each produces its native artifact
[ ] Both artifacts persist to B2
[ ] Both feed the common normalizer
[ ] Dependency findings remain dependency type
[ ] Secret findings remain secret type
[ ] Fingerprints remain stable
[ ] No secret values are stored
[ ] Clean repository produces zero findings
[ ] Mixed repository produces both finding types
[ ] One engine failure produces PARTIAL when appropriate
[ ] Both-engine success produces COMPLETED
[ ] Artifact cleanup works
[ ] Existing Phase 3 behavior remains intact
```

---

# 63. Suggested File Changes

The exact repository structure must be checked before implementation, but the expected changes are approximately:

```text
backend/
└── app/
    └── scanner/
        └── engines/
            └── gitleaks.py

backend/
└── tests/
    └── scanner/
        └── test_gitleaks.py

tests/
└── fixtures/
    └── gitleaks/
        ├── positive/
        ├── clean/
        └── multiple/

tests/
└── output/
    └── gitleaks/

docs/
└── GITLEAKS.md
```

Potential additional changes:

```text
scanner registry
configuration/settings
engine-run integration
normalizer package
CI configuration
```

Do not create files that duplicate existing Phase 3 abstractions.

---

# 64. Suggested Development Sequence

Implement in this exact order:

```text
1. Inspect existing Phase 3 scanner interfaces
        ↓
2. Identify workspace/output contracts
        ↓
3. Implement GitleaksEngine metadata
        ↓
4. Implement Docker command
        ↓
5. Register engine
        ↓
6. Run manual Docker smoke test
        ↓
7. Implement artifact validation
        ↓
8. Implement Gitleaks parser
        ↓
9. Implement secret redaction
        ↓
10. Implement path normalization
        ↓
11. Add unit tests
        ↓
12. Add positive/negative fixtures
        ↓
13. Add timeout/error tests
        ↓
14. Integrate with Phase 3 orchestrator
        ↓
15. Verify B2 artifact persistence
        ↓
16. Verify cleanup
        ↓
17. Run complete Gitleaks-only scan
        ↓
18. Handoff to OSV developer
        ↓
19. Joint OSV + Gitleaks integration
        ↓
20. Joint mixed-repository validation
```

---

# 65. Recommended Commit Breakdown

Keep commits small and logically grouped.

### Commit 1 — Gitleaks engine skeleton

```text
feat(scanner): add gitleaks engine adapter
```

Contains:

```text
GitleaksEngine
engine metadata
command builder
artifact contract
```

### Commit 2 — Gitleaks Docker execution

```text
feat(scanner): execute gitleaks in docker sandbox
```

Contains:

```text
DockerRunner integration
mounts
resource limits
timeout
security restrictions
```

### Commit 3 — Gitleaks normalization

```text
feat(scanner): normalize gitleaks findings
```

Contains:

```text
JSON parser
path normalization
line mapping
rule mapping
fingerprint
severity
redaction
```

### Commit 4 — Gitleaks tests

```text
test(scanner): add gitleaks fixtures and coverage
```

Contains:

```text
unit tests
fixtures
Docker smoke tests
failure tests
```

### Commit 5 — Gitleaks documentation

```text
docs(scanner): document gitleaks integration
```

Contains:

```text
configuration
Docker command
artifact format
security model
normalization mapping
testing
```

The exact commit grouping can be adjusted to match the team's existing Git workflow.

---

# 66. Developer Handoff Package

Before handing Gitleaks to the joint integration stage, provide the OSV developer with:

```text
1. GitleaksEngine implementation
2. Engine registration changes
3. Normalization mapping
4. Sample normalized findings
5. Fixture repository
6. Expected raw JSON
7. Expected normalized JSON
8. Docker command/version
9. Artifact path
10. Timeout/resource configuration
11. Security assumptions
12. Test results
```

Example normalized finding:

```json
{
  "engine": "gitleaks",
  "finding_type": "secret",
  "title": "Hardcoded API key",
  "description": "Potential hardcoded credential detected",
  "severity": "MEDIUM",
  "confidence": null,
  "file": "config.py",
  "line_start": 10,
  "line_end": 10,
  "rule_id": "generic-api-key",
  "fingerprint": "gitleaks-fingerprint-example"
}
```

The actual finding must not contain the secret value.

---

# 67. What Gitleaks Proves Before Joint Integration

A successful Gitleaks implementation proves:

```text
Phase 2 snapshot
        ↓
Phase 3 orchestration
        ↓
Gitleaks Docker sandbox
        ↓
Secret detection
        ↓
Native JSON artifact
        ↓
Trusted artifact persistence
        ↓
Lightweight normalized finding
```

It does **not** prove:

```text
OSV correctness
Semgrep correctness
AST correctness
cross-engine correlation
risk scoring
graph correctness
AI explanation quality
```

Those remain later responsibilities.

---

# 68. Final Gitleaks Pipeline

The complete Gitleaks path should be:

```text
                  PHASE 2
        Commit-Pinned Repository
                    │
                    ▼
            Repository Files
                    │
                    ▼
                  PHASE 3
             Scan Orchestrator
                    │
                    ▼
              GitleaksEngine
                    │
                    ▼
              Docker Sandbox
          ┌────────────────────┐
          │ Gitleaks           │
          │                    │
          │ /workspace: RO     │
          │ /output: RW        │
          │ network: NONE      │
          │ non-root           │
          └─────────┬──────────┘
                    │
                    ▼
             gitleaks.json
                    │
                    ▼
             Trusted Worker
               /        \
              /          \
             ▼            ▼
        Backblaze B2   Gitleaks Parser
                           │
                           ▼
                  Normalized Finding
                           │
                           ▼
                      PostgreSQL
```

---

# 69. Phase 4A End State

After your Gitleaks work and the OSV developer's work are integrated:

```text
                Repository Snapshot
                        │
                        ▼
                 Scan Orchestrator
                    /        \
                   /          \
                  ▼            ▼
                OSV         Gitleaks
                 │              │
                 ▼              ▼
              JSON            JSON
                 │              │
                 └──────┬───────┘
                        ▼
                Common Normalizer
                        │
                        ▼
               ARVE Finding Model
                        │
                        ▼
                   PostgreSQL
                        │
                        ▼
                Future ARVE Layers
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
        AST        Correlation       Risk
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                    Graph / AI
```

The Phase 4A goal is therefore not simply:

> "Make Gitleaks run."

It is:

> **Make Gitleaks a secure, independently testable, reproducible ARVE security-engine plug-in that produces trustworthy raw evidence and a clean normalized contract for the next stages.**

---

# 70. Final Checklist

## Engine

```text
[ ] GitleaksEngine implemented
[ ] Existing ScannerEngine contract reused
[ ] Existing DockerRunner reused
[ ] Stable engine name
[ ] Tested image/version
[ ] Correct command
[ ] Correct workspace mount
[ ] Correct output mount
[ ] Correct artifact path
```

## Security

```text
[ ] Network disabled
[ ] Source read-only
[ ] Output writable only
[ ] Non-root
[ ] Capabilities minimized
[ ] No Docker socket
[ ] CPU limit
[ ] Memory limit
[ ] Timeout
[ ] No application credentials
[ ] No B2 credentials
```

## Output

```text
[ ] JSON generated
[ ] JSON validated
[ ] Artifact persisted
[ ] Artifact reference stored
[ ] Temporary output removed
```

## Normalization

```text
[ ] finding_type = secret
[ ] file path normalized
[ ] lines mapped
[ ] rule ID mapped
[ ] fingerprint mapped
[ ] deterministic severity
[ ] malformed data handled
[ ] secret values redacted
```

## Testing

```text
[ ] Clean repository
[ ] One secret
[ ] Multiple secrets
[ ] Multiple files
[ ] Duplicate fingerprint
[ ] Missing fields
[ ] Malformed JSON
[ ] Docker failure
[ ] Timeout
[ ] Artifact failure
[ ] End-to-end Gitleaks scan
[ ] Mixed OSV + Gitleaks scan
[ ] Partial failure behavior
```

## Handoff

```text
[ ] Code ready
[ ] Tests passing
[ ] Fixtures ready
[ ] Expected JSON documented
[ ] Normalized examples documented
[ ] Docker/version documented
[ ] Security assumptions documented
[ ] Ready for joint integration
```

---

# 71. Source Alignment

This plan is based on the current ARVE Phase 4A planning material and the existing Phase 3 architecture.

The key source-backed decisions are:

- Gitleaks is the Phase 4A secret-detection engine.
- Gitleaks should run through the existing Docker-based scanner architecture.
- The proposed engine module is `backend/scanner/engines/gitleaks.py`.
- The proposed native output is JSON.
- Gitleaks findings map to a common ARVE finding representation.
- Gitleaks fingerprints are used for deduplication.
- Secret values must not be stored.
- Gitleaks and OSV should remain independent engine plug-ins until joint integration.
- Phase 3 remains responsible for orchestration, isolation, lifecycle, artifacts, and cleanup. fileciteturn4file0turn0file5turn0file8

