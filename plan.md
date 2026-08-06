# ARVE — Development Plan

> **Adaptive Remediation & Verification Engine**
> Browser-independent web application security analysis, remediation, and verification platform.

---

## 1. Project Overview

ARVE is a security platform designed to help developers identify, understand, remediate, and verify vulnerabilities in web applications they own.

The platform combines two independent security analysis approaches:

1. **Static Security Analysis** — analyzes the application's source code.
2. **Dynamic Security Analysis** — performs controlled security testing against the verified deployed application.

ARVE correlates findings from both engines to identify the probable source-code location responsible for a runtime vulnerability.

After detection, ARVE provides remediation guidance. Once the developer applies and deploys a fix, ARVE reruns the relevant security test to determine whether the vulnerability has actually been resolved.

### Core Workflow

```text
Authorize
    ↓
Connect Repository + Deployment
    ↓
Static Code Analysis
        +
Dynamic Security Analysis
    ↓
Correlate Findings
    ↓
Identify Root Cause
    ↓
Recommend Fix
    ↓
Developer Applies Fix
    ↓
Retest
    ↓
Verify
    ↓
Report
```

---

# 2. Design Principles

ARVE will follow six core principles.

### 2.1 Authorized Testing Only

Active security testing must never run against an unverified target.

### 2.2 Browser Independence

The ARVE Core must not depend on Chrome, Firefox, Edge, or any browser extension.

Clients communicate with ARVE through APIs.

### 2.3 LLM Independence

Core vulnerability detection must function without an external LLM.

The LLM is an optional enhancement for:

* explanations;
* remediation guidance;
* framework-specific recommendations;
* code-fix suggestions.

### 2.4 Evidence-Based Findings

Every reported vulnerability must contain technical evidence explaining why ARVE generated the finding.

### 2.5 Human-Controlled Remediation

ARVE does not automatically modify or deploy production code in Version 1.

Developers remain responsible for reviewing and applying fixes.

### 2.6 Verification After Remediation

A vulnerability is not considered resolved merely because a fix was suggested.

ARVE must retest the vulnerability after deployment.

---

# 3. High-Level Architecture

```text
                  ┌──────────────────┐
                  │      USER        │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │    ARVE UI       │
                  │   React / TS     │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │   FastAPI API    │
                  └────────┬─────────┘
                           │
                    GitHub Login
                           │
                           ▼
                  ┌──────────────────┐
                  │ ARVE PROJECT     │
                  │                  │
                  │ Repository       │
                  │       +          │
                  │ Deployment URL   │
                  └────────┬─────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
      ┌──────────────────┐   ┌──────────────────┐
      │ STATIC ANALYSIS  │   │ DYNAMIC ANALYSIS │
      │                  │   │                  │
      │ AST              │   │ Discovery        │
      │ Rules            │   │ Security Tests   │
      │ Data Flow        │   │ Evidence         │
      │ Taint Analysis   │   │                  │
      └────────┬─────────┘   └────────┬─────────┘
               │                      │
               └──────────┬───────────┘
                          ▼
               ┌─────────────────────┐
               │ CORRELATION ENGINE  │
               └──────────┬──────────┘
                          │
                          ▼
                   Security Finding
                          │
                          ▼
               ┌─────────────────────┐
               │ REMEDIATION ENGINE  │
               │                     │
               │ Rules               │
               │       +             │
               │ Optional LLM        │
               └──────────┬──────────┘
                          │
                          ▼
                  Developer Fixes
                    Application
                          │
                          ▼
               ┌─────────────────────┐
               │ VERIFICATION ENGINE │
               │      RETEST         │
               └──────────┬──────────┘
                          │
                    ┌─────┴─────┐
                    ▼           ▼
                  FIXED       FAILED
                    │
                    ▼
               REPORTING ENGINE
```

---

# 4. Recommended Technology Stack

## Frontend

* React
* TypeScript
* Tailwind CSS

## Backend

* Python
* FastAPI
* Pydantic
* SQLAlchemy

## Database

Development:

* SQLite

Deployment:

* PostgreSQL

## Authentication / Repository Integration

* GitHub OAuth — user authentication
* GitHub App — controlled repository access

## Static Analysis

* Tree-sitter
* Custom ARVE security rules
* Custom source/sink analysis
* Custom lightweight taint tracking

