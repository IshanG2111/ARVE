# ARVE — Development Plan (Revised)

> **Revision note.** This keeps the original phase flow but makes it executable: explicit scope
> limits, a build order that produces a demo earlier, the missing scan-orchestration layer, and
> testable "Done When" criteria. Phases marked ✅ reflect work already merged.

---

## 0. Scope Contract

Everything below is bounded by these limits. Anything outside them is out of scope for v1 and
goes on the deferred list in §16. Agree on this before writing code — most project failures here
come from silent scope growth, not from difficult engineering.

| Dimension | v1 scope | Deferred |
|---|---|---|
| **Languages** | JavaScript, TypeScript | Python (v1.1), Java/Go/C# (never, this term) |
| **Frameworks** | Express, Next.js, React, Node.js | Everything else |
| **Vulnerability classes** | Injection (SQL/NoSQL/command), Broken Access Control, Hardcoded Secrets, Vulnerable Dependencies, Security Misconfiguration | XSS, SSRF, deserialization, path traversal (add opportunistically via Semgrep rules — free once the pipeline works) |
| **Engines** | Semgrep, OSV-Scanner, Gitleaks | Checkov (Tier 2), CodeQL, ZAP |
| **Repo size** | ≤ 5,000 source files, ≤ 200 MB, ≤ 15 min total scan | Larger repos rejected with a clear message |
| **Scale** | Single-repo scans, one at a time per user | Concurrent scans, org-wide scanning |
| **Graph store** | PostgreSQL adjacency tables | Neo4j (see §9 — decide at Phase 7, not now) |

**Rule of thumb:** if a task can't be completed and demoed by one person in under a week, it is
too big and needs splitting.

---

## 1. Current Objective

Build the first working ARVE security-analysis pipeline:

**GitHub Auth → Repository Ingestion → Scan Orchestration → Security Engines → Finding
Normalization → AST / Code Intelligence → Correlation → Risk Analysis → Graph → LLM → Dashboard**

The immediate goal is to get a repository scanned end-to-end before building advanced AI features.

> **Change from the original flow:** AST/Code Intelligence has moved from position 3 to after
> Finding Normalization, and Scan Orchestration has been added. Reasoning in §4 and §5.

---

## 2. Phase 1 — GitHub Authentication ✅ **COMPLETE**

### Status

Already merged and working. Do not rebuild.

* [x] GitHub OAuth (via Firebase Auth + GitHub provider)
* [x] Session storage (httpOnly JWT cookie + Bearer token)
* [x] Fetch authenticated user's repositories
* [x] Display repository list
* [x] Repository selection (3-step project wizard)
* [x] Branch selection
* [ ] **Commit pinning** — carry forward into Phase 2
* [ ] **`scan_id` creation** — carry forward into Phase 3

### Remaining debt to clear (½ day, do now)

* [ ] Fix `addTarget` path mismatch — frontend calls `POST /api/targets/projects/{id}`, backend
  registers `POST /api/projects/{id}/targets`
* [ ] Fix `firebase_auth.py` settings attribute bug — lowercase `settings.firebase_service_account_json`
  doesn't exist, so the Admin SDK path silently never runs
* [ ] Gate all mock/demo auth paths behind an explicit `ARVE_ENV=dev` flag

### Done When

A user logs in, selects a repository *and a specific commit SHA*, and gets a `scan_id` back.

---

## 3. Phase 2 — Repository Ingestion

**Owner:** Backend/Auth · **Estimate:** 1 week

### Goal

Create an isolated, reproducible workspace containing the selected repository.

### Tasks

* [ ] Shallow clone selected repository (`--depth 1` unless lineage is needed later)
* [ ] Resolve branch → **exact commit SHA** and check it out
* [ ] Create isolated scan workspace at `/workspaces/{scan_id}/`
* [ ] Enforce size guards (file count, total bytes, clone timeout) — reject early with a clear error
* [ ] Filter out `node_modules/`, `dist/`, `build/`, `.git/`, binaries, lockfile-only dirs
* [ ] Detect languages (file-extension counts — do **not** build a classifier)
* [ ] Detect frameworks (read `package.json` dependencies — Express/Next/React lookup table)
* [ ] Detect package manager (`package-lock.json` / `yarn.lock` / `pnpm-lock.yaml`)
* [ ] Identify dependency files and config/infra files by filename pattern
* [ ] Store repository metadata + manifest (file list + SHA-256 per file)
* [ ] Clean up workspace after scan completion (with a `KEEP_WORKSPACE` dev flag)

