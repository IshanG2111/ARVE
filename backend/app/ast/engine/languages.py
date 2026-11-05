from pathlib import Path

from tree_sitter import Language

import tree_sitter_python
import tree_sitter_javascript
import tree_sitter_typescript
import tree_sitter_java
import tree_sitter_php
import tree_sitter_go


# languages.py snippet

LANGUAGE_MAP = {
    ".py": {"language": "python", "grammar": "python"},
    ".js": {"language": "javascript", "grammar": "javascript"},
    ".jsx": {"language": "javascript", "grammar": "javascript"},
    ".ts": {"language": "typescript", "grammar": "typescript"},
    ".tsx": {"language": "typescript", "grammar": "tsx"},  # Use tree-sitter-tsx grammar for TSX
    ".java": {"language": "java", "grammar": "java"},
    ".php": {"language": "php", "grammar": "php"},
    ".go": {"language": "go", "grammar": "go"},
}


def detect_language(file_path):
    extension = Path(file_path).suffix.lower()

    return LANGUAGE_MAP.get(extension)