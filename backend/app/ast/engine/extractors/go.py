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


def extract_go(tree, source_code, file_path):
    """Extract basic entities from a Go Tree-sitter syntax tree."""
    result = make_file_result(file_path, "go")
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
                if child.type in {"parameter_declaration", "variadic_parameter_declaration"}:
                    parameters.append(text(child))
        except Exception:
            pass

        return parameters

    def walk(node):
        if node is None or node.type == "ERROR":
            return

        try:
            # Package and import declarations.
            if node.type in {"package_clause", "import_declaration"}:
                result["imports"].append({
                    "name": text(node),
                    "location": get_location(node),
                })

            # Go structs and interfaces.
            if node.type in {"type_declaration", "type_spec"}:
                if node.type == "type_spec":
                    name_node = node.child_by_field_name("name")
                    type_node = node.child_by_field_name("type")

                    if type_node is not None and type_node.type in {
                        "struct_type",
                        "interface_type",
                    }:
                        result["classes"].append({
                            "name": (
                                text(name_node)
                                if name_node is not None
                                else "<anonymous>"
                            ),
                            "kind": type_node.type,
                            "location": get_location(node),
                        })

            # Functions and methods.
            if node.type in {"function_declaration", "method_declaration"}:
                name_node = node.child_by_field_name("name")
                parameters_node = node.child_by_field_name("parameters")

                function_name = (
                    text(name_node)
                    if name_node is not None
                    else "<anonymous>"
                )

                receiver_node = node.child_by_field_name("receiver")
                if receiver_node is not None:
                    receiver_text = text(receiver_node)
                    function_name = f"{receiver_text}.{function_name}"

                location = get_location(node)

                function_record = {
                    "id": make_function_id(
                        file_path,
                        function_name,
                        location["start_line"],
                    ),
                    "name": function_name,
                    "parameters": get_parameters(parameters_node),
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
                walk(child)
        except Exception:
            pass

    def walk_function_body(node, function_record):
        if node is None or node.type == "ERROR":
            return

        try:
            if node.type == "call_expression":
                function_node = node.child_by_field_name("function")
                arguments_node = node.child_by_field_name("arguments")

                call_name = (
                    text(function_node)
                    if function_node is not None
                    else "<unknown>"
                )

                arguments = (
                    [text(argument) for argument in arguments_node.named_children]
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

            if node.type == "short_var_declaration":
                left_node = node.child_by_field_name("left")

                if left_node is not None:
                    for child in left_node.named_children:
                        variable_name = text(child)
                        variable_location = get_location(child)

                        function_record["variables"].append({
                            "id": make_variable_id(
                                file_path,
                                function_record["name"],
                                variable_name,
                                variable_location["start_line"],
                            ),
                            "name": variable_name,
                            "location": variable_location,
                        })

            if node.type == "var_spec":
                name_node = node.child_by_field_name("name")

                if name_node is not None:
                    variable_name = text(name_node)
                    variable_location = get_location(name_node)

                    function_record["variables"].append({
                        "id": make_variable_id(
                            file_path,
                            function_record["name"],
                            variable_name,
                            variable_location["start_line"],
                        ),
                        "name": variable_name,
                        "location": variable_location,
                    })

            if node.type == "func_literal":
                return

            for child in node.named_children:
                walk_function_body(child, function_record)
        except Exception:
            pass

    walk(tree.root_node)
    return result