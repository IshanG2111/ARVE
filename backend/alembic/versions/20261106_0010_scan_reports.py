"""Add scan_reports table for persisted security reports.

Revision ID: 20261106_0010
Revises: 20261105_0009
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20261106_0010"
down_revision: Union[str, Sequence[str], None] = "20261105_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("scan_reports"):
        return

    op.create_table(
        "scan_reports",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("scan_id", sa.String(), sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="READY"),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("ai_explanation_id", sa.String(), sa.ForeignKey("ai_explanations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("report_json", sa.Text(), nullable=False),
        sa.Column("markdown_content", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("scan_id", name="uq_scan_reports_scan_id"),
    )
    op.create_index("ix_scan_reports_scan_id", "scan_reports", ["scan_id"])
    op.create_index("ix_scan_reports_project_id", "scan_reports", ["project_id"])


def downgrade() -> None:
    bind = op.get_bind()
    if not inspect(bind).has_table("scan_reports"):
        return
    op.drop_index("ix_scan_reports_project_id", table_name="scan_reports")
    op.drop_index("ix_scan_reports_scan_id", table_name="scan_reports")
    op.drop_table("scan_reports")

