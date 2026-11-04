import uuid

import pytest

from app.ai import ast_adapter, context as context_module
from app.ai.ast_adapter import AstSymbol, find_enclosing_symbol, get_enclosing_symbol
from app.ai.context import build_finding_context, build_scan_contexts, select_top_findings
from app.ai.redaction import MASK
from app.models.models import AnalysisRun, Project, RepositoryFile, Scan, SecurityFinding, User

SECRET_TOKEN = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"


@pytest.fixture
def scan(db):
    user = User(email=f"user-{uuid.uuid4().hex}@example.com", username="tester")
    db.add(user)
    db.commit()
    project = Project(user_id=user.id, name="AI Context Project", repo_owner="org", repo_name="org/repo")
    db.add(project)
    db.commit()
    run = AnalysisRun(project_id=project.id, commit_sha="c" * 40, status="COMPLETED")
    db.add(run)
    db.commit()
    scan = Scan(project_id=project.id, analysis_run_id=run.id, commit_sha=run.commit_sha, status="COMPLETED")
    db.add(scan)
    db.commit()
    return scan


def add_file(db, scan, path, lines, language="Python", status="INGESTED"):
    repo_file = RepositoryFile(
        project_id=scan.project_id,
        analysis_run_id=scan.analysis_run_id,
        path=path,
        filename=path.rsplit("/", 1)[-1],
        language=language,
        content="\n".join(lines),
        status=status,
    )
    db.add(repo_file)
    db.commit()
    return repo_file


def add_finding(db, scan, **fields):
    defaults = dict(
        scan_id=scan.id,
        project_id=scan.project_id,
        engine="semgrep",
        finding_type="sast",
        title="SQL injection",
        severity="HIGH",
        status="OPEN",
        fingerprint=uuid.uuid4().hex,
    )
    defaults.update(fields)
    finding = SecurityFinding(**defaults)
    db.add(finding)
    db.commit()
    return finding


def numbered_lines(count):
    return [f"line_{n} = {n}" for n in range(1, count + 1)]


# --- SAST code window -------------------------------------------------------


def test_sast_finding_gets_line_window(db, scan):
    add_file(db, scan, "app/db.py", numbered_lines(100))
    finding = add_finding(db, scan, file_path="app/db.py", line_start=50, line_end=51, cwe="CWE-89")

    ctx = build_finding_context(db, finding, "F1")

    assert ctx.ref == "F1"
    assert ctx.code is not None
    assert ctx.code.source == "lines"
    assert (ctx.code.start_line, ctx.code.end_line) == (35, 66)
    code_lines = ctx.code.code.splitlines()
    assert code_lines[0] == "line_35 = 35"
    assert code_lines[-1] == "line_66 = 66"
    assert ctx.catalog_fix and "parameterized" in ctx.catalog_fix


def test_line_window_is_clamped_at_file_start_and_end(db, scan):
    add_file(db, scan, "app/short.py", numbered_lines(10))
    first = add_finding(db, scan, file_path="app/short.py", line_start=1, line_end=1)
    last = add_finding(db, scan, file_path="app/short.py", line_start=10, line_end=10)

    first_code = build_finding_context(db, first, "F1").code
    last_code = build_finding_context(db, last, "F2").code
    assert (first_code.start_line, first_code.end_line) == (1, 10)
    assert (last_code.start_line, last_code.end_line) == (1, 10)


def test_line_end_beyond_file_is_clamped(db, scan):
    add_file(db, scan, "app/short.py", numbered_lines(10))
    finding = add_finding(db, scan, file_path="app/short.py", line_start=9, line_end=40)

    code = build_finding_context(db, finding, "F1").code
    assert code.end_line == 10


def test_missing_file_or_line_gives_no_code(db, scan):
    add_file(db, scan, "app/short.py", numbered_lines(10))
    add_file(db, scan, "app/skipped.py", numbered_lines(10), status="SKIPPED")
    no_file = add_finding(db, scan, file_path="app/missing.py", line_start=3, line_end=3)
    skipped = add_finding(db, scan, file_path="app/skipped.py", line_start=3, line_end=3)
    past_end = add_finding(db, scan, file_path="app/short.py", line_start=50, line_end=50)
    no_line = add_finding(db, scan, file_path="app/short.py", line_start=None, line_end=None)

    for finding in (no_file, skipped, past_end, no_line):
        assert build_finding_context(db, finding, "F1").code is None


