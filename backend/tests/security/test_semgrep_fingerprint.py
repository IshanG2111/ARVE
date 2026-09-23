"""Unit tests for Semgrep SAST finding fingerprinting."""
from app.security.fingerprint import compute_finding_fingerprint
from app.security.models import FindingSeverity, FindingType, NormalizedFinding
from app.security.normalizer import FindingNormalizer
from app.security.mappers.semgrep import SemgrepFindingMapper


def _make_finding(
    file_path: str = "app/users.py",
    rule_id: str = "arve.python.sql-injection",
    line_start: int = 42,
    line_end: int = 42,
) -> NormalizedFinding:
    return NormalizedFinding(
        engine="semgrep",
        finding_type=FindingType.SAST.value,
        title="SQL Injection Risk",
        severity=FindingSeverity.HIGH,
        file_path=file_path,
        line_start=line_start,
        line_end=line_end,
        rule_id=rule_id,
        cwe="CWE-89",
    )


def test_fingerprint_line_shift_stability():
    """SAST finding identity must remain stable when line numbers shift due to code edits."""
    f1 = _make_finding(line_start=42, line_end=42)
    f2 = _make_finding(line_start=88, line_end=88)

    fp1 = compute_finding_fingerprint(f1)
    fp2 = compute_finding_fingerprint(f2)
    assert fp1 == fp2
    assert len(fp1) == 64


def test_fingerprint_file_path_distinctness():
    """Findings in different files must yield different fingerprints."""
    f1 = _make_finding(file_path="app/users.py")
    f2 = _make_finding(file_path="app/admin.py")

    assert compute_finding_fingerprint(f1) != compute_finding_fingerprint(f2)


def test_fingerprint_rule_id_distinctness():
    """Different rules in the same file must yield different fingerprints."""
    f1 = _make_finding(rule_id="arve.python.sql-injection")
    f2 = _make_finding(rule_id="arve.python.command-injection")

    assert compute_finding_fingerprint(f1) != compute_finding_fingerprint(f2)


def test_normalizer_attaches_fingerprint_to_semgrep_findings():
    """FindingNormalizer should compute and attach fingerprint if missing."""
    normalizer = FindingNormalizer([SemgrepFindingMapper()])
    raw_payload = {
        "results": [
            {
                "check_id": "arve.python.sql-injection",
                "path": "/code/app/users.py",
                "start": {"line": 42},
                "end": {"line": 42},
                "extra": {
                    "message": "SQL Injection",
                    "severity": "ERROR",
                    "metadata": {"cwe": ["CWE-89"]},
                },
            }
        ]
    }
    normalized = normalizer.normalize_artifact("semgrep", raw_payload)
    assert len(normalized) == 1
    assert normalized[0].fingerprint is not None
    assert len(normalized[0].fingerprint) == 64
