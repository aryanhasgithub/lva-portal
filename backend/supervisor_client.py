# type: ignore
"""Supervisor client.

Thin wrapper around httpx for talking to lva-supervisor
over the unix socket at /run/lva/supervisor.sock.

Usage:
    from supervisor_client import supervisor_get, supervisor_post

    data = await supervisor_get("/containers")
    data = await supervisor_post("/containers/lva/restart")
"""

import httpx
from typed import ContainerInfo
from typing import Any

SUPERVISOR_SOCK = "/run/lva/supervisor.sock"
SUPERVISOR_BASE = "http://supervisor"


DEFAULT_TIMEOUT = 60.0


def _client(timeout: float | None = DEFAULT_TIMEOUT) -> httpx.AsyncClient:
    """Return a new httpx client connected to the supervisor unix socket.

    ``timeout`` is applied to connect/read/write/pool. Pass a larger value
    (or None) for endpoints that block server-side for a long time with no
    bytes on the wire, e.g. /system/os-update.
    """
    transport = httpx.AsyncHTTPTransport(uds=SUPERVISOR_SOCK)
    return httpx.AsyncClient(
        transport=transport,
        base_url=SUPERVISOR_BASE,
        timeout=timeout,
    )


async def supervisor_get(path: str, **kwargs) -> Any:
    """GET request to supervisor API."""
    async with _client() as client:
        response = await client.get(path, **kwargs)
        response.raise_for_status()
        return response.json()


async def supervisor_containers_get(**kwargs) -> list[ContainerInfo]:
    """GET request to supervisor API."""
    async with _client() as client:
        response = await client.get("/containers", **kwargs)
        response.raise_for_status()
        return response.json()


async def get_container_state(name: str) -> str:
    """Get the state of a specific container."""
    async with _client() as client:
        response = await client.get(f"/containers/{name}/state")
        response.raise_for_status()
        return response.json()["state"]


async def supervisor_post(
    path: str, timeout: float | None = DEFAULT_TIMEOUT, **kwargs
) -> dict:
    """POST request to supervisor API."""
    async with _client(timeout) as client:
        response = await client.post(path, **kwargs)
        response.raise_for_status()
        print("[DEBUG] supervisor_post status:", response.status_code, "body:", repr(response.text))
        return response.json()


async def supervisor_healthy() -> bool:
    """Return True if supervisor is reachable."""
    try:
        await supervisor_get("/system/health")
        return True
    except Exception:  # pylint: disable=broad-exception-caught
        return False