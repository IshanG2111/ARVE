import httpx
import re
from datetime import datetime
from typing import Tuple
from app.models.models import TargetWebsite

def clean_domain(raw_domain: str) -> str:
    # Remove protocol prefix if included
    domain = re.sub(r"^https?://", "", raw_domain.strip(), flags=re.IGNORECASE)
    # Remove trailing paths or slashes
    domain = domain.split("/")[0].strip()
    return domain

async def verify_domain_ownership(target: TargetWebsite) -> Tuple[bool, str, str]:
    """
    Checks http(s)://<domain>/.well-known/arve-verification.txt for target.verification_token.
    Returns (is_verified, message, checked_url).
    """
    domain = clean_domain(target.domain)
    verification_path = "/.well-known/arve-verification.txt"
    expected_token = target.verification_token.strip()

    urls_to_try = [
        f"https://{domain}{verification_path}",
        f"http://{domain}{verification_path}"
    ]

    last_error = ""
    last_url = urls_to_try[0]

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, verify=False) as client:
        for url in urls_to_try:
            last_url = url
            try:
                response = await client.get(url)
                if response.status_code == 200:
                    content = response.text.strip()
                    if expected_token in content:
                        return True, f"Successfully verified ownership via {url}", url
                    else:
                        last_error = (
                            f"HTTP 200 OK at {url}, but token did not match. "
                            f"Expected '{expected_token}', found '{content[:50]}...'"
                        )
                else:
                    last_error = f"Server returned HTTP status {response.status_code} at {url}"
            except httpx.ConnectError:
                last_error = f"Could not connect to {url} (Connection failed)"
            except httpx.TimeoutException:
                last_error = f"Request timed out while connecting to {url}"
            except Exception as e:
                last_error = f"Error fetching {url}: {str(e)}"

    return False, last_error or "Verification file not found or inaccessible.", last_url
