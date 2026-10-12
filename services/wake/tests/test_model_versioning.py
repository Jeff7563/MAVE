"""Tests for model versioning and archive metadata."""

import json
from pathlib import Path
import pytest

from mave_wake.config import WakeConfig, get_model_metadata, list_available_models


def test_v1_archive_metadata_integrity():
    """Verify assets/wake/models/v1/metadata.json meets all specification requirements."""
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    meta_path = repo_root / "assets" / "wake" / "models" / "v1" / "metadata.json"
    assert meta_path.is_file(), f"Metadata missing at {meta_path}"

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    assert meta["version"] == "v1"
    assert meta["model_name"] == "mave"
    assert meta["threshold"] == 0.50
    assert meta["metrics"]["first_attempt_recall"] == "14/20"
    assert meta["metrics"]["ghost_wakes"] == 0
    assert meta["metrics"]["sleep_recovery"] == "20/20"
    assert meta["training"]["phrase"] == "Hey MAVE"
    assert meta["training"]["spelling"] == "hey maeve"
    assert "mave.onnx" in meta["files"]["sha256"]
    assert "mave.onnx.data" in meta["files"]["sha256"]
    assert len(meta["files"]["sha256"]["mave.onnx"]) == 64


def test_wake_config_versioned_model_resolution(tmp_path: Path):
    """Verify WakeConfig resolves versioned paths or defaults safely."""
    # Scenario 1: Default resolution without model_version
    cfg_default = WakeConfig()
    resolved = cfg_default.resolved_model_path(base_dir=tmp_path)
    assert resolved == (tmp_path / "assets" / "wake" / "mave.onnx").resolve()

    # Scenario 2: With existing versioned directory
    v1_dir = tmp_path / "assets" / "wake" / "models" / "v1"
    v1_dir.mkdir(parents=True, exist_ok=True)
    v1_onnx = v1_dir / "mave.onnx"
    v1_onnx.touch()

    cfg_v1 = WakeConfig(model_version="v1")
    resolved_v1 = cfg_v1.resolved_model_path(base_dir=tmp_path)
    assert resolved_v1 == v1_onnx.resolve()

    # Scenario 3: Nonexistent version falls back to model_path
    cfg_nonexistent = WakeConfig(model_version="v999")
    resolved_fallback = cfg_nonexistent.resolved_model_path(base_dir=tmp_path)
    assert resolved_fallback == (tmp_path / "assets" / "wake" / "mave.onnx").resolve()


def test_get_model_metadata_and_list_available_models(tmp_path: Path):
    """Verify metadata retrieval and version discovery."""
    v1_dir = tmp_path / "assets" / "wake" / "models" / "v1"
    v1_dir.mkdir(parents=True, exist_ok=True)
    (v1_dir / "mave.onnx").touch()
    meta_content = {"version": "v1", "threshold": 0.50}
    with open(v1_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta_content, f)

    meta = get_model_metadata("v1", base_dir=tmp_path)
    assert meta is not None
    assert meta["version"] == "v1"
    assert meta["threshold"] == 0.50

    models = list_available_models(base_dir=tmp_path)
    assert len(models) == 1
    assert models[0]["version"] == "v1"
    assert models[0]["available"] is True
    assert models[0]["metadata"]["version"] == "v1"

