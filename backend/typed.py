"""LVA Supervisor type definitions."""

from typing import Literal, TypedDict


class ContainerInfo(TypedDict):
    """Represents a managed container."""

    name: Literal["linux-voice-assistant", "lva-audio", "lva-portal"]
    image: str
    state: Literal["running", "stopped", "failed", "not_found", "unknown"]
