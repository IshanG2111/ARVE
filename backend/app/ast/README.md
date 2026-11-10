# ARVE AST integration

The Tree-sitter parser and extractors in this package are adapted from
https://github.com/amansatya/AST and run only against the immutable Phase 2
workspace created by `ScanWorkspaceManager`.

## Runtime

The parallel scan service invokes `ASTAnalysisService` after normalized
security findings are persisted. AST output is stored in PostgreSQL using the
`20261105_0008` Alembic migration. No standalone SQLite database or graph
viewer is used by ARVE.

## Supported parser languages

Python, JavaScript, TypeScript/TSX, Java, PHP and Go.

## Limits

The initial limits follow the ARVE development plan: 5,000 files and 200 MB
per repository snapshot, with a 1 MB per-file parsing limit. Unsupported files
are counted; individual parser errors are recorded and do not stop other files.

## Security context semantics

The first integration maps scanner file/line locations to enclosing functions
and classes. It also performs conservative Express route declaration matching
and records nearby request-input and security-operation syntax as observations.
These observations are not taint analysis and do not prove source-to-sink flow.
A missing context is represented as unresolved/file-only, never fabricated.

## Local setup

Install backend dependencies from `backend/requirements.txt`, apply migrations
with `alembic upgrade head` from the backend directory, then run the backend
and Celery worker as usual. AST runs automatically as part of a security scan.

Run the focused parser test with:

```bash
cd backend
pytest tests/test_ast_engine.py -q
```

Run the complete backend suite before merging or deploying.
