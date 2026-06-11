"""Get audio devices from container"""

from supervisor_client import supervisor_get


async def get_audio_devices() -> tuple[list[str], list[str]]:
    """Get audio devices from container"""
    devices: dict[str, list[str]] = await supervisor_get("/audio/devices")
    if "error" in devices:
        raise RuntimeError(f"Audio agent encountered an issue: {devices['error']}")
    inputs: list[str] = devices["microphones"]
    outputs: list[str] = devices["speakers"]

    return inputs, outputs
