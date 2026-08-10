# ARVE --- AI Security Pattern & Attack Intelligence

## 1. Project Overview

**ARVE** is an AI-assisted cybersecurity platform that analyzes
AI-generated web applications, detects security vulnerabilities, learns
recurring vulnerability patterns across applications, and visualizes how
those weaknesses can combine into realistic attack paths.

### Core idea

> **ARVE learns how AI-generated code tends to become vulnerable,
> identifies those recurring security patterns in new applications, and
> reconstructs code-grounded attack paths from an external entry point
> to sensitive assets.**

ARVE is **not** intended to replace tools such as Semgrep, Gitleaks,
Trivy, or OWASP ZAP. Instead, it acts as an intelligence layer over
their findings.

------------------------------------------------------------------------

# 2. Core Product

ARVE has two major graph views.

## 2.1 Global Security Knowledge Graph

An Obsidian-style interactive graph representing relationships between:

-   AI-generated code patterns
-   Vulnerabilities
-   CWE classifications
-   Frameworks
-   Attack techniques
-   Endpoints
-   Assets
-   Security patterns
-   Projects

Example:

``` text
AI Pattern
    |
    v
Missing Authorization
    |
    +------> IDOR
    |
    +------> Privilege Escalation
                |
                v
          Data Exposure
```

Users can click a node to inspect the evidence and relationships behind
it.

## 2.2 Project Attack Graph

For a specific analyzed application, ARVE reconstructs an
application-specific attack path.

Example:

``` text
                    INTERNET
                        |
                        v
                 /api/users/:id
                        |
                 User-controlled ID
                        |
                        v
                 Missing Auth Check
                        |
                        v
                   User Query
                        |
                        v
                    MongoDB
                        |
                        v
                 Sensitive Data
```

Every important node should be traceable back to actual source code.

------------------------------------------------------------------------

# 3. High-Level Architecture

``` text
                    +---------------------+
                    |       Next.js       |
                    |     Web Client      |
                    +----------+----------+
                               |
                               v
                    +---------------------+
                    |       FastAPI       |
                    |     Core Backend    |
                    +----------+----------+
                               |
          +--------------------+--------------------+
          |                    |                    |
          v                    v                    v
  Repository Analyzer    Security Engine      ML/Pattern Engine
          |                    |                    |
          +--------------------+--------------------+
                               |
                               v
                    +---------------------+
                    | PostgreSQL + Neo4j  |
                    | Data + Knowledge    |
                    | Graph               |
                    +----------+----------+
                               |
                               v
                    +---------------------+
                    |    ARVE Web UI      |
                    | Dashboard + Graphs  |
                    +---------------------+
```

### Architectural principle

Use a **modular monolith**, not multiple microservices.

The initial system should consist of:

-   Next.js frontend
-   FastAPI backend
-   PostgreSQL
-   Neo4j
-   Docker Compose

No Kubernetes, queues, notification services, browser extensions, or
distributed microservices are required for the mini-project.

------------------------------------------------------------------------

# 4. Technology Stack

## Frontend

-   Next.js
-   TypeScript
-   Tailwind CSS
-   shadcn/ui
-   Interactive graph visualization library

## Backend

-   FastAPI
-   Python
-   Pydantic
-   SQLAlchemy

## Authentication

-   Firebase Authentication
-   GitHub sign-in

## GitHub Integration

Use a **GitHub App** for repository access rather than broad OAuth
repository permissions.

Firebase handles user identity/login while the GitHub App provides
controlled repository access.

## Security Analysis

Initial tools:

-   Semgrep
-   Gitleaks
-   Trivy
-   OWASP ZAP
-   Custom AST/data-flow analysis where required

## Data

-   PostgreSQL for application data and findings
-   Neo4j for the security knowledge graph

## ML

-   Python
-   sentence/code embeddings
-   HDBSCAN or K-Means
-   scikit-learn
-   optional XGBoost later for risk scoring

## AI

Use an LLM for:

-   interpreting clusters
-   naming security patterns
-   explaining findings
-   remediation recommendations
-   report generation

The LLM should **not** be the primary vulnerability detector.

------------------------------------------------------------------------

# 5. Phase Plan

------------------------------------------------------------------------

# Phase 0 --- Project Foundation

