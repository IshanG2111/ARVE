def get_location(node):
    """Return the source location of a Tree-sitter node."""
    if node is None:
        return {"start_line": 0, "start_column": 0, "end_line": 0, "end_column": 0}
    try:
        return {
            "start_line": node.start_point.row + 1,
            "start_column": node.start_point.column + 1,
            "end_line": node.end_point.row + 1,
            "end_column": node.end_point.column + 1,
        }
    except Exception:
        return {"start_line": 0, "start_column": 0, "end_line": 0, "end_column": 0}


def get_node_text(node, source_code):
    """Return the source text represented by a node."""
    if node is None:
        return ""
    try:
        if isinstance(source_code, bytes):
            return source_code[node.start_byte:node.end_byte].decode("utf-8", errors="replace")
        return source_code.encode("utf-8")[node.start_byte:node.end_byte].decode("utf-8", errors="replace")
    except Exception:
        return ""


def make_file_result(file_path, language):
    """Create the common ARVE representation of a source file."""
    return {
        "path": file_path,
        "language": language,
        "functions": [],
        "classes": [],
        "imports": [],
        "global_variables": [],
    }