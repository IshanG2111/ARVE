"""Multi-engine orchestration integration tests (OSV + Gitleaks + Semgrep + CodeQL)."""
import json
from pathlib import Path

from app.core.config import settings
from app.scanner.service import build_default_registry
from app.security.models import FindingType, NormalizedFinding
from app.security.normalizer import FindingNormalizer
from app.security.mappers import CodeqlFindingMapper, GitleaksFindingMapper, OsvFindingMapper, SemgrepFindingMapper

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"


def test_registry_contains_all_four_engines_by_default(monkeypatch):
    monkeypatch.setattr(settings, "SCANNER_ENABLE_TEST_ENGINE", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_OSV", True)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_GITLEAKS", True)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_SEMGREP", True)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_CODEQL", True)

    registry = build_default_registry()
    names = {e.name for e in registry.list()}
    assert names == {"osv", "gitleaks", "semgrep", "codeql"}


def test_multi_engine_normalization_pipeline():
    """Verify FindingNormalizer handles all four security engines."""
    normalizer = FindingNormalizer([
        OsvFindingMapper(),
        GitleaksFindingMapper(),
        SemgrepFindingMapper(),
        CodeqlFindingMapper(),
    ])

    osv_raw = (FIXTURES_DIR / "osv" / "sample_osv_report.json").read_text(encoding="utf-8")
    osv_norm = normalizer.normalize_artifact("osv", osv_raw)
    assert len(osv_norm) > 0
    assert all(f.engine == "osv" for f in osv_norm)
    assert all(f.finding_type == FindingType.DEPENDENCY.value for f in osv_norm)

    gitleaks_raw = json.dumps([
        {
            "Description": "Generic Secret",
            "StartLine": 5,
            "EndLine": 5,
            "File": "/code/config.py",
            "RuleID": "generic-api-key",
            "Fingerprint": "fp123:config.py:generic-api-key:5",
            "Secret": "REDACTED",
            "Match": "REDACTED",
            "Line": "REDACTED",
        }
    ])
    gitleaks_norm = normalizer.normalize_artifact("gitleaks", gitleaks_raw)
    assert len(gitleaks_norm) > 0
    assert all(f.engine == "gitleaks" for f in gitleaks_norm)
    assert all(f.finding_type == FindingType.SECRET.value for f in gitleaks_norm)

    semgrep_raw = (FIXTURES_DIR / "semgrep" / "semgrep_findings.sarif").read_text(encoding="utf-8")
    semgrep_norm = normalizer.normalize_artifact("semgrep", semgrep_raw)
    assert len(semgrep_norm) == 1
    assert all(f.engine == "semgrep" for f in semgrep_norm)
    assert all(f.finding_type == FindingType.SAST.value for f in semgrep_norm)

    semgrep_legacy_raw = (FIXTURES_DIR / "semgrep" / "semgrep_findings.json").read_text(encoding="utf-8")
    semgrep_legacy_norm = normalizer.normalize_artifact("semgrep", semgrep_legacy_raw)
    assert len(semgrep_legacy_norm) == 5

    codeql_raw = (FIXTURES_DIR / "codeql" / "codeql_findings.sarif").read_text(encoding="utf-8")
    codeql_norm = normalizer.normalize_artifact("codeql", codeql_raw)
    assert len(codeql_norm) == 2
    assert all(f.engine == "codeql" for f in codeql_norm)
    assert all(f.finding_type == FindingType.SAST.value for f in codeql_norm)

    all_findings = osv_norm + gitleaks_norm + semgrep_norm + codeql_norm
    db_models = FindingNormalizer.to_db_models(
        all_findings,
        scan_id="scan-multi-123",
        project_id="proj-456",
    )
    assert len(db_models) == len(all_findings)
    engines_in_db = {m.engine for m in db_models}
    assert engines_in_db == {"osv", "gitleaks", "semgrep", "codeql"}
    types_in_db = {m.finding_type for m in db_models}
    assert types_in_db == {"dependency", "secret", "sast"}

    for model in db_models:
        assert model.scan_id == "scan-multi-123"
        assert model.project_id == "proj-456"
        assert model.fingerprint is not None
        assert len(model.fingerprint) > 0
        if model.engine in {"osv", "semgrep", "codeql"}:
            assert len(model.fingerprint) == 64
