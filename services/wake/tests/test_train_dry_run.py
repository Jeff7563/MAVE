"""Tests for MAVE V2 training dry-run and configuration validation."""

from pathlib import Path
import subprocess
import sys
import pytest


def test_v2_training_dry_run_execution():
    """Verify train_mave_v2.py executes cleanly in dry-run mode."""
    repo_root = Path(__file__).resolve().parents[3]
    train_script = repo_root / "training" / "wake" / "mave-v2" / "colab" / "train_mave_v2.py"
    config_file = repo_root / "training" / "wake" / "mave-v2" / "mave-v2.yaml"

    assert train_script.is_file(), f"Missing train script: {train_script}"
    assert config_file.is_file(), f"Missing config: {config_file}"

    # Execute dry-run via Python
    res = subprocess.run(
        [
            sys.executable,
            str(train_script),
            "--config",
            str(config_file),
            "--dry-run",
        ],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
    )

    assert res.returncode == 0, f"Dry-run failed: {res.stderr}\n{res.stdout}"
    assert "[PASS] Config structure contains all required sections" in res.stdout
    assert "[PASS] V1 deployed model safety check" in res.stdout
    assert "[DRY-RUN COMPLETE]" in res.stdout


def test_v2_training_safety_gate_prevents_v1_overwrite(tmp_path: Path):
    """Verify dry-run fails with critical safety error if output target points to deployed V1."""
    repo_root = Path(__file__).resolve().parents[3]
    train_script = repo_root / "training" / "wake" / "mave-v2" / "colab" / "train_mave_v2.py"
    config_file = repo_root / "training" / "wake" / "mave-v2" / "mave-v2.yaml"
    deployed_v1_dir = repo_root / "assets" / "wake"

    # Attempt to point directly to deployed V1 path
    res = subprocess.run(
        [
            sys.executable,
            str(train_script),
            "--config",
            str(config_file),
            "--output-dir",
            str(deployed_v1_dir),
            "--dry-run",
        ],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
    )

    assert res.returncode != 0
    assert "CRITICAL SAFETY ERROR" in res.stdout