Optional supporting tools:

* Semgrep
* CodeQL

## Dynamic Analysis

* Python `httpx`
* BeautifulSoup
* Playwright where browser execution is required

## AI

Optional external LLM API.

The system must remain functional if no AI API is configured.

## ML

* scikit-learn

ML will initially be used for finding prioritization rather than primary vulnerability detection.

## Reporting

* OpenPyXL
* ReportLab

---

# 5. Proposed Repository Structure

```text
arve/
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   └── services/
│
├── backend/
│   └── app/
│       │
│       ├── api/
│       ├── auth/
│       ├── github/
│       │
│       ├── projects/
│       │
│       ├── static_analysis/
│       │   ├── parser/
│       │   ├── ast/
│       │   ├── routes/
│       │   ├── rules/
│       │   ├── dataflow/
│       │   └── taint/
│       │
│       ├── dynamic_analysis/
│       │   ├── discovery/
│       │   ├── scanner/
│       │   ├── checks/
│       │   └── evidence/
│       │
│       ├── correlation/
│       │
│       ├── remediation/
│       │
│       ├── verification/
│       │
│       ├── ai/
│       │
│       ├── ml/
│       │
│       ├── reports/
│       │
│       └── models/
│
├── tests/
│
├── docs/
│
├── plan.md
└── README.md
```

---

# PHASE 1 — Platform Foundation & GitHub Integration

## Objective

Build ARVE's core platform and connect developer identities and repositories through GitHub.

## 1.1 Backend Foundation

Create FastAPI application.

Implement:

* configuration management;
* database connection;
* error handling;
* API versioning;
* logging;
* project models.

Initial API:

```text
/api/v1/auth
/api/v1/projects
/api/v1/repositories
/api/v1/targets
```

---

## 1.2 GitHub Authentication

Implement:

```text
User
 ↓
Sign in with GitHub
 ↓
GitHub OAuth
 ↓
ARVE User
```

Store only required GitHub identity information.

---

## 1.3 Repository Authorization

Use a GitHub App for repository access.

The user selects which repository ARVE may access.

```text
GitHub Account
      ↓
Install ARVE GitHub App
      ↓
Select Repository
      ↓
Grant Access
      ↓
Repository Connected
```

Avoid requesting unnecessary account-wide repository permissions.

---

## 1.4 ARVE Project

An ARVE project represents:

```text
Project
│
├── GitHub Repository
├── Selected Branch
├── Deployment URL
├── Verification Status
├── Scan History
└── Findings
```

### Phase 1 Deliverable

The user can:

> **Sign in with GitHub → select repository → create ARVE project → connect deployed URL.**

---

# PHASE 2 — Target Authorization & Scope Control

## Objective

Ensure active testing can only occur against verified deployments.

## 2.1 Ownership Challenge

Generate a random verification token.

Example:

```text
arve-verification=7bd3f92...
```

For the MVP, support:

```text
/.well-known/arve-verification.txt
```

The developer deploys the token.

ARVE requests the file and verifies it.

---

## 2.2 Verification State

Possible states:

```text
UNVERIFIED
     ↓
VERIFYING
     ↓
VERIFIED
```

Failed verification returns:

```text
VERIFICATION_FAILED
```

---

## 2.3 Scope Enforcement

Before every active security request:

```text
Is user authenticated?
        ↓
Is target verified?
        ↓
Is hostname authorized?
        ↓
Is URL within project scope?
        ↓
Is requested operation permitted?
        ↓
Rate limit satisfied?
        ↓
ALLOW
```

Any failure results in:

```text
DENY
```

### Phase 2 Deliverable

Only verified deployments can enter ARVE's active security pipeline.

---

# PHASE 3 — Static Security Analysis Engine

## Objective

Build ARVE's primary code-analysis machinery without depending on an LLM.

This is one of the project's major technical components.

---

## 3.1 Repository Preparation

After repository authorization:

```text
Repository
     ↓
Fetch Source
     ↓
Ignore irrelevant files
     ↓
Detect Languages
     ↓
Detect Framework
```

Ignore:

```text
node_modules/
dist/
build/
.git/
coverage/
images/
generated files
binary files
```

---

## 3.2 Language Support

MVP:

* JavaScript
* TypeScript

Secondary target:

* Python

Future:

* Java

Do not attempt every language initially.

---

