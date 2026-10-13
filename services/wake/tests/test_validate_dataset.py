"""Tests for dataset validation tool (services/wake/tools/validate_dataset.py)."""

import json
import wave
from pathlib import Path
import numpy as np
import pytest

from tools.validate_dataset import (
    DEFAULT_MAX_DURATION,
    DEFAULT_MIN_DURATION,
    EXPECTED_CATEGORIES,
    inspect_wav_file,
    validate_dataset,
    format_validation_report,
)


def create_synthetic_wav(
    path: Path,
    sample_rate: int = 16000,
    channels: int = 1,
    sampwidth: int = 2,
    duration_seconds: float = 2.0,
    frequency: float = 440.0,
) -> Path:
    """Helper to create synthetic WAV files for testing."""
    path.parent.mkdir(parents=True, exist_ok=True)
    num_samples = int(sample_rate * duration_seconds)
    t = np.linspace(0, duration_seconds, num_samples, endpoint=False)
    # Sine wave
    waveform = np.sin(2 * np.pi * frequency * t)

    if sampwidth == 2:
        audio_data = (waveform * 32767).astype(np.int16)
        if channels == 2:
            audio_data = np.column_stack((audio_data, audio_data))
        raw_bytes = audio_data.tobytes()
    elif sampwidth == 1:
        # 8-bit unsigned PCM
        audio_data = ((waveform + 1.0) * 127.5).astype(np.uint8)
        raw_bytes = audio_data.tobytes()
    elif sampwidth == 3:
        # 24-bit PCM
        audio_int32 = (waveform * 8388607).astype(np.int32)
        raw_bytes = b"".join(int(val).to_bytes(3, byteorder="little", signed=True) for val in audio_int32)
    else:
        raise ValueError(f"Unsupported test sampwidth: {sampwidth}")

    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sampwidth)
        wf.setframerate(sample_rate)
        wf.writeframes(raw_bytes)

    return path


def test_inspect_wav_file_valid(tmp_path: Path):
    """Verify inspection of a perfectly formatted 16kHz mono 16-bit PCM WAV."""
    wav_path = tmp_path / "valid.wav"
    create_synthetic_wav(wav_path, sample_rate=16000, channels=1, sampwidth=2, duration_seconds=2.0)

    result = inspect_wav_file(wav_path, category="positive/natural")
    assert result.is_valid is True
    assert result.sample_rate == 16000
    assert result.channels == 1
    assert result.sampwidth == 2
    assert abs(result.duration_seconds - 2.0) < 0.01
    assert len(result.errors) == 0
    assert result.sha256 is not None


def test_inspect_wav_file_corrupt_and_zero_byte(tmp_path: Path):
    """Verify handling of zero-byte and corrupt audio files."""
    # 1. Zero-byte file
    empty_file = tmp_path / "empty.wav"
    empty_file.touch()

    res_empty = inspect_wav_file(empty_file, category="positive/natural")
    assert res_empty.is_valid is False
    assert any("Zero-byte" in e for e in res_empty.errors)

    # 2. Corrupt header file
    corrupt_file = tmp_path / "corrupt.wav"
    with open(corrupt_file, "wb") as f:
        f.write(b"RIFF\x00\x00\x00\x00NOT_WAVE_HEADER")

    res_corrupt = inspect_wav_file(corrupt_file, category="positive/natural")
    assert res_corrupt.is_valid is False
    assert any("Corrupt or invalid WAV" in e for e in res_corrupt.errors)


def test_inspect_wav_file_invalid_audio_specs(tmp_path: Path):
    """Verify rejection of non-16kHz, non-mono, or non-16-bit files."""
    # 1. Wrong sample rate (44.1 kHz)
    bad_sr = tmp_path / "bad_sr.wav"
    create_synthetic_wav(bad_sr, sample_rate=44100, channels=1, sampwidth=2, duration_seconds=1.0)
    res_sr = inspect_wav_file(bad_sr, category="positive/fast")
    assert res_sr.is_valid is False
    assert any("Invalid sample rate: 44100" in e for e in res_sr.errors)

    # 2. Stereo (2 channels)
    stereo = tmp_path / "stereo.wav"
    create_synthetic_wav(stereo, sample_rate=16000, channels=2, sampwidth=2, duration_seconds=1.0)
    res_stereo = inspect_wav_file(stereo, category="positive/fast")
    assert res_stereo.is_valid is False
    assert any("Invalid channels: 2" in e for e in res_stereo.errors)

    # 3. 8-bit depth (sampwidth = 1)
    bit8 = tmp_path / "8bit.wav"
    create_synthetic_wav(bit8, sample_rate=16000, channels=1, sampwidth=1, duration_seconds=1.0)
    res_8bit = inspect_wav_file(bit8, category="positive/fast")
    assert res_8bit.is_valid is False
    assert any("Invalid bit depth: 8-bit" in e for e in res_8bit.errors)


