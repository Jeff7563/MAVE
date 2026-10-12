"""Main executable entrypoint for MAVE openWakeWord daemon."""

import argparse
from collections import deque
import sys
import threading
import time
from pathlib import Path
from typing import Deque, Optional, Tuple

from .audio import AudioCapture
from .config import WakeConfig
from .engine import WakeEngine
from .protocol import (
    emit_devices,
    emit_error,
    emit_status,
    emit_telemetry,
    emit_test_audio_result,
    emit_wake_detected,
    log_info,
    parse_command,
)


class WakeService:
    """Coordinates engine, audio capture, and protocol communication."""

    def __init__(self, config: WakeConfig, base_dir: Optional[Path] = None):
        self.config = config
        self.base_dir = base_dir if base_dir is not None else Path.cwd()
        self.engine = WakeEngine(self.config, self.base_dir)
        self.audio = AudioCapture(
            sample_rate=self.config.sample_rate,
            chunk_size=self.config.chunk_size,
            device_index=self.config.device_index,
            on_chunk=self._on_audio_chunk,
        )
        self.status = "initializing"
        self._is_running = True
        self._last_wake_time = 0.0
        self._rearm_until = 0.0
        self._last_telemetry_time = 0.0
        self.latest_score: float = 0.0
        self.last_wake_score: Optional[float] = None
        self._recent_scores: Deque[Tuple[float, float]] = deque()
        self.recent_window_seconds = 4.0

    def _update_scores(self, score: float, now: float) -> Tuple[float, float]:
        """Update sliding window of scores and compute current and peak score."""
        cutoff = now - self.recent_window_seconds
        while self._recent_scores and self._recent_scores[0][0] < cutoff:
            self._recent_scores.popleft()
        self._recent_scores.append((now, score))
        peak = max((s for _, s in self._recent_scores), default=0.0)
        return score, peak

    def get_peak_score(self) -> float:
        """Get peak score within the recent window."""
        now = time.time()
        cutoff = now - self.recent_window_seconds
        while self._recent_scores and self._recent_scores[0][0] < cutoff:
            self._recent_scores.popleft()
        return max((s for _, s in self._recent_scores), default=0.0)

    def initialize(self) -> None:
        """Initialize models and determine ready status."""
        is_loaded, error_msg = self.engine.load_model()
        if is_loaded:
            self.status = "ready"
        elif not self.config.is_model_available(self.base_dir):
            self.status = "not_configured"
        else:
            self.status = "error"

        self.emit_current_status(error_msg)

    def emit_current_status(self, error_message: Optional[str] = None) -> None:
        """Send current status event to stdout."""
        devices = self.audio.get_available_devices()
        dev_names = [d["name"] for d in devices]

        current_dev_name = self.audio.get_default_device_name()
        if self.config.device_index is not None:
            for d in devices:
                if d["index"] == self.config.device_index:
                    current_dev_name = d["name"]
                    break

        emit_status(
            status=self.status,
            device=current_dev_name,
            device_index=self.config.device_index,
            threshold=self.config.threshold,
            model_path=str(self.config.resolved_model_path(self.base_dir)),
            model_loaded=self.engine.is_loaded,
            available_devices=dev_names,
            error_message=error_message or getattr(self.engine, "error_message", None),
            latest_score=self.latest_score,
            peak_score=self.get_peak_score(),
            last_wake_score=self.last_wake_score,
        )

    def _on_audio_chunk(self, chunk) -> None:
        """Callback from audio thread processing live chunk."""
        score = self.engine.process_chunk(chunk)
        now = time.time()
        self.latest_score, peak_score = self._update_scores(score, now)

        is_rearming = now < self._rearm_until
        cooldown_elapsed = (now - self._last_wake_time) > self.config.cooldown_seconds

        if not is_rearming and score >= self.config.threshold and cooldown_elapsed:
            self._last_wake_time = now
            self.last_wake_score = score
            emit_wake_detected(self.config.model_name, score)
            # CRITICAL: Reset inference state immediately to flush the detected wake phrase
            self.engine.reset()
            self.latest_score = 0.0
            self._last_telemetry_time = now
            emit_telemetry(self.latest_score, peak_score, self.last_wake_score, self.config.threshold)
        elif now - self._last_telemetry_time >= 0.25:
            self._last_telemetry_time = now
            emit_telemetry(self.latest_score, peak_score, self.last_wake_score, self.config.threshold)

    def start_listening(self) -> None:
        """Start listening loop."""
        if self.status == "listening" and self.audio.is_recording:
            return

        if not self.engine.is_loaded:
            self.engine.load_model()

        # CRITICAL: Reset model state and clear live scores before starting new session
        self.engine.reset()
        self.latest_score = 0.0
        self._recent_scores.clear()

        # Re-arm guard: suppress wake detection during the first short period
        self._rearm_until = time.time() + (self.config.rearm_guard_ms / 1000.0)

        success, err = self.audio.start()
        if success:
            self.status = "listening"
            self.emit_current_status()
            emit_telemetry(self.latest_score, 0.0, self.last_wake_score, self.config.threshold)
            self._last_telemetry_time = time.time()
        else:
            self.status = "error"
            self.emit_current_status(err)

    def stop_listening(self) -> None:
        """Stop listening loop."""
        if self.status != "listening" and not self.audio.is_recording:
            return

        self.audio.stop()
        # CRITICAL: Reset model state upon stopping listening session
        self.engine.reset()
        self.latest_score = 0.0

        self.status = (
            "ready"
            if self.engine.is_loaded
            else ("not_configured" if not self.config.is_model_available(self.base_dir) else "error")
        )
        self.emit_current_status()
        emit_telemetry(self.latest_score, self.get_peak_score(), self.last_wake_score, self.config.threshold)

    def set_device(self, device_index: int) -> None:
        """Switch audio input device."""
        was_recording = self.audio.is_recording
        if was_recording:
            self.audio.stop()

        self.config.device_index = device_index if device_index >= 0 else None
        self.audio.device_index = self.config.device_index

        if was_recording:
            self.start_listening()
        else:
            self.emit_current_status()

    def set_threshold(self, threshold: float) -> None:
        """Adjust detection threshold."""
        self.config.threshold = max(0.0, min(1.0, threshold))
        self.emit_current_status()

    def test_audio_file(self, wav_path: str) -> None:
        """Diagnostic offline WAV processing path."""
        result = self.engine.process_wav_file(wav_path, self.config.threshold)
        emit_test_audio_result(
            path=result.get("path", wav_path),
            max_score=result.get("max_score", 0.0),
            wake_detected=result.get("wake_detected", False),
            frames_processed=result.get("frames_processed", 0),
            scores=result.get("scores"),
            error=result.get("error"),
        )

    def run_stdio_loop(self) -> None:
        """Main stdio loop reading newline-delimited JSON commands."""
        self.initialize()
        log_info("MAVE wake service ready; listening on stdin for commands")

        for line in sys.stdin:
            if not self._is_running:
                break
            cmd_data = parse_command(line)
            if not cmd_data:
                continue

            command = cmd_data.get("command")
            if command == "start":
                self.start_listening()
            elif command == "stop":
                self.stop_listening()
            elif command == "reset":
                self.engine.reset()
                self.latest_score = 0.0
                self._recent_scores.clear()
                emit_telemetry(0.0, 0.0, self.last_wake_score, self.config.threshold)
            elif command == "get_status":
                self.emit_current_status()
            elif command == "get_devices":
                devices = self.audio.get_available_devices()
                default = self.audio.get_default_device_name()
                emit_devices([d["name"] for d in devices], default)
            elif command == "set_device":
                idx = cmd_data.get("index", -1)
                self.set_device(int(idx))
            elif command == "set_threshold":
                thresh = float(cmd_data.get("threshold", 0.5))
                self.set_threshold(thresh)
            elif command == "test_audio_file":
                path = str(cmd_data.get("path", ""))
                self.test_audio_file(path)
            elif command == "quit":
                log_info("Received quit command; shutting down")
                self.stop_listening()
                self._is_running = False
                break
            else:
                emit_error("UNKNOWN_COMMAND", f"Unrecognized command: {command}")

        self.audio.stop()


def main() -> None:
    """CLI Entrypoint."""
    parser = argparse.ArgumentParser(description="MAVE openWakeWord Service")
    parser.add_argument("--model", type=str, default="assets/wake/mave.onnx", help="Path to wake ONNX model")
    parser.add_argument("--threshold", type=float, default=0.5, help="Wake detection threshold [0.0 - 1.0]")
    parser.add_argument("--device", type=int, default=None, help="Audio input device index")
    parser.add_argument("--test-wav", type=str, default=None, help="Run offline WAV file test and output result")
    args = parser.parse_args()

    config = WakeConfig(
        model_path=args.model,
        threshold=args.threshold,
        device_index=args.device,
    )

    service = WakeService(config)

    # Developer-only offline audio-file test path via CLI
    if args.test_wav:
        service.engine.load_model()
        service.test_audio_file(args.test_wav)
        return

    # Normal daemon mode
    service.run_stdio_loop()


if __name__ == "__main__":
    main()

