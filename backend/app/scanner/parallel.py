"""Parallel Phase 4A scan execution for OSV-Scanner and Gitleaks."""
from __future__ import annotations

import concurrent.futures
import logging
import os
import time
from datetime import datetime

from app.core.config import settings
from app.models.models import Scan, ScanEngineRun
from app.scanner.exceptions import ScanOrchestrationError, ScanValidationError, ScannerExecutionError
from app.scanner.interfaces import EngineExecutionStatus, ScannerExecutionResult
from app.scanner.service import ScanExecutionService, build_default_registry
from app.scanner.state_machine import ScanStateMachine, ScanStatus
from app.security.mappers import GitleaksFindingMapper, OsvFindingMapper
from app.security.normalizer import FindingNormalizer

logger = logging.getLogger(__name__)


class ParallelSecurityScanService(ScanExecutionService):
    """Execute all enabled security engines concurrently on one snapshot.

    Database work stays on the owning worker thread. Scanner Docker processes
    are the only work submitted to the thread pool, so SQLAlchemy sessions are
    never shared between threads.
    """

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

            engines = self.registry.list()
            if not engines:
                self._set_status(
                    scan,
                    ScanStatus.FAILED,
                    progress=25,
                    stage="No scanner engines registered",
                    error_message="No security scanner engines are enabled.",
                )
                scan.completed_at = datetime.utcnow()
                self.db.commit()
                return scan

            self._set_status(
                scan,
                ScanStatus.SCANNING,
                progress=25,
                stage=f"Running {len(engines)} security engines in parallel",
            )
            engine_runs = self._queue_engine_runs(scan, engines)
            for record in engine_runs.values():
                self._start_engine_run(record)

            # Capture immutable scan context before entering worker threads.
            # Never pass the SQLAlchemy-bound Scan ORM object to the thread pool.
            scan_id_value = str(scan.id)
            project_id_value = str(scan.project_id)
            commit_sha_value = str(scan.commit_sha)

            deadline = time.monotonic() + settings.SCANNER_GLOBAL_TIMEOUT_SECONDS
            results: dict[str, ScannerExecutionResult] = {}
            all_db_findings = []
            mappers = [OsvFindingMapper(), GitleaksFindingMapper()]
            normalizer = FindingNormalizer(mappers)

            def run_one(engine):
                remaining = int(deadline - time.monotonic())
                if remaining <= 0:
                    return ScannerExecutionResult(
                        engine_name=engine.name,
                        status=EngineExecutionStatus.TIMEOUT,
                        error_message="Global scan timeout reached before engine start",
                    )
                try:
                    return self._run_engine(
                        scan_id_value,
                        workspace,
                        engine,
                        timeout_seconds=min(settings.SCANNER_ENGINE_TIMEOUT_SECONDS, remaining),
                    )
                except ScannerExecutionError:
                    raise
                except Exception as exc:
                    return ScannerExecutionResult(
                        engine_name=engine.name,
                        status=EngineExecutionStatus.FAILED,
                        error_message=str(exc),
                    )

            max_workers = max(1, len(engines))
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {executor.submit(run_one, engine): engine for engine in engines}
                for future in concurrent.futures.as_completed(futures):
                    engine = futures[future]
                    try:
                        result = future.result()
                    except Exception as exc:
                        result = ScannerExecutionResult(
                            engine_name=engine.name,
                            status=EngineExecutionStatus.FAILED,
                            error_message=str(exc),
                        )

                    results[engine.name] = result
                    engine_dir = workspace.output / self._safe_engine_name(engine.name)

                    if result.status == EngineExecutionStatus.SUCCESS and engine_dir.exists():
                        artifact_path = result.artifact_path
                        if artifact_path and artifact_path.exists() and artifact_path.stat().st_size > 0:
                            try:
                                raw_text = artifact_path.read_text(encoding="utf-8")
                                normalized = normalizer.normalize_artifact(
                                    engine.name,
                                    raw_text,
                                    context={"scan_id": scan_id_value, "commit_sha": commit_sha_value},
                                )
                                all_db_findings.extend(
                                    FindingNormalizer.to_db_models(
                                        normalized,
                                        scan_id=scan_id_value,
                                        project_id=project_id_value,
                                    )
                                )
                            except Exception as exc:
                                logger.warning(
                                    "scan=%s engine=%s normalization failed: %s",
                                    scan_id_value,
                                    engine.name,
                                    exc,
                                )

                        try:
                            persisted = self.artifact_store.persist_output(scan_id_value, engine.name, engine_dir)
                            if persisted:
                                result = ScannerExecutionResult(
                                    engine_name=result.engine_name,
                                    status=result.status,
                                    exit_code=result.exit_code,
                                    duration_ms=result.duration_ms,
                                    artifact_path=None,
                                    artifact_reference=persisted,
                                    stdout=result.stdout,
                                    stderr=result.stderr,
                                    error_message=result.error_message,
                                )
                                results[engine.name] = result
                        except Exception as exc:
                            result = ScannerExecutionResult(
                                engine_name=engine.name,
                                status=EngineExecutionStatus.FAILED,
                                exit_code=result.exit_code,
                                duration_ms=result.duration_ms,
                                stdout=result.stdout,
                                stderr=result.stderr,
                                error_message=str(exc),
                            )
                            results[engine.name] = result

                    self._finish_engine_run(engine_runs[engine.name], result)
                    completed_count = len(results)
                    progress = 25 + int((completed_count / len(engines)) * 60)
                    current = self.db.query(Scan).filter(Scan.id == scan_id_value).first()
                    if current and current.status != ScanStatus.CANCELLED.value:
                        self._set_status(
                            current,
                            ScanStatus.SCANNING,
                            progress=progress,
                            stage=f"{completed_count}/{len(engines)} security engines completed",
                        )

            # A cancelled scan is terminal and must not be overwritten.
            scan = self.db.query(Scan).filter(Scan.id == scan_id_value).first() or scan
            if scan.status == ScanStatus.CANCELLED.value:
                return scan

            # Any engine missing from the completed results did not finish.
            for engine in engines:
                if engine.name not in results:
                    result = ScannerExecutionResult(
                        engine_name=engine.name,
                        status=EngineExecutionStatus.TIMEOUT,
                        error_message="Global scan timeout reached before engine completed",
                    )
                    results[engine.name] = result
                    self._finish_engine_run(engine_runs[engine.name], result)

            failures = [r for r in results.values() if r.status != EngineExecutionStatus.SUCCESS]
            self._set_status(scan, ScanStatus.NORMALIZING, progress=90, stage="Persisting normalized security findings")

            if all_db_findings:
                self.db.add_all(all_db_findings)
                self.db.commit()
                logger.info("scan=%s persisted %d security findings", scan.id, len(all_db_findings))

            if failures:
                message = "; ".join(
                    f"{r.engine_name}: {r.error_message or r.status.value}" for r in failures
                )
                self._set_status(
                    scan,
                    ScanStatus.PARTIAL,
                    progress=100,
                    stage="Security scan completed with engine failures",
                    error_message=message,
                )
            else:
                self._set_status(scan, ScanStatus.COMPLETED, progress=100, stage="Security scan completed")

            scan.completed_at = datetime.utcnow()
            self.db.commit()
            return scan

        except ScanOrchestrationError as exc:
            logger.error("scan=%s orchestration failed: %s", scan_id, exc)
            self.db.rollback()
            scan = self.db.query(Scan).filter(Scan.id == scan_id).first()
            if scan and scan.status not in {ScanStatus.CANCELLED.value, ScanStatus.PARTIAL.value, ScanStatus.COMPLETED.value}:
                scan.status = ScanStatus.FAILED.value
                scan.current_stage = "Scan failed"
                scan.error_message = str(exc)
                scan.completed_at = datetime.utcnow()
                self.db.commit()
            return scan
        except Exception as exc:
            logger.exception("scan=%s unexpected parallel scan failure", scan_id)
            self.db.rollback()
            scan = self.db.query(Scan).filter(Scan.id == scan_id).first()
            if scan and scan.status not in {ScanStatus.CANCELLED.value, ScanStatus.PARTIAL.value, ScanStatus.COMPLETED.value}:
                scan.status = ScanStatus.FAILED.value
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


def build_security_registry():
    """Build the Phase 4A OSV + Gitleaks registry."""
    registry = build_default_registry()
    # build_default_registry may already contain OSV.
    if settings.SCANNER_ENABLE_GITLEAKS:
        from app.scanner.engines.gitleaks import GitleaksEngine

        if not any(engine.name == "gitleaks" for engine in registry.list()):
            registry.register(GitleaksEngine())
    return registry
