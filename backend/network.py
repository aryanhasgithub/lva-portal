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


@router.get("/info")
async def network_info():
    try:
        return await supervisor_get("/network/info")
    except Exception as err:  # pylint: disable=broad-exception-caught
        _LOGGER.warning("network/info unavailable: %s", err)
        return _UNAVAILABLE


@router.get("/interfaces")
async def network_interfaces():
    try:
        return await supervisor_get("/network/interfaces")
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