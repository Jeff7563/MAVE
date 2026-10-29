"""Tests for the VoxCPM2 engine (no model download: a fake model is injected)."""

import asyncio

import numpy as np

from mave_tts.config import TTSConfig
from mave_tts.voxcpm_engine import (
    VoxCPMEngine,
    VoxCPMSettings,
    create_engine,
    resample_to_pcm16,
)


class FakeTTSModel:
    sample_rate = 48000


class FakeVoxCPM:
    def __init__(self, chunks=3, chunk_seconds=0.2):
        self.tts_model = FakeTTSModel()
        self.calls = []
        self.chunks = chunks
        self.chunk_len = int(48000 * chunk_seconds)

    def generate_streaming(self, **kwargs):
        self.calls.append(kwargs)
        for _ in range(self.chunks):
            yield np.full(self.chunk_len, 0.5, dtype=np.float32)


class FakeFallback:
    def __init__(self):
        self.texts = []

    async def synthesize_stream(self, text, voice=None, rate=None, pitch=None, language=None):
        self.texts.append(text)
        yield b"\x01\x00" * 1280


def run(coro):
    return asyncio.run(coro)


async def collect(stream):
    return [f async for f in stream]


def test_settings_from_env_and_kwargs():
    s = VoxCPMSettings.from_env(
        {
            "MAVE_VOXCPM_MODEL": "D:\\AF\\models\\VoxCPM2",
            "MAVE_VOXCPM_REFERENCE_WAV": "voice.wav",
            "MAVE_VOXCPM_VOICE_DESIGN": "A warm Thai female voice",
            "MAVE_VOXCPM_CFG": "1.6",
            "MAVE_VOXCPM_STEPS": "6",
            "MAVE_VOXCPM_DEVICE": "auto",
        }
    )
    assert s.model == "D:\\AF\\models\\VoxCPM2"
    assert s.device is None
    kw = s.generate_kwargs("สวัสดีครับ")
    assert kw["text"] == "(A warm Thai female voice)สวัสดีครับ"
    assert kw["reference_wav_path"] == "voice.wav"
    assert kw["cfg_value"] == 1.6 and kw["inference_timesteps"] == 6
    assert "prompt_wav_path" not in kw


def test_continuation_cloning_needs_both_wav_and_text():
    only_wav = VoxCPMSettings(prompt_wav="p.wav").generate_kwargs("hi")
    assert "prompt_wav_path" not in only_wav
    both = VoxCPMSettings(prompt_wav="p.wav", prompt_text="hello", voice_design="x").generate_kwargs("hi")
    assert both["prompt_wav_path"] == "p.wav" and both["prompt_text"] == "hello"
    assert both["text"] == "hi"  # voice design is not mixed into continuation


def test_resample_48k_to_16k_s16():
    pcm = resample_to_pcm16(np.full(48000, 0.5, dtype=np.float32), 48000, 16000)
    samples = np.frombuffer(pcm, dtype="<i2")
    assert abs(samples.size - 16000) <= 2
    assert abs(int(np.median(samples)) - 16383) <= 2
    assert resample_to_pcm16(np.array([], dtype=np.float32), 48000, 16000) == b""
    clipped = np.frombuffer(resample_to_pcm16(np.array([2.0, -2.0]), 16000, 16000), dtype="<i2")
    assert clipped.tolist() == [32767, -32767]


def test_streams_canonical_frames():
    fake = FakeVoxCPM(chunks=3, chunk_seconds=0.2)
    cfg = TTSConfig()
    engine = VoxCPMEngine(cfg, VoxCPMSettings(preload=False), loader=lambda s: fake)
    frames = run(collect(engine.synthesize_stream("สวัสดีครับ")))
    total = sum(len(f) for f in frames)
    # 0.6 s of audio at 16 kHz s16 = 19200 bytes (±resampler edge)
    assert abs(total - 19200) <= 16
    assert all(len(f) == cfg.frame_bytes for f in frames[:-1])
    assert fake.calls[0]["text"] == "สวัสดีครับ"
    assert engine.name == "voxcpm"


def test_falls_back_to_edge_tts_when_model_fails():
    def broken(_settings):
        raise ImportError("No module named 'voxcpm'")

    fallback = FakeFallback()
    engine = VoxCPMEngine(TTSConfig(), VoxCPMSettings(preload=False), fallback=fallback, loader=broken)
    frames = run(collect(engine.synthesize_stream("hello")))
    assert frames == [b"\x01\x00" * 1280]
    assert fallback.texts == ["hello"]
    assert "voxcpm" in (engine.load_error or "")
    assert engine.name.endswith("fallback:edge-tts)")


def test_stopping_early_stops_the_generator():
    fake = FakeVoxCPM(chunks=50, chunk_seconds=0.1)
    engine = VoxCPMEngine(TTSConfig(), VoxCPMSettings(preload=False), loader=lambda s: fake)

    async def first_frame_only():
        stream = engine.synthesize_stream("long text")
        frame = await stream.__anext__()
        await stream.aclose()
        return frame

    assert len(run(first_frame_only())) == TTSConfig().frame_bytes
    # The GPU lock is released, so the next request can run.
    assert engine._gen_lock.acquire(timeout=2)
    engine._gen_lock.release()


def test_create_engine_selects_by_env():
    from mave_tts.engine import TTSEngine

    assert isinstance(create_engine(TTSConfig(), {}), TTSEngine)
    eng = create_engine(TTSConfig(), {"MAVE_TTS_ENGINE": "voxcpm", "MAVE_VOXCPM_PRELOAD": "0"})
    assert isinstance(eng, VoxCPMEngine)


def test_generation_error_before_audio_uses_fallback():
    class OOM(FakeVoxCPM):
        def generate_streaming(self, **kwargs):
            raise RuntimeError("CUDA out of memory")
            yield  # pragma: no cover

    fallback = FakeFallback()
    engine = VoxCPMEngine(TTSConfig(), VoxCPMSettings(preload=False), fallback=fallback, loader=lambda s: OOM())
    frames = run(collect(engine.synthesize_stream("ทดสอบ")))
    assert frames == [b"\x01\x00" * 1280]
    assert fallback.texts == ["ทดสอบ"]
