"""Add durable AST JSON artifact metadata.

Revision ID: 20261105_0009
Revises: 20261105_0008
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20261105_0009"
down_revision: Union[str, Sequence[str], None] = "20261105_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ast_analysis_runs", sa.Column(
        "artifact_status", sa.String(), nullable=False, server_default="PENDING"
    ))
    op.add_column("ast_analysis_runs", sa.Column("artifact_bucket", sa.String(), nullable=True))
    op.add_column("ast_analysis_runs", sa.Column("artifact_key", sa.Text(), nullable=True))
    op.add_column("ast_analysis_runs", sa.Column("artifact_sha256", sa.String(), nullable=True))
    op.add_column("ast_analysis_runs", sa.Column("artifact_size_bytes", sa.Integer(), nullable=True))
    op.add_column("ast_analysis_runs", sa.Column("artifact_created_at", sa.DateTime(), nullable=True))
    op.add_column("ast_analysis_runs", sa.Column("artifact_error", sa.Text(), nullable=True))
    op.create_index("ix_ast_analysis_runs_artifact_status", "ast_analysis_runs", ["artifact_status"])
    op.alter_column("ast_analysis_runs", "artifact_status", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_ast_analysis_runs_artifact_status", table_name="ast_analysis_runs")
    for column in (
        "artifact_error", "artifact_created_at", "artifact_size_bytes",
        "artifact_sha256", "artifact_key", "artifact_bucket", "artifact_status",
    ):
        op.drop_column("ast_analysis_runs", column)