def test_inspect_wav_file_duration_bounds(tmp_path: Path):
    """Verify validation of clip duration boundaries."""
    # 1. Too short (< 0.5s)
    short_file = tmp_path / "short.wav"
    create_synthetic_wav(short_file, duration_seconds=0.3)
    res_short = inspect_wav_file(short_file, category="positive/soft", min_duration=0.5)
    assert res_short.is_valid is False
    assert any("Duration too short" in e for e in res_short.errors)

    # 2. Too long (> 5.0s)
    long_file = tmp_path / "long.wav"
    create_synthetic_wav(long_file, duration_seconds=6.0)
    res_long = inspect_wav_file(long_file, category="positive/soft", max_duration=5.0)
    assert res_long.is_valid is False
    assert any("Duration too long" in e for e in res_long.errors)


def test_validate_dataset_full_structure(tmp_path: Path):
    """Verify full dataset scan across positive and negative categories."""
    dataset_dir = tmp_path / "dataset"
    for cat in EXPECTED_CATEGORIES:
        for idx in range(1, 3):
            file_path = dataset_dir / cat / f"clip_{idx:03d}.wav"
            create_synthetic_wav(file_path, sample_rate=16000, channels=1, sampwidth=2, duration_seconds=1.5)

    report = validate_dataset(dataset_dir)
    assert report.is_valid is True
    assert report.total_files == len(EXPECTED_CATEGORIES) * 2
    assert report.valid_files == report.total_files
    assert report.invalid_files == 0
    assert len(report.missing_categories) == 0
    assert report.total_positive_clips == 5 * 2  # 5 positive categories * 2
    assert report.total_negative_clips == 2 * 2  # 2 negative categories * 2


def test_validate_dataset_missing_and_empty_categories(tmp_path: Path):
    """Verify detection of missing and empty category folders."""
    dataset_dir = tmp_path / "dataset"
    # Only create one category folder
    natural_dir = dataset_dir / "positive" / "natural"
    natural_dir.mkdir(parents=True)
    create_synthetic_wav(natural_dir / "natural_001.wav", duration_seconds=2.0)

    report = validate_dataset(dataset_dir)
    assert report.is_valid is True  # Non-strict mode permits partial collection
    assert len(report.missing_categories) == len(EXPECTED_CATEGORIES) - 1
    assert "positive/fast" in report.missing_categories
    assert "negative/near-miss" in report.missing_categories
    assert report.categories["positive/natural"].found == 1
    assert report.categories["positive/natural"].status == "INCOMPLETE"


def test_validate_dataset_duplicate_detection(tmp_path: Path):
    """Verify duplicate filename and identical audio hash detection."""
    dataset_dir = tmp_path / "dataset"
    file1 = dataset_dir / "positive" / "natural" / "dup_name.wav"
    file2 = dataset_dir / "positive" / "fast" / "dup_name.wav"

    # Same content and same name in different folders
    create_synthetic_wav(file1, duration_seconds=1.5)
    create_synthetic_wav(file2, duration_seconds=1.5)

    report = validate_dataset(dataset_dir)
    assert "dup_name.wav" in report.duplicate_filenames
    assert len(report.duplicate_audio_hashes) >= 1
    assert any("Found 1 duplicate filename" in w for w in report.warnings)


def test_validate_dataset_strict_mode(tmp_path: Path):
    """Verify strict mode fails when target clip counts are incomplete."""
    dataset_dir = tmp_path / "dataset"
    natural_dir = dataset_dir / "positive" / "natural"
    create_synthetic_wav(natural_dir / "natural_001.wav", duration_seconds=2.0)

    # Non-strict mode passes valid clips
    report_lenient = validate_dataset(dataset_dir, strict_targets=False)
    assert report_lenient.is_valid is True
    assert report_lenient.strict_met is False

    # Strict mode fails because 1 < 30 target
    report_strict = validate_dataset(dataset_dir, strict_targets=True)
    assert report_strict.is_valid is False
    assert report_strict.strict_met is False
    assert any("Strict target gate failed" in e for e in report_strict.errors)


def test_validate_dataset_nonexistent_directory(tmp_path: Path):
    """Verify safe handling of nonexistent dataset path."""
    missing_dir = tmp_path / "does_not_exist"
    report = validate_dataset(missing_dir)
    assert report.is_valid is False
    assert any("does not exist" in e for e in report.errors)


def test_format_validation_report_output(tmp_path: Path):
    """Verify human-readable report formatting produces complete summary text."""
    dataset_dir = tmp_path / "dataset"
    create_synthetic_wav(dataset_dir / "positive" / "natural" / "clip_001.wav", duration_seconds=2.0)

    report = validate_dataset(dataset_dir)
    text = format_validation_report(report)

    assert "MAVE Wake Dataset Validation Report" in text
    assert "Category Breakdown" in text
    assert "positive/natural" in text
    assert "positive/fast" in text
