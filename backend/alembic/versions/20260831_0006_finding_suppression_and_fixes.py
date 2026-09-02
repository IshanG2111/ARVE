"""Add fixed_version and suppression columns to security_findings.

Revision ID: 20260831_0006
Revises: 20260830_0005
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260831_0006"
down_revision: Union[str, Sequence[str], None] = "20260830_0005"
branch_labels = None
depends_on = None


def _column_names(bind, table: str) -> set[str]:
    insp = inspect(bind)
    if not insp.has_table(table):
        return set()
    return {col["name"] for col in insp.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    cols = _column_names(bind, "security_findings")
    if not cols:
        return

    if "fixed_version" not in cols:
        op.add_column("security_findings", sa.Column("fixed_version", sa.String(128), nullable=True))
    if "suppression_reason" not in cols:
        op.add_column("security_findings", sa.Column("suppression_reason", sa.String(128), nullable=True))
    if "suppression_justification" not in cols:
        op.add_column("security_findings", sa.Column("suppression_justification", sa.Text(), nullable=True))
    if "suppression_expires_at" not in cols:
        op.add_column("security_findings", sa.Column("suppression_expires_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    cols = _column_names(bind, "security_findings")
    if not cols:
        return

    if "suppression_expires_at" in cols:
        op.drop_column("security_findings", "suppression_expires_at")
    if "suppression_justification" in cols:
        op.drop_column("security_findings", "suppression_justification")
    if "suppression_reason" in cols:
        op.drop_column("security_findings", "suppression_reason")
    if "fixed_version" in cols:
        op.drop_column("security_findings", "fixed_version")
