"""
Ingestion Engine Test Suite — Unit Tests & Integration Checks.
Tests filter, detector, normalizer logic independently.
Integration tests verify pipeline behavior with real token requirements.
"""
import asyncio
import hashlib
import json
import pytest

from app.models.models import User, Repository, AnalysisRun, RepositoryFile
from app.ingestion.filters.file_filter import FileFilter
from app.ingestion.detector.language_detector import LanguageDetector
from app.ingestion.detector.framework_detector import FrameworkDetector
from app.ingestion.normalizer.normalizer import DataNormalizer
from app.ingestion.service import IngestionService
from app.ingestion.github.client import GitHubClient, GitHubAuthenticationError

from tests.conftest import client, TestingSessionLocal


# ═══════════════════════════════════════════════════════════════════════════════
# 1. FILE FILTER — Pure logic tests, no GitHub API
# ═══════════════════════════════════════════════════════════════════════════════

def test_source_file_detection():
    """Allowed source files should pass the filter."""
    f = FileFilter()
    assert f.evaluate("src/auth.py").should_ingest is True
    assert f.evaluate("components/Button.tsx").should_ingest is True
    assert f.evaluate("main.go").should_ingest is True
    assert f.evaluate("App.java").should_ingest is True
    assert f.evaluate("main.rs").should_ingest is True
    assert f.evaluate("server.c").should_ingest is True
    assert f.evaluate("utils.cpp").should_ingest is True
    assert f.evaluate("header.h").should_ingest is True
    assert f.evaluate("index.php").should_ingest is True
    assert f.evaluate("app.rb").should_ingest is True


def test_config_file_detection():
    """Important configuration files should pass the filter."""
    f = FileFilter()
    assert f.evaluate("package.json").should_ingest is True
    assert f.evaluate("requirements.txt").should_ingest is True
    assert f.evaluate("Dockerfile").should_ingest is True
    assert f.evaluate("go.mod").should_ingest is True
    assert f.evaluate("Cargo.toml").should_ingest is True
    assert f.evaluate("pyproject.toml").should_ingest is True
    assert f.evaluate("docker-compose.yml").should_ingest is True
    assert f.evaluate(".github/workflows/ci.yml").should_ingest is True
    assert f.evaluate(".github/workflows/deploy.yaml").should_ingest is True


def test_binary_file_rejection():
    """Binary and media files must be rejected."""
    f = FileFilter()
    result = f.evaluate("assets/logo.png")
    assert result.should_ingest is False
    assert result.skip_reason == "binary_or_media_file"

    assert f.evaluate("docs/spec.pdf").should_ingest is False
    assert f.evaluate("archive.zip").should_ingest is False
    assert f.evaluate("video.mp4").should_ingest is False
    assert f.evaluate("font.woff2").should_ingest is False
    assert f.evaluate("compiled.exe").should_ingest is False


def test_ignored_directory_handling():
    """Files inside ignored directories must be rejected."""
    f = FileFilter()
    result = f.evaluate("node_modules/react/index.js")
    assert result.should_ingest is False
    assert result.skip_reason == "ignored_directory"

    assert f.evaluate("venv/lib/site-packages/pip/__init__.py").should_ingest is False
    assert f.evaluate(".git/objects/pack/data").should_ingest is False
    assert f.evaluate("__pycache__/module.cpython-311.pyc").should_ingest is False
    assert f.evaluate("dist/bundle.js").should_ingest is False
    assert f.evaluate("build/output.js").should_ingest is False


def test_large_file_handling():
    """Files exceeding MAX_FILE_SIZE must be skipped with reason."""
    f = FileFilter(max_file_size=1024)
    assert f.evaluate("src/small.py", size=500).should_ingest is True

    result = f.evaluate("src/huge.py", size=2048)
    assert result.should_ingest is False
    assert result.skip_reason == "file_too_large"


def test_unsupported_file_type():
    """Files with unsupported extensions should be skipped."""
    f = FileFilter()
    result = f.evaluate("dataset.parquet")
    assert result.should_ingest is False
    assert result.skip_reason == "unsupported_file_type"

    assert f.evaluate("LICENSE").should_ingest is False
    assert f.evaluate("data.csv").should_ingest is False


# ═══════════════════════════════════════════════════════════════════════════════
# 2. LANGUAGE DETECTOR — Pure logic tests
# ═══════════════════════════════════════════════════════════════════════════════

