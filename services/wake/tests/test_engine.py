import pytest
import numpy as np
from pathlib import Path
from unittest.mock import MagicMock
from mave_wake.config import WakeConfig
from mave_wake.engine import WakeEngine


def test_engine_missing_model_returns_clean_error(tmp_path):
    config = WakeConfig(model_path="assets/wake/nonexistent.onnx")
    engine = WakeEngine(config, base_dir=tmp_path)

    success, error = engine.load_model()
    assert success is False
    assert engine.is_loaded is False
    assert error is not None
    assert "Model file missing" in error

    # Processing chunk when model is missing returns 0.0 safely
    chunk = np.zeros(1280, dtype=np.int16)
    score = engine.process_chunk(chunk)
    assert score == 0.0


def test_engine_processes_chunk_with_model():
    config = WakeConfig(model_name="mave")
    engine = WakeEngine(config)

    # Inject mock openWakeWord model
    mock_model = MagicMock()
    mock_model.predict.return_value = {"mave": 0.85}
    engine.model = mock_model
    engine.is_loaded = True

    chunk = np.zeros(1280, dtype=np.int16)
    score = engine.process_chunk(chunk)

    assert score == 0.85
    mock_model.predict.assert_called_once_with(chunk)


def test_engine_handles_model_prediction_exception():
    config = WakeConfig()
    engine = WakeEngine(config)

    mock_model = MagicMock()
    mock_model.predict.side_effect = RuntimeError("Inference session failure")
    engine.model = mock_model
    engine.is_loaded = True

    chunk = np.zeros(1280, dtype=np.int16)
    # Should catch error and return 0.0 instead of crashing
    score = engine.process_chunk(chunk)
    assert score == 0.0


def test_engine_process_wav_file_missing_file():
    config = WakeConfig()
    engine = WakeEngine(config)

    result = engine.process_wav_file("nonexistent.wav")
    assert result["wake_detected"] is False
    assert "error" in result
    assert "WAV file not found" in result["error"]

