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

# Prefix applied to boolean fields' env var names in master.env, so the
# entrypoint script can recognize zero-argument CLI flags purely from the
# key name — no hardcoded per-key allowlist needed on that side. The
# frontend and everything else in this file still address fields by their
# plain schema key ("COLORED_DEBUG"); only the on-disk env var name gets
# the prefix.
BOOL_ENV_PREFIX = "B_"


def _env_key(field: dict) -> str:
    """Env var name to use in master.env for a given schema field."""
    return f"{BOOL_ENV_PREFIX}{field['key']}" if field.get("type") == "bool" else field["key"]


def _load_schema() -> dict:
    if not CONFIG_SCHEMA_PATH.exists():
        return {}
    with open(CONFIG_SCHEMA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


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
    master.env under its correct env var name (B_-prefixed for booleans).
    Missing keys or keys left as generic "default" placeholders for audio
    devices are updated with live container hardware values.
    """
    if not CONFIG_SCHEMA_PATH.exists():
        print("[CONFIG SEED] Schema not found, skipping.")
        return

    try:
        schema = _load_schema()
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
                env_key = _env_key(field)

                is_missing = env_key not in current
                is_placeholder = current.get(env_key) in ["default", "", "None"]

                if is_missing or (key in DEVICE_KEYS and is_placeholder):
                    if key in INPUT_DEVICE_KEYS:
                        default = detected_input
                    elif key in OUTPUT_DEVICE_KEYS:
                        default = detected_output
                    else:
                        default = field.get("default", "")

                    if isinstance(default, bool):
                        default = "1" if default else "0"

                    current[env_key] = str(default)
                    missing[env_key] = str(default)
                    has_updates = True

        if not has_updates:
            print("[CONFIG SEED] master.env is complete, nothing to add.")
            return

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
    and overlays current values from master.env — reading each field back
    from its plain OR B_-prefixed env var name depending on its type, so
    the response the frontend sees always uses plain schema keys.
    """
    if not CONFIG_SCHEMA_PATH.exists():
        raise HTTPException(status_code=404, detail="Config schema not found")

    try:
        schema = _load_schema()
        audio_inputs, audio_outputs = await get_audio_devices()
        current_values = parse_env_file(MASTER_ENV_PATH)

        for fields in schema.values():
            for field in fields:
                if field["key"] in INPUT_DEVICE_KEYS:
                    field["options"] = audio_inputs
                if field["key"] in OUTPUT_DEVICE_KEYS:
                    field["options"] = audio_outputs
                env_key = _env_key(field)
                if env_key in current_values:
                    field["default"] = current_values[env_key]

        return schema

    except Exception as e:  # pylint: disable=broad-exception-caught
        print(f"[SCHEMA ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/save")
async def save_config(request: Request):
    """Writes the received JSON payload to /etc/lva/master.env.

    The frontend sends plain schema keys (e.g. "COLORED_DEBUG"). Boolean
    fields are translated here to their B_-prefixed env var name so the
    entrypoint script can identify zero-argument CLI flags purely from
    the key name, without a hardcoded per-key allowlist. Keys not found
    in the schema (unexpected extra fields) are written as-is.
    """
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from Exception

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Expected a JSON object")

    field_by_key: dict[str, dict] = {}
    try:
        schema = _load_schema()
        for fields in schema.values():
            for field in fields:
                field_by_key[field["key"]] = field
    except Exception as e:  # pylint: disable=broad-exception-caught
        print(f"[CONFIG SAVE WARNING] Could not load schema for key mapping: {e}")

    lines = [
        "# Linux-Voice-Assistant - Auto-Generated Configuration",
        f"# Updated: {datetime.now().isoformat()}",
        "",
    ]

    for key, value in data.items():  # type: ignore[reportUnknownVariableType]
        if isinstance(value, bool):
            value = "1" if value else "0"
        field = field_by_key.get(key)
        env_key = _env_key(field) if field else key
        lines.append(f'{env_key}="{value}"')

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