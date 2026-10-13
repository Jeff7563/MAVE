"""Speech synthesis engine streaming audio via edge-tts and PyAV."""

import asyncio
import sys
from typing import AsyncIterator, Optional
import av

from .config import TTSConfig


class TTSEngine:
    """Streams synthesized speech from edge-tts, decoded to canonical 16kHz mono s16le PCM."""

    def __init__(self, config: Optional[TTSConfig] = None):
        self.config = config or TTSConfig()

    async def synthesize_stream(
        self,
        text: str,
        voice: Optional[str] = None,
        rate: Optional[float] = None,
        pitch: Optional[float] = None,
        language: Optional[str] = None,
    ) -> AsyncIterator[bytes]:
        """Synthesize text into an async stream of canonical 80ms PCM frames (2560 bytes)."""
        import edge_tts

        resolved_voice = self.config.resolve_voice(language=language, voice_id=voice, text=text)
        rate_str = self.config.map_rate(rate)
        pitch_str = self.config.map_pitch(pitch)

        async def _stream_voice(target_voice: str):
            comm = edge_tts.Communicate(
                text=text,
                voice=target_voice,
                rate=rate_str,
                pitch=pitch_str,
            )
            async for ch in comm.stream():
                yield ch

        codec = av.CodecContext.create("mp3", "r")
        resampler = av.AudioResampler(
            format="s16",
            layout="mono",
            rate=self.config.sample_rate,
        )

        pcm_buffer = bytearray()
        frame_bytes = self.config.frame_bytes

        try:
            async for chunk in _stream_voice(resolved_voice):
                if chunk["type"] == "audio":
                    data = chunk.get("data", b"")
                    if not data:
                        continue

                    for packet in codec.parse(data):
                        for frame in codec.decode(packet):
                            for resampled in resampler.resample(frame):
                                pcm_buffer.extend(resampled.to_ndarray().tobytes())

                                while len(pcm_buffer) >= frame_bytes:
                                    frame_chunk = bytes(pcm_buffer[:frame_bytes])
                                    del pcm_buffer[:frame_bytes]
                                    yield frame_chunk
        except edge_tts.exceptions.NoAudioReceived:
            # Automatic fallback to robust multilingual voice for complex code-switching text
            if resolved_voice != self.config.default_voice_multilingual:
                async for chunk in _stream_voice(self.config.default_voice_multilingual):
                    if chunk["type"] == "audio":
                        data = chunk.get("data", b"")
                        if not data:
                            continue

                        for packet in codec.parse(data):
                            for frame in codec.decode(packet):
                                for resampled in resampler.resample(frame):
                                    pcm_buffer.extend(resampled.to_ndarray().tobytes())

                                    while len(pcm_buffer) >= frame_bytes:
                                        frame_chunk = bytes(pcm_buffer[:frame_bytes])
                                        del pcm_buffer[:frame_bytes]
                                        yield frame_chunk
            else:
                raise

        # Flush decoder at stream end
        for frame in codec.decode():
            for resampled in resampler.resample(frame):
                pcm_buffer.extend(resampled.to_ndarray().tobytes())
                while len(pcm_buffer) >= frame_bytes:
                    frame_chunk = bytes(pcm_buffer[:frame_bytes])
                    del pcm_buffer[:frame_bytes]
                    yield frame_chunk

        # Yield any remaining samples (aligned to 16-bit boundaries)
        if len(pcm_buffer) >= 2:
            aligned_len = len(pcm_buffer) - (len(pcm_buffer) % 2)
            yield bytes(pcm_buffer[:aligned_len])

    async def synthesize_full(
        self,
        text: str,
        voice: Optional[str] = None,
        rate: Optional[float] = None,
        pitch: Optional[float] = None,
        language: Optional[str] = None,
    ) -> bytes:
        """Synthesize text and return full canonical PCM byte buffer."""
        chunks = []
        async for frame in self.synthesize_stream(text, voice, rate, pitch, language):
            chunks.append(frame)
        return b"".join(chunks)
