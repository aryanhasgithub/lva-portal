import asyncio
import json
import time

import psutil
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats")
async def stream_stats(request: Request):
    boot_time = psutil.boot_time()

    async def event_generator():
        try:
            while not await request.is_disconnected():
                uptime_seconds = time.time() - boot_time
                stats: dict[str, float | str] = {
                    "cpu": psutil.cpu_percent(interval=None),
                    "memory": round(psutil.virtual_memory().percent, 1),
                    "uptime": time.strftime("%H:%M:%S", time.gmtime(uptime_seconds)),
                }
                yield f"data: {json.dumps(stats)}\n\n"
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")
