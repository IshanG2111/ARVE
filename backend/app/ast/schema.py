"""Readiness checks for AST tables; Alembic remains the schema owner."""
from __future__ import annotations

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

AST_REQUIRED_TABLES = frozenset({
    "ast_analysis_runs",
    "ast_files",
    "ast_symbols",
    "ast_relationships",
    "security_contexts",
})


class ASTSchemaNotReady(RuntimeError):
    """Raised when the connected database has not received the AST migration."""


def missing_ast_tables(existing_tables: set[str] | frozenset[str]) -> list[str]:
    """Return missing AST tables in deterministic order."""
    return sorted(AST_REQUIRED_TABLES.difference(existing_tables))


def require_ast_schema(db: Session) -> None:
    """Verify AST tables exist in the database bound to this session."""
    try:
        existing = set(inspect(db.get_bind()).get_table_names())
    except SQLAlchemyError as exc:
        raise ASTSchemaNotReady(
            "Unable to inspect the database schema for AST tables. Verify "
            "DATABASE_URL and database connectivity, then run 'alembic upgrade head' "
            "from the backend directory."
        ) from exc

    missing = missing_ast_tables(existing)
    if missing:
        raise ASTSchemaNotReady(
            "AST database migration is not applied to the database used by this "
            f"application. Missing tables: {', '.join(missing)}. Run "
            "'alembic upgrade head' from the backend directory using the same "
            "DATABASE_URL as FastAPI and the Celery worker."
        )
