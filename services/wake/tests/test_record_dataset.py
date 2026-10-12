"""Tests for MAVE dataset recording tool."""

import wave
from pathlib import Path
import numpy as np
import pytest

from tools.record_dataset import (
    CATEGORIES,
    NEAR_MISS_SUGGESTIONS,
    count_existing_clips,
    get_next_clip_filename,
    run_recording_session,
    save_wav_file,
)


def test_categories_and_targets_configuration():
    """Verify category schema, prefixes, and positive/negative partition."""
    expected_categories = [
        "positive/natural",
        "positive/fast",
        "positive/soft",
        "positive/far",
        "positive/difficult-ending",
        "negative/near-miss",
        "negative/normal-speech",
    ]
    for cat in expected_categories:
        assert cat in CATEGORIES
        meta = CATEGORIES[cat]
        assert "prefix" in meta
        assert "target" in meta
        assert "description" in meta
        assert "prompt" in meta

    assert len(NEAR_MISS_SUGGESTIONS) >= 8
    assert "Hey maybe" in NEAR_MISS_SUGGESTIONS
    assert "Hey Dave" in NEAR_MISS_SUGGESTIONS


def test_deterministic_file_naming(tmp_path: Path):
    """Verify get_next_clip_filename increments monotonically."""
    cat_dir = tmp_path / "positive" / "natural"
    prefix = "natural"

    f1 = get_next_clip_filename(cat_dir, prefix)
    assert f1.name == "natural_001.wav"
    f1.touch()

    f2 = get_next_clip_filename(cat_dir, prefix)
    assert f2.name == "natural_002.wav"
    f2.touch()

    f3 = get_next_clip_filename(cat_dir, prefix)
    assert f3.name == "natural_003.wav"


def test_deterministic_file_naming_with_gaps(tmp_path: Path):
    """Verify naming finds max existing index even if files are missing."""
    cat_dir = tmp_path / "positive" / "fast"
    (cat_dir / "fast_005.wav").parent.mkdir(parents=True, exist_ok=True)
    (cat_dir / "fast_005.wav").touch()

    f_next = get_next_clip_filename(cat_dir, "fast")
    assert f_next.name == "fast_006.wav"


def test_save_wav_file_format(tmp_path: Path):
    """Verify saved WAV file is strictly 16 kHz mono 16-bit PCM."""
    target_path = tmp_path / "test_clip.wav"
    sample_rate = 16000
    duration = 0.5  # 0.5 seconds = 8000 samples
    samples = int(duration * sample_rate)

    # Generate synthetic 440Hz tone as int16
    t = np.linspace(0, duration, samples, endpoint=False)
    raw_tone = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16)

    save_wav_file(target_path, raw_tone, sample_rate=sample_rate)
    assert target_path.is_file()

    with wave.open(str(target_path), "rb") as wf:
        assert wf.getnchannels() == 1  # Mono
        assert wf.getsampwidth() == 2  # 16-bit
        assert wf.getframerate() == 16000  # 16 kHz
        assert wf.getnframes() == samples

        read_bytes = wf.readframes(samples)
        recovered = np.frombuffer(read_bytes, dtype=np.int16)
        assert np.array_equal(recovered, raw_tone)


def test_count_existing_clips(tmp_path: Path):
    """Verify count_existing_clips counts WAV files per category correctly."""
    base_dir = tmp_path / "dataset"
    (base_dir / "positive" / "natural").mkdir(parents=True, exist_ok=True)
    (base_dir / "positive" / "fast").mkdir(parents=True, exist_ok=True)

    (base_dir / "positive" / "natural" / "natural_001.wav").touch()
    (base_dir / "positive" / "natural" / "natural_002.wav").touch()
    (base_dir / "positive" / "fast" / "fast_001.wav").touch()

    counts = count_existing_clips(base_dir)
    assert counts["positive/natural"] == 2
    assert counts["positive/fast"] == 1
    assert counts["positive/soft"] == 0
    assert counts["negative/near-miss"] == 0


def test_run_recording_session_mocked(tmp_path: Path):
    """Verify run_recording_session records and saves deterministic files."""
    base_dir = tmp_path / "dataset"

    def mock_recorder(num_samples: int, sample_rate: int, device_index: int) -> np.ndarray:
        return np.zeros(num_samples, dtype=np.int16)

    saved = run_recording_session(
        category="positive/soft",
        target_count=3,
        duration=0.1,  # Short duration for fast test
        base_dir=base_dir,
        countdown_seconds=0,
        interactive=False,
        recorder_fn=mock_recorder,
    )

    assert len(saved) == 3
    assert saved[0].name == "soft_001.wav"
    assert saved[1].name == "soft_002.wav"
    assert saved[2].name == "soft_003.wav"
    for s in saved:
        assert s.is_file()
