#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="/code"
OUTPUT="/output/codeql.sarif"
PROFILE="security-extended"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace) WORKSPACE="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: run-codeql.sh [--workspace PATH] [--output PATH] [--profile NAME]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

CODEQL="${CODEQL_HOME:-/opt/codeql}/codeql/codeql"
DB_ROOT="/tmp/codeql-db"
RESULT_ROOT="/tmp/codeql-results"
mkdir -p "$DB_ROOT" "$RESULT_ROOT" "$(dirname "$OUTPUT")"

case "$PROFILE" in
  default|security-extended) ;;
  *)
    echo "Unsupported CodeQL query suite: $PROFILE" >&2
    exit 2
    ;;
esac

mapfile -t JS_TS_FILES < <(find "$WORKSPACE" -type f ! -path "*/.git/*" \( -iname "*.js" -o -iname "*.jsx" -o -iname "*.mjs" -o -iname "*.cjs" -o -iname "*.ts" -o -iname "*.tsx" \) -print)
mapfile -t JAVA_FILES < <(find "$WORKSPACE" -type f ! -path "*/.git/*" -iname "*.java" -print)
mapfile -t PYTHON_FILES < <(find "$WORKSPACE" -type f ! -path "*/.git/*" -iname "*.py" -print)
mapfile -t GO_FILES < <(find "$WORKSPACE" -type f ! -path "*/.git/*" -iname "*.go" -print)

LANGUAGES=()
if (( ${#JS_TS_FILES[@]} > 0 )); then LANGUAGES+=("javascript-typescript"); fi
if (( ${#JAVA_FILES[@]} > 0 )); then LANGUAGES+=("java"); fi
if (( ${#PYTHON_FILES[@]} > 0 )); then LANGUAGES+=("python"); fi
if (( ${#GO_FILES[@]} > 0 )); then LANGUAGES+=("go"); fi

if (( ${#LANGUAGES[@]} == 0 )); then
  printf "%s\n" '{"version":"2.1.0","$schema":"https://json.schemastore.org/sarif-2.1.0.json","runs":[]}' > "$OUTPUT"
  echo "CodeQL: no supported source languages detected; emitted clean SARIF."
  exit 0
fi

query_suite_for_language() {
  case "$PROFILE:$1" in
    default:javascript-typescript)
      echo "codeql/javascript-queries:codeql-suites/javascript-code-scanning.qls"
      ;;
    security-extended:javascript-typescript)
      echo "codeql/javascript-queries:codeql-suites/javascript-security-extended.qls"
      ;;
    default:java)
      echo "codeql/java-queries:codeql-suites/java-code-scanning.qls"
      ;;
    security-extended:java)
      echo "codeql/java-queries:codeql-suites/java-security-extended.qls"
      ;;
    default:python)
      echo "codeql/python-queries:codeql-suites/python-code-scanning.qls"
      ;;
    security-extended:python)
      echo "codeql/python-queries:codeql-suites/python-security-extended.qls"
      ;;
    default:go)
      echo "codeql/go-queries:codeql-suites/go-code-scanning.qls"
      ;;
    security-extended:go)
      echo "codeql/go-queries:codeql-suites/go-security-extended.qls"
      ;;
    *)
      return 1
      ;;
  esac
}

build_mode_for_language() {
  case "$1" in
    java|javascript-typescript|python)
      echo "none"
      ;;
    go)
      echo "autobuild"
      ;;
    *)
      return 1
      ;;
  esac
}

SARIFS=()
FAILED_LANGUAGES=()

cleanup() {
  rm -rf "$DB_ROOT" "$RESULT_ROOT"
}
trap cleanup EXIT

for language in "${LANGUAGES[@]}"; do
  safe_language="${language//[^a-zA-Z0-9_-]/_}"
  db="$DB_ROOT/$safe_language"
  sarif="$RESULT_ROOT/$safe_language.sarif"
  suite="$(query_suite_for_language "$language")"
  build_mode="$(build_mode_for_language "$language")"

  echo "CodeQL: creating database for $language (build-mode=$build_mode)"
  if ! "$CODEQL" database create "$db"       --language="$language"       --build-mode="$build_mode"       --source-root="$WORKSPACE"; then
    echo "CodeQL: database creation failed for $language; continuing with other detected languages." >&2
    FAILED_LANGUAGES+=("$language:create")
    rm -rf "$db"
    continue
  fi

  echo "CodeQL: analyzing $language with $PROFILE"
  if ! "$CODEQL" database analyze "$db" "$suite"       --format=sarifv2.1.0       --sarif-category="arve-$language"       --output="$sarif"; then
    echo "CodeQL: analysis failed for $language; continuing with other detected languages." >&2
    FAILED_LANGUAGES+=("$language:analyze")
    rm -f "$sarif"
    continue
  fi

  SARIFS+=("$sarif")
done

export OUTPUT
python3 - "${SARIFS[@]}" <<'PY'
import json
import os
import sys

merged = {
    "version": "2.1.0",
    "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
    "runs": [],
}

for path in sys.argv[1:]:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    if data.get("version") not in (None, "2.1.0"):
        raise SystemExit(f"Unsupported SARIF version in {path}: {data.get('version')}")

    runs = data.get("runs")
    if not isinstance(runs, list):
        raise SystemExit(f"Malformed SARIF runs array in {path}")

    merged["runs"].extend(runs)

with open(os.environ["OUTPUT"], "w", encoding="utf-8") as handle:
    json.dump(merged, handle, ensure_ascii=False)
PY

if (( ${#SARIFS[@]} == 0 )); then
  echo "CodeQL: all detected languages failed; no usable SARIF result was produced." >&2
  exit 2
fi

echo "CodeQL: merged ${#SARIFS[@]} language SARIF result(s) into $OUTPUT"

if (( ${#FAILED_LANGUAGES[@]} > 0 )); then
  echo "CodeQL: partial language failures: ${FAILED_LANGUAGES[*]}" >&2
  exit 1
fi