### Output

```text
Repository Snapshot (pinned to commit SHA)
├── Source Files
├── Dependency Files
├── Configuration
├── Infrastructure
└── Project Metadata + File Manifest
```

### Non-goals

No submodule handling. No monorepo workspace resolution. No private-registry auth.

### Done When

Scanning the same commit twice produces an identical manifest — same SHA, same file list, same
hashes. **Write this as an automated test.** Reproducibility is the foundation every later phase
depends on; if it's wrong, every finding is unreproducible.

---

## 4. Phase 3 — Scan Orchestration ⭐ **NEW**

**Owner:** Graph/DevOps · **Estimate:** 1 week · **Blocks:** everything after it

### Goal

Run scans asynchronously, in isolation, with observable progress. This phase does not exist in the
original plan and its absence would block Phase 4 entirely — a scan takes minutes, and an HTTP
request cannot hold that connection open.

### Tasks

* [ ] Add a job runner — **Celery + Redis** (or FastAPI `BackgroundTasks` if the team wants to
  defer the dependency; Celery is worth it once scans exceed ~60s)
* [ ] Implement the scan state machine and persist status transitions
* [ ] `POST /api/projects/{id}/scan` returns `202 Accepted` + `scan_id` immediately
* [ ] `GET /api/scans/{scan_id}/status` returns `{status, progress, message, started_at}`
* [ ] Frontend polls status every 2s (skip WebSockets — polling is fine at this scale)
* [ ] Per-engine timeouts and a global scan timeout
* [ ] Partial-failure handling: one engine failing must not fail the scan
* [ ] Structured logging with `scan_id` on every log line

### State machine

```text
QUEUED → INGESTING → SCANNING → NORMALIZING → INDEXING
       → CORRELATING → SCORING → GRAPH_BUILD → COMPLETED

Terminal failure states: FAILED · PARTIAL · CANCELLED
```

A scan where Gitleaks succeeded but Semgrep timed out is `PARTIAL`, never `COMPLETED`. Silently
presenting a partial scan as complete is the single most damaging bug this system can ship.

### Docker isolation ⚠️ **Security requirement, not optional**

You are cloning and scanning untrusted third-party code. Run engines in containers with
`--network=none`, a read-only mount of the workspace, a memory cap, and a non-root user.

* [ ] `docker-compose.yml` — api, worker, postgres, redis
* [ ] Scanner base image with Semgrep + OSV-Scanner + Gitleaks preinstalled
* [ ] Container resource limits and network isolation

### Done When

A scan runs in the background, the UI shows live progress through every state, and killing one
engine mid-scan yields `PARTIAL` rather than a crash or a false `COMPLETED`.

---

## 5. Phase 4 — Security Engines

**Owner:** Security/Backend · **Estimate:** 1.5 weeks

### Goal

Run specialized security scanners against the workspace.

> **Order change:** this now runs *before* AST/Code Intelligence. Semgrep emits `file:line`
> findings with no AST required, so this ordering produces a demoable vertical slice weeks earlier
> and lets AST development proceed in parallel without blocking the demo.

### Engine priority

Build **Semgrep first and alone**. Get it fully working end-to-end through the dashboard before
adding a second engine. Each additional engine is then a small, well-understood increment.

#### Semgrep — SAST (build first)

* [ ] Integrate Semgrep CLI, invoked with `--sarif`
* [ ] Use `p/javascript`, `p/typescript`, `p/owasp-top-ten` registry rulesets — **write zero
  custom rules in v1**
* [ ] Capture SARIF output
* [ ] Map findings to file/line
* [ ] Handle timeout and non-zero exit codes

#### OSV-Scanner — Dependency Security (build second)

