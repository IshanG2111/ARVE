import datetime
import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
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

    # Legacy authentication/profile fields retained only for existing data.
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    github_login = Column(String, nullable=True)
    github_avatar = Column(String, nullable=True)
    github_access_token = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    projects = relationship(
        "Project",
        back_populates="owner",
        cascade="all, delete-orphan",
    )


class Repository(Base):
    """Normalized GitHub repository metadata used by ARVE projects."""
    __tablename__ = "repositories"
    __table_args__ = (
        UniqueConstraint("github_repo_id", name="uq_repositories_github_repo_id"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    github_repo_id = Column(String, nullable=False, index=True)
    owner = Column(String, nullable=False)
    name = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    html_url = Column(String, nullable=True)
    default_branch = Column(String, default="main", nullable=False)
    language = Column(String, nullable=True)
    frameworks = Column(String, nullable=True)
    package_manager = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    private = Column(Boolean, default=False)
    visibility = Column(String, default="public")
    size_kb = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    projects = relationship("Project", back_populates="repository")
    analysis_runs = relationship("AnalysisRun", back_populates="repository", cascade="all, delete-orphan")
    files = relationship("RepositoryFile", back_populates="repository", cascade="all, delete-orphan")


class AnalysisRun(Base):
    """Tracks a single repository ingestion or analysis execution."""
    __tablename__ = "analysis_runs"

    id = Column(String, primary_key=True, default=generate_uuid)
    repository_id = Column(String, ForeignKey("repositories.id"), nullable=False, index=True)
    commit_sha = Column(String, nullable=True)
    status = Column(String, default="PENDING")  # PENDING | FETCHING | PROCESSING | COMPLETED | FAILED
    files_found = Column(Integer, default=0)
    files_ingested = Column(Integer, default=0)
    files_skipped = Column(Integer, default=0)
    languages_summary = Column(Text, nullable=True)  # JSON formatted summary
    frameworks = Column(String, nullable=True)
    package_manager = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    repository = relationship("Repository", back_populates="analysis_runs")
    files = relationship("RepositoryFile", back_populates="analysis_run", cascade="all, delete-orphan")


class RepositoryFile(Base):
    """Normalized file content and metadata extracted during repository ingestion."""
    __tablename__ = "repository_files"

    id = Column(String, primary_key=True, default=generate_uuid)
    repository_id = Column(String, ForeignKey("repositories.id"), nullable=False, index=True)
    analysis_run_id = Column(String, ForeignKey("analysis_runs.id"), nullable=False, index=True)
    path = Column(String, nullable=False, index=True)
    filename = Column(String, nullable=False)
    extension = Column(String, nullable=True)
    language = Column(String, nullable=True)
    size = Column(Integer, default=0)
    sha256 = Column(String, index=True, nullable=True)
    content = Column(Text, nullable=True)
    status = Column(String, default="INGESTED")  # INGESTED | SKIPPED | FAILED
    skip_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    repository = relationship("Repository", back_populates="files")
    analysis_run = relationship("AnalysisRun", back_populates="files")



class Project(Base):
    """ARVE project linking a user to a repository and analysis configuration."""
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    repository_id = Column(String, ForeignKey("repositories.id"), nullable=True, index=True)
    name = Column(String, nullable=True, index=True)
    description = Column(Text, nullable=True)
    branch = Column(String, default="main", nullable=False)
    deployment_url = Column(String, nullable=True)
    verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Deprecated compatibility columns. New application code must not read/write these.
    # They remain in the ORM until the existing Neon data has been migrated and verified.
    owner_id = Column(String, nullable=True)
    repo_name = Column(String, nullable=True)
    repo_url = Column(String, nullable=True)
    repo_id = Column(String, nullable=True)
    default_branch = Column(String, default="main", nullable=True)

    owner = relationship("User", back_populates="projects", foreign_keys=[user_id])
    repository = relationship("Repository", back_populates="projects")
    scans = relationship("Scan", back_populates="project", cascade="all, delete-orphan")
    targets = relationship("TargetWebsite", back_populates="project", cascade="all, delete-orphan")


class Scan(Base):
    """Placeholder for the Phase-2+ scan pipeline."""
    __tablename__ = "scans"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="scans")


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
