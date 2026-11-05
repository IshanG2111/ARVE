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



def test_javascript_chained_calls_keep_receiver_and_member():
    source = "function render(users) { return users.map((u) => u.name).join(','); }"
    tree = parse_source(source, "javascript")
    file_data = extract_javascript(tree, source, "src/render.js")
    calls = file_data["functions"][0]["calls"]
    assert any(call["name"] == "map" and call["receiver"] == "users" for call in calls)
    assert any(call["name"] == "join" and call["callee_expression"].endswith(".join") for call in calls)


def test_javascript_relative_named_import_resolves_across_files():
    service_source = "export function loadUser(id) { return db.query(id); }"
    caller_source = (
        'import { loadUser as fetchUser } from "../services/user";\n'
        'export function route(req) { return fetchUser(req.params.id); }'
    )
    service = extract_javascript(parse_source(service_source, "javascript"),
                                 service_source, "src/services/user.js")
    caller = extract_javascript(parse_source(caller_source, "javascript"),
                                caller_source, "src/routes/user.js")
    linked, relationships = normalize_and_link([caller, service])
    caller_fn = next(fn for fn in linked[0]["functions"] if fn["name"] == "route")
    call = next(call for call in caller_fn["calls"] if call["name"] == "fetchUser")
    assert call["resolution_status"] == "resolved_cross_file"
    assert any(edge["type"] == "CALLS" and edge.get("call_site_id") == call["id"]
               for edge in relationships)
