# ARVE — AST Integration Readiness & Transition Plan

**Status:** Preparation plan — AST is not yet implemented  
**Purpose:** Define the contracts, infrastructure, integration points, safeguards and rollout steps required so that AST can be introduced into ARVE without destabilizing existing scanners, normalized findings, Neo4j graph processing, the AI Security Assistant or Security Audit Reports.

---

## 1. Executive objective

ARVE should be designed so that AST becomes an additional, well-defined source of code intelligence—not a replacement for existing security engines and not a breaking change to the current pipeline.

The transition must preserve these principles:

1. Existing scanners and scan workflows continue to work when AST is disabled, unavailable or fails.
2. AST output is versioned, validated, repository- and commit-scoped, and persisted before downstream consumers use it.
3. AST-derived information enriches canonical findings and graph context; it does not silently create confirmed vulnerabilities unless a separately specified, validated detection rule does so.
4. The AI Assistant and report generator consume AST through stable ARVE contracts, never through parser-specific internal objects.
5. Every AST-derived claim remains traceable to the scanned repository, commit, file and source range.
6. AST rollout is incremental, observable, reversible and covered by integration tests.

**Important terminology:** This plan uses AST to mean *Abstract Syntax Tree*. If ARVE also intends to implement a separate ASR component, it must have its own definition and contract. Do not use AST and ASR interchangeably.

---

## 2. Target architecture and data flow

The target flow should be:

```text
Repository + immutable commit
          |
          v
Repository snapshot / source manifest
          |
          +-------------------------+
          |                         |
          v                         v
 Existing security engines       AST analysis
 (Semgrep, OSV, etc.)            (parser / language adapters)
          |                         |
          v                         v
 Engine result adapters          AST normalization
          |                         |
          v                         v
 Canonical findings             AST validation
          |                         |
          +------------+------------+
                       |
                       v
             Persisted ARVE data
      (findings + AST + source references)
                       |
             +---------+---------+
             |                   |
             v                   v
      Data-flow / patterns    Graph enrichment
             |                   |
             +---------+---------+
                       |
                       v
              Risk / attack paths
                       |
             +---------+---------+
             |                   |
             v                   v
       AI evidence packs     Report snapshot
             |                   |
             v                   v
       AI explanations      Deterministic report
             |                   |
             +---------+---------+
                       |
                       v
                 ARVE UI
```

The exact order of data-flow and graph processing may differ according to the current ARVE pipeline. Preserve the existing orchestrator's dependency model; do not introduce hidden ordering assumptions in individual services.

---

## 3. Work to complete before implementing AST

### 3.1 Freeze and document the current contracts

Before AST work begins, document the current stable contracts for:

- Scan identity, repository identity, branch and immutable commit SHA.
- Engine execution status and result envelope.
- Canonical `NormalizedFinding` schema and canonical enums.
- Finding identity and deduplication rules.
- Source location representation and path normalization.
- Evidence/provenance representation.
- Database ownership, tenant/project scope and scan lifecycle.
- Graph node and relationship types currently used.
- AI evidence-pack and report-snapshot contracts.

Do not allow the AST implementation to invent parallel versions of these concepts.

**Deliverable:** A short contract inventory with owning module, schema version, consumers and compatibility requirements.

### 3.2 Establish source snapshot identity

All engines and AST must analyze the same immutable source revision.

Build or verify a shared source manifest containing:

- Repository/project ID.
- Commit SHA.
- Branch/ref as descriptive metadata only.
- Relative file path.
- File content hash.
- File size and language classification, where known.
- Inclusion/exclusion status and reason.
- Binary/generated/vendor/ignored-file classification.

Use the commit SHA and content hash—not branch name or mutable filesystem path—as the source identity.

**Why:** A line number or AST node is only meaningful when tied to the exact source revision that produced it.

### 3.3 Define path and source-range conventions

Standardize these rules before AST arrives:

