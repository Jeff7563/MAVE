"""Configuration dataclass for MAVE STT service."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class STTConfig:
    """Configuration settings for faster-whisper speech recognition."""

    model: str = "large-v3-turbo"
    device: str = "auto"
    compute_type: str = "auto"
    beam_size: int = 5
    energy_threshold: float = 600.0
    silence_duration_sec: float = 0.8
    min_speech_duration_sec: float = 0.3
    max_utterance_sec: float = 20.0
    word_timestamps: bool = True
    language: Optional[str] = None
    vad_filter: bool = True

    def normalize_device_and_compute(self) -> tuple[str, str]:
        """Resolve 'auto' device and compute type based on hardware availability."""
        resolved_device = self.device.lower()
        if resolved_device == "auto":
            try:
                import ctranslate2

                if ctranslate2.get_cuda_device_count() > 0:
                    resolved_device = "cuda"
                else:
                    resolved_device = "cpu"
            except Exception:
                resolved_device = "cpu"

        resolved_compute = self.compute_type.lower()
        if resolved_compute == "auto":
            if resolved_device == "cuda":
                resolved_compute = "float16"
            else:
                resolved_compute = "int8"

        return resolved_device, resolved_compute

