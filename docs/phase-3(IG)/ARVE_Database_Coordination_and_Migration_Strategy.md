# ARVE — Database Coordination & Migration Strategy

## Purpose

Define a single database coordination process while OSV-Scanner and Gitleaks are built in parallel, preventing duplicate tables, conflicting ORM models, and migration conflicts.

> **Core rule:** Engines are developed independently; the database model and migrations are centrally coordinated.

## 1. Target Architecture

```text
Repository
    ↓
Scan
    ├── ScanEngineRun → OSV-Scanner
    └── ScanEngineRun → Gitleaks
              ↓
           Finding
              ↓
          PostgreSQL
```

Do **not** create `osv_findings` and `gitleaks_findings`. Use one canonical `Finding` model/table for all security engines.

## 2. Ownership

Assign one **Database/Schema Owner** for Phase 4A.

### DB Owner

Owns:
- ORM models
- Database schema
- Migrations
- Foreign keys and constraints
- Indexes
- Migration ordering
- Schema documentation
- Migration verification

### OSV Developer

Owns:
- OSV execution
- Parser
- OSV normalization
- Engine tests
- Integration contribution

### Gitleaks Developer

Owns:
- Gitleaks execution
- Parser
- Gitleaks normalization
- Engine tests
- Integration contribution

> Engine developers **request** schema changes. The DB owner **implements** approved schema changes.

## 3. Canonical Models

Before integration, agree on and freeze the shared models:

```text
Scan
ScanEngineRun
Finding
```

First inspect the existing ARVE repository. If an equivalent model already exists, extend/reuse it rather than creating another model.

## 4. Scan

One `Scan` represents one security-analysis execution against a repository snapshot.

Conceptually:

```text
Scan
├── id
├── repository reference
├── commit SHA / snapshot reference
├── status
├── created_at
├── started_at
└── completed_at
```

The exact fields must follow the existing ARVE schema.

## 5. ScanEngineRun

One `ScanEngineRun` represents one engine execution within a scan.

```text
ScanEngineRun
├── id
├── scan_id
├── engine
├── status
├── started_at
├── completed_at
├── duration
├── artifact_reference
├── finding_count
└── error information
```

Example:

```text
Scan #123
├── ScanEngineRun(engine=osv-scanner)
└── ScanEngineRun(engine=gitleaks)
```

## 6. Canonical Finding

`Finding` is the shared persistence model for findings from all engines.

Conceptually:

```text
Finding
├── id
├── scan_id
├── engine
├── finding_type
├── title
├── description
├── severity
├── confidence
├── file
├── line_start
├── line_end
├── rule_id
├── fingerprint
├── package_name
├── package_version
├── vulnerability_id
├── remediation
└── approved metadata/evidence
```

The exact fields must follow the finalized ARVE finding contract.

## 7. Engine-Specific Examples

OSV:

```text
Finding
engine           = osv-scanner
finding_type     = dependency
package_name     = example-package
package_version  = 1.2.3
vulnerability_id = OSV-XXXX
```

Gitleaks:

```text
Finding
engine       = gitleaks
finding_type = secret
file         = .env
line_start   = 4
rule_id      = generic-api-key
fingerprint  = XXXXX
```

Both are stored in the same canonical `Finding` table.

## 8. No Engine-Specific Finding Tables

Do not create:

```text
OSVFinding
GitleaksFinding
SemgrepFinding
CodeQLFinding
```

as separate finding tables.

The intended architecture is:

```text
                 Finding
              /     |                 OSV   Gitleaks  Future Engines
```

This keeps future security engines compatible with the same persistence layer.

## 9. Engine-Specific Data

When engine output does not map directly to the canonical model:

1. Check whether an existing canonical field can represent it.
2. If not, determine whether approved metadata/evidence can represent it.
3. Only introduce a new relational entity when there is a clear architectural requirement.

Do not create a new table merely because one scanner has a unique output field.

## 10. Gitleaks Secret Protection

The database must **never persist the detected secret itself**.

Never store:

```text
Actual secret
API key value
Password
Token
Private key
Credential value
Raw secret match
```

Safe finding data can include:

```text
file
line
rule_id
fingerprint
description
severity
```

Example:

```json
{
  "engine": "gitleaks",
  "finding_type": "secret",
  "file": ".env",
  "line_start": 4,
  "rule_id": "generic-api-key",
  "fingerprint": "..."
}
```

## 11. Schema Change Process

If an engine developer needs a field:

