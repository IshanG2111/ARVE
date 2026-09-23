"""Remediation guidance and developer-friendly UX metadata for SAST findings."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class RemediationAdvice:
    """Actionable remediation guidance for a security finding."""
    title: str
    summary: str
    why_it_matters: str
    recommended_action: str
    example_diff: Optional[str] = None
    cwe: Optional[str] = None
    references: list[str] = field(default_factory=list)


# Authoritative remediation catalog for common vulnerability classes
REMEDIATION_CATALOG: dict[str, RemediationAdvice] = {
    "SQL_INJECTION": RemediationAdvice(
        title="SQL Injection Risk",
        summary="User-controlled input is used directly to construct a database query.",
        why_it_matters="An attacker can manipulate the query structure to view, modify, or delete sensitive database contents.",
        recommended_action="Use parameterized queries or an ORM with prepared statements instead of dynamic string concatenation.",
        example_diff=(
            "- query = f\"SELECT * FROM users WHERE id = {user_id}\"\n"
            "- cursor.execute(query)\n"
            "+ query = \"SELECT * FROM users WHERE id = %s\"\n"
            "+ cursor.execute(query, (user_id,))"
        ),
        cwe="CWE-89",
        references=[
            "https://owasp.org/www-community/attacks/SQL_Injection",
            "https://cwe.mitre.org/data/definitions/89.html",
        ],
    ),
    "COMMAND_INJECTION": RemediationAdvice(
        title="Command Injection Risk",
        summary="Untrusted input is passed directly to an operating system shell or command interpreter.",
        why_it_matters="An attacker can execute arbitrary operating system commands with the privileges of the application process.",
        recommended_action="Avoid invoking shell interpreters (`shell=True`, `os.system`). Pass argument vectors to subprocess APIs without invoking a shell.",
        example_diff=(
            "- os.system(f\"cat {filename}\")\n"
            "+ subprocess.run([\"cat\", filename], check=True)"
        ),
        cwe="CWE-78",
        references=[
            "https://owasp.org/www-community/attacks/Command_Injection",
            "https://cwe.mitre.org/data/definitions/78.html",
        ],
    ),
    "XSS": RemediationAdvice(
        title="Cross-Site Scripting (XSS)",
        summary="Untrusted input is rendered into HTML output without context-appropriate encoding or sanitization.",
        why_it_matters="An attacker can execute malicious scripts in victim browsers to steal session tokens, credentials, or deface the site.",
        recommended_action="Use automated context-aware template encoding or dedicated HTML sanitization libraries (e.g. DOMPurify).",
        example_diff=(
            "- element.innerHTML = user_input;\n"
            "+ element.textContent = user_input;"
        ),
        cwe="CWE-79",
        references=[
            "https://owasp.org/www-community/attacks/xss/",
            "https://cwe.mitre.org/data/definitions/79.html",
        ],
    ),
    "SSRF": RemediationAdvice(
        title="Server-Side Request Forgery (SSRF)",
        summary="The application initiates network requests to a URL supplied or influenced by external users.",
        why_it_matters="An attacker can force the server to connect to internal services, cloud metadata endpoints, or port-scan private networks.",
        recommended_action="Validate destination schemes (http/https), enforce strict hostname/IP allowlists, and block private/loopback address ranges (RFC 1918, 169.254.169.254).",
        example_diff=(
            "- response = requests.get(user_url)\n"
            "+ validate_safe_external_url(user_url)\n"
            "+ response = requests.get(user_url, timeout=5)"
        ),
        cwe="CWE-918",
        references=[
            "https://owasp.org/www-community/attacks/Server_Side_Request_Forgery",
            "https://cwe.mitre.org/data/definitions/918.html",
        ],
    ),
    "PATH_TRAVERSAL": RemediationAdvice(
        title="Path Traversal Vulnerability",
        summary="User-controlled input is used to construct a filesystem path without strict boundary verification.",
        why_it_matters="An attacker can use dot-dot-slash (`../`) sequences to read or overwrite critical files outside the intended directory.",
        recommended_action="Resolve canonical paths (`Path.resolve()`) and ensure the resolved path starts with the allowed base directory, or use filename basename validation.",
        example_diff=(
            "- file_path = os.path.join(BASE_DIR, filename)\n"
            "+ safe_name = os.path.basename(filename)\n"
            "+ file_path = (Path(BASE_DIR) / safe_name).resolve()\n"
            "+ if not str(file_path).startswith(str(Path(BASE_DIR).resolve())):\n"
            "+     raise ValueError(\"Path traversal detected\")"
        ),
        cwe="CWE-22",
        references=[
            "https://owasp.org/www-community/attacks/Path_Traversal",
            "https://cwe.mitre.org/data/definitions/22.html",
        ],
    ),
    "WEAK_CRYPTO": RemediationAdvice(
        title="Weak Cryptographic Algorithm",
        summary="A legacy or broken cryptographic algorithm (e.g. MD5, SHA-1, DES, RC4) is in use.",
        why_it_matters="Weak algorithms are vulnerable to collision, preimage, or brute-force attacks that compromise data confidentiality and integrity.",
        recommended_action="Upgrade to modern standard cryptographic primitives such as SHA-256/SHA-512, AES-GCM, or Argon2id/bcrypt for password hashing.",
        example_diff=(
            "- hash_val = hashlib.md5(data).hexdigest()\n"
            "+ hash_val = hashlib.sha256(data).hexdigest()"
        ),
        cwe="CWE-327",
        references=[
            "https://cwe.mitre.org/data/definitions/327.html",
            "https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html",
        ],
    ),
    "INSECURE_TLS": RemediationAdvice(
        title="Insecure TLS Configuration",
        summary="TLS/SSL certificate validation is explicitly disabled or an obsolete protocol version is enforced.",
        why_it_matters="Disabling certificate verification permits machine-in-the-middle (MitM) attackers to intercept and tamper with encrypted traffic.",
        recommended_action="Always enable default TLS certificate validation (`verify=True`). Use TLS 1.2 or TLS 1.3.",
        example_diff=(
            "- requests.get(url, verify=False)\n"
            "+ requests.get(url, verify=True)"
        ),
        cwe="CWE-295",
        references=[
            "https://cwe.mitre.org/data/definitions/295.html",
            "https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html",
        ],
    ),
    "UNSAFE_DESERIALIZATION": RemediationAdvice(
        title="Unsafe Deserialization",
        summary="The application deserializes untrusted data using unsafe mechanisms such as Python pickle or YAML unsafe loader.",
        why_it_matters="Deserializing arbitrary attacker-controlled byte streams often leads directly to remote code execution.",
        recommended_action="Use safe, data-only formats such as JSON (`json.loads`) or safe loaders (`yaml.safe_load`). Never unpickle untrusted data.",
        example_diff=(
            "- obj = pickle.loads(raw_data)\n"
            "+ obj = json.loads(raw_data)"
        ),
        cwe="CWE-502",
        references=[
            "https://owasp.org/www-community/vulnerabilities/Deserialization_of_untrusted_data",
            "https://cwe.mitre.org/data/definitions/502.html",
        ],
    ),
    "HARDCODED_SECRET": RemediationAdvice(
        title="Hardcoded Credential or Token",
        summary="A secret, private key, API token, or password is embedded directly into source code.",
        why_it_matters="Anyone with read access to the repository or binaries can extract the secret and compromise external systems.",
        recommended_action="Move credentials to secure environment variables, a secret store (Vault, AWS Secrets Manager), and revoke the exposed key.",
        example_diff=(
            "- API_KEY = \"sk_live_1234567890abcdef\"\n"
            "+ API_KEY = os.environ[\"API_KEY\"]"
        ),
        cwe="CWE-798",
        references=[
            "https://cwe.mitre.org/data/definitions/798.html",
            "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html",
        ],
    ),
    "CODE_INJECTION": RemediationAdvice(
        title="Code Injection Risk",
        summary="Dynamic evaluation constructs such as `eval()`, `exec()`, or `Function()` are executed with untrusted inputs.",
        why_it_matters="An attacker can supply malicious code fragments that execute within the runtime environment.",
        recommended_action="Refactor logic to use safe parsers or lookup tables. Avoid dynamic code evaluation entirely.",
        example_diff=(
            "- result = eval(user_expression)\n"
            "+ result = ast.literal_eval(user_expression)"
        ),
        cwe="CWE-94",
        references=[
            "https://cwe.mitre.org/data/definitions/94.html",
        ],
    ),
}

# Mapping of CWE IDs to canonical catalog keys
CWE_TO_CATEGORY: dict[str, str] = {
    "CWE-89": "SQL_INJECTION",
    "CWE-78": "COMMAND_INJECTION",
    "CWE-77": "COMMAND_INJECTION",
    "CWE-88": "COMMAND_INJECTION",
    "CWE-79": "XSS",
    "CWE-80": "XSS",
    "CWE-83": "XSS",
    "CWE-918": "SSRF",
    "CWE-22": "PATH_TRAVERSAL",
    "CWE-23": "PATH_TRAVERSAL",
    "CWE-36": "PATH_TRAVERSAL",
    "CWE-327": "WEAK_CRYPTO",
    "CWE-328": "WEAK_CRYPTO",
    "CWE-326": "WEAK_CRYPTO",
    "CWE-295": "INSECURE_TLS",
    "CWE-319": "INSECURE_TLS",
    "CWE-502": "UNSAFE_DESERIALIZATION",
    "CWE-798": "HARDCODED_SECRET",
    "CWE-259": "HARDCODED_SECRET",
    "CWE-94": "CODE_INJECTION",
    "CWE-95": "CODE_INJECTION",
}


REMEDIATION_ID_MAP: dict[str, str] = {
    "sql-injection": "SQL_INJECTION",
    "command-injection": "COMMAND_INJECTION",
    "xss": "XSS",
    "ssrf": "SSRF",
    "path-traversal": "PATH_TRAVERSAL",
    "weak-crypto": "WEAK_CRYPTO",
    "insecure-tls": "INSECURE_TLS",
    "unsafe-deserialization": "UNSAFE_DESERIALIZATION",
    "hardcoded-secret": "HARDCODED_SECRET",
    "code-injection": "CODE_INJECTION",
}


def lookup_remediation(
    check_id: str,
    cwes: list[str] | None = None,
    message: str | None = None,
    rule_category: str | None = None,
    remediation_id: str | None = None,
) -> RemediationAdvice:
    """Retrieve the most relevant RemediationAdvice for a given finding."""
    # 0. Direct match on remediation_id from rule metadata (authoritative)
    if remediation_id:
        normalized_rid = remediation_id.strip().lower()
        if normalized_rid in REMEDIATION_ID_MAP:
            return REMEDIATION_CATALOG[REMEDIATION_ID_MAP[normalized_rid]]
        cat_key = normalized_rid.upper().replace("-", "_")
        if cat_key in REMEDIATION_CATALOG:
            return REMEDIATION_CATALOG[cat_key]

    # 1. Match on rule_category key directly
    if rule_category and rule_category.upper() in REMEDIATION_CATALOG:
        return REMEDIATION_CATALOG[rule_category.upper()]

    # 2. Match on CWE identifiers
    if cwes:
        for cwe_str in cwes:
            normalized_cwe = cwe_str.upper().strip()
            # Handle forms like "CWE-89: SQL Injection"
            for known_cwe, cat_key in CWE_TO_CATEGORY.items():
                if known_cwe in normalized_cwe:
                    return REMEDIATION_CATALOG[cat_key]

    # 3. Match on check_id or message keywords
    tokens = f"{check_id} {message or ''}".lower()
    if "sql" in tokens and ("injection" in tokens or "format" in tokens or "concat" in tokens):
        return REMEDIATION_CATALOG["SQL_INJECTION"]
    if "command" in tokens and "injection" in tokens or "os.system" in tokens or "shell" in tokens:
        return REMEDIATION_CATALOG["COMMAND_INJECTION"]
    if "xss" in tokens or "cross-site" in tokens:
        return REMEDIATION_CATALOG["XSS"]
    if "ssrf" in tokens or "request-forgery" in tokens:
        return REMEDIATION_CATALOG["SSRF"]
    if "path-traversal" in tokens or "traversal" in tokens or "directory-traversal" in tokens:
        return REMEDIATION_CATALOG["PATH_TRAVERSAL"]
    if "pickle" in tokens or "deserial" in tokens:
        return REMEDIATION_CATALOG["UNSAFE_DESERIALIZATION"]
    if "md5" in tokens or "sha1" in tokens or "rc4" in tokens or "weak-hash" in tokens or "weak-crypto" in tokens or "crypto" in tokens:
        return REMEDIATION_CATALOG["WEAK_CRYPTO"]
    if "tls" in tokens or "ssl" in tokens or "cert" in tokens or "verify=false" in tokens:
        return REMEDIATION_CATALOG["INSECURE_TLS"]
    if "secret" in tokens or "credential" in tokens or "hardcoded" in tokens:
        return REMEDIATION_CATALOG["HARDCODED_SECRET"]
    if "eval" in tokens or "code-injection" in tokens:
        return REMEDIATION_CATALOG["CODE_INJECTION"]

    # 4. Fallback generic guidance
    clean_title = check_id.split(".")[-1].replace("-", " ").replace("_", " ").title()
    return RemediationAdvice(
        title=f"Security Finding: {clean_title}",
        summary=message or "Potential security weakness detected by Semgrep SAST rule.",
        why_it_matters="The code matches a known insecure pattern that could be abused by an attacker depending on context.",
        recommended_action="Review the code context, ensure proper input validation, sanitization, and follow defense-in-depth principles.",
        example_diff=None,
        cwe=cwes[0] if cwes else None,
        references=[],
    )
