"""Add Phase 4A shared security findings table, constraints, and indexes.

Revision ID: 20260830_0005
Revises: 20260816_0004
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20260830_0005"
down_revision: Union[str, Sequence[str], None] = "20260816_0004"
branch_labels = None
depends_on = None


def _has_table(bind, table: str) -> bool:
    return inspect(bind).has_table(table)


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "security_findings"):
        op.create_table(
            "security_findings",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("scan_id", sa.String(), sa.ForeignKey("scans.id", ondelete="CASCADE"), nullable=False),
            sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("engine", sa.String(), nullable=False),
            sa.Column("finding_type", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("severity", sa.String(), nullable=False),
            sa.Column("confidence", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="OPEN"),
            sa.Column("file_path", sa.String(), nullable=True),
            sa.Column("line_start", sa.Integer(), nullable=True),
            sa.Column("line_end", sa.Integer(), nullable=True),
            sa.Column("package_name", sa.String(), nullable=True),
            sa.Column("package_version", sa.String(), nullable=True),
            sa.Column("ecosystem", sa.String(), nullable=True),
            sa.Column("cve", sa.String(), nullable=True),
            sa.Column("ghsa", sa.String(), nullable=True),
            sa.Column("cwe", sa.String(), nullable=True),
            sa.Column("rule_id", sa.String(), nullable=True),
            sa.Column("fingerprint", sa.String(), nullable=False),
            sa.Column("raw_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.CheckConstraint(
                "line_end >= line_start OR line_end IS NULL OR line_start IS NULL",
                name="ck_security_findings_line_order",
            ),
            sa.CheckConstraint(
                "line_start > 0 OR line_start IS NULL",
                name="ck_security_findings_line_start_positive",
            ),
        )
        op.create_index("ix_security_findings_scan_id", "security_findings", ["scan_id"])
        op.create_index("ix_security_findings_project_id", "security_findings", ["project_id"])
        op.create_index("ix_security_findings_engine", "security_findings", ["engine"])
        op.create_index("ix_security_findings_finding_type", "security_findings", ["finding_type"])
        op.create_index("ix_security_findings_severity", "security_findings", ["severity"])
        op.create_index("ix_security_findings_confidence", "security_findings", ["confidence"])
        op.create_index("ix_security_findings_status", "security_findings", ["status"])
        op.create_index("ix_security_findings_file_path", "security_findings", ["file_path"])
        op.create_index("ix_security_findings_package_name", "security_findings", ["package_name"])
        op.create_index("ix_security_findings_ecosystem", "security_findings", ["ecosystem"])
        op.create_index("ix_security_findings_cve", "security_findings", ["cve"])
        op.create_index("ix_security_findings_ghsa", "security_findings", ["ghsa"])
        op.create_index("ix_security_findings_cwe", "security_findings", ["cwe"])
        op.create_index("ix_security_findings_rule_id", "security_findings", ["rule_id"])
        op.create_index("ix_security_findings_fingerprint", "security_findings", ["fingerprint"])
        op.create_index(
            "ix_security_findings_scan_engine",
            "security_findings",
            ["scan_id", "engine"],
        )
        op.create_index(
            "ix_security_findings_project_fingerprint",
            "security_findings",
            ["project_id", "fingerprint"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_table(bind, "security_findings"):
        op.drop_table("security_findings")
