# AI Security Code Discovery Engine

## Detailed Implementation Plan + System Design

### 14--15 Week Group Project \| 6 Members

> **Source basis:** This plan follows the uploaded project brief:
> repository ingestion, commit-pinned snapshots, AST/code intelligence,
> Semgrep, CodeQL, finding correlation, deduplication, CWE/OWASP
> enrichment, deterministic confidence, AI-assisted triage, FastAPI,
> dashboard and benchmark evaluation. The design below expands the
> implementation and visualization details needed for the team to build
> the system.
>
> **Important scope decision:** The project has **two different
> visualizations for a vulnerability**:
>
> 1.  **Security Relationship Graph** --- an Obsidian-style node graph
>     showing what code/security components are connected to the
>     vulnerability.
> 2.  **Vulnerability Code-Lineage Tree** --- a Git/branch-history-style
>     view showing how the vulnerable code/value/flow moved from one
>     code node to another across changes, and the exact code point
>     where the transition occurred.
>
> The second view is **not** an attack graph or a generic impact tree.
> It should visually resemble a Git branch/commit tree so that after
> understanding the relationship graph, a user can follow the
> vulnerability's movement through code changes.

------------------------------------------------------------------------

# 1. Final Project Objective

The system takes a GitHub repository or local repository and produces an
evidence-backed security analysis.

``` text
Repository
    ↓
Pinned Commit
    ↓
Repository Snapshot
    ↓
AST / Code Intelligence
    ↓
Semgrep + CodeQL
    ↓
Raw Findings
    ↓
Correlation
    ↓
Deduplication
    ↓
CWE / OWASP / Confidence
    ↓
Canonical Finding
    ↓
┌───────────────────────────────┐
│                               │
▼                               ▼
Relationship Graph        Code-Lineage Tree
│                               │
└───────────────┬───────────────┘
                ▼
          AI Triage / Explanation
                ↓
           Evidence View
                ↓
          Dashboard / Reports
```

The central objective is:

> **Given a repository, discover security vulnerabilities and explain
> every important result through traceable code evidence.**

The project should not behave like an LLM-only scanner. SAST and code
intelligence provide the evidence; AI reasons over that evidence.

------------------------------------------------------------------------

# 2. System Boundaries

## 2.1 Input

The scanner accepts:

``` text
GitHub repository URL
```

or:

``` text
Local repository
```

Optional scan parameters:

``` text
branch
commit SHA
language
framework
scan profile
```

Example:

``` json
{
  "repository": "https://github.com/example/project",
  "branch": "main",
  "commit": "abc123"
}
```

------------------------------------------------------------------------

# 3. Repository Snapshot Design

The first requirement is reproducibility.

A scan must not simply mean:

``` text
scan current GitHub repository
```

It must mean:

``` text
scan repository at exact commit SHA
```

## Snapshot pipeline

``` text
Repository URL
      ↓
Clone
      ↓
Resolve branch
      ↓
Resolve commit SHA
      ↓
Checkout exact commit
      ↓
Ignore generated/binary files
      ↓
Hash source files
      ↓
Detect languages/frameworks
      ↓
Build manifest
      ↓
Create Scan ID
```

## Snapshot metadata

``` json
{
  "project_id": "proj_001",
  "scan_id": "scan_001",
  "repository": "owner/repo",
  "branch": "main",
  "commit_sha": "abc123",
  "created_at": "...",
  "files": 431,
  "languages": {
    "TypeScript": 0.71,
    "Python": 0.29
  }
}
```

## Why this matters

Every finding, graph node and AI explanation must be associated with the
exact code version that produced it.

------------------------------------------------------------------------

# 4. Scan Lifecycle

The backend should expose a state machine:

``` text
QUEUED
  ↓
INGESTING
  ↓
INDEXING
  ↓
ANALYZING
  ↓
CORRELATING
  ↓
AI_REVIEW
  ↓
GRAPH_BUILD
  ↓
OUTPUT
  ↓
COMPLETED
```

Failure states:

``` text
FAILED
PARTIAL
CANCELLED
```

Each state should expose:

``` json
{
  "scan_id": "scan_001",
  "status": "ANALYZING",
  "progress": 67,
  "message": "Running CodeQL queries"
}
```

------------------------------------------------------------------------

# 5. Code Intelligence Design

The AST engine creates the internal representation used by:

-   security analysis
-   relationship graph
-   code-lineage tree
-   evidence viewer
-   AI context builder

## Core CodeModel

``` text
Repository
 └── File
      ├── imports
      ├── exports
      ├── classes
      ├── functions
      ├── variables
      ├── calls
      ├── routes
      ├── sources
      └── sinks
```

------------------------------------------------------------------------

# 6. File Node

Example:

``` json
{
  "id": "FILE-001",
  "type": "file",
  "path": "users/[id]/route.ts",
  "language": "typescript",
  "hash": "..."
}
```

Relationships:

``` text
File → IMPORTS → File
File → CONTAINS → Function
File → CONTAINS → Class
File → DEFINES → Route
```

------------------------------------------------------------------------

# 7. Function Node

