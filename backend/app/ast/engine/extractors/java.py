from .common import (
    get_location,
    get_node_text,
    make_file_result,
)


def make_function_id(file_path, function_name, line):
    return f"{file_path}::{function_name}::{line}"


def make_variable_id(file_path, function_name, variable_name, line):
    return (
        f"{file_path}::{function_name}"
        f"::variable::{variable_name}::{line}"
    )


def make_call_id(file_path, function_name, call_name, line):
    return (
        f"{file_path}::{function_name}"
        f"::call::{call_name}::{line}"
    )


def extract_java(tree, source_code, file_path):
    """Extract basic entities from a Java Tree-sitter syntax tree."""
    result = make_file_result(file_path, "java")
    if tree is None or tree.root_node is None:
        return result

    source_bytes = source_code.encode("utf-8") if isinstance(source_code, str) else source_code

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

        try:
            return [
                text(child)
                for child in parameters_node.named_children
                if child.type in {"formal_parameter", "spread_parameter", "receiver_parameter"}
            ]
        except Exception:
            return []

    def walk(node, current_class=None):
        if node is None or node.type == "ERROR":
            return

        try:
            if node.type == "import_declaration":
                result["imports"].append({
                    "name": text(node),
                    "location": get_location(node),
                })

            if node.type in {
                "class_declaration",
                "interface_declaration",
                "enum_declaration",
                "record_declaration",
            }:
                name_node = node.child_by_field_name("name")
                class_name = (
                    text(name_node)
                    if name_node is not None
                    else "<anonymous>"
                )

                result["classes"].append({
                    "name": class_name,
                    "kind": node.type,
                    "location": get_location(node),
                })

                for child in node.named_children:
                    walk(child, class_name)

                return

            if node.type in {
                "method_declaration",
                "constructor_declaration",
            }:
                name_node = node.child_by_field_name("name")
                function_name = (
                    text(name_node)
                    if name_node is not None
                    else "<anonymous>"
                )

                parameters_node = node.child_by_field_name("parameters")
                parameters = get_parameters(parameters_node)
                location = get_location(node)

                qualified_name = (
                    f"{current_class}.{function_name}"
                    if current_class
                    else function_name
                )

                function_record = {
                    "id": make_function_id(
                        file_path,
                        qualified_name,
                        location["start_line"],
                    ),
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

                return

            for child in node.named_children:
                walk(child, current_class)
        except Exception:
            pass

    def walk_function_body(node, function_record):
        if node is None or node.type == "ERROR":
            return

        try:
            if node.type == "method_invocation":
                name_node = node.child_by_field_name("name")
                object_node = node.child_by_field_name("object")
                arguments_node = node.child_by_field_name("arguments")

                method_name = (
                    text(name_node)
                    if name_node is not None
                    else "<unknown>"
                )

                call_name = (
                    f"{text(object_node)}.{method_name}"
                    if object_node is not None
                    else method_name
                )

                arguments = (
                    [
                        text(argument)
                        for argument in arguments_node.named_children
                    ]
                    if arguments_node is not None
                    else []
                )

                location = get_location(node)

                function_record["calls"].append({
                    "id": make_call_id(
                        file_path,
                        function_record["name"],
                        call_name,
                        location["start_line"],
                    ),
                    "name": call_name,
                    "arguments": arguments,
                    "location": location,
                })

            elif node.type == "object_creation_expression":
                type_node = node.child_by_field_name("type")
                arguments_node = node.child_by_field_name("arguments")

                call_name = (
                    f"new {text(type_node)}"
                    if type_node is not None
                    else "new <unknown>"
                )

                arguments = (
                    [
                        text(argument)
                        for argument in arguments_node.named_children
                    ]
                    if arguments_node is not None
                    else []
                )

                location = get_location(node)

                function_record["calls"].append({
                    "id": make_call_id(
                        file_path,
                        function_record["name"],
                        call_name,
                        location["start_line"],
                    ),
                    "name": call_name,
                    "arguments": arguments,
                    "location": location,
                })

            if node.type == "local_variable_declaration":
                for child in node.named_children:
                    if child.type != "variable_declarator":
                        continue

                    name_node = child.child_by_field_name("name")
                    if name_node is None:
                        continue

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

            if node.type in {
                "method_declaration",
                "constructor_declaration",
                "lambda_expression",
            }:
                return

            for child in node.named_children:
                walk_function_body(child, function_record)
        except Exception:
            pass

    walk(tree.root_node)

    return result