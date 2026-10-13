"""Unit tests for MAVE Text-to-Speech & Audio Output service."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from mave_tts.config import TTSConfig, DEFAULT_THAI_VOICE, DEFAULT_ENGLISH_VOICE
from mave_tts.engine import TTSEngine
from mave_tts.server import TTSServer
from mave_tts.audio_output import query_output_devices, SounddevicePlayer


def test_config_voice_resolution():
    cfg = TTSConfig()
    assert cfg.resolve_voice(language="th") == DEFAULT_THAI_VOICE
    assert cfg.resolve_voice(language="th-TH") == DEFAULT_THAI_VOICE
    assert cfg.resolve_voice(language="en") == DEFAULT_ENGLISH_VOICE
    assert cfg.resolve_voice(language="en-US") == DEFAULT_ENGLISH_VOICE
    assert cfg.resolve_voice(voice_id="th-female") == "th-TH-PremwadeeNeural"
    assert cfg.resolve_voice(voice_id="custom-voice") == "custom-voice"


def test_rate_pitch_mapping():
    assert TTSConfig.map_rate(1.0) == "+0%"
    assert TTSConfig.map_rate(1.2) == "+20%"
    assert TTSConfig.map_rate(0.8) == "-20%"
    assert TTSConfig.map_rate(None) == "+0%"

    assert TTSConfig.map_pitch(1.0) == "+0Hz"
    assert TTSConfig.map_pitch(1.2) == "+10Hz"
    assert TTSConfig.map_pitch(0.8) == "-10Hz"


def test_engine_streaming_with_mocked_communicate(monkeypatch):
    async def _test():
        cfg = TTSConfig()
        engine = TTSEngine(cfg)

        # Mock edge_tts.Communicate
        mock_comm = MagicMock()

        async def fake_stream():
            yield {"type": "SentenceBoundary"}
            yield {"type": "audio", "data": b"\xff\xfb\x90\x00" * 200}

        mock_comm.stream = fake_stream

        with patch("edge_tts.Communicate", return_value=mock_comm):
            with patch("av.CodecContext.create") as mock_codec_create:
                mock_codec = MagicMock()
                mock_packet = MagicMock()
                mock_codec.parse.return_value = [mock_packet]
                mock_frame = MagicMock()
                mock_codec.decode.side_effect = [[mock_frame], []]
                mock_codec_create.return_value = mock_codec

                with patch("av.AudioResampler") as mock_resampler_create:
                    mock_resampler = MagicMock()
                    mock_resampled = MagicMock()
                    mock_resampled.to_ndarray.return_value.tobytes.return_value = b"\x00" * 2560
                    mock_resampler.resample.return_value = [mock_resampled]
                    mock_resampler_create.return_value = mock_resampler

                    frames = []
                    async for f in engine.synthesize_stream("สวัสดี"):
                        frames.append(f)

                    assert len(frames) > 0
                    assert len(frames[0]) == 2560

    asyncio.run(_test())


def test_server_protocol_commands(monkeypatch):
    cfg = TTSConfig()
    server = TTSServer(cfg)
    events = []

    def mock_emit(evt):
        events.append(evt)

    monkeypatch.setattr("mave_tts.server.emit_event", mock_emit)

    server._handle_command({"action": "health"})
    assert any(e["type"] == "health" and e["status"] == "healthy" for e in events)

    server._handle_command({"action": "cancel", "requestId": "req-1", "reason": "user_cancelled"})


def test_audio_output_player_controls(monkeypatch):
    player = SounddevicePlayer()

    # Mock stream
    mock_stream = MagicMock()
    mock_stream.closed = False
    mock_stream.stopped = False
    player.stream = mock_stream

    # Test write PCM
    pcm_chunk = b"\x10\x00" * 1280
    events = []
    monkeypatch.setattr("mave_tts.audio_output.emit_event", lambda e: events.append(e))

    player.write_pcm(pcm_chunk)
    assert player.state == "playing"
    assert mock_stream.write.called
    assert any(e["type"] == "level" for e in events)

    # Test pause
    player.pause()
    assert player.state == "paused"
    assert mock_stream.stop.called

    # Test resume
    player.resume()
    assert player.state == "playing"
    assert mock_stream.start.called

    # Test stop (barge-in path)
    player.stop()
    assert player.state == "idle"
    assert any(e["type"] == "state" and e["state"] == "stopped" for e in events)


def test_query_output_devices(monkeypatch):
    fake_devices = [
        {"name": "Speakers (Realtek Audio)", "max_output_channels": 2},
        {"name": "Microphone (FIFINE K690)", "max_output_channels": 0},
    ]
    monkeypatch.setattr("sounddevice.query_devices", lambda: fake_devices)
    monkeypatch.setattr("sounddevice.default", MagicMock(device=(-1, 0)))

    devs = query_output_devices()
    assert len(devs) == 1
    assert devs[0]["label"] == "Speakers (Realtek Audio)"
    assert devs[0]["isDefault"] is True
