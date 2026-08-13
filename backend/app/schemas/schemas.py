from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class FirebaseLogin(BaseModel):
    id_token: str
    github_access_token: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    firebase_uid: Optional[str] = None
    full_name: Optional[str] = None
    username: Optional[str] = None
    github_login: Optional[str] = None
    avatar_url: Optional[str] = None
    github_avatar: Optional[str] = None
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
    frameworks: Optional[str] = None
    package_manager: Optional[str] = None
    description: Optional[str] = None
    private: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


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


class ScanResponse(BaseModel):
    id: str
    project_id: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(BaseModel):
    """Canonical project creation contract.

    A project may be created without a repository for legacy/manual use, but
    the GitHub wizard should send the normalized `repository` object.
    """

    name: Optional[str] = None
    description: Optional[str] = None
    repository_id: Optional[str] = None
    repository: Optional[RepositoryCreate] = None
    branch: Optional[str] = None
    deployment_url: Optional[str] = None

    @model_validator(mode="after")
    def validate_repository_reference(self):
        if self.repository_id and self.repository:
            raise ValueError("Provide either repository_id or repository, not both")
        return self


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    branch: Optional[str] = None
    deployment_url: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    branch: Optional[str] = None
    deployment_url: Optional[str] = None
    verified: Optional[bool] = None


class ProjectResponse(BaseModel):
    id: str
    user_id: str
    repository_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    branch: str
    deployment_url: Optional[str] = None
    verified: bool
    created_at: datetime
    targets: List[TargetResponse] = Field(default_factory=list)
    scans: List[ScanResponse] = Field(default_factory=list)
    repository: Optional[RepositoryResponse] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Ingestion Engine ────────────────────────────────────────────────────────
class AnalysisRunCreate(BaseModel):
    commit_sha: Optional[str] = None

class AnalysisRunResponse(BaseModel):
    id: str
    repository_id: str
    commit_sha: Optional[str] = None
    status: str
    files_found: int = 0
    files_ingested: int = 0
    files_skipped: int = 0
    languages_summary: Optional[str] = None
    frameworks: Optional[str] = None
    package_manager: Optional[str] = None
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class RepositoryFileResponse(BaseModel):
    id: str
    repository_id: str
    analysis_run_id: str
    path: str
    filename: str
    extension: Optional[str] = None
    language: Optional[str] = None
    size: int = 0
    sha256: Optional[str] = None
    content: Optional[str] = None
    status: str
    skip_reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class IngestionSummaryResponse(BaseModel):
    repository_id: str
    commit_sha: Optional[str] = None
    files_found: int
    files_ingested: int
    files_skipped: int
    languages: dict
    frameworks: Optional[str] = None
    package_manager: Optional[str] = None
    status: str
    run_id: str

