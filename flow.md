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

## 🛡 Flow 3: Security Detection & Pattern Extraction Pipeline (Phase 3 & Phase 5)

```text
                  Structured Application Model
                               |
                               v
               Execute Security Scanner Suite
         +---------------------+---------------------+
         |                     |                     |
         v                     v                     v
      Semgrep              Gitleaks                Trivy
  (AST Patterns)      (Hardcoded Secrets)     (Dependencies)
         |                     |                     |
         +---------------------+---------------------+
                               |
                               v
                 Normalize into Finding Format
         {
           "id": "ARVE-0017",
           "cwe": "CWE-639",
           "file": "src/api/users/[id].ts",
           "line": 42,
           "vulnerability": "Broken Access Control"
         }
                               |
                               v
                ML Security Pattern Engine
         (Code Embeddings -> Vector Space -> HDBSCAN Clustering)
                               |
                               v
                LLM Pattern Interpretation
        "Discovered Pattern: Missing Ownership Check on User ID"
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
 | id (PK)           |                     | id (PK)           |
 | firebase_uid (UNQ)|                     | user_id (FK)      |
 | github_id         |                     | repository_id(FK) |
 | email             |                     | branch            |
 | username          |                     | deployment_url    |
 | github_access_token                     +---------+---------+
 +-------------------+                               |
                                                     | 1:N
                                                     v
 +-------------------+         1:N         +-------------------+
 |    Repository     |<--------------------|       Scan        |
 |-------------------|                     |-------------------|
 | id (PK)           |                     | id (PK)           |
 | github_repo_id    |                     | project_id (FK)   |
 | owner / name      |                     | status            |
 +-------------------+                     +-------------------+
                                                     | 1:N
                                                     v
                                           +-------------------+
                                           |   TargetWebsite   |
                                           |-------------------|
                                           | id (PK)           |
                                           | project_id (FK)   |
                                           | domain            |
                                           | verification_token|
                                           +-------------------+
```
