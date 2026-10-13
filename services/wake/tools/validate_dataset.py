"""Validation tool for MAVE wake word audio datasets.

Verifies that recorded audio clips adhere strictly to the openWakeWord training requirements:
- Expected category folder structure
- WAV format readability
- 16,000 Hz sample rate
- Mono (1 channel)
- 16-bit PCM bit depth
- Duration within acceptable range
- Zero-byte / corrupt file detection
- Duplicate filename and audio content detection
- Clip count tally vs target goals per category
"""

import argparse
import hashlib
import json
import os
import sys
import wave
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# Canonical categories and targets for MAVE V2 dataset
EXPECTED_CATEGORIES: Dict[str, Dict[str, Any]] = {
    "positive/natural": {
        "target": 30,
        "prefix": "natural",
        "description": "Natural conversational volume, normal speed, ~1 ft from mic",
    },
    "positive/fast": {
        "target": 10,
        "prefix": "fast",
        "description": "Fast / brisk cadence without pause between words",
    },
    "positive/soft": {
        "target": 10,
        "prefix": "soft",
        "description": "Soft / quiet voice or relaxed morning tone",
    },
    "positive/far": {
        "target": 10,
        "prefix": "far",
        "description": "Across the desk or room (2-3 meters away)",
    },
    "positive/difficult-ending": {
        "target": 10,
        "prefix": "difficult_ending",
        "description": "Natural softer/unvoiced/reduced ending on final consonant",
    },
    "negative/near-miss": {
        "target": 20,
        "prefix": "near_miss",
        "description": "Phonetically similar near-miss phrases (must NOT wake)",
    },
    "negative/normal-speech": {
        "target": 20,
        "prefix": "normal_speech",
        "description": "Everyday background speech or ambient conversation",
    },
}

REQUIRED_SAMPLE_RATE = 16000
REQUIRED_CHANNELS = 1
REQUIRED_SAMPWIDTH = 2  # 16-bit PCM = 2 bytes per sample
DEFAULT_MIN_DURATION = 0.5  # seconds
DEFAULT_MAX_DURATION = 5.0  # seconds


@dataclass
class ClipValidationResult:
    """Validation report for a single audio file."""

    path: str
    category: str
    is_valid: bool
    size_bytes: int = 0
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    sampwidth: Optional[int] = None
    duration_seconds: Optional[float] = None
    sha256: Optional[str] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class CategorySummary:
    """Summary metrics for a specific category folder."""

    category: str
    target: int
    found: int
    valid: int
    invalid: int
    missing_folder: bool = False
    status: str = "PENDING"  # MET, INCOMPLETE, EMPTY, MISSING


@dataclass
class DatasetValidationReport:
    """Overall dataset validation result."""

    dataset_dir: str
    is_valid: bool
    strict_met: bool
    total_files: int
    valid_files: int
    invalid_files: int
    total_positive_clips: int
    total_negative_clips: int
    target_positive_clips: int
    target_negative_clips: int
    missing_categories: List[str]
    duplicate_filenames: List[str]
    duplicate_audio_hashes: Dict[str, List[str]]
    unrecognized_categories: List[str]
    categories: Dict[str, CategorySummary]
    errors: List[str]
    warnings: List[str]
    clips: List[ClipValidationResult] = field(default_factory=list)


def compute_file_sha256(path: Path) -> str:
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def inspect_wav_file(
    file_path: Path,
    category: str,
    min_duration: float = DEFAULT_MIN_DURATION,
    max_duration: float = DEFAULT_MAX_DURATION,
) -> ClipValidationResult:
    """Inspect and validate a single WAV file against 16kHz mono 16-bit PCM specs."""
    rel_path = str(file_path.as_posix())
    errors: List[str] = []
    warnings: List[str] = []

    # 1. Existence and size
    if not file_path.is_file():
        return ClipValidationResult(
            path=rel_path,
            category=category,
            is_valid=False,
            errors=["File does not exist"],
        )

    size = file_path.stat().st_size
    if size == 0:
        return ClipValidationResult(
            path=rel_path,
            category=category,
            is_valid=False,
            size_bytes=0,
            errors=["Zero-byte file (empty)"],
        )

    file_hash = compute_file_sha256(file_path)

    # 2. WAV readability via wave module
    try:
        with wave.open(str(file_path), "rb") as wf:
            channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            sample_rate = wf.getframerate()
            n_frames = wf.getnframes()
            duration = n_frames / sample_rate if sample_rate > 0 else 0.0

            # Verify uncompressed PCM (format tag 1)
            # In standard wave module, opening succeeds only for PCM unless extra chunk
            try:
                # Read frames to test data integrity
                _ = wf.readframes(min(n_frames, 1024))
            except Exception as read_err:
                errors.append(f"Corrupt WAV data payload: {read_err}")

    except wave.Error as wave_err:
        return ClipValidationResult(
            path=rel_path,
            category=category,
            is_valid=False,
            size_bytes=size,
            sha256=file_hash,
            errors=[f"Corrupt or invalid WAV header: {wave_err}"],
        )
    except Exception as exc:
        return ClipValidationResult(
            path=rel_path,
            category=category,
            is_valid=False,
            size_bytes=size,
            sha256=file_hash,
            errors=[f"Cannot read audio file: {exc}"],
        )

    # 3. Check audio specifications
    if sample_rate != REQUIRED_SAMPLE_RATE:
        errors.append(
            f"Invalid sample rate: {sample_rate} Hz (expected {REQUIRED_SAMPLE_RATE} Hz)"
        )

    if channels != REQUIRED_CHANNELS:
        errors.append(
            f"Invalid channels: {channels} (expected {REQUIRED_CHANNELS} mono)"
        )

    if sampwidth != REQUIRED_SAMPWIDTH:
        bits = sampwidth * 8
        errors.append(
            f"Invalid bit depth: {bits}-bit (expected {REQUIRED_SAMPWIDTH * 8}-bit PCM)"
        )

    # 4. Check duration
    if duration < min_duration:
        errors.append(
            f"Duration too short: {duration:.2f}s (< {min_duration:.1f}s minimum)"
        )
    elif duration > max_duration:
        errors.append(
            f"Duration too long: {duration:.2f}s (> {max_duration:.1f}s maximum)"
        )

    # Mild warnings for unusually short/long wake clips
    if 0.5 <= duration < 0.8:
        warnings.append(f"Short utterance ({duration:.2f}s); ensure wake phrase is complete")
    elif 3.5 < duration <= max_duration:
        warnings.append(f"Long utterance ({duration:.2f}s); check for excessive silence")

    return ClipValidationResult(
        path=rel_path,
        category=category,
        is_valid=(len(errors) == 0),
        size_bytes=size,
        sample_rate=sample_rate,
        channels=channels,
        sampwidth=sampwidth,
        duration_seconds=round(duration, 3),
        sha256=file_hash,
        errors=errors,
        warnings=warnings,
    )


