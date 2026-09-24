# Vulnerable: Insecure TLS Verification Disabled
import requests

def call_insecure_api(endpoint: str):
    return requests.get(endpoint, verify=False)