def test_file_from_another_analysis_run_is_not_used(db, scan):
    other_run = AnalysisRun(project_id=scan.project_id, commit_sha="d" * 40, status="COMPLETED")
    db.add(other_run)
    db.commit()
    db.add(RepositoryFile(
        project_id=scan.project_id, analysis_run_id=other_run.id, path="app/db.py",
        filename="db.py", content="x = 1", status="INGESTED",
    ))
    db.commit()
    finding = add_finding(db, scan, file_path="app/db.py", line_start=1, line_end=1)

    assert build_finding_context(db, finding, "F1").code is None


# --- Redaction --------------------------------------------------------------


def test_planted_secret_in_code_window_is_masked(db, scan):
    lines = numbered_lines(20)
    lines[9] = f"GITHUB = '{SECRET_TOKEN}'"
    add_file(db, scan, "app/client.py", lines)
    finding = add_finding(db, scan, file_path="app/client.py", line_start=12, line_end=12)

    ctx = build_finding_context(db, finding, "F1")

    assert SECRET_TOKEN not in ctx.model_dump_json()
    assert MASK in ctx.code.code


def test_lines_flagged_by_gitleaks_are_masked(db, scan):
    lines = numbered_lines(20)
    lines[4] = "conn_string = 'Server=db;Uid=sa;Pwd=Unusual-Format-Value'"
    add_file(db, scan, "app/settings.py", lines)
    add_finding(
        db, scan, engine="gitleaks", finding_type="secret", title="Generic secret",
        severity="MEDIUM", file_path="app/settings.py", line_start=5, line_end=5,
    )
    finding = add_finding(db, scan, file_path="app/settings.py", line_start=8, line_end=8)

    code = build_finding_context(db, finding, "F1").code.code

    assert "Unusual-Format-Value" not in code
    assert code.splitlines()[4] == MASK


def test_secret_in_title_and_message_is_masked(db, scan):
    finding = add_finding(
        db, scan, title=f"Token {SECRET_TOKEN} in source",
        description=f"Found {SECRET_TOKEN}", file_path=None,
    )

    ctx = build_finding_context(db, finding, "F1")
    assert SECRET_TOKEN not in ctx.model_dump_json()


def test_sensitive_file_never_sends_code(db, scan):
    add_file(db, scan, "config/.env", ["DEBUG=true", "PORT=8080"], language="Unknown")
    finding = add_finding(db, scan, file_path="config/.env", line_start=1, line_end=1)

    assert build_finding_context(db, finding, "F1").code is None


# --- Secret and dependency findings -----------------------------------------


def test_secret_finding_carries_no_code(db, scan):
    lines = numbered_lines(20)
    lines[2] = f"TOKEN = '{SECRET_TOKEN}'"
    add_file(db, scan, "app/client.py", lines)
    finding = add_finding(
        db, scan, engine="gitleaks", finding_type="secret", title="GitHub Personal Access Token",
        severity="MEDIUM", rule_id="github-pat", file_path="app/client.py", line_start=3, line_end=3,
    )

    ctx = build_finding_context(db, finding, "F1")

    assert ctx.code is None
    assert ctx.file_path == "app/client.py"
    assert ctx.catalog_fix and "revoke" in ctx.catalog_fix.lower()
    assert SECRET_TOKEN not in ctx.model_dump_json()


def test_dependency_finding_carries_package_fields_and_no_code(db, scan):
    add_file(db, scan, "requirements.txt", ["django==3.2.0"], language="Text")
    finding = add_finding(
        db, scan, engine="osv", finding_type="dependency", title="Django SQL injection",
        severity="CRITICAL", file_path="requirements.txt", line_start=1, line_end=1,
        package_name="django", package_version="3.2.0", fixed_version="3.2.14",
        ecosystem="PyPI", cve="CVE-2022-34265",
    )

    ctx = build_finding_context(db, finding, "F1")

    assert ctx.code is None
    assert (ctx.package_name, ctx.package_version, ctx.fixed_version) == ("django", "3.2.0", "3.2.14")
    assert ctx.cve == "CVE-2022-34265"
    assert ctx.catalog_fix is None


