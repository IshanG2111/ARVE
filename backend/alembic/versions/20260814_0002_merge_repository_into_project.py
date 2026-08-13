"""Move the single repository owned by each project into projects.

The repository table is redundant because an ARVE project has exactly one
connected GitHub repository. This migration denormalizes repository metadata
onto projects and makes ingestion records project-scoped before removing the
repositories table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision: str = "20260814_0002"
down_revision: Union[str, Sequence[str], None] = "20260813_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PROJECT_REPO_COLUMNS = (
    ("repo_owner", sa.String(), True),
    ("repo_language", sa.String(), True),
    ("repo_description", sa.Text(), True),
    ("repo_private", sa.Boolean(), True),
    ("repo_visibility", sa.String(), True),
    ("repo_size_kb", sa.Integer(), True),
    ("repo_frameworks", sa.String(), True),
    ("repo_package_manager", sa.String(), True),
)


def _has_table(bind, table: str) -> bool:
    return inspect(bind).has_table(table)


def _has_column(bind, table: str, column: str) -> bool:
    return column in {item["name"] for item in inspect(bind).get_columns(table)}


def _fk_names(bind, table: str, column: str) -> list[str]:
    return [
        fk["name"]
        for fk in inspect(bind).get_foreign_keys(table)
        if column in (fk.get("constrained_columns") or []) and fk.get("name")
    ]


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_table(bind, "projects"):
        return

    # 1. Add repository metadata to projects. Existing legacy columns such as
    # repo_id/repo_name/repo_url/default_branch are retained for compatibility.
    existing_project_columns = {item["name"] for item in inspect(bind).get_columns("projects")}
    for name, column_type, nullable in PROJECT_REPO_COLUMNS:
        if name not in existing_project_columns:
            op.add_column("projects", sa.Column(name, column_type, nullable=nullable))

    # 2. Backfill from the repositories table while repository_id still exists.
    if _has_table(bind, "repositories") and _has_column(bind, "projects", "repository_id"):
        repository_columns = {item["name"] for item in inspect(bind).get_columns("repositories")}
        bind.execute(
            text(
                "UPDATE projects p "
                "SET repo_id = r.github_repo_id, "
                "    repo_owner = r.owner, "
                "    repo_name = r.full_name, "
                "    repo_url = r.html_url, "
                "    default_branch = r.default_branch, "
                "    repo_language = r.language, "
                "    repo_description = r.description, "
                "    repo_private = r.private "
                "FROM repositories r "
                "WHERE p.repository_id = r.id"
            )
        )

        if "visibility" in repository_columns:
            bind.execute(
                text(
                    "UPDATE projects p SET repo_visibility = r.visibility "
                    "FROM repositories r WHERE p.repository_id = r.id"
                )
            )
        else:
            bind.execute(
                text(
                    "UPDATE projects SET repo_visibility = CASE "
                    "WHEN repo_private THEN 'private' ELSE 'public' END "
                    "WHERE repo_visibility IS NULL"
                )
            )

        if "size_kb" in repository_columns:
            bind.execute(
                text(
                    "UPDATE projects p SET repo_size_kb = COALESCE(r.size_kb, 0) "
                    "FROM repositories r WHERE p.repository_id = r.id"
                )
            )

        if "frameworks" in repository_columns:
            bind.execute(
                text(
                    "UPDATE projects p SET repo_frameworks = r.frameworks "
                    "FROM repositories r WHERE p.repository_id = r.id"
                )
            )

        if "package_manager" in repository_columns:
            bind.execute(
                text(
                    "UPDATE projects p SET repo_package_manager = r.package_manager "
                    "FROM repositories r WHERE p.repository_id = r.id"
                )
            )

    # 3. Backfill project repository owner from the legacy full_name when no
    # repository table record exists.
    if _has_column(bind, "projects", "repo_name") and _has_column(bind, "projects", "repo_owner"):
        bind.execute(
            text(
                "UPDATE projects "
                "SET repo_owner = split_part(repo_name, '/', 1) "
                "WHERE (repo_owner IS NULL OR repo_owner = '') "
                "AND repo_name IS NOT NULL AND position('/' in repo_name) > 0"
            )
        )

    # Normalize defaults for the new repository metadata columns before making
    # the two scalar fields non-nullable.
    if _has_column(bind, "projects", "repo_private"):
        bind.execute(text("UPDATE projects SET repo_private = FALSE WHERE repo_private IS NULL"))
        op.alter_column("projects", "repo_private", existing_type=sa.Boolean(), nullable=False, server_default=sa.false())
    if _has_column(bind, "projects", "repo_size_kb"):
        bind.execute(text("UPDATE projects SET repo_size_kb = 0 WHERE repo_size_kb IS NULL"))
        op.alter_column("projects", "repo_size_kb", existing_type=sa.Integer(), nullable=False, server_default="0")

    # 4. Ensure Phase-2 ingestion tables exist on older databases that were
    # created before the ingestion engine was introduced.
    if not _has_table(bind, "analysis_runs"):
        op.create_table(
            "analysis_runs",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("commit_sha", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="PENDING"),
            sa.Column("files_found", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("files_ingested", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("files_skipped", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("languages_summary", sa.Text(), nullable=True),
            sa.Column("frameworks", sa.String(), nullable=True),
            sa.Column("package_manager", sa.String(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("started_at", sa.DateTime(), nullable=False),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
        )

    if not _has_table(bind, "repository_files"):
        op.create_table(
            "repository_files",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("analysis_run_id", sa.String(), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("path", sa.String(), nullable=False, index=True),
            sa.Column("filename", sa.String(), nullable=False),
            sa.Column("extension", sa.String(), nullable=True),
            sa.Column("language", sa.String(), nullable=True),
            sa.Column("size", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("sha256", sa.String(), nullable=True, index=True),
            sa.Column("content", sa.Text(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="INGESTED"),
            sa.Column("skip_reason", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )

    # 5. Add project_id to ingestion tables and migrate existing rows through
    # the old repository relationship.
    for table in ("analysis_runs", "repository_files"):
        if not _has_table(bind, table):
            continue
        if not _has_column(bind, table, "project_id"):
            op.add_column(table, sa.Column("project_id", sa.String(), nullable=True))

        if _has_column(bind, table, "repository_id") and _has_column(bind, "projects", "repository_id"):
            bind.execute(
                text(
                    f"UPDATE {table} x "
                    "SET project_id = p.id "
                    "FROM projects p "
                    f"WHERE x.repository_id = p.repository_id"
                )
            )

        orphan = bind.execute(
            text(f"SELECT id FROM {table} WHERE project_id IS NULL LIMIT 1")
        ).fetchone()
        if orphan:
            raise RuntimeError(
                f"Cannot remove repositories: {table} contains rows that cannot be mapped to a project."
            )

        op.alter_column(table, "project_id", existing_type=sa.String(), nullable=False)

    # 6. Drop old repository foreign keys/columns now that all dependent rows
    # have project ownership.
    for table in ("repository_files", "analysis_runs", "projects"):
        if not _has_table(bind, table) or not _has_column(bind, table, "repository_id"):
            continue
        for name in _fk_names(bind, table, "repository_id"):
            op.drop_constraint(name, table, type_="foreignkey")
        op.drop_column(table, "repository_id")

    # 7. Create the new ingestion foreign keys after the old repository table is
    # no longer needed.
    if _has_table(bind, "analysis_runs"):
        for name in _fk_names(bind, "analysis_runs", "project_id"):
            op.drop_constraint(name, "analysis_runs", type_="foreignkey")
        op.create_foreign_key(
            "fk_analysis_runs_project_id",
            "analysis_runs",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="CASCADE",
        )

    if _has_table(bind, "repository_files"):
        for name in _fk_names(bind, "repository_files", "project_id"):
            op.drop_constraint(name, "repository_files", type_="foreignkey")
        op.create_foreign_key(
            "fk_repository_files_project_id",
            "repository_files",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="CASCADE",
        )

    if _has_table(bind, "repositories"):
        op.drop_table("repositories")


def downgrade() -> None:
    raise RuntimeError(
        "The repository table was intentionally removed in 20260814_0002. "
        "Restore from a database backup rather than attempting an automatic downgrade."
    )
