"""Configuration management for MAVE openWakeWord service."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class WakeConfig:
    """Settings for openWakeWord detection service."""

    model_path: str = "assets/wake/mave.onnx"
    threshold: float = 0.5
    device_index: Optional[int] = None
    chunk_size: int = 1280  # 80ms at 16kHz
    sample_rate: int = 16000
    model_name: str = "mave"
    rearm_guard_ms: float = 300.0
    cooldown_seconds: float = 1.0
    model_version: Optional[str] = None

    def __post_init__(self) -> None:
        # Clamp threshold to [0.0, 1.0]
        if self.threshold < 0.0:
            self.threshold = 0.0
        elif self.threshold > 1.0:
            self.threshold = 1.0

        # Normalize negative device_index to None (default device)
        if self.device_index is not None and self.device_index < 0:
            self.device_index = None

    def resolved_model_path(self, base_dir: Optional[Path] = None) -> Path:
        """Resolve model path against base directory or current working directory."""
        root = base_dir if base_dir is not None else Path.cwd()
        if self.model_version:
            version_candidate = root / "assets" / "wake" / "models" / self.model_version / "mave.onnx"
            if version_candidate.is_file():
                return version_candidate.resolve()
        path = Path(self.model_path)
        if path.is_absolute():
            return path
        return (root / path).resolve()

    def is_model_available(self, base_dir: Optional[Path] = None) -> bool:
        """Check whether the model file exists on disk."""
        return self.resolved_model_path(base_dir).is_file()


def get_model_metadata(version: str, base_dir: Optional[Path] = None) -> Optional[dict]:
    """Load metadata.json for a versioned model if available."""
    import json

    root = base_dir if base_dir is not None else Path.cwd()
    meta_path = root / "assets" / "wake" / "models" / version / "metadata.json"
    if meta_path.is_file():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def list_available_models(base_dir: Optional[Path] = None) -> list:
    """List all available versioned models in assets/wake/models."""
    root = base_dir if base_dir is not None else Path.cwd()
    models_dir = root / "assets" / "wake" / "models"
    result = []
    if models_dir.is_dir():
        for sub in sorted(models_dir.iterdir()):
            if sub.is_dir():
                v = sub.name
                meta = get_model_metadata(v, base_dir=root)
                onnx_file = sub / "mave.onnx"
                result.append(
                    {
                        "version": v,
                        "available": onnx_file.is_file(),
                        "path": str(onnx_file.resolve()),
                        "metadata": meta,
                    }
                )
    return result

