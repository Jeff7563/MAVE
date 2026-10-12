import pytest
import numpy as np
from unittest.mock import patch, MagicMock
from mave_wake.audio import AudioCapture


def test_audio_capture_device_query():
    # Should safely return a list of devices or empty list without crashing
    devices = AudioCapture.get_available_devices()
    assert isinstance(devices, list)

    default_name = AudioCapture.get_default_device_name()
    assert isinstance(default_name, str)
    assert len(default_name) > 0


def test_audio_capture_callback_dispatch():
    received = []

    def on_chunk(chunk):
        received.append(chunk)

    capture = AudioCapture(chunk_size=1280, on_chunk=on_chunk)
    capture.is_recording = True

    # Simulate callback from sounddevice
    fake_data = np.ones((1280, 1), dtype=np.int16) * 42
    capture._audio_callback(fake_data, 1280, {}, None)

    # Trigger worker dispatch
    capture._stop_event.clear()
    chunk = capture._queue.get_nowait()
    capture.on_chunk(chunk)

    assert len(received) == 1
    assert received[0].shape == (1280,)
    assert received[0][0] == 42


def test_audio_capture_handles_missing_devices():
    with patch.object(AudioCapture, "get_available_devices", return_value=[]):
        capture = AudioCapture()
        success, error = capture.start()
        assert success is False
        assert error is not None
        assert "No audio input devices detected" in error