``` json
{
  "id": "FN-001",
  "type": "function",
  "name": "GET",
  "file_id": "FILE-001",
  "line_start": 12,
  "line_end": 42
}
```

Relationships:

``` text
Function → CALLS → Function
Function → READS → Variable
Function → WRITES → Variable
Function → CONTAINS → Source
Function → CONTAINS → Sink
```

------------------------------------------------------------------------

# 8. Source and Sink Model

Security analysis needs explicit source/sink objects.

## Source

A source is where potentially untrusted input enters.

Examples:

``` text
req.query.id
req.body.username
params.id
request.headers.authorization
uploaded_file
environment input
```

Example:

``` json
{
  "id": "SRC-001",
  "type": "source",
  "expression": "params.id",
  "source_type": "route_parameter",
  "file": "users/[id]/route.ts",
  "line": 20
}
```

## Sink

A sink is a security-sensitive operation.

Examples:

``` text
SQL query
HTML rendering
shell execution
file access
HTTP request
deserialization
redirect
```

Example:

``` json
{
  "id": "SINK-001",
  "type": "sink",
  "expression": "User.findById(id)",
  "sink_type": "database_query",
  "file": "users/[id]/route.ts",
  "line": 21
}
```

------------------------------------------------------------------------

# 9. Source-to-Sink Flow

A security flow should be represented explicitly.

``` text
Source
  ↓
Variable
  ↓
Function Call
  ↓
Function
  ↓
Variable
  ↓
Sink
```

Example:

``` text
params.id
    ↓
id
    ↓
User.findById(id)
    ↓
database query
```

For taint-analysis findings:

``` text
SOURCE → TRANSFORM → TRANSFER → SINK
```

Each transition should preserve evidence.

------------------------------------------------------------------------

# 10. Semgrep Layer

Semgrep is responsible for broad and fast pattern-based detection.

## Use Semgrep for

-   dangerous APIs
-   insecure coding patterns
-   framework-specific mistakes
-   custom security rules
-   secrets
-   obvious authorization problems
-   unsafe redirects
-   dangerous file operations

## Rule structure

Every rule should have:

``` text
Rule ID
Title
Vulnerability type
Severity
CWE
OWASP
Pattern
Positive test
Negative test
Message
```

Example conceptual rule:

``` yaml
id: unsafe-shell-execution
severity: high
cwe: CWE-78
patterns:
  - ...
```

------------------------------------------------------------------------

# 11. CodeQL Layer

CodeQL provides deeper program relationships.

## Use CodeQL for

-   taint tracking
-   source-to-sink flows
-   cross-function relationships
-   data-flow analysis
-   deeper CWE-oriented queries

Pipeline:

``` text
Repository
    ↓
CodeQL Database
    ↓
Queries
    ↓
Data-flow / Taint Results
    ↓
Parser
    ↓
Canonical Evidence
```

------------------------------------------------------------------------

# 12. Semgrep vs CodeQL

The system should preserve the distinction.

  Capability                     Semgrep                   CodeQL
  ------------------------------ ------------------------- ----------
  Pattern detection              Strong                    Possible
  Custom rules                   Strong                    Strong
  Fast scanning                  Strong                    Lower
  Framework patterns             Strong                    Possible
  Taint analysis                 Limited/depends on rule   Strong
  Cross-function flow            Limited                   Strong
  Source-to-sink relationships   Some                      Strong

The dashboard should show which engine produced each piece of evidence.

------------------------------------------------------------------------

# 13. Raw Finding Model

Do not immediately show raw scanner output to the user as final
findings.

Raw output:

``` json
{
  "engine": "semgrep",
  "rule_id": "missing-auth",
  "file": "route.ts",
  "line": 21,
  "message": "..."
}
```

CodeQL might produce another result for the same issue.

Both must go through correlation.

------------------------------------------------------------------------

# 14. Finding Correlation

``` text
Semgrep Finding A
        \
         \
          → Correlation Engine
         /
CodeQL Finding B
```

Possible matching signals:

``` text
same file
same line
same function
same source
same sink
same CWE
same data-flow
semantic similarity
```

Output:

``` text
Canonical Finding F-102
```

------------------------------------------------------------------------

# 15. Canonical Finding Schema

``` json
{
  "finding_id": "F-102",
  "title": "Potential Missing Authorization",
  "severity": "high",
  "confidence": 0.91,
  "state": "probable",

  "file": "users/[id]/route.ts",
  "line_start": 21,
  "line_end": 21,

  "cwe": ["CWE-862"],
  "owasp": ["A01"],

  "source_engines": [
    "semgrep",
    "codeql"
  ],

  "sources": [
    "SRC-001"
  ],

  "sinks": [
    "SINK-001"
  ],

  "evidence": []
}
```

------------------------------------------------------------------------

# 16. Deduplication

The same vulnerability may appear multiple times.

Example:

``` text
Semgrep
  F-1

CodeQL
  F-2

Same underlying vulnerability
        ↓
Canonical Finding F-102
```

Deduplication should consider:

``` text
CWE
source location
function
source
sink
data-flow
semantic fingerprint
```

The original scanner results should remain accessible as evidence, even
after deduplication.

