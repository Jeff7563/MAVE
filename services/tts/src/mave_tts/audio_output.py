"""Audio Output playback service streaming PCM audio to speakers using sounddevice."""

import argparse
import json
import os
import struct
import sys
import threading
import time
from typing import Any, Dict, List, Optional
import numpy as np
import sounddevice as sd

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


def query_output_devices() -> List[Dict[str, Any]]:
    """Query available audio output hardware devices."""
    devices = sd.query_devices()
    default_dev = sd.default.device[1]
    res = []
    seen = set()
    for idx, d in enumerate(devices):
        if d.get("max_output_channels", 0) > 0:
            name = d.get("name", f"Output Device {idx}")
            if name not in seen:
                seen.add(name)
                res.append({
                    "id": str(idx),
                    "label": name,
                    "isDefault": (idx == default_dev),
                })
    return res


def read_exact(n: int) -> Optional[bytes]:
    """Read exactly n bytes from binary stdin buffer, or None on EOF."""
    data = bytearray()
    while len(data) < n:
        chunk = sys.stdin.buffer.read(n - len(data))
        if not chunk:
            return None
        data.extend(chunk)
    return bytes(data)


class SounddevicePlayer:
    """Manages audio playback lifecycle, volume scaling, and telemetry."""

    def __init__(
        self,
        sample_rate: int = 16000,
        channels: int = 1,
        device_index: Optional[int] = None,
    ):
        self.sample_rate = sample_rate
        self.channels = channels
        self.device_index = device_index
        self.volume = 1.0
        self.state = "idle"  # idle, playing, paused, stopped
        self.stream: Optional[sd.RawOutputStream] = None
        self._lock = threading.Lock()

    def _ensure_stream(self) -> sd.RawOutputStream:
        if self.stream is None or self.stream.closed:
            self.stream = sd.RawOutputStream(
                samplerate=self.sample_rate,
                channels=self.channels,
                dtype="int16",
                device=self.device_index,
            )
            self.stream.start()
        elif self.stream.stopped:
            self.stream.start()
        return self.stream

    def write_pcm(self, pcm_bytes: bytes) -> None:
        """Play raw PCM chunk, scaling volume and computing RMS telemetry."""
        with self._lock:
            if self.state in ("stopped", "paused") or len(pcm_bytes) == 0:
                return

            self.state = "playing"
            stream = self._ensure_stream()

            # Process volume and RMS
            samples = np.frombuffer(pcm_bytes, dtype=np.int16)
            if abs(self.volume - 1.0) > 0.01:
                scaled = (samples.astype(np.float32) * self.volume).clip(-32768, 32767).astype(np.int16)
                out_bytes = scaled.tobytes()
            else:
                out_bytes = pcm_bytes

            # Telemetry RMS
            if len(samples) > 0:
                float_norm = samples.astype(np.float32) / 32768.0
                rms = float(np.sqrt(np.mean(float_norm ** 2)))
                emit_event({
                    "type": "level",
                    "rms": round(min(1.0, max(0.0, rms)), 4),
                    "timestampMs": int(time.time() * 1000),
                })

            try:
                stream.write(out_bytes)
            except Exception as exc:
                sys.stderr.write(f"Audio write exception: {exc}\n")
                sys.stderr.flush()

    def stop(self) -> None:
        """Immediately stop playback and discard queued audio (barge-in)."""
        with self._lock:
            self.state = "stopped"
            if self.stream is not None:
                try:
                    self.stream.stop()
                    self.stream.close()
                except Exception:
                    pass
                self.stream = None
            self.state = "idle"
            emit_event({
                "type": "state",
                "state": "stopped",
                "timestampMs": int(time.time() * 1000),
            })

    def pause(self) -> None:
        """Pause playback stream."""
        with self._lock:
            self.state = "paused"
            if self.stream is not None:
                try:
                    self.stream.stop()
                except Exception:
                    pass
            emit_event({
                "type": "state",
                "state": "paused",
                "timestampMs": int(time.time() * 1000),
            })

    def resume(self) -> None:
        """Resume paused stream."""
        with self._lock:
            if self.state == "paused":
                self.state = "playing"
                if self.stream is not None:
                    try:
                        self.stream.start()
                    except Exception:
                        pass
            emit_event({
                "type": "state",
                "state": "playing",
                "timestampMs": int(time.time() * 1000),
            })

    def set_volume(self, vol: float) -> None:
        """Set output volume multiplier (0.0 - 1.0)."""
        with self._lock:
            self.volume = max(0.0, min(1.0, float(vol)))

    def close(self) -> None:
        """Cleanly close player resources."""
        with self._lock:
            if self.stream is not None:
                try:
                    self.stream.stop()
                    self.stream.close()
                except Exception:
                    pass
                self.stream = None
            self.state = "idle"


def run_playback_loop(device_index: Optional[int] = None) -> None:
    """Main stdio playback loop receiving framed binary packets."""
    player = SounddevicePlayer(device_index=device_index)
    emit_event({
        "type": "ready",
        "sampleRate": 16000,
        "channels": 1,
        "deviceIndex": device_index,
        "timestampMs": int(time.time() * 1000),
    })

    try:
        while True:
            header = read_exact(5)
            if header is None:
                break

            magic = header[0]
            length = struct.unpack(">I", header[1:5])[0]

            payload = read_exact(length)
            if payload is None:
                break

            if magic == 0x01:
                # Control command JSON
                try:
                    cmd = json.loads(payload.decode("utf-8"))
                    action = cmd.get("action")
                    if action == "stop":
                        player.stop()
                    elif action == "pause":
                        player.pause()
                    elif action == "resume":
                        player.resume()
                    elif action == "volume":
                        player.set_volume(float(cmd.get("value", 1.0)))
                    elif action == "state":
                        emit_event({
                            "type": "state",
                            "state": player.state,
                            "timestampMs": int(time.time() * 1000),
                        })
                    elif action == "end":
                        # Turn playback finished
                        player.state = "idle"
                        emit_event({
                            "type": "playback_completed",
                            "timestampMs": int(time.time() * 1000),
                        })
                    elif action == "shutdown":
                        break
                except Exception as exc:
                    sys.stderr.write(f"AudioOutput command parse error: {exc}\n")
                    sys.stderr.flush()
            elif magic == 0x02:
                # PCM frame chunk
                player.write_pcm(payload)
    finally:
        player.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="MAVE Audio Output Service")
    parser.add_argument("--list-devices", action="store_true", help="Print available output devices as JSON")
    parser.add_argument("--device-index", type=int, default=None, help="Device index to use for audio output")
    args = parser.parse_args()

    if args.list_devices:
        devices = query_output_devices()
        print(json.dumps(devices, ensure_ascii=False))
        return

    run_playback_loop(device_index=args.device_index)


if __name__ == "__main__":
    main()
