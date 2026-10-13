"""Unit tests for standalone voice audio capture module."""

import json
from io import StringIO
from unittest.mock import MagicMock, patch
import numpy as np
import pytest

from mave_wake.voice_capture import (
    VoiceAudioCapture,
    main,
    parse_args,
    query_input_devices,
    resolve_device_index,
)


def test_query_input_devices():
    fake_devices = [
        {"name": "Default In", "max_input_channels": 2, "default_samplerate": 48000},
        {"name": "Speakers", "max_input_channels": 0, "default_samplerate": 48000},
        {"name": "FIFINE K690", "max_input_channels": 2, "default_samplerate": 16000},
    ]

    with patch("sounddevice.query_devices", return_value=fake_devices), patch(
        "sounddevice.default.device", (2, 1)
    ):
        devices = query_input_devices()
        assert len(devices) == 2  # Speakers excluded (0 input channels)
        assert devices[0]["id"] == "0"
        assert devices[0]["label"] == "Default In"
        assert devices[0]["isDefault"] is False

        assert devices[1]["id"] == "2"
        assert devices[1]["label"] == "FIFINE K690"
        assert devices[1]["isDefault"] is True


def test_resolve_device_index():
    devices = [
        {"id": "0", "label": "Default In", "isDefault": False},
        {"id": "1", "label": "FIFINE K690 Microphone", "isDefault": True},
        {"id": "2", "label": "USB Audio Device", "isDefault": False},
    ]

    # Default / None
    idx, label = resolve_device_index(None, devices)
    assert idx == 1
    assert "FIFINE K690" in label

    idx, label = resolve_device_index("default", devices)
    assert idx == 1

    # Numeric ID
    idx, label = resolve_device_index("2", devices)
    assert idx == 2
    assert label == "USB Audio Device"

    # Name matching
    idx, label = resolve_device_index("fifine", devices)
    assert idx == 1
    assert "FIFINE K690" in label

    # Non-existent
    with pytest.raises(ValueError, match="not found"):
        resolve_device_index("NonExistentDevice999", devices)


def test_voice_audio_capture_callback_and_queue():
    capture = VoiceAudioCapture(
        sample_rate=16000, chunk_size=1280, max_queue_size=3
    )

    fake_data = np.ones((1280, 1), dtype=np.int16) * 100
    expected_bytes = fake_data.tobytes()
    assert len(expected_bytes) == 2560

    # Put chunks
    capture._audio_callback(fake_data, 1280, {}, None)
    capture._audio_callback(fake_data, 1280, {}, None)
    capture._audio_callback(fake_data, 1280, {}, None)

    assert capture._queue.qsize() == 3
    assert capture.stats["overflow_count"] == 0

    # Overflow behavior: puts 4th chunk, drops oldest
    fake_data_new = np.ones((1280, 1), dtype=np.int16) * 200
    capture._audio_callback(fake_data_new, 1280, {}, None)

    assert capture._queue.qsize() == 3
    assert capture.stats["overflow_count"] == 1


def test_parse_args():
    args = parse_args(["--list-devices"])
    assert args.list_devices is True

    args2 = parse_args(["--device", "1", "--sample-rate", "16000", "--chunk-size", "1280"])
    assert args2.list_devices is False
    assert args2.device == "1"
    assert args2.sample_rate == 16000
    assert args2.chunk_size == 1280


def test_voice_capture_list_devices_cli():
    fake_devices = [
        {"name": "Mic 1", "max_input_channels": 1, "default_samplerate": 16000},
    ]

    with patch("sounddevice.query_devices", return_value=fake_devices), patch(
        "sounddevice.default.device", (0, 0)
    ), patch("sys.stdout", new_callable=StringIO) as mock_stdout:
        code = main(["--list-devices"])
        assert code == 0
        parsed = json.loads(mock_stdout.getvalue())
        assert len(parsed) == 1
        assert parsed[0]["id"] == "0"
        assert parsed[0]["label"] == "Mic 1"
        assert parsed[0]["isDefault"] is True
