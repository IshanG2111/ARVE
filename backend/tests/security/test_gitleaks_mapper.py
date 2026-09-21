"""Tests for the Gitleaks -> ARVE finding mapper."""
import json

from app.security.mappers.gitleaks import (
    GitleaksFindingMapper,
    clean_gitleaks_file_path,
    sanitize_gitleaks_record,
)
from app.security.models import FindingSeverity, FindingType
from app.security.normalizer import FindingNormalizer


def sample_report():
    return [
        {
            "Description": "AWS Access Key",
            "StartLine": 12,
            "EndLine": 12,
            "File": "/code/src/config.py",
            "RuleID": "aws-access-key-id",
            "Fingerprint": "abc123:src/config.py:aws-access-key-id:12",
            "Secret": "AKIAEXAMPLESECRET",
            "Match": "AWS_ACCESS_KEY_ID=AKIAEXAMPLESECRET",
            "Line": "AWS_ACCESS_KEY_ID=AKIAEXAMPLESECRET",
        }
    ]


def test_clean_path():
    assert clean_gitleaks_file_path("/code/src/config.py") == "src/config.py"
    assert clean_gitleaks_file_path("/workspace/.env") == ".env"
    assert clean_gitleaks_file_path("./src/app.ts") == "src/app.ts"


def test_sanitize_removes_secret_bearing_fields():
    safe = sanitize_gitleaks_record(sample_report()[0])
    assert "Secret" not in safe
    assert "Match" not in safe
    assert "Line" not in safe
    assert safe["RuleID"] == "aws-access-key-id"


def test_mapper_maps_secret_finding_without_secret_value():
    finding = GitleaksFindingMapper().map_artifact(sample_report())[0]
    assert finding.engine == "gitleaks"
    assert finding.finding_type == FindingType.SECRET.value
    assert finding.title == "AWS Access Key"
    assert finding.file_path == "src/config.py"
    assert finding.line_start == 12
    assert finding.line_end == 12
    assert finding.rule_id == "aws-access-key-id"
    assert finding.fingerprint == "abc123:src/config.py:aws-access-key-id:12"
    assert finding.severity == FindingSeverity.MEDIUM
    assert finding.raw_json is not None
    assert "Secret" not in finding.raw_json
    assert "Match" not in finding.raw_json
    assert "Line" not in finding.raw_json


def test_mapper_accepts_json_string_and_handles_empty_or_invalid_input():
    mapper = GitleaksFindingMapper()
    assert len(mapper.map_artifact(json.dumps(sample_report()))) == 1
    assert mapper.map_artifact([]) == []
    assert mapper.map_artifact("") == []
    assert mapper.map_artifact("not json") == []
    assert mapper.map_artifact({}) == []


def test_normalizer_preserves_native_fingerprint():
    normalizer = FindingNormalizer([GitleaksFindingMapper()])
    findings = normalizer.normalize_artifact("gitleaks", sample_report())
    assert len(findings) == 1
    assert findings[0].fingerprint == sample_report()[0]["Fingerprint"]


def test_fallback_fingerprint_never_uses_secret_value():
    record = sample_report()[0].copy()
    record.pop("Fingerprint")
    finding = GitleaksFindingMapper().map_artifact([record])[0]
    assert finding.fingerprint is None
    assert finding.secret_hash
    assert "AKIAEXAMPLESECRET" not in finding.secret_hash
