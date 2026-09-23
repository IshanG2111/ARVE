"""Semgrep SAST Security Engine for ARVE.

Runs Semgrep inside an isolated Docker sandbox to scan source code
for insecure code patterns, injection risks, and dataflow vulnerabilities.
"""
from __future__ import annotations

from pathlib import Path
from typing import Sequence

from app.core.config import settings
from app.scanner.interfaces import ScannerExecutionContext
from app.security.models import EngineName


class SemgrepEngine:
    """ScannerEngine implementation for Semgrep SAST detection."""

    name: str = EngineName.SEMGREP.value
    image: str = getattr(
        settings,
        "SCANNER_SEMGREP_IMAGE",
        "semgrep/semgrep:1.90.0",
    )

    @property
    def rulepack_version(self) -> str:
        from app.security.semgrep.rules import get_rulepack_version
        return get_rulepack_version()

    def build_command(self, context: ScannerExecutionContext) -> Sequence[str]:
        """Construct CLI arguments executed inside the Semgrep container.

        DockerRunner mounts:
        - /code: read-only workspace snapshot
        - /output: writable output directory
        """
        config_val = getattr(settings, "SCANNER_SEMGREP_RULES_PATH", None) or getattr(
            settings, "SCANNER_SEMGREP_CONFIG", "auto"
        )
        config = "/rules" if config_val in {"auto", "/rules", "bundled"} else config_val
        return [
            "semgrep",
            "scan",
            "--json",
            "--output",
            "/output/semgrep.json",
            "--metrics=off",
            "--disable-version-check",
            "--quiet",
            "--config",
            config,
            "/code",
        ]

    def artifact_path(self, context: ScannerExecutionContext) -> Path:
        """Return the expected raw Semgrep JSON artifact path on the host."""
        return context.output_path / "semgrep.json"


# Verify static protocol compliance
assert isinstance(SemgrepEngine.name, str)
