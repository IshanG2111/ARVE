"""Tree-sitter parser initialization and source parsing wrapper."""
import os
from tree_sitter import Language, Parser

_LANGUAGE_CACHE = {}


def get_language(grammar_name: str) -> Language:
    """Resolves a grammar string name into a tree_sitter.Language object."""
    if grammar_name in _LANGUAGE_CACHE:
        return _LANGUAGE_CACHE[grammar_name]

    # 1. Attempt loading via modern tree-sitter language packages (tree-sitter >= 0.22)
    try:
        if grammar_name == "python":
            import tree_sitter_python as tslang
            lang_obj = Language(tslang.language())
        elif grammar_name == "javascript":
            import tree_sitter_javascript as tslang
            lang_obj = Language(tslang.language())
        elif grammar_name == "typescript":
            import tree_sitter_typescript as tslang
            lang_obj = Language(tslang.language_typescript())
        elif grammar_name == "tsx":
            import tree_sitter_typescript as tslang
            lang_obj = Language(tslang.language_tsx())
        elif grammar_name == "java":
            import tree_sitter_java as tslang
            lang_obj = Language(tslang.language())
        elif grammar_name == "php":
            import tree_sitter_php as tslang
            lang_obj = Language(tslang.language_php())
        elif grammar_name == "go":
            import tree_sitter_go as tslang
            lang_obj = Language(tslang.language())
        else:
            raise ValueError(f"Unsupported grammar name: {grammar_name}")

        _LANGUAGE_CACHE[grammar_name] = lang_obj
        return lang_obj
    except (ImportError, AttributeError):
        pass

    # 2. Fallback for legacy compiled library (.so / .dll / .dylib)
    possible_lib_paths = [
        os.path.join(os.path.dirname(__file__), "build", "my-languages.so"),
        os.path.join(os.path.dirname(__file__), "my-languages.so"),
        os.path.join(os.path.dirname(__file__), "build", "languages.so"),
    ]

    for lib_path in possible_lib_paths:
        if os.path.exists(lib_path):
            lang_obj = Language(lib_path, grammar_name)
            _LANGUAGE_CACHE[grammar_name] = lang_obj
            return lang_obj

    raise RuntimeError(
        f"Unable to load tree-sitter Language object for '{grammar_name}'. "
        f"Ensure 'tree-sitter-{grammar_name}' package is installed."
    )


def parse_source(source_code, grammar):
    """Parses source code into a Tree-sitter AST using a Language object."""
    if isinstance(grammar, str):
        language_obj = get_language(grammar)
    else:
        language_obj = grammar

    # Modern tree-sitter API instantiation
    try:
        parser = Parser(language_obj)
    except TypeError:
        # Legacy tree-sitter API fallback
        parser = Parser()
        parser.set_language(language_obj)

    source_bytes = source_code.encode("utf-8") if isinstance(source_code, str) else source_code
    return parser.parse(source_bytes)