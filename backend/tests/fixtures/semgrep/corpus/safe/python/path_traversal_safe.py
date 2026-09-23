# Safe: Basename sanitized path
import os
from pathlib import Path

BASE_DIR = Path("/var/data").resolve()

def read_user_file_safe(filename: str) -> str:
    safe_name = os.path.basename(filename)
    target = (BASE_DIR / safe_name).resolve()
    if not str(target).startswith(str(BASE_DIR)):
        raise ValueError("Invalid path")
    return target.read_text(encoding="utf-8")
