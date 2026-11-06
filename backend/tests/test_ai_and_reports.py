"""Comprehensive test suite for Gemini Flash integration, AI caching, and report generation."""
import json
import pytest
from unittest.mock import MagicMock, patch

from app.ai.cache import (
    compute_cache_key,
    get_cached_summary,
    persist_ai_summary,
    get_inflight_lock,
)
from app.ai.fallback import generate_fallback_summary
from app.ai.gemini_client import GeminiAPIError, GeminiClient
from app.ai.prompt import (
    OUTPUT_SCHEMA_VERSION,
    PROMPT_VERSION,
    build_canonical_scan_input,
    build_gemini_prompt,
)
from app.ai.schemas import AISummary, AISummaryResult
from app.ai.summarizer import AISummarizerService
from app.models.models import (
    AIExplanation,
    ASTAnalysisRun,
    Project,
    Scan,
    ScanEngineRun,
    ScanReport,
    SecurityFinding,
    User,
)
from app.reports.generator import ReportGenerator
from app.reports.markdown_generator import generate_markdown_report
from app.reports.pdf_generator import generate_pdf_report
from app.reports.schemas import ScanReportData, PriorityRiskItem
from app.reports.validator import ReportValidator
from app.ai.providers import BaseAIProvider, GeminiProvider, OllamaProvider, GroqProvider, get_ai_provider


@pytest.fixture
def sample_user(db):
    user = db.query(User).filter(User.email == "security-tester@arve.local").first()
    if not user:
        user = User(
            email="security-tester@arve.local",
            username="sectester",
            full_name="Sec Tester",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@pytest.fixture
def sample_project(db, sample_user):
    project = Project(
        user_id=sample_user.id,
        name="Payment Service",
        repo_owner="acme-corp",
        repo_name="acme-corp/payment-service",
        repo_language="Python",
        repo_frameworks="FastAPI, SQLAlchemy",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@pytest.fixture
def sample_scan(db, sample_project):
    scan = Scan(
        project_id=sample_project.id,
        analysis_run_id="mock-analysis-run-123",
        commit_sha="a1b2c3d4e5f67890123456789abcdef012345678",
        status="COMPLETED",
        progress_percent=100,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # Add engine runs
    db.add(
        ScanEngineRun(
            scan_id=scan.id,
            engine_name="semgrep",
            status="SUCCESS",
            duration_ms=450,
        )
    )
    db.add(
        ScanEngineRun(
            scan_id=scan.id,
            engine_name="gitleaks",
            status="SUCCESS",
            duration_ms=210,
        )
    )

    # Add AST run
    db.add(
        ASTAnalysisRun(
            scan_id=scan.id,
            project_id=sample_project.id,
            commit_sha=scan.commit_sha,
            schema_version="1.0.0",
            parser_versions={"python": "0.23.6"},
            status="COMPLETED",
            total_functions=142,
            total_classes=18,
            total_imports=56,
            total_relationships=84,
            files_parsed=24,
            files_failed=0,
        )
    )

    # Add canonical findings
    db.add(
        SecurityFinding(
            scan_id=scan.id,
            project_id=sample_project.id,
            engine="semgrep",
            finding_type="vulnerability",
            title="SQL Injection via string formatting",
            description="Detected raw format string in SQL query execution.",
            severity="CRITICAL",
            file_path="app/routes/billing.py",
            line_start=45,
            line_end=48,
            rule_id="python.sqlalchemy.security.audit.avoid-text-format",
            cwe="CWE-89",
            fingerprint="fp-sql-injection-billing-45",
        )
    )
    db.add(
        SecurityFinding(
            scan_id=scan.id,
            project_id=sample_project.id,
            engine="gitleaks",
            finding_type="secret",
            title="Hardcoded AWS Access Key",
            description="Exposed AWS access credential token identified.",
            severity="HIGH",
            file_path="config/aws.py",
            line_start=12,
            line_end=12,
            rule_id="aws-access-key-id",
            cwe="CWE-798",
            fingerprint="fp-aws-key-config-12",
        )
    )
    db.commit()
    db.refresh(scan)
    return scan


# =========================================================================
# Phase 1 & 2: Gemini Client & Schema Validation
# =========================================================================

def test_gemini_client_success_parsing():
    """Verify GeminiClient parses valid JSON response and populates token metrics."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "overall_summary": "Payment Service demonstrates good structure but contains critical security exposures.",
                                "main_concerns": ["Raw SQL injection in billing endpoints", "Exposed AWS access keys"],
                                "risk_overview": "Risks are concentrated in billing query assembly and static config credentials.",
                                "impact": "Adversaries could extract financial databases or access cloud storage buckets.",
                                "priority_actions": ["Migrate raw queries to ORM parameterized queries", "Revoke exposed AWS keys"],
                                "positive_observations": ["Clean dependency security baseline with no critical CVEs."],
                            })
                        }
                    ]
                }
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 420,
            "candidatesTokenCount": 115,
        },
        "modelVersion": "gemini-1.5-flash-002",
    }

    client = GeminiClient(api_key="test-key", model="gemini-2.5-flash")
    with patch("httpx.Client.post", return_value=mock_response):
        parsed, meta = client.generate_json_summary("System instruction", "User prompt")
        assert parsed["overall_summary"].startswith("Payment Service")
        assert len(parsed["main_concerns"]) == 2
        assert meta["input_tokens"] == 420
        assert meta["output_tokens"] == 115
        assert meta["served_model"] == "gemini-1.5-flash-002"

        # Validate with Pydantic
        summary = AISummary.model_validate(parsed)
        assert summary.overall_summary


def test_gemini_client_timeout_and_retries():
    """Verify GeminiClient retries on transient errors and bounds retries."""
    import httpx
    client = GeminiClient(api_key="test-key", max_retries=1, timeout_seconds=1)
    with patch("httpx.Client.post", side_effect=httpx.TimeoutException("Read timed out")):
        with pytest.raises(GeminiAPIError) as exc_info:
            client.generate_json_summary("System", "Prompt")
        assert "call failed after retries" in str(exc_info.value)


def test_gemini_invalid_json_handling():
    """Verify GeminiClient raises GeminiAPIError when output is not valid JSON."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "I am an AI and here is your summary: Everything is fine."}]
                }
            }
        ]
    }
    client = GeminiClient(api_key="test-key")
    with patch("httpx.Client.post", return_value=mock_response):
        with pytest.raises(GeminiAPIError) as exc_info:
            client.generate_json_summary("System", "Prompt")
        assert "Failed to parse Gemini response as JSON" in str(exc_info.value)


