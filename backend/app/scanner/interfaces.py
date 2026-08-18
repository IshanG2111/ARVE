"""Engine-agnostic scanner contracts used by Phase 3 orchestration.

Phase 4 engines (Semgrep, OSV-Scanner, Gitleaks) will implement this contract.
Phase 3 deliberately knows nothing about scanner-specific command syntax or
finding formats.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Mapping, Optional, Protocol, Sequence


class EngineExecutionStatus(str, Enum):
    SUCCESS = "COMPLETED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"
    CANCELLED = "CANCELLED"


@dataclass(frozen=True)
class ScannerExecutionContext:
    scan_id: str
    workspace_path: Path
    output_path: Path
    timeout_seconds: int
    environment: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ScannerExecutionResult:
    engine_name: str
    status: EngineExecutionStatus
    exit_code: Optional[int] = None
    duration_ms: Optional[int] = None
    artifact_path: Optional[Path] = None
    artifact_reference: Optional[str] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    error_message: Optional[str] = None


class ScannerEngine(Protocol):
    """Minimal contract every future security engine must implement."""

    name: str

    def build_command(self, context: ScannerExecutionContext) -> Sequence[str]:
        """Return the command that runs inside the scanner container."""
        ...

    def artifact_path(self, context: ScannerExecutionContext) -> Optional[Path]:
        """Return the expected output artifact, if the engine produces one."""
        ...
