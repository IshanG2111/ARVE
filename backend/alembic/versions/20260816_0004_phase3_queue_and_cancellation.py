"""Add Phase 3 queue configuration metadata and container cancellation support.

Revision ID: 20260816_0004
Revises: 20260816_0003
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260816_0004"
down_revision: Union[str, Sequence[str], None] = "20260816_0003"
branch_labels = None
depends_on = None


def _has_column(bind, table: str, column: str) -> bool:
    return column in {item["name"] for item in inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, "scan_engine_runs", "container_name"):
        op.add_column("scan_engine_runs", sa.Column("container_name", sa.String(), nullable=True))
        op.create_index(
            "ix_scan_engine_runs_container_name",
            "scan_engine_runs",
            ["container_name"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, "scan_engine_runs", "container_name"):
        op.drop_index("ix_scan_engine_runs_container_name", table_name="scan_engine_runs")
        op.drop_column("scan_engine_runs", "container_name")
