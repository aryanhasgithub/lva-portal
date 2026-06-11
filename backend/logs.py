"""Log streaming — proxies SSE stream from lva-supervisor."""

import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from db import DB_NAME, sync_save_log

router = APIRouter(prefix="/api", tags=["logs"])
executor = ThreadPoolExecutor(max_workers=4)

SUPERVISOR_SOCK = "/run/lva/supervisor.sock"

CONTAINER_MAP: dict[str, str] = {
    "lva": "lva",
    "portal": "lva-portal",
}


@router.get("/logs/history")
async def get_log_history(service: str = "lva"):
    """Get logs from the last 24 hours for a given service."""
    yesterday = (datetime.now() - timedelta(hours=24)).isoformat()
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT timestamp, message FROM logs WHERE service = ? AND timestamp > ? ORDER BY timestamp ASC",
        (service, yesterday),
    )
    rows = cursor.fetchall()
    conn.close()
    return {row[0]: row[1] for row in rows}


@router.get("/stream/logs")
async def stream_logs(
    request: Request, service: str
):  # pylint: disable=unused-argument
    """Proxy the SSE log stream from supervisor to the frontend."""
    name = CONTAINER_MAP.get(service)

    async def log_generator():
        transport = httpx.AsyncHTTPTransport(uds=SUPERVISOR_SOCK)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://supervisor",
            timeout=None,  # streaming — no timeout
        ) as client:
            async with client.stream(
                "GET", f"/containers/{name}/logs/stream", params={"tail": 100}
            ) as response:
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    # Save to SQLite
                    try:
                        data = json.loads(line.removeprefix("data: "))
                        executor.submit(
                            sync_save_log,
                            data.get("time", datetime.now().isoformat()),
                            service,
                            data.get("message", ""),
                        )
                    except Exception:  # pylint: disable=broad-exception-caught
                        pass
                    # Forward to frontend
                    yield f"{line}\n\n"

    return StreamingResponse(log_generator(), media_type="text/event-stream")
