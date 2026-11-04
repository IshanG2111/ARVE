import uuid

import pytest

from app.auth.jwt import create_access_token
from app.models.models import AnalysisRun, Project, RepositoryFile, Scan, ScanEngineRun, SecurityFinding, User
from app.reports.builder import ReportNotAvailable, build_report
from app.reports.renderer import render_html, render_pdf, report_filename
from tests.conftest import client

SECRET_TOKEN = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"


def login(db, name):
    # Mock Firebase logins all map to one user, so distinct users are created directly.
    user = User(email=f"{name}-{uuid.uuid4().hex}@example.com", username=name)
    db.add(user)
    db.commit()
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}, user.id


def make_scan(db, user_id=None, status="COMPLETED"):
    if user_id is None:
        user = User(email=f"user-{uuid.uuid4().hex}@example.com", username="tester")
        db.add(user)
        db.commit()
        user_id = user.id
    project = Project(user_id=user_id, name="Demo App", repo_owner="org", repo_name="org/demo-app", branch="main")
    db.add(project)
    db.commit()
    run = AnalysisRun(
        project_id=project.id, commit_sha="abcdef1234567890" * 2 + "abcdef12", status="COMPLETED",
        files_ingested=12, languages_summary='{"Python": 9, "JavaScript": 3}',
    )
    db.add(run)
    db.commit()
    scan = Scan(project_id=project.id, analysis_run_id=run.id, commit_sha=run.commit_sha, status=status)
    db.add(scan)
    db.commit()
    return scan


def add_engine(db, scan, engine, status="COMPLETED", exit_code=0, error_message=None):
    db.add(ScanEngineRun(scan_id=scan.id, engine_name=engine, status=status, exit_code=exit_code, error_message=error_message))
    db.commit()


def add_finding(db, scan, **fields):
    defaults = dict(
        scan_id=scan.id, project_id=scan.project_id, engine="semgrep", finding_type="sast",
        title="SQL injection", severity="HIGH", status="OPEN", fingerprint=uuid.uuid4().hex,
    )
    defaults.update(fields)
    finding = SecurityFinding(**defaults)
    db.add(finding)
    db.commit()
    return finding


def add_file(db, scan, path, lines):
    db.add(RepositoryFile(
        project_id=scan.project_id, analysis_run_id=scan.analysis_run_id, path=path,
        filename=path.rsplit("/", 1)[-1], language="Python", content="\n".join(lines), status="INGESTED",
    ))
    db.commit()


def all_engines_completed(db, scan):
    for engine in ("osv", "gitleaks", "semgrep", "codeql"):
        add_engine(db, scan, engine)


def engine(report, name):
    return next(e for e in report.engines if e.engine == name)


# --- Builder ----------------------------------------------------------------