```text
Engine Developer
      ↓
Schema-change request
      ↓
Document:
- required field
- source of data
- why current schema is insufficient
- example value/output
      ↓
DB Owner Review
      ↓
Team Agreement
      ↓
DB Owner updates model
      ↓
DB Owner creates migration
      ↓
Developers pull updated schema
```

No developer should silently add a competing model or table.

## 12. Migration Ownership

Only the DB owner maintains authoritative migrations.

Example:

```text
migration_001_phase3_existing
migration_002_phase4a_scan_engine
migration_003_phase4a_finding
migration_004_phase4a_indexes
```

Use the project's existing migration naming convention.

Do not create competing migration sequences on OSV and Gitleaks branches.

## 13. Git Branch Structure

```text
main
 ├── feature/osv-scanner
 ├── feature/gitleaks
 └── feature/phase4a-db
```

### DB branch

```text
models
migrations
constraints
indexes
schema changes
```

### OSV branch

```text
OSV engine
OSV parser
OSV normalizer
OSV tests
```

### Gitleaks branch

```text
Gitleaks engine
Gitleaks parser
Gitleaks normalizer
Gitleaks tests
```

## 14. Integration Order

```text
1. Existing Phase 3 baseline
          ↓
2. Freeze canonical DB contract
          ↓
3. Create/apply Phase 4A DB migration
          ↓
4. Validate database
          ↓
5. OSV engine
          ↓
6. Gitleaks engine
          ↓
7. Shared normalization
          ↓
8. Persistence integration
          ↓
9. Full integration tests
```

## 15. Preventing ORM Duplication

Before adding any model, search the repository for:

```text
Scan
ScanEngineRun
Finding
SecurityFinding
EngineRun
```

If an equivalent model already exists, reuse or extend it.

Never create:

```python
class Finding(...):
    ...
```

just because the engine developer needs a convenient object.

Use the shared canonical model/DTO defined by the architecture.

## 16. Preventing Duplicate Tables

Before creating a migration, check:

```text
Does an equivalent table already exist?
```

If yes, modify the existing table instead of creating another one.

Migration review:

```text
[ ] Does this migration create a table?
[ ] Is the table genuinely new?
[ ] Does an equivalent table already exist?
[ ] Is this actually a column/index/constraint change?
[ ] Does the migration conflict with another migration?
```

## 17. Migration Testing

Test against a clean database:

```text
Clean DB
   ↓
Run all migrations
   ↓
Start application
   ↓
Run DB tests
   ↓
Run engine integration tests
```

Also test migration against an existing Phase 3 database:

```text
Existing Phase 3 DB
   ↓
Apply Phase 4A migration
   ↓
Verify existing data
   ↓
Start application
   ↓
Run scan
```

Phase 4A must not break Phase 3 functionality.

## 18. Rollback Testing

Where supported by the project's migration system:

```text
Current DB
   ↓
Apply Phase 4A migration
   ↓
Verify schema/data
   ↓
Rollback
   ↓
Verify previous schema
```

Follow the project's established migration policy for reversibility.

## 19. Data Integrity

Use appropriate database constraints.

For example:

```text
ScanEngineRun.scan_id → Scan.id
Finding.scan_id       → Scan.id
```

The database should prevent orphaned records.

Do not rely entirely on application-level validation.

## 20. Canonical Engine Identity

Define engine names once.

Example:

```text
osv-scanner
gitleaks
```

Do not independently use variants such as:

```text
OSV
osv
OSVScanner
osv_scanner
```

unless explicitly defined by the ARVE contract.

The engine registry and database should use the same canonical identifiers.

## 21. Canonical Finding Types

Define finding types once.

Current examples:

```text
dependency
secret
```

Potential future types:

```text
sast
configuration
iac
container
```

Engine developers must use the shared values rather than inventing their own.

## 22. Indexing

Indexes should be based on real ARVE query patterns.

Potential candidates:

```text
Finding(scan_id)
Finding(engine)
Finding(finding_type)
ScanEngineRun(scan_id)
ScanEngineRun(engine)
```

If required for deduplication, consider an appropriate composite identity such as:

```text
scan_id
engine
fingerprint
```

Do not add indexes blindly; finalize them from actual query requirements.

## 23. Deduplication

Deduplication rules belong to the shared normalization/persistence layer.

Do not allow each engine to independently define database uniqueness.

For Gitleaks, use its fingerprint as the primary identity signal where available.

The final finding identity/deduplication contract must be shared by all engines.

## 24. Artifact References

Native scanner artifacts should be associated with `ScanEngineRun`.

```text
ScanEngineRun
├── engine
├── status
├── artifact_reference
└── finding_count
```

Example:

```text
OSV      → osv.json
Gitleaks → gitleaks.json
```