- Repository-relative POSIX-style paths in persisted records.
- One-based line and column numbering for user-facing locations, unless an existing ARVE contract already specifies otherwise.
- Explicit end-line and end-column semantics.
- UTF-8 handling and documented behavior for undecodable files.
- Normalized paths that prevent traversal outside the checked-out repository.
- A clear representation for missing or approximate locations.

Do not silently mix byte offsets, character offsets, parser offsets and user-facing columns. Store offset units explicitly if offsets are persisted.

### 3.4 Add an engine capability and status model

AST will not necessarily support every language or file. Engine status must distinguish:

- `not_requested`
- `disabled`
- `queued`
- `running`
- `completed`
- `completed_with_warnings`
- `unsupported_language`
- `partial`
- `failed`
- `cancelled`

Use the actual canonical enum values if ARVE already has an engine-status contract; extend it through a migration rather than creating a competing enum.

A successful scan with partial AST coverage must not be presented as complete AST coverage.

### 3.5 Confirm pipeline failure isolation

AST must be an optional stage with explicit dependencies. Its failure must not erase or invalidate successful results from Semgrep, OSV, Gitleaks or other engines.

Build/verify:

- Per-engine execution state.
- Per-engine timeout and resource limits.
- Error capture and safe diagnostics.
- Retry policy for transient failures only.
- Cancellation propagation.
- Idempotent stage execution.
- Partial-scan completion semantics.

---

## 4. AST output contract to implement

The AST parser must not expose parser-library objects directly to the rest of ARVE. Add a normalized, versioned ARVE AST contract.

### 4.1 Suggested normalized AST envelope

The following is a conceptual contract; align exact names and types with ARVE's existing Pydantic conventions before implementation.

```json
{
  "schema_version": "1.0",
  "analysis_id": "ast-analysis-id",
  "project_id": "project-id",
  "scan_id": "scan-id",
  "commit_sha": "immutable-commit-sha",
  "language": "python",
  "parser": {
    "name": "parser-adapter",
    "version": "x.y",
    "adapter_version": "1.0"
  },
  "status": "completed",
  "files": [],
  "symbols": [],
  "relationships": [],
  "diagnostics": []
}
```

Every AST record must be scoped to a project, scan, commit, language and schema version.

### 4.2 File records

Each analyzed file should record:

- Stable file record ID.
- Repository-relative path.
- Content hash.
- Detected language.
- Parse status.
- Parser diagnostics.
- Whether the file was excluded, unsupported or partially parsed.
- Source snapshot reference.

### 4.3 Symbol records

Normalize relevant syntax constructs into stable symbol records, for example:

- Module/file.
- Class.
- Function/method.
- Import.
- Call site.
- Parameter.
- Assignment or relevant expression.
- Framework route/controller declaration, when supported.

Each symbol should include:

- Stable ID within the analysis snapshot.
- Symbol type and name.
- File ID/path.
- Start/end source range.
- Parent symbol ID, if applicable.
- Qualified name where it can be resolved reliably.
- Relevant attributes only; avoid persisting the entire parser tree by default.

### 4.4 Relationship records

Represent only relationships that ARVE consumers can use and that the adapter can support with a documented confidence/quality level:

- `contains`
- `imports`
- `calls`
- `references`
- `defines_route`
- Other explicitly approved relationships

Do not imply that a syntactic call edge proves runtime execution or reachability. Distinguish syntactic relationships from resolved relationships.

### 4.5 Diagnostics and partial parsing

A parser can produce useful partial information while reporting errors. Store diagnostics with:

- File and source range where available.
- Diagnostic code and severity.
- Parser message, safely bounded.
- Whether parsing continued.
- Whether the affected file's output is partial.

Do not treat parser diagnostics as security vulnerabilities.

### 4.6 Schema validation

Use Pydantic models and enforce:

