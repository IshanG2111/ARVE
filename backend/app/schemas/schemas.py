from pydantic import BaseModel, EmailStr, ConfigDict, model_validator
from typing import Optional, List
from datetime import datetime


# ─── Token ────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[str] = None


# ─── User ──────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    username: Optional[str] = None        # GitHub login
    github_login: Optional[str] = None   # alias
    avatar_url: Optional[str] = None
    github_avatar: Optional[str] = None  # alias
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def populate_aliases(self):
        if not self.username and self.github_login:
            self.username = self.github_login
        if not self.github_login and self.username:
            self.github_login = self.username
        if not self.avatar_url and self.github_avatar:
            self.avatar_url = self.github_avatar
        if not self.github_avatar and self.avatar_url:
            self.github_avatar = self.avatar_url
        return self


# ─── GitHub (raw API passthrough) ─────────────────────────────────────────────
class GitHubRepo(BaseModel):
    id: str
    name: str
    full_name: str
    html_url: str
    default_branch: str = "main"
    private: bool = False
    updated_at: str = ""
    language: Optional[str] = None
    description: Optional[str] = None


class BranchResponse(BaseModel):
    name: str
    protected: bool = False


# ─── Repository ───────────────────────────────────────────────────────────────
class RepositoryCreate(BaseModel):
    github_repo_id: str
    owner: str
    name: str
    full_name: str
    html_url: Optional[str] = None
    default_branch: str = "main"
    language: Optional[str] = None
    description: Optional[str] = None
    private: bool = False

class RepositoryResponse(BaseModel):
    id: str
    github_repo_id: str
    owner: str
    name: str
    full_name: str
    html_url: Optional[str] = None
    default_branch: str
    language: Optional[str] = None
    description: Optional[str] = None
    private: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Target Website (retained) ────────────────────────────────────────────────
class TargetCreate(BaseModel):
    domain: str

class TargetResponse(BaseModel):
    id: str
    project_id: str
    domain: str
    verification_token: str
    is_verified: bool
    verified_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class VerificationResult(BaseModel):
    target_id: str
    domain: str
    is_verified: bool
    message: str
    checked_url: str
    verified_at: Optional[datetime] = None


# ─── Scan ─────────────────────────────────────────────────────────────────────
class ScanResponse(BaseModel):
    id: str
    project_id: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Project ──────────────────────────────────────────────────────────────────
class ProjectCreate(BaseModel):
    # Sprint 1 canonical fields
    repository_id: Optional[str] = None   # internal Repository.id (if pre-stored)
    branch: Optional[str] = "main"
    deployment_url: Optional[str] = None

    # Legacy / wizard passthrough — populate if repository not yet stored
    name: Optional[str] = None
    description: Optional[str] = None
    repo_name: Optional[str] = None
    repo_url: Optional[str] = None
    repo_id: Optional[str] = None         # GitHub numeric ID
    default_branch: Optional[str] = "main"
    target_domain: Optional[str] = None  # backward compat

class ProjectResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    owner_id: Optional[str] = None
    repository_id: Optional[str] = None
    branch: Optional[str] = "main"
    deployment_url: Optional[str] = None
    verified: bool = False
    created_at: datetime

    # Legacy fields surfaced for the existing UI
    name: Optional[str] = None
    description: Optional[str] = None
    repo_name: Optional[str] = None
    repo_url: Optional[str] = None
    repo_id: Optional[str] = None
    default_branch: Optional[str] = "main"
    targets: List[TargetResponse] = []
    scans: List[ScanResponse] = []
    repository: Optional[RepositoryResponse] = None

    model_config = ConfigDict(from_attributes=True)