------------------------------------------------------------------------

# 17. Confidence Model

Confidence should be based on deterministic evidence.

Possible signals:

``` text
Semgrep + CodeQL agreement
Source found
Sink found
Source-to-sink path found
Exact line location
AST relationship
Authentication context
Rule confidence
```

Conceptually:

``` text
Evidence
   ↓
Signal extraction
   ↓
Weighted confidence
   ↓
Final confidence
```

The AI should not freely assign the final confidence.

------------------------------------------------------------------------

# 18. CWE / OWASP Enrichment

Each finding should be enriched with:

``` text
CWE
OWASP category
Severity
Confidence
Description
```

Example:

``` text
Finding F-102

CWE:
CWE-862 — Missing Authorization

OWASP:
A01 — Broken Access Control

Severity:
HIGH

Confidence:
91%
```

------------------------------------------------------------------------

# 19. Security Relationship Graph

## Purpose

The first visualization answers:

> **"What is connected to this vulnerability?"**

It is an **Obsidian-style knowledge graph**.

The finding is the central node.

------------------------------------------------------------------------

# 20. Relationship Graph Node Types

## Security nodes

``` text
Finding
CWE
OWASP
```

## Code nodes

``` text
File
Function
Class
Variable
Route
Source
Sink
```

## Dependency nodes

``` text
Import
Call
```

## Version-control nodes

``` text
Commit
Branch
```

------------------------------------------------------------------------

# 21. Relationship Graph Edges

Use explicit edge types:

``` text
FOUND_IN
CONTAINS
CALLS
IMPORTS
READS
WRITES
SOURCE_TO
FLOWS_TO
SINK_AT
MAPS_TO_CWE
MAPS_TO_OWASP
RELATED_TO
INTRODUCED_AT
MODIFIED_AT
```

Example:

``` text
Finding F-102
     |
     | FOUND_IN
     ↓
route.ts
     |
     | CONTAINS
     ↓
GET()
     |
     | SOURCE_TO
     ↓
params.id
     |
     | FLOWS_TO
     ↓
id
     |
     | SINK_AT
     ↓
User.findById(id)
```

------------------------------------------------------------------------

# 22. Relationship Graph Data Structure

``` json
{
  "graph_id": "GRAPH-F102",
  "finding_id": "F-102",

  "nodes": [
    {
      "id": "F-102",
      "type": "finding"
    },
    {
      "id": "FILE-001",
      "type": "file"
    },
    {
      "id": "FN-001",
      "type": "function"
    },
    {
      "id": "SRC-001",
      "type": "source"
    },
    {
      "id": "SINK-001",
      "type": "sink"
    }
  ],

  "edges": [
    {
      "source": "F-102",
      "target": "FILE-001",
      "type": "FOUND_IN"
    }
  ]
}
```

------------------------------------------------------------------------

# 23. Relationship Graph UI

## Default state

When the user clicks:

``` text
Finding F-102
```

show:

``` text
                 CWE-862
                    |
                    |
                 F-102
                    |
                 route.ts
                /       \
             GET()     imports
              |
          params.id
              |
          User.findById
              |
          DB Sink
```

## Controls

``` text
Zoom In
Zoom Out
Reset
Fit
Focus Finding
Show Neighbors
Expand
Collapse
```

## Filters

``` text
[✓] Findings
[✓] Files
[✓] Functions
[✓] Sources
[✓] Sinks
[✓] Routes
[✓] Commits
[✓] CWE
[✓] OWASP
```

------------------------------------------------------------------------

# 24. Graph Interaction

When a node is selected:

``` text
selected node
      ↓
highlight direct neighbors
      ↓
highlight relevant edges
      ↓
show evidence panel
```

When an edge is selected:

``` text
Relationship:
SOURCE_TO

From:
params.id

To:
id

Evidence:
route.ts:20

Source engine:
CodeQL

Confidence:
0.98
```

The graph must therefore be **evidence-driven**, not merely decorative.

------------------------------------------------------------------------

# 25. SECOND VISUALIZATION --- Vulnerability Code-Lineage Tree

## Important clarification

This is **not** the same as the relationship graph.

It should look and behave more like a:

``` text
Git branch / commit tree
```

The purpose is to show:

> **How the vulnerable code/flow moved from one code node to another
> over code changes, and at which code point the transition occurred.**

After a user understands the connected components in the relationship
graph, this second view lets them understand the **sequence/history of
the vulnerability inside the code**.

------------------------------------------------------------------------

# 26. What the Lineage Tree Should Show

Example:

``` text
Commit A
   |
   | modifies
   v
Node 1
auth.ts:42
validateUser()
   |
   | code moved/changed
   |
   +----------------------+
                          |
                          v
                     Commit B
                          |
                          v
                       Node 2
                middleware.ts:18
                checkUser()
                          |
                          | vulnerability flow
                          v
                       Node 3
                route.ts:27
                GET()
```

The important information is:

``` text
Node 1
  ↓
which commit changed it?
  ↓
which code node did it become?
  ↓
at which file/function/line?
  ↓
where does the vulnerable flow continue?
```

------------------------------------------------------------------------

