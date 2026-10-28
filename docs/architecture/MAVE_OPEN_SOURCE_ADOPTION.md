# MAVE Open Source Adoption Plan

**Updated:** 2026-10-28
**Principle:** ใช้ open source ที่ดีอยู่แล้วแทนการเขียนเอง เพื่อลดเวลา — แต่ต้องเสียบผ่าน contract/adapter ของ MAVE เสมอ (provider-independent) จะได้เปลี่ยนตัวได้ภายหลัง

Status legend: ✅ adopted · 🧪 adapter ready, needs live test · 📋 recommended next · 👀 watch

---

## 1. Brain (thinking)

| Need | Choice | Status | Why / how it plugs in |
|---|---|---|---|
| Fast conversation (TTFT < 1.5 s) | Any OpenAI-compatible API: **Groq**, Cerebras, **Gemini Flash** (OpenAI endpoint), OpenRouter | 🧪 | `OpenAICompatibleBrainProvider` — set `MAVE_FAST_BRAIN`. Closes the ~9 s Antigravity gap |
| Local / offline brain | **Ollama** or LM Studio with Qwen 2.5/3 (good Thai) | 🧪 | Same adapter, `MAVE_FAST_BRAIN=ollama`, no key |
| Agent work | Official CLIs: **Claude Code** (`claude -p`), **Codex** (`codex exec`), **Antigravity** (`agy`) | 🧪 | `agent.delegate` tool, uses the user's own signed-in subscriptions (no token reuse) |

## 2. Voice

| Need | Choice | Status | Notes |
|---|---|---|---|
| Wake word | openWakeWord | ✅ | V2 retraining still pending (M1.3) |
| STT (EN + TH) | faster-whisper `large-v3-turbo` | ✅ | |
| Better Thai STT | **Typhoon Whisper Turbo** (`typhoon-ai/typhoon-whisper-turbo`, MIT) | 📋 | Thai fine-tune of Whisper turbo. Convert once with `ct2-transformers-converter --model typhoon-ai/typhoon-whisper-turbo --output_dir models/typhoon-whisper-turbo-ct2 --quantization float16`, then `MAVE_STT_MODEL=<that folder>` (faster-whisper accepts a CTranslate2 folder). Needs live A/B on Thai speech |
| Realtime Thai STT | Typhoon ASR Real-time (FastConformer-Transducer) | 👀 | Streaming, lower latency; would need a NeMo-based service |
| TTS (cloud, current) | EdgeTTS `th-TH-PremwadeeNeural` / `en-US-JennyNeural` | ✅ | Network-backed |
| Better Thai TTS (local, natural) | **F5-TTS-THAI** / **ThonburianTTS** / **OpenJaiTTS** (all F5-TTS based, zero-shot voice cloning) | 📋 | Very natural Thai; RTF ≈ 0.1–0.2 on GPU (RTX 3060 Ti OK). **License check required**: OpenJaiTTS is CC BY-NC 4.0 (personal use OK, not commercial). Plug in as a new engine in `services/tts` behind the existing `TTSProvider` contract |
| The user's own Thai voice from the "video AF" project | Reuse that engine | 📋 | Need its location/stack. If it runs as a local HTTP server, add an `HttpTTSProvider` adapter; if it's F5-TTS based, add it as a `services/tts` engine and reuse its reference voice |
| Offline English TTS | Kokoro-82M / Piper | 👀 | Kokoro has no Thai; use only for English offline |
| Echo cancellation (speaker barge-in) | WebRTC AEC3 (`webrtc-audio-processing`) or SpeexDSP | 📋 | Fixes "MAVE hears itself" without headphones |
| VAD | Silero VAD | 👀 | Current energy VAD works; Silero is more robust in noise |

## 3. Tools & actions

| Need | Choice | Status | Notes |
|---|---|---|---|
| Tool protocol to the outside world | **MCP** (`@modelcontextprotocol/sdk`) | 📋 | M5.2: MCP client registers MCP tools into `ToolRegistry`, so they go through MAVE permissions (MCP is not a permission bypass) |
| App/URL/file actions | Built-in (`@mave/tools`) | ✅ | Windows `Start-Process`, `explorer.exe`, Electron `shell` |
| Desktop control (mouse/keyboard/windows) | nut.js or Windows UI Automation via an MCP server | 👀 | Only with explicit scope, visible active task and instant stop |
| Browser automation | Playwright (already in repo) via MCP | 👀 | |

## 4. UI

| Need | Choice | Status |
|---|---|---|
| Surface | Electron frameless transparent window + React | ✅ (foundation) |
| Windows 11 glass | Electron `setBackgroundMaterial('acrylic')` | 📋 |
| Motion | CSS spring/keyframes now; Framer Motion if needed | 👀 |

---

## 5. Recommended order

1. Set up a Fast Brain (Groq or Gemini Flash) and measure TTFT — biggest UX win.
2. Try Typhoon Whisper Turbo for Thai STT (config-only swap).
3. Bring in the Thai TTS from the video project (or F5-TTS-THAI) as a local engine.
4. MCP client.
5. AEC.

## Sources

- Typhoon Whisper Turbo: https://huggingface.co/typhoon-ai/typhoon-whisper-turbo
- Typhoon ASR Real-time paper: https://arxiv.org/abs/2601.13044v1
- OpenJaiTTS: https://huggingface.co/JTS-AI/OpenJaiTTS-v1.0
- F5-TTS-THAI: https://huggingface.co/VIZINTZOR/F5-TTS-THAI
- ThonburianTTS: https://repository.li.mahidol.ac.th/items/01425a99-9731-4855-ba46-c7c77b0c9079/full
