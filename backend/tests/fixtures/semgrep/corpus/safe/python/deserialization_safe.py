# Safe: JSON Parsing
import json

def load_payload_safe(raw_text: str):
    return json.loads(raw_text)
