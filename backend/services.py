"""Service control — talks to lva-supervisor over unix socket."""

from fastapi import APIRouter

from supervisor_client import supervisor_post, get_container_state  # type: ignore

CONTAINER_MAP: dict[str, str] = {
    "lva":    "lva",
    "portal": "lva-portal",
    "audio":  "lva-audio",
}

router = APIRouter(prefix="/api", tags=["services"])


def _container(service_key: str) -> str:
    return CONTAINER_MAP.get(service_key, "lva")



@router.get("/status")
async def get_status(service: str = "lva"):
    try:
        state = await get_container_state(_container(service))
        return {"status": state}
    except Exception as err:  # pylint: disable=broad-exception-caught
        print("[STATUS ERROR] %s: %s", service, err)
        return {"status": "Error"}

@router.post("/service/reboot")
async def system_reboot():
    """Reboot the host system via supervisor."""
    try:
        await supervisor_post("/system/reboot")
        return {"result": "ok"}
    except Exception as err:  # pylint: disable=broad-exception-caught
        print("[REBOOT ERROR] %s", err)
        return {"status": "Error"}
    
@router.post("/service/{action}")
async def service_action(action: str, service: str = "lva"):
    """Start, stop, or restart a service."""
    if action not in ("start", "stop", "restart"):
        return {"status": "Error"}

    name = _container(service)
    try:
        await supervisor_post(f"/containers/{name}/{action}")
        return {
            "start":   {"status": "Running"},
            "stop":    {"status": "Stopped"},
            "restart": {"status": "Running"},
        }[action]
    except Exception as err:  # pylint: disable=broad-exception-caught
        print("[SERVICE ERROR] %s %s: %s %s", action, name, type(err).__name__, err)
        return {"status": "Error"}