Do not create a separate artifact table for each scanner unless required by the ARVE architecture.

## 25. Database Environments

Use separate:

```text
Development
Testing
CI
Production
```

Never test migrations directly against production.

Recommended flow:

```text
Developer DB
    ↓
Integration Test DB
    ↓
CI DB
    ↓
Production Migration
```

## 26. CI Database Gate

PRs touching:

```text
models
migrations
normalization
persistence
```

must run:

```text
Migration tests
+
Schema validation
+
Database integration tests
+
Engine integration tests
```

A migration must not merge if it cannot be applied cleanly.

## 27. Parallel Development Rules

### OSV Developer

Build:

```text
OSV
 ↓
Parser
 ↓
Canonical Finding object
```

Do not create a new finding table.

### Gitleaks Developer

Build:

```text
Gitleaks
 ↓
Parser
 ↓
Canonical Finding object
```

Do not create a new finding table.

Never persist detected secrets.

### DB Owner

Build:

```text
Canonical DB schema
 ↓
Migration
 ↓
Constraints/indexes
 ↓
Persistence integration
```

## 28. Integration Branch

After OSV and Gitleaks independently pass their engine-level tests:

```text
main
 │
 └── phase4a-integration
       │
       ├── DB schema
       ├── OSV
       ├── Gitleaks
       ├── normalization
       └── integration tests
```

This branch validates the complete Phase 4A system.

## 29. Post-Integration Database Verification

Use a mixed repository containing both dependency vulnerabilities and detectable secrets.

Expected:

```text
Scan
│
├── ScanEngineRun: osv-scanner
├── ScanEngineRun: gitleaks
│
├── Finding: dependency
└── Finding: secret
```

Verify that there are **not**:

```text
OSVFinding table
GitleaksFinding table
Duplicate Scan table
Duplicate ScanEngineRun table
Duplicate Finding table
```

## 30. Final Database Test

For one mixed scan, verify:

```text
Repository
    ↓
1 Scan
    ↓
2 ScanEngineRuns
    ├── OSV
    └── Gitleaks
    ↓
N canonical Findings
    ↓
PostgreSQL
```

Confirm:

- Both engines belong to the same scan.
- Both engine runs have correct status.
- Findings use the canonical model.
- No duplicate tables were created.
- No orphaned records exist.
- Gitleaks secrets are not persisted.
- Native artifacts remain associated with their engine runs.
- Re-running the same scan follows the agreed deduplication behavior.

## 31. Definition of Done

Database coordination is complete when:

```text
[x] Canonical models agreed (NormalizedFinding and SecurityFinding)
[x] Existing Phase 3 models reused where applicable (Scan, Project, ScanEngineRun)
[x] No duplicate conceptual models
[x] No duplicate finding tables
[x] DB owner identified
[x] Migration ownership established
[x] Canonical engine identifiers agreed ('osv', 'gitleaks', 'semgrep')
[x] Canonical finding types agreed ('dependency', 'secret', 'sast', etc.)
[x] Migration successfully applied (20260830_0005_phase4a_security_findings.py)
[x] Existing Phase 3 data remains valid
[ ] OSV uses canonical Finding (Next Phase 4A.1)
[ ] Gitleaks uses canonical Finding (Next Phase 4A.2)
[x] Engine-specific data has an approved representation (raw_json / secret_hash)
[x] Gitleaks secrets are never persisted (finding contract stores signature/redacted metadata)
[x] Foreign keys verified (scan_id CASCADE, project_id CASCADE)
[x] Indexes verified (non-unique composite indexes for finding history)
[x] Deduplication rules agreed (line-independent finding identity)
[x] CI migration tests pass (64 security tests, upgrade/downgrade/upgrade verified)
[ ] Mixed scan writes correctly (Post-integration)
[x] Existing scans still work (Phase 2 & Phase 3 regressions pass)
[ ] Integration branch passes (Phase 4A Integration)
```

## 32. Final Architecture Rule

```text
                 SECURITY ENGINES
                 /                             /                          OSV-Scanner        Gitleaks
                │               │
                ▼               ▼
             Parser          Parser
                │               │
                ▼               ▼
          OSV Adapter      Gitleaks Adapter
                │               │
                └───────┬───────┘
                        ▼
                CANONICAL MODEL
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
        ScanEngineRun           Finding
             │                     │
             └──────────┬──────────┘
                        ▼
                    PostgreSQL
```

> **One database model. One migration owner. One canonical finding contract. Multiple independent security engines.**

This keeps OSV-Scanner and Gitleaks independently developable while keeping the ARVE database consistent and extensible for future security engines.
