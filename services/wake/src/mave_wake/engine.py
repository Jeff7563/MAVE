"""Wake engine inference wrapper using openWakeWord."""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import wave

from .config import WakeConfig
from .protocol import log_error, log_info


class WakeEngine:
    """Encapsulates openWakeWord model loading, frame inference, and offline test evaluation."""

    def __init__(self, config: WakeConfig, base_dir: Optional[Path] = None):
        self.config = config
        self.base_dir = base_dir if base_dir is not None else Path.cwd()
        self.model: Optional[Any] = None
        self.is_loaded = False
        self.error_message: Optional[str] = None

    def load_model(self) -> Tuple[bool, Optional[str]]:
        """Load openWakeWord ONNX model from configured path."""
        resolved = self.config.resolved_model_path(self.base_dir)
        if not resolved.is_file():
            self.model = None
            self.is_loaded = False
            self.error_message = f"Model file missing: {resolved}"
            log_info(f"WakeEngine: {self.error_message}")
            return False, self.error_message

        try:
            from openwakeword.model import Model

            log_info(f"Loading openWakeWord model from {resolved}")
            self.model = Model(
                wakeword_models=[str(resolved)],
                inference_framework="onnx",
            )
            self.is_loaded = True
            self.error_message = None
            log_info("openWakeWord model loaded successfully")
            return True, None
        except Exception as exc:
            self.model = None
            self.is_loaded = False
            self.error_message = f"Failed to initialize openWakeWord model: {exc}"
            log_error(self.error_message)
            return False, self.error_message

    def process_chunk(self, chunk: np.ndarray) -> float:
        """Process a single PCM chunk (1280 samples at 16kHz int16).

        Returns confidence score in range [0.0, 1.0].
        """
        if not self.is_loaded or self.model is None:
            return 0.0

        try:
            # openWakeWord accepts 16-bit PCM numpy arrays
            predictions = self.model.predict(chunk)
            if not predictions:
                return 0.0

            # Find matching model score or use the first output
            target_key = self.config.model_name
            if target_key in predictions:
                return float(predictions[target_key])

            # Fallback to first available model prediction
            first_val = next(iter(predictions.values()))
            return float(first_val)
        except Exception as exc:
            log_error(f"Error during inference chunk processing: {exc}")
            return 0.0

    def reset(self) -> None:
        """Reset internal model buffers."""
        if self.model is not None and hasattr(self.model, "reset"):
            try:
                self.model.reset()
            except Exception:
                pass

    def process_wav_file(self, wav_path: str, threshold: Optional[float] = None) -> Dict[str, Any]:
        """Diagnostic offline test path: evaluates a local WAV file through the live inference path."""
        eval_threshold = threshold if threshold is not None else self.config.threshold
        path_obj = Path(wav_path)
        if not path_obj.is_file():
            return {
                "path": wav_path,
                "max_score": 0.0,
                "wake_detected": False,
                "frames_processed": 0,
                "error": f"WAV file not found: {wav_path}",
            }

        try:
            with wave.open(str(path_obj), "rb") as wf:
                sample_rate = wf.getframerate()
                n_channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                n_frames = wf.getnframes()
                raw_bytes = wf.readframes(n_frames)

            # Ensure 16-bit PCM
            if sample_width == 2:
                audio_data = np.frombuffer(raw_bytes, dtype=np.int16)
            elif sample_width == 4:
                # 32-bit int to 16-bit
                audio_data = (np.frombuffer(raw_bytes, dtype=np.int32) >> 16).astype(np.int16)
            else:
                return {
                    "path": wav_path,
                    "max_score": 0.0,
                    "wake_detected": False,
                    "frames_processed": 0,
                    "error": f"Unsupported sample width: {sample_width * 8}-bit (expected 16-bit PCM)",
                }

            # Convert multi-channel to mono
            if n_channels > 1:
                audio_data = audio_data.reshape(-1, n_channels).mean(axis=1).astype(np.int16)

            # Resample to 16kHz if needed
            if sample_rate != 16000:
                try:
                    import scipy.signal
                    num_target_samples = int(len(audio_data) * 16000 / sample_rate)
                    audio_data = scipy.signal.resample(audio_data, num_target_samples).astype(np.int16)
                except Exception as exc:
                    return {
                        "path": wav_path,
                        "max_score": 0.0,
                        "wake_detected": False,
                        "frames_processed": 0,
                        "error": f"Sample rate {sample_rate}Hz requires resampling to 16000Hz (failed: {exc})",
                    }

            self.reset()
            chunk_size = self.config.chunk_size
            scores: List[float] = []

            # Stream chunks through the exact same inference path as live audio
            for i in range(0, len(audio_data), chunk_size):
                chunk = audio_data[i : i + chunk_size]
                if len(chunk) < chunk_size:
                    # Pad short final chunk with zeros
                    padded = np.zeros(chunk_size, dtype=np.int16)
                    padded[: len(chunk)] = chunk
                    chunk = padded

                score = self.process_chunk(chunk)
                scores.append(round(score, 4))

            max_score = max(scores) if scores else 0.0
            wake_detected = any(s >= eval_threshold for s in scores)

            return {
                "path": str(path_obj),
                "max_score": round(max_score, 4),
                "wake_detected": wake_detected,
                "frames_processed": len(scores),
                "scores": scores,
            }
        except Exception as exc:
            return {
                "path": wav_path,
                "max_score": 0.0,
                "wake_detected": False,
                "frames_processed": 0,
                "error": f"Failed to process WAV audio: {exc}",
            }

