"""Docker execution sandbox for scanner engines.

This module intentionally knows nothing about Semgrep/OSV/Gitleaks semantics.
It only executes a command in an isolated container and returns process facts.
"""
from __future__ import annotations

import logging
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from app.core.config import settings
from app.scanner.interfaces import EngineExecutionStatus, ScannerExecutionContext, ScannerExecutionResult
from app.scanner.exceptions import ScannerExecutionError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DockerRunResult:
    status: EngineExecutionStatus
    exit_code: int | None
    duration_ms: int
    stdout: str
    stderr: str
    error_message: str | None = None


class DockerRunner:
    """Run untrusted scanner commands inside a locked-down Docker container."""

    _global_lock = threading.Lock()
    _global_active: dict[str, str] = {}

    def __init__(self, docker_binary: str | None = None):
        self.docker_binary = docker_binary or settings.DOCKER_BINARY
        self._lock = DockerRunner._global_lock
        self._active = DockerRunner._global_active

    @classmethod
    def container_name(cls, scan_id: str, engine_name: str) -> str:
        return cls._container_name(scan_id, engine_name)

    @staticmethod
    def _container_name(scan_id: str, engine_name: str) -> str:
        safe_scan = "".join(ch if ch.isalnum() else "-" for ch in scan_id)[:32]
        safe_engine = "".join(ch if ch.isalnum() else "-" for ch in engine_name.lower())[:24]
        return f"arve-{safe_scan}-{safe_engine}"[:63].rstrip("-")

    def _build_command(
        self,
        context: ScannerExecutionContext,
        engine_name: str,
        image: str,
        engine_command: Sequence[str],
    ) -> list[str]:
        container_name = self._container_name(context.scan_id, engine_name)
        network = getattr(settings, "SCANNER_OSV_NETWORK", "bridge") if engine_name == "osv" else getattr(settings, "SCANNER_NETWORK_MODE", "none")
        command = [
            self.docker_binary,
            "run",
            "--rm",
            "--name",
            container_name,
            f"--network={network}",
            "--read-only",
            "--memory",
            settings.SCANNER_MEMORY_LIMIT,
            "--cpus",
            str(settings.SCANNER_CPU_LIMIT),
            "--user",
            settings.SCANNER_CONTAINER_USER,
            "--mount",
            f"type=bind,source={context.workspace_path.resolve()},target=/code,readonly",
            "--mount",
            f"type=bind,source={context.output_path.resolve()},target=/output",
        ]
        for key, value in sorted(context.environment.items()):
            command.extend(["--env", f"{key}={value}"])
        command.extend([image, *engine_command])
        return command

    def _check_docker_available(self) -> None:
        try:
            result = subprocess.run(
                [self.docker_binary, "version", "--format", "{{.Server.Version}}"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            raise ScannerExecutionError(f"Docker is unavailable: {exc}") from exc
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip()
            raise ScannerExecutionError(f"Docker is unavailable: {detail or 'unknown error'}")

    def run(
        self,
        context: ScannerExecutionContext,
        engine_name: str,
        image: str,
        engine_command: Sequence[str],
    ) -> DockerRunResult:
        self._check_docker_available()
        container_name = self._container_name(context.scan_id, engine_name)
        command = self._build_command(context, engine_name, image, engine_command)
        logger.info("scan=%s engine=%s starting docker container=%s", context.scan_id, engine_name, container_name)

        started = time.monotonic()
        process = None
        with self._lock:
            self._active[context.scan_id] = container_name
        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            try:
                stdout, stderr = process.communicate(timeout=context.timeout_seconds)
                duration_ms = int((time.monotonic() - started) * 1000)
                status = EngineExecutionStatus.SUCCESS if process.returncode == 0 else EngineExecutionStatus.FAILED
                return DockerRunResult(
                    status=status,
                    exit_code=process.returncode,
                    duration_ms=duration_ms,
                    stdout=stdout or "",
                    stderr=stderr or "",
                    error_message=None if status == EngineExecutionStatus.SUCCESS else (stderr or "process failed").strip(),
                )
            except subprocess.TimeoutExpired:
                self._stop_container(container_name)
                stdout, stderr = process.communicate(timeout=10)
                duration_ms = int((time.monotonic() - started) * 1000)
                return DockerRunResult(
                    status=EngineExecutionStatus.TIMEOUT,
                    exit_code=process.returncode,
                    duration_ms=duration_ms,
                    stdout=stdout or "",
                    stderr=stderr or "",
                    error_message=f"Engine timed out after {context.timeout_seconds}s",
                )
        except OSError as exc:
            raise ScannerExecutionError(f"Failed to start Docker: {exc}") from exc
        finally:
            with self._lock:
                self._active.pop(context.scan_id, None)

    def _stop_container(self, container_name: str) -> None:
        try:
            subprocess.run(
                [self.docker_binary, "stop", "-t", "5", container_name],
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            logger.warning("Failed to stop Docker container %s: %s", container_name, exc)

    def cancel(self, scan_id: str) -> bool:
        """Stop the active container for a scan.

        The API process and Celery worker are different processes, so an
        in-memory active-container map cannot be the sole cancellation source.
        We derive the container name prefix from the stable scan id and ask
        Docker directly. The in-memory map remains useful for local tests and
        fast-path observability.
        """
        with self._lock:
            active_names = [name for sid, name in self._active.items() if sid == scan_id]
        if active_names:
            for name in active_names:
                self._stop_container(name)
            return True

        prefix = self._container_prefix(scan_id)
        try:
            result = subprocess.run(
                [
                    self.docker_binary,
                    "ps",
                    "-q",
                    "--filter",
                    f"name={prefix}",
                ],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            logger.warning("Failed to query Docker containers for scan %s: %s", scan_id, exc)
            return False

        container_ids = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        for container_id in container_ids:
            try:
                subprocess.run(
                    [self.docker_binary, "stop", "-t", "5", container_id],
                    capture_output=True,
                    text=True,
                    timeout=15,
                    check=False,
                )
            except (OSError, subprocess.SubprocessError) as exc:
                logger.warning("Failed to stop Docker container %s: %s", container_id, exc)
        return bool(container_ids)

    @classmethod
    def _container_prefix(cls, scan_id: str) -> str:
        safe_scan = "".join(ch if ch.isalnum() else "-" for ch in scan_id)[:32]
        return f"arve-{safe_scan}-"
