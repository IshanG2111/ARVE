import datetime
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    """Authenticated user — GitHub is the identity provider."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    github_id = Column(String, unique=True, index=True, nullable=True)
    username = Column(String, nullable=True)          # GitHub username / login
    email = Column(String, unique=True, index=True, nullable=False)
    avatar_url = Column(String, nullable=True)        # GitHub avatar
    # Internal / legacy fields (kept for OAuth-only backward compat)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    github_login = Column(String, nullable=True)      # alias of username
    github_avatar = Column(String, nullable=True)     # alias of avatar_url
    github_access_token = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


class Repository(Base):
    """GitHub repository metadata — stored when user connects a repo."""
    __tablename__ = "repositories"

    id = Column(String, primary_key=True, default=generate_uuid)
    github_repo_id = Column(String, index=True, nullable=False)   # GitHub numeric repo ID
    owner = Column(String, nullable=False)            # Repository owner login
    name = Column(String, nullable=False)             # Repository name
    full_name = Column(String, nullable=False)        # owner/name
    html_url = Column(String, nullable=True)          # https://github.com/owner/name
    default_branch = Column(String, default="main")
    language = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    private = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    projects = relationship("Project", back_populates="repository")


class Project(Base):
    """One ARVE project — links a user, a repository, a branch, and a deployment URL."""
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    repository_id = Column(String, ForeignKey("repositories.id"), nullable=True)
    branch = Column(String, default="main")
    deployment_url = Column(String, nullable=True)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Legacy fields kept for smooth migration
    name = Column(String, nullable=True, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(String, nullable=True)          # alias of user_id (old FK)
    repo_name = Column(String, nullable=True)
    repo_url = Column(String, nullable=True)
    repo_id = Column(String, nullable=True)
    default_branch = Column(String, default="main")   # alias of branch

    owner = relationship("User", back_populates="projects", foreign_keys=[user_id])
    repository = relationship("Repository", back_populates="projects")
    scans = relationship("Scan", back_populates="project", cascade="all, delete-orphan")
    targets = relationship("TargetWebsite", back_populates="project", cascade="all, delete-orphan")


class Scan(Base):
    """Placeholder for future security-analysis phases."""
    __tablename__ = "scans"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    status = Column(String, default="pending")        # pending | running | completed | failed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="scans")


class TargetWebsite(Base):
    """Deployment verification target (retained from prior sprint)."""
    __tablename__ = "target_websites"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    domain = Column(String, nullable=False, index=True)
    verification_token = Column(
        String, nullable=False, unique=True,
        default=lambda: f"arve-verify-{uuid.uuid4().hex}"
    )
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="targets")