# =========================================================================
# Phase 3: Caching, Key Invalidation, and Token Optimisation
# =========================================================================

def test_cache_key_determinism():
    """Verify cache keys are identical for identical scan inputs, and change when inputs change."""
    input_a = {"project": "test", "metrics": {"CRITICAL": 1}}
    input_b = {"project": "test", "metrics": {"CRITICAL": 1}}
    input_c = {"project": "test", "metrics": {"CRITICAL": 2}}

    key_a = compute_cache_key(input_a)
    key_b = compute_cache_key(input_b)
    key_c = compute_cache_key(input_c)

    assert key_a == key_b
    assert key_a != key_c


def test_cache_key_invalidation_on_prompt_or_model_version():
    """Verify cache key changes when prompt version or model version changes."""
    base_input = {"project": "test", "findings": []}
    key_v1 = compute_cache_key(base_input, prompt_version="v1.0")
    key_v2 = compute_cache_key(base_input, prompt_version="v2.0")
    key_model = compute_cache_key(base_input, model_version="gemini-2.0-flash")

    assert key_v1 != key_v2
    assert key_v1 != key_model


def test_duplicate_request_prevention_lock():
    """Verify inflight synchronization lock retrieves identical lock object for same key."""
    key = "sample-sha256-key-123"
    lock1 = get_inflight_lock(key)
    lock2 = get_inflight_lock(key)
    assert lock1 is lock2


def test_persistent_caching_hit_and_reuse(db, sample_scan):
    """Verify summarizer reuses cached summary from Neon DB on second call with 0 AI requests."""
    mock_client = MagicMock(spec=GeminiClient)
    mock_client.is_configured = True
    mock_client.model = "gemini-3.5-flash"
    mock_client.generate_json_summary.return_value = (
        {
            "overall_summary": "Initial analysis of the repository",
            "main_concerns": ["[CRITICAL] Flaw in auth: reason"],
            "risk_overview": "Risk overview text",
            "impact": "Impact text",
            "prioritized_actions": [
                {
                    "priority": "Priority 1",
                    "action": "Action 1",
                    "target": "target package",
                    "rationale": "rationale description",
                }
            ],
            "positive_observations": ["Positive 1"],
        },
        {"input_tokens": 250, "output_tokens": 90, "latency_ms": 120, "served_model": "gemini-3.5-flash"}
    )
    summarizer = AISummarizerService(db, gemini_client=mock_client)

    result1 = summarizer.get_or_generate_scan_summary(sample_scan.id)
    assert result1.summary.overall_summary
    assert mock_client.generate_json_summary.call_count == 1

    # Second call should be a cache hit with 0 additional AI API calls
    result2 = summarizer.get_or_generate_scan_summary(sample_scan.id)
    assert result2.metadata.cache_hit is True
    assert mock_client.generate_json_summary.call_count == 1
    assert result2.summary.overall_summary == result1.summary.overall_summary


