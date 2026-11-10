from .common import (
    get_location,
    get_node_text,
    make_file_result,
)


def make_function_id(file_path, function_name):
    return f"{file_path}::{function_name}"


def make_variable_id(file_path, function_name, variable_name):
    return (
        f"{file_path}::{function_name}"
        f"::variable::{variable_name}"
    )


def make_call_id(file_path, function_name, call_name, line):
    return (
        f"{file_path}::{function_name}"
        f"::call::{call_name}::{line}"
    )


def extract_python(tree, source_code, file_path):
    """
    Extract code entities from a Python Tree-sitter syntax tree.

    Returns a common ARVE file representation containing
    functions, parameters, variables, calls, imports, and locations.
    """
    result = make_file_result(file_path, "python")
    if tree is None or tree.root_node is None:
        return result

    source_bytes = source_code.encode("utf-8") if isinstance(source_code, str) else source_code

    def walk(node):
        if node is None or node.type == "ERROR":
            return

        try:
            # Extract imports.
            if node.type in (
                "import_statement",
                "import_from_statement",
            ):
                result["imports"].append({
                    "name": get_node_text(node, source_bytes),
                    "location": get_location(node),
                })

            # Extract classes.
            if node.type == "class_definition":
                name_node = node.child_by_field_name("name")

                class_name = (
                    get_node_text(name_node, source_bytes)
                    if name_node
                    else "<anonymous>"
                )

                result["classes"].append({
                    "name": class_name,
                    "location": get_location(node),
                })

                for child in node.named_children:
                    walk(child)

                return

            # Extract functions and methods.
            if node.type == "function_definition":
                name_node = node.child_by_field_name("name")
                parameters_node = node.child_by_field_name("parameters")

                function_name = (
                    get_node_text(name_node, source_bytes)
                    if name_node
                    else "<anonymous>"
                )

                parameters = []

                if parameters_node:
                    for child in parameters_node.named_children:
                        if child.type == "identifier":
                            parameters.append(
                                get_node_text(child, source_bytes)
                            )

                        elif child.type in (
                            "typed_parameter",
                            "typed_default_parameter",
                            "default_parameter",
                            "list_splat",
                            "dictionary_splat",
                        ):
                            parameter_name = (
                                child.child_by_field_name("name")
                            )

                            if parameter_name:
                                parameters.append(
                                    get_node_text(
                                        parameter_name,
                                        source_bytes,
                                    )
                                )
                            elif child.named_children:
                                parameters.append(
                                    get_node_text(
                                        child.named_children[0],
                                        source_bytes,
                                    )
                                )

                function_record = {
                    "id": make_function_id(
                        file_path,
                        function_name,
                    ),
                    "name": function_name,
                    "parameters": parameters,
                    "location": get_location(node),
                    "calls": [],
                    "variables": [],
                }

                result["functions"].append(function_record)

                body = node.child_by_field_name("body")

                if body:
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
            # Extract calls.
            if node.type == "call":
                function_node = node.child_by_field_name("function")
                arguments_node = node.child_by_field_name("arguments")

                call_name = (
                    get_node_text(function_node, source_bytes)
                    if function_node
                    else "<unknown>"
                )

                arguments = []

                if arguments_node:
                    arguments = [
                        get_node_text(argument, source_bytes)
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
                    "arguments": arguments,
                    "location": call_location,
                })

            # Extract simple assignment targets.
            if node.type == "assignment":
                left_node = node.child_by_field_name("left")

                if left_node:
                    variable_name = get_node_text(
                        left_node,
                        source_bytes,
                    )

                    function_record["variables"].append({
                        "id": make_variable_id(
                            file_path,
                            function_record["name"],
                            variable_name,
                        ),
                        "name": variable_name,
                        "location": get_location(left_node),
                    })

            if node.type == "function_definition":
                return

            for child in node.named_children:
                walk_function_body(child, function_record)
        except Exception:
            pass

    walk(tree.root_node)

    return result