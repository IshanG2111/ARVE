"""Unit tests for deterministic finding fingerprinting."""
import pytest

from app.security.fingerprint import compute_finding_fingerprint, generate_fingerprint_from_parts
from app.security.models import FindingSeverity, FindingType, NormalizedFinding


class TestFingerprinting:
    """Test deterministic identity fingerprint generation."""

    def test_fingerprint_is_valid_sha256(self):
        fp = generate_fingerprint_from_parts("osv", "dependency", "lodash", "npm", "CVE-2021-1234", "package.json")
        assert len(fp) == 64
        assert all(c in "0123456789abcdef" for c in fp)

    def test_deterministic_identical_input(self):
        f1 = NormalizedFinding(
            engine="osv",
            finding_type=FindingType.DEPENDENCY,
            title="Prototype Pollution in lodash",
            package_name="lodash",
            ecosystem="npm",
            cve="CVE-2021-1234",
            file_path="package-lock.json",
        )
        f2 = NormalizedFinding(
            engine="osv",
            finding_type=FindingType.DEPENDENCY,
            title="Prototype Pollution in lodash",
            package_name="lodash",
            ecosystem="npm",
            cve="CVE-2021-1234",
            file_path="package-lock.json",
        )
        assert compute_finding_fingerprint(f1) == compute_finding_fingerprint(f2)

    def test_line_independence_for_secrets(self):
        """Moving code lines must NOT change secret finding identity."""
        f_line_10 = NormalizedFinding(
            engine="gitleaks",
            finding_type=FindingType.SECRET,
            title="Generic API Key",
            rule_id="generic-api-key",
            file_path="app/config.py",
            line_start=10,
            line_end=10,
            secret_hash="a1b2c3d4e5f6",
        )
        f_line_85 = NormalizedFinding(
            engine="gitleaks",
            finding_type=FindingType.SECRET,
            title="Generic API Key",
            rule_id="generic-api-key",
            file_path="app/config.py",
            line_start=85,
            line_end=85,
            secret_hash="a1b2c3d4e5f6",
        )
        assert compute_finding_fingerprint(f_line_10) == compute_finding_fingerprint(f_line_85)

    def test_variance_across_packages(self):
        f_pkg1 = NormalizedFinding(
            engine="osv",
            finding_type=FindingType.DEPENDENCY,
            title="Vulnerability",
            package_name="requests",
            ecosystem="PyPI",
            cve="CVE-2023-0001",
            file_path="requirements.txt",
        )
        f_pkg2 = NormalizedFinding(
            engine="osv",
            finding_type=FindingType.DEPENDENCY,
            title="Vulnerability",
            package_name="urllib3",
            ecosystem="PyPI",
            cve="CVE-2023-0001",
            file_path="requirements.txt",
        )
        assert compute_finding_fingerprint(f_pkg1) != compute_finding_fingerprint(f_pkg2)

    def test_variance_across_ecosystems(self):
        f_npm = NormalizedFinding(
            engine="osv",
            finding_type=FindingType.DEPENDENCY,
            title="Vulnerability",
            package_name="semver",
            ecosystem="npm",
            cve="CVE-2022-25883",
            file_path="package.json",
        )
        f_pypi = NormalizedFinding(
            engine="osv",
            finding_type=FindingType.DEPENDENCY,
            title="Vulnerability",
            package_name="semver",
            ecosystem="PyPI",
            cve="CVE-2022-25883",
            file_path="package.json",
        )
        assert compute_finding_fingerprint(f_npm) != compute_finding_fingerprint(f_pypi)

    def test_variance_across_vulnerability_ids(self):
        f_cve1 = NormalizedFinding(
            engine="osv",
            finding_type=FindingType.DEPENDENCY,
            title="Vuln 1",
            package_name="django",
            ecosystem="PyPI",
            cve="CVE-2023-1111",
            file_path="requirements.txt",
        )
        f_cve2 = NormalizedFinding(
            engine="osv",
            finding_type=FindingType.DEPENDENCY,
            title="Vuln 2",
            package_name="django",
            ecosystem="PyPI",
            cve="CVE-2023-2222",
            file_path="requirements.txt",
        )
        assert compute_finding_fingerprint(f_cve1) != compute_finding_fingerprint(f_cve2)

    def test_variance_across_files(self):
        f_file1 = NormalizedFinding(
            engine="gitleaks",
            finding_type=FindingType.SECRET,
            title="AWS Access Key",
            rule_id="aws-access-key",
            file_path="backend/.env",
            secret_hash="secret123",
        )
        f_file2 = NormalizedFinding(
            engine="gitleaks",
            finding_type=FindingType.SECRET,
            title="AWS Access Key",
            rule_id="aws-access-key",
            file_path="frontend/.env",
            secret_hash="secret123",
        )
        assert compute_finding_fingerprint(f_file1) != compute_finding_fingerprint(f_file2)

    def test_normalization_whitespace_and_casing(self):
        f1 = NormalizedFinding(
            engine="osv",
            finding_type="dependency",
            title="Vuln",
            package_name="  FastAPI  ",
            ecosystem="PYPI",
            cve="cve-2024-9999",
            file_path="./requirements.txt",
        )
        f2 = NormalizedFinding(
            engine="OSV-Scanner",
            finding_type="DEPENDENCY",
            title="Vuln",
            package_name="fastapi",
            ecosystem="pypi",
            cve="CVE-2024-9999",
            file_path="requirements.txt",
        )
        assert compute_finding_fingerprint(f1) == compute_finding_fingerprint(f2)