# 27. Git-Style Visual Design

The tree should visually resemble:

``` text
● Commit A
│
│
● Node 1
│
│
● Commit B
│
├──────────────● Node 2
│
│
● Commit C
│
│
● Node 3
```

If the code diverges:

``` text
                 ● Node 2A
                /
● Node 1 ──────●
                \
                 ● Node 2B
```

If the vulnerability path continues:

``` text
● Node 1
    |
    |
    ● Node 2
         |
         |
         ● Node 3
              |
              |
              ● Vulnerability F-102
```

The visual language should communicate **history and movement**, not
generic dependency relationships.

------------------------------------------------------------------------

# 28. Example Vulnerability Lineage

Suppose the vulnerable value begins at:

``` text
Node 1
auth.ts:42
validateUser()
```

A later commit changes the code:

``` text
Commit B
```

and the relevant logic moves into:

``` text
Node 2
middleware.ts:18
checkUser()
```

Then another change moves the value into:

``` text
Node 3
users/[id]/route.ts:27
GET()
```

The UI should show:

``` text
Node 1
auth.ts:42
   |
   | Commit B
   | moved/changed at line 18
   v
Node 2
middleware.ts:18
   |
   | Commit C
   | propagated to route
   v
Node 3
route.ts:27
   |
   v
Finding F-102
```

This makes the **point of transition** visible.

------------------------------------------------------------------------

# 29. What Counts as a Transition?

The system should identify transitions using evidence such as:

``` text
Git diff
+
line history
+
function identity
+
AST similarity
+
symbol identity
+
call relationships
+
data-flow relationship
```

Possible transition types:

``` text
MOVED
MODIFIED
RENAMED
SPLIT
MERGED
COPIED
PROPAGATED
CALLED_FROM
FLOWED_TO
```

Example:

``` text
Node 1
   |
   | RENAMED
   v
Node 2
```

or:

``` text
Node 1
   |
   | SPLIT
   +----------+
   |          |
   v          v
Node 2A     Node 2B
```

------------------------------------------------------------------------

# 30. Important Distinction: Git History vs Security Flow

The system should keep two concepts separate.

## Git lineage

``` text
What changed over commits?
```

## Security flow

``` text
Where does the vulnerable data/control flow through the current code?
```

The lineage view may combine them visually, but the underlying evidence
must distinguish:

``` text
GIT_CHANGE
```

from:

``` text
CODE_FLOW
```

and:

``` text
SECURITY_FINDING
```

------------------------------------------------------------------------

# 31. Combined Interpretation

The user should be able to move:

``` text
Relationship Graph
        ↓
"What is connected?"
        ↓
Select Node 2
        ↓
"How did this code arrive here?"
        ↓
Code-Lineage Tree
        ↓
"What commit/change caused this transition?"
        ↓
Evidence
        ↓
Git diff + code lines
```

This is the intended workflow.

------------------------------------------------------------------------

# 32. Lineage Tree Data Model

``` json
{
  "lineage_id": "LINEAGE-F102",
  "finding_id": "F-102",

  "nodes": [
    {
      "id": "NODE-1",
      "type": "code",
      "file": "auth.ts",
      "function": "validateUser",
      "line": 42
    },
    {
      "id": "NODE-2",
      "type": "code",
      "file": "middleware.ts",
      "function": "checkUser",
      "line": 18
    }
  ],

  "transitions": [
    {
      "from": "NODE-1",
      "to": "NODE-2",
      "commit": "abc123",
      "type": "MOVED",
      "evidence": [
        "git diff",
        "AST similarity"
      ],
      "code_point": {
        "file": "middleware.ts",
        "line": 18
      }
    }
  ]
}
```

------------------------------------------------------------------------

# 33. Lineage Tree UI Detail Panel

When selecting a transition:

``` text
Transition

FROM
auth.ts
validateUser()
line 42

TO
middleware.ts
checkUser()
line 18

Commit
abc123

Change
MOVED

Evidence
✓ Git diff
✓ AST similarity
✓ Symbol relationship

Point of transition
middleware.ts:18
```

Then provide:

``` text
[View Diff]
[View Source]
[Open Relationship Graph]
```

------------------------------------------------------------------------

# 34. Git Diff Integration

The lineage view should allow:

``` text
Node 1
   ↓
Commit
   ↓
View Diff
```

Example:

``` diff
- validateUser(user)
+ checkUser(user)
```

The user should be able to see why the system believes the vulnerable
logic moved.

------------------------------------------------------------------------

# 35. Finding-to-Lineage Algorithm

Conceptually:

``` text
1. Start with canonical Finding F-102
2. Identify current code node
3. Identify file/function/line
4. Find previous versions of that code
5. Traverse Git commits backward
6. Compare AST/symbol structure
7. Identify matching previous code nodes
8. Build transitions
9. Stop at earliest reliable point
10. Return lineage tree
```

The system should not claim a historical transition when evidence is
insufficient.

Possible final states:

``` text
ORIGIN_CONFIRMED
ORIGIN_CANDIDATE
HISTORY_INCOMPLETE
ORIGIN_UNKNOWN
```

------------------------------------------------------------------------