- Required identity fields.
- Valid enum values.
- Bounded strings and arrays.
- Valid source ranges.
- Parent and relationship references resolve within the same AST analysis.
- File references belong to the same scan and commit.
- No path escapes the repository.
- No duplicate stable IDs within the same analysis.
- Parser metadata is present.
- Schema version is explicit.

Reject invalid records or quarantine the affected file/analysis with diagnostics. Never silently coerce malformed source locations.

---

## 5. Language adapter architecture

Do not couple the entire ARVE pipeline to one parser library or one language.

Create a language-neutral AST interface with language-specific adapters:

```text
ASTService
  |
  +-- LanguageDetector
  |
  +-- ParserAdapter interface
        |
        +-- Python adapter
        +-- JavaScript / TypeScript adapter
        +-- Java adapter (later)
        +-- Go adapter (later)
```

Each adapter should implement the same lifecycle:

1. Receive an immutable file snapshot and metadata.
2. Parse within resource limits.
3. Normalize parser output into ARVE AST records.
4. Emit diagnostics and coverage status.
5. Validate normalized output.
6. Return a versioned result envelope.

The first implementation should support a deliberately limited set of languages that match ARVE's actual target repositories. Do not claim broad language support based only on file-extension detection.

**Important:** Parser choice, supported syntax versions and licensing must be evaluated before implementation. The AST contract must remain independent of the selected parser.

---

## 6. Persistence and database integration

AST must be persisted before downstream graph, AI and report consumers use it.

### 6.1 Storage design

Choose storage based on expected volume and query patterns. A practical starting point is:

- PostgreSQL for analysis metadata, file records, symbol records, relationships, diagnostics and source references.
- Existing Neo4j graph for selected security-relevant relationships and graph reasoning.
- Object storage only if raw parser artifacts or large serialized outputs are genuinely required.

Do not store a full parser tree in Neo4j. Do not duplicate every AST node into the attack graph.

### 6.2 Required persistence properties

- Foreign keys or equivalent integrity checks to project, scan and commit.
- Unique constraints for stable record identities within an analysis.
- Indexes for scan, commit, file path, symbol type/name and relationship lookups.
- Cascading/retention behavior explicitly designed; avoid accidental deletion of evidence still referenced by reports.
- Transactional persistence or a staged-write approach so incomplete output is not marked completed.
- Idempotent reprocessing of the same source snapshot and adapter version.
- Alembic migrations with safe upgrade and rollback strategy.

### 6.3 Re-analysis and versioning

AST output can change when parser versions, adapters or normalization rules change. Store:

- AST schema version.
- Parser name/version.
- Adapter version.
- Normalizer version.
- Source commit and file hashes.
- Analysis timestamp and status.

A new parser or adapter version must create a distinguishable analysis revision. Do not overwrite old evidence that is referenced by an already generated report.

---

## 7. How AST should connect to existing ARVE components

### 7.1 Existing security engines and canonical findings

AST should enrich canonical findings with code context where a reliable match exists:

- Map engine file path and source range to AST file/symbol records.
- Attach containing function/class/module.
- Add relevant call/import context when supported.
- Preserve the original engine finding and its provenance.
- Store AST enrichment as linked evidence/context, not as a destructive rewrite of the finding.

A failed or missing AST match must not cause a valid scanner finding to disappear.

Do not match solely on line number if the source commit or content hash differs.

### 7.2 Data-flow analysis

AST is a structural foundation, not automatically a complete taint/data-flow engine.

If ARVE intends to derive data flow, implement it as a distinct layer with its own contract:

- Sources: user-controlled or otherwise untrusted inputs.
- Propagation: assignments, parameters, returns and supported calls.
- Sanitizers/validators: explicitly modeled and context-sensitive.
- Sinks: sensitive operations such as SQL execution, command execution, file access or response rendering.
- Path evidence: ordered source-to-sink steps with file and source ranges.
- Confidence/completeness: unresolved calls and unsupported constructs must be explicit.

