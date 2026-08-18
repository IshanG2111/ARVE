"""Add Phase 3 scan orchestration state and engine execution records.

Revision ID: 20260816_0003
Revises: 20260814_0002
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision: str = "20260816_0003"
down_revision: Union[str, Sequence[str], None] = "20260814_0002"
branch_labels = None
depends_on = None


def _has_table(bind, table: str) -> bool:
    return inspect(bind).has_table(table)


def _has_column(bind, table: str, column: str) -> bool:
    return column in {item["name"] for item in inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_table(bind, "scans"):
        op.create_table(
            "scans",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("analysis_run_id", sa.String(), nullable=False),
            sa.Column("commit_sha", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="QUEUED"),
            sa.Column("progress_percent", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("current_stage", sa.String(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
        )
        op.create_foreign_key(
            "fk_scans_analysis_run_id",
            "scans",
            "analysis_runs",
            ["analysis_run_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        op.create_index("ix_scans_project_id", "scans", ["project_id"])
        op.create_index("ix_scans_analysis_run_id", "scans", ["analysis_run_id"])
        op.create_index("ix_scans_commit_sha", "scans", ["commit_sha"])
        op.create_index("ix_scans_status", "scans", ["status"])
    else:
        columns = {item["name"] for item in inspect(bind).get_columns("scans")}
        additions = [
            ("analysis_run_id", sa.String(), True),
            ("commit_sha", sa.String(), True),
            ("progress_percent", sa.Integer(), True),
            ("current_stage", sa.String(), True),
            ("error_message", sa.Text(), True),
            ("started_at", sa.DateTime(), True),
            ("completed_at", sa.DateTime(), True),
        ]
        for name, column_type, nullable in additions:
            if name not in columns:
                op.add_column("scans", sa.Column(name, column_type, nullable=nullable))

        bind.execute(text("UPDATE scans SET status = 'QUEUED' WHERE LOWER(status) = 'pending'"))
        bind.execute(text("UPDATE scans SET progress_percent = 0 WHERE progress_percent IS NULL"))

        # Existing placeholder scans must be tied to a completed Phase-2 run.
        # Refuse an ambiguous migration instead of inventing a snapshot.
        if _has_column(bind, "scans", "analysis_run_id"):
            orphan_count = bind.execute(
                text(
                    "SELECT COUNT(*) FROM scans s "
                    "WHERE s.analysis_run_id IS NULL "
                    "AND NOT EXISTS ("
                    "SELECT 1 FROM analysis_runs ar "
                    "WHERE ar.project_id = s.project_id AND ar.status = 'COMPLETED'"
                    ")"
                )
            ).scalar_one()
            if orphan_count:
                raise RuntimeError(
                    "Phase 3 migration cannot attach existing scans to a Phase-2 snapshot. "
                    "Create/repair a completed analysis_runs row for each project first."
                )

            bind.execute(
                text(
                    "UPDATE scans s SET analysis_run_id = ("
                    "SELECT ar.id FROM analysis_runs ar "
                    "WHERE ar.project_id = s.project_id AND ar.status = 'COMPLETED' "
                    "ORDER BY ar.completed_at DESC NULLS LAST LIMIT 1"
                    ") WHERE s.analysis_run_id IS NULL"
                )
            )
            bind.execute(
                text(
                    "UPDATE scans s SET commit_sha = ar.commit_sha "
                    "FROM analysis_runs ar WHERE s.analysis_run_id = ar.id AND s.commit_sha IS NULL"
                )
            )

            nulls = bind.execute(text("SELECT COUNT(*) FROM scans WHERE analysis_run_id IS NULL OR commit_sha IS NULL")).scalar_one()
            if nulls:
                raise RuntimeError("Phase 3 migration found scans without a pinned Phase-2 analysis run/commit")

            # Add FK only if it is not already present.
            fks = inspect(bind).get_foreign_keys("scans")
            if not any(fk.get("referred_table") == "analysis_runs" for fk in fks):
                op.create_foreign_key(
                    "fk_scans_analysis_run_id",
                    "scans",
                    "analysis_runs",
                    ["analysis_run_id"],
                    ["id"],
                    ondelete="RESTRICT",
                )

        op.alter_column("scans", "analysis_run_id", existing_type=sa.String(), nullable=False)
        op.alter_column("scans", "commit_sha", existing_type=sa.String(), nullable=False)
        op.alter_column("scans", "progress_percent", existing_type=sa.Integer(), nullable=False, server_default="0")

    if not _has_table(bind, "scan_engine_runs"):
        op.create_table(
            "scan_engine_runs",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("scan_id", sa.String(), sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False),
            sa.Column("engine_name", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="QUEUED"),
            sa.Column("exit_code", sa.Integer(), nullable=True),
            sa.Column("duration_ms", sa.Integer(), nullable=True),
            sa.Column("artifact_reference", sa.Text(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("stdout", sa.Text(), nullable=True),
            sa.Column("stderr", sa.Text(), nullable=True),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_scan_engine_runs_scan_id", "scan_engine_runs", ["scan_id"])
        op.create_index("ix_scan_engine_runs_engine_name", "scan_engine_runs", ["engine_name"])


def downgrade() -> None:
    op.drop_table("scan_engine_runs")
    # Keep the migration intentionally conservative: the placeholder scan
    # schema existed before Phase 3 and automatic rollback could destroy data.
    raise RuntimeError("Phase 3 scan columns require a manual rollback after data review")