# 36. Relationship Graph + Lineage Tree Architecture

``` text
                 Canonical Finding
                        |
             +----------+----------+
             |                     |
             v                     v
      Current CodeModel       Git History
             |                     |
             v                     v
   Relationship Builder     Lineage Builder
             |                     |
             v                     v
     Obsidian Graph          Git-style Tree
             |                     |
             +----------+----------+
                        |
                        v
                 Evidence Viewer
```

------------------------------------------------------------------------

# 37. Backend API Design

## Projects

``` text
POST /projects
```

Create project.

``` text
POST /projects/{id}/scan
```

Start scan.

``` text
GET /projects/{id}/status
```

Scan progress.

------------------------------------------------------------------------

## Findings

``` text
GET /projects/{id}/findings
GET /findings/{id}
GET /findings/{id}/evidence
POST /findings/{id}/explain
```

------------------------------------------------------------------------

## Relationship Graph

``` text
GET /findings/{id}/graph
```

Parameters:

``` text
depth
node_types
edge_types
```

Example:

``` text
GET /findings/F-102/graph?depth=2
```

------------------------------------------------------------------------

## Lineage Tree

``` text
GET /findings/{id}/lineage
```

Optional:

``` text
depth
max_commits
```

------------------------------------------------------------------------

## Commit History

``` text
GET /commits/{sha}
GET /commits/{sha}/findings
GET /commits/{sha}/diff
```

------------------------------------------------------------------------

## Graph Nodes

``` text
GET /nodes/{id}
GET /nodes/{id}/neighbors
```

------------------------------------------------------------------------

# 38. Database Design

Recommended primary storage:

``` text
PostgreSQL
```

Core tables:

``` text
projects
scans
repositories
files
functions
classes
routes
sources
sinks
commits
findings
evidence
scanner_results
relationships
lineage_nodes
lineage_edges
ai_explanations
```

------------------------------------------------------------------------

# 39. Relationship Table

``` text
relationships
-------------------------
id
scan_id
source_node_id
target_node_id
relationship_type
evidence_id
confidence
created_at
```

Examples:

``` text
F-102 → FILE-001 → FOUND_IN
FILE-001 → FN-001 → CONTAINS
FN-001 → SRC-001 → CONTAINS
SRC-001 → VAR-001 → FLOWS_TO
VAR-001 → SINK-001 → FLOWS_TO
```

------------------------------------------------------------------------

# 40. Lineage Table

``` text
lineage_edges
-------------------------
id
finding_id
from_node_id
to_node_id
commit_sha
transition_type
from_file
from_line
to_file
to_line
evidence_id
confidence
```

This keeps lineage separate from ordinary code relationships.

------------------------------------------------------------------------

# 41. Evidence Model

Every important result should point to evidence.

``` json
{
  "evidence_id": "E-102",
  "type": "source_location",
  "engine": "codeql",
  "file": "route.ts",
  "line_start": 21,
  "line_end": 21,
  "description": "User-controlled route parameter reaches database query"
}
```

Evidence types:

``` text
SOURCE_LOCATION
AST_RELATIONSHIP
SEMGREP_RESULT
CODEQL_RESULT
GIT_DIFF
GIT_HISTORY
DATA_FLOW
CALL_GRAPH
IMPORT_GRAPH
AI_CONTEXT
```

------------------------------------------------------------------------

# 42. AI Context Builder

The AI should not receive the entire repository.

Build:

``` text
Finding
   ↓
Relevant file
   ↓
±30 lines
   ↓
Enclosing function
   ↓
Imports
   ↓
Source
   ↓
Sink
   ↓
Data-flow
   ↓
Authentication context
   ↓
CWE description
   ↓
Scanner evidence
```

------------------------------------------------------------------------

# 43. AI Output

Use structured output:

``` json
{
  "finding_id": "F-102",
  "summary": "...",
  "why_it_matters": "...",
  "evidence_summary": "...",
  "context_assessment": "...",
  "analyst_notes": "...",
  "needs_review": false
}
```

The AI output must reference existing evidence.

------------------------------------------------------------------------

# 44. Dashboard Architecture

Recommended pages:

``` text
/
 ├── repositories
 ├── scan/:id
 ├── findings
 ├── findings/:id
 │     ├── overview
 │     ├── evidence
 │     ├── graph
 │     ├── lineage
 │     └── ai
 ├── analytics
 └── reports
```

------------------------------------------------------------------------

# 45. Finding Detail Layout

``` text
+----------------------------------------------------------+
| Finding F-102                                            |
| Potential Missing Authorization                          |
+----------------------------------------------------------+
| Severity | Confidence | CWE | OWASP | State             |
+----------------------------------------------------------+
| Evidence                                                 |
+----------------------------------------------------------+
| Source Code                                              |
+----------------------------------------------------------+
| AI Explanation                                           |
+----------------------------------------------------------+
|                                                          |
| Security Relationship Graph                              |
|                                                          |
+----------------------------------------------------------+
|                                                          |
| Vulnerability Code-Lineage Tree                          |
|                                                          |
+----------------------------------------------------------+
```