Start with a narrow, testable set of languages and source/sink models. Do not claim whole-program or interprocedural coverage until verified.

### 7.3 Security pattern engine

Use AST to support structural patterns such as:

- Dangerous function calls.
- Insecure framework configuration.
- Missing or ineffective validation in supported contexts.
- Sensitive operations reachable from specified inputs, where data-flow supports the claim.
- Risky combinations of imports, calls and framework constructs.

Pattern rules must be versioned, testable and tied to evidence. A pattern match is not automatically a confirmed vulnerability; map it to the canonical finding contract only through explicit detection logic and validation.

### 7.4 Neo4j and attack graph

Do not turn the entire AST into an attack graph.

Create a graph projection layer that selects only security-relevant entities and relationships. Candidate entities include:

- Repository component/module.
- Function or method.
- Entry point or route.
- Source and sink.
- Canonical finding.
- Sensitive asset/resource.
- Dependency or external service, where relevant.

Candidate relationships include:

- `CONTAINS`
- `CALLS`
- `IMPORTS`
- `FLOWS_TO`
- `EXPOSES`
- `AFFECTS`
- `DEPENDS_ON`

Use the existing graph schema where an equivalent already exists. Do not introduce duplicate labels or relationship types without a migration and compatibility review.

Every projected node/edge should retain source provenance, scan/commit scope and a link to its underlying AST or finding record. Graph construction must be idempotent and safe to rerun.

Only validated, security-relevant graph relationships should influence attack-path generation and risk scoring.

### 7.5 Risk engine

AST context may improve exploitability or reachability analysis, but it must not silently change severity or risk formulas.

Before using AST-derived features in scoring:

1. Define the feature and its semantics.
2. Define how missing/partial AST coverage is treated.
3. Add explainable score-contribution metadata.
4. Test false-positive and false-negative behavior.
5. Version the scoring policy.
6. Compare results with the current baseline.

Do not penalize a project merely because AST does not support one of its languages.

---

## 8. AI Security Assistant integration

The AI Assistant must consume normalized AST evidence through a bounded evidence-pack service. It must not receive raw parser objects or query the AST database directly.

### 8.1 Useful AST context for the assistant

Depending on the user's question, the evidence pack may include:

- Enclosing function/class and exact source range.
- Relevant imports and call relationships.
- A short call-chain excerpt.
- Source-to-sink path steps, if a validated data-flow result exists.
- Related canonical findings.
- AST coverage/diagnostics that affect confidence.

### 8.2 Token efficiency

- Retrieve AST context only after classifying the user request.
- Start with the finding and its containing symbol.
- Expand to callers/callees or data-flow only when necessary.
- Bound call-chain depth and number of related symbols.
- Include IDs and source references, not full parser serialization.
- Deduplicate repeated code snippets.
- Keep the existing per-task token budgets and cache rules.
- If AST is unavailable, answer using scanner evidence and state that structural context was unavailable.

### 8.3 AI boundaries

The model may explain what an AST-derived relationship means, but it must not invent call edges, data-flow paths, symbol names or source locations. Those must be retrieved from validated persisted records.

---

## 9. Security Audit Report integration

The report generator should automatically use AST data to improve traceability and code context, without making the LLM responsible for report construction.

### 9.1 Deterministic report fields

Where available, the report can automatically add:

- Enclosing function/method/class.
- Symbol type and qualified name.
- Relevant call-chain or source-to-sink path.
- Related code locations.
- AST analysis coverage and unsupported-language limitations.

These are rendered from persisted AST records.

### 9.2 Finding page behavior

For each finding:

- Always show the original scanner location.
- Show AST-resolved symbol context only when the match is validated.
- Link to the exact file and line at the scanned commit.
- Clearly label derived context as AST context.
- If symbol resolution is unavailable, omit it or state that it could not be resolved; never guess.

### 9.3 Methodology and coverage

The report should state:

