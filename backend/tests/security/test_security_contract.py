"""Unit and integration contract tests for the ARVE Shared Security Foundation."""
import uuid
import pytest
from sqlalchemy.exc import IntegrityError

from app.models.models import AnalysisRun, Project, Scan, SecurityFinding, User
from app.security.mappers.base import FindingMapper
from app.security.models import (
    EngineName,
    FindingConfidence,
    FindingSeverity,
    FindingStatus,
    FindingType,
    NormalizedFinding,
    normalize_engine_name,
)
from app.security.normalizer import FindingNormalizer


class DummyTestMapper(FindingMapper):
    """Dummy mapper for contract testing raw-to-normalized execution flow."""

    @property
    def engine_name(self) -> str:
        return "test-scanner"

    def map_artifact(self, raw_content, context=None):
        findings = []
        for item in raw_content.get("vulnerabilities", []):
            findings.append(
                NormalizedFinding(
                    engine=self.engine_name,
                    finding_type=item.get("type", FindingType.DEPENDENCY),
                    title=item["title"],
                    description=item.get("description"),
                    severity=item.get("severity", FindingSeverity.MEDIUM),
                    package_name=item.get("package"),
                    ecosystem=item.get("ecosystem"),
                    cve=item.get("cve"),
                    file_path=item.get("file"),
                    line_start=item.get("line_start"),
                    line_end=item.get("line_end"),
                    raw_json=item,
                )
            )
        return findings


class TestNormalizedFindingContract:
    """Validate NormalizedFinding schema, validators, and normalization."""

    def test_minimal_valid_finding(self):
        f = NormalizedFinding(
            engine="osv",
            finding_type="dependency",
            title="Vulnerability in requests",
        )
        assert f.engine == "osv"
        assert f.finding_type == "dependency"
        assert f.title == "Vulnerability in requests"
        assert f.severity == FindingSeverity.MEDIUM
        assert f.status == FindingStatus.OPEN
        assert f.confidence is None

    def test_engine_alias_normalization(self):
        f_osv = NormalizedFinding(engine="osv-scanner", finding_type="dependency", title="T")
        assert f_osv.engine == "osv"

        f_gitleaks = NormalizedFinding(engine="git-leaks", finding_type="secret", title="T")
        assert f_gitleaks.engine == "gitleaks"

        f_semgrep = NormalizedFinding(engine="semgrep-sast", finding_type="sast", title="T")
        assert f_semgrep.engine == "semgrep"

    def test_file_path_normalization(self):
        f = NormalizedFinding(
            engine="osv",
            finding_type="dependency",
            title="T",
            file_path=".\\src\\backend\\package.json",
        )
        assert f.file_path == "src/backend/package.json"

    def test_line_order_validation(self):
        # Valid when line_end >= line_start
        f_valid = NormalizedFinding(
            engine="osv",
            finding_type="dependency",
            title="T",
            line_start=10,
            line_end=15,
        )
        assert f_valid.line_start == 10
        assert f_valid.line_end == 15

        # Invalid when line_end < line_start
        with pytest.raises(ValueError, match="line_end.*must be greater than or equal to line_start"):
            NormalizedFinding(
                engine="osv",
                finding_type="dependency",
                title="T",
                line_start=20,
                line_end=5,
            )

    def test_invalid_negative_line(self):
        with pytest.raises(ValueError):
            NormalizedFinding(
                engine="osv",
                finding_type="dependency",
                title="T",
                line_start=0,
            )


class TestFindingNormalizerPipeline:
    """Test FindingNormalizer coordinator and mapper registry."""

    def test_normalizer_executes_mapper_and_computes_fingerprint(self):
        mapper = DummyTestMapper()
        normalizer = FindingNormalizer([mapper])

        raw_payload = {
            "vulnerabilities": [
                {
                    "title": "SQL Injection in auth.py",
                    "type": "sast",
                    "severity": "CRITICAL",
                    "file": "backend/auth.py",
                    "line_start": 42,
                    "line_end": 45,
                }
            ]
        }

        results = normalizer.normalize_artifact("test-scanner", raw_payload)
        assert len(results) == 1
        finding = results[0]
        assert finding.engine == "test-scanner"
        assert finding.severity == FindingSeverity.CRITICAL
        assert finding.fingerprint is not None
        assert len(finding.fingerprint) == 64

    def test_to_db_models_conversion(self):
        finding = NormalizedFinding(
            engine="osv",
            finding_type="dependency",
            title="Insecure dependency",
            severity=FindingSeverity.HIGH,
            package_name="flask",
            ecosystem="PyPI",
            cve="CVE-2023-1234",
            file_path="requirements.txt",
        )
        scan_id = "scan-123"
        project_id = "proj-456"

        records = FindingNormalizer.to_db_models([finding], scan_id=scan_id, project_id=project_id)
        assert len(records) == 1
        record = records[0]
        assert record.scan_id == scan_id
        assert record.project_id == project_id
        assert record.engine == "osv"
        assert record.severity == "HIGH"
        assert record.package_name == "flask"
        assert record.cve == "CVE-2023-1234"
        assert record.fingerprint is not None


