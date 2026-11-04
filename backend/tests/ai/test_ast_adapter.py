"""AST adapter against the teammate's JSON format ("ARVE Tree-sitter AST", schema 1.0.0)."""
import json

import pytest

from app.ai import ast_adapter
from app.ai.ast_adapter import get_enclosing_symbol, parse_ast_document
from app.core.config import settings


def loc(start, end):
    return {"start_line": start, "start_column": 1, "end_line": end, "end_column": 2}


def ast_document(schema_version="1.0.0"):
    return {
        "schema_version": schema_version,
        "analysis": {"status": "partial_success", "run_id": "ast_test"},
        "files": [
            {
                "path": "backend/main.py",
                "language": "python",
                "status": "success",
                "id": "file:1",
                "imports": [
                    {"id": "import:1", "name": "import requests", "location": loc(1, 1)},
                    {"id": "import:2", "name": "from bs4 import BeautifulSoup", "location": loc(2, 2)},
                ],
                "classes": [
                    {"id": "class:1", "name": "Ingestor", "kind": "class", "location": loc(10, 60)},
                ],
                "functions": [
                    {
                        "id": "function:run", "name": "run", "parameters": ["payload"],
                        "enclosing_class_id": "class:1", "location": loc(20, 40),
                        "calls": [
                            {"id": "call:1", "name": "requests.get", "arguments": ["payload.url", "headers={'X-Key': 'abc'}"], "location": loc(25, 25)},
                            {"id": "call:2", "name": "requests.get", "arguments": [], "location": loc(30, 30)},
                        ],
                        "variables": [],
                    },
                    {
                        "id": "function:helper", "name": "helper", "parameters": [],
                        "location": loc(70, 80), "calls": [], "variables": [],
                    },
                    {
                        "id": "function:anon", "name": "<anonymous>", "parameters": [],
                        "location": loc(90, 95), "calls": [], "variables": [],
                    },
                ],
            },
            {
                "path": "src/broken.ts",
                "language": "typescript",
                "status": "syntax_error",
                "id": "file:2",
                "imports": [], "classes": [],
                "functions": [{"id": "function:x", "name": "x", "location": loc(1, 50), "calls": []}],
            },
        ],
        "relationships": [
            {"id": "rel:1", "type": "CALLS", "source_id": "function:helper", "target_id": "function:run", "resolution_status": "resolved"},
            {"id": "rel:2", "type": "CALLS", "source_id": "function:anon", "target_id": "function:run", "resolution_status": "resolved"},
            {"id": "rel:3", "type": "CALLS", "source_id": "function:x", "target_id": "function:helper", "resolution_status": "ambiguous"},
            {"id": "rel:4", "type": "CONTAINS", "source_id": "file:1", "target_id": "function:run", "resolution_status": "resolved"},
        ],
        "errors": [{"path": "src/slow.tsx", "status": "failed", "error": "Parsing timed out after 15s"}],
    }


def test_parse_builds_methods_functions_and_classes():
    index = parse_ast_document(ast_document())

    assert set(index) == {"backend/main.py"}  # syntax_error and failed files are skipped
    symbols = {s.qualified_name: s for s in index["backend/main.py"]}
    run = symbols["Ingestor.run"]
    assert (run.kind, run.start_line, run.end_line) == ("method", 20, 40)
    assert run.callers == ["helper"]  # anonymous and unresolved callers dropped
    assert run.calls == ["requests.get"]  # names only, deduplicated, no arguments
    assert run.imports == ["import requests", "from bs4 import BeautifulSoup"]
    assert symbols["helper"].kind == "function"
    assert symbols["Ingestor"].kind == "class"


def test_parse_rejects_unknown_major_version():
    with pytest.raises(ValueError):
        parse_ast_document(ast_document(schema_version="2.0.0"))


@pytest.fixture
def ast_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "AST_OUTPUT_DIR", str(tmp_path))
    ast_adapter._load_index.cache_clear()
    yield tmp_path
    ast_adapter._load_index.cache_clear()


def test_lookup_by_analysis_run_id_then_commit(ast_dir):
    (ast_dir / "run-1.json").write_text(json.dumps(ast_document()), encoding="utf-8")

    method = get_enclosing_symbol("run-1", "sha", "backend/main.py", "Python", 25, 26)
    assert method.qualified_name == "Ingestor.run"
    in_class_only = get_enclosing_symbol("run-1", "sha", "backend/main.py", "Python", 45, 45)
    assert in_class_only.qualified_name == "Ingestor"

    (ast_dir / "abc123.json").write_text(json.dumps(ast_document()), encoding="utf-8")
    assert get_enclosing_symbol("run-2", "abc123", "backend/main.py", "Python", 72, 72).name == "helper"


def test_missing_unparsed_or_corrupt_output_returns_none(ast_dir):
    assert get_enclosing_symbol("no-file", None, "backend/main.py", "Python", 25, 25) is None

    (ast_dir / "run-1.json").write_text(json.dumps(ast_document()), encoding="utf-8")
    assert get_enclosing_symbol("run-1", None, "src/broken.ts", "TypeScript", 5, 5) is None
    assert get_enclosing_symbol("run-1", None, "backend/other.py", "Python", 5, 5) is None
    assert get_enclosing_symbol("run-1", None, "backend/main.py", "Python", 3, 3) is None

    (ast_dir / "bad.json").write_text("{not json", encoding="utf-8")
    assert get_enclosing_symbol("bad", None, "backend/main.py", "Python", 25, 25) is None


def test_commit_sha_must_match_scan(ast_dir):
    document = ast_document()
    document["analysis"]["commit_sha"] = "ABC123"
    (ast_dir / "abc123.json").write_text(json.dumps(document), encoding="utf-8")
    (ast_dir / "run-9.json").write_text(json.dumps(document), encoding="utf-8")

    assert get_enclosing_symbol("run-x", "abc123", "backend/main.py", "Python", 25, 25).name == "run"
    # Found by analysis_run_id, but recorded for another commit: stale, so ignored.
    assert get_enclosing_symbol("run-9", "def456", "backend/main.py", "Python", 25, 25) is None


def test_path_like_ids_are_not_used_as_file_names(ast_dir):
    (ast_dir / "run-1.json").write_text(json.dumps(ast_document()), encoding="utf-8")
    assert get_enclosing_symbol("../run-1", None, "backend/main.py", "Python", 25, 25) is None


def test_unset_directory_means_no_ast(monkeypatch):
    monkeypatch.setattr(settings, "AST_OUTPUT_DIR", None)
    assert get_enclosing_symbol("run-1", None, "backend/main.py", "Python", 25, 25) is None
