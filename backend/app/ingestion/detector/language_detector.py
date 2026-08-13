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
    ".vue": "Vue",
    ".svelte": "Svelte",
    ".astro": "Astro",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "Sass",
    ".less": "Less",
    ".java": "Java",
    ".kt": "Kotlin",
    ".swift": "Swift",
    ".cs": "C#",
    ".go": "Go",
    ".rs": "Rust",
    ".c": "C",
    ".h": "C",
    ".cpp": "C++",
    ".hpp": "C++",
    ".php": "PHP",
    ".rb": "Ruby",
    ".ex": "Elixir",
    ".exs": "Elixir",
    ".scala": "Scala",
    ".sh": "Shell",
    ".bash": "Shell",
    ".ps1": "PowerShell",
    ".sql": "SQL",
    ".graphql": "GraphQL",
    ".gql": "GraphQL",
    ".json": "JSON",
    ".toml": "TOML",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".xml": "XML",
    ".txt": "Text",
    ".tf": "HCL / Terraform",
}

FILENAME_TO_LANGUAGE = {
    "dockerfile": "Docker",
    "package.json": "JSON",
    "requirements.txt": "Text",
    "pyproject.toml": "TOML",
    "cargo.toml": "TOML",
    "go.mod": "Go Module",
    "pom.xml": "XML",
    "makefile": "Makefile",
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
