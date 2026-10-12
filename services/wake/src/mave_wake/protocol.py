"""JSON-lines stdio protocol for MAVE Python wake service."""

import json
import sys
import time
from typing import Any, Dict, List, Optional


def emit_event(event_type: str, payload: Optional[Dict[str, Any]] = None) -> None:
    """Serialize event to stdout as a single newline-delimited JSON line."""
    data = {"type": event_type}
    if payload:
        data.update(payload)
    line = json.dumps(data)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def emit_status(
    status: str,
    device: str,
    device_index: Optional[int],
    threshold: float,
    model_path: str,
    model_loaded: bool,
    available_devices: List[str],
    error_message: Optional[str] = None,
) -> None:
    """Emit status event over protocol."""
    payload: Dict[str, Any] = {
        "status": status,
        "device": device,
        "device_index": device_index if device_index is not None else -1,
        "threshold": threshold,
        "model_path": model_path,
        "model_loaded": model_loaded,
        "available_devices": available_devices,
    }
    if error_message:
        payload["error_message"] = error_message
    emit_event("status", payload)


def emit_wake_detected(model: str, score: float, timestamp: Optional[int] = None) -> None:
    """Emit wake detected event over protocol."""
    emit_event(
        "wake_detected",
        {
            "model": model,
            "score": round(float(score), 4),
            "timestamp": timestamp if timestamp is not None else int(time.time() * 1000),
        },
    )


def emit_error(code: str, message: str) -> None:
    """Emit error event over protocol."""
    emit_event("error", {"code": code, "message": message})


def emit_devices(devices: List[str], default_device: str) -> None:
    """Emit available audio devices list."""
    emit_event("devices", {"devices": devices, "default_device": default_device})


def emit_test_audio_result(
    path: str,
    max_score: float,
    wake_detected: bool,
    frames_processed: int,
    scores: Optional[List[float]] = None,
    error: Optional[str] = None,
) -> None:
    """Emit offline WAV test result."""
    payload: Dict[str, Any] = {
        "path": path,
        "max_score": round(float(max_score), 4),
        "wake_detected": bool(wake_detected),
        "frames_processed": int(frames_processed),
    }
    if scores is not None:
        payload["scores"] = [round(float(s), 4) for s in scores]
    if error:
        payload["error"] = error
    emit_event("test_audio_result", payload)


def log_debug(message: str) -> None:
    """Send debug log to stderr (does not interfere with stdout protocol)."""
    sys.stderr.write(f"[DEBUG] {message}\n")
    sys.stderr.flush()


def log_info(message: str) -> None:
    """Send info log to stderr."""
    sys.stderr.write(f"[INFO] {message}\n")
    sys.stderr.flush()


def log_error(message: str) -> None:
    """Send error log to stderr."""
    sys.stderr.write(f"[ERROR] {message}\n")
    sys.stderr.flush()


def parse_command(line: str) -> Optional[Dict[str, Any]]:
    """Parse incoming JSON line from stdin."""
    stripped = line.strip()
    if not stripped:
        return None
    try:
        data = json.loads(stripped)
        if isinstance(data, dict) and "command" in data:
            return data
        return None
    except Exception as exc:
        log_error(f"Failed to parse stdin command line: {exc}")
        return None
