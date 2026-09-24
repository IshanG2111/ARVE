# Safe: Hardcoded known endpoint
import requests

def fetch_safe():
    return requests.get("https://api.example.com/v1/health", timeout=5).json()