* [ ] Run against lockfiles
* [ ] Capture CVE/OSV IDs, affected package + version range, fixed version
* [ ] Map vulnerabilities to packages

#### Gitleaks — Secret Detection (build third)

* [ ] Scan workspace for secrets
* [ ] Capture findings and source locations
* [ ] **Redact secret values before storage** — store a fingerprint/hash, never the credential

#### Checkov — Infrastructure Security (**Tier 2 — defer**)

Only if Dockerfiles or IaC are actually present in test repos and there is schedule left.

### SARIF as the common contract

Semgrep and Checkov emit SARIF 2.1.0 natively. Normalizing through SARIF where available means
one adapter covers multiple engines and any future SARIF-emitting tool. OSV-Scanner and Gitleaks
use their own JSON and need dedicated adapters.

### Done When

Each engine runs inside its container against a known-vulnerable repo (NodeGoat or DVNA) and
returns machine-readable output that is persisted to disk with the scan.

---

## 6. Phase 5 — Finding Normalization

**Owner:** Security/Backend · **Estimate:** 1 week

### Goal

Convert results from different scanners into one ARVE finding format.

### Common Finding Schema

```text
Finding
├── id
├── scan_id
├── engine
├── title
├── description
├── severity          # normalized: critical | high | medium | low | info
├── confidence        # deterministic, from evidence — never LLM-assigned
├── file
├── line_start
├── line_end
├── function          # nullable until Phase 6 correlation runs
├── rule_id
├── cwe[]             # array — a finding can map to multiple CWEs
├── cve_osv_id
├── component         # package name for dependency findings
├── evidence          # JSONB: raw engine output + code snippet
├── remediation
└── fingerprint       # for dedup across scans
```

### Tasks

* [ ] Define canonical finding schema + Alembic migration
* [ ] Build SARIF adapter (covers Semgrep, later Checkov)
* [ ] Build OSV adapter
* [ ] Build Gitleaks adapter
* [ ] Normalize severity across engines into one scale — document the mapping table
* [ ] Compute a stable `fingerprint` (`engine + rule_id + file + normalized_code_hash`) so the
  same issue is recognizable across scans and commits
* [ ] Deduplicate within a scan by fingerprint
* [ ] Validate normalized output against a Pydantic schema — reject rather than store malformed

### Non-goals for v1

**No cross-engine correlation.** If Semgrep and a future CodeQL both flag the same line, store two
findings. Merging findings from different engines into one canonical finding is genuinely hard and
belongs in v2.

### Done When

Every engine produces the identical ARVE finding structure, and a schema-validation test passes
over the full output of a real scan.

---

## 7. Phase 6 — AST / Code Intelligence

**Owner:** Security/Backend + Cybersecurity Lead · **Estimate:** 2 weeks · **Highest-risk phase**

### Goal

Understand code structure well enough to attach findings to functions. Nothing more.