- Which languages were AST-analyzed.
- Which files were included/excluded.
- Parser/adapter versions.
- Partial parsing and unsupported-language limitations.
- Whether data-flow analysis was performed separately.

A scan with no AST coverage must not imply that code structure was fully analyzed.

---

## 10. API and service boundaries

Define internal service boundaries before exposing endpoints. Names below are illustrative and should follow ARVE's existing route conventions.

Potential operations:

- Start or schedule AST analysis for a scan.
- Retrieve AST analysis status and coverage.
- Retrieve file-level AST summary.
- Retrieve symbols for a file or finding.
- Retrieve a bounded symbol neighborhood/call chain.
- Retrieve validated data-flow evidence, once implemented.
- Re-run AST analysis with a specified adapter version, subject to authorization.

Requirements:

- Every request is authorized against project and scan ownership.
- Queries are scoped to the immutable scan/commit.
- Pagination and maximum result sizes are enforced.
- No endpoint returns unbounded AST trees.
- API response schemas are versioned.
- Internal AST parser details are not exposed unnecessarily to the frontend.

---

## 11. Frontend readiness

The UI should not need to know which parser generated the AST.

Prepare reusable UI states for:

- AST analysis pending/running.
- AST completed with coverage summary.
- Partial AST analysis.
- Unsupported language.
- AST failed, with safe diagnostics.
- AST not enabled for this scan.

Potential user-facing capabilities after implementation:

- Show the enclosing function/class for a finding.
- Open code at the exact scanned line.
- Display a bounded call-chain or data-flow explanation.
- Show AST coverage in scan details.
- Distinguish scanner evidence from AST-derived context.

Do not add a complex AST tree explorer merely because the backend stores syntax nodes. Build UI around security tasks and developer actions.

---

## 12. Security, performance and sandboxing

AST parsing processes untrusted repository content. Treat it as an attack surface.

Required controls:

- Run parsing in the existing isolated execution model where feasible.
- Preserve `--network=none` or equivalent no-network isolation.
- Apply CPU, memory, file-size, file-count and wall-clock limits.
- Do not execute repository code, build scripts, macros or package lifecycle hooks to parse it.
- Prevent path traversal and symlink escapes.
- Handle deeply nested or malformed syntax safely.
- Bound parser output and diagnostics.
- Avoid logging secrets or entire source files.
- Keep parser dependencies pinned and scanned.
- Verify parser licensing and supply-chain provenance.
- Ensure AST processing cannot access another project's data.

Measure AST runtime, memory, files parsed, partial failures and output volume. Establish budgets using representative repositories before enabling it by default.

---

## 13. Testing strategy

AST must be tested at unit, contract, integration, security and end-to-end levels.

### 13.1 Contract tests

- Valid AST envelope and records are accepted.
- Invalid source ranges and unresolved references are rejected.
- Cross-scan and cross-commit references are rejected.
- Duplicate IDs are handled deterministically.
- Schema-version incompatibility is explicit.

### 13.2 Parser/adapter tests

Build fixtures for each supported language:

- Valid syntax.
- Syntax errors and partial parse.
- Nested functions/classes.
- Imports and aliases.
- Function calls and method calls.
- Decorators/annotations and framework constructs where supported.
- Unicode identifiers and comments.
- Large files and deeply nested syntax.
- Generated/vendor files and excluded paths.

Assert normalized records and source locations, not parser-library implementation details.

### 13.3 Pipeline integration tests

- Existing scanners complete when AST is disabled.
- Existing scanners complete when AST fails.
- AST output is persisted before consumers run.
- AST can be rerun idempotently.
- A new parser version creates a distinguishable analysis revision.
- Findings remain unchanged when AST enrichment is absent.
- AST enrichment links to the correct finding, file and commit.
- Neo4j projection can be rebuilt without duplicate nodes/edges.
- Partial AST coverage is accurately represented.

### 13.4 AI and report tests