def test_zero_findings_handling(db, sample_project):
    """Verify clean repository with 0 findings generates a positive summary."""
    clean_scan = Scan(
        project_id=sample_project.id,
        analysis_run_id="mock-clean-run",
        commit_sha="clean-sha-12345",
        status="COMPLETED",
    )
    db.add(clean_scan)
    db.commit()
    db.refresh(clean_scan)

    summarizer = AISummarizerService(db)
    result = summarizer.get_or_generate_scan_summary(clean_scan.id)
    summary_lower = result.summary.overall_summary.lower()
    assert any(term in summary_lower for term in ["zero", "0 findings", "0 security", "no vulnerabilities", "clean", "no findings"])


def test_large_repository_findings_aggregation():
    """Verify large number of repetitive findings are aggregated into token-efficient buckets."""
    # 300 findings of same rule across 50 files
    massive_findings = [
        {
            "id": f"finding-{i}",
            "title": "Use of unsafe eval",
            "rule_id": "python.security.eval",
            "severity": "HIGH",
            "engine": "semgrep",
            "file_path": f"module_{i % 10}/handler.py",
            "line_start": i + 1,
            "description": "Dynamic code execution",
        }
        for i in range(300)
    ]
    canonical = build_canonical_scan_input(
        project_name="Large App",
        repository_full_name="acme/large-app",
        language="Python",
        frameworks="Django",
        findings=massive_findings,
    )
    assert canonical["metrics"]["total_findings"] == 300
    # Aggregated into 1 rule summary entry rather than 300 distinct elements
    assert len(canonical["findings_summary"]) == 1
    assert canonical["findings_summary"][0]["occurrences"] == 300
    assert len(canonical["findings_summary"][0]["sample_locations"]) <= 3


# =========================================================================
# Phase 4 & 6: Unified Report Generation (PDF, Markdown, Persistence)
# =========================================================================

def test_unified_report_schema_and_findings_match(db, sample_scan):
    """Verify report data schema matches canonical scan findings exactly."""
    generator = ReportGenerator(db)
    report_data = generator.generate_report_data(sample_scan.id)

    assert report_data.scan_id == sample_scan.id
    assert report_data.project_name == "Payment Service"
    assert report_data.total_findings == 2
    assert report_data.severity_counts["CRITICAL"] == 1
    assert report_data.severity_counts["HIGH"] == 1
    assert len(report_data.important_findings) == 2
    assert len(report_data.appendix_findings) == 2

    # Verification: canonical findings match report findings
    finding_titles = {f.title for f in report_data.appendix_findings}
    assert "SQL Injection via string formatting" in finding_titles
    assert "Hardcoded AWS Access Key" in finding_titles


def test_markdown_report_generation(db, sample_scan):
    """Verify Markdown report generation contains all 6 required sections."""
    generator = ReportGenerator(db)
    md = generator.export_markdown(sample_scan.id)

    assert "# ARVE Security Report" in md
    assert "## 01 — Executive Summary" in md
    assert "## 02 — Security Overview" in md
    assert "## 03 — Important Findings" in md
    assert "## 04 — AI Recommendations" in md
    assert "## 05 — Analysis Coverage" in md
    assert "## 06 — Technical Appendix" in md
    assert "SQL Injection via string formatting" in md
    assert "CWE-89" in md
    assert "semgrep" in md


def test_pdf_report_generation(db, sample_scan):
    """Verify PDF report generation produces valid non-empty PDF binary."""
    generator = ReportGenerator(db)
    pdf_bytes = generator.export_pdf(sample_scan.id)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    # PDF specification magic bytes
    assert pdf_bytes.startswith(b"%PDF-")


def test_scan_report_neon_db_persistence(db, sample_scan):
    """Verify reports are persisted and subsequent queries reuse the persisted record."""
    generator = ReportGenerator(db)
    report_data1, record1 = generator.get_or_create_persisted_report(sample_scan.id)

    # Check database record
    db_record = db.query(ScanReport).filter(ScanReport.scan_id == sample_scan.id).first()
    assert db_record is not None
    assert db_record.id == record1.id
    assert db_record.status == "READY"

    # Second call reuses existing record without re-generating
    report_data2, record2 = generator.get_or_create_persisted_report(sample_scan.id)
    assert record1.id == record2.id
    assert report_data1.scan_id == report_data2.scan_id


