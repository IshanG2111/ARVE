# ARVE System Connections & Data Flow Architecture

This document provides visual flow diagrams and sequence mappings representing system connections, authentication flows, data ingestion pipelines, and attack graph synthesis within ARVE.

---

## 🗺 System Flow Overview

```text
+-----------------------------------------------------------------------------------+
|                                 ARVE WEB UI                                       |
|                  React 19 + Vite + TypeScript + Tailwind CSS                      |
+------------------------------------------+----------------------------------------+
                                           |
                                           | HTTP / REST API Calls
                                           v
+-----------------------------------------------------------------------------------+
|                               FASTAPI CORE BACKEND                                |
|                                                                                   |
|  +------------------+    +--------------------+    +---------------------------+  |
|  |  Authentication  |    | Repository Ingestion|    | Security Detection Engine |  |
|  |  Module (Firebase|    | & Analysis         |    | (Semgrep, Gitleaks, etc.) |  |
|  |  + JWT Cookies)  |    |                    |    |                           |  |
|  +--------+---------+    +---------+----------+    +-------------+-------------+  |
|           |                        |                             |                |
+-----------|------------------------|-----------------------------|----------------+
            |                        |                             |
            v                        v                             v
+-----------------------+  +--------------------+    +---------------------------+
| Firebase Auth Service |  | GitHub REST API    |    | Local Execution Environment|
| (OAuth Handler)       |  | (Repos, Contents)  |    | (Docker / CLI Scanners)   |
+-----------------------+  +--------------------+    +---------------------------+
            |                        |                             |
            +------------------------+-----------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------------+
|                                 DATA PERSISTENCE                                  |
|                                                                                   |
|    +----------------------------------+    +---------------------------------+    |
|    |      PostgreSQL / SQLite         |    |             Neo4j               |    |
|    | Application State & Scan Results |    | Global Security Knowledge Graph |    |
|    +----------------------------------+    +---------------------------------+    |
+-----------------------------------------------------------------------------------+
```

---

## 🔄 Flow 1: Authentication & User Session Sequence

```text
ARVE Client (React)             Firebase Auth               FastAPI Backend              Database (SQLite/PG)
     |                               |                             |                              |
     |--- 1. Click "GitHub Login" -->|                             |                              |
     |                               |                             |                              |
     |--- 2. OAuth Popup Handshake ->|                             |                              |
     |    (User approves on GitHub)  |                             |                              |
     |                               |                             |                              |
     |<-- 3. Firebase ID Token & ----|                             |                              |
     |    GitHub Access Token        |                             |                              |
     |                                                             |                              |
     |--- 4. POST /api/auth/firebase (ID Token & GH Token) ------->|                              |
     |                                                             |--- 5. Verify ID Token ------>|
     |                                                             |    (firebase_admin / certs) |
     |                                                             |                              |
     |                                                             |--- 6. Upsert User ---------->|
     |                                                             |    (firebase_uid, gh_token)  |
     |                                                             |<-- 7. User Saved ------------|
     |                                                             |                              |
     |<-- 8. Return Session Token & Set httpOnly Cookie -----------|                              |
     |                                                             |                              |
     |--- 9. GET /api/auth/me (Bearer Token / Cookie) ------------>|                              |
     |<-- 10. Authenticated User Profile --------------------------|                              |
```

---

## 📦 Flow 2: Repository Ingestion & Application Model Pipeline (Phase 2)

```text
User Selects GitHub Repo
          |
          v
GET /api/repositories/github/list
  (Uses stored GitHub Access Token)
          |
          v
Fetch Source Code Tree & File Contents
          |
          +-----------------------------------+
          |                                   |
          v                                   v
   Detect Languages                    Detect Frameworks
(TypeScript, Python, etc.)          (Next.js, FastAPI, Express)
          |                                   |
          +-----------------+-----------------+
                            |
                            v
              Extract Routes & Endpoints
            (e.g., /api/users/:id, /login)
                            |
                            v
              Generate Application Model JSON
      {
        "framework": "Next.js",
        "routes": [...],
        "endpoints": [...],
        "dependencies": [...]
      }
```

