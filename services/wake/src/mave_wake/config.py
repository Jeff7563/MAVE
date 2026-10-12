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
        path = Path(self.model_path)
        if path.is_absolute():
            return path
        root = base_dir if base_dir is not None else Path.cwd()
        return (root / path).resolve()

    def is_model_available(self, base_dir: Optional[Path] = None) -> bool:
        """Check whether the model file exists on disk."""
        return self.resolved_model_path(base_dir).is_file()

