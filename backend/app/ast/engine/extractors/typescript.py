"""TypeScript/TSX AST extraction using conservative Tree-sitter node access."""
from .common import get_location, get_node_text, make_file_result


def make_function_id(file_path, function_name, line):
    return f"{file_path}::{function_name}::{line}"


def make_variable_id(file_path, function_name, variable_name, line):
    return f"{file_path}::{function_name}::variable::{variable_name}::{line}"


def make_call_id(file_path, function_name, call_name, line):
    return f"{file_path}::{function_name}::call::{call_name}::{line}"


def _named_children(node):
    """Return named children via indexed access instead of the named_children iterator."""
    if node is None:
        return []
    children = []
    try:
        count = node.child_count
        for index in range(count):
            child = node.child(index)
            if child is not None and child.is_named and child.type != "ERROR":
                children.append(child)
    except Exception:
        pass
    return children


def extract_typescript(tree, source_code, file_path):
    """Extract basic code entities from a TypeScript or TSX syntax tree."""
    result = make_file_result(file_path, "typescript")
    if tree is None or tree.root_node is None:
        return result

    source_bytes = source_code.encode("utf-8") if isinstance(source_code, str) else source_code

    function_node_types = {
        "function_declaration",
        "generator_function_declaration",
        "function_expression",
        "arrow_function",
        "method_definition",
        "method_signature",
    }
    class_node_types = {
        "class_declaration",
        "class",
        "interface_declaration",
        "type_alias_declaration",
        "enum_declaration",
    }

    def text(node):
        if node is None or node.type == "ERROR":
            return ""
        try:
            return get_node_text(node, source_bytes)
        except Exception:
            return ""

    def get_parameters(parameters_node):
        if parameters_node is None or parameters_node.type == "ERROR":
            return []
        return [
            text(child)
            for child in _named_children(parameters_node)
            if child.type not in {"comment", "ERROR"}
        ]

    def get_function_name(node, parent=None):
        if node is None or node.type == "ERROR":
            return "<anonymous>"
        try:
            name_node = node.child_by_field_name("name")
            if name_node is not None and name_node.type != "ERROR":
                return text(name_node)

            if parent is not None and parent.type == "variable_declarator":
                variable_name = parent.child_by_field_name("name")
                if variable_name is not None and variable_name.type != "ERROR":
                    return text(variable_name)
        except Exception:
            pass

        return "<anonymous>"

    def walk_function_body(root, function_record):
        if root is None or root.type == "ERROR":
            return
        stack = [root]
        while stack:
            node = stack.pop()
            if node is None or node.type == "ERROR":
                continue

            if node.type in function_node_types:
                continue

            try:
                if node.type == "call_expression":
                    function_node = node.child_by_field_name("function")
                    arguments_node = node.child_by_field_name("arguments")
                    call_name = text(function_node) if function_node is not None else "<unknown>"
                    arguments = _named_children(arguments_node) if arguments_node is not None else []
                    location = get_location(node)
                    function_record["calls"].append({
                        "id": make_call_id(
                            file_path,
                            function_record["name"],
                            call_name,
                            location["start_line"],
                        ),
                        "name": call_name,
                        "arguments": [text(argument) for argument in arguments],
                        "location": location,
                    })

                if node.type == "variable_declarator":
                    name_node = node.child_by_field_name("name")
                    if name_node is not None and name_node.type != "ERROR":
                        variable_name = text(name_node)
                        location = get_location(name_node)
                        function_record["variables"].append({
                            "id": make_variable_id(
                                file_path,
                                function_record["name"],
                                variable_name,
                                location["start_line"],
                            ),
                            "name": variable_name,
                            "location": location,
                        })
            except Exception:
                pass

            children = _named_children(node)
            stack.extend(reversed(children))

    stack = [(tree.root_node, None)]
    while stack:
        node, parent = stack.pop()
        if node is None or node.type == "ERROR":
            continue

        try:
            if node.type in {"import_statement", "export_statement"}:
                result["imports"].append({
                    "name": text(node),
                    "location": get_location(node),
                })

            if node.type in class_node_types:
                name_node = node.child_by_field_name("name")
                result["classes"].append({
                    "name": text(name_node) if name_node is not None and name_node.type != "ERROR" else "<anonymous>",
                    "kind": node.type,
                    "location": get_location(node),
                })
                children = _named_children(node)
                stack.extend((child, node) for child in reversed(children))
                continue

            if node.type in function_node_types:
                function_name = get_function_name(node, parent)
                parameters_node = node.child_by_field_name("parameters")
                parameters = get_parameters(parameters_node)

                if parameters_node is None and node.type == "arrow_function":
                    for child in _named_children(node):
                        if child.type in {"identifier", "required_parameter"}:
                            parameters.append(text(child))
                            break

                location = get_location(node)
                function_record = {
                    "id": make_function_id(file_path, function_name, location["start_line"]),
                    "name": function_name,
                    "parameters": parameters,
                    "location": location,
                    "calls": [],
                    "variables": [],
                }
                result["functions"].append(function_record)

                body = node.child_by_field_name("body")
                if body is not None:
                    walk_function_body(body, function_record)
                continue
        except Exception:
            pass

        children = _named_children(node)
        stack.extend((child, node) for child in reversed(children))

    return result