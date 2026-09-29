"""GitHub CodeQL deep SAST engine for ARVE.

The CodeQL container ships a pinned CodeQL CLI bundle and query packs. It
detects supported languages inside the immutable Phase-2 snapshot, creates a
separate temporary database for each detected language, analyzes each database
with the configured query suite, and merges the resulting SARIF runs into one
native artifact.
"""
from __future__ import annotations

from pathlib import Path
from typing import Sequence

from app.core.config import settings
from app.scanner.interfaces import ScannerExecutionContext
from app.security.models import EngineName


class CodeqlEngine:
    """ScannerEngine implementation for CodeQL deep SAST."""

    name: str = EngineName.CODEQL.value
    image: str = getattr(settings, "SCANNER_CODEQL_IMAGE", "arve-codeql:2.27.1")

    def build_command(self, context: ScannerExecutionContext) -> Sequence[str]:
        """Construct the in-container ARVE CodeQL wrapper invocation."""
        return [
            "/opt/arve-codeql/run-codeql.sh",
            "--workspace",
            "/code",
            "--output",
            "/output/codeql.sarif",
            "--profile",
            getattr(settings, "SCANNER_CODEQL_QUERY_SUITE", "security-extended"),
        ]

    def artifact_path(self, context: ScannerExecutionContext) -> Path:
        """Return the merged native CodeQL SARIF artifact path."""
        return context.output_path / "codeql.sarif"


assert isinstance(CodeqlEngine.name, str)
