# type: ignore
"""Network routes for the LVA portal.

Proxies all network operations to the supervisor API over unix socket.
"""

import logging

from fastapi import APIRouter
from supervisor_client import supervisor_get, supervisor_post

_LOGGER = logging.getLogger(__name__)

router = APIRouter(prefix="/api/network", tags=["network"])

_UNAVAILABLE = {"error": "Supervisor unavailable", "devices": [], "hostname": "unknown"}

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
    return {
        **d,
        "state": _NM_DEVICE_STATE.get(d.get("state"), str(d.get("state", "unknown"))),
        "type": _NM_DEVICE_TYPE.get(d.get("type"), "unknown"),
    }


@router.get("/info")
async def network_info():
    try:
        data = await supervisor_get("/network/info")
        devices = data if isinstance(data, list) else data.get("devices", [])
        hostname = data.get("hostname", "") if isinstance(data, dict) else ""
        return {"devices": [_map_device(d) for d in devices], "hostname": hostname}
    except Exception as err:
        _LOGGER.warning("network/info unavailable: %s", err)
        return _UNAVAILABLE


@router.get("/interfaces")
async def network_interfaces():
    try:
        data = await supervisor_get("/network/interfaces")
        devices = data if isinstance(data, list) else []
        return [_map_device(d) for d in devices]
    except Exception as err:
        _LOGGER.warning("network/interfaces unavailable: %s", err)
        return []


@router.post("/hostname")
async def set_hostname(body: dict):
    hostname = body.get("hostname", "").strip()
    if not hostname:
        return {"error": "'hostname' is required"}
    try:
        return await supervisor_post("/network/hostname", json={"hostname": hostname})
    except Exception as err:
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
    except Exception as err:
        _LOGGER.warning("network/ip unavailable: %s", err)
        return {"error": "Supervisor unavailable"}