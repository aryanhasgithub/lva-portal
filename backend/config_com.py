"""Handles config schema and env file"""

import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from audio import get_audio_devices

CONFIG_SCHEMA_PATH = Path(__file__).parent.parent / "config" / "config_schema.json"
MASTER_ENV_PATH = Path("/etc/lva/master.env")

router = APIRouter(prefix="/api/config", tags=["config"])

# Keys whose "default" should be resolved against live audio hardware
# rather than the static value in config_schema.json.
INPUT_DEVICE_KEYS = {"AUDIO_INPUT_DEVICE"}
OUTPUT_DEVICE_KEYS = {"AUDIO_OUTPUT_DEVICE", "MUSIC_OUTPUT_DEVICE"}
DEVICE_KEYS = INPUT_DEVICE_KEYS | OUTPUT_DEVICE_KEYS


def parse_env_file(path: Path) -> dict[str, str]:
    """Reads an .env file and returns a key-value dict, stripping quotes."""
    config: dict[str, str] = {}
    if not path.exists():
        return config
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    config[key.strip()] = val.strip('"').strip("'")
    except Exception as e:  # pylint: disable=broad-exception-caught
        print(f"[ENV READ ERROR] {e}")
    return config


def seed_env_defaults() -> None:
    """
    On startup, ensures every key defined in config_schema.json exists in
    master.env. Missing keys or keys left as generic "default" placeholders
    for audio devices are updated with live container hardware values.
    """
    if not CONFIG_SCHEMA_PATH.exists():
        print("[CONFIG SEED] Schema not found, skipping.")
        return

    try:
        with open(CONFIG_SCHEMA_PATH, "r", encoding="utf-8") as f:
            schema = json.load(f)

        current = parse_env_file(MASTER_ENV_PATH)
        missing: dict[str, str] = {}
        has_updates = False

        # Fetch live audio devices via the async supervisor client wrapper
        try:
            audio_inputs, audio_outputs = asyncio.run(get_audio_devices())
            detected_input = audio_inputs[0] if audio_inputs else "default"
            detected_output = audio_outputs[0] if audio_outputs else "default"
            print(f"[CONFIG SEED] Detected hardware - In: {detected_input}, Out: {detected_output}")
        except Exception as audio_err:
            print(f"[CONFIG SEED WARNING] Could not fetch live devices: {audio_err}")
            detected_input = "default"
            detected_output = "default"

        for fields in schema.values():
            for field in fields:
                key = field["key"]

                # Check if key is completely missing or stuck on a placeholder string
                is_missing = key not in current
                is_placeholder = current.get(key) in ["default", "", "None"]

                if is_missing or (key in DEVICE_KEYS and is_placeholder):
                    if key in INPUT_DEVICE_KEYS:
                        default = detected_input
                    elif key in OUTPUT_DEVICE_KEYS:
                        default = detected_output
                    else:
                        default = field.get("default", "")

                    if isinstance(default, bool):
                        default = "1" if default else "0"

                    # Update our working dictionary copies
                    current[key] = str(default)
                    missing[key] = str(default)
                    has_updates = True

        if not has_updates:
            print("[CONFIG SEED] master.env is complete, nothing to add.")
            return

        # Rewrite master.env cleanly with the full, safe dataset
        os.makedirs(MASTER_ENV_PATH.parent, exist_ok=True)
        lines = [
            "# Linux-Voice-Assistant - Auto-Generated Configuration",
            f"# Seeded/Updated: {datetime.now().isoformat()}",
            "",
        ]
        for key, value in current.items():
            lines.append(f'{key}="{value}"')

        with open(MASTER_ENV_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        print(f"[CONFIG SEED] Updated master.env with key(s): {', '.join(missing)}")

    except Exception as e:  # pylint: disable=broad-exception-caught
        print(f"[CONFIG SEED ERROR] {e}")


@router.get("/schema")
async def get_config_schema():
    """
    Loads the base schema JSON, injects real-time audio hardware options,
    and overlays current values from master.env.
    """
    if not CONFIG_SCHEMA_PATH.exists():
        raise HTTPException(status_code=404, detail="Config schema not found")

    try:
        with open(CONFIG_SCHEMA_PATH, "r", encoding="utf-8") as f:
            schema = json.load(f)

        audio_inputs, audio_outputs = await get_audio_devices()
        current_values = parse_env_file(MASTER_ENV_PATH)

        for fields in schema.values():
            for field in fields:
                if field["key"] in INPUT_DEVICE_KEYS:
                    field["options"] = audio_inputs
                if field["key"] in OUTPUT_DEVICE_KEYS:
                    field["options"] = audio_outputs
                if field["key"] in current_values:
                    field["default"] = current_values[field["key"]]

        return schema

    except Exception as e:  # pylint: disable=broad-exception-caught
        print(f"[SCHEMA ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/save")
async def save_config(request: Request):
    """Writes the received JSON payload to /etc/lva/master.env."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from Exception

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Expected a JSON object")

    lines = [
        "# Linux-Voice-Assistant - Auto-Generated Configuration",
        f"# Updated: {datetime.now().isoformat()}",
        "",
    ]

    for key, value in data.items():  # type: ignore[reportUnknownVariableType]
        if isinstance(value, bool):
            value = "1" if value else "0"
        lines.append(f'{key}="{value}"')

    try:
        os.makedirs(MASTER_ENV_PATH.parent, exist_ok=True)
        with open(MASTER_ENV_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        print(f"[CONFIG SAVED] Written to {MASTER_ENV_PATH}")
        return {"status": "success", "message": "Configuration saved successfully"}

    except PermissionError:
        raise HTTPException(
            status_code=403, detail="Permission denied writing to /etc/lva/"
        ) from PermissionError
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e