## 3.3 AST Generation

Use Tree-sitter to convert source code into Abstract Syntax Trees.

```text
Source Code
     ↓
Tree-sitter
     ↓
AST
     ↓
ARVE Analysis
```

Extract:

* functions;
* imports;
* function calls;
* variables;
* assignments;
* route declarations;
* database calls;
* input sources;
* security-sensitive functions.

---

## 3.4 Route Mapping

Identify routes from source code.

Examples:

```text
Express
router.get("/users/:id")

Next.js
app/api/users/[id]/route.ts

FastAPI
@app.get("/users/{id}")
```

Produce:

```text
Route
 ↓
Source File
 ↓
Handler
 ↓
Functions Called
```

Example:

```text
GET /api/users/{id}
        ↓
routes/users.ts
        ↓
getUser()
        ↓
UserService
        ↓
Database
```

---

## 3.5 Security Rule Engine

Implement ARVE security rules.

Initial rule categories:

```text
Injection
Secrets
Authentication
Authorization
Cryptography
Input Validation
Configuration
Dangerous Functions
```

Each rule contains:

```text
Rule ID
Category
Language
Framework
Source Pattern
Sink Pattern
Sanitizer Pattern
Severity
Description
```

---

## 3.6 Source-Sink Analysis

Identify potentially dangerous data flows.

```text
SOURCE
User-controlled data

      ↓

VARIABLES / FUNCTIONS

      ↓

SINK
Security-sensitive operation
```

Example:

```text
req.query.id
      ↓
userId
      ↓
query
      ↓
db.query()
```

---

## 3.7 Lightweight Taint Tracking

Mark user-controlled data as:

```text
TAINTED
```

Track it through:

* assignments;
* variables;
* simple function calls;
* return values.

If tainted data reaches a sensitive sink without recognized sanitization:

```text
Potential Finding
```

Do not attempt full interprocedural compiler-grade taint analysis in V1.

---

## 3.8 Static Finding

Output:

```text
Finding ID

Rule ID

File

Line

Source

Sink

Data Flow

Severity

Confidence

Evidence
```

### Phase 3 Deliverable

ARVE can independently analyze a repository and identify supported security patterns **without calling an LLM**.

---

# PHASE 4 — Dynamic Red Team Engine

## Objective

Analyze the verified deployed application and collect runtime security evidence.

---

## 4.1 Application Discovery

Crawler discovers:

* pages;
* endpoints;
* forms;
* parameters;
* APIs;
* cookies;
* authentication surfaces.

Stay strictly within authorized scope.

---

## 4.2 Dynamic Attack Surface

Produce:

```text
Deployment
│
├── Routes
├── API Endpoints
├── Forms
├── Parameters
├── Cookies
└── Headers
```

---

## 4.3 Initial Security Checks

Start with a small set.

### Configuration

* security-related configuration;
* cookie attributes;
* exposed debugging information.

### Input Handling

* unsafe reflection indicators;
* input validation behaviour;
* controlled injection indicators.

### Authentication / Authorization

Add basic supported checks after the initial scanner is stable.

All active checks must be:

* authorized;
* scoped;
* rate limited;
* non-destructive.

---

## 4.4 Evidence Collection

Store:

```text
Request metadata

Response metadata

Endpoint

Parameter

Observed behaviour

Timestamp

Test ID
```

### Phase 4 Deliverable

ARVE can dynamically analyze an authorized deployment and produce evidence-backed findings.

---

# PHASE 5 — Static + Dynamic Correlation Engine

## Objective

Connect runtime vulnerabilities with probable source-code causes.

This is one of ARVE's strongest differentiators.

---

## 5.1 Endpoint Correlation

Dynamic scanner finds:

```text
POST /api/login
```

Static analyzer has:

```text
POST /api/login

↓

src/routes/login.ts

↓

loginHandler()
```

Match them.

---

## 5.2 Finding Correlation

Combine:

```text
Dynamic Finding

+

Static Finding

+

Route Mapping
```

Generate:

```text
Correlated Finding
```

Example:

```text
Potential Injection

Runtime:
POST /api/login

Static:
src/routes/login.ts:48

Flow:
req.body.username
      ↓
query
      ↓
db.query()

Confidence:
HIGH
```

---

## 5.3 Confidence Engine

Possible states:

