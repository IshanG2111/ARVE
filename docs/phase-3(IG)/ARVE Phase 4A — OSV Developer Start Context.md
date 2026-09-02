# ARVE Phase 4A — OSV Developer Start Context

> **Purpose:** Starting context for the developer implementing the OSV security engine in ARVE Phase 4A.
>
> **Ownership:** OSV-Scanner engine + OSV finding mapper.
>
> **Important:** Implement only the OSV portion of Phase 4A. Do not modify the shared security contract, database schema, orchestration architecture, or Gitleaks implementation unless a concrete integration blocker is discovered.

---

# 1. Phase 4A Architecture

ARVE already provides the upstream scanning pipeline:

```text
GitHub Authentication
        ↓
Repository Selection
        ↓
Repository Ingestion
        ↓
Commit-Pinned Repository Snapshot
        ↓
Scan Orchestration
        ↓
Celery / Redis
        ↓
Docker Runner
        ↓
Security Engine
```

Your implementation adds:

```text
DockerRunner
     ↓
OsvEngine
     ↓
OSV-Scanner container
     ↓
Raw OSV result
     ↓
OsvFindingMapper
     ↓
NormalizedFinding
     ↓
Shared FindingNormalizer
     ↓
SecurityFinding
```

The engine must plug into the existing orchestration system. Do **not** create a second scanner runner, queue, orchestration flow, or persistence mechanism.

---

# 2. Your Scope

## You own

- `OsvEngine`
- `OsvFindingMapper`
- OSV Docker execution configuration
- OSV command construction
- OSV output parsing
- OSV-specific field mapping
- OSV engine unit tests
- OSV fixture repositories/test data
- OSV integration tests
- registration of the OSV engine in the existing engine registry, where that responsibility belongs
- validation that OSV output successfully reaches the shared normalizer

## You do NOT own

Do not implement or redesign:

- Gitleaks
- Semgrep
- CodeQL
- risk scoring
- finding correlation
- cross-engine deduplication
- dashboard redesign
- knowledge graph
- AI analysis
- database schema redesign
- a new Docker runner
- a new orchestration system

---

# 3. Critical Shared Contract

The shared security layer is now the canonical contract.

Expected location:

```text
backend/app/security/
```

Important components:

```text
models.py
severity.py
fingerprint.py
normalizer.py
mappers/base.py
```

The important canonical object is:

```text
NormalizedFinding
```

Do not create an OSV-specific replacement for this model.

Conceptually:

```text
OSV raw finding
      ↓
OsvFindingMapper
      ↓
NormalizedFinding
      ↓
FindingNormalizer
      ↓
SecurityFinding ORM model
```

---

# 4. Severity Contract

ARVE uses five canonical severity levels:

```text
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

Ordering:

```text
CRITICAL > HIGH > MEDIUM > LOW > INFO
```

Severity normalization is centralized in:

```text
backend/app/security/severity.py
```

The OSV mapper should provide the best raw severity information available from OSV.

Do not implement a second global severity system.

The pipeline is:

```text
OSV raw severity / CVSS
        ↓
shared severity normalization
        ↓
FindingSeverity
```

ARVE currently supports:

```text
numeric CVSS → CVSS v3.1 qualitative band
textual severity → canonical alias
unknown/unusable → MEDIUM fallback
```

Therefore the mapper must not invent arbitrary severity values.

---

# 5. Finding Identity / Fingerprinting

ARVE uses centralized deterministic fingerprinting.

Important rule:

```text
Fingerprint = finding identity
```

It must remain stable across scans when the underlying finding is the same.

The fingerprint implementation intentionally:

```text
ignores volatile line shifts
does not include scan_id
```

Therefore:

```text
DO NOT
```

create a mapper-specific OSV hash such as:

```text
hash(scan_id + file + line)
```

unless the shared fingerprint contract explicitly requires those fields.

The correct flow is:

```text
OSV mapped finding
        ↓
FindingNormalizer
        ↓
