from app.ast.schema import AST_REQUIRED_TABLES, missing_ast_tables


def test_all_ast_tables_are_required():
    assert AST_REQUIRED_TABLES == {
        "ast_analysis_runs",
        "ast_files",
        "ast_symbols",
        "ast_relationships",
        "security_contexts",
    }


def test_missing_ast_tables_are_reported_deterministically():
    assert missing_ast_tables({"users", "projects", "scans"}) == [
        "ast_analysis_runs",
        "ast_files",
        "ast_relationships",
        "ast_symbols",
        "security_contexts",
    ]


def test_complete_ast_schema_has_no_missing_tables():
    assert missing_ast_tables(AST_REQUIRED_TABLES) == []
