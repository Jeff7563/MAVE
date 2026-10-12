import io
import json
import sys
from mave_wake.protocol import (
    emit_event,
    emit_status,
    emit_wake_detected,
    emit_error,
    emit_test_audio_result,
    parse_command,
)


def test_emit_event_outputs_valid_json_line(monkeypatch):
    buf = io.StringIO()
    monkeypatch.setattr(sys, "stdout", buf)

    emit_event("test_event", {"key": "value"})

    output = buf.getvalue()
    assert output.endswith("\n")
    data = json.loads(output.strip())
    assert data["type"] == "test_event"
    assert data["key"] == "value"


def test_emit_status_and_wake_detected(monkeypatch):
    buf = io.StringIO()
    monkeypatch.setattr(sys, "stdout", buf)

    emit_status(
        status="listening",
        device="Studio USB Mic",
        device_index=1,
        threshold=0.65,
        model_path="assets/wake/mave.onnx",
        model_loaded=True,
        available_devices=["Default", "Studio USB Mic"],
    )

    lines = [json.loads(line) for line in buf.getvalue().splitlines() if line]
    assert len(lines) == 1
    assert lines[0]["type"] == "status"
    assert lines[0]["status"] == "listening"
    assert lines[0]["threshold"] == 0.65
    assert lines[0]["device"] == "Studio USB Mic"

    buf.truncate(0)
    buf.seek(0)

    emit_wake_detected(model="mave", score=0.88, timestamp=1700000000)
    lines2 = [json.loads(line) for line in buf.getvalue().splitlines() if line]
    assert len(lines2) == 1
    assert lines2[0]["type"] == "wake_detected"
    assert lines2[0]["model"] == "mave"
    assert lines2[0]["score"] == 0.88


def test_emit_test_audio_result(monkeypatch):
    buf = io.StringIO()
    monkeypatch.setattr(sys, "stdout", buf)

    emit_test_audio_result(
        path="fixtures/test.wav",
        max_score=0.92,
        wake_detected=True,
        frames_processed=10,
        scores=[0.1, 0.4, 0.92, 0.2],
    )

    data = json.loads(buf.getvalue().strip())
    assert data["type"] == "test_audio_result"
    assert data["path"] == "fixtures/test.wav"
    assert data["max_score"] == 0.92
    assert data["wake_detected"] is True
    assert data["frames_processed"] == 10
    assert len(data["scores"]) == 4


def test_parse_command():
    # Valid command
    cmd = parse_command('{"command": "start"}')
    assert cmd == {"command": "start"}

    # Command with payload
    cmd2 = parse_command('{"command": "set_threshold", "threshold": 0.75}')
    assert cmd2["command"] == "set_threshold"
    assert cmd2["threshold"] == 0.75

    # Empty string or whitespaces
    assert parse_command("") is None
    assert parse_command("   ") is None

    # Invalid JSON
    assert parse_command("invalid-json-string") is None

    # JSON without 'command' field
    assert parse_command('{"other": 123}') is None


def test_emit_telemetry(monkeypatch):
    from mave_wake.protocol import emit_telemetry

    buf = io.StringIO()
    monkeypatch.setattr(sys, "stdout", buf)

    emit_telemetry(latest_score=0.25, peak_score=0.48, last_wake_score=0.88, threshold=0.5)

    data = json.loads(buf.getvalue().strip())
    assert data["type"] == "telemetry"
    assert data["latest_score"] == 0.25
    assert data["peak_score"] == 0.48
    assert data["last_wake_score"] == 0.88
    assert data["threshold"] == 0.5


def test_parse_reset_command():
    cmd = parse_command('{"command": "reset"}')
    assert cmd == {"command": "reset"}


