# Safe: TLS Verification Enabled
import requests

def call_secure_api(endpoint: str):
    return requests.get(endpoint, verify=True, timeout=10)
