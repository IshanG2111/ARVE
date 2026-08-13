"""
File filtering rules for the ARVE Ingestion Engine.
Determines whether files in a repository tree should be ingested or skipped.
"""
import os
import re
from dataclasses import dataclass
from typing import Optional


DEFAULT_MAX_FILE_SIZE = 1_048_576  # 1 MB in bytes

# Source code extensions to include
ALLOWED_EXTENSIONS = {
    # Core Languages
    ".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".java", ".go", ".rs", ".c", ".h", ".cpp", ".hpp",
    ".php", ".rb", ".kt", ".swift", ".cs", ".ex", ".exs", ".scala",
    # Web & UI Frameworks
    ".html", ".css", ".scss", ".sass", ".less",
    ".vue", ".svelte", ".astro",
    # Config, Data & Queries
    ".json", ".yaml", ".yml", ".toml", ".env", ".env.example",
    ".sql", ".graphql", ".gql", ".sh", ".bash", ".ps1",
    ".md", ".markdown",
}

# Important configuration / build manifest files to include regardless of extension
ALLOWED_FILENAMES = {
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "requirements.txt",
    "pyproject.toml",
    "pipfile",
    "pom.xml",
    "build.gradle",
    "go.mod",
    "cargo.toml",
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "makefile",
    ".gitignore",
}

# Directories to strictly ignore anywhere in the path
IGNORED_DIRS = {
    ".git",
    "node_modules",
    "venv",
    ".venv",
    "__pycache__",
    "dist",
    "build",
    "target",
    "coverage",
    "vendor",
    ".cache",
    ".idea",
    ".vscode",
}

# Binary and media extensions to strictly ignore
IGNORED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".mp4", ".mov", ".avi", ".mp3", ".wav",
    ".zip", ".tar", ".gz", ".7z", ".rar",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".exe", ".dll", ".so", ".dylib", ".bin",
    ".woff", ".woff2", ".ttf", ".eot",
    ".pyc", ".pyo", ".pyd", ".db", ".sqlite", ".sqlite3",
    ".log"
}


@dataclass
class FilterResult:
    should_ingest: bool
    skip_reason: Optional[str] = None


class FileFilter:
    """Evaluates whether a repository file should be ingested by ARVE."""

    def __init__(self, max_file_size: int = DEFAULT_MAX_FILE_SIZE):
        self.max_file_size = max_file_size

    def is_ignored_directory(self, path: str) -> bool:
        """Check if any parent directory segment in the path is in IGNORED_DIRS."""
        normalized_path = path.replace("\\", "/").strip("/")
        parts = normalized_path.split("/")
        for part in parts[:-1]:  # check directory segments only
            if part in IGNORED_DIRS:
                return True
        return False

    def is_workflow_file(self, path: str) -> bool:
        """Check if file is a GitHub Workflow (.github/workflows/*.yml or *.yaml)."""
        normalized_path = path.replace("\\", "/").strip("/")
        return bool(re.match(r"^\.github/workflows/.*?\.(yml|yaml)$", normalized_path, re.IGNORECASE))

    def evaluate(self, path: str, size: int = 0) -> FilterResult:
        """
        Evaluates a file path and file size against ARVE's ingestion rules.
        """
        normalized_path = path.replace("\\", "/").strip("/")
        filename = os.path.basename(normalized_path)
        filename_lower = filename.lower()
        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        # 1. Check ignored directory
        if self.is_ignored_directory(normalized_path):
            return FilterResult(should_ingest=False, skip_reason="ignored_directory")

        # 2. Check file size limit
        if size > self.max_file_size:
            return FilterResult(should_ingest=False, skip_reason="file_too_large")

        # 3. Check exact manifest filename or workflow file (takes priority over binary extension check)
        if filename_lower in ALLOWED_FILENAMES or self.is_workflow_file(normalized_path):
            return FilterResult(should_ingest=True)

        # 4. Check binary / ignored extension
        if ext in IGNORED_EXTENSIONS:
            return FilterResult(should_ingest=False, skip_reason="binary_or_media_file")

        # 5. Check allowed source extension
        if ext in ALLOWED_EXTENSIONS:
            return FilterResult(should_ingest=True)

        # Default fallback: skip unsupported file types
        return FilterResult(should_ingest=False, skip_reason="unsupported_file_type")
