"""Microphone audio capture process for MAVE Voice Session runtime.

Captures mono S16LE PCM audio using sounddevice and emits canonical
audio frames (16kHz, 16-bit, 1280 samples = 2560 bytes) directly to stdout.
Operates as an isolated, standalone process separate from wake-word detection.
"""

import argparse
import json
import os
import queue
import signal
import sys
import threading
import time
from typing import Any, Dict, List, Optional, Tuple


def set_binary_stdout() -> None:
    """Ensure stdout is configured for raw binary output without line translation."""
    if sys.platform == "win32":
        try:
            import msvcrt

            msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
        except Exception:
            pass


def emit_stderr_event(event_type: str, data: Optional[Dict[str, Any]] = None) -> None:
    """Emit a structured JSON log message to stderr."""
    payload = {"event": event_type, "timestamp": time.time()}
    if data:
        payload.update(data)
    try:
        sys.stderr.write(json.dumps(payload) + "\n")
        sys.stderr.flush()
    except Exception:
        pass


def query_input_devices() -> List[Dict[str, Any]]:
    """Query and return all available audio input devices."""
    devices: List[Dict[str, Any]] = []
    try:
        import sounddevice as sd

        all_devs = sd.query_devices()
        default_input_idx: Optional[int] = None
        try:
            default_pair = sd.default.device
            if default_pair is not None:
                inp = default_pair[0]
                if isinstance(inp, int) and inp >= 0:
                    default_input_idx = inp
        except Exception:
            pass

        for idx, dev in enumerate(all_devs):
            max_in = dev.get("max_input_channels", 0)
            if max_in > 0:
                is_default = (idx == default_input_idx)
                devices.append({
                    "id": str(idx),
                    "label": dev.get("name", f"Microphone {idx}"),
                    "isDefault": is_default,
                    "channels": max_in,
                    "defaultSampleRate": dev.get("default_samplerate", 16000),
                })
    except Exception as exc:
        emit_stderr_event("device_query_error", {"error": str(exc)})
        raise
    return devices


def resolve_device_index(
    device_arg: Optional[str],
    available_devices: List[Dict[str, Any]],
) -> Tuple[Optional[int], str]:
    """Resolve device identifier or name to hardware device index."""
    if not device_arg or device_arg.lower() in ("default", "system_default", ""):
        default_dev = next((d for d in available_devices if d.get("isDefault")), None)
        if default_dev:
            return int(default_dev["id"]), default_dev["label"]
        return None, "System Default Microphone"

    # Check by numeric index / ID
    if device_arg.isdigit():
        idx = int(device_arg)
        match = next((d for d in available_devices if d["id"] == str(idx)), None)
        if match:
            return idx, match["label"]
        return idx, f"Microphone {idx}"

    # Check by substring or exact label match (case-insensitive)
    lower_arg = device_arg.lower()
    for dev in available_devices:
        if lower_arg in dev["label"].lower():
            return int(dev["id"]), dev["label"]

    raise ValueError(f"Specified audio input device '{device_arg}' not found")