```text
STATIC_ONLY

DYNAMIC_ONLY

STATIC + DYNAMIC
```

A finding supported by both engines receives greater confidence.

---

## Phase 5 Deliverable

ARVE can connect:

> **"The deployed application behaves insecurely"**

with:

> **"This code path is probably responsible."**

---

# PHASE 6 — Remediation Engine

## Objective

Help the developer fix confirmed vulnerabilities.

The remediation system should work in two modes.

---

## 6.1 Rule-Based Remediation

Security rules contain basic remediation guidance.

Example:

```text
Rule:
Unsafe SQL construction

Recommendation:
Use parameterized database queries.
```

This works without AI.

---

## 6.2 Optional AI Remediation

Only send relevant context to the LLM.

Never send the complete repository.

Input:

```text
Finding
+
Relevant source code
+
Data-flow path
+
Framework
+
Runtime evidence
```

Output:

```text
Explanation

Root cause

Suggested remediation

Optional code example
```

---

## 6.3 AI Cost Control

Implement:

```text
Result Cache
```

Hash:

```text
Finding
+
Relevant Code
+
Framework
```

If identical analysis already exists:

```text
Return Cached Result
```

Do not call the LLM again.

---

## 6.4 AI Optionality

If no API key exists:

```text
Static Analysis
      +
Dynamic Analysis
      +
Rule-Based Fix
```

still works.

AI adds:

```text
Better Explanation
+
Contextual Fix
```

but is not required.

### Phase 6 Deliverable

Every supported vulnerability receives remediation guidance without requiring continuous API spending.

---

# PHASE 7 — Remediation Verification Engine

## Objective

Verify whether the developer actually fixed the vulnerability.

No sandbox infrastructure is required in V1.

---

## 7.1 Developer Workflow

```text
Finding
    ↓
View Fix
    ↓
Developer Changes Code
    ↓
Commit / Deploy
    ↓
Click RETEST
```

---

## 7.2 Targeted Retest

ARVE retrieves the original:

```text
Finding

Test

Endpoint

Evidence
```

and reruns only the relevant security test.

---

## 7.3 Comparison

Compare:

```text
BEFORE

vs.

AFTER
```

Possible results:

```text
VERIFIED_FIXED

STILL_VULNERABLE

RETEST_FAILED
```

---

## 7.4 Verification History

Store:

```text
Finding

Original Result

Retest Result

Commit / deployment information

Timestamp

Evidence
```

### Phase 7 Deliverable

ARVE can demonstrate that a vulnerability was actually removed after remediation.

---

# PHASE 8 — ML Risk Prioritization

## Objective

Use machine learning to help developers determine which vulnerabilities should be addressed first.

ML does NOT replace static or dynamic vulnerability detection.

---

## Features

Potential inputs:

```text
Vulnerability category

Static confidence

Dynamic confidence

Source-to-sink distance

Authentication requirement

Endpoint sensitivity

Runtime anomaly

Potential data exposure
```

Output:

```text
Risk Priority
```

For example:

```text
92 → CRITICAL
74 → HIGH
48 → MEDIUM
21 → LOW
```

Begin with rule-based scoring.

Once sufficient labelled data exists, compare it with:

* Random Forest;
* Gradient Boosting.

### Phase 8 Deliverable

ARVE provides intelligent vulnerability prioritization.

---

# PHASE 9 — Reporting & Dashboard

## Objective

Turn ARVE findings into useful security documentation.

---

## Dashboard

Display:

```text
Security Score

Critical Findings

High Findings

Open Findings

Verified Fixes

Static Findings

Dynamic Findings

Correlated Findings
```

---

## Finding View

Each finding displays:

```text
Vulnerability

Severity

Confidence

Affected Endpoint

Affected Source File

Affected Lines

Data Flow

Runtime Evidence

Root Cause

Recommended Fix

Verification Status
```

---

## Reports

Generate:

* PDF
* Excel
* JSON

Include:

```text
Executive Summary

Target Information

Repository Information

Findings

Evidence

Remediation

Verification Results

Before vs After

Audit Trail
```

### Phase 9 Deliverable

ARVE produces professional security assessment reports.

---

# PHASE 10 — Evaluation, Extension & Finalization

## Objective

Evaluate ARVE scientifically and prepare the final major-project submission.

---

## 10.1 Test Environment