def test_counts_group_by_fingerprint_and_cover_active_only(db):
    scan = make_scan(db)
    all_engines_completed(db, scan)
    shared = uuid.uuid4().hex
    add_finding(db, scan, severity="HIGH", fingerprint=shared, file_path="app/db.py", line_start=10)
    add_finding(db, scan, severity="HIGH", fingerprint=shared, file_path="app/db.py", line_start=40)
    add_finding(db, scan, severity="CRITICAL", engine="osv", finding_type="dependency", title="Django advisory",
                package_name="django", package_version="3.2.0", fixed_version="3.2.14")
    add_finding(db, scan, severity="CRITICAL", status="SUPPRESSED")

    report = build_report(db, scan)

    assert report.active_total == 2
    assert dict(report.severity_counts) == {"CRITICAL": 1, "HIGH": 1, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    assert report.inactive_counts == [("SUPPRESSED", 1)]
    grouped = next(f for f in report.findings if f.occurrence_count == 2)
    assert grouped.locations == ["app/db.py:10", "app/db.py:40"]
    assert [f.severity for f in report.findings][:2] == ["CRITICAL", "HIGH"]  # active first, by severity
    assert report.findings[-1].status == "SUPPRESSED"
    dep = next(f for f in report.findings if f.finding_type == "dependency")
    assert dep.fix == "Upgrade django from 3.2.0 to 3.2.14 or later."
    assert report.languages == ["Python", "JavaScript"]


def test_failed_and_missing_engines_are_not_zero_findings(db):
    scan = make_scan(db, status="PARTIAL")
    add_engine(db, scan, "semgrep")
    add_engine(db, scan, "codeql", status="FAILED", exit_code=2)
    add_engine(db, scan, "osv", exit_code=128)

    report = build_report(db, scan)

    assert engine(report, "codeql").state == "Failed"
    assert engine(report, "codeql").finding_count is None
    assert engine(report, "gitleaks").state == "Not run"
    assert engine(report, "osv").state == "Not applicable"
    semgrep = engine(report, "semgrep")
    assert (semgrep.state, semgrep.finding_count) == ("Completed", 0)
    assert "not proof" in semgrep.note
    assert report.partial

    html = render_html(report)
    assert "Partial coverage" in html
    assert "not proof that the code is secure" in html


def test_codeql_partial_language_failure_is_flagged(db):
    scan = make_scan(db)
    all_engines_completed(db, scan)
    db.query(ScanEngineRun).filter_by(scan_id=scan.id, engine_name="codeql").update(
        {"exit_code": 1, "error_message": "partial language failures: javascript"}
    )
    db.commit()

    report = build_report(db, scan)
    assert engine(report, "codeql").state == "Completed with errors"
    assert report.partial


def test_unverified_secret_result(db):
    scan = make_scan(db)
    all_engines_completed(db, scan)
    db.query(ScanEngineRun).filter_by(scan_id=scan.id, engine_name="gitleaks").update({"exit_code": 1})
    db.commit()

    assert engine(build_report(db, scan), "gitleaks").state == "Result unverified"


@pytest.mark.parametrize("status", ["QUEUED", "SCANNING", "FAILED", "CANCELLED"])
def test_unfinished_scan_is_not_reportable(db, status):
    scan = make_scan(db, status=status)
    with pytest.raises(ReportNotAvailable):
        build_report(db, scan)


def test_scan_with_no_usable_engine_is_not_reportable(db):
    scan = make_scan(db, status="PARTIAL")
    for name in ("osv", "gitleaks", "semgrep", "codeql"):
        add_engine(db, scan, name, status="FAILED")
    with pytest.raises(ReportNotAvailable):
        build_report(db, scan)


def test_excerpt_is_short_and_masks_secrets(db):
    scan = make_scan(db)
    all_engines_completed(db, scan)
    lines = [f"line_{n} = {n}" for n in range(1, 41)]
    lines[19] = f"TOKEN = '{SECRET_TOKEN}'"
    add_file(db, scan, "app/client.py", lines)
    add_finding(db, scan, file_path="app/client.py", line_start=20, line_end=20)

    finding = build_report(db, scan).findings[0]

    assert finding.excerpt_start == 17
    assert len(finding.excerpt.splitlines()) == 7
    assert SECRET_TOKEN not in finding.excerpt
    assert SECRET_TOKEN not in render_html(build_report(db, scan))


def test_secret_findings_have_no_excerpt(db):
    scan = make_scan(db)
    all_engines_completed(db, scan)
    add_file(db, scan, "app/client.py", [f"TOKEN = '{SECRET_TOKEN}'"])
    add_finding(db, scan, engine="gitleaks", finding_type="secret", title="GitHub token", severity="MEDIUM",
                file_path="app/client.py", line_start=1, line_end=1)

    finding = build_report(db, scan).findings[0]
    assert finding.excerpt is None
    assert "revoke" in finding.fix.lower()


def test_advisory_markdown_is_flattened_and_shortened(db):
    scan = make_scan(db)
    all_engines_completed(db, scan)
    long_md = "### Summary\n`qs.stringify()` calls **utils.isBuffer()** on values.\n\n" + "word " * 400
    add_finding(db, scan, engine="osv", finding_type="dependency", description=long_md)

    description = build_report(db, scan).findings[0].description
    assert description.startswith("Summary `qs.stringify()` calls utils.isBuffer() on values.")
    assert "###" not in description and "**" not in description
    assert len(description) <= 704 and description.endswith(" ...")


def test_unknown_language_is_hidden(db):
    scan = make_scan(db)
    scan.analysis_run.languages_summary = '{"Unknown": 40, "Python": 3}'
    db.commit()
    all_engines_completed(db, scan)
    assert build_report(db, scan).languages == ["Python"]


# --- Rendering --------------------------------------------------------------


def test_repository_text_is_escaped(db):
    scan = make_scan(db)
    all_engines_completed(db, scan)
    add_file(db, scan, "app/<img src=x onerror=alert(1)>.py", ["x = '<script>alert(1)</script>'"])
    add_finding(db, scan, title="<script>alert('title')</script>", description="<b onmouseover=alert(1)>hi</b>",
                file_path="app/<img src=x onerror=alert(1)>.py", line_start=1, line_end=1)

    html = render_html(build_report(db, scan))

    assert "<script>alert" not in html
    assert "<img src=x" not in html
    assert "<b onmouseover" not in html
    assert "&lt;script&gt;alert(&#39;title&#39;)&lt;/script&gt;" in html


def test_html_has_no_remote_resources(db):
    scan = make_scan(db)
    all_engines_completed(db, scan)
    add_finding(db, scan)
    html = render_html(build_report(db, scan))
    assert "http://" not in html and "https://" not in html
    assert "<script" not in html


def test_no_findings_report_says_not_proof(db):
    scan = make_scan(db)
    all_engines_completed(db, scan)
    html = render_html(build_report(db, scan))
    assert "reported no findings" in html
    assert "not proof that the code is secure" in html


def test_pdf_renders(db):
    scan = make_scan(db)
    all_engines_completed(db, scan)
    add_file(db, scan, "app/db.py", ["def q(u):", "    return db.execute('SELECT * FROM t WHERE id=' + u)" + " " * 5 + "x" * 200])
    add_finding(db, scan, file_path="app/db.py", line_start=2, line_end=2, cwe="CWE-89")
    add_finding(db, scan, engine="osv", finding_type="dependency", package_name="lodash", package_version="4.17.0",
                fixed_version="4.17.21", severity="CRITICAL", file_path="package-lock.json")

    pdf = render_pdf(build_report(db, scan))
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 1000


def test_report_filename(db):
    scan = make_scan(db)
    all_engines_completed(db, scan)
    assert report_filename(build_report(db, scan), "pdf") == "arve-security-report-demo-app-abcdef1.pdf"


# --- API --------------------------------------------------------------------


def test_owner_gets_html_and_pdf(db):
    headers, user_id = login(db, "report_owner")
    scan = make_scan(db, user_id=user_id)
    all_engines_completed(db, scan)
    add_finding(db, scan)

    html = client.get(f"/api/scans/{scan.id}/report.html", headers=headers)
    assert html.status_code == 200
    assert "Security Audit Report" in html.text
    assert "default-src 'none'" in html.headers["content-security-policy"]

    pdf = client.get(f"/api/scans/{scan.id}/report.pdf", headers=headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert "attachment" in pdf.headers["content-disposition"]
    assert pdf.content.startswith(b"%PDF")


def test_other_user_gets_404(db):
    _, owner_id = login(db, "report_owner_2")
    other_headers, _ = login(db, "report_intruder")
    scan = make_scan(db, user_id=owner_id)
    all_engines_completed(db, scan)

    for suffix in ("report.html", "report.pdf"):
        assert client.get(f"/api/scans/{scan.id}/{suffix}", headers=other_headers).status_code == 404


def test_unauthenticated_is_rejected(db):
    scan = make_scan(db)
    assert client.get(f"/api/scans/{scan.id}/report.html").status_code in (401, 403)


def test_unfinished_scan_returns_409(db):
    headers, user_id = login(db, "report_owner_3")
    scan = make_scan(db, user_id=user_id, status="SCANNING")
    resp = client.get(f"/api/scans/{scan.id}/report.html", headers=headers)
    assert resp.status_code == 409
