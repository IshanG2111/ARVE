# ARVE AST Analysis Engine — Technical Handoff

> **Purpose:** Developer-to-developer handoff for the AST subsystem. This document describes the implementation on `satyaaman`, how its parts fit together, operational behavior, current boundaries, and the recommended next work.
>
> **Repository:** [IshanG2111/ARVE](https://github.com/IshanG2111/ARVE)  
> **Branch:** `satyaaman`  
> **AST implementation commits:**  
> - `5a2e70c8e7e06535aaae1114d09819b290e11669` — improve symbol linking and persist versioned JSON artifacts  
> - `82cc50bba928fd861a3ec3d07639a65aa944a0a5` — expose artifact metadata and classify binary files

---

## 1. Executive summary

ARVE's Abstract Syntax Tree (AST) subsystem analyzes the structure of source code in a repository snapshot. It parses supported source files with Tree-sitter, extracts normalized code entities, assigns deterministic identifiers, builds supported relationships, persists the result in PostgreSQL, and maps existing security findings to relevant code context.

The subsystem also builds a versioned normalized JSON document and, when Backblaze B2 is configured, stores that document and a manifest in the existing private artifact bucket. An authenticated API endpoint exposes the export.

**Scope statement:** AST provides structural code intelligence and context for security analysis. It is not a complete vulnerability detector and does not currently implement full interprocedural taint/dataflow analysis.

## 2. Current implementation status

The developer has confirmed that the AST implementation is running properly in their environment. The following describes the implemented scope:

| Capability | Status |
|---|---|
| Tree-sitter parsing and language detection | Implemented |
| Python, JavaScript, TypeScript, Java, PHP, Go extractors | Implemented |
| Deterministic entity IDs | Implemented |
| Containment and supported call relationships | Implemented |
| Same-file function resolution | Implemented |
| Conservative Python import/module resolution | Existing implementation |
| Static relative JS/TS named-import resolution | Implemented |
| JS/TS anonymous callback contextual naming | Implemented |
| JS/TS member/chained-call metadata | Implemented |
| PostgreSQL AST persistence | Implemented |
| Security-finding context mapping | Implemented |
| Versioned normalized JSON and B2 manifest | Implemented |
| Artifact metadata and checksum verification | Implemented |
| Authenticated AST export endpoint | Implemented |

The earlier code-change session verified branch contents and commits but did not run the complete automated test suite, execute the migration, or perform a live B2 integration test. The developer's subsequent local confirmation is noted; a teammate should still run the verification steps in Section 13 in their own environment.

## 3. Supported languages and parsers

The extractor registry is in `backend/app/ast/services/analysis.py`.

| Language | Extractor |
|---|---|
| Python | `extract_python` |
| JavaScript | `extract_javascript` |
| TypeScript | `extract_typescript` |
| Java | `extract_java` |
| PHP | `extract_php` |
| Go | `extract_go` |

Tree-sitter parses source into syntax trees. Language-specific extractors traverse those trees and emit normalized entities. Installed parser package versions are captured in analysis metadata and the JSON artifact (Tree-sitter plus the language grammar packages).

## 4. Code map

Principal files:

```text
backend/
├── app/
│   ├── api/
│   │   └── ast.py
│   ├── ast/
│   │   ├── engine/
│   │   │   ├── contract.py
│   │   │   ├── schema.py
│   │   │   └── extractors/
│   │   │       ├── python.py
│   │   │       ├── javascript.py
│   │   │       ├── typescript.py
│   │   │       ├── java.py
│   │   │       ├── php.py
│   │   │       └── go.py
│   │   ├── services/
│   │   │   └── analysis.py
│   │   └── schema.py
│   ├── scanner/
│   │   └── artifacts.py
│   └── models/
│       └── models.py
├── alembic/
│   └── versions/
│       └── 20261105_0009_ast_artifact_metadata.py
├── tests/
│   ├── test_ast_engine.py
│   └── test_ast_artifacts.py
└── AST_ARTIFACTS.md
```

| File | Responsibility |
|---|---|
| `ast/services/analysis.py` | Orchestrates analysis, extraction, relational persistence, finding-context mapping, and JSON artifact creation. |
| `ast/engine/contract.py` | Stable IDs, relationship construction, and supported symbol resolution. |
| `ast/engine/extractors/*` | Language-specific Tree-sitter extraction. |
| `ast/engine/schema.py` | AST output contract/schema validation. |
| `ast/schema.py` | Checks database schema readiness. |
| `api/ast.py` | Authenticated AST summary and export endpoints. |
| `scanner/artifacts.py` | Shared B2 artifact storage and retrieval. |
| `models/models.py` | SQLAlchemy AST and security-context models. |
| `20261105_0009_ast_artifact_metadata.py` | Adds durable artifact metadata fields and index. |

## 5. End-to-end processing lifecycle

Main entry point:
*python*
```
ASTAnalysisService.analyze_and_persist(scan, workspace)
```

Processing sequence:

1. Check required AST database schema with `require_ast_schema(self.db)`.
2. Look for an existing AST run for the scan. A `COMPLETED` or `PARTIAL` run is returned; a previous non-terminal run is removed and recreated.
3. Create and flush an `ASTAnalysisRun` with scan/project/commit metadata and parser versions.
4. Discover repository files and enforce resource limits.
5. Detect each file's language. Record unsupported files and reasons.
6. Parse supported files with Tree-sitter and run the corresponding extractor.
7. Record syntax-error information and per-file extraction errors.
8. Normalize extracted entities and build relationships using `normalize_and_link`.
9. Validate the normalized output contract.
10. Persist files, symbols, and relationships to PostgreSQL.
11. Update counts and analysis status.
12. Map existing `SecurityFinding` rows into `SecurityContext` records.
13. Build the complete normalized AST JSON document.
14. Persist `ast-output.json` and `manifest.json` to B2 when configured.
15. Save artifact metadata/status and commit the analysis.

### 5.1 Resource limits

Current constants in `analysis.py`:

| Limit | Value |
|---|---:|
| Maximum discovered files | 5,000 |
| Maximum workspace size | 200 MB |
| Maximum individual source file | 1 MB |
| Binary sample size | 4 KB |

These are safety limits. Review worker memory, parse duration, concurrent scans, database transaction size, and artifact size before changing them.

### 5.2 Unsupported files and parse errors

Unsupported paths are recorded with a reason such as:

- `binary_file`
- `unsupported_extension`
- `unknown_file_type`

The binary check samples the file and tests for a NUL byte (`b"\\x00"`). Files that exceed the individual source-file limit or fail parsing/extraction are recorded in the analysis error collection. Unsupported files are counted separately from failed files.

## 6. Extracted entities

The normalized output includes file-level entities and, where supported by the extractor, the following:

- **Files:** repository-relative path, language, syntax-error indicator, and entity collections.
- **Functions:** name, source location, extracted variables, calls, and enclosing-class information where available.
- **Classes:** class declarations. Methods are represented as function entities and associated with classes using source-range containment.
- **Imports:** import declarations used by supported static resolution.
- **Variables:** extracted declarations/references according to language-specific extractor behavior.
- **Calls:** observed call expressions and call-site metadata.

### 6.1 JavaScript/TypeScript callback names

Anonymous callbacks can receive contextual labels. For example, a callback registered with an Express route may be labelled similar to `GET /users handler`. When context is unavailable, the fallback is `<anonymous>@line:column`.

### 6.2 JavaScript/TypeScript member-call metadata

Member calls preserve additional fields where available:

- `callee_expression`
- `receiver`
- `member`
- `name`

This helps retain the distinction between the receiver and invoked member, including in chained-call syntax.

## 7. Deterministic IDs and relationship graph

The implementation is in `backend/app/ast/engine/contract.py`.

`stable_id(...)` serializes its inputs consistently and hashes them with SHA-256. Entity ID inputs include repository-relative path, entity type, name, location, parent identifier, and a deterministic discriminator where needed. IDs are prefixed by entity type (for example `file:`, `function:`, `class:`, `call:`, `variable:`, and `import:`).

Principal relationships:

| Relationship | Meaning |
|---|---|
| `CONTAINS` | Structural containment between entities. |
| `CALLS` | A call site linked to a function target when resolution rules permit it. |

Relationship records retain evidence such as source mechanism, file path, source location, and resolution status.

**Do not replace conservative linking with name-only matching.** Ambiguous matches should remain unresolved rather than introducing false graph edges.

## 8. Symbol resolution behavior

### 8.1 Same-file calls

The resolver indexes functions by name and resolves eligible same-file calls when it finds a unique matching target under the current rules.

### 8.2 Python

The existing implementation includes conservative Python import/module resolution. It does not claim to resolve every dynamic Python reference.

### 8.3 JavaScript and TypeScript

The implementation supports static relative named-import resolution, including:

- Relative import paths.
- Named imports and aliases.
- Candidate extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs`.
- `index.*` candidates.
- Resolution only when a unique matching function is found.

### 8.4 Deliberately unresolved cases

The resolver does not guess dynamic imports, arbitrary default imports, complex re-export/barrel patterns, or ambiguous targets. Cross-file resolution for Java, PHP, and Go was not added in this implementation. Explicit whitelisted built-ins may be marked external; other unresolved calls remain unresolved.

## 9. Security finding context mapping

The mapping logic is in:
*python*
```
ASTAnalysisService._map_findings(...)
```

It retrieves existing `SecurityFinding` rows for the scan, normalizes each finding's file path, locates the corresponding parsed AST file, and uses the finding's starting line to identify containing functions/classes. It then persists available context in `SecurityContext`.

The normalized artifact can include:

- `finding_id`
- `file_path`
- `function_name`
- `class_name`
- `route`
- `observed_inputs`
- `security_operations`
- `resolution_status`
- `evidence`

The current heuristic observations include request input patterns such as `req.params`, `req.query`, `req.body`, `req.headers` and corresponding `request.*` forms. Operation patterns cover selected database, file, process, and token-verification operations. Route recognition is primarily Express-style.

> **Important:** These are syntactic observations and context, not proof that untrusted input reaches a sensitive operation. Full source-to-sink taint analysis, sanitizer propagation, and interprocedural dataflow analysis are not implemented.

## 10. Database model and migration

The AST subsystem uses the existing SQLAlchemy/PostgreSQL architecture.

| Table | Purpose |
|---|---|
| `ast_analysis_runs` | One AST run per scan; status, counts, parser versions, errors, and artifact metadata. |
| `ast_files` | Parsed file path/language, content hash, syntax status, and entity counts. |
| `ast_symbols` | Normalized function, class, import, variable, and nested call/variable records. |
| `ast_relationships` | Graph edges with source/target stable keys, type, evidence, and resolution status. |
| `security_contexts` | AST-derived context associated with existing security findings. |

Artifact fields on `ASTAnalysisRun`:

| Field | Purpose |
|---|---|
| `artifact_status` | Artifact persistence state. |
| `artifact_bucket` | B2 bucket. |
| `artifact_key` | B2 object key. |
| `artifact_sha256` | Checksum. |
| `artifact_size_bytes` | Stored size. |
| `artifact_created_at` | Artifact creation time. |
| `artifact_error` | Persistence error, if any. |

Migration:

`backend/alembic/versions/20261105_0009_ast_artifact_metadata.py`

- Revision: `20261105_0009`
- Down revision: `20261105_0008`

Run from the backend directory:

```bash
alembic upgrade head
```

## 11. Normalized JSON artifact

The AST service builds a versioned document with this general structure:

```json
{
  "schema_version": "1.0.0",
  "artifact_type": "arve.ast.normalized",
  "artifact_version": "1",
  "scan": {
    "scan_id": "...",
    "project_id": "...",
    "commit_sha": "..."
  },
  "analysis": {
    "analysis_id": "...",
    "status": "COMPLETED",
    "parser_versions": {},
    "started_at": "...",
    "completed_at": "...",
    "files_discovered": 0,
    "files_parsed": 0,
    "files_failed": 0,
    "files_unsupported": 0,
    "totals": {
      "functions": 0,
      "classes": 0,
      "imports": 0,
      "calls": 0,
      "relationships": 0
    },
    "errors": [],
    "unsupported_files": []
  },
  "files": [],
  "relationships": [],
  "security_contexts": []
}
```

This is a shape illustration; actual values and arrays are produced from the scan. The artifact includes parser versions, counts, errors, unsupported paths, parsed file entities, relationships, and security contexts.

## 12. Backblaze B2 artifact storage

AST JSON persistence reuses `ScanArtifactStore` in `backend/app/scanner/artifacts.py`. It does not create a second B2 client or separate credential configuration.

When B2 is configured, the objects are stored under:

```text
{B2_ARTIFACT_PREFIX}/{scan_id}/ast/
    ast-output.json
    manifest.json
```

### 12.1 Storage helpers

- `persist_json_document(scan_id, namespace, filename, payload)`: serializes JSON consistently, calculates SHA-256, builds a scan-scoped object key, uploads with object metadata, and returns status/bucket/key/checksum/size.
- `read_json_document(object_key)`: retrieves the private object, calculates SHA-256, compares it with B2 object metadata when present, and decodes the JSON.

The manifest records artifact type, schema version, scan ID, analysis ID, object key, checksum, size, and parser versions.

### 12.2 Artifact status behavior

| Status | Meaning |
|---|---|
| `PENDING` | Initial database state. |
| `STORED` | Artifact successfully persisted. |
| `DISABLED` | B2 is not configured in development. |
| `FAILED` | Artifact persistence failed. |

If B2 is not configured in development, relational AST indexing continues and artifact status is `DISABLED`. If artifact persistence fails, the AST run is marked `PARTIAL` and the error is recorded; successfully persisted relational analysis and existing findings are not discarded.

The bucket must remain private. Do not expose B2 credentials or unrestricted object URLs to the frontend.

## 13. API and access control

Implementation: `backend/app/api/ast.py`.

The AST summary exposes artifact status, checksum, and size.

Export endpoint:

```http
GET /api/scans/{scan_id}/ast/export
```

The endpoint:

1. Authenticates the requester.
2. Checks scan/project ownership using the existing ownership helper.
3. Reads artifact metadata from the AST analysis record.
4. Validates that the stored object key belongs to the scan's expected AST prefix.
5. Retrieves the object from B2.
6. Verifies the returned checksum against the database metadata.
7. Returns JSON with an ETag and `X-ARVE-AST-Schema-Version` header.

Never bypass the ownership check or make the bucket public to simplify frontend access.

## 14. Status and failure semantics

Analysis status and artifact status are separate.

| Analysis status | Meaning |
|---|---|
| `RUNNING` | Analysis is in progress. |
| `COMPLETED` | No recorded file-level errors. |
| `PARTIAL` | Some files failed or artifact persistence failed. |

A `COMPLETED` run does not mean every repository file was parsed: unsupported files are tracked separately. A B2 failure should not erase successfully persisted AST relational records.

## 15. Configuration

The implementation reuses the existing B2 settings:

```env
B2_ENDPOINT=
B2_REGION=
B2_BUCKET_NAME=
B2_ACCESS_KEY_ID=
B2_SECRET_ACCESS_KEY=
B2_ARTIFACT_PREFIX=
```

Use the project's existing secret-management process. Never commit real credentials. In development, missing B2 configuration is handled as `DISABLED`; deployed environments need valid B2 configuration for durable exports.

## 16. Tests and verification checklist

Relevant tests include:

- `backend/tests/test_ast_engine.py`
- `backend/tests/test_ast_artifacts.py`
- `backend/tests/test_ast_schema.py` (if present in the current checkout)

Coverage added/maintained includes engine behavior, JavaScript chained calls, cross-file named-import alias resolution, JSON artifact round-trip, checksum verification, and per-scan artifact namespacing.

Recommended commands:

```bash
cd backend

alembic current
alembic heads
alembic upgrade head
alembic current

pytest tests/test_ast_engine.py -q
pytest tests/test_ast_schema.py -q
pytest tests/test_ast_artifacts.py -q
pytest -q
```

Confirm the exact test filenames in the checkout before running.

### Real-scan acceptance checklist

- [ ] An `ASTAnalysisRun` is created for the scan.
- [ ] Supported files are parsed.
- [ ] Unsupported files have recorded reasons.
- [ ] AST file, symbol, and relationship rows are persisted.
- [ ] Existing findings receive context where applicable.
- [ ] `ast-output.json` and `manifest.json` upload when B2 is configured.
- [ ] Artifact metadata and checksum are stored in PostgreSQL.
- [ ] Authenticated export returns the expected JSON.
- [ ] A user cannot export another project's artifact.

## 17. Known limitations and future work

These are scope boundaries, not claims that the currently implemented pipeline is broken.

### 17.1 Full taint/dataflow analysis — not implemented

Not currently provided:

- Interprocedural source-to-sink propagation.
- Sanitizer recognition and propagation.
- Dataflow graph construction.
- Control-flow-sensitive vulnerability analysis.
- Validated attack-path proof.

Treat this as a separate analysis layer.

### 17.2 Broader symbol resolution

Dynamic imports, default imports, complex re-export/barrel patterns, and every module-system behavior are not covered. Cross-file resolution for Java, PHP, and Go is future work.

### 17.3 Framework coverage

Route-context recognition is primarily Express-style. FastAPI, Flask, Django, Next.js, and other framework support requires explicit implementation and tests.

### 17.4 Resource and scale review

Before raising limits, evaluate worker memory, parse time, repository size, concurrent scans, transaction duration, and artifact size.

## 18. Rules for future AST changes

1. Preserve the normalized AST contract. Update the schema version for incompatible changes.
2. Keep entity identifiers deterministic.
3. Keep symbol resolution conservative; do not create ambiguous links.
4. Preserve source evidence for relationships and security contexts.
5. Reuse `ScanArtifactStore`; do not duplicate B2 infrastructure.
6. Keep the bucket private and enforce scan ownership on exports.
7. Keep analysis status and artifact status separate.
8. Preserve partial-analysis behavior and unsupported-file reporting.
9. Add extractor fixtures/tests for new syntax behavior.
10. Test positive, ambiguous, and unresolved resolver cases.
11. Do not describe syntactic observations as proven dataflow.

## 19. Git history and reference links

Repository: https://github.com/IshanG2111/ARVE  
Branch: https://github.com/IshanG2111/ARVE/tree/satyaaman

- [5a2e70c — AST symbol linking and versioned artifacts](https://github.com/IshanG2111/ARVE/commit/5a2e70c8e7e06535aaae1114d09819b290e11669)
- [82cc50b — artifact metadata API and binary classification fix](https://github.com/IshanG2111/ARVE/commit/82cc50bba928fd861a3ec3d07639a65aa944a0a5)

## 20. Recommended next phase

The next planned work is security-scanner integration. Keep scanner execution and finding normalization aligned with the existing ARVE architecture.

### Phase 4A — OSV-Scanner and Gitleaks

- Integrate OSV-Scanner for dependency vulnerability detection.
- Integrate Gitleaks for exposed-secret detection.
- Reuse the existing scanner execution architecture and `ScanEngineRun`.
- Normalize results into the canonical `SecurityFinding` model.
- Store native scanner reports through the shared artifact infrastructure.
- Handle individual engine failures without falsely marking the overall scan successful.

### Phase 4B — Semgrep and AST integration

- Integrate Semgrep and normalize its results.
- Use AST context to enrich code-level findings.
- Keep scanner evidence distinct from AST-derived context.

### Phase 4C — CodeQL

- Evaluate and integrate CodeQL.
- Normalize CodeQL results.
- Explore richer code-flow/dataflow evidence.
- Connect validated results with AST relationships where appropriate.

---

## Final handoff

**Current milestone:** AST implementation complete for the defined scope and confirmed running by the developer in their environment.

**Next milestone:** Security scanner integration, beginning with OSV-Scanner and Gitleaks.

**Primary in-repository reference:** `backend/AST_ARTIFACTS.md` plus the source files listed in Section 4.

The next developer should first read this handoff, inspect the referenced implementation files on `satyaaman`, run the migration/tests in their environment, and then continue with Phase 4A.