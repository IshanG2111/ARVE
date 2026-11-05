
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


def extract_javascript(tree, source_code, file_path):
    """
    Extract functions, classes, parameters, variables, calls,
    imports, and source locations from JavaScript code.
    """
    result = make_file_result(file_path, "javascript")
    source_bytes = source_code.encode("utf-8")

    function_node_types = {
        "function_declaration",
        "generator_function_declaration",
        "function_expression",
        "arrow_function",
        "method_definition",
    }

    class_node_types = {
        "class_declaration",
        "class",
    }

    def text(node):
        return get_node_text(node, source_bytes)

    def get_parameters(parameters_node):
        parameters = []

        if parameters_node is None:
            return parameters

        def visit_parameter(node):
            if node.type == "identifier":
                parameters.append(text(node))
                return

            if node.type in {
                "shorthand_property_identifier_pattern",
            }:
                parameters.append(text(node))
                return

            # For default parameters, rest parameters, and
            # destructuring, preserve the pattern's source text.
            if node.type in {
                "assignment_pattern",
                "object_pattern",
                "array_pattern",
                "rest_pattern",
            }:
                parameters.append(text(node))
                return

            for child in node.named_children:
                visit_parameter(child)

        for child in parameters_node.named_children:
            visit_parameter(child)

        return parameters

    def get_function_name(node, parent=None):
        name_node = node.child_by_field_name("name")
        if name_node is not None:
            return text(name_node)
        if parent is not None and parent.type == "variable_declarator":
            variable_name = parent.child_by_field_name("name")
            if variable_name is not None:
                return text(variable_name)
        if node.type == "method_definition":
            property_node = node.child_by_field_name("name")
            if property_node is not None:
                return text(property_node)
        prefix = source_bytes[:node.start_byte].decode("utf-8", errors="replace")
        import re
        matches = list(re.finditer(
            r"""(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]""",
            prefix, re.IGNORECASE
        ))
        if matches:
            route = matches[-1]
            between = prefix[route.end():]
            if between.count(")") <= between.count("(") + 2:
                return f"{route.group(1).upper()} {route.group(2)} handler"
        loc = get_location(node)
        return f"<anonymous>@{loc['start_line']}:{loc['start_column']}"

    def call_details(function_node):
        expression = text(function_node) if function_node is not None else "<unknown>"
        receiver = member = None
        if function_node is not None and function_node.type in {"member_expression", "optional_member_expression"}:
            object_node = function_node.child_by_field_name("object")
            property_node = function_node.child_by_field_name("property")
            receiver = text(object_node) if object_node is not None else None
            member = text(property_node) if property_node is not None else None
        return expression, receiver, member

    def walk(node, parent=None):
        # Extract imports.
        if node.type == "import_statement":
            result["imports"].append({
                "name": text(node),
                "location": get_location(node),
            })

        # Extract classes.
        if node.type in class_node_types:
            name_node = node.child_by_field_name("name")

            class_name = (
                text(name_node)
                if name_node is not None
                else "<anonymous>"
            )

            result["classes"].append({
                "name": class_name,
                "location": get_location(node),
            })

            for child in node.named_children:
                walk(child, node)

            return

        # Extract functions, arrow functions, and methods.
        if node.type in function_node_types:
            function_name = get_function_name(node, parent)

            parameters_node = node.child_by_field_name("parameters")
            parameters = get_parameters(parameters_node)

            # Some arrow functions use a single identifier
            # instead of a parenthesized parameter list.
            if (
                parameters_node is None
                and node.type == "arrow_function"
            ):
                for child in node.named_children:
                    if child.type == "identifier":
                        parameters.append(text(child))
                        break

            function_location = get_location(node)

            function_record = {
                "id": make_function_id(
                    file_path,
                    function_name,
                    function_location["start_line"],
                ),
                "name": function_name,
                "parameters": parameters,
                "location": function_location,
                "calls": [],
                "variables": [],
            }

            result["functions"].append(function_record)

            body = node.child_by_field_name("body")

            if body is not None:
                walk_function_body(body, function_record)

            return

        # Continue searching through the syntax tree.
        for child in node.named_children:
            walk(child, node)

    def walk_function_body(node, function_record):
        # Extract function calls.
        if node.type == "call_expression":
            function_node = node.child_by_field_name("function")
            arguments_node = node.child_by_field_name("arguments")

            callee_expression, receiver, member = call_details(function_node)
            call_name = member or callee_expression

            arguments = []

            if arguments_node is not None:
                arguments = [
                    text(argument)
                    for argument in arguments_node.named_children
                ]

            call_location = get_location(node)

            function_record["calls"].append({
                "id": make_call_id(
                    file_path,
                    function_record["name"],
                    call_name,
                    call_location["start_line"],
                ),
                "name": call_name,
                "callee_expression": callee_expression,
                "receiver": receiver,
                "member": member,
                "arguments": arguments,
                "location": call_location,
            })

        # Extract variable declarations such as:
        # const user = getUser();
        # let result = null;
        if node.type == "variable_declarator":
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

        # Avoid assigning a nested function's body to its parent.
        if node.type in function_node_types:
            return

        for child in node.named_children:
            walk_function_body(child, function_record)

    walk(tree.root_node)

    return result
