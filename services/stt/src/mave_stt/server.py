"""Main stdio server process for MAVE faster-whisper STT service."""

import argparse
import json
import os
import struct
import sys
import time
from typing import Any, Dict, Optional

from .config import STTConfig
from .engine import STTEngine
from .vad import UtteranceVADTracker, VADState


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def emit_event(event: Dict[str, Any]) -> None:
    """Emit JSON event line to stdout in UTF-8."""
    line = json.dumps(event, ensure_ascii=False)
    if hasattr(sys.stdout, "buffer"):
        sys.stdout.buffer.write((line + "\n").encode("utf-8"))
        sys.stdout.buffer.flush()
    else:
        sys.stdout.write(line + "\n")
        sys.stdout.flush()


def read_exact(n: int) -> Optional[bytes]:
    """Read exactly n bytes from stdin buffer, or return None on EOF."""
    data = bytearray()
    while len(data) < n:
        chunk = sys.stdin.buffer.read(n - len(data))
        if not chunk:
            return None
        data.extend(chunk)
    return bytes(data)


class STTServer:
    """Manages stdio communication, VAD tracking, and transcription execution."""

    def __init__(self, config: STTConfig):
        self.config = config
        self.engine = STTEngine(config)
        self.current_request_id: Optional[str] = None
        self.current_language: Optional[str] = config.language
        self.final_emitted = False
        self.tracker: Optional[UtteranceVADTracker] = None

    def _create_tracker(self, request_id: str) -> UtteranceVADTracker:
        def on_started() -> None:
            emit_event({
                "type": "speech_started",
                "requestId": request_id,
                "timestamp": int(time.time() * 1000),
            })

        def on_ended() -> None:
            emit_event({
                "type": "speech_ended",
                "requestId": request_id,
                "timestamp": int(time.time() * 1000),
            })
            self._execute_transcription(request_id)

        return UtteranceVADTracker(
            energy_threshold=self.config.energy_threshold,
            silence_duration_sec=self.config.silence_duration_sec,
            min_speech_duration_sec=self.config.min_speech_duration_sec,
            max_utterance_sec=self.config.max_utterance_sec,
            on_speech_started=on_started,
            on_speech_ended=on_ended,
        )

    def _execute_transcription(self, request_id: str) -> None:
        if self.final_emitted or self.tracker is None:
            return

        pcm_bytes = self.tracker.get_audio_bytes()
        if not pcm_bytes:
            return

        self.final_emitted = True
        try:
            t0 = time.time()
            result = self.engine.transcribe_pcm(
                pcm_bytes,
                language_hint=self.current_language,
            )
            elapsed_sec = time.time() - t0
            text = result.get("text", "").strip()

            if text:
                emit_event({
                    "type": "final_transcript",
                    "requestId": request_id,
                    "text": text,
                    "confidence": result.get("confidence", 0.95),
                    "language": result.get("language") or self.current_language,
                    "words": result.get("words", []),
                    "timestamp": int(time.time() * 1000),
                    "durationSec": round(elapsed_sec, 3),
                })
        except Exception as exc:
            emit_event({
                "type": "error",
                "requestId": request_id,
                "error": {
                    "code": "stt_runtime_error",
                    "message": f"Transcription error: {exc}",
                },
                "timestamp": int(time.time() * 1000),
            })

    def run_loop(self) -> None:
        """Main packet reading loop over binary stdin."""
        emit_event({
            "type": "ready",
            "model": self.config.model,
            "device": self.engine.device,
            "computeType": self.engine.compute_type,
            "timestamp": int(time.time() * 1000),
        })

        while True:
            header = read_exact(5)
            if header is None:
                # Stdin pipe closed
                break

            magic = header[0]
            length = struct.unpack(">I", header[1:5])[0]

            payload = read_exact(length)
            if payload is None:
                break

            if magic == 0x01:
                # Control JSON command
                try:
                    cmd_data = json.loads(payload.decode("utf-8"))
                    self._handle_command(cmd_data)
                except Exception as exc:
                    sys.stderr.write(f"STT Server command parse error: {exc}\n")
                    sys.stderr.flush()
            elif magic == 0x02:
                # Audio frame chunk
                if (
                    self.current_request_id is not None
                    and self.tracker is not None
                    and not self.final_emitted
                ):
                    self.tracker.feed_frame(payload)

    def _handle_command(self, cmd: Dict[str, Any]) -> None:
        action = cmd.get("action")
        req_id = cmd.get("requestId", "")

        if action == "start":
            self.current_request_id = req_id
            self.current_language = cmd.get("language") or self.config.language
            self.final_emitted = False
            self.tracker = self._create_tracker(req_id)

            emit_event({
                "type": "started",
                "requestId": req_id,
                "timestamp": int(time.time() * 1000),
            })

        elif action == "end":
            if req_id == self.current_request_id and not self.final_emitted and self.tracker:
                if (
                    self.tracker.state == VADState.SPEAKING
                    or len(self.tracker.get_audio_bytes()) > 0
                ):
                    self.tracker.force_finish()
                    self._execute_transcription(req_id)
            emit_event({
                "type": "completed",
                "requestId": req_id,
                "timestamp": int(time.time() * 1000),
            })
            self.current_request_id = None
            self.tracker = None

        elif action == "cancel":
            reason = cmd.get("reason", "cancelled")
            if req_id == self.current_request_id:
                emit_event({
                    "type": "cancelled",
                    "requestId": req_id,
                    "reason": reason,
                    "timestamp": int(time.time() * 1000),
                })
            self.final_emitted = True
            self.current_request_id = None
            self.tracker = None

        elif action == "health":
            emit_event({
                "type": "health",
                "status": "healthy" if self.engine.is_loaded else "ready",
                "model": self.config.model,
                "device": self.engine.device,
                "computeType": self.engine.compute_type,
                "timestamp": int(time.time() * 1000),
            })

        elif action == "shutdown":
            sys.exit(0)


