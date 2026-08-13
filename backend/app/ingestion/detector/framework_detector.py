import json
import logging
import re
from typing import List, Optional

logger = logging.getLogger(__name__)


class FrameworkDetector:
    """Detects frameworks and package managers across Node, Python, Go, and Rust ecosystems."""

    @staticmethod
    def detect_package_manager(file_paths: List[str]) -> Optional[str]:
        """
        Detect package manager based on the presence of lockfiles or manifests.
        """
        file_set = {p.replace("\\", "/").split("/")[-1].lower() for p in file_paths}

        if "pnpm-lock.yaml" in file_set:
            return "pnpm"
        if "yarn.lock" in file_set:
            return "yarn"
        if "package-lock.json" in file_set or "package.json" in file_set:
            return "npm"
        if "poetry.lock" in file_set:
            return "poetry"
        if "pipfile.lock" in file_set or "requirements.txt" in file_set:
            return "pip"
        if "cargo.lock" in file_set or "cargo.toml" in file_set:
            return "cargo"
        if "go.mod" in file_set:
            return "go modules"
        return None

    @classmethod
    def detect_frameworks(
        cls,
        package_json_content: Optional[str] = None,
        requirements_txt_content: Optional[str] = None,
        pyproject_toml_content: Optional[str] = None,
        go_mod_content: Optional[str] = None,
    ) -> List[str]:
        """
        Detects frameworks across Node.js, Python, and Go manifests.
        """
        frameworks: List[str] = []

        # 1. Node.js Frameworks
        if package_json_content:
            try:
                data = json.loads(package_json_content)
                deps = data.get("dependencies", {})
                dev_deps = data.get("devDependencies", {})
                all_deps = {**deps, **dev_deps}

                if "next" in all_deps:
                    frameworks.append("Next.js")
                if "express" in all_deps:
                    frameworks.append("Express")
                if "react" in all_deps and "Next.js" not in frameworks:
                    frameworks.append("React")
                if "vue" in all_deps or "nuxt" in all_deps:
                    frameworks.append("Vue / Nuxt" if "nuxt" in all_deps else "Vue")
                if "svelte" in all_deps or "@sveltejs/kit" in all_deps:
                    frameworks.append("SvelteKit" if "@sveltejs/kit" in all_deps else "Svelte")
                if "@angular/core" in all_deps:
                    frameworks.append("Angular")
                if "@nestjs/core" in all_deps:
                    frameworks.append("NestJS")
            except Exception as e:
                logger.warning(f"Failed to parse package.json for framework detection: {e}")

        # 2. Python Frameworks
        python_deps_text = ""
        if requirements_txt_content:
            python_deps_text += requirements_txt_content.lower() + "\n"
        if pyproject_toml_content:
            python_deps_text += pyproject_toml_content.lower() + "\n"

        if python_deps_text:
            if re.search(r"\bfastapi\b", python_deps_text):
                frameworks.append("FastAPI")
            if re.search(r"\bdjango\b", python_deps_text):
                frameworks.append("Django")
            if re.search(r"\bflask\b", python_deps_text):
                frameworks.append("Flask")

        # 3. Go Frameworks
        if go_mod_content:
            text = go_mod_content.lower()
            if "github.com/gin-gonic/gin" in text:
                frameworks.append("Gin")
            if "github.com/gofiber/fiber" in text:
                frameworks.append("Fiber")

        return list(dict.fromkeys(frameworks))