## Goal

Create the shared development environment and repository structure.

## Tasks

-   Create GitHub repository
-   Establish branch strategy
-   Create issue/project board
-   Create Next.js frontend
-   Create FastAPI backend
-   Configure PostgreSQL
-   Create Docker Compose
-   Configure environment variables
-   Establish frontend/backend API communication
-   Establish initial database migrations
-   Add basic CI

## Repository structure

``` text
ARVE/
├── frontend/
│   └── Next.js
│
├── backend/
│   ├── api/
│   ├── auth/
│   ├── repository/
│   ├── scanner/
│   ├── analyzer/
│   ├── ml/
│   ├── graph/
│   └── reports/
│
├── database/
│
├── docker-compose.yml
│
└── README.md
```

## Deliverable

A working local ARVE application:

``` text
Next.js
   |
   v
FastAPI
   |
   v
PostgreSQL
```

------------------------------------------------------------------------

# Phase 1 --- Authentication + GitHub Integration

## Goal

Allow users to sign in and connect a GitHub repository.

## Authentication flow

``` text
ARVE Web App (React)
 |
 v
Click "Continue with GitHub"
 |
 v
Firebase Auth SDK (signInWithPopup / GithubAuthProvider)
 |
 v
GitHub OAuth Authorize & User Consent
 |
 v
Firebase ID Token + GitHub OAuth Credential Issued
 |
 v
POST /api/auth/firebase (Bearer Firebase ID Token)
 |
 v
FastAPI Token Validation (firebase-admin / PyJWT with Google Public Keys)
 |
 v
Upsert User in PostgreSQL/SQLite (firebase_uid, github_id, email, avatar_url, github_access_token)
 |
 v
Issue ARVE Session Cookie & Redirect to Dashboard
```

## Setup & Configuration Steps

### 1. GitHub Developer Settings
- Register a new GitHub OAuth Application (or GitHub App).
- Set **Authorization callback URL** to:
  `https://arve-fe63b.firebaseapp.com/__/auth/handler`
- Save `Client ID` and `Client Secret`.


