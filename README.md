Used for secret detection.

ARVE must redact secret values before storage.

Only safe evidence such as location and fingerprint/hash should be
retained.

### CodeQL Deep SAST

CodeQL provides deeper data-flow, taint tracking, source-to-sink, and
cross-function analysis. ARVE runs one CodeQL engine for detected
JavaScript/TypeScript, Java, Python, and Go source using the pinned
`arve-codeql:2.27.1` container and emits native SARIF 2.1.0.

------------------------------------------------------------------------

# 4. Canonical Findings

Scanner results are not directly treated as final ARVE findings.

They are normalized into a common structure containing: