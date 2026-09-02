"""Tests for OSV-Scanner FindingMapper (OsvFindingMapper)."""
from pathlib import Path
import json
import pytest

from app.security.mappers.osv import (
    OsvFindingMapper,
    clean_osv_file_path,
    extract_cve_and_ghsa,
    extract_cwe,
    extract_osv_severity,
)
from app.security.models import (
    EngineName,
    FindingConfidence,
    FindingSeverity,
    FindingStatus,
    FindingType,
    NormalizedFinding,
)
from app.security.normalizer import FindingNormalizer

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "osv"


@pytest.fixture
def sample_report_data() -> dict:
    fixture_file = FIXTURES_DIR / "sample_osv_report.json"
    with open(fixture_file, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def clean_report_data() -> dict:
    fixture_file = FIXTURES_DIR / "clean_osv_report.json"
    with open(fixture_file, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def duplicate_report_data() -> dict:
    fixture_file = FIXTURES_DIR / "duplicate_osv_report.json"
    with open(fixture_file, "r", encoding="utf-8") as f:
        return json.load(f)


class TestOsvHelperFunctions:
    """Validate helper functions for OSV extraction and path sanitation."""

    def test_clean_osv_file_path(self):
        assert clean_osv_file_path("/code/package-lock.json") == "package-lock.json"
        assert clean_osv_file_path("/workspace/frontend/yarn.lock") == "frontend/yarn.lock"
        assert clean_osv_file_path("\\code\\backend\\requirements.txt") == "backend/requirements.txt"
        assert clean_osv_file_path("\\workspace\\go.mod") == "go.mod"
        assert clean_osv_file_path("./src/package.json") == "src/package.json"
        assert clean_osv_file_path("Cargo.lock") == "Cargo.lock"
        assert clean_osv_file_path(None) is None
        assert clean_osv_file_path("") is None

    def test_extract_cve_and_ghsa_deterministic(self):
        # Case: GHSA ID with CVE alias
        cve, ghsa = extract_cve_and_ghsa("GHSA-35jh-r3h4-6jhm", ["CVE-2020-28500", "SNYK-123"])
        assert cve == "CVE-2020-28500"
        assert ghsa == "GHSA-35jh-r3h4-6jhm"

        # Case: CVE ID with GHSA alias
        cve, ghsa = extract_cve_and_ghsa("CVE-2021-3749", ["GHSA-cph5-m8f7-6c5x"])
        assert cve == "CVE-2021-3749"
        assert ghsa == "GHSA-cph5-m8f7-6c5x"

        # Case: Multiple aliases sorted deterministically
        cve, ghsa = extract_cve_and_ghsa("OSV-1", ["CVE-2023-9999", "CVE-2023-1111", "GHSA-yyyy", "GHSA-aaaa"])
        assert cve == "CVE-2023-1111"
        assert ghsa == "GHSA-aaaa"

        # Case: No CVE or GHSA
        cve, ghsa = extract_cve_and_ghsa("PYSEC-2023-1", ["SNYK-PYTHON-1"])
        assert cve is None
        assert ghsa is None

    def test_extract_cwe(self):
        assert extract_cwe({"database_specific": {"cwe_ids": ["CWE-1333", "CWE-400"]}}) == "CWE-1333"
        assert extract_cwe({"database_specific": {"cwe_ids": []}}) is None
        assert extract_cwe({"database_specific": {"cwes": ["CWE-89"]}}) == "CWE-89"
        assert extract_cwe({}) is None

    def test_extract_osv_severity_precedence(self):
        # 1. Numeric CVSS in severity array takes highest priority
        vuln_numeric = {
            "severity": [{"type": "CVSS_V3", "score": 9.8}],
            "database_specific": {"severity": "LOW"},
        }
        assert extract_osv_severity(vuln_numeric) == FindingSeverity.CRITICAL

        # 2. Textual severity in database_specific when severity array has no numeric score
        vuln_textual = {
            "severity": [{"type": "CVSS_V3", "score": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"}],
            "database_specific": {"severity": "MODERATE"},
        }
        assert extract_osv_severity(vuln_textual) == FindingSeverity.MEDIUM

        # 3. Textual HIGH
        vuln_high = {
            "database_specific": {"severity": "HIGH"},
        }
        assert extract_osv_severity(vuln_high) == FindingSeverity.HIGH

        # 4. Fallback to MEDIUM when nothing present
        assert extract_osv_severity({}) == FindingSeverity.MEDIUM


class TestOsvFindingMapper:
    """Validate OsvFindingMapper output and compliance with NormalizedFinding contract."""

    def test_mapper_engine_name(self):
        mapper = OsvFindingMapper()
        assert mapper.engine_name == "osv"

    def test_map_sample_osv_report(self, sample_report_data):
        mapper = OsvFindingMapper()
        findings = mapper.map_artifact(sample_report_data)

        assert len(findings) == 4

        # Finding 1: lodash in npm
        f1 = findings[0]
        assert f1.engine == "osv"
        assert f1.finding_type == FindingType.DEPENDENCY.value
        assert f1.title == "Regular Expression Denial of Service (ReDoS) in lodash"
        assert f1.package_name == "lodash"
        assert f1.package_version == "4.17.20"
        assert f1.ecosystem == "npm"
        assert f1.file_path == "frontend/package-lock.json"
        assert f1.cve == "CVE-2020-28500"
        assert f1.ghsa == "GHSA-35jh-r3h4-6jhm"
        assert f1.cwe == "CWE-1333"
        assert f1.severity == FindingSeverity.MEDIUM
        assert f1.confidence == FindingConfidence.HIGH
        assert f1.status == FindingStatus.OPEN
        assert f1.line_start is None
        assert f1.line_end is None
        assert f1.fingerprint is None  # Mapper must NOT compute fingerprint
        assert isinstance(f1.raw_json, dict)

        # Finding 2: axios in npm
        f2 = findings[1]
        assert f2.package_name == "axios"
        assert f2.package_version == "0.21.1"
        assert f2.cve == "CVE-2021-3749"
        assert f2.ghsa == "GHSA-cph5-m8f7-6c5x"
        assert f2.severity == FindingSeverity.HIGH  # CVSS 7.5

        # Finding 3: requests in PyPI (verifies Windows path cleaning)
        f3 = findings[2]
        assert f3.package_name == "requests"
        assert f3.package_version == "2.25.0"
        assert f3.ecosystem == "PyPI"
        assert f3.file_path == "backend/requirements.txt"
        assert f3.cve == "CVE-2023-32681"
        assert f3.ghsa == "GHSA-j8r2-6x86-q33q"
        assert f3.cwe == "CWE-200"
        assert f3.severity == FindingSeverity.MEDIUM  # CVSS 6.1

        # Finding 4: golang.org/x/net in Go
        f4 = findings[3]
        assert f4.package_name == "golang.org/x/net"
        assert f4.ecosystem == "Go"
        assert f4.file_path == "go.mod"
        assert f4.cve == "CVE-2023-44487"
        assert f4.cwe == "CWE-400"
        assert f4.severity == FindingSeverity.CRITICAL

    def test_map_raw_json_string_input(self, sample_report_data):
        mapper = OsvFindingMapper()
        json_str = json.dumps(sample_report_data)
        findings = mapper.map_artifact(json_str)
        assert len(findings) == 4

    def test_clean_scan_produces_empty_findings(self, clean_report_data):
        mapper = OsvFindingMapper()
        findings = mapper.map_artifact(clean_report_data)
        assert findings == []

    def test_no_manifest_or_empty_packages_handling(self):
        mapper = OsvFindingMapper()
        # Scan on a repo with no packages found
        payload = {
            "results": [
                {
                    "source": {"path": "/code/go.mod", "type": "go.mod"},
                    "packages": []
                }
            ]
        }
        findings = mapper.map_artifact(payload)
        assert findings == []

    def test_malformed_and_edge_case_inputs(self):
        mapper = OsvFindingMapper()
        assert mapper.map_artifact(None) == []
        assert mapper.map_artifact("") == []
        assert mapper.map_artifact("   ") == []
        assert mapper.map_artifact("{invalid json") == []
        assert mapper.map_artifact([]) == []
        assert mapper.map_artifact({}) == []
        assert mapper.map_artifact({"results": "invalid"}) == []
        assert mapper.map_artifact({"results": None}) == []
        assert mapper.map_artifact({"results": [{"packages": "invalid"}]}) == []

    def test_missing_optional_fields_fallback(self):
        mapper = OsvFindingMapper()
        minimal_payload = {
            "results": [
                {
                    "source": {"path": "/code/package.json"},
                    "packages": [
                        {
                            "package": {"name": "test-pkg"},
                            "vulnerabilities": [
                                {
                                    "id": "VULN-001",
                                    # No summary, details, aliases, severity, or CWE
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        findings = mapper.map_artifact(minimal_payload)
        assert len(findings) == 1
        f = findings[0]
        assert f.package_name == "test-pkg"
        assert f.package_version is None
        assert f.ecosystem is None
        assert f.title == "Vulnerability VULN-001 in test-pkg"
        assert f.severity == FindingSeverity.MEDIUM
        assert f.cve is None
        assert f.ghsa is None
        assert f.cwe is None

    def test_duplicate_vulnerabilities_produce_identical_fingerprints(self, duplicate_report_data):
        mapper = OsvFindingMapper()
        findings = mapper.map_artifact(duplicate_report_data)
        assert len(findings) == 2

        # Through FindingNormalizer, both duplicates generate the exact same fingerprint
        normalizer = FindingNormalizer([mapper])
        normalized = normalizer.normalize_artifact("osv", duplicate_report_data)
        assert len(normalized) == 2
        assert normalized[0].fingerprint is not None
        assert normalized[0].fingerprint == normalized[1].fingerprint

    def test_finding_normalizer_end_to_end_flow(self, sample_report_data):
        mapper = OsvFindingMapper()
        normalizer = FindingNormalizer([mapper])

        findings = normalizer.normalize_artifact("osv", sample_report_data)
        assert len(findings) == 4

        for f in findings:
            assert f.engine == "osv"
            assert f.fingerprint is not None
            assert len(f.fingerprint) == 64  # SHA-256 hex digest

        # Test DB ORM models conversion contract
        db_models = FindingNormalizer.to_db_models(findings, scan_id="scan-123", project_id="proj-456")
        assert len(db_models) == 4
        assert db_models[0].scan_id == "scan-123"
        assert db_models[0].project_id == "proj-456"
        assert db_models[0].engine == "osv"
        assert db_models[0].finding_type == "dependency"
        assert db_models[0].fingerprint == findings[0].fingerprint
        assert db_models[0].package_name == "lodash"
