"""Add AST analysis, symbols, relationships and security contexts.

Revision ID: 20261105_0008
Revises: 20261104_0007
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
revision: str = "20261105_0008"
down_revision: Union[str, Sequence[str], None] = "20261104_0007"
branch_labels = None
depends_on = None
def upgrade():
    op.create_table("ast_analysis_runs",
      sa.Column("id",sa.String(),primary_key=True),sa.Column("scan_id",sa.String(),sa.ForeignKey("scans.id",ondelete="CASCADE"),nullable=False),
      sa.Column("project_id",sa.String(),sa.ForeignKey("projects.id",ondelete="CASCADE"),nullable=False),sa.Column("commit_sha",sa.String(),nullable=False),
      sa.Column("schema_version",sa.String(),nullable=False),sa.Column("parser_versions",sa.JSON(),nullable=False),sa.Column("status",sa.String(),nullable=False),
      sa.Column("files_discovered",sa.Integer(),nullable=False,server_default="0"),sa.Column("files_parsed",sa.Integer(),nullable=False,server_default="0"),
      sa.Column("files_failed",sa.Integer(),nullable=False,server_default="0"),sa.Column("files_unsupported",sa.Integer(),nullable=False,server_default="0"),
      sa.Column("total_functions",sa.Integer(),nullable=False,server_default="0"),sa.Column("total_classes",sa.Integer(),nullable=False,server_default="0"),
      sa.Column("total_imports",sa.Integer(),nullable=False,server_default="0"),sa.Column("total_calls",sa.Integer(),nullable=False,server_default="0"),
      sa.Column("total_relationships",sa.Integer(),nullable=False,server_default="0"),sa.Column("error_summary",sa.Text()),
      sa.Column("started_at",sa.DateTime(),nullable=False),sa.Column("completed_at",sa.DateTime()),sa.UniqueConstraint("scan_id",name="uq_ast_analysis_runs_scan"))
    for col in ("scan_id","project_id","commit_sha","status"): op.create_index(f"ix_ast_analysis_runs_{col}","ast_analysis_runs",[col])
    op.create_table("ast_files",sa.Column("id",sa.String(),primary_key=True),sa.Column("ast_analysis_id",sa.String(),sa.ForeignKey("ast_analysis_runs.id",ondelete="CASCADE"),nullable=False),
      sa.Column("path",sa.String(),nullable=False),sa.Column("language",sa.String()),sa.Column("status",sa.String(),nullable=False),
      sa.Column("has_syntax_errors",sa.Boolean(),nullable=False,server_default=sa.false()),sa.Column("content_hash",sa.String()),
      sa.Column("function_count",sa.Integer(),nullable=False,server_default="0"),sa.Column("class_count",sa.Integer(),nullable=False,server_default="0"),
      sa.Column("import_count",sa.Integer(),nullable=False,server_default="0"),sa.UniqueConstraint("ast_analysis_id","path",name="uq_ast_files_analysis_path"))
    for col in ("ast_analysis_id","path","language"): op.create_index(f"ix_ast_files_{col}","ast_files",[col])
    op.create_table("ast_symbols",sa.Column("id",sa.String(),primary_key=True),sa.Column("ast_analysis_id",sa.String(),sa.ForeignKey("ast_analysis_runs.id",ondelete="CASCADE"),nullable=False),
      sa.Column("ast_file_id",sa.String(),sa.ForeignKey("ast_files.id",ondelete="CASCADE"),nullable=False),sa.Column("stable_key",sa.String(),nullable=False),
      sa.Column("symbol_type",sa.String(),nullable=False),sa.Column("name",sa.String(),nullable=False),sa.Column("line_start",sa.Integer()),sa.Column("line_end",sa.Integer()),
      sa.Column("parent_stable_key",sa.String()),sa.Column("metadata_json",sa.JSON(),nullable=False),sa.UniqueConstraint("ast_analysis_id","stable_key",name="uq_ast_symbols_stable_key"))
    for col in ("ast_analysis_id","ast_file_id","stable_key","symbol_type","name"): op.create_index(f"ix_ast_symbols_{col}","ast_symbols",[col])
    op.create_table("ast_relationships",sa.Column("id",sa.String(),primary_key=True),sa.Column("ast_analysis_id",sa.String(),sa.ForeignKey("ast_analysis_runs.id",ondelete="CASCADE"),nullable=False),
      sa.Column("source_stable_key",sa.String(),nullable=False),sa.Column("target_stable_key",sa.String(),nullable=False),sa.Column("relationship_type",sa.String(),nullable=False),
      sa.Column("evidence",sa.JSON(),nullable=False),sa.Column("resolution_status",sa.String(),nullable=False))
    for col in ("ast_analysis_id","source_stable_key","target_stable_key","relationship_type"): op.create_index(f"ix_ast_relationships_{col}","ast_relationships",[col])
    op.create_table("security_contexts",sa.Column("id",sa.String(),primary_key=True),sa.Column("scan_id",sa.String(),sa.ForeignKey("scans.id",ondelete="CASCADE"),nullable=False),
      sa.Column("finding_id",sa.String(),sa.ForeignKey("security_findings.id",ondelete="CASCADE"),nullable=False),sa.Column("ast_analysis_id",sa.String(),sa.ForeignKey("ast_analysis_runs.id",ondelete="CASCADE"),nullable=False),
      sa.Column("file_path",sa.String()),sa.Column("function_name",sa.String()),sa.Column("class_name",sa.String()),sa.Column("route_method",sa.String()),sa.Column("route_path",sa.String()),
      sa.Column("framework",sa.String()),sa.Column("observed_inputs",sa.JSON(),nullable=False),sa.Column("security_operations",sa.JSON(),nullable=False),
      sa.Column("resolution_status",sa.String(),nullable=False),sa.Column("evidence",sa.JSON(),nullable=False),sa.UniqueConstraint("finding_id",name="uq_security_context_finding"))
    for col in ("scan_id","finding_id","ast_analysis_id"): op.create_index(f"ix_security_contexts_{col}","security_contexts",[col])
def downgrade():
    op.drop_table("security_contexts"); op.drop_table("ast_relationships"); op.drop_table("ast_symbols"); op.drop_table("ast_files"); op.drop_table("ast_analysis_runs")