def run_test_wav(config: STTConfig, wav_path: str) -> None:
    """Offline transcription test of a WAV file."""
    import wave

    if not os.path.exists(wav_path):
        emit_event({"error": f"WAV file not found: {wav_path}"})
        sys.exit(1)

    with wave.open(wav_path, "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        raw_frames = wf.readframes(n_frames)

    engine = STTEngine(config)
    engine.load_model()
    t0 = time.time()
    result = engine.transcribe_pcm(raw_frames, language_hint=config.language)
    elapsed = time.time() - t0

    out = {
        "wav_path": wav_path,
        "sample_rate": framerate,
        "channels": n_channels,
        "duration_sec": round(n_frames / framerate, 3),
        "latency_sec": round(elapsed, 3),
        "text": result.get("text", ""),
        "confidence": result.get("confidence", 0.0),
        "language": result.get("language"),
        "words": result.get("words", []),
    }
    emit_event(out)


def main() -> None:
    parser = argparse.ArgumentParser(description="MAVE faster-whisper STT Service")
    parser.add_argument("--model", type=str, default="large-v3-turbo")
    parser.add_argument("--device", type=str, default="auto")
    parser.add_argument("--compute-type", type=str, default="auto")
    parser.add_argument("--energy-threshold", type=float, default=600.0)
    parser.add_argument("--silence-duration", type=float, default=0.8)
    parser.add_argument("--min-speech-duration", type=float, default=0.3)
    parser.add_argument("--max-utterance", type=float, default=20.0)
    parser.add_argument("--beam-size", type=int, default=5)
    parser.add_argument("--language", type=str, default=None)
    parser.add_argument("--preload", action="store_true")
    parser.add_argument("--test-wav", type=str, default=None)
    args = parser.parse_args()

    config = STTConfig(
        model=args.model,
        device=args.device,
        compute_type=args.compute_type,
        energy_threshold=args.energy_threshold,
        silence_duration_sec=args.silence_duration,
        min_speech_duration_sec=args.min_speech_duration,
        max_utterance_sec=args.max_utterance,
        beam_size=args.beam_size,
        language=args.language,
    )

    if args.test_wav:
        run_test_wav(config, args.test_wav)
        return

    server = STTServer(config)
    if args.preload:
        server.engine.load_model()

    server.run_loop()


if __name__ == "__main__":
    main()