> **Scope warning.** This is where projects like this stall. The original task list ("extract
> variables and relevant symbols", "build basic call relationships") is open-ended enough to
> absorb a whole term. The scope below is deliberately minimal and sufficient for Phase 7.

### Tasks

* [ ] tree-sitter with `tree-sitter-javascript` and `tree-sitter-typescript` only
* [ ] Parse source files → AST
* [ ] Extract **files** (path, language, hash)
* [ ] Extract **functions/methods** (name, `line_start`, `line_end`, file, enclosing class)
* [ ] Extract **classes** (name, line range, file)
* [ ] Extract **imports** (module specifier, imported symbols, file)
* [ ] Extract **routes/endpoints** (Express `app.get/post/...`, Next.js file-based routes) — the
  single highest-value extraction for security context
* [ ] Build a **line-range index** so any `file:line` resolves to its enclosing function in O(log n)
* [ ] Stable node IDs (`{scan_id}:{file_path}:{node_type}:{name}:{line_start}`)
* [ ] Store code intelligence data
* [ ] Graceful degradation — a parse failure on one file logs a warning and continues

### Deferred to v2 (do not build now)

Function-call graphs · variable/symbol tracking · data-flow and taint analysis · cross-file
resolution · source/sink detection.

Call-graph construction in dynamic JavaScript is a research problem (dynamic dispatch, callbacks,
`require` indirection). Attempting it will consume the remaining schedule.

### Core Model

```text
Repository
    ↓
Files
    ↓
AST (tree-sitter)
    ↓
Classes / Functions / Routes / Imports
```

### Done When

ARVE can answer, for any repository in scope:

* Which functions exist and where is each defined?
* Which HTTP endpoints does this application expose?
* **Given `file:line` from a finding, which function contains it?** ← the one that matters

---

## 8. Phase 7 — Finding Correlation

**Owner:** Cybersecurity Lead · **Estimate:** 1 week

### Goal

Connect findings to code structure and group related findings.

### Correlation signals — v1

* [ ] Same file
* [ ] Same function (via the Phase 6 line-range index)
* [ ] Same class
* [ ] Same dependency/package
* [ ] Same CWE
* [ ] Same route/endpoint

### Deferred to v2

Function-call relationships · data-flow relationships · application-component grouping ·
related-configuration linking. All of these depend on the call graph and taint analysis deferred
in Phase 6.

### Realistic v1 output

The original example implies full taint tracking. What v1 can honestly produce:

```text
POST /api/users/:id            (route, from Phase 6)
    ↓ contains
updateUser()                   (function, from Phase 6)
    ↓ contains
SQL Injection Finding          (Semgrep, CWE-89, line 42)
    +
Missing Auth Check Finding     (Semgrep, CWE-862, line 38)
    → grouped: same function, same endpoint, both access-control-adjacent
```

That is genuinely useful and defensible. Claiming a proven data-flow path from user input to sink
is not — the evidence doesn't exist yet.

### Done When

Every finding with a resolvable location is attached to its enclosing function and route, and
findings sharing a function or endpoint are grouped into clusters visible in the UI.

---

## 9. Phase 8 — Security Knowledge Graph

**Owner:** Graph/DevOps · **Estimate:** 1 week

### Goal

Represent the repository and its findings as a connected, queryable graph.

### ⚠️ Storage decision — make this call at the start of this phase

A single-repository graph is small (thousands of nodes, not millions). **Start with PostgreSQL
adjacency tables** (`graph_nodes`, `graph_edges`) and recursive CTEs. Adopt Neo4j only if you hit
a concrete query you cannot express, and only after the pipeline works end-to-end. Adding a second
database is a week of DevOps work that buys nothing at this scale.

### Node Types (v1)

```text
Repository · File · Class · Function · Route
Dependency · Finding · Vulnerability · Secret
```

### Relationship Types (v1)

```text
CONTAINS · IMPORTS · DEPENDS_ON · AFFECTED_BY · RELATED_TO
```

`CALLS`, `FLOWS_TO`, and `VULNERABLE_TO` are deferred — they require the call graph and taint
analysis deferred in Phase 6. Do not create edge types you cannot populate with real evidence.

### Tasks

* [ ] Define graph schema + migration
* [ ] Generate nodes from code intelligence
* [ ] Generate finding, dependency, and vulnerability nodes
* [ ] Create relationships
* [ ] Expose `GET /api/scans/{id}/graph?depth=&node_types=` through the backend
* [ ] Cap returned subgraph size (default depth 2, max ~300 nodes) — an unbounded graph will hang
  the browser

### Done When

Selecting a finding returns its connected subgraph — enclosing function, file, route, sibling
findings — through the API in under 500 ms.

---

## 10. Phase 9 — Risk Engine

**Owner:** Cybersecurity Lead · **Estimate:** 3–4 days

### Goal

Prioritize vulnerabilities instead of counting them.

### Model — transparent weighted scoring only

No ML. No XGBoost. A weighted formula you can explain to an examiner in one slide is worth more
here than a model you cannot justify, and you have no labeled training data for risk anyway.

```text
risk = w1·severity + w2·confidence + w3·exposure + w4·cluster_size

exposure     = is the finding inside a route handler? (binary, from Phase 6)
cluster_size = how many findings share this function/endpoint? (from Phase 7)
```

### Tasks

* [ ] Define the scoring model and **write the weights in a config file**, not in code
* [ ] Calculate finding-level risk
* [ ] Calculate file/component-level risk (aggregate)
* [ ] Calculate repository-level score (0–100)
* [ ] Rank findings into a remediation order
* [ ] Store the score breakdown per finding so the UI can show *why*

### Deferred

Exploitability from EPSS/KEV feeds · attack-path position (needs Phase 6 v2 work).

### Done When

The dashboard shows a ranked fix list, and clicking any finding reveals its per-factor score
breakdown.

---

## 11. Phase 10 — LLM Analysis

**Owner:** ML/Data · **Estimate:** 1 week

### Goal

Use the LLM for interpretation, not detection.

### Responsibilities

* [ ] Explain individual findings in plain language
* [ ] Summarize a correlated finding cluster
* [ ] Suggest a concrete fix
* [ ] Explain business/security impact
* [ ] Generate an executive summary for the report

### Deferred

Attack-path analysis (needs data-flow evidence that won't exist in v1).

### Hard constraints

* [ ] **Context builder** — the LLM receives a bounded context, never the repository:
  finding + ±30 lines of code + enclosing function signature + file imports + route + CWE
  description + raw engine evidence
* [ ] **Structured output** — enforce a JSON schema; reject and retry on schema violation
* [ ] **Every claim cites an `evidence_id`** — an explanation referencing no evidence is discarded
* [ ] **The LLM never sets severity or confidence** — those are deterministic (Phase 5, 9)
* [ ] Cache explanations by finding fingerprint — do not re-bill for the same finding
* [ ] Handle rate limits, timeouts, and malformed JSON as expected conditions

### Done When

A finding page shows an explanation that references real scanner evidence and code, and a
schema-validation test rejects malformed LLM output rather than displaying it.

---

## 12. Phase 11 — Dashboard

**Owner:** Frontend · **Estimate:** 2 weeks, built incrementally alongside earlier phases

> Build each screen as its backing phase lands — do not save UI work for the end. The findings
> table should exist the week Semgrep works.

#### Repository *(mostly exists)*
* [x] Repository selection
* [ ] Scan history
* [ ] Scan status

#### Scan Progress
* [ ] Live status via polling, showing the Phase 3 state machine
* [ ] Per-engine status (running / done / failed / skipped)
* [ ] Clear `PARTIAL` indication when an engine failed

#### Security Overview
* [ ] Repository risk score
* [ ] Counts by severity
* [ ] Most affected files/components

#### Findings
* [ ] Filter by severity, engine, file, CWE
* [ ] Finding detail: source location, code snippet, evidence, remediation
* [ ] Score breakdown

#### Security Graph
* [ ] Interactive subgraph per finding (React Flow or Cytoscape)
* [ ] Node click → detail panel
* [ ] **Ship a table/tree fallback view first** — the graph is the most likely component to be cut
  for time, and the underlying relationships are still valuable rendered as a list

#### AI Report
* [ ] Executive summary
* [ ] Prioritized fixes
* [ ] Export (start with Markdown/JSON; PDF only if time remains)

---

## 13. MVP Definition

The MVP is **not** the complete ARVE vision.

```text
GitHub Login  (done)
     ↓
Select Repository + Commit
     ↓
Clone Repository (isolated, pinned)
     ↓
Async Scan Job
     ↓
Semgrep  →  OSV-Scanner  →  Gitleaks
     ↓
Normalize Findings
     ↓
AST / Code Intelligence
     ↓
Correlate Findings to Functions & Routes
     ↓
Basic Risk Score
     ↓
Security Graph
     ↓
Dashboard
```

The LLM comes **after this pipeline works**.

---

## 14. Development Priority

Build in this exact order. Each numbered item must be demoable before the next begins.

| # | Task | Owner | Est. | Cumulative |
|---|---|---|---|---|
| 1 | ✅ GitHub Authentication | Backend/Auth | — | done |
| 2 | Auth debt fixes + `ARVE_ENV` gating | Backend/Auth | 0.5w | 0.5w |
| 3 | Docker Compose + CI + Alembic | DevOps | 1w | 1.5w |
| 4 | Repository Ingestion | Backend/Auth | 1w | 2.5w |
| 5 | **Scan Orchestration** | DevOps | 1w | 3.5w |
| 6 | **Semgrep integration** | Security/Backend | 1w | 4.5w |
| 7 | **Finding normalization + findings UI** | Security/Backend + Frontend | 1w | 5.5w |
| 8 | ⭐ **VERTICAL SLICE COMPLETE — demo here** | — | — | **5.5w** |
| 9 | OSV-Scanner integration | Security/Backend | 0.5w | 6w |
| 10 | Gitleaks integration | Security/Backend | 0.5w | 6.5w |
| 11 | AST / Code Intelligence | Security/Backend | 2w | 8.5w |
| 12 | Finding correlation | Cyber Lead | 1w | 9.5w |
| 13 | Security graph | DevOps | 1w | 10.5w |
| 14 | Risk engine | Cyber Lead | 0.5w | 11w |
| 15 | LLM analysis | ML/Data | 1w | 12w |
| 16 | Dashboard completion | Frontend | 1w | 13w |
| 17 | Testing, hardening, evaluation, docs | All | 2w | **15w** |

Frontend work runs continuously in parallel — the estimates above are for backend-blocking work.

---

## 15. First Milestone

```text
GitHub
  ↓
Repository (pinned commit)
  ↓
Async scan job
  ↓
Semgrep
  ↓
Normalized Finding
  ↓
Displayed in UI with file, line, severity, CWE
```

> **Changed from the original:** "Finding linked to Function/File" has moved out of the first
> milestone. Function linkage requires the entire AST phase. File+line linkage comes free from
> Semgrep and is enough to prove the pipeline. Function linkage becomes the *second* milestone,
> after Phase 6.

**Target: week 5.5.** Do not build the graph, risk engine, or LLM until this works reliably.

---

## 16. Explicit Non-Goals

Cut these on sight. They are all defensible v2 features and all schedule-killers now.

* Custom Semgrep rule authoring (registry rules are sufficient)
* Data-flow / taint analysis
* Function call graphs
* Cross-engine finding correlation
* Neo4j (unless Phase 8 proves a concrete need)
* Multi-language support beyond JS/TS
* Attack-path reconstruction
* ML-based risk scoring
* Concurrent/queued multi-repo scanning
* PDF report generation (Markdown/JSON export first)
* Real-time WebSocket updates (polling is sufficient)
* Autofix / PR generation

---

## 17. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AST phase overruns | **High** | High | Scope capped to functions/routes/imports; runs *after* the demo, so overrun doesn't block the vertical slice |
| Scanning untrusted code compromises the host | Medium | **Critical** | Docker isolation with `--network=none`, non-root, read-only mounts — non-negotiable, Phase 3 |
| Semgrep noise makes findings unusable | Medium | Medium | Start with curated registry rulesets; measure precision against NodeGoat/DVNA known vulns |
| Scan times exceed patience on real repos | Medium | Medium | Size guards + per-engine timeouts + `PARTIAL` status |
| Graph UI unfinishable in time | Medium | Low | Table/tree fallback ships first |
| LLM costs or rate limits | Low | Medium | Cache by fingerprint; explanations generated on demand, not for every finding |
| Team member unavailable | Medium | High | Every phase has a named owner *and* the vertical slice is sequenced so no single phase blocks the demo |

---

## 18. Definition of Done (project level)

The project is demonstrable when all of the following hold:

1. A user scans a public GitHub repository end-to-end without manual intervention.
2. Scanning the same commit twice produces identical findings.
3. Findings from three engines appear in one normalized schema.
4. Every finding resolves to its enclosing function and route where one exists.
5. The dashboard shows a ranked fix list with an explainable score breakdown.
6. LLM explanations cite real evidence IDs and are schema-validated.
7. Scanning NodeGoat or DVNA detects a documented, pre-known set of vulnerabilities — with
   measured precision and recall against that ground truth.
8. A failed engine yields `PARTIAL`, never a false `COMPLETED`.
9. `docker compose up` brings the whole system up from a clean checkout.
10. CI runs the test suite on every pull request.

Item 7 is what makes the work academically defensible — plan the evaluation from the start, not
in the final week.
