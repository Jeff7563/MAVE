import math
import struct
import wave
import pytest
import numpy as np
from unittest.mock import MagicMock
from mave_wake.config import WakeConfig
from mave_wake.engine import WakeEngine


def create_synthetic_wav(path, duration_seconds=0.25, sample_rate=16000, frequency=440.0):
    """Generate a clean synthetic 16-bit mono PCM WAV file fixture."""
    num_samples = int(duration_seconds * sample_rate)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(num_samples):
            # 440Hz sine wave scaled to int16
            val = int(32767.0 * 0.5 * math.sin(2.0 * math.pi * frequency * i / sample_rate))
            frames.extend(struct.pack("<h", val))
        wf.writeframes(frames)


def test_offline_wav_processing_with_synthetic_fixture(tmp_path):
    wav_path = tmp_path / "synthetic_fixture.wav"
    create_synthetic_wav(wav_path, duration_seconds=0.3, sample_rate=16000)

    config = WakeConfig(threshold=0.6, chunk_size=1280)
    engine = WakeEngine(config)

    # Mock openWakeWord model returning progressive scores
    call_count = 0

    def mock_predict(chunk):
        nonlocal call_count
        call_count += 1
        # Check chunk shape matches live microphone capture exactly
        assert isinstance(chunk, np.ndarray)
        assert len(chunk) == 1280
        # Second chunk crosses threshold (0.85)
        return {"mave": 0.3 if call_count == 1 else (0.85 if call_count == 2 else 0.1)}

    mock_model = MagicMock()
    mock_model.predict.side_effect = mock_predict
    engine.model = mock_model
    engine.is_loaded = True

    # Process WAV file through the live inference path
    result = engine.process_wav_file(str(wav_path))

    assert "error" not in result
    assert result["path"] == str(wav_path)
    assert result["frames_processed"] > 0
    assert result["wake_detected"] is True
    assert result["max_score"] == 0.85
    assert len(result["scores"]) == result["frames_processed"]
    assert result["scores"][1] == 0.85


def test_offline_wav_processing_below_threshold(tmp_path):
    wav_path = tmp_path / "synthetic_quiet.wav"
    create_synthetic_wav(wav_path, duration_seconds=0.1, sample_rate=16000)

    config = WakeConfig(threshold=0.8, chunk_size=1280)
    engine = WakeEngine(config)

    mock_model = MagicMock()
    mock_model.predict.return_value = {"mave": 0.25}
    engine.model = mock_model
    engine.is_loaded = True

    result = engine.process_wav_file(str(wav_path))

    assert "error" not in result
    assert result["wake_detected"] is False
    assert result["max_score"] == 0.25