The user first understands the vulnerability through evidence and the
relationship graph, then uses the lineage tree to understand how the
relevant code changed/moved.

------------------------------------------------------------------------

# 46. Report Design

The downloadable report should contain:

``` text
1. Executive Summary
2. Repository Information
3. Scan Information
4. Language/Framework Analysis
5. Scanner Summary
6. Finding Summary
7. Severity Distribution
8. CWE/OWASP Mapping
9. Detailed Findings
10. Source Evidence
11. AI Explanations
12. Relationship Graph
13. Vulnerability Code-Lineage Tree
14. Relevant Git Changes
15. Benchmark Results
16. False Positive Analysis
17. False Negative Analysis
18. Limitations
19. Conclusion
```

For every finding:

``` text
Finding ID
Title
Severity
Confidence
State
CWE
OWASP
File
Line
Source
Sink
Scanner evidence
Relationship graph
Lineage tree
Relevant commits
AI explanation
```

------------------------------------------------------------------------

# 47. Export Formats

## JSON

Machine-readable complete scan:

``` text
scan.json
```

Include:

``` text
metadata
findings
evidence
relationships
lineage
AI outputs
```

## CSV

Useful columns:

``` text
finding_id
title
severity
confidence
state
file
line_start
line_end
cwe
owasp
source_engines
commit
```

## PDF

Human-readable security report containing:

-   finding details
-   evidence
-   graph screenshots
-   lineage tree
-   benchmark results

------------------------------------------------------------------------

# 48. Dashboard Graph Technology

The frontend can use:

``` text
React
+
React Flow / Cytoscape
```

## Relationship Graph

Use force-directed / knowledge-graph style visualization.

The graph should support:

``` text
drag
zoom
pan
expand
collapse
filter
focus
highlight
```

## Lineage Tree

Use a deliberately different layout:

``` text
left → right
```

or:

``` text
top → bottom
```

with:

``` text
commit nodes
code nodes
branch lines
transition labels
```

The visual distinction is important.

------------------------------------------------------------------------

# 49. Relationship Graph vs Lineage Tree

  -----------------------------------------------------------------------
  Feature                 Relationship Graph      Vulnerability Lineage
                                                  Tree
  ----------------------- ----------------------- -----------------------
  Main question           What is connected?      How did the
                                                  code/vulnerability
                                                  move?

  Visual style            Obsidian knowledge      Git branch/commit tree
                          graph                   

  Main data               Code relationships      Git history + code
                                                  similarity

  Nodes                   Files, functions,       Code states + commits
                          sources, sinks, CWE,    
                          finding                 

  Edges                   Calls, imports, flows,  Changed, moved,
                          contains                renamed, split, merged

  Direction               Relationship-based      Chronological

  Main use                Understand structure    Understand evolution

  Evidence                AST/SAST/data-flow      Git diff/history +
                                                  AST/symbol evidence
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 50. Important Anti-Confusion Rule

Do **not** call the second visualization an:

``` text
Impact Graph
```

or:

``` text
Attack Graph
```

because that implies a different security concept.

Recommended name:

> **Vulnerability Code-Lineage Tree**

Alternative UI label:

> **Code History / Lineage**

This makes its purpose clear.

------------------------------------------------------------------------

# 51. V1 Vulnerability Scope

Target approximately:

``` text
SQL / NoSQL Injection
XSS
Command Injection
Path Traversal
SSRF
Insecure Deserialization
Hard-coded Secrets
Missing Authorization
IDOR
Weak Authentication Controls
Unsafe Redirects
Dangerous File Operations
Insecure HTTP Requests
Sensitive Data Exposure
```

Do not promise complete CWE coverage.

------------------------------------------------------------------------

# 52. Detailed 15-Week Implementation Plan

## Week 1 --- Architecture and Contracts

### Build

``` text
repository structure
FastAPI skeleton
React skeleton
PostgreSQL schema
Docker
CI
configuration
logging
```

### Define

``` text
Project
Scan
Finding
Evidence
CodeNode
Relationship
LineageNode
LineageEdge
AIExplanation
```

### Deliverable

All services start and the database schema exists.

------------------------------------------------------------------------

# 53. Week 2 --- Repository Snapshot

Implement:

``` text
GitHub URL validation
clone
branch resolution
commit resolution
checkout
file filtering
hashing
language detection
manifest
```

### Test

Scan the same commit twice and verify:

``` text
same SHA
same files
same hashes
same snapshot
```

### Deliverable

Reproducible repository snapshot.

------------------------------------------------------------------------

# 54. Week 3 --- AST Foundation

Implement:

``` text
file extraction
function extraction
class extraction
import extraction
export extraction
```

Generate stable IDs.

### Deliverable

A repository can be represented as:

``` text
File → Function/Class/Import
```

------------------------------------------------------------------------

# 55. Week 4 --- Code Relationships

Add:

``` text
function calls
variables
routes
source detection
sink detection
```

Build:

``` text
CALLS
IMPORTS
CONTAINS
SOURCE
SINK
```

### Deliverable

Queryable CodeModel.

------------------------------------------------------------------------

# 56. Week 5 --- Semgrep

Implement:

``` text
Semgrep execution
rule configuration
rule packs
raw result parser
```

Start with:

``` text
3–5 vulnerability families
```

### Deliverable

First scanner findings appear through the API.

------------------------------------------------------------------------

# 57. Week 6 --- Semgrep Expansion

Expand to the V1 vulnerability families.

Add:

``` text
positive tests
negative tests
rule metadata
CWE mapping
OWASP mapping
severity
```

### Deliverable

Stable Semgrep security-rule pack.

------------------------------------------------------------------------

# 58. Week 7 --- CodeQL

Implement:

``` text
CodeQL database creation
query execution
result parser
location extraction
```

Start with:

``` text
source → sink
```

queries.

### Deliverable

CodeQL findings enter the backend.

------------------------------------------------------------------------

# 59. Week 8 --- Data Flow

Add:

``` text
taint tracking
cross-function flow
source/sink paths
flow evidence
```

### Deliverable

At least several vulnerability classes have source-to-sink evidence.

------------------------------------------------------------------------

# 60. Week 9 --- Correlation + Deduplication

Build:

``` text
raw finding ingestion
scanner correlation
deduplication
semantic fingerprint
canonical Finding ID
```

Test:

``` text
Semgrep finding
+
CodeQL finding
=
one canonical finding
```

### Deliverable

Reliable Finding\[\] output.

------------------------------------------------------------------------

# 61. Week 10 --- Enrichment + Confidence + Graph Model

Implement:

``` text
CWE
OWASP
confidence
security states
evidence model
relationship schema
```

Then generate:

``` text
Finding
 ↓
File
 ↓
Function
 ↓
Source
 ↓
Sink
 ↓
CWE
```

### Deliverable

Every finding can generate a relationship graph.

------------------------------------------------------------------------

# 62. Week 11 --- Obsidian Relationship Graph

Implement:

``` text
node rendering
edge rendering
zoom
pan
drag
filter
focus
expand
collapse
evidence selection
```

### Deliverable

A user can open one finding and visually inspect all connected
components.

------------------------------------------------------------------------

# 63. Week 12 --- Vulnerability Code-Lineage Tree

Implement:

``` text
Git commit traversal
git diff extraction
line history
AST similarity
symbol matching
code-node matching
transition detection
lineage construction
```

Transition types:

``` text
MOVED
MODIFIED
RENAMED
SPLIT
MERGED
COPIED
PROPAGATED
```

### Deliverable

A finding can show:

``` text
Node 1
 ↓
Commit
 ↓
Node 2
 ↓
Commit
 ↓
Node 3
```

with the transition code point visible.

------------------------------------------------------------------------

# 64. Week 13 --- AI + Evidence Viewer

Implement:

``` text
context builder
LLM gateway
structured response
validation
explanation
triage
```

Evidence viewer should connect:

``` text
Finding
 ↓
Code
 ↓
Graph node
 ↓
Lineage node
 ↓
Commit
 ↓
Diff
```

### Deliverable

Complete explainable finding workflow.

------------------------------------------------------------------------

# 65. Week 14 --- Dashboard + Reports

Complete:

``` text
repository page
scan progress
findings table
finding detail
relationship graph
lineage tree
AI panel
analytics
PDF export
JSON export
CSV export
```

### Deliverable

End-to-end dashboard.

------------------------------------------------------------------------

# 66. Week 15 --- Evaluation + Hardening

Run benchmark tests.

Measure:

``` text
precision
recall
F1
false-positive rate
false-negative rate
findings/KLOC
scan time
deduplication rate
relationship graph correctness
lineage correctness
```

Then:

``` text
bug fixing
security hardening
performance
documentation
demo preparation
final report
```

### Deliverable

Final reproducible release.

------------------------------------------------------------------------

# 67. Testing Strategy

## Unit Tests

Test independently:

``` text
Git parser
AST parser
source extractor
sink extractor
Semgrep parser
CodeQL parser
correlator
deduplicator
CWE mapper
confidence engine
graph builder
lineage builder
AI schema validator
report generator
```

------------------------------------------------------------------------

# 68. Integration Test

Full pipeline:

``` text
Repository
 ↓
Snapshot
 ↓
AST
 ↓
Semgrep
 ↓
CodeQL
 ↓
Correlation
 ↓
Finding
 ↓
Relationship Graph
 ↓
Lineage Tree
 ↓
AI
 ↓
Report
```

One test repository should exercise this complete path.

------------------------------------------------------------------------

# 69. Benchmark Evaluation

Use the source brief's recommended evaluation sources where applicable:

``` text
Juliet
NIST SARD subsets
OWASP Benchmark where applicable
Intentionally vulnerable web repositories
Manually reviewed real-world repository sample
```

Measure:

``` text
Precision
Recall
F1
False positives
False negatives
Findings/KLOC
Scan time
Deduplication rate
```

For the two visualizations additionally measure:

``` text
Relationship precision
Relationship recall
Lineage transition correctness
Correct transition code point
Evidence coverage
```

------------------------------------------------------------------------

# 70. Security Requirements

Because repositories are untrusted input:

