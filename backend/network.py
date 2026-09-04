# type: ignore
"""Network routes for the LVA portal.

Proxies all network operations to the supervisor API over unix socket.
"""

import logging

from fastapi import APIRouter
from supervisor_client import supervisor_get, supervisor_post

_LOGGER = logging.getLogger(__name__)

router = APIRouter(prefix="/api/network", tags=["network"])

_UNAVAILABLE_DEVICES: dict = {"error": "Supervisor unavailable", "devices": [], "hostname": "unknown"}

_NM_DEVICE_STATE = {
    10: "unmanaged",
    20: "unavailable",
    30: "disconnected",
    40: "prepare",
    50: "config",
    60: "need_auth",
    70: "ip_config",
    80: "ip_check",
    90: "secondaries",
    100: "activated",
    110: "deactivating",
    120: "failed",
}

_NM_DEVICE_TYPE = {
    1: "ethernet",
    2: "wifi",
    13: "bridge",
    20: "veth",
    32: "loopback",
}


def _map_device(d: dict) -> dict:
    """Map a raw supervisor device dict to the shape the frontend expects.

    The supervisor returns:
      {"interface": str, "state": int, "type": int, "ip4": {addresses, gateway, dns} | None}

    The frontend wants IP fields flattened to the top level (address,
    prefix, gateway, dns), plus human-readable state/type labels. MAC
    address isn't provided by the supervisor at all yet — surfaced as
    None here rather than silently omitted, so the frontend's existing
    "—" fallback renders correctly instead of just not showing the row.
    """
    ip4 = d.get("ip4") or {}
    addresses = ip4.get("addresses") or []
    first_addr = addresses[0] if addresses else {}

    return {
        "interface": d.get("interface"),
        "state": _NM_DEVICE_STATE.get(d.get("state"), str(d.get("state", "unknown"))),
        "type": _NM_DEVICE_TYPE.get(d.get("type"), "unknown"),
        "address": first_addr.get("address"),
        "prefix": first_addr.get("prefix"),
        "gateway": ip4.get("gateway"),
        "dns": ip4.get("dns") or [],
        "mac": d.get("mac"),
    }


async def _get_hostname() -> str:
    """Fetch current hostname.

    The supervisor's /network/info route doesn't include hostname (it
    comes from a separate D-Bus interface the network route never
    queried), so this hits the supervisor's own /system or hostname
    endpoint directly if one exists. If none is available yet, this
    quietly returns "unknown" rather than failing the whole /info call.
    """
    try:
        data = await supervisor_get("/network/hostname")
        if isinstance(data, dict):
            return data.get("hostname", "unknown")
    except Exception as err:  # pylint: disable=broad-exception-caught
        _LOGGER.debug("hostname lookup unavailable: %s", err)
    return "unknown"


@router.get("/info")
async def network_info():
    try:
        data = await supervisor_get("/network/info")
        devices = data if isinstance(data, list) else data.get("devices", [])
    except Exception as err:  # pylint: disable=broad-exception-caught
        _LOGGER.warning("network/info unavailable: %s", err)
        return _UNAVAILABLE_DEVICES

    hostname = await _get_hostname()
    return {"devices": [_map_device(d) for d in devices], "hostname": hostname}


@router.get("/interfaces")
async def network_interfaces():
    try:
        data = await supervisor_get("/network/interfaces")
        devices = data if isinstance(data, list) else []
        return [_map_device(d) for d in devices]
    except Exception as err:  # pylint: disable=broad-exception-caught
        _LOGGER.warning("network/interfaces unavailable: %s", err)
        return []


@router.post("/hostname")
async def set_hostname(body: dict):
    hostname = body.get("hostname", "").strip()
    if not hostname:
        return {"error": "'hostname' is required"}
    try:
        return await supervisor_post("/network/hostname", json={"hostname": hostname})
    except Exception as err:  # pylint: disable=broad-exception-caught
        _LOGGER.warning("network/hostname unavailable: %s", err)
        return {"error": "Supervisor unavailable"}


@router.post("/ip")
async def set_ip(body: dict):
    interface = body.get("interface", "").strip()
    method = body.get("method", "").strip().lower()
    if not interface:
        return {"error": "'interface' is required"}
    if method not in ("dhcp", "static"):
        return {"error": "'method' must be 'dhcp' or 'static'"}
    try:
        return await supervisor_post("/network/ip", json=body)
    except Exception as err:  # pylint: disable=broad-exception-caught
        _LOGGER.warning("network/ip unavailable: %s", err)
        return {"error": "Supervisor unavailable"}


# =============================================================================
# WiFi — scan / connect / disconnect (proxies straight through to supervisor)
# =============================================================================


@router.get("/wifi/scan")
async def wifi_scan(interface: str):
    """Scan for WiFi networks on an interface.

    Passes through the supervisor's scan result list as-is — each entry
    already includes ssid, bssid, strength, frequency, secured, security,
    and key_mgmt. key_mgmt should be sent back unmodified in /wifi/connect.
    """
    interface = (interface or "").strip()
    if not interface:
        return {"error": "'interface' query param is required"}
    try:
        return await supervisor_get(f"/network/wifi/scan?interface={interface}")
    except Exception as err:  # pylint: disable=broad-exception-caught
        _LOGGER.warning("network/wifi/scan unavailable: %s", err)
        return {"error": "Supervisor unavailable"}


@router.post("/wifi/connect")
async def wifi_connect(body: dict):
    """Connect to a WiFi network.

    Body: { "interface": "wlan0", "ssid": "...", "password": "...",
             "key_mgmt": "..." }  — key_mgmt/password optional depending
    on the network's security type (see /wifi/scan result for the target AP).
    """
    interface = body.get("interface", "").strip()
    ssid = body.get("ssid", "").strip()
    if not interface:
        return {"error": "'interface' is required"}
    if not ssid:
        return {"error": "'ssid' is required"}
    try:
        return await supervisor_post("/network/wifi/connect", json=body)
    except Exception as err:  # pylint: disable=broad-exception-caught
        _LOGGER.warning("network/wifi/connect unavailable: %s", err)
        return {"error": "Supervisor unavailable"}


@router.post("/wifi/disconnect")
async def wifi_disconnect(body: dict):
    """Disconnect the active WiFi connection on an interface.

    Body: { "interface": "wlan0" }
    """
    interface = body.get("interface", "").strip()
    if not interface:
        return {"error": "'interface' is required"}
    try:
        return await supervisor_post("/network/wifi/disconnect", json=body)
    except Exception as err:  # pylint: disable=broad-exception-caught
        _LOGGER.warning("network/wifi/disconnect unavailable: %s", err)
        return {"error": "Supervisor unavailable"}