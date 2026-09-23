# Vulnerable: SSRF
import requests

def fetch_webhook(request):
    url = request.args.get("url")
    return requests.get(url).text
