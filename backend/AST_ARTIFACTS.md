# AST artifacts and analysis quality

Every scan builds one complete normalized AST JSON document with scan and
parser metadata, files, symbols, relationships, unsupported-file reasons,
parser errors and security contexts.

When Backblaze B2 is configured, the private artifact is stored at:
`{B2_ARTIFACT_PREFIX}/{scan_id}/ast/ast-output.json`

PostgreSQL stores bucket, key, SHA-256, size, creation time and status in
`ast_analysis_runs`. Authenticated `GET /api/scans/{scan_id}/ast/export`
retrieves the artifact and verifies its checksum. The bucket remains private.

Without B2 configuration in development, indexing continues and artifact
status is `DISABLED`; no durable full JSON artifact is retained.

JavaScript/TypeScript call records expose callee expression, receiver and
member separately. Anonymous callbacks can receive contextual Express route
labels. Static relative named imports resolve only when exactly one analyzed
function matches. Ambiguous/dynamic imports are not guessed.

Security observations remain syntactic context, not proof of dataflow.
Full interprocedural taint analysis remains a separate capability.

Apply migration `20261105_0009` using `alembic upgrade head` from backend.
