"""Inference engine managing faster-whisper model and transcription."""

import math
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .config import STTConfig


def setup_cuda_dll_paths() -> None:
    """Ensure Windows environment loads NVIDIA CUDA and cuDNN DLLs."""
    if sys.platform == "win32":
        site_packages = os.path.join(sys.prefix, "Lib", "site-packages")
        for sub_bin in ["nvidia/cublas/bin", "nvidia/cudnn/bin"]:
            p = os.path.join(site_packages, sub_bin.replace("/", os.sep))
            if os.path.exists(p):
                os.environ["PATH"] = p + os.pathsep + os.environ["PATH"]
                if hasattr(os, "add_dll_directory"):
                    try:
                        os.add_dll_directory(p)
                    except Exception:
                        pass


class STTEngine:
    """Manages WhisperModel lifecycle and transcription execution."""

    def __init__(self, config: Optional[STTConfig] = None):
        setup_cuda_dll_paths()
        self.config = config or STTConfig()
        self.device, self.compute_type = self.config.normalize_device_and_compute()
        self.model: Optional[Any] = None
        self.is_loaded = False
        self.load_duration_sec = 0.0

    def load_model(self) -> None:
        """Load WhisperModel into memory."""
        if self.is_loaded:
            return

        import faster_whisper

        t0 = time.time()
        try:
            self.model = faster_whisper.WhisperModel(
                self.config.model,
                device=self.device,
                compute_type=self.compute_type,
            )
            self.load_duration_sec = time.time() - t0
            self.is_loaded = True
        except Exception as exc:
            # Automatic fallback to CPU if CUDA fails to initialize
            if self.device == "cuda":
                sys.stderr.write(
                    f"Warning: Failed to load model on CUDA ({exc}). Falling back to CPU int8.\n"
                )
                sys.stderr.flush()
                self.device = "cpu"
                self.compute_type = "int8"
                self.model = faster_whisper.WhisperModel(
                    self.config.model,
                    device="cpu",
                    compute_type="int8",
                )
                self.load_duration_sec = time.time() - t0
                self.is_loaded = True
            else:
                raise

    @staticmethod
    def map_language_hint(hint: Optional[str]) -> Optional[str]:
        """Normalize BCP-47 language tag into Whisper 2-letter language code."""
        if not hint or hint.lower() in ("auto", "none", ""):
            return None
        lower = hint.lower().strip()
        if lower.startswith("th"):
            return "th"
        if lower.startswith("en"):
            return "en"
        return lower.split("-")[0].split("_")[0]

    def transcribe_pcm(
        self,
        pcm_bytes: bytes,
        language_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Transcribe raw mono 16kHz s16le PCM bytes into structured result."""
        if not self.is_loaded or self.model is None:
            self.load_model()

        if len(pcm_bytes) == 0:
            return {"text": "", "confidence": 0.0, "words": []}

        # Convert raw int16 PCM into normalized float32 waveform
        int_samples = np.frombuffer(pcm_bytes, dtype=np.int16)
        float_audio = int_samples.astype(np.float32) / 32768.0

        target_lang = self.map_language_hint(language_hint or self.config.language)

        segments, info = self.model.transcribe(
            float_audio,
            language=target_lang,
            beam_size=self.config.beam_size,
            word_timestamps=self.config.word_timestamps,
            vad_filter=self.config.vad_filter,
        )

        full_text_parts: List[str] = []
        words_out: List[Dict[str, Any]] = []
        logprobs: List[float] = []

        for segment in segments:
            full_text_parts.append(segment.text)
            if hasattr(segment, "avg_logprob") and segment.avg_logprob is not None:
                logprobs.append(segment.avg_logprob)

            if segment.words:
                for w in segment.words:
                    word_text = w.word.strip()
                    if word_text:
                        words_out.append({
                            "text": word_text,
                            "startMs": int(round(w.start * 1000)),
                            "endMs": int(round(w.end * 1000)),
                            "confidence": round(float(w.probability), 3)
                            if hasattr(w, "probability") and w.probability is not None
                            else 1.0,
                        })

        full_text = "".join(full_text_parts).strip()

        # Derive overall confidence strictly from model probabilities
        word_probs = [
            w["confidence"] for w in words_out if isinstance(w.get("confidence"), (int, float))
        ]
        if word_probs:
            overall_confidence = max(0.0, min(1.0, round(float(sum(word_probs) / len(word_probs)), 3)))
        elif logprobs:
            mean_logprob = sum(logprobs) / len(logprobs)
            overall_confidence = max(0.0, min(1.0, round(float(math.exp(mean_logprob)), 3)))
        elif info and hasattr(info, "language_probability") and info.language_probability is not None:
            overall_confidence = max(0.0, min(1.0, round(float(info.language_probability), 3)))
        else:
            overall_confidence = 0.0

        return {
            "text": full_text,
            "confidence": overall_confidence,
            "language": info.language if info and hasattr(info, "language") else target_lang,
            "words": words_out,
        }

