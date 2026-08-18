"""Phase 3 scan orchestration service."""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime
from typing import Iterable

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import AnalysisRun, Project, Scan, ScanEngineRun
from app.scanner.artifacts import ScanArtifactStore
from app.scanner.docker_runner import DockerRunner
from app.scanner.exceptions import ScanOrchestrationError, ScanValidationError, ScannerExecutionError
from app.scanner.interfaces import (
    EngineExecutionStatus,
    ScannerEngine,
    ScannerExecutionContext,
    ScannerExecutionResult,
)
from app.scanner.state_machine import ScanStateMachine, ScanStatus
from app.scanner.workspace import ScanWorkspaceManager

logger = logging.getLogger(__name__)


def build_default_registry() -> "ScanEngineRegistry":
    """Build the engine registry for the current runtime.

    Phase 3 only exposes the disabled-by-default smoke-test engine. Phase 4
    will replace/extend this registry with Semgrep, OSV-Scanner and Gitleaks.
    """
    registry = ScanEngineRegistry()
    if settings.SCANNER_ENABLE_TEST_ENGINE:
        from app.scanner.test_engine import Phase3TestEngine

        registry.register(Phase3TestEngine())
    return registry


class ScanEngineRegistry:
    """Runtime registry for future Phase 4 engines."""

    def __init__(self, engines: Iterable[ScannerEngine] | None = None):
        self._engines = {engine.name: engine for engine in (engines or [])}

    def register(self, engine: ScannerEngine) -> None:
        if engine.name in self._engines:
            raise ValueError(f"Scanner engine already registered: {engine.name}")
        self._engines[engine.name] = engine

    def list(self) -> list[ScannerEngine]:
        return list(self._engines.values())