def validate_dataset(
    dataset_dir: Path,
    expected_categories: Optional[Dict[str, Dict[str, Any]]] = None,
    min_duration: float = DEFAULT_MIN_DURATION,
    max_duration: float = DEFAULT_MAX_DURATION,
    strict_targets: bool = False,
) -> DatasetValidationReport:
    """Audit and validate an entire wake word dataset directory."""
    if expected_categories is None:
        expected_categories = EXPECTED_CATEGORIES

    dataset_path = Path(dataset_dir)
    errors: List[str] = []
    warnings: List[str] = []

    if not dataset_path.exists():
        return DatasetValidationReport(
            dataset_dir=str(dataset_path.as_posix()),
            is_valid=False,
            strict_met=False,
            total_files=0,
            valid_files=0,
            invalid_files=0,
            total_positive_clips=0,
            total_negative_clips=0,
            target_positive_clips=sum(
                c["target"] for k, c in expected_categories.items() if k.startswith("positive")
            ),
            target_negative_clips=sum(
                c["target"] for k, c in expected_categories.items() if k.startswith("negative")
            ),
            missing_categories=list(expected_categories.keys()),
            duplicate_filenames=[],
            duplicate_audio_hashes={},
            unrecognized_categories=[],
            categories={},
            errors=[f"Dataset directory does not exist: {dataset_path}"],
            warnings=[],
            clips=[],
        )

    # 1. Discover all WAV files
    wav_files = sorted(dataset_path.glob("**/*.wav"))
    all_clips: List[ClipValidationResult] = []

    # Map files by category
    category_clips: Dict[str, List[ClipValidationResult]] = {cat: [] for cat in expected_categories}
    unrecognized_categories: Set[str] = set()

    # Track duplicate filenames and hashes
    filename_map: Dict[str, List[str]] = {}
    hash_map: Dict[str, List[str]] = {}

    for wav_file in wav_files:
        rel = wav_file.relative_to(dataset_path).as_posix()
        parts = rel.split("/")

        # Deduce category from folder structure
        if len(parts) >= 3:
            cat = f"{parts[0]}/{parts[1]}"
        elif len(parts) == 2:
            cat = parts[0]
        else:
            cat = "root"

        clip_res = inspect_wav_file(
            wav_file,
            category=cat,
            min_duration=min_duration,
            max_duration=max_duration,
        )
        all_clips.append(clip_res)

        # Categorize
        if cat in category_clips:
            category_clips[cat].append(clip_res)
        else:
            unrecognized_categories.add(cat)

        # Duplicate filename tracking
        fname = wav_file.name
        filename_map.setdefault(fname, []).append(rel)

        # Duplicate audio hash tracking
        if clip_res.sha256:
            hash_map.setdefault(clip_res.sha256, []).append(rel)

    # 2. Duplicate detection
    duplicate_filenames = [
        fname for fname, paths in filename_map.items() if len(paths) > 1
    ]
    duplicate_audio_hashes = {
        h: paths for h, paths in hash_map.items() if len(paths) > 1
    }

    if duplicate_filenames:
        warnings.append(
            f"Found {len(duplicate_filenames)} duplicate filename(s) across folders: {duplicate_filenames}"
        )

    if duplicate_audio_hashes:
        warnings.append(
            f"Found {len(duplicate_audio_hashes)} duplicate audio file content(s) with identical SHA-256"
        )

    # 3. Check expected category folders and tallies
    missing_categories: List[str] = []
    category_summaries: Dict[str, CategorySummary] = {}

    total_pos_found = 0
    total_pos_valid = 0
    total_neg_found = 0
    total_neg_valid = 0

    target_pos = sum(
        c["target"] for k, c in expected_categories.items() if k.startswith("positive")
    )
    target_neg = sum(
        c["target"] for k, c in expected_categories.items() if k.startswith("negative")
    )

    for cat_name, meta in expected_categories.items():
        cat_dir = dataset_path / cat_name
        is_missing_dir = not cat_dir.is_dir()
        if is_missing_dir:
            missing_categories.append(cat_name)

        clips_in_cat = category_clips.get(cat_name, [])
        found_count = len(clips_in_cat)
        valid_count = sum(1 for c in clips_in_cat if c.is_valid)
        invalid_count = found_count - valid_count
        tgt = meta["target"]

        if is_missing_dir:
            status = "MISSING"
        elif found_count == 0:
            status = "EMPTY"
        elif valid_count >= tgt:
            status = "MET"
        else:
            status = "INCOMPLETE"

        summary = CategorySummary(
            category=cat_name,
            target=tgt,
            found=found_count,
            valid=valid_count,
            invalid=invalid_count,
            missing_folder=is_missing_dir,
            status=status,
        )
        category_summaries[cat_name] = summary

        if cat_name.startswith("positive"):
            total_pos_found += found_count
            total_pos_valid += valid_count
        else:
            total_neg_found += found_count
            total_neg_valid += valid_count

    # 4. Global validity calculations
    total_files = len(all_clips)
    valid_files = sum(1 for c in all_clips if c.is_valid)
    invalid_files = total_files - valid_files

    if invalid_files > 0:
        errors.append(f"{invalid_files} audio clip(s) failed WAV format validation")

    if missing_categories:
        warnings.append(
            f"Missing {len(missing_categories)} category folder(s): {missing_categories}"
        )

    if unrecognized_categories:
        warnings.append(
            f"Found clips in unrecognized folder(s): {sorted(list(unrecognized_categories))}"
        )

    # Strict target check: every category must meet its target and have 0 invalid files
    strict_met = (
        invalid_files == 0
        and len(missing_categories) == 0
        and all(s.status == "MET" for s in category_summaries.values())
    )

    if strict_targets and not strict_met:
        errors.append(
            f"Strict target gate failed: Positive clips {total_pos_valid}/{target_pos}, "
            f"Negative clips {total_neg_valid}/{target_neg}"
        )

    # Basic validity: dataset has files and no corrupted/invalid audio files
    is_valid = (total_files > 0 and invalid_files == 0) if not strict_targets else strict_met

    return DatasetValidationReport(
        dataset_dir=str(dataset_path.as_posix()),
        is_valid=is_valid,
        strict_met=strict_met,
        total_files=total_files,
        valid_files=valid_files,
        invalid_files=invalid_files,
        total_positive_clips=total_pos_valid,
        total_negative_clips=total_neg_valid,
        target_positive_clips=target_pos,
        target_negative_clips=target_neg,
        missing_categories=missing_categories,
        duplicate_filenames=duplicate_filenames,
        duplicate_audio_hashes=duplicate_audio_hashes,
        unrecognized_categories=sorted(list(unrecognized_categories)),
        categories=category_summaries,
        errors=errors,
        warnings=warnings,
        clips=all_clips,
    )


