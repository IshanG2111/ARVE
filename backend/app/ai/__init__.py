"""AI assistance for ARVE findings.

The LLM only ever sees a redacted ``FindingContext`` built from persisted
engine findings and the code around them. It never analyses whole repositories.
"""
