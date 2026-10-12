import pytest
from pathlib import Path
from mave_wake.config import WakeConfig


def test_config_defaults():
    config = WakeConfig()
    assert config.model_path == "assets/wake/mave.onnx"
    assert config.threshold == 0.5
    assert config.device_index is None
    assert config.chunk_size == 1280
    assert config.sample_rate == 16000


def test_config_clamping():
    # Below 0.0 clamps to 0.0
    c1 = WakeConfig(threshold=-0.5)
    assert c1.threshold == 0.0

    # Above 1.0 clamps to 1.0
    c2 = WakeConfig(threshold=1.5)
    assert c2.threshold == 1.0

    # Negative device_index normalizes to None
    c3 = WakeConfig(device_index=-1)
    assert c3.device_index is None


def test_config_path_resolution(tmp_path):
    config = WakeConfig(model_path="models/test.onnx")
    resolved = config.resolved_model_path(base_dir=tmp_path)
    assert resolved == (tmp_path / "models" / "test.onnx").resolve()
    assert not config.is_model_available(base_dir=tmp_path)

    # Create dummy file
    (tmp_path / "models").mkdir(parents=True)
    test_file = tmp_path / "models" / "test.onnx"
    test_file.write_text("dummy")
    assert config.is_model_available(base_dir=tmp_path)