def format_validation_report(report: DatasetValidationReport) -> str:
    """Format validation result as a human-readable CLI summary."""
    lines: List[str] = []
    lines.append("=" * 72)
    lines.append("           MAVE Wake Dataset Validation Report")
    lines.append("=" * 72)
    lines.append(f"Dataset Directory : {report.dataset_dir}")
    lines.append(f"Total Files Found : {report.total_files}")
    lines.append(f"Format Valid Clips: {report.valid_files}")
    lines.append(f"Invalid / Corrupt : {report.invalid_files}")
    lines.append(
        f"Positive Progress : {report.total_positive_clips}/{report.target_positive_clips} clips"
    )
    lines.append(
        f"Negative Progress : {report.total_negative_clips}/{report.target_negative_clips} clips"
    )
    lines.append(f"Strict Target Met : {'YES' if report.strict_met else 'NO'}")
    status_str = "PASS" if report.is_valid else "FAIL"
    lines.append(f"Overall Status    : {status_str}")
    lines.append("-" * 72)

    lines.append("\n[Category Breakdown]")
    lines.append(
        f"  {'Category':<28} {'Target':<8} {'Found':<8} {'Valid':<8} {'Status':<12}"
    )
    lines.append("  " + "-" * 66)
    for cat_name, sumry in report.categories.items():
        status_badge = {
            "MET": "[MET]",
            "INCOMPLETE": "[INCOMPLETE]",
            "EMPTY": "[EMPTY]",
            "MISSING": "[MISSING]",
        }.get(sumry.status, sumry.status)
        lines.append(
            f"  {cat_name:<28} {sumry.target:<8} {sumry.found:<8} {sumry.valid:<8} {status_badge:<12}"
        )

    if report.duplicate_filenames:
        lines.append("\n[Duplicate Filenames]")
        for df in report.duplicate_filenames:
            lines.append(f"  - {df}")

    if report.duplicate_audio_hashes:
        lines.append("\n[Duplicate Audio Content (Identical SHA-256)]")
        for h, paths in report.duplicate_audio_hashes.items():
            lines.append(f"  - Hash {h[:12]}... : {paths}")

    if report.errors:
        lines.append("\n[Errors]")
        for err in report.errors:
            lines.append(f"  [ERROR] {err}")

    if report.warnings:
        lines.append("\n[Warnings / Notices]")
        for warn in report.warnings:
            lines.append(f"  [WARN] {warn}")

    lines.append("\n" + "=" * 72)
    return "\n".join(lines)


def main() -> None:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(
        description="Validate MAVE wake word audio dataset format, integrity, and progress."
    )
    parser.add_argument(
        "--dataset-dir",
        type=str,
        default="data/wake/mave-v2",
        help="Path to wake dataset directory (default: data/wake/mave-v2)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Enforce 100%% target clip counts per category (exit non-zero if incomplete)",
    )
    parser.add_argument(
        "--min-duration",
        type=float,
        default=DEFAULT_MIN_DURATION,
        help=f"Minimum clip duration in seconds (default: {DEFAULT_MIN_DURATION})",
    )
    parser.add_argument(
        "--max-duration",
        type=float,
        default=DEFAULT_MAX_DURATION,
        help=f"Maximum clip duration in seconds (default: {DEFAULT_MAX_DURATION})",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output machine-readable JSON to stdout",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Path to write JSON validation results",
    )

    args = parser.parse_args()
    dataset_path = Path(args.dataset_dir)

    report = validate_dataset(
        dataset_dir=dataset_path,
        min_duration=args.min_duration,
        max_duration=args.max_duration,
        strict_targets=args.strict,
    )

    if args.json:
        # Convert dataclass report to JSON-serializable dict
        report_dict = asdict(report)
        print(json.dumps(report_dict, indent=2))
    else:
        text_summary = format_validation_report(report)
        print(text_summary)

    if args.output:
        out_file = Path(args.output)
        out_file.parent.mkdir(parents=True, exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(asdict(report), f, indent=2)
        if not args.json:
            print(f"[OK] Saved validation report to: {out_file}")

    # Exit code: 0 if valid, 1 if invalid
    sys.exit(0 if report.is_valid else 1)


if __name__ == "__main__":
    main()
