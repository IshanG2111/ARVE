"""Engine-independent FindingMapper contract for ARVE Phase 4A."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional

from app.security.models import NormalizedFinding


class FindingMapper(ABC):
    """Abstract interface defining the contract for scanner artifact mappers.

    Each security engine (e.g. OSV-Scanner, Gitleaks, Semgrep) implements
    this interface to transform its native artifact JSON/output into a list of
    canonical NormalizedFinding objects.
    """

    @property
    @abstractmethod
    def engine_name(self) -> str:
        """Canonical identifier of the scanner engine (e.g. 'osv', 'gitleaks')."""
        ...

    @abstractmethod
    def map_artifact(
        self,
        raw_content: Any,
        context: Optional[dict[str, Any]] = None,
    ) -> list[NormalizedFinding]:
        """Parse raw scanner artifact content and return canonical NormalizedFindings.

        Parameters:
            raw_content: Raw engine output (parsed dict/list or string content).
            context: Optional execution context metadata (e.g. workspace paths, commit SHA).

        Returns:
            List of validated NormalizedFinding instances.
        """
        ...
