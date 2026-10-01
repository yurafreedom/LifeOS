"""Coarse client context for throttling, audit and the session list.

Never the full IP address or the raw User-Agent: a network prefix (IPv4 /24,
IPv6 /48) and a short "Browser · OS" label are enough to recognise a device
or an abuse source without keeping unnecessary personal data.
"""

import ipaddress
import re
from dataclasses import dataclass

from fastapi import Request

from app.config import Settings


@dataclass(frozen=True)
class ClientContext:
    address: str | None  # used transiently for throttling; not stored
    network: str | None
    device_label: str | None


_BROWSERS = (
    ("Edge", re.compile(r"Edg/")),
    ("Opera", re.compile(r"OPR/")),
    ("Firefox", re.compile(r"Firefox/")),
    ("Chrome", re.compile(r"Chrome/|CriOS/")),
    ("Safari", re.compile(r"Safari/")),
)
_SYSTEMS = (
    ("iOS", re.compile(r"iPhone|iPad|iPod")),
    ("Android", re.compile(r"Android")),
    ("Windows", re.compile(r"Windows")),
    ("macOS", re.compile(r"Mac OS X|Macintosh")),
    ("Linux", re.compile(r"Linux")),
)


def device_label(user_agent: str | None) -> str | None:
    if not user_agent:
        return None
    browser = next((name for name, pattern in _BROWSERS if pattern.search(user_agent)), None)
    system = next((name for name, pattern in _SYSTEMS if pattern.search(user_agent)), None)
    if browser is None and system is None:
        return "unknown device"
    return " · ".join(part for part in (browser, system) if part)


def coarse_network(address: str | None) -> str | None:
    if not address:
        return None
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return None
    prefix = 24 if ip.version == 4 else 48
    return str(ipaddress.ip_network(f"{ip}/{prefix}", strict=False))


def client_address(request: Request, settings: Settings) -> str | None:
    peer = request.client.host if request.client else None
    hops = settings.trusted_proxy_hops
    if hops <= 0:
        return peer
    forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",") if part.strip()]
    if len(forwarded) < hops:
        return peer
    return forwarded[-hops]


def client_context(request: Request, settings: Settings) -> ClientContext:
    address = client_address(request, settings)
    return ClientContext(
        address=address,
        network=coarse_network(address),
        device_label=device_label(request.headers.get("user-agent")),
    )