shared fingerprint generation
```

---

# 6. OSV Finding Type

OSV is a dependency/vulnerability engine.

The mapper should therefore classify findings using the canonical `FindingType` enum from the shared security contract.

Do not create:

```text
OsvFindingType
```

or another engine-local taxonomy.

Use the canonical value appropriate for dependency vulnerabilities.

---

# 7. Engine Identity

The engine needs one stable identifier:

```text
osv
```

Use that same identity consistently for:

```text
EngineName
engine registry
database records
artifacts
logs
filtering
reporting
```

Do not alternate between:

```text
OSV
osv-scanner
osv_scanner
osv-engine
```

---

# 8. First Task — Inspect Before Coding

Before writing implementation code, inspect the actual current branch and locate:

```text
ScannerEngine
DockerRunner
ScanEngineRun
ScanEngineRegistry
scan orchestration task
workspace preparation
artifact storage
shared NormalizedFinding
FindingMapper
FindingNormalizer
SecurityFinding
```

Record the exact interfaces.

Especially verify:

```text
ScannerEngine method names
DockerRunner invocation signature
workspace path
output path
timeout handling
artifact handling
engine registration mechanism
```

Do not guess these interfaces.

The implementation should fit the existing Phase 3 abstractions.

---

# 9. Target Module Structure

Follow the repository's actual current structure.

The intended conceptual separation is:

```text
scanner/
└── engines/
    └── osv.py
```

and:

```text
security/
└── mappers/
    └── osv.py
```

If the existing repository uses a different module layout, follow the existing architecture rather than moving unrelated code.

---

# 10. OsvEngine Responsibilities

`OsvEngine` should be responsible for scanner execution concerns only.

Conceptually:

```python
class OsvEngine(ScannerEngine):
    ...
```

It should provide whatever methods the existing `ScannerEngine` requires for:

```text
engine identity
container image
command construction
artifact definition
execution parameters
```

Use the exact method names/signatures already established in ARVE.

The engine should NOT:

```text
write directly to PostgreSQL
generate fingerprints
calculate repository risk
perform cross-engine correlation
```

---

# 11. Docker Execution

OSV must run through the existing Docker sandbox.

Conceptually:

```text
Host workspace
       ↓
/workspace   (read-only)
       ↓
OSV container
       ↓
/output      (writable)
```

The scanner container must not receive:

```text
GitHub credentials
database credentials
B2 credentials
Redis credentials
Infisical credentials
Docker socket
```

Do not bypass `DockerRunner`.

---

# 12. Network Policy

Treat the repository and scanner execution environment as untrusted.

Follow the centralized Docker security policy used by Phase 3.

At minimum, the engine should operate with:

```text
network disabled
read-only source workspace
limited writable output
non-root execution
CPU limit
memory limit
timeout
```

Do not introduce OSV-specific weaker Docker settings.

---

# 13. OSV Output

The developer must first confirm the exact OSV-Scanner version being used.

Then confirm its supported command and JSON output format for that version.

Do not blindly copy a command from documentation written for another version.

The implementation should produce one deterministic scanner artifact, for example:

```text
/output/osv.json
```

The exact filename should follow the repository's artifact conventions.

Native OSV output should remain available as the raw engine artifact.

---

# 14. Raw → Normalized Mapping

The mapper is the boundary between OSV and ARVE.

Conceptually:

```text
Raw OSV result
      ↓
OsvFindingMapper
      ↓
NormalizedFinding
```

The mapper should extract information such as:

```text
OSV vulnerability ID
package/ecosystem
affected dependency
installed version
affected version/range
summary
details
references
severity/CVSS information
package location
```

Map these into the canonical ARVE finding fields.

Do not expose OSV's native schema to the rest of the application.

---

# 15. Recommended Canonical Mapping

The exact field names must follow the current `NormalizedFinding` model.

Conceptual mapping:

```text
OSV vulnerability ID
        → external_id / engine finding identifier

OSV summary
        → title

OSV details
        → description

OSV severity/CVSS
        → severity input

dependency/package
        → affected component information

manifest/lockfile path
        → file_path

dependency location
        → line information when OSV provides reliable line data

OSV metadata
        → engine-specific metadata
```

Do not force a line number when the OSV result does not provide one.

Never invent:

```text
line_start = 1
```

just to satisfy the database.

Use the canonical model's nullable/optional location semantics if available.

---

# 16. Severity Handling

OSV may expose severity through CVSS or other metadata.

Preferred path:

```text
OSV CVSS
   ↓
shared severity.py
   ↓
FindingSeverity
```

Do not manually translate every possible OSV severity into a new enum.

Examples:

```text
CVSS 9.x
    → CRITICAL

CVSS 7.x
    → HIGH

CVSS 4.x
    → MEDIUM

CVSS 0.1–3.9
    → LOW
