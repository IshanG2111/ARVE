import datetime
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)  # Nullable for OAuth-only users
    github_id = Column(String, unique=True, index=True, nullable=True)
    github_login = Column(String, nullable=True)
    github_avatar = Column(String, nullable=True)
    github_access_token = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    repo_name = Column(String, nullable=True)      # e.g., "org/repo"
    repo_url = Column(String, nullable=True)       # e.g., "https://github.com/org/repo"
    repo_id = Column(String, nullable=True)        # GitHub repository ID
    default_branch = Column(String, default="main")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="projects")
    targets = relationship("TargetWebsite", back_populates="project", cascade="all, delete-orphan")


class TargetWebsite(Base):
    __tablename__ = "target_websites"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    domain = Column(String, nullable=False, index=True)
    verification_token = Column(String, nullable=False, unique=True, default=lambda: f"arve-verify-{uuid.uuid4().hex}")
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="targets")
