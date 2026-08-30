import datetime
import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    """Authenticated ARVE user."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    firebase_uid = Column(String, unique=True, index=True, nullable=True)
    github_id = Column(String, unique=True, index=True, nullable=True)
    username = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    avatar_url = Column(String, nullable=True)

    # Legacy profile fields retained for existing data compatibility.
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    github_login = Column(String, nullable=True)
    github_avatar = Column(String, nullable=True)
    github_access_token = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


class Project(Base):
    """ARVE project and its single connected GitHub repository.

    A project owns exactly one repository connection, so repository metadata is
    stored directly on the project rather than in a separate repositories table.
    """
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)

    # Project configuration.
    name = Column(String, nullable=True, index=True)
    description = Column(Text, nullable=True)
    branch = Column(String, default="main", nullable=False)
    deployment_url = Column(String, nullable=True)
    verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Repository metadata is denormalized here because one project owns one repo.
    # repo_id is the GitHub repository's numeric/string ID, not an internal FK.
    repo_id = Column(String, nullable=True, index=True)
    repo_owner = Column(String, nullable=True)
    repo_name = Column(String, nullable=True)  # owner/name (full_name)
    repo_url = Column(String, nullable=True)
    default_branch = Column(String, default="main", nullable=True)
    repo_language = Column(String, nullable=True)
    repo_description = Column(Text, nullable=True)
    repo_private = Column(Boolean, default=False, nullable=False)
    repo_visibility = Column(String, nullable=True)
    repo_size_kb = Column(Integer, default=0, nullable=False)
    repo_frameworks = Column(String, nullable=True)
    repo_package_manager = Column(String, nullable=True)

    owner = relationship("User", back_populates="projects", foreign_keys=[user_id])
    scans = relationship("Scan", back_populates="project", cascade="all, delete-orphan")
    targets = relationship("TargetWebsite", back_populates="project", cascade="all, delete-orphan")
    analysis_runs = relationship("AnalysisRun", back_populates="project", cascade="all, delete-orphan")
    repository_files = relationship("RepositoryFile", back_populates="project", cascade="all, delete-orphan")
    findings = relationship("SecurityFinding", back_populates="project", cascade="all, delete-orphan")


class Scan(Base):
    """A Phase-3 execution against one immutable Phase-2 repository snapshot."""
    __tablename__ = "scans"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="RESTRICT"), nullable=False, index=True)
    commit_sha = Column(String, nullable=False, index=True)
    status = Column(String, default="QUEUED", nullable=False, index=True)
    progress_percent = Column(Integer, default=0, nullable=False)
    current_stage = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="scans")
    analysis_run = relationship("AnalysisRun", back_populates="scans")
    engine_runs = relationship("ScanEngineRun", back_populates="scan", cascade="all, delete-orphan")
    findings = relationship("SecurityFinding", back_populates="scan", cascade="all, delete-orphan")


class ScanEngineRun(Base):
    """Execution record for one generic scanner engine within a scan."""
    __tablename__ = "scan_engine_runs"

    id = Column(String, primary_key=True, default=generate_uuid)
    scan_id = Column(String, ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    engine_name = Column(String, nullable=False, index=True)
    container_name = Column(String, nullable=True, index=True)
    status = Column(String, default="QUEUED", nullable=False)
    exit_code = Column(Integer, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    artifact_reference = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    scan = relationship("Scan", back_populates="engine_runs")


class TargetWebsite(Base):
    """Deployment verification target associated with a project."""
    __tablename__ = "target_websites"
    __table_args__ = (
        UniqueConstraint("project_id", "domain", name="uq_target_websites_project_domain"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    domain = Column(String, nullable=False, index=True)
    verification_token = Column(
        String,
        nullable=False,
        unique=True,
        default=lambda: f"arve-verify-{uuid.uuid4().hex}",
    )
    is_verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="targets")


class AnalysisRun(Base):
    """Tracks a deterministic repository ingestion/analysis execution."""
    __tablename__ = "analysis_runs"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    commit_sha = Column(String, nullable=True)
    status = Column(String, default="PENDING", nullable=False)
    files_found = Column(Integer, default=0, nullable=False)
    files_ingested = Column(Integer, default=0, nullable=False)
    files_skipped = Column(Integer, default=0, nullable=False)
    languages_summary = Column(Text, nullable=True)
    frameworks = Column(String, nullable=True)
    package_manager = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="analysis_runs")
    files = relationship("RepositoryFile", back_populates="analysis_run", cascade="all, delete-orphan")
    scans = relationship("Scan", back_populates="analysis_run")


class RepositoryFile(Base):
    """Normalized file content/metadata captured for an analysis run."""
    __tablename__ = "repository_files"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id"), nullable=False, index=True)
    path = Column(String, nullable=False, index=True)
    filename = Column(String, nullable=False)
    extension = Column(String, nullable=True)
    language = Column(String, nullable=True)
    size = Column(Integer, default=0, nullable=False)
    sha256 = Column(String, index=True, nullable=True)
    content = Column(Text, nullable=True)
    status = Column(String, default="INGESTED", nullable=False)
    skip_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="repository_files")
    analysis_run = relationship("AnalysisRun", back_populates="files")


class SecurityFinding(Base):
    """Canonical security finding model shared across all ARVE scanner engines."""
    __tablename__ = "security_findings"
    __table_args__ = (
        CheckConstraint(
            "line_end >= line_start OR line_end IS NULL OR line_start IS NULL",
            name="ck_security_findings_line_order",
        ),
        CheckConstraint(
            "line_start > 0 OR line_start IS NULL",
            name="ck_security_findings_line_start_positive",
        ),
        Index("ix_security_findings_scan_engine", "scan_id", "engine"),
        Index("ix_security_findings_project_fingerprint", "project_id", "fingerprint"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    scan_id = Column(String, ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    engine = Column(String, nullable=False, index=True)
    finding_type = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String, nullable=False, index=True)
    confidence = Column(String, nullable=True, index=True)
    status = Column(String, default="OPEN", nullable=False, index=True)
    file_path = Column(String, nullable=True, index=True)
    line_start = Column(Integer, nullable=True)
    line_end = Column(Integer, nullable=True)
    package_name = Column(String, nullable=True, index=True)
    package_version = Column(String, nullable=True)
    ecosystem = Column(String, nullable=True, index=True)
    cve = Column(String, nullable=True, index=True)
    ghsa = Column(String, nullable=True, index=True)
    cwe = Column(String, nullable=True, index=True)
    rule_id = Column(String, nullable=True, index=True)
    fingerprint = Column(String, nullable=False, index=True)
    raw_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    scan = relationship("Scan", back_populates="findings")
    project = relationship("Project", back_populates="findings")
