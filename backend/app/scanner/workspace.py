"""Build a safe temporary filesystem snapshot from Phase 2 repository_files."""
from __future__ import annotations

import hashlib
import logging
import os
import shutil
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import AnalysisRun, RepositoryFile, Scan
from app.scanner.exceptions import ScanValidationError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WorkspaceInfo:
    root: Path
    source: Path
    output: Path
    file_count: int
    total_bytes: int


class ScanWorkspaceManager:
    """Materialize exactly the immutable Phase 2 snapshot selected by a scan."""

    def __init__(self, db: Session, root: str | Path | None = None):
        self.db = db
        self.root = Path(root or settings.SCAN_WORKSPACE_ROOT).expanduser().resolve()

    @staticmethod
    def _safe_relative_path(raw_path: str) -> PurePosixPath:
        normalized = raw_path.replace("\\", "/")
        path = PurePosixPath(normalized)
        if path.is_absolute() or not path.parts:
            raise ScanValidationError(f"Invalid repository path: {raw_path}")
        if any(part in {"", ".", ".."} for part in path.parts):
            raise ScanValidationError(f"Unsafe repository path: {raw_path}")
        if any(":" in part for part in path.parts):
            raise ScanValidationError(f"Unsafe repository path: {raw_path}")
        return path

    @staticmethod
    def _content_bytes(content: str) -> bytes:
        return content.encode("utf-8")

    def _validate_snapshot(self, scan: Scan, analysis_run: AnalysisRun) -> list[RepositoryFile]:
        if analysis_run.project_id != scan.project_id:
            raise ScanValidationError("Analysis run does not belong to the scan project")
        if analysis_run.status != "COMPLETED":
            raise ScanValidationError(
                f"Analysis run {analysis_run.id} is not complete (status={analysis_run.status})"
            )
        if not analysis_run.commit_sha or len(analysis_run.commit_sha) != 40:
            raise ScanValidationError("Analysis run does not contain a valid pinned commit SHA")
        if scan.commit_sha != analysis_run.commit_sha:
            raise ScanValidationError("Scan commit SHA does not match the Phase 2 analysis run")

        files = (
            self.db.query(RepositoryFile)
            .filter(
                RepositoryFile.analysis_run_id == analysis_run.id,
                RepositoryFile.project_id == scan.project_id,
                RepositoryFile.status == "INGESTED",
            )
            .order_by(RepositoryFile.path.asc())
            .all()
        )
        if not files:
            raise ScanValidationError("Phase 2 analysis run contains no ingested files")
        return files

    def build(self, scan: Scan) -> WorkspaceInfo:
        analysis_run = (
            self.db.query(AnalysisRun)
            .filter(
                AnalysisRun.id == scan.analysis_run_id,
                AnalysisRun.project_id == scan.project_id,
            )
            .first()
        )
        if not analysis_run:
            raise ScanValidationError("Phase 2 analysis run was not found")

        files = self._validate_snapshot(scan, analysis_run)
        scan_root = (self.root / scan.id).resolve()
        source_root = (scan_root / "src").resolve()
        output_root = (scan_root / "out").resolve()

        if source_root == self.root or output_root == self.root:
            raise ScanValidationError("Invalid scan workspace configuration")

        self.cleanup(scan.id)
        source_root.mkdir(parents=True, exist_ok=False)
        output_root.mkdir(parents=True, exist_ok=False)

        total_bytes = 0
        written = 0
        try:
            for record in files:
                if record.content is None:
                    raise ScanValidationError(f"Ingested file has no content: {record.path}")

                relative = self._safe_relative_path(record.path)
                destination = (source_root / Path(*relative.parts)).resolve()
                if os.path.commonpath([str(source_root), str(destination)]) != str(source_root):
                    raise ScanValidationError(f"Repository path escaped workspace: {record.path}")

                destination.parent.mkdir(parents=True, exist_ok=True)
                content_bytes = self._content_bytes(record.content)
                actual_sha = hashlib.sha256(content_bytes).hexdigest()
                if record.sha256 and actual_sha != record.sha256:
                    raise ScanValidationError(f"SHA-256 mismatch for {record.path}")

                with destination.open("wb") as handle:
                    handle.write(content_bytes)

                written += 1
                total_bytes += len(content_bytes)

            if written != len(files):
                raise ScanValidationError("Workspace file count does not match Phase 2 snapshot")

            logger.info(
                "scan=%s workspace built files=%s bytes=%s commit=%s",
                scan.id,
                written,
                total_bytes,
                scan.commit_sha,
            )
            return WorkspaceInfo(
                root=scan_root,
                source=source_root,
                output=output_root,
                file_count=written,
                total_bytes=total_bytes,
            )
        except Exception:
            self.cleanup(scan.id)
            raise

    def cleanup(self, scan_id: str) -> None:
        scan_root = (self.root / scan_id).resolve()
        if scan_root == self.root:
            raise ScanValidationError("Refusing to clean the workspace root")
        if scan_root.exists():
            shutil.rmtree(scan_root, ignore_errors=False)

    def exists(self, scan_id: str) -> bool:
        return (self.root / scan_id).resolve().exists()
