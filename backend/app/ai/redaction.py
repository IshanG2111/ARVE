"""Mask secrets in repository-derived text before it can reach the model.

This is a best-effort second line of defence. The first is that secret findings
never send code at all, and lines flagged by Gitleaks are masked by line number.
"""
from __future__ import annotations

import re

MASK = "[REDACTED]"

_PRIVATE_KEY_BLOCK = re.compile(
    r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----.*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|\Z)",
    re.DOTALL,
)

# Whole-token formats, replaced entirely.
_TOKEN_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),                     # AWS access key ID
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),                     # GitHub tokens
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),                   # GitHub fine-grained PAT
    re.compile(r"\bglpat-[A-Za-z0-9_\-]{20,}\b"),                      # GitLab PAT
    re.compile(r"\bxox[abprs]-[A-Za-z0-9\-]{10,}\b"),                  # Slack
    re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b"),                         # Google API key
    re.compile(r"\b(?:sk|rk|pk)_(?:live|test)_[0-9A-Za-z]{16,}\b"),    # Stripe
    re.compile(r"\bsk-(?:proj-|ant-)?[A-Za-z0-9_\-]{20,}\b"),          # OpenAI / Anthropic style
    re.compile(r"\bSG\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}\b"),   # SendGrid
    re.compile(r"\bnpm_[A-Za-z0-9]{36}\b"),                            # npm
    re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b"),  # JWT
)

# Credentials embedded in URLs: scheme://user:password@host
_URL_CREDENTIALS = re.compile(r"(?P<prefix>[a-zA-Z][a-zA-Z0-9+.\-]*://[^/\s:@]+:)[^@\s/]+(?P<suffix>@)")

# Authorization headers.
_BEARER = re.compile(r"(?P<prefix>\b(?:Bearer|Basic|Token)\s+)[A-Za-z0-9_\-.=+/]{12,}", re.IGNORECASE)

# Assignments to secret-looking names: password = "...", "api_key": '...', SECRET_TOKEN=...
_SECRET_NAME = r"[A-Za-z0-9_.\-]*(?:passw(?:or)?d|pwd|secret|token|api[_\-]?key|apikey|access[_\-]?key|private[_\-]?key|client[_\-]?secret|auth|credential)s?[A-Za-z0-9_.\-]*"
_ASSIGNMENT = re.compile(
    rf"""(?P<prefix>["']?{_SECRET_NAME}["']?\s*(?::=|=>|=|:)\s*)(?P<quote>["'`])(?P<value>[^"'`\r\n]{{4,}})(?P=quote)""",
    re.IGNORECASE,
)
# Unquoted assignments, as in .env or YAML files: API_KEY=abc123...
_UNQUOTED_ASSIGNMENT = re.compile(
    rf"""(?P<prefix>^\s*(?:export\s+)?{_SECRET_NAME}\s*[=:]\s*)(?P<value>[^\s"'`#][^\s#]{{5,}})""",
    re.IGNORECASE | re.MULTILINE,
)

_PLACEHOLDER_VALUES = {"none", "null", "true", "false", "changeme", "example", "redacted"}


def _mask_assignment(match: re.Match[str]) -> str:
    value = match.group("value")
    if value.strip().lower() in _PLACEHOLDER_VALUES or value.startswith(("os.", "process.env", "${", "{{")):
        return match.group(0)
    quote = match.groupdict().get("quote") or ""
    return f"{match.group('prefix')}{quote}{MASK}{quote}"


def redact_text(text: str | None) -> str | None:
    """Return ``text`` with known secret formats replaced by ``[REDACTED]``."""
    if text is None:
        return None
    if not text:
        return text

    redacted = _PRIVATE_KEY_BLOCK.sub(MASK, text)
    for pattern in _TOKEN_PATTERNS:
        redacted = pattern.sub(MASK, redacted)
    redacted = _URL_CREDENTIALS.sub(lambda m: f"{m.group('prefix')}{MASK}{m.group('suffix')}", redacted)
    redacted = _BEARER.sub(lambda m: f"{m.group('prefix')}{MASK}", redacted)
    redacted = _ASSIGNMENT.sub(_mask_assignment, redacted)
    redacted = _UNQUOTED_ASSIGNMENT.sub(_mask_assignment, redacted)
    return redacted


_SENSITIVE_FILE_SUFFIXES = (".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".kdbx")
_SENSITIVE_FILE_NAMES = {
    "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", ".npmrc", ".pypirc", ".netrc",
    ".htpasswd", "credentials", "credentials.json", "secrets.json", "secrets.yml", "secrets.yaml",
}


def is_sensitive_file(path: str | None) -> bool:
    """True for files whose content should never be sent, such as ``.env`` or private keys."""
    if not path:
        return False
    name = path.replace("\\", "/").rsplit("/", 1)[-1].lower()
    if name == ".env" or name.startswith(".env.") or name.endswith(".env"):
        return True
    return name in _SENSITIVE_FILE_NAMES or name.endswith(_SENSITIVE_FILE_SUFFIXES)
