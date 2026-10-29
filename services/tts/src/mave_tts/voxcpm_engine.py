"""Local Thai/English TTS with VoxCPM2 (openbmb/VoxCPM2, Apache-2.0).

Selected with ``MAVE_TTS_ENGINE=voxcpm``. Produces the same canonical
16 kHz mono s16le 80 ms frames as the edge-tts engine, so nothing above the
TTS service changes. If VoxCPM cannot be imported or loaded, synthesis falls
back to edge-tts so MAVE never goes silent.

Settings (all optional):

    MAVE_VOXCPM_MODEL          HF id or local folder (default openbmb/VoxCPM2)
    MAVE_VOXCPM_CACHE_DIR      HF cache folder (or set HF_HOME)
    MAVE_VOXCPM_DEVICE         cuda | cpu | auto (default auto)
    MAVE_VOXCPM_REFERENCE_WAV  reference clip to copy the voice from
    MAVE_VOXCPM_PROMPT_WAV     prompt clip for continuation cloning ...
    MAVE_VOXCPM_PROMPT_TEXT    ... and its exact transcript
    MAVE_VOXCPM_VOICE_DESIGN   voice description, e.g. "A young Thai woman, warm and clear"
    MAVE_VOXCPM_CFG            guidance (default 2.0)
    MAVE_VOXCPM_STEPS          diffusion steps (default 10; lower = faster)
    MAVE_VOXCPM_OPTIMIZE       1 to torch.compile (slower start, faster runs; default 0)
    MAVE_VOXCPM_PRELOAD        0 to load lazily on first request (default 1)
"""

from __future__ import annotations

import asyncio
import os
import sys
import threading
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable, Dict, Iterable, Mapping, Optional

import numpy as np

from .config import TTSConfig


def _flag(value: Optional[str], default: bool) -> bool:
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _float(value: Optional[str], default: float) -> float:
    try:
        return float(value) if value not in (None, "") else default
    except ValueError:
        return default


def _int(value: Optional[str], default: int) -> int:
    try:
        return int(value) if value not in (None, "") else default
    except ValueError:
        return default


@dataclass
class VoxCPMSettings:
    model: str = "openbmb/VoxCPM2"
    cache_dir: Optional[str] = None
    device: Optional[str] = None
    reference_wav: Optional[str] = None
    prompt_wav: Optional[str] = None
    prompt_text: Optional[str] = None
    voice_design: Optional[str] = None
    cfg_value: float = 2.0
    inference_timesteps: int = 10
    optimize: bool = False
    preload: bool = True
    extra: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_env(cls, env: Optional[Mapping[str, str]] = None) -> "VoxCPMSettings":
        e = os.environ if env is None else env

        def s(key: str) -> Optional[str]:
            v = e.get(key)
            return v.strip() if v and v.strip() else None

        device = s("MAVE_VOXCPM_DEVICE")
        return cls(
            model=s("MAVE_VOXCPM_MODEL") or "openbmb/VoxCPM2",
            cache_dir=s("MAVE_VOXCPM_CACHE_DIR"),
            device=None if device in (None, "auto") else device,
            reference_wav=s("MAVE_VOXCPM_REFERENCE_WAV"),
            prompt_wav=s("MAVE_VOXCPM_PROMPT_WAV"),
            prompt_text=s("MAVE_VOXCPM_PROMPT_TEXT"),
            voice_design=s("MAVE_VOXCPM_VOICE_DESIGN"),
            cfg_value=_float(e.get("MAVE_VOXCPM_CFG"), 2.0),
            inference_timesteps=_int(e.get("MAVE_VOXCPM_STEPS"), 10),
            optimize=_flag(e.get("MAVE_VOXCPM_OPTIMIZE"), False),
            preload=_flag(e.get("MAVE_VOXCPM_PRELOAD"), True),
        )

    def generate_kwargs(self, text: str) -> Dict[str, Any]:
        """Arguments for VoxCPM.generate_streaming()."""
        spoken = text
        # Voice design is a text prefix and is ignored by continuation cloning.
        if self.voice_design and not self.prompt_wav:
            spoken = f"({self.voice_design}){text}"
        kwargs: Dict[str, Any] = {
            "text": spoken,
            "cfg_value": self.cfg_value,
            "inference_timesteps": self.inference_timesteps,
        }
        if self.reference_wav:
            kwargs["reference_wav_path"] = self.reference_wav
        if self.prompt_wav and self.prompt_text:
            kwargs["prompt_wav_path"] = self.prompt_wav
            kwargs["prompt_text"] = self.prompt_text
        kwargs.update(self.extra)
        return kwargs