- AI evidence packs contain only bounded AST context relevant to the request.
- AI cannot invent symbol names, paths, line numbers or call edges.
- Assistant works when AST is disabled or unavailable.
- Report renders AST context only when validated.
- Report remains complete without AI.
- Report remains complete without AST.
- Report identifies partial/unsupported AST coverage.
- Existing report snapshots remain stable after a later AST re-analysis.

### 13.5 Security and performance tests

- Malformed repositories cannot escape the sandbox.
- Parser resource limits are enforced.
- Symlinks and path traversal are handled safely.
- Large repositories do not cause unbounded memory or database writes.
- AST processing does not access network resources.
- Tenant/project isolation is maintained.

---

## 14. Phased implementation and transition gates

Do not implement all AST consumers at once. Use these gates.

### Phase 0 — Contract and dependency preparation

- [ ] Inventory current scan, finding, evidence, graph and report contracts.
- [ ] Confirm immutable source snapshot and commit identity.
- [ ] Standardize source path/range conventions.
- [ ] Confirm engine status and partial-coverage semantics.
- [ ] Approve AST schema and versioning strategy.
- [ ] Decide initial language scope and evaluate parser choices.
- [ ] Review database ownership and migration strategy.

**Exit gate:** Architecture and contracts reviewed; no parser implementation is required yet.

### Phase 1 — AST foundation

- [ ] Implement normalized Pydantic AST models.
- [ ] Implement language detector and parser adapter interface.
- [ ] Implement one initial language adapter.
- [ ] Add file, symbol, relationship and diagnostic normalization.
- [ ] Add source-range and path validation.
- [ ] Add resource limits and isolated execution.
- [ ] Add unit and contract fixtures.

**Exit gate:** A representative repository produces validated, deterministic, commit-scoped AST output.

### Phase 2 — Persistence and orchestration

- [ ] Add Alembic migrations and indexes.
- [ ] Persist analysis metadata, files, symbols, relationships and diagnostics.
- [ ] Integrate AST as an optional orchestrated stage.
- [ ] Add engine status, retries, cancellation and failure isolation.
- [ ] Add idempotency and re-analysis versioning.
- [ ] Add coverage and runtime telemetry.

**Exit gate:** AST can be run, persisted, queried and rerun without breaking existing scans.

### Phase 3 — Finding enrichment and data-flow foundation

- [ ] Map canonical findings to AST file/symbol records.
- [ ] Preserve original finding evidence and provenance.
- [ ] Add bounded symbol/call relationship queries.
- [ ] Define a separate data-flow contract.
- [ ] Implement a small, testable source/propagation/sink model if in scope.
- [ ] Expose partial and unresolved analysis explicitly.

**Exit gate:** Findings can be enriched with validated code context; no unsupported data-flow claims are made.

### Phase 4 — Graph projection and risk integration

- [ ] Define security-relevant AST-to-graph projection rules.
- [ ] Reuse existing graph labels and relationships where possible.
- [ ] Add provenance and scan/commit scope to projected records.
- [ ] Make graph projection idempotent and rebuildable.
- [ ] Integrate only validated relationships into attack paths.
- [ ] Evaluate any proposed risk-scoring changes against a baseline.

**Exit gate:** AST enrichment improves graph context without duplicating the full syntax tree or destabilizing existing attack paths.

### Phase 5 — AI Assistant and report consumers

- [ ] Add bounded AST retrieval to the evidence-pack service.
- [ ] Add task-specific AST context only where relevant.
- [ ] Enforce token budgets and evidence-ID validation.
- [ ] Add deterministic AST metadata to report snapshots.
- [ ] Render symbol/call-chain context in finding pages where validated.
- [ ] Add AST coverage and limitations to the report methodology.
- [ ] Verify both products work when AST is unavailable.

**Exit gate:** AI and report consumers use only persisted normalized AST data and preserve source traceability.

### Phase 6 — Shadow rollout and controlled enablement