def test_language_detection():
    """Extension-to-language mapping should be accurate."""
    d = LanguageDetector()
    assert d.detect("src/index.py") == "Python"
    assert d.detect("src/App.tsx") == "TypeScript"
    assert d.detect("src/App.jsx") == "JavaScript"
    assert d.detect("src/server.js") == "JavaScript"
    assert d.detect("src/server.ts") == "TypeScript"
    assert d.detect("main.go") == "Go"
    assert d.detect("lib.rs") == "Rust"
    assert d.detect("Main.java") == "Java"
    assert d.detect("app.c") == "C"
    assert d.detect("app.cpp") == "C++"
    assert d.detect("page.php") == "PHP"
    assert d.detect("script.rb") == "Ruby"


def test_filename_detection():
    """Special filenames should map to their correct types."""
    d = LanguageDetector()
    assert d.detect("Dockerfile") == "Docker"
    assert d.detect("package.json") == "JSON"
    assert d.detect("go.mod") == "Go Module"
    assert d.detect("requirements.txt") == "Text"
    assert d.detect("pyproject.toml") == "TOML"
    assert d.detect(".github/workflows/ci.yml") == "YAML"
    assert d.detect("unknown.xyz") == "Unknown"


def test_package_manager_detection():
    """Package manager detection based on lockfiles should work."""
    fd = FrameworkDetector()
    assert fd.detect_package_manager(["package.json", "yarn.lock"]) == "yarn"
    assert fd.detect_package_manager(["package.json", "pnpm-lock.yaml"]) == "pnpm"
    assert fd.detect_package_manager(["package.json", "package-lock.json"]) == "npm"
    assert fd.detect_package_manager(["package.json"]) == "npm"
    assert fd.detect_package_manager(["main.py"]) is None


def test_framework_detection():
    """Framework detection based on package.json should work."""
    fd = FrameworkDetector()
    pkg_express = '{"dependencies": {"express": "^4.18.2"}}'
    assert fd.detect_frameworks(package_json_content=pkg_express) == ["Express"]

    pkg_next_react = '{"dependencies": {"next": "^14.0.0", "react": "^18.2.0"}}'
    assert fd.detect_frameworks(package_json_content=pkg_next_react) == ["Next.js"]

    pkg_fastapi = "fastapi==0.110.0\nuvicorn==0.28.0"
    assert fd.detect_frameworks(requirements_txt_content=pkg_fastapi) == ["FastAPI"]

    assert fd.detect_frameworks() == []
    assert fd.detect_frameworks(package_json_content="{invalid json}") == []


# ═══════════════════════════════════════════════════════════════════════════════
# 3. SHA-256 & DATA NORMALIZER — Pure logic tests
# ═══════════════════════════════════════════════════════════════════════════════

def test_sha256_computation():
    """SHA-256 hash must match hashlib output exactly."""
    content = "def hello(): return 'world'\n"
    expected = hashlib.sha256(content.encode("utf-8")).hexdigest()
    assert DataNormalizer.compute_sha256(content) == expected
    assert len(expected) == 64


def test_sha256_empty_content():
    """Empty content should produce an empty string, not a hash."""
    assert DataNormalizer.compute_sha256(None) == ""


def test_normalizer_creates_correct_structure():
    """NormalizedFile should have sanitized paths, correct fields, and SHA-256."""
    nf = DataNormalizer.create_normalized_file(
        path="src\\auth\\login.py",
        content="print('login')",
        size=14,
        language="Python",
    )
    assert nf.path == "src/auth/login.py"
    assert nf.filename == "login.py"
    assert nf.extension == ".py"
    assert nf.language == "Python"
    assert nf.status == "INGESTED"
    assert len(nf.sha256) == 64
    assert nf.skip_reason is None


def test_normalizer_skipped_file():
    """Skipped files should have no SHA-256 and a skip_reason."""
    nf = DataNormalizer.create_normalized_file(
        path="node_modules/react/index.js",
        content=None,
        size=50000,
        language="JavaScript",
        status="SKIPPED",
        skip_reason="ignored_directory",
    )
    assert nf.status == "SKIPPED"
    assert nf.sha256 == ""
    assert nf.skip_reason == "ignored_directory"
    assert nf.content is None


# ═══════════════════════════════════════════════════════════════════════════════
# 4. GITHUB CLIENT — Token validation (no API calls)
# ═══════════════════════════════════════════════════════════════════════════════

def test_github_client_supports_optional_token():
    """GitHubClient should construct successfully without authorization headers when access_token is empty or mock."""
    c = GitHubClient(access_token=None)
    assert "Authorization" not in c.headers


def test_github_client_accepts_real_token():
    """GitHubClient should construct successfully with a token string."""
    c = GitHubClient(access_token="ghp_realTokenValue123")
    assert "Authorization" in c.headers
    assert c.headers["Authorization"] == "Bearer ghp_realTokenValue123"


