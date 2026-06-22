# type: ignore
"""Updates — delegates to lva-supervisor over unix socket.

Maps old portal update API to new supervisor endpoints.

The JSX expects:
  GET  /api/system/updates
        → { portal: ComponentStatus, core: ComponentStatus,
            audio: ComponentStatus, os: OSStatus }

  GET  /api/system/update/stream?component=<name>
        → SSE stream of { type: "log"|"success"|"error", status: str,
                          pull_percent?: int }
"""

import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import urllib.request

from supervisor_client import supervisor_get, supervisor_post

router = APIRouter(prefix="/api/system", tags=["updates"])


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


# =============================================================================
# Helpers
# =============================================================================


async def _get_container_status(
    name: str,
    display_name: str,
    repo: str,
    versions: list[dict],
) -> dict:
    for item in versions:
        if item.get("name") == name:
            local_ver = item.get("local_version") or "unknown"
            remote_ver = item.get("remote_version") or "unknown"
            return {
                "id": name,
                "name": display_name,
                "repo": repo,
                "current": local_ver,
                "latest": remote_ver,
                "available": item.get("update_available", False),
                "notes": (
                    get_release_notes(repo)
                    if item.get("update_available", False)
                    else ""
                ),
                "url": f"https://github.com/{repo}",
                "action": "container_update",
            }

    return {
        "id": name,
        "name": display_name,
        "repo": repo,
        "current": "unknown",
        "latest": "unknown",
        "available": False,
        "notes": "",
        "url": f"https://github.com/{repo}",
        "action": "container_update",
    }


async def _get_os_status() -> dict:
    try:
        data = await supervisor_get("/updates/os")
        return {
            "id": "os",
            "name": "LVA OS",
            "repo": "aryanhasgithub/lva-os",
            "tag": data.get("tag", "unknown"),
            "notes": (
                get_release_notes("aryanhasgithub/lva-os")
                if data.get("update_available", False)
                else ""
            ),
            "url": data.get("url", ""),
            "bundle_url": data.get("bundle_url"),
            "machine": data.get("machine", "unknown"),
            "available": data.get("update_available", False),
            "current": data.get("current_version", "unknown"),
            "latest": data.get("tag", "unknown"),
            "action": "os_update",
        }
    except Exception as err:  # pylint: disable=broad-exception-caught
        print(f"[OS UPDATE ERROR] {err}")
        return {
            "id": "os",
            "name": "LVA OS",
            "repo": "aryanhasgithub/lva-os",
            "available": False,
            "tag": "unknown",
            "notes": "",
            "url": "",
            "current": "unknown",
            "latest": "unknown",
            "action": "os_update",
        }


# =============================================================================
# Routes
# =============================================================================


@router.get("/updates")
async def check_updates():
    try:
        versions: list[dict] = await supervisor_get("/updates")
    except Exception as err:  # pylint: disable=broad-exception-caught
        print(f"[UPDATES ERROR] fetching /updates: {err}")
        versions = []

    portal, core, audio, os_status = await asyncio.gather(
        _get_container_status(
            "lva-portal", "LVA Portal", "aryanhasgithub/lva-portal", versions
        ),
        _get_container_status(
            "lva", "LVA Core", "OHF-Voice/linux-voice-assistant", versions
        ),
        _get_container_status(
            "lva-audio", "LVA Audio", "aryanhasgithub/lva-audio", versions
        ),
        _get_os_status(),
    )
    return {"portal": portal, "core": core, "audio": audio, "os": os_status}


@router.get("/update/stream")
async def trigger_update_stream(component: str):
    """SSE stream for container or OS updates.

    For container updates, proxies the supervisor's own SSE stream
    verbatim — the supervisor now emits full JSON dicts including
    pull_percent, so we forward the whole payload unchanged rather
    than mapping it to a {type, message} shape, which would drop
    the pull_percent field the JSX uses for the progress bar.
    """

    async def _stream() -> AsyncGenerator[str, None]:
        yield _sse({"type": "log", "status": f"Starting update for {component}..."})

        # ── OS update ────────────────────────────────────────────────────────
        if component == "os":
            yield _sse({"type": "log", "status": "Fetching OS bundle URL from GitHub..."})
            try:
                os_info = await supervisor_get("/updates/os")
                if not os_info.get("bundle_url"):
                    yield _sse({"type": "error", "status": "No bundle available for this machine."})
                    return

                yield _sse({
                    "type": "log",
                    "status": f"Bundle found: {os_info['tag']} for {os_info.get('machine', '?')}",
                })
                yield _sse({
                    "type": "log",
                    "status": "Downloading bundle and handing to RAUC — this may take a few minutes...",
                })

                result = await supervisor_post(
                    "/system/os-update",
                    json={"bundle_url": os_info["bundle_url"]}
                )
                if result.get("result") == "ok":
                    yield _sse({"type": "success", "status": "OS update installed. Reboot to apply."})
                else:
                    yield _sse({"type": "error", "status": result.get("error", "OS update failed.")})
            except Exception as err:  # pylint: disable=broad-exception-caught
                yield _sse({"type": "error", "status": str(err)})
            return

        # ── Container update — proxy supervisor SSE verbatim ─────────────────
        # The supervisor emits {"type", "status", "pull_percent"?} dicts.
        # Forward the whole payload so pull_percent reaches the JSX.
        try:
            import httpx

            SUPERVISOR_SOCK = "/run/lva/supervisor.sock"
            transport = httpx.AsyncHTTPTransport(uds=SUPERVISOR_SOCK)

            async with httpx.AsyncClient(
                transport=transport, base_url="http://supervisor", timeout=300
            ) as client:
                async with client.stream(
                    "GET",
                    f"/containers/{component}/update/stream",
                ) as resp:
                    if resp.status_code != 200:
                        yield _sse({"type": "error", "status": f"Supervisor returned {resp.status_code}"})
                        return

                    async for raw_line in resp.aiter_lines():
                        if not raw_line.startswith("data:"):
                            continue
                        try:
                            # Forward the full supervisor payload unchanged —
                            # pull_percent is already in there, don't strip it.
                            payload = json.loads(raw_line[5:].strip())
                            yield f"data: {json.dumps(payload)}\n\n"
                        except json.JSONDecodeError:
                            yield _sse({"type": "log", "status": raw_line})

        except Exception as err:  # pylint: disable=broad-exception-caught
            yield _sse({"type": "error", "status": str(err)})

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{action}")
async def system_power(action: str):
    if action not in ("reboot", "poweroff"):
        return {"status": "error", "detail": "Invalid action"}
    try:
        result = await supervisor_post(f"/system/{action}")
        return result
    except Exception as err:  # pylint: disable=broad-exception-caught
        return {"status": "error", "detail": str(err)}


def get_release_notes(repo_name: str) -> str:
    try:
        api_url = f"https://api.github.com/repos/{repo_name}/releases/latest"
        req = urllib.request.Request(api_url, headers={"User-Agent": "LVA-Portal"})
        with urllib.request.urlopen(req) as response:
            data: dict[str, str] = json.loads(response.read().decode())
            return data.get("body", "")
    except Exception as err:  # pylint: disable=broad-exception-caught
        print(f"[RELEASE NOTES ERROR] {err}")
        return ""