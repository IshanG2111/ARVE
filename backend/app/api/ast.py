"""Authenticated AST and security-context read APIs."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.ast.schema import ASTSchemaNotReady, require_ast_schema
from app.core.database import get_db
from app.models.models import (
    ASTAnalysisRun, ASTFile, ASTRelationship, ASTSymbol,
    Project, Scan, SecurityContext, User,
)

router = APIRouter(tags=["ast"])


def owned(db: Session, scan_id: str, user_id: str) -> Scan:
    scan = (
        db.query(Scan)
        .join(Project, Project.id == Scan.project_id)
        .filter(Scan.id == scan_id, Project.user_id == user_id)
        .first()
    )
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    try:
        require_ast_schema(db)
    except ASTSchemaNotReady as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "AST_SCHEMA_NOT_READY",
                "message": str(exc),
                "remediation": "Run alembic upgrade head from backend, then restart FastAPI and Celery.",
            },
        ) from exc
    return scan


def get_run(db: Session, scan_id: str) -> ASTAnalysisRun:
    run = db.query(ASTAnalysisRun).filter_by(scan_id=scan_id).first()
    if not run:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "AST_NOT_INDEXED",
                "message": "AST analysis has not been created for this scan.",
            },
        )
    return run


@router.get("/scans/{scan_id}/ast")
def ast_summary(scan_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned(db, scan_id, user.id)
    run = get_run(db, scan_id)
    return {
        "id": run.id, "scan_id": run.scan_id, "project_id": run.project_id,
        "commit_sha": run.commit_sha, "schema_version": run.schema_version,
        "parser_versions": run.parser_versions, "status": run.status,
        "files_discovered": run.files_discovered, "files_parsed": run.files_parsed,
        "files_failed": run.files_failed, "files_unsupported": run.files_unsupported,
        "functions": run.total_functions, "classes": run.total_classes,
        "imports": run.total_imports, "calls": run.total_calls,
        "relationships": run.total_relationships, "error_summary": run.error_summary,
        "started_at": run.started_at, "completed_at": run.completed_at,
    }


@router.get("/scans/{scan_id}/ast/files")
def ast_files(
    scan_id: str, limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0), language: str | None = None,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    owned(db, scan_id, user.id)
    run = get_run(db, scan_id)
    query = db.query(ASTFile).filter_by(ast_analysis_id=run.id)
    if language:
        query = query.filter(ASTFile.language == language)
    rows = query.order_by(ASTFile.path).offset(offset).limit(limit).all()
    return {
        "items": [{
            "id": row.id, "path": row.path, "language": row.language,
            "status": row.status, "has_syntax_errors": row.has_syntax_errors,
            "function_count": row.function_count, "class_count": row.class_count,
            "import_count": row.import_count,
        } for row in rows],
        "limit": limit, "offset": offset,
    }


@router.get("/scans/{scan_id}/ast/files/{file_id}/symbols")
def ast_file_symbols(
    scan_id: str, file_id: str, db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned(db, scan_id, user.id)
    run = get_run(db, scan_id)
    file = db.query(ASTFile).filter_by(id=file_id, ast_analysis_id=run.id).first()
    if not file:
        raise HTTPException(status_code=404, detail="AST file not found")
    rows = (
        db.query(ASTSymbol)
        .filter_by(ast_file_id=file.id, ast_analysis_id=run.id)
        .order_by(ASTSymbol.line_start, ASTSymbol.name)
        .all()
    )
    return [{
        "id": row.id, "stable_key": row.stable_key, "type": row.symbol_type,
        "name": row.name, "line_start": row.line_start, "line_end": row.line_end,
        "metadata": row.metadata_json,
    } for row in rows]


@router.get("/scans/{scan_id}/ast/relationships")
def ast_relationships(
    scan_id: str, limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0), db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned(db, scan_id, user.id)
    run = get_run(db, scan_id)
    rows = (
        db.query(ASTRelationship)
        .filter_by(ast_analysis_id=run.id)
        .order_by(ASTRelationship.relationship_type, ASTRelationship.source_stable_key)
        .offset(offset).limit(limit).all()
    )
    return [{
        "source": row.source_stable_key, "target": row.target_stable_key,
        "type": row.relationship_type, "evidence": row.evidence,
        "resolution_status": row.resolution_status,
    } for row in rows]


@router.get("/scans/{scan_id}/findings/{finding_id}/context")
def finding_context(
    scan_id: str, finding_id: str, db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned(db, scan_id, user.id)
    row = db.query(SecurityContext).filter_by(scan_id=scan_id, finding_id=finding_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Security context not found")
    return {
        "finding_id": row.finding_id, "file_path": row.file_path,
        "function": row.function_name, "class": row.class_name,
        "route": {
            "method": row.route_method, "path": row.route_path,
            "framework": row.framework,
        } if row.route_path else None,
        "observed_inputs": row.observed_inputs,
        "security_operations": row.security_operations,
        "resolution_status": row.resolution_status, "evidence": row.evidence,
    }
