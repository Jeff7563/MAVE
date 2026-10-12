"""Tests for MAVE model benchmark evaluation tool."""

import json
from pathlib import Path
from typing import Any, Dict
import numpy as np
import pytest

from tools.benchmark_model import (
    compute_summary_stats,
    evaluate_dataset,
    format_text_report,
    get_score_distribution,
)
from tools.record_dataset import save_wav_file


class FakeBenchmarkEngine:
    """Mock engine that mimics WakeEngine for testing benchmark evaluations."""

    def __init__(self, score_mapping: Dict[str, float]):
        self.score_mapping = score_mapping
        self.is_loaded = True

    def load_model(self):
        return True, None

    def process_wav_file(self, wav_path: str, threshold: float = 0.50) -> Dict[str, Any]:
        p = Path(wav_path)
        if not p.is_file():
            return {
                "path": wav_path,
                "max_score": 0.0,
                "wake_detected": False,
                "frames_processed": 0,
                "error": "File not found",
            }

        # Check for intentionally corrupt test file
        if "corrupt" in p.name:
            return {
                "path": wav_path,
                "max_score": 0.0,
                "wake_detected": False,
                "frames_processed": 0,
                "error": "Unsupported sample width",
            }

        score = self.score_mapping.get(p.name, 0.0)
        return {
            "path": wav_path,
            "max_score": score,
            "wake_detected": score >= threshold,
            "frames_processed": 10,
            "scores": [score],
        }


def test_compute_summary_stats():
    """Verify statistics calculation on score lists."""
    empty = compute_summary_stats([])
    assert empty["count"] == 0
    assert empty["avg"] == 0.0
    assert empty["median"] == 0.0

    scores = [0.2, 0.4, 0.6, 0.8]
    stats = compute_summary_stats(scores)
    assert stats["count"] == 4
    assert stats["avg"] == 0.5
    assert stats["median"] == 0.5
    assert stats["min"] == 0.2
    assert stats["max"] == 0.8


def test_get_score_distribution():
    """Verify 10-bin histogram generation."""
    scores = [0.05, 0.15, 0.42, 0.78, 0.95, 1.0]
    bins = get_score_distribution(scores, num_bins=10)
    assert len(bins) == 10
    assert bins["0.0-0.1"] == 1
    assert bins["0.1-0.2"] == 1
    assert bins["0.4-0.5"] == 1
    assert bins["0.7-0.8"] == 1
    assert bins["0.9-1.0"] == 2


def test_evaluate_dataset_aggregation_and_json_schema(tmp_path: Path):
    """Verify full dataset evaluation, metric aggregation, and JSON schema."""
    dataset_dir = tmp_path / "dataset"
    pos_nat = dataset_dir / "positive" / "natural"
    pos_fast = dataset_dir / "positive" / "fast"
    neg_near = dataset_dir / "negative" / "near-miss"

    # Create dummy WAV files
    dummy_audio = np.zeros(1600, dtype=np.int16)
    save_wav_file(pos_nat / "natural_001.wav", dummy_audio)
    save_wav_file(pos_nat / "natural_002.wav", dummy_audio)
    save_wav_file(pos_fast / "fast_001.wav", dummy_audio)
    save_wav_file(neg_near / "near_miss_001.wav", dummy_audio)
    save_wav_file(neg_near / "near_miss_002.wav", dummy_audio)

    # Set mock scores:
    # natural_001: 0.65 (detected)
    # natural_002: 0.35 (missed)
    # fast_001: 0.70 (detected)
    # near_miss_001: 0.10 (correct rejection)
    # near_miss_002: 0.05 (correct rejection)
    fake_engine = FakeBenchmarkEngine(
        score_mapping={
            "natural_001.wav": 0.65,
            "natural_002.wav": 0.35,
            "fast_001.wav": 0.70,
            "near_miss_001.wav": 0.10,
            "near_miss_002.wav": 0.05,
        }
    )

    results = evaluate_dataset(
        dataset_dir=dataset_dir,
        model_path=tmp_path / "model.onnx",
        threshold=0.50,
        engine=fake_engine,
    )

    # Verify overall schema
    assert results["total_clips"] == 5
    assert results["threshold"] == 0.50

    # Positive summary: 3 positive clips, 2 detected (0.65, 0.70)
    pos = results["positive"]
    assert pos["total"] == 3
    assert pos["detected"] == 2
    assert pos["recall"] == pytest.approx(2 / 3, 0.01)
    assert pos["recall_pct"] == pytest.approx(66.7, 0.1)

    # Negative summary: 2 negative clips, 0 false activations
    neg = results["negative"]
    assert neg["total"] == 2
    assert neg["false_activations"] == 0
    assert neg["false_positive_rate"] == 0.0

    # Category breakdown
    cats = results["by_category"]
    assert "positive/natural" in cats
    assert cats["positive/natural"]["total"] == 2
    assert cats["positive/natural"]["detected"] == 1
    assert "positive/fast" in cats
    assert cats["positive/fast"]["total"] == 1
    assert cats["positive/fast"]["detected"] == 1
    assert "negative/near-miss" in cats
    assert cats["negative/near-miss"]["false_activations"] == 0

    # Ensure results can be JSON-serialized without error
    json_str = json.dumps(results, indent=2)
    assert len(json_str) > 100

    # Verify text report generation
    report = format_text_report(results)
    assert "MAVE Wake Model Benchmark Report" in report
    assert "Positive Recall Summary" in report


def test_missing_and_corrupt_wav_handling(tmp_path: Path):
    """Verify benchmark handles corrupt or missing audio files without crashing."""
    dataset_dir = tmp_path / "dataset"
    pos_dir = dataset_dir / "positive" / "natural"
    pos_dir.mkdir(parents=True, exist_ok=True)

    # Valid clip
    save_wav_file(pos_dir / "natural_001.wav", np.zeros(1600, dtype=np.int16))

    # Corrupt clip (raw invalid text)
    corrupt_file = pos_dir / "corrupt_002.wav"
    corrupt_file.write_text("NOT_A_VALID_WAV_HEADER")

    fake_engine = FakeBenchmarkEngine(score_mapping={"natural_001.wav": 0.80})

    results = evaluate_dataset(
        dataset_dir=dataset_dir,
        model_path=tmp_path / "model.onnx",
        threshold=0.50,
        engine=fake_engine,
    )

    assert results["total_clips"] == 2
    corrupt_entry = next(c for c in results["clips"] if "corrupt" in c["path"])
    assert corrupt_entry["error"] is not None
    assert corrupt_entry["detected"] is False
