# AST Code Intelligence — Database Setup

AST persistence is managed exclusively by Alembic. The application does not
create AST tables automatically at startup.

## Apply the migration

Run from the backend directory with the same environment/Infisical secrets
used to start FastAPI and the Celery worker:

```bash
alembic current
alembic heads
alembic upgrade head
alembic current
```

The expected AST migration revision is 20261105_0008.

## Verify the database

Run this query against the exact PostgreSQL database configured by
DATABASE_URL:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'ast_analysis_runs',
    'ast_files',
    'ast_symbols',
    'ast_relationships',
    'security_contexts'
  )
ORDER BY table_name;
```

All five tables must be returned.

## Important: use the same database

The Alembic environment imports database_url from app.core.database, which is
derived from settings.DATABASE_URL. Do not run Alembic with a different shell
environment or a different Infisical project/environment from the API and
worker.

After applying migrations, restart FastAPI and the Celery worker. Then create
a new security scan. A previous scan that failed before AST persistence does
not gain AST records retroactively.

## Expected API behavior

- Missing AST migration: HTTP 503 with code AST_SCHEMA_NOT_READY and an
  actionable migration instruction.
- Existing scan without an AST run: HTTP 404 with code AST_NOT_INDEXED.
- Existing AST run: HTTP 200 with summary/files/symbols.
- Missing or unauthorized scan: HTTP 404.

The API and scanner only check schema readiness. They never auto-run DDL or
silently create database tables.
