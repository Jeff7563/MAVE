"""Developer-only recording tool for MAVE wake word training and benchmark datasets.

Captures 16 kHz mono 16-bit PCM WAV audio clips directly from the local microphone.
Audio is saved locally to data/wake/mave-v2/ and never uploaded to any remote service.
"""

import argparse
import sys
import time
import wave
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple
import numpy as np

# Category definitions and targets
CATEGORIES: Dict[str, Dict[str, str]] = {
    "positive/natural": {
        "prefix": "natural",
        "target": "30",
        "description": "Natural conversational volume, normal speed, ~1 ft from mic",
        "prompt": "Say: 'Hey MAVE' (normal natural voice)",
    },
    "positive/fast": {
        "prefix": "fast",
        "target": "10",
        "description": "Fast / brisk cadence without pause between words",
        "prompt": "Say: 'Hey MAVE' (fast / brisk)",
    },
    "positive/soft": {
        "prefix": "soft",
        "target": "10",
        "description": "Soft / quiet voice or relaxed morning tone",
        "prompt": "Say: 'Hey MAVE' (soft / quiet)",
    },
    "positive/far": {
        "prefix": "far",
        "target": "10",
        "description": "Across the desk or room (2-3 meters away)",
        "prompt": "Say: 'Hey MAVE' (from distance / across desk)",
    },
    "positive/difficult-ending": {
        "prefix": "difficult_ending",
        "target": "10",
        "description": "Natural softer/unvoiced/reduced ending on the final consonant",
        "prompt": "Say: 'Hey MAVE' (natural relaxed final consonant)",
    },
    "negative/near-miss": {
        "prefix": "near_miss",
        "target": "20",
        "description": "Phonetically similar phrases that must NOT trigger wake",
        "prompt": "Say one near-miss phrase: Hey maybe / Hey Dave / Hey wave / Hey save / Hey cave / Hey babe / Hey mate / Hey May",
    },
    "negative/normal-speech": {
        "prefix": "normal_speech",
        "target": "20",
        "description": "Everyday background conversation, reading sentences, or ambient room audio",
        "prompt": "Say any casual sentence or phrase not containing the wake word",
    },
}

NEAR_MISS_SUGGESTIONS: List[str] = [
    "Hey maybe",
    "Hey Dave",
    "Hey wave",
    "Hey save",
    "Hey cave",
    "Hey babe",
    "Hey mate",
    "Hey May",
    "Hey made",
    "Hey mail",
    "Say MAVE",
    "OK MAVE",
]


def get_available_audio_devices() -> List[Dict[str, any]]:
    """Enumerate input audio devices using sounddevice."""
    devices: List[Dict[str, any]] = []
    try:
        import sounddevice as sd

        all_devs = sd.query_devices()
        for idx, dev in enumerate(all_devs):
            if dev.get("max_input_channels", 0) > 0:
                devices.append({
                    "index": idx,
                    "name": dev.get("name", f"Device {idx}"),
                    "channels": dev.get("max_input_channels", 1),
                    "default_samplerate": dev.get("default_samplerate", 16000),
                })
    except Exception as exc:
        print(f"Warning: could not query audio devices: {exc}", file=sys.stderr)
    return devices


def get_next_clip_filename(category_dir: Path, prefix: str) -> Path:
    """Return next deterministic filename formatted as <prefix>_<index:03d>.wav."""
    category_dir.mkdir(parents=True, exist_ok=True)
    existing_indices: List[int] = []
    for file in category_dir.glob(f"{prefix}_*.wav"):
        stem = file.stem
        parts = stem.split("_")
        if len(parts) >= 2 and parts[-1].isdigit():
            existing_indices.append(int(parts[-1]))

    next_idx = (max(existing_indices) + 1) if existing_indices else 1
    return category_dir / f"{prefix}_{next_idx:03d}.wav"