def resample_to_pcm16(audio: np.ndarray, src_rate: int, dst_rate: int) -> bytes:
    """Float waveform at src_rate -> mono s16le bytes at dst_rate."""
    x = np.asarray(audio, dtype=np.float32).reshape(-1)
    if x.size == 0:
        return b""
    if src_rate != dst_rate:
        try:
            from math import gcd

            from scipy.signal import resample_poly  # type: ignore

            g = gcd(src_rate, dst_rate)
            x = resample_poly(x, dst_rate // g, src_rate // g).astype(np.float32)
        except Exception:
            n_out = max(1, int(round(x.size * dst_rate / src_rate)))
            t_out = np.linspace(0.0, x.size - 1, n_out, dtype=np.float64)
            x = np.interp(t_out, np.arange(x.size), x).astype(np.float32)
    x = np.clip(x, -1.0, 1.0)
    return (x * 32767.0).astype("<i2").tobytes()


def _default_loader(settings: VoxCPMSettings) -> Any:
    from voxcpm import VoxCPM  # type: ignore

    return VoxCPM.from_pretrained(
        settings.model,
        load_denoiser=False,
        cache_dir=settings.cache_dir,
        optimize=settings.optimize,
        device=settings.device,
    )


class VoxCPMEngine:
    """Streams VoxCPM2 speech as canonical PCM frames, with edge-tts fallback."""

    def __init__(
        self,
        config: Optional[TTSConfig] = None,
        settings: Optional[VoxCPMSettings] = None,
        fallback: Optional[Any] = None,
        loader: Optional[Callable[[VoxCPMSettings], Any]] = None,
    ):
        self.config = config or TTSConfig()
        self.settings = settings or VoxCPMSettings.from_env()
        self._fallback = fallback
        self._loader = loader or _default_loader
        self._model: Any = None
        self._load_error: Optional[str] = None
        self._lock = threading.Lock()
        # One synthesis at a time on the GPU.
        self._gen_lock = threading.Lock()

    @property
    def name(self) -> str:
        return "voxcpm" if self._load_error is None else "voxcpm(fallback:edge-tts)"

    @property
    def load_error(self) -> Optional[str]:
        return self._load_error

    def preload_in_background(self) -> None:
        if self.settings.preload:
            threading.Thread(target=self._ensure_model, name="voxcpm-preload", daemon=True).start()

    def _ensure_model(self) -> Any:
        with self._lock:
            if self._model is not None or self._load_error is not None:
                return self._model
            try:
                sys.stderr.write(f"[voxcpm] loading {self.settings.model} ...\n")
                sys.stderr.flush()
                self._model = self._loader(self.settings)
                sys.stderr.write("[voxcpm] ready\n")
            except Exception as exc:  # import error, CUDA OOM, missing files ...
                self._load_error = f"{type(exc).__name__}: {exc}"
                sys.stderr.write(f"[voxcpm] unavailable, using edge-tts: {self._load_error}\n")
            sys.stderr.flush()
            return self._model

    def _get_fallback(self) -> Any:
        if self._fallback is None:
            from .engine import TTSEngine

            self._fallback = TTSEngine(self.config)
        return self._fallback

    async def synthesize_stream(
        self,
        text: str,
        voice: Optional[str] = None,
        rate: Optional[float] = None,
        pitch: Optional[float] = None,
        language: Optional[str] = None,
    ) -> AsyncIterator[bytes]:
        model = await asyncio.to_thread(self._ensure_model)
        if model is None:
            async for frame in self._get_fallback().synthesize_stream(text, voice, rate, pitch, language):
                yield frame
            return

        src_rate = int(getattr(getattr(model, "tts_model", None), "sample_rate", 48000))
        kwargs = self.settings.generate_kwargs(text)
        loop = asyncio.get_running_loop()
        queue: "asyncio.Queue[Any]" = asyncio.Queue()
        stop = threading.Event()
        done = object()

        def worker() -> None:
            try:
                with self._gen_lock:
                    chunks: Iterable[np.ndarray] = model.generate_streaming(**kwargs)
                    for chunk in chunks:
                        if stop.is_set():
                            close = getattr(chunks, "close", None)
                            if close:
                                close()
                            break
                        loop.call_soon_threadsafe(queue.put_nowait, chunk)
            except BaseException as exc:  # forwarded to the async side
                loop.call_soon_threadsafe(queue.put_nowait, exc)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, done)

        thread = threading.Thread(target=worker, name="voxcpm-gen", daemon=True)
        thread.start()

        frame_bytes = self.config.frame_bytes
        buf = bytearray()
        yielded = False
        try:
            while True:
                item = await queue.get()
                if item is done:
                    break
                if isinstance(item, BaseException):
                    if yielded or not isinstance(item, Exception):
                        raise item
                    # e.g. CUDA out of memory before any audio: speak with edge-tts instead.
                    sys.stderr.write(f"[voxcpm] generation failed, using edge-tts: {item}\n")
                    sys.stderr.flush()
                    async for frame in self._get_fallback().synthesize_stream(text, voice, rate, pitch, language):
                        yield frame
                    return
                buf.extend(resample_to_pcm16(item, src_rate, self.config.sample_rate))
                while len(buf) >= frame_bytes:
                    yielded = True
                    yield bytes(buf[:frame_bytes])
                    del buf[:frame_bytes]
            if len(buf) >= 2:
                yield bytes(buf[: len(buf) - (len(buf) % 2)])
        finally:
            # Cancelled or finished: let the worker stop at the next chunk.
            stop.set()

    async def synthesize_full(self, text: str, **kwargs: Any) -> bytes:
        return b"".join([f async for f in self.synthesize_stream(text, **kwargs)])


def create_engine(config: TTSConfig, env: Optional[Mapping[str, str]] = None) -> Any:
    """Pick the TTS engine from MAVE_TTS_ENGINE (edge | voxcpm)."""
    e = os.environ if env is None else env
    choice = (e.get("MAVE_TTS_ENGINE") or "edge").strip().lower()
    if choice in ("voxcpm", "voxcpm2"):
        engine = VoxCPMEngine(config, VoxCPMSettings.from_env(e))
        engine.preload_in_background()
        return engine
    from .engine import TTSEngine

    return TTSEngine(config)
