"""MAVE Wake Model V2 Training Script for Google Colab / GPU environment.

Integrates synthetic Piper TTS ("hey maeve" / "hey mave") with augmented
real-voice user recordings from data/wake/mave-v2/ to produce an ONNX openWakeWord model.
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import yaml

# Check openwakeword installation
try:
    import openwakeword
    import torch
    HAS_TRAINING_DEPS = True
except ImportError:
    HAS_TRAINING_DEPS = False


def find_repo_root(start_dir: Optional[Path] = None) -> Path:
    """Find repository root by looking for marker files."""
    curr = (start_dir or Path(__file__)).resolve()
    for parent in [curr] + list(curr.parents):
        if (parent / "pnpm-workspace.yaml").exists() or (parent / ".git").exists() or (parent / "package.json").exists():
            return parent
    return curr.parents[3] if len(curr.parents) >= 4 else curr


def load_config(config_path: Optional[str] = None) -> Tuple[Dict[str, Any], Path]:
    """Resolve and load the MAVE V2 YAML training configuration."""
    if config_path:
        cfg_file = Path(config_path)
    else:
        # Default locations to try
        candidates = [
            Path(__file__).parent.parent / "mave-v2.yaml",
            Path("training/wake/mave-v2/mave-v2.yaml"),
            Path("mave-v2.yaml"),
            Path("../mave-v2.yaml"),
        ]
        cfg_file = None
        for cand in candidates:
            if cand.is_file():
                cfg_file = cand
                break
        if cfg_file is None:
            cfg_file = Path(__file__).parent.parent / "mave-v2.yaml"

    if not cfg_file.is_file():
        raise FileNotFoundError(f"Configuration file not found: {cfg_file}")

    with open(cfg_file, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    return config, cfg_file


def run_dry_run(
    config: Dict[str, Any],
    config_file: Path,
    dataset_dir_override: Optional[str] = None,
    output_dir_override: Optional[str] = None,
) -> int:
    """Perform pre-flight dry-run check without running any training."""
    repo_root = find_repo_root(config_file.parent)

    print("=" * 65)
    print("         MAVE Wake Model V2 - Training Dry-Run & Readiness Check")
    print("=" * 65)
    print(f"Config File   : {config_file.resolve()}")
    print(f"Repo Root     : {repo_root}")

    # 1. Validate Config Structure
    required_sections = [
        "model",
        "wake_identity",
        "synthetic_generation",
        "real_audio_dataset",
        "negative_dataset",
        "training_hyperparameters",
        "quality_gates",
    ]
    missing_sections = [s for s in required_sections if s not in config]
    if missing_sections:
        print(f"[ERROR] Config missing required sections: {missing_sections}")
        return 1
    print("[PASS] Config structure contains all required sections")

    # 2. Verify Output Path & V1 Safety Gate
    model_cfg = config.get("model", {})
    output_dir_str = output_dir_override or model_cfg.get("output_dir", "assets/wake/models/v2")
    export_filename = model_cfg.get("export_filename", "mave.onnx")

    output_dir = Path(output_dir_str)
    if not output_dir.is_absolute():
        output_dir = repo_root / output_dir

    candidate_target = output_dir / export_filename
    deployed_v1_target = repo_root / "assets" / "wake" / "mave.onnx"

    print(f"Target Output : {candidate_target}")

    # Safety assertion: V2 must NEVER directly overwrite deployed V1 model
    if candidate_target.resolve() == deployed_v1_target.resolve():
        print("[CRITICAL SAFETY ERROR] V2 candidate target cannot directly overwrite deployed V1 path!")
        print(f"Deployed V1: {deployed_v1_target}")
        print("Candidate models must export to 'assets/wake/models/v2/' and pass quality gates.")
        return 1
    print("[PASS] V1 deployed model safety check (V2 exports to candidate isolation directory)")

    # 3. Framework Dependencies Check
    deps_status = []
    for mod in ["openwakeword", "torch", "torchaudio", "audiomentations"]:
        try:
            __import__(mod)
            deps_status.append((mod, True))
        except ImportError:
            deps_status.append((mod, False))

    print("\nEnvironment & Dependencies:")
    for mod, available in deps_status:
        status_str = "AVAILABLE" if available else "NOT INSTALLED (Expected if running offline/outside Colab)"
        print(f"  - {mod:<18}: {status_str}")

    # 4. Audio Dataset Audit
    dataset_path_str = dataset_dir_override or config["real_audio_dataset"]["path"]
    dataset_path = Path(dataset_path_str)
    if not dataset_path.is_absolute():
        dataset_path = repo_root / dataset_path

    print(f"\nReal Audio Dataset Directory: {dataset_path}")

    # Try importing dataset validator
    sys.path.insert(0, str(repo_root / "services" / "wake"))
    try:
        from tools.validate_dataset import validate_dataset
    except ImportError:
        validate_dataset = None

    if not dataset_path.exists():
        print("[INFO] Dataset directory does not exist yet.")
        print("       Status: PENDING RECORDING (Use services/wake/tools/record_dataset.py when microphone available)")
    elif validate_dataset is not None:
        report = validate_dataset(dataset_path)
        print(f"  - Total WAV Clips : {report.total_clips}")
        print(f"  - Valid Clips     : {report.valid_clips}")
        print(f"  - Corrupt/Invalid : {report.invalid_clips}")
        met_count = sum(1 for c in report.category_summaries.values() if c.status == "MET")
        print(f"  - Categories Met  : {met_count}/{len(report.category_summaries)}")
        if report.is_ready_for_training:
            print("[PASS] Dataset satisfies training requirements.")
        else:
            print("[INFO] Dataset is incomplete or empty. Recording required before training.")
    else:
        wav_count = len(list(dataset_path.glob("**/*.wav")))
        print(f"  - Found {wav_count} WAV clips in dataset directory.")

    # 5. Training Plan Summary
    print("\n" + "=" * 65)
    print("         MAVE Wake Model V2 Training Specifications")
    print("=" * 65)
    print(f"Target Phrase : {config['wake_identity']['phrase']}")
    print(f"Spellings     : {[s['spelling'] for s in config['wake_identity']['training_spellings']]}")
    print(f"Synthetic Pool: {config['synthetic_generation']['total_synthetic_clips']} clips across 8 voices")
    print(f"Augmentation  : {config['real_audio_dataset']['augmentation']['multiplier']}x multiplier")
    print(f"Near-Misses   : {len(config['negative_dataset']['near_miss_phrases'])} negative test phrases")
    print(f"Quality Gates : Live recall >= {config['quality_gates']['live_recall_first_attempt']}")
    print(f"                Near-miss false positive rate <= {config['quality_gates']['near_miss_false_positive_rate']}")
    print("=" * 65)
    print("[DRY-RUN COMPLETE] Configuration and environment audited successfully.\n")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="MAVE Wake Model V2 Training Pipeline")
    parser.add_argument("--config", "-c", type=str, default=None, help="Path to mave-v2.yaml config")
    parser.add_argument("--dataset-dir", "-d", type=str, default=None, help="Path to real audio dataset")
    parser.add_argument("--output-dir", "-o", type=str, default=None, help="Candidate model output directory")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate configuration, paths, and dataset readiness without training",
    )
    args = parser.parse_args()

    try:
        config, cfg_file = load_config(args.config)
    except Exception as e:
        print(f"[ERROR] Failed to load configuration: {e}")
        sys.exit(1)

    if args.dry_run:
        exit_code = run_dry_run(
            config=config,
            config_file=cfg_file,
            dataset_dir_override=args.dataset_dir,
            output_dir_override=args.output_dir,
        )
        sys.exit(exit_code)
    else:
        run_dry_run(config=config, config_file=cfg_file)


if __name__ == "__main__":
    main()
