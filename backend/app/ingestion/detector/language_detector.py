"""
Programming language detection service for ARVE.
"""
import os


EXTENSION_TO_LANGUAGE = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".c": "C",
    ".h": "C",
    ".cpp": "C++",
    ".hpp": "C++",
    ".php": "PHP",
    ".rb": "Ruby",
    ".json": "JSON",
    ".toml": "TOML",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".xml": "XML",
    ".txt": "Text",
}

FILENAME_TO_LANGUAGE = {
    "dockerfile": "Docker",
    "package.json": "JSON",
    "requirements.txt": "Text",
    "pyproject.toml": "TOML",
    "cargo.toml": "TOML",
    "go.mod": "Go Module",
    "pom.xml": "XML",
}


class LanguageDetector:
    """Detects programming language from file path or filename."""

    @staticmethod
    def detect(path: str) -> str:
        """
        Detect language based on filename or extension.
        Returns 'Unknown' if not matched.
        """
        filename = os.path.basename(path).lower()

        if filename in FILENAME_TO_LANGUAGE:
            return FILENAME_TO_LANGUAGE[filename]

        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        return EXTENSION_TO_LANGUAGE.get(ext, "Unknown")