def save_wav_file(path: Path, audio_data: np.ndarray, sample_rate: int = 16000) -> None:
    """Save 16 kHz mono 16-bit PCM WAV file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    # Ensure 1D int16 array
    if audio_data.dtype != np.int16:
        if np.issubdtype(audio_data.dtype, np.floating):
            audio_int16 = (np.clip(audio_data, -1.0, 1.0) * 32767).astype(np.int16)
        else:
            audio_int16 = audio_data.astype(np.int16)
    else:
        audio_int16 = audio_data

    raw_bytes = audio_int16.tobytes()
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(raw_bytes)


def record_clip(
    duration: float,
    sample_rate: int = 16000,
    device_index: Optional[int] = None,
    audio_recorder_fn: Optional[Callable[..., np.ndarray]] = None,
) -> np.ndarray:
    """Record a single audio clip of specified duration at 16kHz mono int16."""
    num_samples = int(duration * sample_rate)
    if audio_recorder_fn is not None:
        return audio_recorder_fn(num_samples, sample_rate, device_index)

    import sounddevice as sd

    audio = sd.rec(
        num_samples,
        samplerate=sample_rate,
        channels=1,
        dtype="int16",
        device=device_index,
    )
    sd.wait()
    return audio.reshape(-1)


def countdown(seconds: int = 3) -> None:
    """Display a visual countdown in terminal before recording."""
    if seconds <= 0:
        return
    for i in range(seconds, 0, -1):
        sys.stdout.write(f"\r  Starting in {i}... ")
        sys.stdout.flush()
        time.sleep(1.0)
    sys.stdout.write("\r  RECORDING NOW!   \n")
    sys.stdout.flush()


def count_existing_clips(base_dir: Path) -> Dict[str, int]:
    """Count existing WAV clips for each category under base_dir."""
    counts: Dict[str, int] = {}
    for cat in CATEGORIES:
        cat_dir = base_dir / cat
        if cat_dir.is_dir():
            counts[cat] = len(list(cat_dir.glob("*.wav")))
        else:
            counts[cat] = 0
    return counts


def run_recording_session(
    category: str,
    target_count: int,
    duration: float,
    base_dir: Path,
    device_index: Optional[int] = None,
    countdown_seconds: int = 3,
    interactive: bool = True,
    recorder_fn: Optional[Callable[..., np.ndarray]] = None,
) -> List[Path]:
    """Run recording loop for a specified category."""
    if category not in CATEGORIES:
        raise ValueError(f"Unknown category: {category}. Valid: {list(CATEGORIES.keys())}")

    cat_meta = CATEGORIES[category]
    cat_dir = base_dir / category
    prefix = cat_meta["prefix"]
    prompt = cat_meta["prompt"]

    saved_files: List[Path] = []
    print(f"\n--- Category: {category} ---")
    print(f"Description: {cat_meta['description']}")
    print(f"Goal: {target_count} clips | Duration: {duration:.1f}s each")
    print(f"Saving to: {cat_dir}")

    for idx in range(1, target_count + 1):
        if category == "negative/near-miss":
            suggestion = NEAR_MISS_SUGGESTIONS[(idx - 1) % len(NEAR_MISS_SUGGESTIONS)]
            current_prompt = f"Say near-miss: '{suggestion}'"
        else:
            current_prompt = prompt

        print(f"\n[Clip {idx}/{target_count}] {current_prompt}")

        if interactive:
            try:
                resp = input("  Press [Enter] when ready to record (or 'q' to stop): ").strip()
                if resp.lower() == "q":
                    print("  Session paused by user.")
                    break
            except (EOFError, KeyboardInterrupt):
                print("\n  Exiting session.")
                break

        countdown(countdown_seconds)
        audio = record_clip(
            duration=duration,
            sample_rate=16000,
            device_index=device_index,
            audio_recorder_fn=recorder_fn,
        )

        target_file = get_next_clip_filename(cat_dir, prefix)
        save_wav_file(target_file, audio, sample_rate=16000)
        saved_files.append(target_file)
        print(f"  ✓ Saved: {target_file.name} ({len(audio)} samples, 16kHz mono)")

    return saved_files


def interactive_menu(base_dir: Path, default_device: Optional[int] = None) -> None:
    """Interactive top-level CLI for guided recording."""
    print("=" * 65)
    print("      MAVE Real-Voice Dataset Recorder (Local-Only)")
    print("=" * 65)

    # 1. Device selection
    devices = get_available_audio_devices()
    chosen_device = default_device

    if devices:
        print("\nAvailable Input Microphones:")
        for dev in devices:
            marker = "*" if (chosen_device == dev["index"]) else " "
            print(f"  [{marker}] Index {dev['index']}: {dev['name']}")

        try:
            dev_input = input(f"\nSelect microphone index [Default: {chosen_device if chosen_device is not None else 'System Default'}]: ").strip()
            if dev_input.isdigit():
                chosen_device = int(dev_input)
        except (EOFError, KeyboardInterrupt):
            return
    else:
        print("Notice: No audio devices enumerated, using system default.")

    # Main menu loop
    while True:
        counts = count_existing_clips(base_dir)
        total_pos = sum(counts.get(k, 0) for k in CATEGORIES if k.startswith("positive"))
        total_neg = sum(counts.get(k, 0) for k in CATEGORIES if k.startswith("negative"))

        print("\n" + "=" * 65)
        print(f"Current Dataset Progress in: {base_dir}")
        print(f"  Total Positive: {total_pos}/70 target | Total Negative: {total_neg}/40 target")
        print("-" * 65)

        cat_keys = list(CATEGORIES.keys())
        for i, cat in enumerate(cat_keys, 1):
            meta = CATEGORIES[cat]
            cur = counts.get(cat, 0)
            tgt = meta["target"]
            status = "✓ Done" if cur >= int(tgt) else f"{cur}/{tgt}"
            print(f"  {i}. {cat:<26} [{status:<7}] - {meta['description']}")

        print("  0. Exit")
        print("=" * 65)

        try:
            choice = input("Select category number (1-7, or 0 to exit): ").strip()
            if choice == "0" or choice.lower() == "q":
                print("Exiting recorder. Goodbye!")
                break

            if not choice.isdigit() or not (1 <= int(choice) <= len(cat_keys)):
                print("Invalid selection. Please choose a number from 0 to 7.")
                continue

            chosen_cat = cat_keys[int(choice) - 1]
            default_target = int(CATEGORIES[chosen_cat]["target"])
            already_done = counts.get(chosen_cat, 0)
            remaining = max(1, default_target - already_done)

            cnt_input = input(f"How many clips to record? [Default: {remaining}]: ").strip()
            clip_count = int(cnt_input) if cnt_input.isdigit() and int(cnt_input) > 0 else remaining

            dur_input = input("Duration per clip in seconds [Default: 2.0]: ").strip()
            duration = float(dur_input) if dur_input.replace(".", "", 1).isdigit() else 2.0

            run_recording_session(
                category=chosen_cat,
                target_count=clip_count,
                duration=duration,
                base_dir=base_dir,
                device_index=chosen_device,
                countdown_seconds=3,
                interactive=True,
            )

        except (EOFError, KeyboardInterrupt):
            print("\nExiting recorder. Goodbye!")
            break


def main() -> None:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Record local audio dataset for MAVE wake model.")
    parser.add_argument("--category", choices=list(CATEGORIES.keys()), help="Category to record")
    parser.add_argument("--count", type=int, default=10, help="Number of clips to record")
    parser.add_argument("--duration", type=float, default=2.0, help="Clip duration in seconds (1.0 - 3.0)")
    parser.add_argument("--device", type=int, default=None, help="Input audio device index")
    parser.add_argument("--target-dir", type=str, default="data/wake/mave-v2", help="Target dataset root directory")
    parser.add_argument("--countdown", type=int, default=3, help="Countdown seconds before recording")
    parser.add_argument("--non-interactive", action="store_true", help="Non-interactive batch mode")
    parser.add_argument("--list-devices", action="store_true", help="List audio input devices and exit")

    args = parser.parse_args()

    if args.list_devices:
        devices = get_available_audio_devices()
        print("Available Input Microphones:")
        for dev in devices:
            print(f"  Index {dev['index']}: {dev['name']} ({dev['channels']} ch, {dev['default_samplerate']}Hz)")
        return

    base_dir = Path(args.target_dir)

    if args.category:
        run_recording_session(
            category=args.category,
            target_count=args.count,
            duration=args.duration,
            base_dir=base_dir,
            device_index=args.device,
            countdown_seconds=args.countdown,
            interactive=not args.non_interactive,
        )
    else:
        interactive_menu(base_dir=base_dir, default_device=args.device)


if __name__ == "__main__":
    main()

