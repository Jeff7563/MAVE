"""MAVE Wake Model V2 Training Script for Google Colab / GPU environment.

Integrates synthetic Piper TTS ("hey maeve" / "hey mave") with augmented
real-voice user recordings from data/wake/mave-v2/ to produce an ONNX openWakeWord model.
"""

import os
import sys
from pathlib import Path
import yaml

# Check openwakeword installation
try:
    import openwakeword
    import torch
except ImportError:
    print("Please install requirements: pip install openwakeword torch torchaudio audiomentations")


def print_training_plan(config_path: str = "../mave-v2.yaml") -> None:
    """Print summarized execution plan for V2 model training."""
    cfg_file = Path(config_path)
    if not cfg_file.is_file():
        cfg_file = Path(__file__).parent.parent / "mave-v2.yaml"

    with open(cfg_file, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    print("=" * 65)
    print("         MAVE Wake Model V2 Training Pipeline")
    print("=" * 65)
    print(f"Target Phrase : {config['wake_identity']['phrase']}")
    print(f"Spellings     : {[s['spelling'] for s in config['wake_identity']['training_spellings']]}")
    print(f"Synthetic Pool: {config['synthetic_generation']['total_synthetic_clips']} clips across 8 voices")
    print(f"Real Audio Dir: {config['real_audio_dataset']['path']}")
    print(f"Augmentation  : {config['real_audio_dataset']['augmentation']['multiplier']}x multiplier")
    print(f"Near-Misses   : {len(config['negative_dataset']['near_miss_phrases'])} negative test phrases")
    print(f"Target FP/hr  : {config['negative_dataset']['false_positive_target_per_hour']}")
    print("=" * 65)


if __name__ == "__main__":
    print_training_plan()