---

## 🛡 Flow 3: Security Detection & Shared Normalization Pipeline (Phase 4A)

```text
                  Phase 2 Ingested Snapshot (source workspace)
                                       |
                                       v
                     Scan Orchestration (Phase 3 Celery Worker)
                                       |
                +----------------------+----------------------+
                |                                             |
                v                                             v
        OSV-Scanner Runner                            Gitleaks Runner
     (Dependency Vulnerabilities)                   (Hardcoded Secrets)
                |                                             |
                | raw JSON artifact                           | raw JSON artifact
                v                                             v
         OsvFindingMapper                             GitleaksFindingMapper
         (FindingMapper)                                (FindingMapper)
                |                                             |
                +----------------------+----------------------+
                                       |
                                       v
                               FindingNormalizer
         +-----------------------------------------------------------+
         | 1. Validate canonical NormalizedFinding contract          |
         | 2. Map severities to CRITICAL, HIGH, MEDIUM, LOW, INFO     |
         | 3. Compute deterministic SHA-256 finding identity         |
         | 4. Map to SQLAlchemy SecurityFinding models               |
         +-----------------------------+-----------------------------+
                                       |
                                       v
                       PostgreSQL / SQLite Database
                          (security_findings)
                                       |
                                       v
                        Pattern Extraction & Attack Graphs
                                (Phase 5 & Phase 7)
```

---

## 🕸 Flow 4: Project Attack Graph Reconstruction (Phase 7)

```text
                     EXTERNAL INTERNET ENTRYPOINT
                                  |
                                  v
                  Target Endpoint: GET /api/users/:id
                                  |
                                  | (Data Flow: User Input)
                                  v
                  Vulnerability Node: Missing Auth Check
                          [File: src/api/users/[id].ts:42]
                                  |
                                  | (Exploitation Path)
                                  v
                  Database Sink: Unrestricted Query (MongoDB)
                                  |
                                  v
                  Sensitive Asset Node: User Financial Data
```

---

## 🗄 Flow 5: Data Model Entity Relationships

```text
 +-------------------+         1:N         +-------------------+
 |       User        |-------------------->|      Project      |
 |-------------------|                     |-------------------|
 | id (PK UUID)      |                     | id (PK UUID)      |
 | firebase_uid (UNQ)|                     | user_id (FK)      |
 | github_id         |                     | name, description |
 | email             |                     | repo_id, repo_url |
 | username          |                     +---------+---------+
 +-------------------+                               |
                                                     | 1:N
                                                     v
 +-------------------+         1:N         +-------------------+
 |   AnalysisRun     |<--------------------|       Scan        |
 |-------------------|                     |-------------------|
 | id (PK UUID)      |                     | id (PK UUID)      |
 | project_id (FK)   |                     | project_id (FK)   |
 | commit_sha        |                     | analysis_run_id(FK|
 | status            |                     | commit_sha        |
 +---------+---------+                     | status            |
           |                               +----+---------+----+
           | 1:N                                |         |
           v                                    |         | 1:N
 +-------------------+             1:N          |         v
 |  RepositoryFile   |             +------------+  +-------------------+
 |-------------------|             |               |  ScanEngineRun    |
 | id (PK UUID)      |             |               |-------------------|
 | analysis_run_id(FK|             |               | id (PK UUID)      |
 | path, sha256      |             |               | scan_id (FK)      |
 | content           |             |               | engine_name       |
 +-------------------+             v               | status, artifact  |
                         +-------------------+     +-------------------+
                         |  SecurityFinding  |
                         |-------------------|
                         | id (PK UUID)      |
                         | scan_id (FK)      |
                         | project_id (FK)   |
                         | engine            |
                         | finding_type      |
                         | title, description|
                         | severity, status  |
                         | file_path, lines  |
                         | package, cve, ghsa|
                         | fingerprint (IDX) |
                         | raw_json          |
                         +-------------------+
```