# =========================================================================
# Phase 6 & API: Endpoint Integration Tests
# =========================================================================

def test_report_api_endpoints(db, sample_user, sample_scan):
    """Verify FastAPI endpoints for report retrieval, generation, and downloads directly."""
    from unittest.mock import patch
    import pytest
    from fastapi import HTTPException
    from app.api.reports import download_scan_report, generate_scan_report, get_scan_report
    from app.ai.schemas import AIPriorityItem, AISummary, AISummaryMetadata, AISummaryResult

    mock_result = AISummaryResult(
        summary=AISummary(
            overall_summary="Test automated report summary for API endpoints.",
            main_concerns=["[CRITICAL] SQL Injection in billing route", "[HIGH] AWS credential exposure"],
            risk_overview="Risks reside in database input handling and configuration credentials.",
            impact="Potential database extraction and unauthorized resource access.",
            prioritized_actions=[
                AIPriorityItem(
                    priority="P0",
                    action="Switch to parameterized queries",
                    target="billing.py",
                    rationale="Mitigates critical SQL injection",
                )
            ],
            positive_observations=["AST indexing active with 84 call relationships mapped."],
        ),
        metadata=AISummaryMetadata(
            cache_key="mock-key-12345",
            cache_hit=False,
            is_fallback=False,
            model="mock-gemini",
            served_model="mock-gemini",
            prompt_version="1.0",
        ),
    )

    with patch("app.ai.summarizer.AISummarizerService.get_or_generate_scan_summary", return_value=mock_result):
        # 1. Before generation, get_scan_report with generate_if_missing=False returns 404 REPORT_NOT_GENERATED
        with pytest.raises(HTTPException) as exc_info:
            get_scan_report(scan_id=sample_scan.id, generate_if_missing=False, db=db, current_user=sample_user)
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "REPORT_NOT_GENERATED"

        # 2. POST /api/scans/{id}/report/generate explicitly generates and persists
        gen_data = generate_scan_report(scan_id=sample_scan.id, force_refresh=True, db=db, current_user=sample_user)
        assert gen_data.scan_id == sample_scan.id
        assert gen_data.total_findings == 2

        # 3. Subsequent GET /api/scans/{id}/report returns the persisted report
        report_data = get_scan_report(scan_id=sample_scan.id, generate_if_missing=False, db=db, current_user=sample_user)
        assert report_data.scan_id == sample_scan.id
        assert report_data.total_findings == 2
        assert report_data.executive_summary == "Test automated report summary for API endpoints."

        # 4. GET /api/scans/{id}/report/download?format=md
        md_resp = download_scan_report(scan_id=sample_scan.id, format="md", db=db, current_user=sample_user)
        assert md_resp.status_code == 200
        assert "text/markdown" in md_resp.media_type
        assert "# ARVE Security Report" in md_resp.body.decode("utf-8")

        # 5. GET /api/scans/{id}/report/download?format=pdf
        pdf_resp = download_scan_report(scan_id=sample_scan.id, format="pdf", db=db, current_user=sample_user)
        assert pdf_resp.status_code == 200
        assert pdf_resp.media_type == "application/pdf"
        assert pdf_resp.body.startswith(b"%PDF-")


# =========================================================================
# Phase 8: Data Correctness & Automated Validation Acceptance Criteria
# =========================================================================

def test_report_validator_canonical_consistency(db, sample_scan):
    """Verify ReportValidator approves canonically consistent scan reports."""
    generator = ReportGenerator(db)
    report_data = generator.generate_report_data(sample_scan.id)

    validation = ReportValidator.validate(report_data)
    assert validation.is_valid is True
    assert validation.failed_checks == 0
    assert validation.passed_checks == validation.total_checks


