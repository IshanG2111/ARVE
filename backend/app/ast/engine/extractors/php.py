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


def extract_php(tree, source_code, file_path):
    """Extract basic entities from a PHP Tree-sitter syntax tree."""
    result = make_file_result(file_path, "php")
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

        parameters = []
        try:
            for child in parameters_node.named_children:
                if child.type in {
                    "simple_parameter",
                    "variadic_parameter",
                    "property_promotion_parameter",
                }:
                    parameters.append(text(child))
        except Exception:
            pass

        return parameters

    def walk(node, current_class=None):
        if node is None or node.type == "ERROR":
            return

        try:
            if node.type in {
                "namespace_use_declaration",
                "namespace_definition",
            }:
                result["imports"].append({
                    "name": text(node),
                    "location": get_location(node),
                })

            if node.type in {
                "class_declaration",
                "interface_declaration",
                "trait_declaration",
                "enum_declaration",
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
                "function_definition",
                "method_declaration",
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
                    "id": (
                        f"{file_path}::{qualified_name}"
                        f"::{location['start_line']}"
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
            if node.type in {
                "function_call_expression",
                "scoped_call_expression",
                "member_call_expression",
            }:
                function_node = node.child_by_field_name("function")
                arguments_node = node.child_by_field_name("arguments")
                scope_node = node.child_by_field_name("scope")
                name_node = node.child_by_field_name("name")

                if function_node is not None:
                    call_name = text(function_node)
                elif scope_node is not None and name_node is not None:
                    call_name = f"{text(scope_node)}::{text(name_node)}"
                elif name_node is not None:
                    call_name = text(name_node)
                else:
                    call_name = "<unknown>"

                arguments = []
                if arguments_node is not None:
                    arguments = [
                        text(argument)
                        for argument in arguments_node.named_children
                    ]

                location = get_location(node)

                function_record["calls"].append({
                    "id": (
                        f"{file_path}::{function_record['name']}"
                        f"::call::{call_name}::{location['start_line']}"
                    ),
                    "name": call_name,
                    "arguments": arguments,
                    "location": location,
                })

            if node.type == "assignment_expression":
                left_node = node.child_by_field_name("left")

                if left_node is not None:
                    variable_name = text(left_node)
                    location = get_location(left_node)

                    function_record["variables"].append({
                        "id": (
                            f"{file_path}::{function_record['name']}"
                            f"::variable::{variable_name}"
                            f"::{location['start_line']}"
                        ),
                        "name": variable_name,
                        "location": location,
                    })

            if node.type in {
                "function_definition",
                "method_declaration",
                "anonymous_function",
                "arrow_function",
            }:
                return

            for child in node.named_children:
                walk_function_body(child, function_record)
        except Exception:
            pass

    walk(tree.root_node)

    return result