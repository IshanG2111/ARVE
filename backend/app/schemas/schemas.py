from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[str] = None


# --- User Schemas ---
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
    github_login: Optional[str] = None
    github_avatar: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- GitHub Repository Schemas ---
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


# --- Target Website Schemas ---
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


# --- Project Schemas ---
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    repo_name: Optional[str] = None
    repo_url: Optional[str] = None
    repo_id: Optional[str] = None
    default_branch: Optional[str] = "main"
    target_domain: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    repo_name: Optional[str] = None
    repo_url: Optional[str] = None
    repo_id: Optional[str] = None
    default_branch: Optional[str] = "main"
    created_at: datetime
    targets: List[TargetResponse] = []

    model_config = ConfigDict(from_attributes=True)