def test_secret_detection_cross_check_validation_error():
    """Verify ReportValidator catches mismatch if Gitleaks has 0 findings but priority risk claims exposed key."""
    from app.reports.schemas import EngineCoverageItem, ReportFindingItem

    # Reproduce exact contradiction: Gitleaks reports 0 findings, but Priority Risks claims Gitleaks found a key
    report_data = ScanReportData(
        scan_id="test-scan-123",
        project_id="test-proj-123",
        project_name="Test Service",
        commit_sha="abcdef123456",
        scan_timestamp="2026-11-06 12:00:00 UTC",
        scan_status="COMPLETED",
        executive_summary="Test summary",
        main_concerns=[],
        risk_overview="None",
        impact="None",
        total_findings=1,
        severity_counts={"CRITICAL": 0, "HIGH": 1, "MEDIUM": 0, "LOW": 0, "INFO": 0},
        priority_risks=[
            PriorityRiskItem(
                index="01",
                title="Exposed API key",
                severity="High*",
                description="Gitleaks detected an exposed GCP API key in configuration.",
                target="src/secret.ts",
                related_finding_ids=["ARVE-F001"],
            )
        ],
        engine_coverage=[
            EngineCoverageItem(engine_name="semgrep", status="Completed", findings_count=1),
            EngineCoverageItem(engine_name="gitleaks", status="Completed", findings_count=0),
        ],
        appendix_findings=[
            ReportFindingItem(
                id="f1",
                display_id="ARVE-F001",
                title="Semgrep Finding",
                severity="HIGH",
                engine="semgrep",
                fingerprint="fp1",
            )
        ],
    )

    validation = ReportValidator.validate(report_data)
    assert validation.is_valid is False
    secret_check = next((c for c in validation.checks if c.check_name == "secret_detection_cross_check"), None)
    assert secret_check is not None
    assert secret_check.passed is False


def test_ai_provider_abstraction():
    """Verify Gemini, Ollama, and Groq providers conform to BaseAIProvider interface."""
    gemini = get_ai_provider("gemini")
    assert isinstance(gemini, BaseAIProvider)
    assert gemini.provider_name == "gemini"

    ollama = get_ai_provider("ollama")
    assert isinstance(ollama, BaseAIProvider)
    assert ollama.provider_name == "ollama"

    groq = get_ai_provider("groq")
    assert isinstance(groq, BaseAIProvider)
    assert groq.provider_name == "groq"


def test_large_scan_500_findings(db, sample_project):
    """Verify large scan with 500+ findings generates, validates, and exports to PDF and MD without failure."""
    import uuid
    large_scan = Scan(
        project_id=sample_project.id,
        analysis_run_id=f"large-scan-{uuid.uuid4().hex[:6]}",
        commit_sha="fedcba9876543210",
        status="COMPLETED",
    )
    db.add(large_scan)
    db.commit()

    db.add_all([
        ScanEngineRun(scan_id=large_scan.id, engine_name="osv", status="COMPLETED", duration_ms=1200),
        ScanEngineRun(scan_id=large_scan.id, engine_name="semgrep", status="COMPLETED", duration_ms=2500),
        ScanEngineRun(scan_id=large_scan.id, engine_name="gitleaks", status="COMPLETED", duration_ms=450),
    ])
    db.commit()

    # Generate 500 findings across engines
    findings = []
    for i in range(500):
        engine = "osv" if i < 350 else ("semgrep" if i < 450 else "gitleaks")
        sev = "CRITICAL" if i < 25 else ("HIGH" if i < 150 else ("MEDIUM" if i < 400 else "LOW"))
        pkg = f"package-dep-{i % 25}" if engine == "osv" else None
        findings.append(
            SecurityFinding(
                scan_id=large_scan.id,
                project_id=sample_project.id,
                engine=engine,
                finding_type="vulnerability",
                title=f"Vulnerability Alert #{i:04d} in {pkg or 'source file'}",
                description=f"Automated security finding description for item {i}",
                severity=sev,
                file_path=f"src/module_{i % 10}/component.ts",
                line_start=(i * 3) % 200 + 1,
                package_name=pkg,
                package_version="1.0.0",
                fixed_version="1.0.1" if i % 2 == 0 else None,
                fingerprint=f"large-fingerprint-{i}",
                status="OPEN",
            )
        )
    db.bulk_save_objects(findings)
    db.commit()

    generator = ReportGenerator(db)
    report_data = generator.generate_report_data(large_scan.id)

    # Integrity verification
    assert report_data.total_findings == len(report_data.appendix_findings)
    assert sum(report_data.severity_counts.values()) == report_data.total_findings
    validation = ReportValidator.validate(report_data)
    assert validation.is_valid is True

    # PDF & Markdown generation for 500-finding scan
    pdf_bytes = generator.export_pdf(large_scan.id)
    assert len(pdf_bytes) > 5000
    assert pdf_bytes.startswith(b"%PDF-")

    md_text = generator.export_markdown(large_scan.id)
    assert len(md_text) > 10000
    assert "06 — Technical Appendix" in md_text


