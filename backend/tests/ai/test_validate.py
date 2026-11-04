import json

from app.ai.schemas import CodeContext, FindingContext
from app.ai.validate import validate_finding_explanation, validate_scan_summary


def sast_ctx(ref="F1"):
    return FindingContext(
        ref=ref, engine="semgrep", finding_type="sast", title="SQL injection", severity="HIGH",
        file_path="app/db.py", line_start=12, line_end=12, cwe="CWE-89",
        code=CodeContext(source="lines", file_path="app/db.py", start_line=5, end_line=20,
                         code="def get(uid):\n    cursor.execute('SELECT * FROM t WHERE id=' + uid)"),
    )


def dep_ctx(ref="F2"):
    return FindingContext(
        ref=ref, engine="osv", finding_type="dependency", title="Django SQL injection", severity="CRITICAL",
        file_path="requirements.txt", package_name="django", package_version="3.2.0", fixed_version="3.2.14",
        cve="CVE-2022-34265",
    )


def answer(**overrides):
    base = {
        "summary": "get() concatenates uid into a SQL query in app/db.py.",
        "why_it_matters": "An attacker controlling uid can change the query on line 12 and read other rows.",
        "fix_steps": ["Use a parameterized query with cursor.execute and a tuple of parameters."],
        "suggested_code": "cursor.execute('SELECT * FROM t WHERE id = %s', (uid,))",
        "references_used": ["F1"],
        "caveats": [],
    }
    base.update(overrides)
    return json.dumps(base)


def test_valid_answer_passes_and_empty_code_becomes_none():
    parsed, problems = validate_finding_explanation(answer(), sast_ctx())
    assert problems == [] and parsed.suggested_code.startswith("cursor.execute")

    parsed, problems = validate_finding_explanation(answer(suggested_code="  "), sast_ctx())
    assert problems == [] and parsed.suggested_code is None


def test_invalid_json_and_schema():
    assert validate_finding_explanation("not json", sast_ctx())[0] is None
    assert validate_finding_explanation(json.dumps({"summary": "x"}), sast_ctx())[0] is None
    assert validate_finding_explanation(answer(extra_field="x"), sast_ctx())[0] is None


def problems_for(**overrides):
    return validate_finding_explanation(answer(**overrides), sast_ctx())[1]


def test_fabricated_identifiers_are_rejected():
    assert any("CVE-2021-44228" in p for p in problems_for(why_it_matters="This is like CVE-2021-44228."))
    assert any("CWE-79" in p for p in problems_for(summary="This is CWE-79."))
    assert problems_for(summary="This is CWE-89 in get().") == []


def test_fabricated_paths_and_lines_are_rejected():
    assert any("app/auth.py" in p for p in problems_for(summary="The same bug exists in app/auth.py."))
    assert any("line numbers" in p for p in problems_for(why_it_matters="See line 99."))
    assert problems_for(why_it_matters="See lines 12 to 14 where uid is used.") == []
    # Common manifests are allowed even if not in the finding.
    assert problems_for(fix_steps=["Pin the driver version in requirements.txt."]) == []


def test_urls_false_assurance_and_refs():
    assert any("URL" in p for p in problems_for(fix_steps=["Read https://owasp.org first."]))
    assert any("secure" in p for p in problems_for(caveats=["After this change the code is secure."]))
    assert any("has been fixed" in p or "secure or fixed" in p for p in problems_for(summary="This has been fixed."))
    assert any("references_used" in p for p in problems_for(references_used=["F9"]))


def test_length_limits_are_enforced_locally():
    assert any("summary" in p for p in problems_for(summary="x" * 500))
    assert any("fix_steps" in p for p in problems_for(fix_steps=[]))
    assert any("fix_steps" in p for p in problems_for(fix_steps=["step"] * 6))


def test_dependency_answer_with_fixed_version():
    text = json.dumps({
        "summary": "django 3.2.0 is affected by CVE-2022-34265.",
        "why_it_matters": "Crafted input to Trunc() can inject SQL.",
        "fix_steps": ["Upgrade django to 3.2.14 or later in requirements.txt.", "Re-run the scan."],
        "suggested_code": "", "references_used": ["F2"],
        "caveats": ["ARVE did not check whether the application calls the vulnerable code."],
    })
    parsed, problems = validate_finding_explanation(text, dep_ctx())
    assert problems == []


def summary(**overrides):
    base = {
        "overview": "The main risks are SQL injection in request handlers and an outdated Django release.",
        "top_risks": ["[F2] Django has a known SQL injection advisory.", "[F1] get() builds SQL from input."],
        "first_actions": ["Upgrade django to 3.2.14.", "Parameterize the query in app/db.py."],
    }
    base.update(overrides)
    return json.dumps(base)


def test_summary_validation():
    contexts = [sast_ctx("F1"), dep_ctx("F2")]
    assert validate_scan_summary(summary(), contexts)[1] == []
    assert any("unknown refs" in p for p in validate_scan_summary(summary(top_risks=["[F7] Bad."]), contexts)[1])
    assert any("must start" in p for p in validate_scan_summary(summary(top_risks=["No ref here."]), contexts)[1])
    assert any("count" in p for p in validate_scan_summary(summary(overview="There are 12 vulnerabilities."), contexts)[1])
    assert any("items" in p for p in validate_scan_summary(summary(first_actions=["a"] * 6), contexts)[1])
