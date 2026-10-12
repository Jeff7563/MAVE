import time
import numpy as np
import pytest
from unittest.mock import MagicMock, patch
from mave_wake.config import WakeConfig
from mave_wake.engine import WakeEngine
from mave_wake.audio import AudioCapture
from mave_wake.main import WakeService


def test_wake_service_resets_engine_on_lifecycle_boundaries():
    """Verify WakeEngine.reset() is called at the correct lifecycle boundaries:
    - on start_listening()
    - on stop_listening()
    - immediately after a wake detection in _on_audio_chunk()
    """
    config = WakeConfig(threshold=0.5, rearm_guard_ms=0.0)
    service = WakeService(config)

    # Mock engine model and reset
    mock_engine = MagicMock(spec=WakeEngine)
    mock_engine.is_loaded = True
    service.engine = mock_engine

    # Mock audio start/stop to avoid hardware interaction
    service.audio.start = MagicMock(return_value=(True, None))
    service.audio.stop = MagicMock()

    # 1. start_listening resets engine
    service.start_listening()
    assert mock_engine.reset.call_count == 1
    assert service.status == "listening"

    # 2. wake detection triggers reset immediately
    mock_engine.process_chunk.return_value = 0.85
    chunk = np.zeros(1280, dtype=np.int16)
    with patch("mave_wake.main.emit_wake_detected") as mock_emit:
        service._on_audio_chunk(chunk)
        assert mock_emit.call_count == 1
        # reset should have been called again after wake detected
        assert mock_engine.reset.call_count == 2
        assert service.last_wake_score == 0.85

    # 3. stop_listening resets engine
    service.stop_listening()
    assert mock_engine.reset.call_count == 3
    assert service.status == "ready"


def test_rearm_guard_suppresses_immediate_wake_after_start():
    """Verify that during the re-arm guard window right after start_listening(),
    detections are suppressed even if audio chunks return high scores."""
    config = WakeConfig(threshold=0.5, rearm_guard_ms=300.0)
    service = WakeService(config)

    mock_engine = MagicMock(spec=WakeEngine)
    mock_engine.is_loaded = True
    mock_engine.process_chunk.return_value = 0.95
    service.engine = mock_engine
    service.audio.start = MagicMock(return_value=(True, None))
    service.audio.stop = MagicMock()

    service.start_listening()
    chunk = np.zeros(1280, dtype=np.int16)

    with patch("mave_wake.main.emit_wake_detected") as mock_emit:
        # Immediately send chunk while in rearm window
        service._on_audio_chunk(chunk)
        # Should NOT emit wake detected because rearm guard is active
        assert mock_emit.call_count == 0

        # Fast forward past rearm guard
        service._rearm_until = time.time() - 0.01
        service._on_audio_chunk(chunk)
        # Now it should emit wake detected
        assert mock_emit.call_count == 1


def test_no_duplicate_wake_from_single_utterance():
    """Verify that one wake trigger cannot immediately re-trigger within cooldown
    and that reset wipes the inference state."""
    config = WakeConfig(threshold=0.5, cooldown_seconds=1.0, rearm_guard_ms=0.0)
    service = WakeService(config)

    mock_engine = MagicMock(spec=WakeEngine)
    mock_engine.is_loaded = True
    service.engine = mock_engine
    service.audio.start = MagicMock(return_value=(True, None))

    service.start_listening()
    service._rearm_until = 0.0

    mock_engine.process_chunk.return_value = 0.90
    chunk = np.zeros(1280, dtype=np.int16)

    with patch("mave_wake.main.emit_wake_detected") as mock_emit:
        # First chunk triggers detection
        service._on_audio_chunk(chunk)
        assert mock_emit.call_count == 1

        # Second chunk arriving 50ms later with same phrase cannot trigger duplicate
        service._on_audio_chunk(chunk)
        assert mock_emit.call_count == 1


def test_wake_service_start_stop_idempotency():
    """Verify start_listening and stop_listening can be called repeatedly without errors or duplicate streams."""
    config = WakeConfig()
    service = WakeService(config)

    service.engine.load_model = MagicMock(return_value=(True, None))
    service.engine.is_loaded = True
    service.engine.reset = MagicMock()
    service.audio.start = MagicMock(return_value=(True, None))
    service.audio.stop = MagicMock()

    # First start
    service.start_listening()
    assert service.status == "listening"
    assert service.audio.start.call_count == 1

    # Second start while recording is idempotent
    service.audio.is_recording = True
    service.start_listening()
    assert service.audio.start.call_count == 1

    # First stop
    service.stop_listening()
    assert service.status == "ready"
    assert service.audio.stop.call_count == 1

    # Second stop while not recording is idempotent
    service.audio.is_recording = False
    service.stop_listening()
    assert service.audio.stop.call_count == 1


def test_audio_capture_drain_and_discard():
    """Verify audio capture queue is drained and initial chunks are discarded on start."""
    received = []
    capture = AudioCapture(chunk_size=1280, discard_initial_chunks=2, on_chunk=lambda c: received.append(c))

    # Fill queue with 5 dummy chunks
    for i in range(5):
        capture._queue.put(np.ones(1280, dtype=np.int16) * i)

    # drain_queue should discard all 5
    dropped = capture.drain_queue()
    assert dropped == 5
    assert capture._queue.empty()


def test_telemetry_sliding_window_peak_calculation():
    """Verify peak score tracking over sliding window."""
    config = WakeConfig(rearm_guard_ms=0.0)
    service = WakeService(config)

    now = time.time()
    # Add score 0.35 at t=0
    s1, p1 = service._update_scores(0.35, now)
    assert s1 == 0.35
    assert p1 == 0.35

    # Add score 0.48 at t=1
    s2, p2 = service._update_scores(0.48, now + 1.0)
    assert s2 == 0.48
    assert p2 == 0.48

    # Add lower score 0.10 at t=2 -> peak remains 0.48
    s3, p3 = service._update_scores(0.10, now + 2.0)
    assert s3 == 0.10
    assert p3 == 0.48

    # After 5 seconds, older scores expire -> peak drops to 0.15
    s4, p4 = service._update_scores(0.15, now + 5.5)
    assert s4 == 0.15
    assert p4 == 0.15
