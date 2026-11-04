"""Add ai_explanations cache for validated AI output.

Revision ID: 20261104_0007
Revises: 20260831_0006
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20261104_0007"
down_revision: Union[str, Sequence[str], None] = "20260831_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if inspect(bind).has_table("ai_explanations"):
        return

    op.create_table(
        "ai_explanations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scan_id", sa.String(), sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("finding_id", sa.String(), sa.ForeignKey("security_findings.id", ondelete="CASCADE"), nullable=True),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("cache_key", sa.String(), nullable=False),
        sa.Column("prompt_version", sa.String(), nullable=False),
        sa.Column("model", sa.String(), nullable=False),
        sa.Column("served_model", sa.String(), nullable=True),
        sa.Column("response_json", sa.Text(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("thought_tokens", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("cache_key", name="uq_ai_explanations_cache_key"),
    )
    op.create_index("ix_ai_explanations_project_id", "ai_explanations", ["project_id"])
    op.create_index("ix_ai_explanations_scan_id", "ai_explanations", ["scan_id"])
    op.create_index("ix_ai_explanations_finding_id", "ai_explanations", ["finding_id"])


def downgrade() -> None:
    bind = op.get_bind()
    if not inspect(bind).has_table("ai_explanations"):
        return
    op.drop_index("ix_ai_explanations_finding_id", table_name="ai_explanations")
    op.drop_index("ix_ai_explanations_scan_id", table_name="ai_explanations")
    op.drop_index("ix_ai_explanations_project_id", table_name="ai_explanations")
    op.drop_table("ai_explanations")