```

Use the already implemented ARVE normalization logic.

The mapper may extract a numeric score; the shared layer should own canonical normalization.

---

# 17. Fingerprint Handling

Do not trust an engine-specific fingerprint blindly as ARVE's identity.

If OSV provides an identifier/hash, preserve it as useful engine metadata where appropriate.

ARVE's canonical finding identity must be generated through:

```text
FindingNormalizer
        ↓
shared fingerprint.py
```

This preserves stable identity across scans.

---

# 18. Database Boundary

The engine and mapper should not independently create database rows.

Expected flow:

```text
OsvEngine
    ↓
raw result
    ↓
OsvFindingMapper
    ↓
NormalizedFinding
    ↓
FindingNormalizer
    ↓
SecurityFinding
```

The existing database model is:

```text
SecurityFinding
```

with lifecycle relationships to:

```text
Scan
Project
```

and indexes supporting:

```text
(project_id, fingerprint)
(scan_id, engine)
```

The engine developer should consume this contract, not redesign it.

---

# 19. Registry Integration

OSV must be registered in the existing:

```text
ScanEngineRegistry
```

The registration should use:

```text
osv
```

as the stable engine identifier.

Expected conceptual architecture:

```text
ScanEngineRegistry
       ├── osv
       └── gitleaks
```

Do not introduce a second registry.

Do not hard-code OSV into unrelated orchestration logic if the registry already abstracts engine selection.

---

# 20. Error Handling

Distinguish between:

```text
successful scan with findings
successful scan with zero findings
scanner execution failure
timeout
invalid/malformed scanner output
artifact missing
mapper failure
```

Important distinction:

```text
"0 vulnerabilities"
```

is a successful scan.

It must not be treated as:

```text
scanner failure
```

The engine should surface execution failures through the existing scan lifecycle/error mechanism.

---

# 21. Tests

Build tests in layers.

### Unit tests

Test:

```text
engine identity
command construction
output path
raw OSV parsing
mapping into NormalizedFinding
severity mapping
missing optional fields
malformed input
```

### Fixture tests

Create repositories representing:

```text
vulnerable dependency
multiple vulnerabilities
multiple dependency ecosystems
clean repository
lockfile/manifest variations
missing metadata
```

### Integration test

Verify:

```text
repository fixture
      ↓
DockerRunner
      ↓
OsvEngine
      ↓
raw artifact
      ↓
OsvFindingMapper
      ↓
FindingNormalizer
      ↓
SecurityFinding
```

Do not require the UI to be complete for engine-level validation.

---

# 22. Acceptance Criteria

OSV is complete when:

```text
[ ] OsvEngine implements the existing ScannerEngine contract
[ ] OSV runs inside the existing Docker sandbox
[ ] source workspace is not writable by the scanner
[ ] network policy follows the shared sandbox
[ ] scanner timeout is enforced
[ ] native OSV JSON artifact is produced
[ ] OsvFindingMapper produces canonical NormalizedFinding objects
[ ] canonical severity normalization is used
[ ] canonical fingerprinting is used
[ ] findings reach SecurityFinding persistence
[ ] zero-result scans are handled as successful
[ ] scanner failures are distinguishable from empty results
[ ] sensitive credentials are never passed to the container
[ ] unit tests pass
[ ] fixture tests pass
[ ] integration test passes
[ ] OSV is registered in ScanEngineRegistry
```

---

# 23. Do Not Touch

Unless a genuine blocker is discovered, do not modify:

```text
shared severity.py
shared fingerprint.py
shared models.py
FindingNormalizer
SecurityFinding migration
Scan orchestration lifecycle
DockerRunner architecture
Gitleaks implementation
```

If a shared contract genuinely prevents implementation, document the blocker rather than silently changing the contract.

---

# 24. Handoff to Joint Integration

When OSV is independently complete, the expected state is:

```text
OSV works independently
        +
Gitleaks works independently
        ↓
Joint integration
        ↓
Registry exposes both engines
        ↓
One scan can execute both
        ↓
Both produce NormalizedFinding
        ↓
Both persist to SecurityFinding
```

Cross-engine correlation and downstream risk scoring come later.

Do not prematurely implement them inside the OSV engine.

---

# 25. Developer Definition of Done

The final implementation should feel like a plug-in:

```text
OSV-specific code
        ↓
existing ARVE engine interface
        ↓
existing Docker sandbox
        ↓
shared normalization contract
        ↓
shared database persistence
```

The OSV developer's job is to make the OSV block work correctly without creating another architecture around it.