"""OSV-Scanner Security Engine for ARVE Phase 4A.

Runs official Google OSV-Scanner inside the isolated Docker sandbox to scan
dependency manifests/lockfiles for known vulnerabilities.
"""
from __future__ import annotations

from pathlib import Path
from typing import Sequence

from app.core.config import settings
from app.scanner.interfaces import ScannerEngine, ScannerExecutionContext
from app.security.models import EngineName


class OsvEngine:
    """ScannerEngine implementation for OSV-Scanner."""

    name: str = EngineName.OSV.value
    image: str = settings.SCANNER_OSV_IMAGE or "ghcr.io/google/osv-scanner:v1.9.2"

    def build_command(self, context: ScannerExecutionContext) -> Sequence[str]:
        """Construct the CLI arguments executed inside the OSV-Scanner container.

        Mounts inside Docker container:
        - /code: read-only workspace snapshot
        - /output: writable output directory
        """
        return ["--format", "json", "--output", "/output/osv.json", "-r", "/code"]

    def artifact_path(self, context: ScannerExecutionContext) -> Path:
        """Return the expected raw OSV JSON artifact path on the host."""
        return context.output_path / "osv.json"


# Verify static protocol compliance
assert isinstance(OsvEngine.name, str)
