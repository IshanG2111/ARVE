"""Gitleaks security engine for ARVE Phase 4A."""
from __future__ import annotations

from pathlib import Path
from typing import Sequence

from app.core.config import settings
from app.scanner.interfaces import ScannerEngine, ScannerExecutionContext
from app.security.models import EngineName


class GitleaksEngine:
    """ScannerEngine implementation for Gitleaks secret detection."""

    name: str = EngineName.GITLEAKS.value
    image: str = getattr(
        settings,
        "SCANNER_GITLEAKS_IMAGE",
        "ghcr.io/gitleaks/gitleaks:v8.24.2",
    )

    def build_command(self, context: ScannerExecutionContext) -> Sequence[str]:
        """Build the Gitleaks directory-scan command.

        DockerRunner mounts the Phase 2 snapshot at ``/code`` read-only and
        the engine-specific output directory at ``/output``.
        """
        return [
            "dir",
            "/code",
            "--report-format",
            "json",
            "--report-path",
            "/output/gitleaks.json",
            "--redact",
        ]

    def artifact_path(self, context: ScannerExecutionContext) -> Path:
        """Return the expected Gitleaks JSON artifact path on the host."""
        return context.output_path / "gitleaks.json"


assert isinstance(GitleaksEngine.name, str)
