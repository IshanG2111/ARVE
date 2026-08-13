"""
GitHub File & Tree data structures.
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class GitHubTreeEntry:
    path: str
    mode: str
    type: str  # "blob" or "tree"
    sha: str
    size: int = 0
    url: Optional[str] = None


@dataclass
class GitHubFileContent:
    path: str
    sha: str
    size: int
    content: str  # Base64 decoded or text
