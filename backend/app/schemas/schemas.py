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


class RepositoryReference(BaseModel):
    """GitHub repository metadata submitted by the project wizard."""
    github_repo_id: str
    owner: str
    name: str
    full_name: str
    html_url: Optional[str] = None
    default_branch: str = "main"
    language: Optional[str] = None
    description: Optional[str] = None
    private: bool = False


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


class ScanCreate(BaseModel):
    """Start a scan against a completed Phase-2 analysis run.

    If analysis_run_id is omitted, the newest completed run for the project
    is selected. Passing it explicitly is preferred for reproducibility.
    """
    analysis_run_id: Optional[str] = None


class ScanEngineRunResponse(BaseModel):
    id: str
    scan_id: str
    engine_name: str
    container_name: Optional[str] = None
    status: str
    exit_code: Optional[int] = None
    duration_ms: Optional[int] = None
    artifact_reference: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScanResponse(BaseModel):
    id: str
    project_id: str
    analysis_run_id: str
    commit_sha: str
    status: str
    progress_percent: int = 0
    current_stage: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ScanStatusResponse(BaseModel):
    id: str
    project_id: str
    analysis_run_id: str
    commit_sha: str
    status: str
    progress_percent: int
    current_stage: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    engine_statuses: dict[str, str] = Field(default_factory=dict)
    engine_runs: List[ScanEngineRunResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_scan(cls, scan, engine_statuses: dict[str, str], engine_runs):
        return cls(
            id=scan.id,
            project_id=scan.project_id,
            analysis_run_id=scan.analysis_run_id,
            commit_sha=scan.commit_sha,
            status=scan.status,
            progress_percent=scan.progress_percent,
            current_stage=scan.current_stage,
            error_message=scan.error_message,
            created_at=scan.created_at,
            started_at=scan.started_at,
            completed_at=scan.completed_at,
            engine_statuses=engine_statuses,
            engine_runs=engine_runs,
        )


class ProjectCreate(BaseModel):
    """Create a project with its single GitHub repository connection."""
    name: Optional[str] = None
    description: Optional[str] = None
    repository: Optional[RepositoryReference] = None
    branch: Optional[str] = None
    deployment_url: Optional[str] = None

    @model_validator(mode="after")
    def validate_repository(self):
        if not self.repository:
            raise ValueError("A GitHub repository is required")
        return self


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    branch: Optional[str] = None
    deployment_url: Optional[str] = None
    verified: Optional[bool] = None


class ProjectRepositoryResponse(BaseModel):
    github_repo_id: Optional[str] = None
    owner: Optional[str] = None
    name: Optional[str] = None
    full_name: Optional[str] = None
    html_url: Optional[str] = None
    default_branch: Optional[str] = None
    language: Optional[str] = None
    description: Optional[str] = None
    private: bool = False
    visibility: Optional[str] = None
    size_kb: int = 0
    frameworks: Optional[str] = None
    package_manager: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    user_id: str
    name: Optional[str] = None
    description: Optional[str] = None
    branch: str
    deployment_url: Optional[str] = None
    verified: bool
    created_at: datetime

    # Denormalized repository metadata kept on the project.
    repo_id: Optional[str] = None
    repo_owner: Optional[str] = None
    repo_name: Optional[str] = None
    repo_url: Optional[str] = None
    default_branch: Optional[str] = None
    repo_language: Optional[str] = None
    repo_description: Optional[str] = None
    repo_private: bool = False
    repo_visibility: Optional[str] = None
    repo_size_kb: int = 0
    repo_frameworks: Optional[str] = None
    repo_package_manager: Optional[str] = None

    targets: List[TargetResponse] = Field(default_factory=list)
    scans: List[ScanResponse] = Field(default_factory=list)
    repository: Optional[ProjectRepositoryResponse] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def populate_repository_view(self):
        self.repository = ProjectRepositoryResponse(
            github_repo_id=self.repo_id,
            owner=self.repo_owner,
            name=(self.repo_name.split("/", 1)[-1] if self.repo_name else None),
            full_name=self.repo_name,
            html_url=self.repo_url,
            default_branch=self.default_branch,
            language=self.repo_language,
            description=self.repo_description,
            private=self.repo_private,
            visibility=self.repo_visibility,
            size_kb=self.repo_size_kb,
            frameworks=self.repo_frameworks,
            package_manager=self.repo_package_manager,
        )
        return self


class AnalysisRunCreate(BaseModel):
    commit_sha: Optional[str] = None


class AnalysisRunResponse(BaseModel):
    id: str
    project_id: str
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
    project_id: str
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
    project_id: str
    commit_sha: Optional[str] = None
    files_found: int
    files_ingested: int
    files_skipped: int
    languages: dict
    frameworks: Optional[str] = None
    package_manager: Optional[str] = None
    status: str
    run_id: str
