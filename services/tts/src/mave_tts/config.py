"""Configuration dataclass and voice mapping for MAVE TTS service."""

from dataclasses import dataclass
from typing import Optional


DEFAULT_THAI_VOICE = "th-TH-PremwadeeNeural"
DEFAULT_ENGLISH_VOICE = "en-US-JennyNeural"
DEFAULT_MULTILINGUAL_VOICE = "en-US-AvaMultilingualNeural"

# Known natural neural voices
VOICE_CATALOG = {
    "th-female": "th-TH-PremwadeeNeural",
    "th-male": "th-TH-NiwatNeural",
    "en-female": "en-US-JennyNeural",
    "en-male": "en-US-GuyNeural",
    "multilingual": "en-US-AvaMultilingualNeural",
}


@dataclass
class TTSConfig:
    """Settings for speech synthesis and canonical audio framing."""

    default_voice_th: str = DEFAULT_THAI_VOICE
    default_voice_en: str = DEFAULT_ENGLISH_VOICE
    default_voice_multilingual: str = DEFAULT_MULTILINGUAL_VOICE
    sample_rate: int = 16000
    channels: int = 1
    frame_samples: int = 1280  # 80ms at 16kHz
    bytes_per_sample: int = 2  # 16-bit PCM (s16le)

    @property
    def frame_bytes(self) -> int:
        return self.frame_samples * self.channels * self.bytes_per_sample

    def resolve_voice(
        self,
        language: Optional[str] = None,
        voice_id: Optional[str] = None,
        text: Optional[str] = None,
    ) -> str:
        """Resolve voiceId from text, language hint, or explicit voice."""
        if voice_id and voice_id.strip():
            v = voice_id.strip()
            if v in VOICE_CATALOG:
                return VOICE_CATALOG[v]
            return v

        if language:
            lang = language.lower().strip()
            if lang.startswith("en"):
                return self.default_voice_en
            if lang == "multilingual":
                return self.default_voice_multilingual

        if text:
            has_thai = any("\u0e00" <= ch <= "\u0e7f" for ch in text)
            has_latin = any("a" <= ch.lower() <= "z" for ch in text)
            if has_thai and has_latin:
                return self.default_voice_multilingual
            if has_thai:
                return self.default_voice_th
            if has_latin:
                return self.default_voice_en

        return self.default_voice_th

    @staticmethod
    def map_rate(rate: Optional[float]) -> str:
        """Convert canonical float rate (0.5 - 2.0) to edge-tts percentage string."""
        if rate is None or abs(rate - 1.0) < 0.01:
            return "+0%"
        clamped = max(0.5, min(2.0, float(rate)))
        pct = int(round((clamped - 1.0) * 100))
        return f"{pct:+d}%"

    @staticmethod
    def map_pitch(pitch: Optional[float]) -> str:
        """Convert canonical pitch multiplier to edge-tts Hz adjustment."""
        if pitch is None or abs(pitch - 1.0) < 0.01:
            return "+0Hz"
        clamped = max(0.5, min(1.5, float(pitch)))
        hz = int(round((clamped - 1.0) * 50))
        return f"{hz:+d}Hz"
