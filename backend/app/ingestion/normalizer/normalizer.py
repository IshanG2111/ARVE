"""
ARVE Data Normalizer
Converts external provider data into ARVE standard normalized structures and calculates SHA-256 hashes.
"""
import hashlib
import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class NormalizedRepository:
    github_id: str
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
class NormalizedFile:
    path: str
    filename: str
    extension: str
    language: str
    size: int
    sha256: str
    content: Optional[str]
    status: str
    skip_reason: Optional[str] = None


class DataNormalizer:
    """Normalizes raw provider outputs into ARVE internal formats."""

    @staticmethod
    def compute_sha256(content: Optional[str]) -> str:
        """Calculate SHA-256 digest of string content."""
        if content is None:
            return ""
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @staticmethod
    def normalize_path(path: str) -> str:
        """Sanitize and standardize file path separator."""
        return path.replace("\\", "/").strip("/")

    @classmethod
    def create_normalized_file(
        cls,
        path: str,
        content: Optional[str],
        size: int,
        language: str,
        status: str = "INGESTED",
        skip_reason: Optional[str] = None
    ) -> NormalizedFile:
        """Constructs a NormalizedFile data object with SHA-256 hashing."""
        clean_path = cls.normalize_path(path)
        filename = os.path.basename(clean_path)
        _, ext = os.path.splitext(filename)

        sha256_hash = cls.compute_sha256(content) if status == "INGESTED" and content is not None else ""

        return NormalizedFile(
            path=clean_path,
            filename=filename,
            extension=ext.lower(),
            language=language,
            size=size if size > 0 else (len(content.encode("utf-8")) if content else 0),
            sha256=sha256_hash,
            content=content,
            status=status,
            skip_reason=skip_reason,
        )