class TestSecurityFindingDatabasePersistence:
    """Test SQLAlchemy SecurityFinding model, relationships, and lifecycle support."""

    def _setup_scan(self, db):
        user = User(email=f"user-{uuid.uuid4().hex}@example.com", username="tester")
        db.add(user)
        db.commit()

        project = Project(user_id=user.id, name="Test Security Project", repo_owner="org", repo_name="repo")
        db.add(project)
        db.commit()

        run = AnalysisRun(project_id=project.id, commit_sha="c" * 40, status="COMPLETED")
        db.add(run)
        db.commit()

        scan = Scan(project_id=project.id, analysis_run_id=run.id, commit_sha=run.commit_sha, status="COMPLETED")
        db.add(scan)
        db.commit()

        return project, scan

    def test_security_finding_persistence_and_relationships(self, db):
        project, scan = self._setup_scan(db)

        finding = SecurityFinding(
            scan_id=scan.id,
            project_id=project.id,
            engine="osv",
            finding_type="dependency",
            title="Critical remote code execution",
            severity="CRITICAL",
            package_name="django",
            package_version="3.2.0",
            ecosystem="PyPI",
            cve="CVE-2024-0001",
            file_path="requirements.txt",
            fingerprint="abcd" * 16,
            status="OPEN",
        )
        db.add(finding)
        db.commit()

        # Query via Scan relationship
        refreshed_scan = db.query(Scan).filter(Scan.id == scan.id).one()
        assert len(refreshed_scan.findings) == 1
        assert refreshed_scan.findings[0].package_name == "django"
        assert refreshed_scan.findings[0].scan.id == scan.id

        # Query via Project relationship
        refreshed_project = db.query(Project).filter(Project.id == project.id).one()
        assert len(refreshed_project.findings) == 1
        assert refreshed_project.findings[0].project.id == project.id

    def test_non_unique_fingerprint_for_lifecycle_history(self, db):
        """The same finding fingerprint can exist in multiple scans across time for a project."""
        project, scan1 = self._setup_scan(db)

        # Create second scan on the same project
        run2 = AnalysisRun(project_id=project.id, commit_sha="d" * 40, status="COMPLETED")
        db.add(run2)
        db.commit()

        scan2 = Scan(project_id=project.id, analysis_run_id=run2.id, commit_sha=run2.commit_sha, status="COMPLETED")
        db.add(scan2)
        db.commit()

        shared_fingerprint = "11223344" * 8

        f1 = SecurityFinding(
            scan_id=scan1.id,
            project_id=project.id,
            engine="osv",
            finding_type="dependency",
            title="Same Finding in Scan 1",
            severity="HIGH",
            fingerprint=shared_fingerprint,
        )
        f2 = SecurityFinding(
            scan_id=scan2.id,
            project_id=project.id,
            engine="osv",
            finding_type="dependency",
            title="Same Finding in Scan 2",
            severity="HIGH",
            fingerprint=shared_fingerprint,
        )
        db.add_all([f1, f2])
        db.commit()

        findings = db.query(SecurityFinding).filter(
            SecurityFinding.project_id == project.id,
            SecurityFinding.fingerprint == shared_fingerprint,
        ).all()
        assert len(findings) == 2

    def test_cascade_delete_on_scan(self, db):
        project, scan = self._setup_scan(db)

        finding = SecurityFinding(
            scan_id=scan.id,
            project_id=project.id,
            engine="gitleaks",
            finding_type="secret",
            title="Leaked Secret",
            severity="CRITICAL",
            fingerprint="55667788" * 8,
        )
        db.add(finding)
        db.commit()
        assert db.query(SecurityFinding).filter(SecurityFinding.scan_id == scan.id).count() == 1

        db.delete(scan)
        db.commit()
        assert db.query(SecurityFinding).filter(SecurityFinding.scan_id == scan.id).count() == 0

    def test_cascade_delete_on_project(self, db):
        project, scan = self._setup_scan(db)

        finding = SecurityFinding(
            scan_id=scan.id,
            project_id=project.id,
            engine="gitleaks",
            finding_type="secret",
            title="Leaked Secret",
            severity="CRITICAL",
            fingerprint="9900aabb" * 8,
        )
        db.add(finding)
        db.commit()

        db.delete(project)
        db.commit()
        assert db.query(SecurityFinding).filter(SecurityFinding.project_id == project.id).count() == 0