Create intentionally vulnerable applications containing known vulnerabilities.

Maintain ground truth:

```text
Vulnerability

Location

Expected Detection

Expected Remediation
```

---

## 10.2 Evaluation Metrics

Measure:

```text
Precision

Recall

F1 Score

False Positive Rate

Detection Time

Static Detection Rate

Dynamic Detection Rate

Correlation Accuracy

Verification Success Rate
```

---

## 10.3 Compare Analysis Modes

Evaluate:

```text
Static Only

Dynamic Only

Static + Dynamic
```

This provides useful research results.

---

## 10.4 Browser Extension

Only after ARVE Core works.

The extension provides:

```text
Current Project

Verification Status

Start Scan

Security Score

Findings

Open Dashboard
```

No critical scanning logic lives inside the extension.

---

## 10.5 Documentation

Prepare:

* README
* HLD
* LLD
* ER Diagram
* Sequence Diagram
* API Documentation
* Threat Model
* Test Documentation
* Research Report
* Patent prior-art analysis

---

# 6. Final ARVE Pipeline

```text
              GitHub Login
                   │
                   ▼
           Select Repository
                   │
                   ▼
          Connect Deployment
                   │
                   ▼
          Verify Ownership
                   │
                   ▼
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
 STATIC ANALYSIS        DYNAMIC ANALYSIS
        │                     │
        ▼                     ▼
      AST                 Discovery
        │                     │
      Rules              Security Tests
        │                     │
   Data Flow                Evidence
        │                     │
   Taint Analysis             │
        │                     │
        └──────────┬──────────┘
                   │
                   ▼
           CORRELATION ENGINE
                   │
                   ▼
             ROOT CAUSE
                   │
                   ▼
        REMEDIATION ENGINE
             │          │
             │          └── Optional LLM
             │
             ▼
        Suggested Fix
             │
             ▼
       Developer Applies
             │
             ▼
           Deploys
             │
             ▼
         TARGETED RETEST
             │
        ┌────┴────┐
        │         │
      FIXED     FAILED
        │         │
        ▼         ▼
     VERIFIED   REOPEN
        │
        ▼
      REPORT
```

---

# 7. MVP Definition

ARVE V1 will be considered successful when it can:

* authenticate users through GitHub;
* access an explicitly selected repository;
* verify ownership of its deployed website;
* parse JavaScript/TypeScript source code;
* build basic endpoint-to-code mappings;
* execute custom static security rules;
* perform lightweight source-to-sink analysis;
* perform authorized dynamic security checks;
* correlate static and dynamic findings;
* identify probable vulnerable source locations;
* provide rule-based remediation;
* optionally enhance remediation through an LLM;
* retest vulnerabilities after developer remediation;
* mark findings as fixed or unresolved;
* generate a security report.

---

# 8. Features Explicitly Deferred

The following are NOT required for V1:

```text
Automatic production code modification
Automatic pull requests
Automatic deployment
Docker sandbox per scan
Full interprocedural taint analysis
Whole-repository LLM analysis
Autonomous AI agents
GPU-hosted LLM
Kubernetes
Distributed scanning
Enterprise-scale DAST
Every programming language
Every OWASP vulnerability
```

These belong in future work.

---

# 9. Recommended Development Order

```text
PHASE 1
Foundation + GitHub
        ↓
PHASE 2
Authorization
        ↓
PHASE 3
Static Analysis
        ↓
PHASE 4
Dynamic Analysis
        ↓
PHASE 5
Correlation
        ↓
PHASE 6
Remediation
        ↓
PHASE 7
Verification
        ↓
PHASE 8
ML Prioritization
        ↓
PHASE 9
Reporting
        ↓
PHASE 10
Evaluation + Extension
```

The most important engineering milestone is:

> **Static Finding + Dynamic Finding → Correlated Source-Level Vulnerability → Remediation → Successful Retest**

If that pipeline works reliably, the core ARVE project is successful.

---

# 10. Final Project Positioning

ARVE should not be presented as another website health checker or browser auditing tool.

It should be positioned as:

> **A hybrid static and dynamic application-security platform that correlates runtime security findings with source-code data flows, assists developers with remediation, and verifies fixes through targeted post-deployment retesting.**

The browser extension is only an optional interface.

The security analysis, correlation, remediation, and verification logic belongs to the browser-independent ARVE Core.
