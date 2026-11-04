import pytest

from app.ai.redaction import MASK, is_sensitive_file, redact_text

# Fake values in real token formats. None of these are live credentials.
PLANTED_SECRETS = {
    "aws": "AKIAIOSFODNN7EXAMPLE",
    "github": "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8",
    "github_pat": "github_pat_" + "11ABCDEFG0123456789_abcdefghijklmnop",
    "slack": "xoxb-" + "123456789012-abcdefghijkl",
    "google": "AIza" + "SyA1234567890abcdefghijklmnopqrstuv",
    "stripe": "sk_live_" + "4eC39HqLyjWDarjtT1zdp7dc",
    "openai": "sk-proj-" + "abcdefghijklmnopqrstuvwxyz012345",
    "jwt": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
}


@pytest.mark.parametrize("name,secret", PLANTED_SECRETS.items())
def test_known_token_formats_are_masked(name, secret):
    text = f"client = Client('{secret}')\nprint(\"{secret}\")"
    redacted = redact_text(text)
    assert secret not in redacted
    assert MASK in redacted


def test_private_key_block_is_masked():
    key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA1234\nabcd\n-----END RSA PRIVATE KEY-----"
    redacted = redact_text(f"KEY = '''{key}'''")
    assert "MIIEpAIBAAKCAQEA1234" not in redacted
    assert "BEGIN RSA PRIVATE KEY" not in redacted


def test_secret_assignments_are_masked():
    text = (
        'password = "hunter2hunter2"\n'
        "config = {'api_key': 'abcd1234efgh'}\n"
        "DB_SECRET=superSecretValue99\n"
        "const clientSecret = `mySecretValue`;\n"
    )
    redacted = redact_text(text)
    for value in ("hunter2hunter2", "abcd1234efgh", "superSecretValue99", "mySecretValue"):
        assert value not in redacted
    assert "password = " in redacted
    assert "api_key" in redacted


def test_url_credentials_and_bearer_tokens_are_masked():
    text = 'DB = "postgres://admin:s3cretpass@db.internal:5432/app"\nheaders = {"Authorization": "Bearer abcdef1234567890xyz"}'
    redacted = redact_text(text)
    assert "s3cretpass" not in redacted
    assert "abcdef1234567890xyz" not in redacted
    assert "postgres://admin:" in redacted
    assert "@db.internal" in redacted


def test_ordinary_code_is_unchanged():
    code = (
        "def get_user(user_id):\n"
        "    query = f\"SELECT * FROM users WHERE id = {user_id}\"\n"
        "    password = os.environ['DB_PASSWORD']\n"
        "    token = None\n"
        "    return cursor.execute(query)\n"
    )
    assert redact_text(code) == code


def test_none_and_empty():
    assert redact_text(None) is None
    assert redact_text("") == ""


@pytest.mark.parametrize(
    "path,expected",
    [
        (".env", True),
        ("config/.env.production", True),
        ("deploy/prod.env", True),
        ("certs/server.pem", True),
        ("home/.ssh/id_rsa", True),
        ("app/credentials.json", True),
        ("app/routes.py", False),
        ("src/environment.ts", False),
        (None, False),
    ],
)
def test_sensitive_files(path, expected):
    assert is_sensitive_file(path) is expected
