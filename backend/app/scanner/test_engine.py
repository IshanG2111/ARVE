"""Phase 3-only Docker smoke-test engine.

This is not a security scanner and is disabled by default. It exists so Phase
3 can be closed and tested end-to-end before Phase 4 adds Semgrep, OSV-Scanner,
and Gitleaks.
"""
from __future__ import annotations

from pathlib import Path

from app.core.config import settings
from app.scanner.interfaces import ScannerEngine, ScannerExecutionContext


class Phase3TestEngine:
    name = "phase3-test"
    image = settings.SCANNER_TEST_IMAGE

    def build_command(self, context: ScannerExecutionContext):
        return ["/usr/local/bin/arve-phase3-test-scanner"]

    def artifact_path(self, context: ScannerExecutionContext) -> Path:
        return context.output_path / "phase3-result.json"


# Keep the explicit type marker useful to static tooling without making the
# Protocol runtime-dependent.
assert isinstance(Phase3TestEngine.name, str)
