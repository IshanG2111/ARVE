"""Shared finding normalizer and mapper registry for ARVE security engines."""
from __future__ import annotations

import datetime
import json
import logging
from typing import Any, Optional, Union

from app.security.fingerprint import compute_finding_fingerprint
from app.security.mappers.base import FindingMapper
from app.security.models import NormalizedFinding, normalize_engine_name

logger = logging.getLogger(__name__)


class FindingNormalizer:
    """Central normalization coordinator and mapper registry for security scan results."""

    def __init__(self, mappers: Optional[list[FindingMapper]] = None) -> None:
        self._mappers: dict[str, FindingMapper] = {}
        if mappers:
            for mapper in mappers:
                self.register_mapper(mapper)

    def register_mapper(self, mapper: FindingMapper) -> None:
        """Register a FindingMapper instance for its canonical engine identifier."""
        canonical_name = normalize_engine_name(mapper.engine_name)
        if canonical_name in self._mappers:
            logger.warning("Overwriting existing mapper for engine: %s", canonical_name)
        self._mappers[canonical_name] = mapper

    def get_mapper(self, engine_name: str) -> Optional[FindingMapper]:
        """Retrieve a registered mapper by engine name."""
        canonical_name = normalize_engine_name(engine_name)
        return self._mappers.get(canonical_name)

    def normalize_artifact(
        self,
        engine_name: str,
        raw_content: Any,
        context: Optional[dict[str, Any]] = None,
    ) -> list[NormalizedFinding]:
        """Parse raw engine artifact and return validated, fingerprinted NormalizedFindings."""
        canonical_name = normalize_engine_name(engine_name)
        mapper = self.get_mapper(canonical_name)
        if not mapper:
            raise ValueError(f"No FindingMapper registered for engine '{engine_name}' (canonical: '{canonical_name}')")

        findings = mapper.map_artifact(raw_content, context)
        validated: list[NormalizedFinding] = []

        for finding in findings:
            # Ensure engine name is canonical
            if finding.engine != canonical_name:
                finding = finding.model_copy(update={"engine": canonical_name})

            # Ensure deterministic fingerprint is present
            if not finding.fingerprint:
                computed_fp = compute_finding_fingerprint(finding)
                finding = finding.model_copy(update={"fingerprint": computed_fp})

            validated.append(finding)

        return validated

    @staticmethod
    def to_db_models(
        findings: list[NormalizedFinding],
        scan_id: str,
        project_id: str,
    ) -> list[Any]:
        """Convert a list of NormalizedFinding instances to SecurityFinding ORM entities."""
        from app.models.models import SecurityFinding

        now = datetime.datetime.utcnow()
        db_records: list[SecurityFinding] = []

        for f in findings:
            raw_data = f.raw_json
            if isinstance(raw_data, (dict, list)):
                raw_payload = json.dumps(raw_data)
            elif isinstance(raw_data, str):
                raw_payload = raw_data
            else:
                raw_payload = None

            # Calculate fingerprint if somehow missing
            fp = f.fingerprint or compute_finding_fingerprint(f)

            record = SecurityFinding(
                scan_id=scan_id,
                project_id=project_id,
                engine=f.engine,
                finding_type=f.finding_type,
                title=f.title,
                description=f.description,
                severity=f.severity.value if hasattr(f.severity, "value") else str(f.severity),
                confidence=f.confidence.value if hasattr(f.confidence, "value") and f.confidence else None,
                status=f.status.value if hasattr(f.status, "value") else str(f.status),
                file_path=f.file_path,
                line_start=f.line_start,
                line_end=f.line_end,
                package_name=f.package_name,
                package_version=f.package_version,
                ecosystem=f.ecosystem,
                cve=f.cve,
                ghsa=f.ghsa,
                cwe=f.cwe,
                rule_id=f.rule_id,
                fingerprint=fp,
                raw_json=raw_payload,
                created_at=now,
                updated_at=now,
            )
            db_records.append(record)

        return db_records