def test_context_uses_only_stored_values(db, scan):
    finding = add_finding(db, scan, engine="osv", finding_type="dependency", title="Advisory", confidence=None)

    ctx = build_finding_context(db, finding, "F1")
    dumped = ctx.model_dump()
    assert dumped["ecosystem"] is None
    assert "confidence" not in dumped
    assert finding.id not in ctx.model_dump_json()


def test_unknown_cwe_has_no_catalog_fix(db, scan):
    finding = add_finding(db, scan, cwe="CWE-1333")
    assert build_finding_context(db, finding, "F1").catalog_fix is None


# --- AST adapter ------------------------------------------------------------


def test_find_enclosing_symbol_picks_smallest():
    cls = AstSymbol(name="UserController", kind="class", start_line=1, end_line=100)
    method = AstSymbol(name="login", kind="method", start_line=40, end_line=60)
    other = AstSymbol(name="logout", kind="method", start_line=61, end_line=70)

    assert find_enclosing_symbol([cls, method, other], 45, 46) is method
    assert find_enclosing_symbol([cls, method, other], 58, 65) is cls
    assert find_enclosing_symbol([method], 10, 10) is None


def test_get_enclosing_symbol_falls_back_safely(monkeypatch):
    assert get_enclosing_symbol("run", "sha", "a.rb", "Ruby", 1, 1) is None
    assert get_enclosing_symbol("run", "sha", "a.py", "Python", 1, 1) is None

    def broken(*_args):
        raise ValueError("corrupt AST JSON")

    monkeypatch.setattr(ast_adapter, "load_symbols", broken)
    assert get_enclosing_symbol("run", "sha", "a.py", "Python", 1, 1) is None


def test_ast_symbol_is_used_for_code_context(db, scan, monkeypatch):
    add_file(db, scan, "app/auth.py", numbered_lines(200))
    finding = add_finding(db, scan, file_path="app/auth.py", line_start=110, line_end=110)
    symbol = AstSymbol(
        name="login", qualified_name="AuthService.login", kind="method", start_line=100, end_line=130,
        callers=["login_route"], calls=["cursor.execute"], imports=["import sqlite3"],
    )
    monkeypatch.setattr(context_module, "get_enclosing_symbol", lambda *args: symbol)

    code = build_finding_context(db, finding, "F1").code

    assert code.source == "ast"
    assert (code.start_line, code.end_line) == (100, 130)
    assert code.symbol_name == "AuthService.login"
    assert code.symbol_kind == "method"
    assert code.related == ["called by: login_route", "calls: cursor.execute", "import: import sqlite3"]


def test_oversized_ast_symbol_falls_back_to_line_window(db, scan, monkeypatch):
    add_file(db, scan, "app/big.py", numbered_lines(500))
    finding = add_finding(db, scan, file_path="app/big.py", line_start=250, line_end=250)
    symbol = AstSymbol(name="Huge", kind="class", start_line=1, end_line=500)
    monkeypatch.setattr(context_module, "get_enclosing_symbol", lambda *args: symbol)

    code = build_finding_context(db, finding, "F1").code

    assert (code.start_line, code.end_line) == (235, 265)
    assert code.symbol_name == "Huge"


# --- Scan selection ---------------------------------------------------------


def test_select_top_findings_orders_and_dedups(db, scan):
    low = add_finding(db, scan, title="low", severity="LOW")
    crit = add_finding(db, scan, title="crit", severity="CRITICAL")
    shared = uuid.uuid4().hex
    high_a = add_finding(db, scan, title="high a", severity="HIGH", fingerprint=shared, file_path="a.py", line_start=1)
    add_finding(db, scan, title="high b", severity="HIGH", fingerprint=shared, file_path="a.py", line_start=9)
    add_finding(db, scan, title="suppressed", severity="CRITICAL", status="SUPPRESSED")
    add_finding(db, scan, title="fixed", severity="CRITICAL", status="RESOLVED")

    top = select_top_findings(db, scan, limit=10)

    assert [f.id for f in top] == [crit.id, high_a.id, low.id]
    assert len(select_top_findings(db, scan, limit=2)) == 2


def test_build_scan_contexts_assigns_refs(db, scan):
    add_finding(db, scan, severity="HIGH")
    add_finding(db, scan, severity="LOW")

    contexts = build_scan_contexts(db, scan)

    assert [c.ref for c in contexts] == ["F1", "F2"]
    assert [c.severity for c in contexts] == ["HIGH", "LOW"]