- [ ] Run AST in shadow mode on representative repositories.
- [ ] Compare parser coverage and source locations against fixtures/manual review.
- [ ] Measure runtime, memory, storage and error rates.
- [ ] Review false symbol resolutions and graph projection quality.
- [ ] Enable behind a feature flag for selected projects/languages.
- [ ] Monitor before broad enablement.
- [ ] Document rollback and reprocessing procedures.

**Exit gate:** Quality, performance, security and compatibility targets are met before default enablement.

---

## 15. Feature flags and rollback

Use a project- or scan-level feature flag, for example `ast_analysis_enabled`, with a separate flag for AST-derived graph projection if needed.

Rollback must be possible without deleting valid scanner data:

- Disable AST scheduling.
- Stop AST-derived enrichment/projection consumers.
- Preserve already persisted AST evidence for auditability and existing report snapshots.
- Rebuild graph projections from the previous supported inputs if required.
- Keep old report snapshots immutable.
- Re-enable only after the issue is fixed and compatibility checks pass.

Do not use destructive database rollback as the normal operational off switch.

---

## 16. Observability and operational metrics

Track at minimum:

- AST analyses requested/completed/partial/failed.
- Files discovered, supported, parsed, excluded and failed.
- Coverage by language.
- Parse duration and total scan overhead.
- CPU and memory use.
- Persisted record counts and storage growth.
- Parser/adapter versions.
- Source-location validation failures.
- Finding-to-symbol match rate.
- Graph projection success/failure and duplicate prevention.
- AI evidence-pack size and AST context retrieval latency.
- Report generation success and AST-context inclusion rate.

Avoid treating a high symbol count or high AST coverage percentage as a security-quality metric by itself.

---

## 17. Definition of done

AST integration is ready for general use only when all of the following are true:

- [ ] AST has a versioned, validated, language-neutral ARVE contract.
- [ ] All records are tied to immutable project, scan, commit and source-file identities.
- [ ] Parser execution is isolated and resource-bounded.
- [ ] AST persistence is reliable, indexed, idempotent and migration-safe.
- [ ] Existing scanners remain functional when AST is off or fails.
- [ ] Canonical findings retain their original identity and provenance.
- [ ] AST enrichment is explicit and traceable.
- [ ] Data-flow claims are backed by a separate validated data-flow contract.
- [ ] Neo4j receives only selected security-relevant projections.
- [ ] Attack paths and risk calculations do not consume unvalidated AST guesses.
- [ ] AI uses bounded normalized evidence and does not invent code relationships.
- [ ] Reports show exact source locations and clearly disclose AST coverage/limitations.
- [ ] UI represents disabled, unsupported, partial, failed and completed states.
- [ ] Unit, integration, regression, security and performance tests pass.
- [ ] Shadow rollout and rollback have been exercised.

---

## 18. Recommended implementation order

The safest sequence is:

1. **Stabilize contracts and source identity first.** This prevents AST from creating a second incompatible representation of files and locations.
2. **Build the normalized AST adapter and persistence layer.** Prove that AST output is valid and retrievable before integrating consumers.
3. **Integrate AST with canonical findings.** This gives immediate practical value by showing developers the relevant function/class around a scanner finding.
4. **Add bounded data-flow analysis.** Keep it separate from parsing and introduce it incrementally.
5. **Project selected security relationships into Neo4j.** Do not dump the syntax tree into the graph.
6. **Connect the AI Assistant and report generator.** Both consume the same persisted evidence contracts; neither should parse source independently.
7. **Run shadow mode, evaluate and roll out behind feature flags.**

### Final engineering rule

**AST must be an additive, versioned evidence provider in ARVE.** It should improve code context, structural analysis, data-flow, graph relationships, AI explanations and report traceability—but the existing scanner pipeline must remain correct and useful without it.

Do not begin by building the AST UI or asking the LLM to interpret raw parser output. First establish the source identity, normalized contract, persistence and validation boundaries. Those are what make the later integration safe.