``` text
Run scans in isolated environment
Use Docker
Limit permissions
Do not expose credentials
Restrict network access where possible
Treat repository files as untrusted
Validate external inputs
Validate AI outputs
Keep audit information
```

The AI must not:

``` text
execute shell commands
modify repository
access credentials
call arbitrary URLs
```

------------------------------------------------------------------------

# 71. Error Handling

## Repository

``` text
invalid URL
clone failure
private repository
missing branch
missing commit
```

## AST

``` text
unsupported syntax
parser failure
corrupt file
```

## Semgrep

``` text
scanner failure
timeout
invalid rule
```

## CodeQL

``` text
database failure
query failure
timeout
```

## AI

``` text
timeout
rate limit
invalid JSON
schema mismatch
```

## Graph

``` text
missing node
broken relationship
incomplete history
```

A partial scan should be marked clearly as:

``` text
PARTIAL
```

rather than silently appearing complete.

------------------------------------------------------------------------

# 72. Final Dashboard Workflow

``` text
┌──────────────────────┐
│ Enter Repository     │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Select Commit        │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Start Scan           │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Scan Progress        │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Findings             │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Finding Detail       │
└───────┬───────┬──────┘
        │       │
        │       │
        ▼       ▼
   Relationship  Code-Lineage
      Graph        Tree
        │           │
        └─────┬─────┘
              ↓
        Evidence Viewer
              ↓
        AI Explanation
              ↓
        Export Report
```

------------------------------------------------------------------------

# 73. Final Demonstration

Use one vulnerable full-stack repository.

Show:

``` text
Repository
   ↓
Exact Commit
   ↓
431 files
   ↓
SAST
   ↓
47 raw findings
   ↓
31 normalized findings
   ↓
12 high-confidence findings
```

Then open one finding:

``` text
F-102
```

Show:

``` text
CWE
OWASP
Severity
Confidence
Evidence
```

Then:

### First visualization

``` text
Obsidian Relationship Graph
```

Explain:

``` text
"What is connected to this vulnerability?"
```

### Second visualization

``` text
Vulnerability Code-Lineage Tree
```

Explain:

``` text
"How did this vulnerable code move from Node 1
to Node 2, and at which commit/code point did
that transition happen?"
```

Then click:

``` text
Transition
```

and show:

``` text
Commit
+
Git diff
+
old code location
+
new code location
```

Finally:

``` text
AI Explanation
      ↓
PDF Report
      +
JSON
      +
CSV
```

------------------------------------------------------------------------

# 74. Final Project Deliverables

``` text
Source Code
Docker Configuration
Database Schema
API Documentation
Security Rules
CodeQL Queries
CodeModel
Finding Engine
Relationship Graph
Vulnerability Code-Lineage Tree
AI Gateway
Dashboard
Benchmark Results
PDF Report Generator
JSON Export
CSV Export
Test Suite
Documentation
Demo Repository
Final Presentation
```

------------------------------------------------------------------------

# 75. Final Architecture Summary

``` text
                    REPOSITORY
                        |
                        v
                REPRODUCIBLE SNAPSHOT
                        |
                        v
                  CODE INTELLIGENCE
                        |
             +----------+----------+
             |                     |
             v                     v
          SEMGREP                CODEQL
             |                     |
             +----------+----------+
                        |
                        v
                 CORRELATION
                        |
                        v
                  DEDUPLICATION
                        |
                        v
               CWE / OWASP / SCORE
                        |
                        v
                 CANONICAL FINDING
                        |
             +----------+----------+
             |                     |
             v                     v
       RELATIONSHIP           CODE-LINEAGE
          GRAPH                   TREE
             |                     |
             |                     |
       "WHAT IS               "HOW DID IT
        CONNECTED?"             MOVE?"
             |                     |
             +----------+----------+
                        |
                        v
                 EVIDENCE VIEW
                        |
                        v
                   AI TRIAGE
                        |
                        v
                  DASHBOARD
                        |
              +---------+---------+
              |         |         |
              v         v         v
             PDF       JSON      CSV
```

------------------------------------------------------------------------

# 76. The Two Visualization Concepts --- Final Definition

## A. Security Relationship Graph

> **A current-state Obsidian-style graph that explains the structural
> and security relationships surrounding one vulnerability.**

Example:

``` text
Finding
 ├── File
 │    └── Function
 │         ├── Source
 │         ├── Call
 │         └── Sink
 ├── CWE
 ├── OWASP
 └── Related Findings
```

## B. Vulnerability Code-Lineage Tree

> **A Git-style chronological tree that explains how the relevant
> vulnerable code/flow transitioned from one code node to another across
> commits, including the exact code point where the transition
> occurred.**

Example:

``` text
Commit A
   |
 Node 1
   |
   | changed in Commit B
   v
 Node 2
   |
   | propagated in Commit C
   v
 Node 3
   |
 Finding
```

The two views answer two different questions:

``` text
RELATIONSHIP GRAPH
        ↓
"What is connected?"

CODE-LINEAGE TREE
        ↓
"How did it get here?"
```

Together they provide the user with both **structural understanding**
and **historical/code-evolution understanding** of a vulnerability.
