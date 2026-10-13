"""Unit tests for MAVE faster-whisper STT service."""

import io
import json
import struct
import sys
from unittest.mock import MagicMock, patch
import numpy as np
import pytest

from mave_stt.config import STTConfig
from mave_stt.engine import STTEngine
from mave_stt.server import STTServer, read_exact
from mave_stt.vad import UtteranceVADTracker, VADState


def test_stt_config_normalization():
    cfg = STTConfig(model="large-v3-turbo", device="auto", compute_type="auto")
    device, compute = cfg.normalize_device_and_compute()
    assert device in ("cuda", "cpu")
    assert compute in ("float16", "int8")

    cfg_cpu = STTConfig(device="cpu", compute_type="auto")
    dev_cpu, comp_cpu = cfg_cpu.normalize_device_and_compute()
    assert dev_cpu == "cpu"
    assert comp_cpu == "int8"


def test_language_hint_mapping():
    assert STTEngine.map_language_hint("th-TH") == "th"
    assert STTEngine.map_language_hint("th") == "th"
    assert STTEngine.map_language_hint("en-US") == "en"
    assert STTEngine.map_language_hint("en") == "en"
    assert STTEngine.map_language_hint("auto") is None
    assert STTEngine.map_language_hint(None) is None


def test_vad_speech_start_and_silence_boundary():
    started = []
    ended = []

    tracker = UtteranceVADTracker(
        energy_threshold=500.0,
        silence_duration_sec=0.24,  # 3 frames of 0.08s
        frame_duration_sec=0.08,
        min_speech_duration_sec=0.1,
        on_speech_started=lambda: started.append(True),
        on_speech_ended=lambda: ended.append(True),
    )

    # 1. Feed silence frames (amplitude 50 < 500)
    silence = np.full(1280, 50, dtype=np.int16).tobytes()
    tracker.feed_frame(silence)
    assert tracker.state == VADState.IDLE
    assert len(started) == 0

    # 2. Feed voice frames (amplitude 3000 > 500)
    voice = np.full(1280, 3000, dtype=np.int16).tobytes()
    tracker.feed_frame(voice)
    assert tracker.state == VADState.SPEAKING
    assert len(started) == 1
    assert len(ended) == 0

    # 3. Feed silence frames to trigger EOU
    tracker.feed_frame(silence)  # 0.08s
    tracker.feed_frame(silence)  # 0.16s
    tracker.feed_frame(silence)  # 0.24s >= silence_duration_sec
    assert tracker.state == VADState.FINISHED
    assert len(ended) == 1

    # Audio bytes accumulated
    total_bytes = tracker.get_audio_bytes()
    assert len(total_bytes) == 5 * 1280 * 2


def test_vad_force_finish():
    ended = []
    tracker = UtteranceVADTracker(
        on_speech_ended=lambda: ended.append(True),
    )
    voice = np.full(1280, 3000, dtype=np.int16).tobytes()
    tracker.feed_frame(voice)
    assert tracker.state == VADState.SPEAKING

    tracker.force_finish()
    assert tracker.state == VADState.FINISHED
    assert len(ended) == 1


def test_server_protocol_commands(monkeypatch):
    cfg = STTConfig(model="large-v3-turbo")
    server = STTServer(cfg)

    # Mock engine.transcribe_pcm
    server.engine.transcribe_pcm = MagicMock(return_value={
        "text": "ทดสอบเสียง",
        "confidence": 0.98,
        "language": "th",
        "words": [{"text": "ทดสอบ", "startMs": 0, "endMs": 500, "confidence": 0.99}],
    })

    events = []

    def mock_emit(evt):
        events.append(evt)

    monkeypatch.setattr("mave_stt.server.emit_event", mock_emit)

    # 1. Start command
    server._handle_command({"action": "start", "requestId": "req-1", "language": "th"})
    assert any(e["type"] == "started" and e["requestId"] == "req-1" for e in events)

    # 2. Feed voice frame
    voice = np.full(1280, 2000, dtype=np.int16).tobytes()
    server.tracker.feed_frame(voice)
    assert any(e["type"] == "speech_started" for e in events)

    # 3. End command
    server._handle_command({"action": "end", "requestId": "req-1"})
    assert any(e["type"] == "final_transcript" and e["text"] == "ทดสอบเสียง" for e in events)

    # 4. Cancel command on new request
    server._handle_command({"action": "start", "requestId": "req-2"})
    server._handle_command({"action": "cancel", "requestId": "req-2", "reason": "user_cancelled"})
    assert any(e["type"] == "cancelled" and e["requestId"] == "req-2" for e in events)

    # 5. Health command
    server._handle_command({"action": "health"})
    assert any(e["type"] == "health" for e in events)

