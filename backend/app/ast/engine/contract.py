"""Versioned, deterministic AST output contract and graph relationship builder."""
from __future__ import annotations

import hashlib
import json
import posixpath
import re
from importlib import metadata

SCHEMA_VERSION = "1.0.0"


def stable_id(*parts: object) -> str:
    raw = json.dumps(parts, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def parser_versions() -> dict:
    packages = {
        "tree_sitter": "tree-sitter",
        "python": "tree-sitter-python",
        "javascript": "tree-sitter-javascript",
        "typescript": "tree-sitter-typescript",
        "java": "tree-sitter-java",
        "php": "tree-sitter-php",
        "go": "tree-sitter-go",
    }
    versions = {}
    for key, package in packages.items():
        try:
            versions[key] = metadata.version(package)
        except metadata.PackageNotFoundError:
            versions[key] = None
    return versions


def _location_key(entity):
    loc = entity.get("location") or {}
    return (loc.get("start_line", 0), loc.get("start_column", 0),
            loc.get("end_line", 0), loc.get("end_column", 0))


def normalize_and_link(files: list[dict]) -> tuple[list[dict], list[dict]]:
    """Assign deterministic IDs to every emitted entity and explicit edges."""
    relationships = []
    function_index = {}
    function_file_by_id = {}
    all_ids = set()

    def assign(entity, entity_type, path, parent_id=None, discriminator=None):
        loc = _location_key(entity)
        name = entity.get("name") or entity.get("statement") or entity.get("id") or entity_type
        # Call extractors may report identical/incomplete source ranges for distinct
        # call sites. A deterministic per-parent ordinal disambiguates those records
        # without introducing randomness or machine-specific data.
        id_parts = (path, entity_type, name, loc, parent_id)
        if discriminator is not None:
            id_parts += (discriminator,)
        entity_id = f"{entity_type}:{stable_id(*id_parts)}"
        entity["id"] = entity_id
        entity["entity_type"] = entity_type
        if entity_id in all_ids:
            raise ValueError(f"Duplicate entity ID generated: {entity_id}")
        all_ids.add(entity_id)
        if parent_id:
            relationships.append({
                "id": f"rel:{stable_id(parent_id, 'CONTAINS', entity_id)}",
                "type": "CONTAINS",
                "source_id": parent_id,
                "target_id": entity_id,
                "resolution_status": "resolved",
                "evidence": {"source": "tree-sitter AST", "file": path,
                             "location": entity.get("location")},
            })
        return entity_id

    for file_data in files:
        path = file_data["path"]
        file_id = f"file:{stable_id(path)}"
        file_data["id"] = file_id
        file_data["entity_type"] = "file"
        all_ids.add(file_id)

        for collection, kind in (("functions", "function"), ("classes", "class"),
                                 ("imports", "import"), ("global_variables", "variable")):
            # Include the stable extractor order as a final discriminator. Some
            # grammars emit incomplete/zero-width locations or same-named
            # declarations with identical ranges; path/name/location alone then
            # isn't enough to uniquely identify a declaration.
            for entity_index, entity in enumerate(file_data.get(collection, [])):
                assign(entity, kind, path, file_id, discriminator=entity_index)

        # Nested entities are children of their enclosing function/class.
        for collection in ("functions", "classes"):
            for parent in file_data.get(collection, []):
                parent_id = parent["id"]
                if collection == "functions":
                    for variable_index, variable in enumerate(parent.get("variables", [])):
                        assign(variable, "variable", path, parent_id, discriminator=variable_index)
                    for call_index, call in enumerate(parent.get("calls", [])):
                        assign(call, "call", path, parent_id, discriminator=call_index)
                        call["resolution_status"] = "unresolved"
                        call["candidate_ids"] = []
                        function_index.setdefault(call.get("name", ""), [])
                function_index.setdefault(parent.get("name", ""), []).append(parent)
                if collection == "functions":
                    function_file_by_id[parent["id"]] = path

        # Link flattened function records to their containing classes using source
        # ranges. The extractor emits methods as functions, so retain one canonical
        # function node and add a class-to-method containment edge.
        for function in file_data.get("functions", []):
            floc = function.get("location") or {}
            for cls in file_data.get("classes", []):
                cloc = cls.get("location") or {}
                if (cloc.get("start_line", 0) <= floc.get("start_line", 0)
                        and cloc.get("end_line", 0) >= floc.get("end_line", 0)):
                    function["enclosing_class_id"] = cls["id"]
                    relationships.append({
                        "id": f"rel:{stable_id(cls['id'], 'CONTAINS', function['id'])}",
                        "type": "CONTAINS", "source_id": cls["id"], "target_id": function["id"],
                        "resolution_status": "resolved",
                        "evidence": {"source": "source-range containment", "file": path,
                                     "location": function.get("location")},
                    })
                    break

    # Resolve only unique function-name matches; do not guess dynamic/member targets.
    for file_data in files:
        for function in file_data.get("functions", []):
            for call in function.get("calls", []):
                name = call.get("name", "")
                candidates = [candidate for candidate in function_index.get(name, [])
                              if function_file_by_id.get(candidate.get("id")) == file_data.get("path")]
                # Resolve same-file calls here. Cross-file calls require an import match below.
                if "." not in name and len(candidates) == 1:
                    target = candidates[0]
                    call["resolution_status"] = "resolved"
                    call["candidate_ids"] = [target["id"]]
                    relationships.append({
                        "id": f"rel:{stable_id(call['id'], 'CALLS', target['id'])}",
                        "type": "CALLS",
                        "source_id": function["id"],
                        "target_id": target["id"],
                        "call_site_id": call["id"],
                        "resolution_status": "resolved",
                        "evidence": {"source": "unique function-name match",
                                     "file": file_data["path"],
                                     "location": call.get("location")},
                    })
                elif "." not in name and len(candidates) > 1:
                    call["resolution_status"] = "ambiguous"
                    call["candidate_ids"] = sorted(c["id"] for c in candidates)

        # IMPORTS means file-to-import declaration. Module target resolution is not
        # claimed here because grammar-specific import semantics need dedicated logic.
        for imp in file_data.get("imports", []):
            relationships.append({
                "id": f"rel:{stable_id(file_data['id'], 'IMPORTS', imp['id'])}",
                "type": "IMPORTS",
                "source_id": file_data["id"],
                "target_id": imp["id"],
                "resolution_status": "resolved",
                "evidence": {"source": "tree-sitter AST", "file": file_data["path"],
                             "location": imp.get("location")},
            })

    # Resolve Python module imports conservatively across the analyzed file set.
    # Unsupported or external modules remain unresolved rather than guessed.
    file_by_module = {}
    for file_data in files:
        path = posixpath.normpath(str(file_data.get("path", "")).replace("\\", "/")).lstrip("./")
        stem = path.rsplit(".", 1)[0] if "." in path.rsplit("/", 1)[-1] else path
        if stem.endswith("/__init__"):
            stem = stem[:-len("/__init__")]
        module = stem.replace("/", ".")
        file_by_module[module] = file_data
        file_by_module.setdefault(module.rsplit(".", 1)[-1], file_data)

    for file_data in files:
        if file_data.get("language") != "python":
            continue
        source_path = posixpath.normpath(str(file_data.get("path", "")).replace("\\", "/")).lstrip("./")
        source_stem = source_path.rsplit(".", 1)[0] if "." in source_path.rsplit("/", 1)[-1] else source_path
        package_parts = source_stem.split("/")[:-1]
        for imp in file_data.get("imports", []):
            raw = str(imp.get("name", "")).strip()
            module_names = []
            imported_symbols = []
            if raw.startswith("from "):
                match = re.match(r"from\s+([.\w]+)\s+import\s+(.+)$", raw)
                if match:
                    module_token, symbol_token = match.groups()
                    dots = len(module_token) - len(module_token.lstrip("."))
                    module_base = module_token[dots:]
                    base_parts = package_parts[:max(0, len(package_parts) - max(0, dots - 1))]
                    base_parts += module_base.split(".") if module_base else []
                    module_names.append(".".join(part for part in base_parts if part))
                    for item in symbol_token.split(","):
                        symbol_match = re.match(r"\s*([A-Za-z_]\w*)", item)
                        if symbol_match:
                            imported_symbols.append(symbol_match.group(1))
            elif raw.startswith("import "):
                for item in raw[len("import "):].split(","):
                    token = item.strip().split(" as ", 1)[0].strip()
                    if token:
                        module_names.append(token)

            resolved_modules = []
            for module_name in module_names:
                target = file_by_module.get(module_name)
                if target is None and module_name:
                    target = file_by_module.get(module_name.rsplit(".", 1)[-1])
                if target and target["id"] != file_data["id"] and target not in resolved_modules:
                    resolved_modules.append(target)
                    imp["resolution_status"] = "resolved"
                    imp["target_file_id"] = target["id"]
                    relationships.append({
                        "id": f"rel:{stable_id(file_data['id'], 'IMPORTS_MODULE', target['id'], imp['id'])}",
                        "type": "IMPORTS_MODULE", "source_id": file_data["id"], "target_id": target["id"],
                        "import_id": imp["id"], "resolution_status": "resolved",
                        "evidence": {"source": "Python import text matched analyzed module path",
                                     "file": file_data["path"], "import": raw,
                                     "location": imp.get("location")},
                    })
            if not resolved_modules:
                imp.setdefault("resolution_status", "unresolved")

            # Resolve a call only when an imported symbol maps to exactly one
            # function in the matched module. Do not infer receiver/dynamic calls.
            if imported_symbols and len(resolved_modules) == 1:
                target_file = resolved_modules[0]
                for symbol in imported_symbols:
                    candidates = [fn for fn in target_file.get("functions", []) if fn.get("name") == symbol]
                    if len(candidates) != 1:
                        continue
                    target_fn = candidates[0]
                    for caller in file_data.get("functions", []):
                        for call in caller.get("calls", []):
                            if call.get("name") != symbol:
                                continue
                            existing = any(edge.get("type") == "CALLS" and edge.get("call_site_id") == call.get("id")
                                           for edge in relationships)
                            if existing:
                                continue
                            call["resolution_status"] = "resolved_cross_file"
                            call["candidate_ids"] = [target_fn["id"]]
                            relationships.append({
                                "id": f"rel:{stable_id(call['id'], 'CALLS', target_fn['id'])}",
                                "type": "CALLS", "source_id": caller["id"], "target_id": target_fn["id"],
                                "call_site_id": call["id"], "resolution_status": "resolved_cross_file",
                                "evidence": {"source": "unique imported Python symbol", "file": file_data["path"],
                                             "target_file": target_file["path"], "import": raw,
                                             "location": call.get("location")},
                            })

    # Resolve statically declared relative JavaScript/TypeScript imports.
    # Only unique named-import targets are linked; ambiguous imports are not guessed.
    supported_extensions = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
    files_by_path = {
        posixpath.normpath(str(item.get("path", "")).replace("\\", "/")): item
        for item in files
    }
    for file_data in files:
        if file_data.get("language") not in {"javascript", "typescript"}:
            continue
        source_path = posixpath.normpath(str(file_data.get("path", "")).replace("\\", "/"))
        source_dir = posixpath.dirname(source_path)
        aliases = {}
        for imp in file_data.get("imports", []):
            raw = str(imp.get("name", ""))
            from_match = re.search(r"""from\s*['"]([^'"]+)['"]""", raw)
            if not from_match:
                continue
            module_token = from_match.group(1)
            if not module_token.startswith("."):
                continue
            base = posixpath.normpath(posixpath.join(source_dir, module_token))
            candidates = [base] + [base + ext for ext in supported_extensions]
            candidates += [posixpath.join(base, "index" + ext) for ext in supported_extensions]
            target_file = next((files_by_path[candidate] for candidate in candidates if candidate in files_by_path), None)
            if target_file is None:
                imp.setdefault("resolution_status", "unresolved")
                continue
            imp["resolution_status"] = "resolved"
            imp["target_file_id"] = target_file["id"]
            relationships.append({
                "id": f"rel:{stable_id(file_data['id'], 'IMPORTS_MODULE', target_file['id'], imp['id'])}",
                "type": "IMPORTS_MODULE", "source_id": file_data["id"],
                "target_id": target_file["id"], "import_id": imp["id"],
                "resolution_status": "resolved",
                "evidence": {"source": "relative JS/TS module path", "file": source_path,
                             "target_file": target_file["path"], "import": raw,
                             "location": imp.get("location")},
            })
            clause_match = re.search(r"""^\s*import\s+(.+?)\s+from\s*['"]""", raw, re.S)
            if not clause_match:
                continue
            clause = clause_match.group(1).strip()
            named_block = re.search(r"\{([^}]+)\}", clause)
            if named_block:
                for item in named_block.group(1).split(","):
                    parts = re.split(r"\s+as\s+", item.strip())
                    imported_name = parts[0].strip()
                    local_name = (parts[-1] if len(parts) > 1 else parts[0]).strip()
                    if re.fullmatch(r"[A-Za-z_$][\w$]*", imported_name):
                        aliases[local_name] = (imported_name, target_file)
        for caller in file_data.get("functions", []):
            for call in caller.get("calls", []):
                match = aliases.get(call.get("name", "")) or aliases.get(call.get("receiver"))
                if not match:
                    continue
                imported_name, target_file = match
                candidates = [fn for fn in target_file.get("functions", [])
                              if fn.get("name") == imported_name]
                if len(candidates) == 1:
                    target_fn = candidates[0]
                    call["resolution_status"] = "resolved_cross_file"
                    call["candidate_ids"] = [target_fn["id"]]
                    relationships.append({
                        "id": f"rel:{stable_id(call['id'], 'CALLS', target_fn['id'])}",
                        "type": "CALLS", "source_id": caller["id"],
                        "target_id": target_fn["id"], "call_site_id": call["id"],
                        "resolution_status": "resolved_cross_file",
                        "evidence": {"source": "unique static JS/TS named import",
                                     "file": source_path, "target_file": target_file["path"],
                                     "imported_symbol": imported_name,
                                     "location": call.get("location")},
                    })
                elif len(candidates) > 1:
                    call["resolution_status"] = "ambiguous"
                    call["candidate_ids"] = sorted(fn["id"] for fn in candidates)

    external_globals = {
        "fetch", "setTimeout", "setInterval", "clearTimeout", "clearInterval",
        "JSON.parse", "JSON.stringify", "Math.max", "Math.min",
        "Promise.resolve", "Promise.all", "console.log", "console.error",
    }
    for file_data in files:
        for function in file_data.get("functions", []):
            for call in function.get("calls", []):
                if call.get("resolution_status") == "unresolved":
                    expression = call.get("callee_expression") or call.get("name", "")
                    if expression in external_globals:
                        call["resolution_status"] = "external"
                        call["candidate_ids"] = []

    return files, relationships


def validate_output(output: dict) -> list[str]:
    errors = []
    if output.get("schema_version") != SCHEMA_VERSION:
        errors.append("schema_version missing or unsupported")
    if not isinstance(output.get("files"), list):
        errors.append("files must be a list")
        return errors

    ids = set()
    for file_data in output["files"]:
        for entity in _walk_entities(file_data):
            entity_id = entity.get("id")
            if not entity_id:
                errors.append(f"entity missing id in {file_data.get('path')}")
            elif entity_id in ids:
                errors.append(f"duplicate entity id: {entity_id}")
            else:
                ids.add(entity_id)
            if entity.get("entity_type") != "file" and not isinstance(entity.get("location"), dict):
                errors.append(f"entity missing location: {entity_id}")

    relationship_ids = set()
    for relationship in output.get("relationships", []):
        rid = relationship.get("id")
        if not rid or rid in relationship_ids:
            errors.append(f"missing or duplicate relationship id: {rid}")
        relationship_ids.add(rid)
        for endpoint in ("source_id", "target_id"):
            if relationship.get(endpoint) not in ids:
                errors.append(f"relationship {rid} has invalid {endpoint}: {relationship.get(endpoint)}")
        if not relationship.get("type"):
            errors.append(f"relationship {rid} missing type")
        if not relationship.get("evidence"):
            errors.append(f"relationship {rid} missing evidence")
    return errors


def _walk_entities(file_data):
    yield file_data
    for key in ("functions", "classes", "imports", "global_variables"):
        for entity in file_data.get(key, []):
            yield entity
            for nested_key in ("calls", "variables", "methods"):
                for nested in entity.get(nested_key, []):
                    yield nested