### 2. Firebase Console Configuration
- Go to [Firebase Console](https://console.firebase.google.com/) -> **Authentication** -> **Sign-in method**.
- Enable **GitHub** as a Sign-in Provider.
- Paste your GitHub OAuth Application's **Client ID** and **Client Secret**.
- Copy the provided OAuth redirect URL and verify it matches GitHub's callback URL.

### 3. Frontend Firebase SDK Integration
- Install `firebase` package (`npm install firebase`).
- Create `src/config/firebase.ts`:
  - Initialize Firebase App using `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
  - Export `auth` (`getAuth()`) and `githubProvider` (`new GithubAuthProvider()`).
  - Add OAuth scopes: `githubProvider.addScope('read:user')`, `githubProvider.addScope('user:email')`, `githubProvider.addScope('repo')`.
- In `useAuth.tsx`:
  - Trigger `signInWithPopup(auth, githubProvider)`.
  - Extract `OAuthCredential.accessToken` (GitHub OAuth access token) and `user.getIdToken()`.
  - Authenticate against FastAPI backend `/api/auth/firebase`.

### 4. Backend FastAPI Firebase Token Verification
- Install `firebase-admin` (or `pyjwt` with caching for `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`).
- Create `app/auth/firebase_auth.py`:
  - Verify Firebase ID token signature, issuer (`https://securetoken.google.com/<PROJECT_ID>`), and audience (`<PROJECT_ID>`).
  - Extract claims (`sub` -> `firebase_uid`, `email`, `name`, `picture`).
- Create endpoint `POST /api/auth/firebase`:
  - Verify ID Token.
  - Upsert user record into database.
  - Store `github_access_token` for downstream repository scanning APIs.
  - Set `access_token` HTTP-only cookie or return session token.

### User database schema

``` text
users
├── id (UUID string)
├── firebase_uid (Indexed, Unique)
├── github_id (Indexed, Unique)
├── username (GitHub login)
├── email (Unique)
├── avatar_url
├── github_access_token (Encrypted / Protected)
├── is_active (Boolean)
└── created_at (Timestamp)
```

### GitHub App / Scope Requirements

The GitHub integration requires read permissions for:
- Repository metadata (`read:user`, `user:email`)
- Repository contents (`repo` or GitHub App `contents:read`)

Avoid broad write permissions.

### Repository connection flow

``` text
Login via Firebase GitHub Auth
  |
  v
Dashboard
  |
  v
Fetch User Repositories (using stored github_access_token or GitHub App)
  |
  v
Select Repository
  |
  v
Save Repository to Database & Initialize Analysis
```

## Deliverable

A user can:

1. Sign in with GitHub using Firebase Authentication.
2. Access a protected ARVE dashboard verified via FastAPI.
3. Fetch and view accessible GitHub repositories.
4. Select and store a repository for analysis.

### Phase 1 stop condition

Do **not** begin ML, Neo4j, vulnerability scanning, or attack graphs until this Phase 1 Firebase + GitHub Auth flow works end-to-end.

------------------------------------------------------------------------

# Phase 2 --- Repository Intelligence

## Goal

Convert a GitHub repository into a machine-readable application model.

## Pipeline

``` text
GitHub Repository
       |
       v
Repository Ingestion
       |
       v
Language Detection
       |
       v
Framework Detection
       |
       v
Dependency Detection
       |
       v
File/Route/API Extraction
       |
       v
Application Model
```

## Extract

-   programming languages
-   frameworks
-   package managers
-   project structure
-   routes
-   API endpoints
-   authentication mechanisms
-   database usage
-   environment variables
-   dependencies
-   server/client boundaries
-   important functions
-   potential input sources
-   potential sinks

## Example application model

``` json
{
  "framework": "Next.js",
  "language": "TypeScript",
  "database": "MongoDB",
  "authentication": "NextAuth",
  "routes": [],
  "api_endpoints": [],
  "dependencies": [],
  "data_flows": []
}
```

## Deliverable

ARVE can ingest a GitHub repository and generate a structured
representation of the application.

------------------------------------------------------------------------

# Phase 3 --- Security Detection Engine

## Goal

Perform actual cybersecurity analysis.

ARVE should use established security tooling rather than attempting to
recreate mature scanners.

## Initial vulnerability families

Keep the scope narrow:

1.  Broken Access Control
2.  Injection
3.  Hardcoded Secrets
4.  Authentication Weaknesses
5.  Security Misconfiguration
6.  Vulnerable Dependencies

## Tools

``` text
Semgrep
Gitleaks
Trivy
OWASP ZAP
```

Plus custom AST/data-flow analysis where necessary.

## Normalized finding format

Every finding should contain:

``` text
Finding
├── id
├── vulnerability
├── CWE
├── severity
├── confidence
├── file
├── line
├── endpoint
├── code pattern
├── source
├── sink
├── evidence
└── scanner
```

## Example

``` text
ARVE-0017

Type:
Broken Access Control

CWE:
CWE-639

File:
src/api/users/[id].ts

Line:
42

Endpoint:
/api/users/:id

Evidence:
User-controlled ID reaches a database
lookup without an ownership check.
```

## Deliverable

ARVE scans a repository and produces reliable, structured findings with
source-code evidence.

------------------------------------------------------------------------

# Phase 4 --- ARVE Security Dataset

## Goal

Build the dataset that powers the ML/security-pattern component.

Do not depend on finding one perfect public dataset.

Build a combined corpus.

## Dataset source A --- Existing vulnerability datasets

Use established datasets such as:

-   OWASP Benchmark
-   NIST Juliet Test Suite
-   SARD
-   DiverseVul
-   Devign
-   CodeXGLUE vulnerability datasets

Use these primarily for security ground truth and initial model
development.

## Dataset source B --- AI-generated applications

Create standardized application-generation prompts.

Example:

``` text
Build a Node.js + Express REST API
for a document management system.

Requirements:
- User authentication
- User profiles
- File upload
- File download
- Admin dashboard
- MongoDB
```

Create around 30--50 application specifications covering:

-   authentication
-   e-commerce
-   banking
-   file sharing
-   social networks
-   education
-   HR
-   healthcare
-   admin portals
-   IoT dashboards

Generate implementations using multiple AI coding tools where possible.

Potential sources:

-   Claude
-   ChatGPT
-   Gemini
-   GitHub Copilot
-   Cursor

## Dataset source C --- Controlled vulnerability mutations

Take secure code and create controlled vulnerable variants.

Examples:

``` text
Secure:
ownership check present

Mutation:
ownership check removed

Label:
IDOR / Broken Access Control
```

``` text
Secure:
parameterized query

Mutation:
string concatenation

Label:
SQL Injection
```

``` text
Secure:
JWT signature verified

Mutation:
signature validation removed

Label:
Authentication weakness
```

This produces paired secure/vulnerable examples.

## Dataset record

Each record should contain:

``` text
project_id
ai_source
language
framework
file
line
code
data_flow
entry_point
sink
vulnerability
CWE
severity
attack_consequence
```

## Deliverable

An ARVE Security Pattern Corpus containing code patterns,
vulnerabilities, data flows, and consequences.

------------------------------------------------------------------------

# Phase 5 --- ML Security Pattern Engine

## Goal

Discover recurring security patterns rather than manually defining every
pattern.

## Pipeline

``` text
Security Finding
       |
       v
Structured Representation
       |
       v
Embedding
       |
       v
Vector Space
       |
       v
Clustering
       |
       v
Security Pattern
```

## Initial approach

Use:

-   code/security embeddings
-   HDBSCAN or K-Means
-   cosine similarity
-   scikit-learn

Do not train a massive neural network.

## Example

The model receives:

``` text
Missing ownership check
Direct resource lookup
User-controlled ID
No authorization middleware
```

The clustering engine groups similar findings.

ARVE then identifies:

``` text
PATTERN-014

Object-Level Authorization Weakness
```

## LLM role

Use an LLM after clustering.

ML:

> These samples are similar.

LLM:

> These samples appear to represent missing object-level authorization.

This separation keeps the architecture technically defensible.

## Deliverable

ARVE automatically discovers recurring security patterns from analyzed
applications.

------------------------------------------------------------------------

# Phase 6 --- Security Knowledge Graph

## Goal

Create the Obsidian-style global security graph.

## Nodes

``` text
AI_PATTERN
CODE_PATTERN
VULNERABILITY
CWE
FRAMEWORK
ATTACK_TECHNIQUE
ENDPOINT
ASSET
PROJECT
```

## Relationships

``` text
AI_PATTERN
    ├── resembles → CODE_PATTERN
    ├── associated_with → VULNERABILITY
    └── affects → FRAMEWORK

VULNERABILITY
    ├── maps_to → CWE
    ├── occurs_at → CODE
    └── enables → ATTACK

ATTACK
    ├── reaches → ASSET
    └── follows → ENDPOINT
```

## Neo4j

Use Neo4j as the graph database.

PostgreSQL remains responsible for normal application data.

FastAPI communicates with both.

## UI

Create an Obsidian-style graph where users can:

-   zoom
-   pan
-   search
-   filter by vulnerability
-   filter by framework
-   filter by pattern
-   click nodes
-   inspect relationships
-   navigate from a pattern to affected projects
-   navigate from a vulnerability to associated attacks

## Example

``` text
Authentication
       |
   +---+---+
   |   |   |
  IDOR JWT Session
   |   |   |
   v   v   v
 Data Auth Hijack
 Leak Bypass
```

## Deliverable

A global ARVE Security Knowledge Graph.

------------------------------------------------------------------------

# Phase 7 --- Project Attack Graph

## Goal

Use the global security intelligence to reconstruct an attack graph for
an individual application.

## Pipeline

``` text
Project
   |
   v
Application Model
   |
   v
Security Findings
   |
   v
Security Patterns
   |
   v
Attack Relationships
   |
   v
Project Attack Graph
```

## Example

``` text
                     INTERNET
                         |
                         v
                  /api/users/:id
                         |
                  User-controlled ID
                         |
                         v
                  Missing Auth Check
                         |
                         v
                    User Query
                         |
                         v
                     MongoDB
                         |
                         v
                  Sensitive Data
```

## Code grounding

Every important node must connect to actual code.

Click:

``` text
Missing Auth Check
```

and show:

``` text
src/controllers/users.ts

Lines 42–57

Finding:
Missing Object-Level Authorization

Matched Pattern:
ARVE-AUTH-014

Confidence:
93%

Similar projects:
27

CWE:
CWE-639
```

## Deliverable

ARVE reconstructs application-specific attack paths from external entry
points to vulnerable code and sensitive assets.

------------------------------------------------------------------------

# Phase 8 --- Risk Intelligence

## Goal

Prioritize vulnerabilities based on attack-path context rather than
treating every finding independently.

## Inputs

``` text
Vulnerability
+
Security Pattern
+
Application Context
+
Attack Path
+
Asset Sensitivity
+
Exploitability
```

## Risk model

``` text
Exploitability
       |
Attack Path
       |
Asset Sensitivity
       |
Pattern Context
       |
       v
ARVE Risk Score
```

Initially use a transparent weighted scoring system.

Later, optionally experiment with ML models such as XGBoost.

## Example

Instead of:

``` text
SQL Injection — High
```

ARVE should say:

``` text
CRITICAL PRIORITY

This vulnerability is part of an attack path
that begins at a public endpoint and reaches
a sensitive database.

Recommended action:
Fix before lower-priority findings.
```

## Deliverable

Context-aware vulnerability prioritization.

------------------------------------------------------------------------

# Phase 9 --- Final ARVE Dashboard

## Goal

Turn all components into a usable security product.

## Dashboard

``` text
ARVE

Security Score        64
Critical               2
High                   5
Medium                 9
Attack Paths           4
Pattern Matches       11
```

## Main pages

``` text
/dashboard
/repositories
/scan/:id
/findings
/attack-graph
/patterns
/knowledge-graph
/reports
/profile
```

## Scan page

Show:

-   scan status
-   repository
-   framework
-   languages
-   vulnerabilities
-   security score
-   attack paths
-   pattern matches

## Findings page

Filters:

-   severity
-   CWE
-   framework
-   file
-   vulnerability
-   pattern

## Attack graph page

Interactive project attack graph.

## Knowledge graph page

Global Obsidian-style ARVE intelligence graph.

## Pattern page

Show:

-   pattern description
-   frequency
-   affected frameworks
-   associated vulnerabilities
-   associated attacks
-   example code
-   related patterns

------------------------------------------------------------------------

# Phase 10 --- Security Audit Reports

## Goal

Generate a professional audit report from the collected evidence.

## Report structure

``` text
ARVE SECURITY AUDIT

1. Executive Summary

2. Application Overview

3. Attack Surface

4. Security Findings

5. Discovered Security Patterns

6. Critical Attack Paths

7. Risk Prioritization

8. Code Evidence

9. Remediation Recommendations

10. Security References
```

## Important rule

The report must be grounded in actual scanner evidence.

The LLM can:

-   summarize
-   explain
-   prioritize
-   recommend fixes
-   format the report

It should not invent vulnerabilities or evidence.

## Deliverable

Downloadable ARVE security audit.

------------------------------------------------------------------------

# Phase 11 --- Validation & Research Evaluation

## Goal

Make the project academically defensible.

Create a test set that the ML component has never seen.

## ML evaluation

Measure:

-   cluster purity
-   silhouette score
-   similarity precision
-   pattern retrieval accuracy

## Vulnerability evaluation

Measure:

-   Precision
-   Recall
-   F1 score

## Attack-path evaluation

Measure:

-   valid path rate
-   false path rate
-   missed path rate

## Baseline comparison

Compare:

``` text
Traditional scanner
        vs
Scanner + ARVE pattern intelligence
        vs
Scanner + pattern intelligence + attack graph
```

## Research question

> Can learned security-pattern relationships improve vulnerability
> prioritization by identifying multi-step attack paths in AI-generated
> web applications?

## Deliverable

A documented evaluation showing where ARVE improves over raw scanner
output.

------------------------------------------------------------------------

# 6. Team Division

## Member 1 --- Cybersecurity Lead

Owns:

-   OWASP/security methodology
-   vulnerability taxonomy
-   security rules
-   attack modeling
-   vulnerability validation
-   research evaluation

## Member 2 --- Security/Backend

Owns:

-   scanner orchestration
-   Semgrep
-   Gitleaks
-   Trivy
-   ZAP
-   repository analysis
-   AST/data-flow extraction

## Member 3 --- Backend/Auth

Owns:

-   FastAPI
-   Firebase Auth
-   GitHub App
-   user system
-   repository connection
-   PostgreSQL
-   API design

## Member 4 --- ML/Data

Owns:

-   dataset
-   data preprocessing
-   embeddings
-   clustering
-   pattern discovery
-   ML evaluation

## Member 5 --- Frontend

Owns:

-   Next.js
-   dashboard
-   scan UI
-   findings UI
-   pattern UI
-   graph visualization

## Member 6 --- Graph/DevOps/Integration

Owns:

-   Neo4j
-   graph schema
-   attack graph generation
-   Docker
-   CI/CD
-   integration
-   system testing

------------------------------------------------------------------------

# 7. Major Milestones

## Milestone 1

``` text
GitHub Login
     ↓
GitHub Repository
     ↓
Repository Selection
```

## Milestone 2

``` text
Repository
     ↓
Application Model
```

## Milestone 3

``` text
Application
     ↓
Security Findings
```

## Milestone 4

``` text
Findings
     ↓
Security Dataset
```

## Milestone 5

``` text
Dataset
     ↓
Learned Security Clusters
```

## Milestone 6

``` text
Security Clusters
     ↓
Obsidian-style Knowledge Graph
```

## Milestone 7

``` text
Application
     ↓
Project Attack Graph
```

## Milestone 8

``` text
Attack Graph
     ↓
Risk Prioritization
     ↓
Security Audit
```

## Milestone 9

``` text
Full ARVE
     ↓
Evaluation
     ↓
Demo + Report + Research
```

------------------------------------------------------------------------

# 8. Phase 1 Immediate Sprint

The first sprint should focus only on authentication and GitHub
integration.

``` text
[ ] Create ARVE GitHub repository
[ ] Create Next.js application
[ ] Create FastAPI application
[ ] Create PostgreSQL database
[ ] Configure Docker Compose
[ ] Create Firebase project
[ ] Enable Firebase Authentication
[ ] Enable GitHub authentication provider
[ ] Configure GitHub OAuth credentials
[ ] Implement GitHub login
[ ] Implement logout
[ ] Implement protected dashboard
[ ] Validate Firebase ID tokens in FastAPI
[ ] Create users table
[ ] Create GitHub App
[ ] Configure minimal repository permissions
[ ] Implement GitHub App installation flow
[ ] Fetch accessible repositories
[ ] Display repositories in dashboard
[ ] Allow repository selection
[ ] Store selected repository
```

### Phase 1 success condition

A user should be able to perform:

``` text
Open ARVE
   ↓
Login with GitHub
   ↓
Enter Dashboard
   ↓
Connect GitHub
   ↓
Select Repository
   ↓
See Repository Connected
```

Only after this works should the team move to repository ingestion.

------------------------------------------------------------------------

# 9. What We Explicitly Do NOT Build

To prevent scope explosion:

-   No Kubernetes
-   No microservice architecture
-   No browser extension
-   No custom Burp Suite replacement
-   No complete penetration-testing framework
-   No autonomous hacking agent
-   No automatic production remediation
-   No real-time SOC
-   No huge threat-intelligence platform
-   No custom foundation model
-   No massive neural network
-   No support for every programming language initially

The first supported ecosystem should ideally be:

``` text
TypeScript / JavaScript
+
Next.js / React / Node.js
+
MongoDB / PostgreSQL
```

Expand only after the core system works.

------------------------------------------------------------------------

# 10. Final Product Definition

## ARVE

**AI Security Pattern & Attack Intelligence**

### Input

``` text
GitHub repository
```

### Processing

``` text
Repository Analysis
        ↓
Security Scanning
        ↓
Finding Normalization
        ↓
Pattern Extraction
        ↓
ML Clustering
        ↓
Security Knowledge Graph
        ↓
Application Attack Graph
        ↓
Risk Analysis
```

### Output

``` text
Security Score
+
Vulnerability Findings
+
Learned Security Patterns
+
Global Security Knowledge Graph
+
Project-Specific Attack Graph
+
Code-Level Evidence
+
Risk Prioritization
+
Audit Report
```

### Core differentiator

> **ARVE does not merely identify vulnerabilities. It learns recurring
> security patterns in AI-generated code and connects those patterns to
> real application attack paths, allowing developers to understand not
> only what is vulnerable, but how an attacker could potentially chain
> those weaknesses together.**
