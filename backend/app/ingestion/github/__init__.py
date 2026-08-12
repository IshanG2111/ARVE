"""
GitHub Connector Package.
"""
from app.ingestion.github.client import (
    GitHubClient,
    GitHubAPIError,
    GitHubAuthenticationError,
    GitHubRateLimitError,
    GitHubResourceNotFoundError,
)

__all__ = [
    "GitHubClient",
    "GitHubAPIError",
    "GitHubAuthenticationError",
    "GitHubRateLimitError",
    "GitHubResourceNotFoundError",
]