class ScanExecutionService:
    """Coordinates a scan without containing scanner-specific logic."""

    def __init__(
        self,
        db: Session,
        registry: ScanEngineRegistry | None = None,
        workspace_manager: ScanWorkspaceManager | None = None,
        docker_runner: DockerRunner | None = None,
        artifact_store: ScanArtifactStore | None = None,
    ):
        self.db = db
        self.registry = registry or ScanEngineRegistry()
        self.workspace_manager = workspace_manager or ScanWorkspaceManager(db)
        self.docker_runner = docker_runner or DockerRunner()
        self.artifact_store = artifact_store or ScanArtifactStore()

    def _set_status(
        self,
        scan: Scan,
        target: ScanStatus,
        *,
        progress: int | None = None,
        stage: str | None = None,
        error_message: str | None = None,
    ) -> None:
        current = ScanStateMachine.normalize(scan.status)
        target_status = ScanStateMachine.normalize(target)
        if current != target_status:
            ScanStateMachine.transition(current, target_status)
            scan.status = target_status.value
        if progress is not None:
            scan.progress_percent = max(0, min(100, progress))
        if stage is not None:
            scan.current_stage = stage
        if error_message is not None:
            scan.error_message = error_message
        self.db.commit()
        self.db.refresh(scan)

    def _owned_project(self, project_id: str) -> Project:
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ScanValidationError("Project not found")
        return project

    def _select_analysis_run(self, project_id: str, analysis_run_id: str | None) -> AnalysisRun:
        query = self.db.query(AnalysisRun).filter(AnalysisRun.project_id == project_id)
        if analysis_run_id:
            run = query.filter(AnalysisRun.id == analysis_run_id).first()
        else:
            run = query.filter(AnalysisRun.status == "COMPLETED").order_by(AnalysisRun.completed_at.desc()).first()
        if not run:
            raise ScanValidationError("No completed Phase 2 analysis run is available for this project")
        if run.status != "COMPLETED":
            raise ScanValidationError(f"Analysis run is not complete: {run.status}")
        if not run.commit_sha or len(run.commit_sha) != 40:
            raise ScanValidationError("Analysis run does not have a valid pinned commit SHA")
        return run

    def create_scan(self, project_id: str, analysis_run_id: str | None = None) -> Scan:
        self._owned_project(project_id)
        run = self._select_analysis_run(project_id, analysis_run_id)

        active = (
            self.db.query(Scan)
            .filter(
                Scan.project_id == project_id,
                Scan.status.in_([ScanStatus.QUEUED.value, ScanStatus.INGESTING.value, ScanStatus.SCANNING.value, ScanStatus.NORMALIZING.value]),
            )
            .first()
        )
        if active:
            raise ScanValidationError(f"An active scan already exists: {active.id}")

        scan = Scan(
            project_id=project_id,
            analysis_run_id=run.id,
            commit_sha=run.commit_sha,
            status=ScanStatus.QUEUED.value,
            progress_percent=0,
            current_stage="Scan queued",
        )
        self.db.add(scan)
        self.db.commit()
        self.db.refresh(scan)
        logger.info("scan=%s queued project=%s analysis_run=%s commit=%s", scan.id, project_id, run.id, run.commit_sha)
        return scan

    def _queue_engine_runs(self, scan: Scan, engines: Iterable[ScannerEngine]) -> dict[str, ScanEngineRun]:
        records: dict[str, ScanEngineRun] = {}
        for engine in engines:
            container_name_fn = getattr(self.docker_runner, "container_name", None)
            if container_name_fn is None:
                container_name = DockerRunner.container_name(scan.id, engine.name)
            else:
                container_name = container_name_fn(scan.id, engine.name)
            record = ScanEngineRun(
                scan_id=scan.id,
                engine_name=engine.name,
                container_name=container_name,
                status="QUEUED",
            )
            self.db.add(record)
            records[engine.name] = record
        self.db.commit()
        for record in records.values():
            self.db.refresh(record)
        return records

    def _start_engine_run(self, record: ScanEngineRun) -> None:
        record.status = "RUNNING"
        record.started_at = datetime.utcnow()
        self.db.commit()

    def _finish_engine_run(self, record: ScanEngineRun, result: ScannerExecutionResult) -> None:
        record.status = result.status.value
        record.exit_code = result.exit_code
        record.duration_ms = result.duration_ms
        record.artifact_reference = result.artifact_reference
        record.error_message = result.error_message
        record.stdout = (result.stdout or "")[-settings.SCANNER_LOG_MAX_CHARS:] or None
        record.stderr = (result.stderr or "")[-settings.SCANNER_LOG_MAX_CHARS:] or None
        record.completed_at = datetime.utcnow()
        self.db.commit()

    @staticmethod
    def _safe_engine_name(name: str) -> str:
        safe = "".join(ch if ch.isalnum() or ch in {"-", "_", "."} else "_" for ch in name)
        return safe[:64] or "engine"

    def _run_engine(
        self,
        scan: Scan,
        workspace,
        engine: ScannerEngine,
        timeout_seconds: int,
    ) -> ScannerExecutionResult:
        engine_output = (workspace.output / self._safe_engine_name(engine.name)).resolve()
        if os.path.commonpath([str(workspace.output.resolve()), str(engine_output)]) != str(workspace.output.resolve()):
            raise ScanOrchestrationError("Invalid engine output path")
        engine_output.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(engine_output, 0o777)
        except OSError:
            # Docker Desktop/Windows may not expose POSIX permissions.
            pass
        context = ScannerExecutionContext(
            scan_id=scan.id,
            workspace_path=workspace.source,
            output_path=engine_output,
            timeout_seconds=max(1, timeout_seconds),
            environment={"ARVE_TEST_MODE": settings.SCANNER_TEST_MODE} if engine.name == "phase3-test" else {},
        )
        command = list(engine.build_command(context))
        image = getattr(engine, "image", None)
        if not image:
            raise ScanOrchestrationError(f"Scanner engine '{engine.name}' does not declare a Docker image")

        docker_result = self.docker_runner.run(
            context=context,
            engine_name=engine.name,
            image=image,
            engine_command=command,
        )
        artifact_path = engine.artifact_path(context)
        if artifact_path and not artifact_path.exists():
            artifact_path = None

        return ScannerExecutionResult(
            engine_name=engine.name,
            status=docker_result.status,
            exit_code=docker_result.exit_code,
            duration_ms=docker_result.duration_ms,
            artifact_path=artifact_path,
            stdout=docker_result.stdout,
            stderr=docker_result.stderr,
            error_message=docker_result.error_message,
        )

    def execute_scan(self, scan_id: str) -> Scan:
        scan = self.db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            raise ScanValidationError("Scan not found")

        workspace = None
        try:
            scan.started_at = datetime.utcnow()
            self.db.commit()
            self._set_status(scan, ScanStatus.INGESTING, progress=5, stage="Validating Phase 2 snapshot")
            workspace = self.workspace_manager.build(scan)
            self._set_status(
                scan,
                ScanStatus.SCANNING,
                progress=25,
                stage=f"Executing {len(self.registry.list())} scanner engine(s)",
            )

            engines = self.registry.list()
            if not engines:
                # Never report a successful scan when there is no execution
                # engine. Phase 3 can run with the disabled-by-default smoke
                # engine; Phase 4 will register the real security engines.
                self._set_status(
                    scan,
                    ScanStatus.FAILED,
                    progress=25,
                    stage="No scanner engines registered",
                    error_message=(
                        "No scanner engines are registered. Enable the Phase 3 smoke engine "
                        "for orchestration testing or register Phase 4 engines."
                    ),
                )
                scan.completed_at = datetime.utcnow()
                self.db.commit()
                return scan

            results: list[ScannerExecutionResult] = []
            total = len(engines)
            engine_runs = self._queue_engine_runs(scan, engines)
            deadline = time.monotonic() + settings.SCANNER_GLOBAL_TIMEOUT_SECONDS
            global_timeout_reached = False

            for index, engine in enumerate(engines, start=1):
                current = self.db.query(Scan).filter(Scan.id == scan.id).first()
                if not current:
                    raise ScanValidationError("Scan disappeared during execution")
                scan = current
                if scan.status == ScanStatus.CANCELLED.value:
                    return scan

                remaining = int(deadline - time.monotonic())
                if remaining <= 0:
                    global_timeout_reached = True
                    break

                progress = 25 + int(((index - 1) / total) * 60)
                self._set_status(scan, ScanStatus.SCANNING, progress=progress, stage=f"Running {engine.name}")
                engine_run = engine_runs[engine.name]
                self._start_engine_run(engine_run)
                try:
                    result = self._run_engine(
                        scan,
                        workspace,
                        engine,
                        timeout_seconds=min(settings.SCANNER_ENGINE_TIMEOUT_SECONDS, remaining),
                    )
                    persisted_artifact = self.artifact_store.persist_output(
                        scan.id, engine.name, workspace.output / self._safe_engine_name(engine.name)
                    )
                    if persisted_artifact:
                        result = ScannerExecutionResult(
                            engine_name=result.engine_name,
                            status=result.status,
                            exit_code=result.exit_code,
                            duration_ms=result.duration_ms,
                            artifact_path=None,
                            artifact_reference=persisted_artifact,
                            stdout=result.stdout,
                            stderr=result.stderr,
                            error_message=result.error_message,
                        )
                    self._finish_engine_run(engine_run, result)
                except ScannerExecutionError:
                    raise
                except Exception as exc:
                    result = ScannerExecutionResult(
                        engine_name=engine.name,
                        status=EngineExecutionStatus.FAILED,
                        error_message=str(exc),
                    )
                    self._finish_engine_run(engine_run, result)
                results.append(result)

                refreshed = self.db.query(Scan).filter(Scan.id == scan.id).first()
                if refreshed and refreshed.status == ScanStatus.CANCELLED.value:
                    return refreshed
                scan = refreshed or scan

                if result.status == EngineExecutionStatus.CANCELLED:
                    self._set_status(scan, ScanStatus.CANCELLED, progress=progress, stage=f"{engine.name} cancelled")
                    return scan

            if time.monotonic() >= deadline and len(results) < len(engines):
                global_timeout_reached = True

            failures = [r for r in results if r.status != EngineExecutionStatus.SUCCESS]
            self._set_status(
                scan,
                ScanStatus.NORMALIZING,
                progress=90,
                stage="Scanner execution finished; awaiting finding normalization",
            )
            if global_timeout_reached:
                message = "Global scan timeout reached before all engines completed"
                if failures:
                    message += "; " + "; ".join(
                        f"{r.engine_name}: {r.error_message or r.status.value}" for r in failures
                    )
                target = ScanStatus.PARTIAL if results else ScanStatus.FAILED
                self._set_status(
                    scan,
                    target,
                    progress=100 if target == ScanStatus.PARTIAL else min(scan.progress_percent or 0, 99),
                    stage="Global scan timeout reached",
                    error_message=message,
                )
            elif failures:
                self._set_status(
                    scan,
                    ScanStatus.PARTIAL,
                    progress=100,
                    stage="Scan completed with partial engine failures",
                    error_message="; ".join(f"{r.engine_name}: {r.error_message or r.status.value}" for r in failures),
                )
            else:
                self._set_status(scan, ScanStatus.COMPLETED, progress=100, stage="Scan orchestration completed")
            scan.completed_at = datetime.utcnow()
            self.db.commit()
            return scan

        except ScanOrchestrationError as exc:
            logger.error("scan=%s orchestration failed: %s", scan_id, exc)
            self.db.rollback()
            scan = self.db.query(Scan).filter(Scan.id == scan_id).first()
            if scan and scan.status not in {ScanStatus.CANCELLED.value, ScanStatus.PARTIAL.value, ScanStatus.COMPLETED.value}:
                scan.status = ScanStatus.FAILED.value
                scan.progress_percent = min(scan.progress_percent or 0, 99)
                scan.current_stage = "Scan failed"
                scan.error_message = str(exc)
                scan.completed_at = datetime.utcnow()
                self.db.commit()
            return scan
        except Exception as exc:
            logger.exception("scan=%s unexpected orchestration failure", scan_id)
            self.db.rollback()
            scan = self.db.query(Scan).filter(Scan.id == scan_id).first()
            if scan and scan.status not in {ScanStatus.CANCELLED.value, ScanStatus.PARTIAL.value, ScanStatus.COMPLETED.value}:
                scan.status = ScanStatus.FAILED.value
                scan.progress_percent = min(scan.progress_percent or 0, 99)
                scan.current_stage = "Scan failed"
                scan.error_message = str(exc)
                scan.completed_at = datetime.utcnow()
                self.db.commit()
            return scan
        finally:
            if workspace is not None:
                try:
                    self.workspace_manager.cleanup(scan_id)
                except Exception:
                    logger.exception("scan=%s failed to clean workspace", scan_id)

    def cancel_scan(self, scan_id: str) -> Scan:
        scan = self.db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            raise ScanValidationError("Scan not found")
        if scan.status in {ScanStatus.COMPLETED.value, ScanStatus.PARTIAL.value, ScanStatus.FAILED.value, ScanStatus.CANCELLED.value}:
            return scan

        if not ScanStateMachine.can_transition(scan.status, ScanStatus.CANCELLED):
            return scan
        self.docker_runner.cancel(scan_id)
        self._set_status(
            scan,
            ScanStatus.CANCELLED,
            progress=min(scan.progress_percent or 0, 99),
            stage="Scan cancelled",
        )
        scan.completed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(scan)
        return scan