class VoiceAudioCapture:
    """Manages sounddevice capture and streams raw PCM chunks to stdout."""

    def __init__(
        self,
        sample_rate: int = 16000,
        chunk_size: int = 1280,
        device_index: Optional[int] = None,
        discard_initial_chunks: int = 2,
        max_queue_size: int = 100,
    ):
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.device_index = device_index
        self.discard_initial_chunks = discard_initial_chunks
        self.max_queue_size = max_queue_size

        self._queue: queue.Queue = queue.Queue(maxsize=max_queue_size)
        self._stop_event = threading.Event()
        self._stream: Optional[Any] = None
        self._overflow_count = 0
        self._frames_emitted = 0

    def _audio_callback(
        self, indata: Any, frames: int, time_info: Any, status: Any
    ) -> None:
        """Hardware callback from sounddevice."""
        if self._stop_event.is_set():
            return

        # indata has shape (chunk_size, 1) and dtype int16
        # tobytes() produces chunk_size * 2 bytes of little-endian PCM
        data_bytes = indata.tobytes()
        try:
            self._queue.put_nowait(data_bytes)
        except queue.Full:
            # Drop oldest frame to prioritize real-time low-latency audio
            try:
                self._queue.get_nowait()
                self._queue.put_nowait(data_bytes)
                self._overflow_count += 1
            except Exception:
                pass

    def start_stream(self) -> None:
        """Open and start sounddevice stream."""
        import sounddevice as sd

        self._stream = sd.InputStream(
            samplerate=self.sample_rate,
            blocksize=self.chunk_size,
            device=self.device_index,
            channels=1,
            dtype="int16",
            callback=self._audio_callback,
        )
        self._stream.start()

    def stop_stream(self) -> None:
        """Stop and close sounddevice stream safely."""
        self._stop_event.set()
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception as exc:
                emit_stderr_event("stream_close_error", {"error": str(exc)})
            self._stream = None

    def run(self) -> None:
        """Main capture loop streaming chunks to stdout buffer."""
        discard_remaining = self.discard_initial_chunks

        while not self._stop_event.is_set():
            try:
                chunk = self._queue.get(timeout=0.1)
            except queue.Empty:
                continue

            if discard_remaining > 0:
                discard_remaining -= 1
                continue

            try:
                sys.stdout.buffer.write(chunk)
                sys.stdout.buffer.flush()
                self._frames_emitted += 1
            except (BrokenPipeError, OSError):
                # Downstream consumer closed stdout pipe
                break

    @property
    def stats(self) -> Dict[str, Any]:
        return {
            "frames_emitted": self._frames_emitted,
            "overflow_count": self._overflow_count,
        }


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="MAVE Voice Session Audio Capture Process"
    )
    parser.add_argument(
        "--list-devices",
        action="store_true",
        help="List available audio input devices as JSON and exit",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=None,
        help="Audio input device ID, index, or name",
    )
    parser.add_argument(
        "--sample-rate",
        type=int,
        default=16000,
        help="Audio sample rate (default: 16000)",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=1280,
        help="Frame chunk size in samples (default: 1280)",
    )
    parser.add_argument(
        "--discard-initial-chunks",
        type=int,
        default=2,
        help="Number of initial frames to discard to stabilize hardware (default: 2)",
    )
    parser.add_argument(
        "--max-queue-size",
        type=int,
        default=100,
        help="Maximum buffer queue size before dropping frames (default: 100)",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)

    if args.list_devices:
        try:
            devs = query_input_devices()
            # Clean device list matching canonical AudioInputDevice schema
            output = [
                {
                    "id": d["id"],
                    "label": d["label"],
                    "isDefault": d["isDefault"],
                }
                for d in devs
            ]
            sys.stdout.write(json.dumps(output) + "\n")
            sys.stdout.flush()
            return 0
        except Exception as exc:
            emit_stderr_event("error", {"error": str(exc), "type": "device_query_error"})
            return 1

    set_binary_stdout()

    try:
        available = query_input_devices()
        dev_idx, dev_label = resolve_device_index(args.device, available)
    except Exception as exc:
        emit_stderr_event("error", {"error": str(exc), "type": "device_resolution_error"})
        return 1

    capture = VoiceAudioCapture(
        sample_rate=args.sample_rate,
        chunk_size=args.chunk_size,
        device_index=dev_idx,
        discard_initial_chunks=args.discard_initial_chunks,
        max_queue_size=args.max_queue_size,
    )

    # Signal handlers for graceful shutdown
    def handle_signal(sig: int, frame: Any) -> None:
        capture.stop_stream()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    emit_stderr_event(
        "started",
        {
            "device_index": dev_idx,
            "device_label": dev_label,
            "sample_rate": args.sample_rate,
            "chunk_size": args.chunk_size,
            "frame_bytes": args.chunk_size * 2,
        },
    )

    try:
        capture.start_stream()
        capture.run()
    except Exception as exc:
        emit_stderr_event("error", {"error": str(exc), "type": "capture_runtime_error"})
        return 1
    finally:
        capture.stop_stream()
        emit_stderr_event("stopped", capture.stats)

    return 0


if __name__ == "__main__":
    sys.exit(main())
