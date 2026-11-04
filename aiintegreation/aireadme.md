# ARVE AI Integration and Security Report

_Branch `sn`. Last updated 2026-11-04._

## In brief

ARVE now has three new features on top of the existing scanners (OSV, Gitleaks, Semgrep, CodeQL):

1. **"Explain with AI" on any finding.** Google Gemini reads the finding the engines produced, plus the code around it, and returns a plain-language explanation: what the problem is, why it matters, steps to fix it, and a suggested code change. The answer is checked by our code before anyone sees it, and saved so the same question is never paid for twice.
2. **"Summarise with AI" for a whole scan.** It gives an overview, the top risks and what to fix first. Each risk links back to its finding.
3. **A Security Audit Report (HTML and PDF)** built from the database: engine coverage, severity counts and every finding with its fix. It works with AI off. When cached AI answers exist, it adds them, marked "AI-assisted".

The AI never scans the repository and never decides what is a vulnerability. It only explains what the engines found. If AI is off, the model is busy, the quota is used up, or its answer fails our checks, the user sees standard (non-AI) guidance instead, with a Retry button where retrying makes sense.

**Status:** code complete and tested. Two things are open (details in [Open items](#open-items-for-the-team)):

- **AST hookup:** the code is ready; it needs the folder path of the real AST output. The team is taking this over.
- **Gemini capacity and quota:** `gemini-3.8-flash` was overloaded on Google's side during testing, so **dev now runs on `gemini-3.5-flash-lite`** (team decision, 2026-11-04) until 3.8 recovers. The free tier also rate-limits quickly, so warm the cache before a demo. Nothing in our code needs fixing for this.

---

## Contents

- [How it works](#how-it-works)
- [Setup](#setup)
- [Using it](#using-it)
- [Safety rules](#safety-rules)
- [What was built: file by file](#what-was-built-file-by-file)
- [API endpoints](#api-endpoints)
- [Database](#database)
- [Testing](#testing)
- [Live test results](#live-test-results)
- [Open items for the team](#open-items-for-the-team)
- [Troubleshooting](#troubleshooting)
- [Other documents in this folder](#other-documents-in-this-folder)

---

## How it works

```
Engines (OSV, Gitleaks, Semgrep, CodeQL) ──► security_findings table
                                                  │
AST output (JSON, optional) ──► enclosing function ┤
                                                  ▼
                       FindingContext: built by our code, secrets redacted
                                                  │
                                                  ▼
                        Prompt (fixed rules + finding) ──► Gemini ──► JSON answer
                                                                          │
                                       validated ──► cached ──► shown in the UI and the report
                                       failed    ──► standard guidance (fallback)
```

### Step by step

1. **Context.** For one finding, `app/ai/context.py` builds a `FindingContext`. The model only ever sees this:
   - the finding's engine, type, rule, title, message, severity, CWE, CVE and package details;
   - the existing catalog fix text, if there is one;
   - code, depending on the finding type:

     | Finding type | Code sent |
     |---|---|
     | SAST (Semgrep, CodeQL) | The enclosing function from the AST if available. Otherwise 15 lines either side of the finding (at most 80 lines) |
     | Dependency (OSV) | None. Package, version, fixed version and CVE are enough |
     | Secret (Gitleaks) | None at all. Only the rule name and the file path |

   - the finding is called `F1`, `F2` and so on; database IDs never reach the model.
2. **Redaction.** All repository text passes through `app/ai/redaction.py`. It masks common token formats (GitHub, AWS, Slack, private keys, connection-string passwords, bearer tokens and others) and any line Gitleaks flagged.
3. **Prompt.** `app/ai/prompts.py` has a fixed system prompt and one task variant per finding type (SAST, dependency, secret), each with a short worked example. Repository text is wrapped in `<untrusted_code>` / `<untrusted_text>` tags, and the model is told never to follow instructions found inside them.
4. **Call.** `app/ai/gemini_client.py` calls Gemini with JSON-schema output, a timeout, and one retry (after 2 s) on overload, rate limit or timeout. Safety blocks are not retried.
5. **Validation.** `app/ai/validate.py` checks the answer before anyone sees it:
   - it matches the schema, and lengths are within limits;
   - every finding reference (`F1`…) exists in the input;
   - every file path, CVE and CWE mentioned appears in the input, so nothing is invented;
   - there are no URLs and no "this is now secure" claims.

   If a check fails, the model gets one repair attempt with the reasons. If that fails too, the fallback is shown.
6. **Fallback.** `app/ai/fallback.py` builds standard guidance from the stored data: title, message, catalog fix and upgrade version. It is clearly labelled as not AI.
7. **Cache.** Only validated answers are stored, in the `ai_explanations` table. The cache key covers the finding, the prompt version, the model and the exact prompt text. So if the code, prompt or model changes, the old answer is not reused.

### The report

- `app/reports/builder.py` collects the scan, the engine status (completed, failed, not run; never "0 findings" for a failed engine), the severity counts and the findings, grouped by fingerprint.
- `app/reports/templates/report.html` is a Jinja2 template with autoescaping on. `app/reports/renderer.py` turns it into a PDF with `xhtml2pdf`, which is pure Python (no Docker or GTK).
- **The report never calls the model.** It only picks up answers that are already cached and still current, and labels them "AI-assisted" with the model name. Findings without a cached answer keep the standard text.
- Each finding gets a stable report ID, `ARVE-XXXXXXXX`, taken from its fingerprint. References like `[F2]` in the AI summary are rewritten to these IDs.

---

## Setup

### Settings

All settings are in `backend/app/core/config.py`. Defaults are in `backend/.env.example`; real values come from Infisical (`dev`, path `/backend`).

| Setting | Default | Meaning |
|---|---|---|
| `AI_ENABLED` | `false` | Master switch. When false, the AI buttons are hidden and no call is made |
| `GEMINI_API_KEY` | none | **Secret. Infisical only, never in a file or the frontend** |
| `GEMINI_MODEL` | `gemini-3.8-flash` | The team's target model. **Set to `gemini-3.5-flash-lite` for now** in Infisical dev `/backend`, because 3.8 is overloaded (see [Gemini capacity](#2-gemini-capacity-and-free-tier-quota)). Changing it is config only, but it invalidates the cache |
| `AI_ALLOW_PRIVATE_REPOS` | `false` | **Keep false on the free tier** (see [Safety rules](#safety-rules)) |
| `AI_TIMEOUT_SECONDS` | `45` | Per request |
| `AI_MAX_OUTPUT_TOKENS` | `4096` | Gemini's "thinking" counts against this, so don't lower it much |
| `AST_OUTPUT_DIR` | empty | Folder of AST JSON files. Empty means the line-window fallback is used |

### Install and migrate

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt   # adds google-genai, xhtml2pdf, pypdf, Jinja2 and their dependencies
.\.venv\Scripts\python.exe -m alembic upgrade head              # creates ai_explanations (revision 20261104_0007)
```

The dev database already has the migration (run on 2026-11-04, with the DB owner's OK).

### Running with Infisical on Windows

The PowerShell `infisical` shim sometimes prints nothing. If so, call the exe directly:

```powershell
& "$env:APPDATA\npm\node_modules\@infisical\cli\bin\infisical.exe" run --env=dev --path=/backend -- <command>
```

If it warns "serving secrets from last successful fetch", run `infisical login` again; until you do, newly added secrets won't appear.

---

## Using it

### In the app

- **Explain a finding:** open any finding (finding detail modal), then click **Explain with AI**.
  - You'll see: summary, why it matters, fix steps, "Suggested change, not applied" (with Copy), and caveats.
  - The header shows the model, "read `<function>`" when AST context was used, and "cached" when served from the cache.
- **Summarise a scan:** on the Analysis page, with a finished scan selected, click **Summarise with AI**. Clicking `[F1]`-style references opens that finding.
- **Download the report:** on the Analysis page, click **Download Report (PDF)**.
- All AI text is rendered as plain text, never as HTML.

### Warming the cache (before a demo)

The free tier is slow and rate-limited, so fill the cache well before a demo. The demo then runs entirely from the cache.

```powershell
cd backend
<infisical run ...> .\.venv\Scripts\python.exe -m app.ai.warm_cache <scan id or unique prefix> [--limit 10]
```

- It explains the top findings (in the same order the summary uses), then the scan summary.
- It pauses 20 s between new answers and **stops at the first rate-limit error** so it doesn't burn quota. Run it again later and it picks up where it left off; cached answers are skipped.
- Exit codes: `0` all answers validated; `1` some fell back or the quota was hit; `2` AI is blocked for the scan (off, private repo) or the scan wasn't found or isn't finished.
- After warming, the PDF report includes those answers automatically.

---

## Safety rules

| Rule | How it's enforced |
|---|---|
| Users only see AI output for their own scans | Every endpoint uses the same ownership check as the scan API; the finding must belong to that scan; otherwise 404. Cache entries are never shared across projects |
| Secrets never reach Gemini | Secret findings send no code; every piece of text is redacted; tests check the exact request for planted secrets |
| Repository content can't steer the model | Untrusted tags, no tools, schema-only output, post-validation, plain-text rendering |
| Private code isn't sent on the free tier | If the repo is private and `AI_ALLOW_PRIVATE_REPOS=false`, the fallback is returned with no call. Google's unpaid terms allow use of submitted content for product improvement and human review |
| The app works with AI off | `AI_ENABLED=false` hides the buttons; the report shows "This report contains no AI-generated text." |
| The key stays on the server | Read from Infisical; `/api/ai/status` only says whether AI is on |
| The AI doesn't decide severity or counts | Severity, counts and engine coverage come from the database; the model only explains |

---

## What was built: file by file

### Backend: new

| File | Purpose |
|---|---|
| `app/ai/schemas.py` | `FindingContext`, `CodeContext`, `FindingExplanation`, `ScanSummary` |
| `app/ai/redaction.py` | Masks tokens and Gitleaks-flagged lines |
| `app/ai/ast_adapter.py` | Reads AST JSON and finds the smallest function/class containing the finding (see [AST hookup](#1-ast-hookup-team)) |
| `app/ai/context.py` | Builds `FindingContext` (AST or 15-line window, max 80 lines); picks the top findings for the summary |
| `app/ai/prompts.py` | System prompt, three task variants, worked examples, response schemas, `PROMPT_VERSION = "finding-v1"`, `SUMMARY_PROMPT_VERSION = "summary-v1"` |
| `app/ai/gemini_client.py` | `google-genai` wrapper: timeout, one retry, maps errors to `TIMEOUT`, `RATE_LIMITED`, `PROVIDER_ERROR`, `REFUSED`, `TRUNCATED` |
| `app/ai/fake_client.py` | Scripted client for tests; tests never call the network |
| `app/ai/validate.py` | Post-answer checks |
| `app/ai/fallback.py` | Standard (non-AI) guidance |
| `app/ai/service.py` | Ties it together: gate (AI on, key set, repo public) → context → prompt → call → validate → repair → cache. Also the read-only cache lookups the report uses |
| `app/ai/warm_cache.py` | The cache-warming command |
| `app/api/ai.py` | AI endpoints |
| `app/api/reports.py` | Report endpoints |
| `app/reports/builder.py`, `renderer.py`, `templates/report.html` | The report |
| `alembic/versions/20261104_0007_ai_explanations.py` | The cache table |

### Backend: changed

| File | Change |
|---|---|
| `app/core/config.py` | The AI and AST settings above |
| `app/models/models.py` | `AIExplanation` model |
| `app/api/__init__.py` | Registers the AI and report routers |
| `app/main.py` | CORS exposes `Content-Disposition`, so the frontend can read the PDF filename |
| `requirements.txt` | `google-genai`, `xhtml2pdf`, `pypdf`, `Jinja2` and their dependencies |
| `.env.example` | AI and AST settings, with safe defaults |

### Frontend

| File | Purpose |
|---|---|
| `components/ai/AIExplanationPanel.tsx` | Explain with AI panel: loading, answer, fallback note, Retry |
| `components/ai/AISummaryCard.tsx` | Scan summary card with clickable finding references |
| `components/ai/aiReasons.ts` | Plain-language text for each fallback reason; which ones are retryable |
| `hooks/useAIStatus.ts` | Fetches `/api/ai/status` once and shares it |
| `components/findings/FindingDetailModal.tsx` | Shows the AI panel. Also fixed pre-existing React hook-order lint errors |
| `pages/AnalysisPage.tsx` | Summary card, Download Report button, opening a finding from a summary reference |
| `services/api.ts`, `types/index.ts` | API calls and types; PDF downloads as a blob with the auth token |

---

## API endpoints

All require the normal login token. Another user's scan or finding returns 404.

| Method and path | Returns |
|---|---|
| `GET /api/ai/status` | `enabled` (AI on and key set), `model`, `private_repos_allowed` |
| `POST /api/scans/{scan_id}/findings/{finding_id}/explain` | `status` (`VALIDATED` or `FALLBACK`), `reason` if fallback, the explanation, model, `cached`, `code_source` (`ast` / `lines`), commit SHA |
| `POST /api/scans/{scan_id}/ai-summary` | Summary plus `refs` mapping `F1`… to finding IDs. 409 if the scan isn't finished |
| `GET /api/scans/{scan_id}/report.html` | The report as HTML. 409 if the scan isn't finished |
| `GET /api/scans/{scan_id}/report.pdf` | The report as a PDF download |

**Fallback reasons:** `AI_DISABLED`, `NOT_CONFIGURED`, `PRIVATE_REPO`, `NO_OPEN_FINDINGS`, `REFUSED`, `TRUNCATED`, `TIMEOUT`, `RATE_LIMITED`, `PROVIDER_ERROR`, `INVALID_OUTPUT`. Of these, `TIMEOUT`, `RATE_LIMITED` and `PROVIDER_ERROR` show a Retry button.

---

## Database

One new table, `ai_explanations` (migration `20261104_0007`). It is a cache only: deleting its rows loses nothing but saved answers.

| Column | Notes |
|---|---|
| `id`, `project_id`, `scan_id`, `finding_id` | `finding_id` is null for a scan summary; all cascade on delete |
| `kind` | `FINDING_EXPLANATION` or `SCAN_SUMMARY` |
| `cache_key` | Unique. sha256 of kind, target, prompt version, model and the full prompt |
| `prompt_version`, `model`, `served_model` | `served_model` is what Google actually ran (it can differ, e.g. 3.5 served as 3.6) |
| `response_json` | The validated answer only. Prompts and code are never stored |
| `input_tokens`, `output_tokens`, `thought_tokens`, `latency_ms`, `created_at` | Usage, for cost tracking |

**If you change a prompt**, bump `PROMPT_VERSION` or `SUMMARY_PROMPT_VERSION` in `prompts.py`. Old answers then stop being used automatically.

---

## Testing

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/ai tests/reports    # 118 pass
.\.venv\Scripts\python.exe -m pytest                           # full suite

cd ..\frontend
npm run build
npm run lint                                                   # no errors; 4 old warnings in untouched files
```

### What the tests cover

- Context for SAST, dependency and secret findings, including line windows at the start and end of a file and a missing file.
- Planted secrets never appear in the exact request sent to the model.
- Prompt injection text in code stays inside the untrusted block.
- Invalid answers: one repair, then fallback; an invented CVE or reference is rejected.
- Every provider failure maps to the right fallback with no repair.
- AI off, private repo and missing key mean no call.
- Ownership: another user gets 404, and a finding from another scan gets 404.
- Cache: hit on the second call; never shared across projects; stale prompt version, model or code context isn't used.
- The AST adapter against the teammate's JSON format.
- Report: failed engine shows as failed; `<script>` in titles and in AI text is escaped; the PDF is valid; the report never calls the model; AI-off reports say so.
- `warm_cache`: fills what the report reads, skips cached answers, stops at a rate limit.

### Known failures unrelated to this work

The full backend suite has 7 failures that existed before this work and are outside it:

- **5 CodeQL and engine-registry tests:** `test_codeql_engine` ×2, `test_multi_engine_integration`, `test_codeql_mapper` ×2.
- **Semgrep timing tests** in `test_semgrep_performance.py`: these depend on machine speed, and which ones fail changes from run to run.

---

## Live test results

Run on 2026-11-04 against real dev scans of the public testbed repos (`amansatya/arve-testbed-js`, `amansatya/arve-testbed-python`).

**Checked end to end with AI off:** the status endpoint, the PDF download (about 50 KB, correct filename) and fallbacks for explain and summary all worked.

**With Gemini:**

| Model | Result |
|---|---|
| `gemini-3.8-flash` (team choice) | 503 "This model is currently experiencing high demand" on every try, for hours. On the first key it then hit 429 "You exceeded your current quota" |
| `gemini-3.7-flash` | 503, same as 3.8 |
| `gemini-3.5-flash` (served as 3.6) | Works, but partly overloaded and rate-limited on the free tier |
| `gemini-3.5-flash-lite` | Answered on the first try, and the answer passed validation (one call, CodeQL command injection in `src/routes/convert.ts`). No "thinking" tokens; about 1,700 in / 240 out, 14 s. **Chosen for now** (see [Gemini capacity](#2-gemini-capacity-and-free-tier-quota)) |

The flash-lite answer was specific to the code. It named `req.query.format` and the database filename as the attacker-controlled inputs, and suggested replacing `exec` with `execFile` and an argument array. It recommended an allowlist for the format, and added a caveat that ARVE couldn't verify whether the filename can be influenced. Only one call was made, so the team should still look over more of its answers after warming the cache.

The 3.5 flash answers that did come back were good:

- **Private key in `config/export-key.js`:** correct steps (rotate, remove, purge from history, load from env), `process.env.PRIVATE_KEY` as the suggested change, and an honest caveat that ARVE can't tell whether the key is still active.
- **Flask advisory:** the exact version, the real risk (a caching proxy serving one user's response to another), the upgrade, and caveats on what ARVE didn't check.
- **JS scan summary:** correct priorities (command injection, code injection, SSRF, prototype pollution, path traversal) with the right upgrade versions.

Typical cost per answer: about 1,000–1,700 input tokens, 200–500 output tokens and about 1,000 "thinking" tokens; 10–20 s.

In every failure case the app showed standard guidance with Retry, as designed.

---

## Open items for the team

### 1. AST hookup (team)

**What's done:** `app/ai/ast_adapter.py` already reads the AST format ("ARVE Tree-sitter AST", `schema_version` 1.x). It was checked against the sample file (173 files, 507 symbols, parsed in 0.12 s) and has tests. The 5 MB sample file has been removed from this folder and is not committed; ask the AST owner for a fresh one if needed.

**How it works:** for a SAST finding, the adapter loads the AST file for the scan once (kept in memory per analysis run) and picks the **smallest** function or class whose lines contain the finding, so you get the method, not the whole class. We then read that code ourselves from `RepositoryFile.content` and redact it. Methods are named `Class.method`. Callers and imports are sent as names only (max 10). Functions over 80 lines fall back to a line window but keep the function name.

**What's needed:**

1. **Set `AST_OUTPUT_DIR`** (in Infisical or `.env`) to the folder holding the AST output. The backend process must be able to read it.
2. **Name the files** `<analysis_run_id>.json` (preferred) or `<commit_sha>.json`. The adapter tries both, in that order.
3. **Ask the AST owner to add `commit_sha`** (ideally also ARVE's `analysis_run_id`) to the `analysis` block. Today the file only has `source_revision`, a content hash, so a stale file can't be detected.
4. **Check it on a real scan:** explain a SAST finding, and the panel header should say "read `<function name>`". The API returns `code_source: "ast"`.

**If any of this is missing, nothing breaks.** The adapter returns nothing and the 15-line window is used. It also falls back when:

- the file is missing or can't be parsed;
- the schema major version isn't 1;
- the finding's file had a syntax error or timed out in the AST run;
- the language isn't one of PHP, Java, TypeScript, JavaScript, Go or Python;
- no function contains the finding (top-level code).

### 2. Gemini capacity and free-tier quota

**What's wrong:** not our code. `gemini-3.8-flash` is overloaded on Google's side (503), and the free tier allows only a handful of requests per minute (we hit 429 after about 6 requests in 3 minutes) plus a daily cap. All testers share one Google project's quota.

**Current model: `gemini-3.5-flash-lite`.** On 2026-11-04 the team switched to `GEMINI_MODEL=gemini-3.5-flash-lite`. It answered first time, and its answer passed validation. It doesn't use "thinking" tokens, so it is quicker and uses fewer output tokens than flash. This is temporary: the code default stays `gemini-3.8-flash` (the team's choice). `gemini-3.5-flash` also works, but was mostly overloaded in testing.

**Check where the setting lives:** `GEMINI_MODEL` must be set in Infisical dev **`/backend`**, the path the backend reads. If it's missing there, the backend silently uses the 3.8 default. Confirm with `GET /api/ai/status`: its `model` field should say `gemini-3.5-flash-lite`.

**What to do:**

- **Before any demo:** run `python -m app.ai.warm_cache <demo scan>` once the quota has reset, ideally the day before. The daily quota resets at midnight Pacific time (about 1:30 pm IST). The demo then makes no live calls.
- **Don't change the model between warming the cache and the demo.** Answers are cached per model: answers made with 3.5 flash-lite aren't used under 3.8, and vice versa.
- **To go back to 3.8** once Google's capacity recovers, set `GEMINI_MODEL=gemini-3.8-flash` in Infisical, restart the backend, and warm the cache again. Test with one click first, to make sure it no longer returns 503.
- **Don't script repeated calls** (loops or retries). They use up the shared quota. The app already retries once.
- **A paid tier** on the Google project would remove the rate limit. That would also be the point to consider `AI_ALLOW_PRIVATE_REPOS=true`, after checking Google's paid terms.
- **Not done yet because of this:** prompt tuning on a large set of live answers, and the full in-app walk-through with live answers. If prompts change after tuning, bump `PROMPT_VERSION`.

### 3. Smaller items

- **Demo script and dry run:** pick the demo repo and scan, warm the cache, then run the full flow twice: once with AI on, once with `AI_ENABLED=false`.
- **Google terms:** unpaid Gemini requires users to be 18+ and to use it for professional purposes. Confirm this fits the testers.
- **Severity of Gitleaks findings** is always `MEDIUM` in the existing mapper; the AI does not change it.
- **Code-splitting warning:** the frontend build prints a large-chunk warning; it was there before and is harmless.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| No AI buttons in the app | `AI_ENABLED` isn't true, or `GEMINI_API_KEY` is missing. Check `GET /api/ai/status`. Restart the backend after changing Infisical |
| New Infisical secret not visible | The CLI is serving cached secrets. Run `infisical login` |
| "The AI service returned an error." (`PROVIDER_ERROR`) | Usually Google's 503 overload. Retry later or switch `GEMINI_MODEL` |
| "The AI service is busy right now." (`RATE_LIMITED`) | Free-tier quota (429). Wait a minute (per-minute limit) or until the next day, Pacific time (daily limit) |
| `TRUNCATED` | The answer hit `AI_MAX_OUTPUT_TOKENS`; Gemini's thinking uses part of it. Keep it at 4096 or higher |
| `INVALID_OUTPUT` | The answer failed validation twice (e.g. invented a CVE). The fallback is correct to show; if frequent, tune the prompt and bump `PROMPT_VERSION` |
| `PRIVATE_REPO` | Working as intended on the free tier |
| Report has no AI sections | Nothing cached for this scan under the current model and prompt version. Run `warm_cache` |
| PDF downloads as `arve-report-<id>.pdf` instead of the full name | The backend isn't exposing `Content-Disposition`; check the CORS change in `app/main.py` is deployed |

---

## Other documents in this folder

| File | What it is |
|---|---|
| `plan.md` | The demo plan this work followed: phases, decisions and risks |
| `ARVE_AI_Security_Assistant_Implementation_Plan.md` | The earlier, full-scope AI plan (judged too large for the demo) |
| `ARVE_Security_Audit_Report_Implementation_Plan.md` | The earlier, full-scope report plan |
| `ARVE_AST_Integration_Readiness_and_Transition_Plan.md` | AST integration plan |
