"""Microphone audio capture using sounddevice."""

import queue
import threading
from typing import Any, Callable, Dict, List, Optional, Tuple
import numpy as np

from .protocol import log_debug, log_error, log_info


class AudioCapture:
    """Manages local microphone streaming using sounddevice."""

    def __init__(
        self,
        sample_rate: int = 16000,
        chunk_size: int = 1280,
        device_index: Optional[int] = None,
        on_chunk: Optional[Callable[[np.ndarray], None]] = None,
    ):
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.device_index = device_index
        self.on_chunk = on_chunk
        self.is_recording = False
        self._stream: Optional[Any] = None
        self._thread: Optional[threading.Thread] = None
        self._queue: queue.Queue = queue.Queue(maxsize=100)
        self._stop_event = threading.Event()

    @staticmethod
    def get_available_devices() -> List[Dict[str, Any]]:
        """List available audio input devices."""
        devices: List[Dict[str, Any]] = []
        try:
            import sounddevice as sd

            all_devs = sd.query_devices()
            for idx, dev in enumerate(all_devs):
                if dev.get("max_input_channels", 0) > 0:
                    devices.append(
                        {
                            "index": idx,
                            "name": dev.get("name", f"Microphone {idx}"),
                            "channels": dev.get("max_input_channels", 1),
                            "default_samplerate": dev.get("default_samplerate", 16000),
                        }
                    )
        except Exception as exc:
            log_error(f"Failed to query audio devices: {exc}")
        return devices

    @staticmethod
    def get_default_device_name() -> str:
        """Get the system default input device name."""
        try:
            import sounddevice as sd

            default_idx = sd.default.device[0]
            if default_idx is not None and default_idx >= 0:
                dev_info = sd.query_devices(default_idx)
                return str(dev_info.get("name", "Default Microphone"))
        except Exception:
            pass
        return "Default System Microphone"

    def _audio_callback(self, indata: np.ndarray, frames: int, time_info: Any, status: Any) -> None:
        """Callback invoked by sounddevice on audio hardware thread."""
        if status:
            log_debug(f"Audio stream status: {status}")
        if self.is_recording:
            try:
                # Copy audio buffer and put into queue
                chunk = indata.copy().reshape(-1)
                self._queue.put_nowait(chunk)
            except queue.Full:
                # Drop oldest frame on buffer overflow to prevent lag
                try:
                    self._queue.get_nowait()
                    self._queue.put_nowait(indata.copy().reshape(-1))
                except Exception:
                    pass

    def _worker_loop(self) -> None:
        """Worker thread processing audio chunks from queue."""
        while not self._stop_event.is_set():
            try:
                chunk = self._queue.get(timeout=0.1)
                if self.on_chunk and self.is_recording:
                    try:
                        self.on_chunk(chunk)
                    except Exception as exc:
                        log_error(f"Error in audio chunk processor: {exc}")
            except queue.Empty:
                continue

    def start(self) -> Tuple[bool, Optional[str]]:
        """Start microphone capture stream."""
        if self.is_recording:
            return True, None

        devices = self.get_available_devices()
        if not devices:
            msg = "No audio input devices detected on machine"
            log_error(msg)
            return False, msg

        try:
            import sounddevice as sd

            self._stop_event.clear()
            # Drain queue
            while not self._queue.empty():
                try:
                    self._queue.get_nowait()
                except queue.Empty:
                    break

            dev_to_use = self.device_index if self.device_index is not None else None
            self._stream = sd.InputStream(
                samplerate=self.sample_rate,
                blocksize=self.chunk_size,
                device=dev_to_use,
                channels=1,
                dtype="int16",
                callback=self._audio_callback,
            )
            self._stream.start()
            self.is_recording = True

            self._thread = threading.Thread(target=self._worker_loop, daemon=True)
            self._thread.start()

            log_info(f"Microphone capture started (device: {dev_to_use}, chunk_size: {self.chunk_size})")
            return True, None
        except Exception as exc:
            self.is_recording = False
            msg = f"Failed to start audio stream: {exc}"
            log_error(msg)
            return False, msg

    def stop(self) -> None:
        """Stop microphone capture stream."""
        if not self.is_recording:
            return

        self.is_recording = False
        self._stop_event.set()

        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception as exc:
                log_debug(f"Error closing audio stream: {exc}")
            self._stream = None

        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=0.5)
            self._thread = None

        log_info("Microphone capture stopped")

