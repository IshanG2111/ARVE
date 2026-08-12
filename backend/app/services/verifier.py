import ipaddress
import re
import socket
from typing import Tuple
from urllib.parse import urlsplit

import httpx

from app.models.models import TargetWebsite


_DOMAIN_RE = re.compile(r"^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")


def clean_domain(raw_domain: str) -> str:
    """Normalize a target URL into a hostname[:port] value."""
    raw = (raw_domain or "").strip()
    if not raw:
        raise ValueError("Domain cannot be empty")

    candidate = raw if "://" in raw else f"https://{raw}"
    parsed = urlsplit(candidate)

    if parsed.scheme.lower() not in {"http", "https"}:
        raise ValueError("Only HTTP and HTTPS targets are supported")
    if parsed.username or parsed.password:
        raise ValueError("Credentials are not allowed in target URLs")
    if not parsed.hostname:
        raise ValueError("Invalid target domain")
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise ValueError("Target must contain only a domain or host and optional port")

    host = parsed.hostname.rstrip(".").lower()
    if not _DOMAIN_RE.match(host) and not _is_ip_literal(host):
        raise ValueError("Invalid target domain")

    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Invalid target port") from exc

    if port is not None and not (1 <= port <= 65535):
        raise ValueError("Invalid target port")

    return f"{host}:{port}" if port is not None else host


def _is_ip_literal(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def _is_public_ip(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


def _validate_public_destination(host: str) -> None:
    """Reject localhost/private/link-local destinations to reduce SSRF risk."""
    if host.lower() in {"localhost", "localhost.localdomain"}:
        raise ValueError("Private/internal verification targets are not allowed")

    try:
        direct_ip = ipaddress.ip_address(host)
        if not _is_public_ip(str(direct_ip)):
            raise ValueError("Private/internal verification targets are not allowed")
        return
    except ValueError as exc:
        # A ValueError here may mean the host was not an IP literal. Continue
        # with DNS validation for normal hostnames.
        if str(exc) == "Private/internal verification targets are not allowed":
            raise

    try:
        addresses = {
            result[4][0]
            for result in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        }
    except socket.gaierror as exc:
        raise ValueError("Target domain could not be resolved") from exc

    if not addresses or any(not _is_public_ip(address) for address in addresses):
        raise ValueError("Private/internal verification targets are not allowed")


async def verify_domain_ownership(target: TargetWebsite) -> Tuple[bool, str, str]:
    """Verify the exact ARVE token at the target's well-known endpoint."""
    domain = clean_domain(target.domain)
    _validate_public_destination(urlsplit(f"https://{domain}").hostname or domain)

    verification_path = "/.well-known/arve-verification.txt"
    expected_token = target.verification_token.strip()

    urls_to_try = [
        f"https://{domain}{verification_path}",
        f"http://{domain}{verification_path}",
    ]

    last_error = ""
    last_url = urls_to_try[0]

    # Redirects are deliberately disabled so a public hostname cannot redirect
    # the backend into an internal/private destination.
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=False, verify=True) as client:
        for url in urls_to_try:
            last_url = url
            try:
                response = await client.get(url)
                if response.status_code == 200:
                    content = response.text.strip()
                    if content == expected_token:
                        return True, f"Successfully verified ownership via {url}", url
                    last_error = f"HTTP 200 OK at {url}, but the verification token did not match"
                elif 300 <= response.status_code < 400:
                    last_error = f"Redirects are not followed during verification ({response.status_code})"
                else:
                    last_error = f"Server returned HTTP status {response.status_code} at {url}"
            except httpx.ConnectError:
                last_error = f"Could not connect to {url}"
            except httpx.TimeoutException:
                last_error = f"Request timed out while connecting to {url}"
            except Exception as exc:
                last_error = f"Error fetching {url}: {exc}"

    return False, last_error or "Verification file not found or inaccessible.", last_url
