"""Main stdio server process for MAVE Text-to-Speech service."""

import argparse
import asyncio
import base64
import json
import os
import struct
import sys
import time
from typing import Any, Dict, Optional

from .config import TTSConfig
from .voxcpm_engine import create_engine

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


def get_pipe_available_bytes(fd: int = 0) -> int:
    """Check how many bytes are waiting in the pipe without blocking."""
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes
            import msvcrt

            kernel32 = ctypes.windll.kernel32
            handle = msvcrt.get_osfhandle(fd)
            avail = wintypes.DWORD()
            ok = kernel32.PeekNamedPipe(
                wintypes.HANDLE(handle),
                None,
                0,
                None,
                ctypes.byref(avail),
                None,
            )
            if not ok:
                return 0
            return avail.value
        except Exception:
            return 0
    else:
        try:
            import select

            r, _, _ = select.select([fd], [], [], 0)
            return 4096 if r else 0
        except Exception:
            return 0


async def read_exact_async(n: int) -> Optional[bytes]:
    """Read exactly n bytes from stdin without blocking the asyncio event loop."""
    data = bytearray()
    while len(data) < n:
        needed = n - len(data)
        avail = get_pipe_available_bytes(0)
        if avail > 0:
            to_read = min(needed, avail)
            chunk = os.read(0, to_read)
            if not chunk:
                return None
            data.extend(chunk)
        else:
            await asyncio.sleep(0.01)
    return bytes(data)


class TTSServer:
    """Manages stdio communication and streaming speech synthesis asynchronously."""

    def __init__(self, config: TTSConfig):
        self.config = config
        self.engine = create_engine(config)
        self.active_task: Optional[asyncio.Task] = None
        self.active_request_id: Optional[str] = None
        self.active_cancelled = False

    def run_loop(self) -> None:
        """Entrypoint for running the server on the asyncio event loop."""
        asyncio.run(self.run())

    async def run(self) -> None:
        """Main non-blocking async execution loop."""
        emit_event({
            "type": "ready",
            "engine": getattr(self.engine, "name", "edge-tts"),
            "defaultVoiceTh": self.config.default_voice_th,
            "defaultVoiceEn": self.config.default_voice_en,
            "sampleRate": self.config.sample_rate,
            "channels": self.config.channels,
            "timestamp": int(time.time() * 1000),
        })

        while True:
            header = await read_exact_async(5)
            if header is None:
                break

            magic = header[0]
            length = struct.unpack(">I", header[1:5])[0]

            payload = await read_exact_async(length)
            if payload is None:
                break

            if magic == 0x01:
                try:
                    cmd = json.loads(payload.decode("utf-8"))
                    self._handle_command(cmd)
                except Exception as exc:
                    sys.stderr.write(f"TTS Server command error: {exc}\n")
                    sys.stderr.flush()

    def _handle_command(self, cmd: Dict[str, Any]) -> None:
        action = cmd.get("action")
        req_id = cmd.get("requestId", "")

        if action == "synthesize":
            if self.active_task and not self.active_task.done():
                self.active_task.cancel()
            self.active_request_id = req_id
            self.active_cancelled = False
            text = cmd.get("text", "")
            language = cmd.get("language")
            voice = cmd.get("voice")
            rate = cmd.get("rate", 1.0)
            pitch = cmd.get("pitch", 1.0)

            try:
                loop = asyncio.get_running_loop()
                self.active_task = loop.create_task(
                    self._execute_synthesis(req_id, text, language, voice, rate, pitch)
                )
            except RuntimeError:
                pass

        elif action == "cancel":
            reason = cmd.get("reason", "cancelled")
            if req_id == self.active_request_id:
                self.active_cancelled = True
                if self.active_task and not self.active_task.done():
                    self.active_task.cancel()
                emit_event({
                    "type": "cancelled",
                    "requestId": req_id,
                    "reason": reason,
                    "timestamp": int(time.time() * 1000),
                })
                self.active_request_id = None

        elif action == "health":
            emit_event({
                "type": "health",
                "status": "healthy",
                "timestamp": int(time.time() * 1000),
            })

        elif action == "shutdown":
            sys.exit(0)

    async def _execute_synthesis(
        self,
        req_id: str,
        text: str,
        language: Optional[str],
        voice: Optional[str],
        rate: Optional[float],
        pitch: Optional[float],
    ) -> None:
        emit_event({
            "type": "started",
            "requestId": req_id,
            "timestamp": int(time.time() * 1000),
        })

        t0 = time.time()
        seq = 0
        total_samples = 0

        try:
            async for frame in self.engine.synthesize_stream(
                text=text,
                voice=voice,
                rate=rate,
                pitch=pitch,
                language=language,
            ):
                if self.active_cancelled or req_id != self.active_request_id:
                    break

                b64_data = base64.b64encode(frame).decode("ascii")
                total_samples += len(frame) // 2

                emit_event({
                    "type": "audio",
                    "requestId": req_id,
                    "sequence": seq,
                    "timestampMs": int((total_samples / self.config.sample_rate) * 1000),
                    "data": b64_data,
                    "timestamp": int(time.time() * 1000),
                })
                seq += 1

            if not self.active_cancelled and req_id == self.active_request_id:
                duration_ms = int(round((total_samples / self.config.sample_rate) * 1000))
                emit_event({
                    "type": "completed",
                    "requestId": req_id,
                    "durationMs": duration_ms,
                    "latencySec": round(time.time() - t0, 3),
                    "timestamp": int(time.time() * 1000),
                })
                self.active_request_id = None
        except asyncio.CancelledError:
            if req_id == self.active_request_id:
                emit_event({
                    "type": "cancelled",
                    "requestId": req_id,
                    "reason": "cancelled",
                    "timestamp": int(time.time() * 1000),
                })
                self.active_request_id = None
        except Exception as exc:
            if not self.active_cancelled and req_id == self.active_request_id:
                emit_event({
                    "type": "error",
                    "requestId": req_id,
                    "error": {
                        "code": "tts_runtime_error",
                        "message": f"Synthesis failed: {exc}",
                    },
                    "timestamp": int(time.time() * 1000),
                })
                self.active_request_id = None


def run_cli_test(text: str, voice: Optional[str] = None) -> None:
    """Quick offline CLI test."""
    config = TTSConfig()
    engine = create_engine(config)

    async def _test() -> None:
        t0 = time.time()
        pcm = await engine.synthesize_full(text, voice=voice)
        elapsed = time.time() - t0
        dur = len(pcm) / (16000 * 2)
        print(f"Synthesized '{text}' in {elapsed:.3f}s: {len(pcm)} bytes PCM ({dur:.2f}s audio)")

    asyncio.run(_test())


def main() -> None:
    parser = argparse.ArgumentParser(description="MAVE Text-to-Speech Service")
    parser.add_argument("--test-text", type=str, default=None, help="Synthesize text to console")
    parser.add_argument("--voice", type=str, default=None, help="Voice to use for synthesis")
    args = parser.parse_args()

    if args.test_text:
        run_cli_test(args.test_text, voice=args.voice)
        return

    config = TTSConfig()
    server = TTSServer(config)
    server.run_loop()


if __name__ == "__main__":
    main()