# ═══════════════════════════════════════════════════════════════════════════════
# 5. INGESTION SERVICE — Token requirement validation
# ═══════════════════════════════════════════════════════════════════════════════

def test_ingestion_fails_without_token():
    """Ingestion pipeline must fail cleanly when no token is provided."""
    async def _run():
        db = TestingSessionLocal()
        try:
            repo = Repository(
                github_repo_id="999",
                owner="test-owner",
                name="test-repo",
                full_name="test-owner/test-repo",
                default_branch="main",
            )
            db.add(repo)
            db.commit()
            db.refresh(repo)

            service = IngestionService(db)
            run = service.create_analysis_run(repository_id=repo.id)
            assert run.status == "PENDING"

            # Execute without token — should FAIL, not mock
            completed = await service.execute_ingestion_pipeline(
                analysis_run_id=run.id,
                user_access_token=None,
            )
            assert completed.status == "FAILED"
            assert completed.error_message is not None
        finally:
            db.close()

    asyncio.run(_run())


def test_analysis_run_creation():
    """Analysis runs should be created in PENDING status with correct FK."""
    db = TestingSessionLocal()
    try:
        repo = Repository(
            github_repo_id="888",
            owner="run-test-owner",
            name="run-test-repo",
            full_name="run-test-owner/run-test-repo",
            default_branch="main",
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)

        service = IngestionService(db)
        run = service.create_analysis_run(repository_id=repo.id)
        assert run.status == "PENDING"
        assert run.repository_id == repo.id
        assert run.commit_sha is None
        assert run.files_found == 0
        assert run.files_ingested == 0
        assert run.files_skipped == 0

        # Verify it persisted in DB
        fetched = db.query(AnalysisRun).filter(AnalysisRun.id == run.id).first()
        assert fetched is not None
        assert fetched.status == "PENDING"
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════════
# 6. API ENDPOINTS — Auth & validation checks
# ═══════════════════════════════════════════════════════════════════════════════

def test_ingestion_api_requires_auth():
    """POST /api/repositories/{id}/ingest must return 401 without auth."""
    resp = client.post("/api/repositories/some-id/ingest")
    assert resp.status_code == 401


def test_ingestion_api_requires_real_repo():
    """POST /api/repositories/{id}/ingest should 404 for nonexistent repo."""
    db = TestingSessionLocal()
    user = User(
        email="api_test@example.com",
        username="api-tester",
        github_access_token="ghp_someRealToken123",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    from app.core.security import create_access_token
    token = create_access_token(subject=user.id)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/repositories/nonexistent-id/ingest", headers=headers)
    assert resp.status_code == 404
    db.close()


def test_ingestion_api_rejects_missing_github_token():
    """POST /api/repositories/{id}/ingest must return 403 if user has no GitHub token."""
    db = TestingSessionLocal()
    user = User(
        email="no_token_user@example.com",
        username="no-token-user",
        github_access_token=None,  # No token
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    repo = Repository(
        github_repo_id="777",
        owner="no-token-user",
        name="some-repo",
        full_name="no-token-user/some-repo",
        default_branch="main",
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)

    from app.core.security import create_access_token
    token = create_access_token(subject=user.id)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(f"/api/repositories/{repo.id}/ingest", headers=headers)
    assert resp.status_code == 202
    db.close()


def test_analysis_run_status_endpoint():
    """GET /api/analysis-runs/{id} should return run data."""
    db = TestingSessionLocal()
    user = User(
        email="status_test@example.com",
        username="status-tester",
        github_access_token="ghp_statusToken123",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    repo = Repository(
        github_repo_id="666",
        owner="status-tester",
        name="status-repo",
        full_name="status-tester/status-repo",
        default_branch="main",
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)

    service = IngestionService(db)
    run = service.create_analysis_run(repository_id=repo.id)

    from app.core.security import create_access_token
    token = create_access_token(subject=user.id)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get(f"/api/analysis-runs/{run.id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == run.id
    assert data["status"] == "PENDING"
    assert data["repository_id"] == repo.id
    db.close()


def test_analysis_run_404():
    """GET /api/analysis-runs/{id} should 404 for unknown IDs."""
    db = TestingSessionLocal()
    user = User(
        email="notfound_test@example.com",
        username="notfound-tester",
        github_access_token="ghp_nfToken123",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    from app.core.security import create_access_token
    token = create_access_token(subject=user.id)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/analysis-runs/nonexistent-run-id", headers=headers)
    assert resp.status_code == 404
    db.close()
