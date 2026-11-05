from app.ast.engine import normalize_and_link, validate_output, SCHEMA_VERSION
from app.ast.engine.extractors.javascript import extract_javascript
from app.ast.engine.parser import parse_source


def test_javascript_extraction_and_contract_are_deterministic():
    source = "function loadUser(id) { return db.query(id); }"
    tree = parse_source(source, "javascript")
    file_data = extract_javascript(tree, source, "src/users.js")
    files, relationships = normalize_and_link([file_data])
    output = {"schema_version": SCHEMA_VERSION, "files": files, "relationships": relationships}
    assert files[0]["functions"][0]["name"] == "loadUser"
    assert files[0]["functions"][0]["calls"]
    assert not validate_output(output)
    first_ids = [item["id"] for item in files[0]["functions"]]
    again, _ = normalize_and_link([extract_javascript(parse_source(source, "javascript"), source, "src/users.js")])
    assert first_ids == [item["id"] for item in again[0]["functions"]]
