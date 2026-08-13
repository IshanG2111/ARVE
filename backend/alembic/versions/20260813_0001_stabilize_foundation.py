"""Stabilize Phase-1 foundation and repository uniqueness.

Revision ID: 20260813_0001
Revises:
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

from app.core.database import Base
from app.models import models  # noqa: F401

revision: str = "20260813_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(bind, name: str) -> bool:
    return inspect(bind).has_table(name)


def _has_column(bind, table: str, column: str) -> bool:
    return column in {item["name"] for item in inspect(bind).get_columns(table)}


def _has_unique(bind, table: str, column: str) -> bool:
    inspector = inspect(bind)
    for constraint in inspector.get_unique_constraints(table):
        if constraint.get("column_names") == [column]:
            return True
    for index in inspector.get_indexes(table):
        if index.get("unique") and index.get("column_names") == [column]:
            return True
    return False


def upgrade() -> None:
    bind = op.get_bind()

    # The repository may already have been created by the old create_all()
    # bootstrap. For a brand-new database, create the current metadata first.
    if not _has_table(bind, "users"):
        Base.metadata.create_all(bind=bind)
        return

    if _has_table(bind, "projects"):
        # Backfill canonical ownership where legacy rows used owner_id.
        if _has_column(bind, "projects", "owner_id") and _has_column(bind, "projects", "user_id"):
            bind.execute(
                text(
                    "UPDATE projects "
                    "SET user_id = owner_id "
                    "WHERE (user_id IS NULL OR user_id = '') AND owner_id IS NOT NULL"
                )
            )

        # Backfill repository_id from the old GitHub numeric repository ID.
        if _has_column(bind, "projects", "repo_id") and _has_column(bind, "projects", "repository_id"):
            bind.execute(
                text(
                    "UPDATE projects p "
                    "SET repository_id = r.id "
                    "FROM repositories r "
                    "WHERE (p.repository_id IS NULL OR p.repository_id = '') "
                    "AND p.repo_id = r.github_repo_id"
                )
            )

        # Preserve existing display names when the canonical name is empty.
        if _has_column(bind, "projects", "name") and _has_column(bind, "projects", "repo_name"):
            bind.execute(
                text(
                    "UPDATE projects "
                    "SET name = split_part(repo_name, '/', 2) "
                    "WHERE (name IS NULL OR name = '') AND repo_name IS NOT NULL"
                )
            )

        # Existing rows must have a valid canonical owner before we consider
        # the schema stabilized. Do not silently invent an owner.
        invalid = bind.execute(
            text("SELECT id FROM projects WHERE user_id IS NULL OR user_id = '' LIMIT 1")
        ).fetchone()
        if invalid:
            raise RuntimeError(
                "Cannot stabilize projects: at least one project has no canonical user_id. "
                "Repair that row before running this migration."
            )

    if _has_table(bind, "repositories") and not _has_unique(bind, "repositories", "github_repo_id"):
        duplicates = bind.execute(
            text(
                "SELECT github_repo_id, COUNT(*) AS count "
                "FROM repositories "
                "GROUP BY github_repo_id "
                "HAVING COUNT(*) > 1 "
                "LIMIT 10"
            )
        ).fetchall()
        if duplicates:
            values = ", ".join(f"{row[0]} ({row[1]})" for row in duplicates)
            raise RuntimeError(
                "Duplicate github_repo_id values prevent the unique constraint: " + values
            )
        op.create_unique_constraint(
            "uq_repositories_github_repo_id",
            "repositories",
            ["github_repo_id"],
        )

    if _has_table(bind, "target_websites"):
        target_unique = any(
            constraint.get("column_names") == ["project_id", "domain"]
            for constraint in inspect(bind).get_unique_constraints("target_websites")
        )
        if not target_unique:
            duplicates = bind.execute(
                text(
                    "SELECT project_id, domain, COUNT(*) AS count "
                    "FROM target_websites "
                    "GROUP BY project_id, domain "
                    "HAVING COUNT(*) > 1 "
                    "LIMIT 10"
                )
            ).fetchall()
            if duplicates:
                values = ", ".join(f"{row[0]}:{row[1]} ({row[2]})" for row in duplicates)
                raise RuntimeError(
                    "Duplicate project target domains prevent the unique constraint: " + values
                )
            op.create_unique_constraint(
                "uq_target_websites_project_domain",
                "target_websites",
                ["project_id", "domain"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_table(bind, "target_websites"):
        try:
            op.drop_constraint("uq_target_websites_project_domain", "target_websites", type_="unique")
        except Exception:
            pass

    if _has_table(bind, "repositories") and _has_unique(bind, "repositories", "github_repo_id"):
        try:
            op.drop_constraint("uq_repositories_github_repo_id", "repositories", type_="unique")
        except Exception:
            # Some PostgreSQL deployments expose the uniqueness as an index.
            bind.execute(text("DROP INDEX IF EXISTS uq_repositories_github_repo_id"))
