"""Voice Activity and End-of-Utterance (EOU) tracker."""

from enum import Enum
from typing import Callable, List, Optional
import numpy as np


class VADState(str, Enum):
    IDLE = "idle"
    SPEAKING = "speaking"
    FINISHED = "finished"


class UtteranceVADTracker:
    """Evaluates frame-level audio energy and tracks speech boundaries."""

    def __init__(
        self,
        energy_threshold: float = 600.0,
        silence_duration_sec: float = 0.8,
        min_speech_duration_sec: float = 0.3,
        max_utterance_sec: float = 20.0,
        frame_duration_sec: float = 0.08,
        on_speech_started: Optional[Callable[[], None]] = None,
        on_speech_ended: Optional[Callable[[], None]] = None,
    ):
        self.energy_threshold = energy_threshold
        self.silence_duration_sec = silence_duration_sec
        self.min_speech_duration_sec = min_speech_duration_sec
        self.max_utterance_sec = max_utterance_sec
        self.frame_duration_sec = frame_duration_sec

        self.on_speech_started = on_speech_started
        self.on_speech_ended = on_speech_ended

        self.state = VADState.IDLE
        self.speech_duration = 0.0
        self.silence_duration = 0.0
        self.audio_chunks: List[bytes] = []

    def feed_frame(self, pcm_chunk: bytes) -> VADState:
        """Feed a canonical mono 16kHz s16le PCM frame into the tracker."""
        if self.state == VADState.FINISHED:
            return self.state

        self.audio_chunks.append(pcm_chunk)

        if len(pcm_chunk) < 2:
            return self.state

        samples = np.frombuffer(pcm_chunk, dtype=np.int16)
        rms = float(np.sqrt(np.mean(samples.astype(np.float32) ** 2)))

        is_voice = rms >= self.energy_threshold

        if self.state == VADState.IDLE:
            if is_voice:
                self.state = VADState.SPEAKING
                self.speech_duration = self.frame_duration_sec
                self.silence_duration = 0.0
                if self.on_speech_started:
                    self.on_speech_started()
        elif self.state == VADState.SPEAKING:
            if is_voice:
                self.silence_duration = 0.0
                self.speech_duration += self.frame_duration_sec
            else:
                self.silence_duration += self.frame_duration_sec
                self.speech_duration += self.frame_duration_sec

            # Check End-of-Utterance (EOU) silence boundary
            if (
                self.silence_duration >= self.silence_duration_sec
                and self.speech_duration >= self.min_speech_duration_sec
            ):
                self.state = VADState.FINISHED
                if self.on_speech_ended:
                    self.on_speech_ended()
            elif self.speech_duration >= self.max_utterance_sec:
                self.state = VADState.FINISHED
                if self.on_speech_ended:
                    self.on_speech_ended()

        return self.state

    def force_finish(self) -> None:
        """Force conclusion of speech turn upon external stream completion."""
        if self.state != VADState.FINISHED:
            self.state = VADState.FINISHED
            if self.on_speech_ended:
                self.on_speech_ended()

    def get_audio_bytes(self) -> bytes:
        """Return all accumulated PCM bytes for this utterance."""
        return b"".join(self.audio_chunks)

    def reset(self) -> None:
        """Reset state for a fresh utterance."""
        self.state = VADState.IDLE
        self.speech_duration = 0.0
        self.silence_duration = 0.0
        self.audio_chunks.clear()
