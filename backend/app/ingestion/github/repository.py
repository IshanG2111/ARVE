"""
GitHub Repository data structures.
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class GitHubRepoMetadata:
    id: str
    owner: str
    name: str
    full_name: str
    html_url: str
    default_branch: str
    language: Optional[str]
    description: Optional[str]
    private: bool
    visibility: str
    size_kb: int


@dataclass
class GitHubCommitInfo:
    sha: str
    message: Optional[str] = None
    author: Optional[str] = None
