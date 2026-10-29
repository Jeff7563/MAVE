# MAVE

> **MAVE** (/meɪv/ — “เมฟ”) is an always-ready personal AI voice assistant designed first as a real-time English learning companion and architected to expand into a cross-device personal assistant.

---

## Requirements

- **Node.js**: `>= 20.0.0` (Tested on Node 24)
- **pnpm**: `>= 9.0.0` (Recommended: pnpm 12)
- **Platform**: Windows (current primary supported development platform)

---

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run in Development Mode

```bash
pnpm dev
```

This launches Vite for the React renderer and starts the Electron desktop application with hot reload and developer state simulation controls.

---

## Using MAVE (M4 Surface + M5 Actions)

- **Ambient Surface**: a small MAVE orb sits bottom-right. Click it or press **Ctrl+Alt+M** to open the panel. It grows to a voice capsule while listening/speaking, and shows approval and task cards when MAVE needs you.
- **Quick commands** (Thai or English, typed or spoken) run instantly without waiting for an AI:
  - `เปิดยูทูป`, `open github`, `ช่วยเปิด vscode หน่อย`, `เปิดโฟลเดอร์ C:\project`
  - `ค้นหา ราคาทองวันนี้`, `เปิดเพลง lofi ในยูทูป`
  - `git status`, `รันเทส`, `run pnpm build`
  - `ให้ claude ช่วยสรุปว่าโปรเจกต์ถึงไหนแล้ว`, `ask codex to fix the failing test`
- **Permissions**: reading is automatic; opening things you asked for is automatic; anything a brain proposes, unknown shell commands, and coding agents ask first; destructive commands always ask.

### Configuration (`.env` or system environment)

| Variable | Purpose |
|---|---|
| `MAVE_FAST_BRAIN` | `groq` / `cerebras` / `gemini` / `openrouter` / `openai` / `ollama` / `lmstudio` / `custom` — fast conversational brain |
| `MAVE_FAST_BRAIN_API_KEY` | API key (or `GROQ_API_KEY`, `GEMINI_API_KEY`, …) |
| `MAVE_FAST_BRAIN_MODEL`, `MAVE_FAST_BRAIN_BASE_URL` | Optional model / custom endpoint |
| `MAVE_DEFAULT_BRAIN` | Force default brain id (`fast`, `antigravity`, `mock`) |
| `MAVE_TOOL_ROOTS` | Folders tools may touch, `;`-separated (default: repo + parent folder) |
| `MAVE_HOTKEY` | Surface hotkey (default `Control+Alt+M`) |
| `MAVE_SURFACE=0` / `MAVE_CONSOLE=0` | Disable the surface / hide the developer console |

Coding agents use your own installed and signed-in CLIs: `claude` (Claude Code), `codex` (Codex CLI), `agy` (Antigravity).

Specs: [`MAVE_MILESTONE_5_SPEC.md`](docs/architecture/MAVE_MILESTONE_5_SPEC.md) · Open source plan: [`MAVE_OPEN_SOURCE_ADOPTION.md`](docs/architecture/MAVE_OPEN_SOURCE_ADOPTION.md)

---

## Verification & Scripts

All scripts can be executed from the repository root:

### Build

```bash
pnpm build
```

### Typecheck

```bash
pnpm typecheck
```

### Unit Tests

Runs Vitest suites for the core state machine, SQLite database, and IPC validation:

```bash
pnpm test
```

### Desktop End-to-End Tests

Runs Playwright smoke tests against the Electron desktop application:

```bash
pnpm test:e2e
```

---

## Database

MAVE uses local SQLite with Drizzle ORM.
- **Runtime database location**: Automatically created and maintained in Electron `userData` directory (`mave.db`).
- **Tests**: Use temporary in-memory databases (`:memory:`).
- **Tables initialized**:
  - `settings`
  - `conversations`
  - `conversation_turns`
  - `vocabulary`
  - `mistakes`
  - `learning_events`
  - `daily_stats`

To generate or run migrations via drizzle-kit:
```bash
pnpm --filter=@mave/database run build
```

---

## Architecture

MAVE follows a strict provider-independent architecture:

```text
apps/desktop (Electron Shell & React UI)
     ↓
@mave/core (XState Machine & Business Logic)
     ↓
@mave/contracts (Provider Ports, DTOs & Zod Schemas)
     ↓
@mave/database / Providers (Infrastructure & Adapters)
```

- **Apps vs Packages**:
  - `apps/desktop`: Electron main process, secure preload bridge, system tray, and React renderer UI.
  - `packages/core`: Provider-independent business logic and XState v5 state machine. Contains zero Electron, React, or SQLite implementation details.
  - `packages/contracts`: Shared types, Zod validation schemas, event contracts, and provider interfaces (`VoiceProvider`, `WakeWordProvider`).
  - `packages/database`: Drizzle ORM schemas and SQLite database initialization.
  - `packages/shared`: Structured Pino logger with automatic redaction of sensitive credentials and secrets.
  - `packages/providers`: Brain (mock, Antigravity, OpenAI-compatible Fast Brain), wake, audio, STT and TTS adapters.
  - `packages/tools`: M5 tool runtime — registry, permission policy, executor, audit, quick commands, built-in tools.
  - `packages/prompts`: System prompt definitions and learning mode instructions.

- **State Machine**:
  - Explicit XState v5 state machine (`starting`, `sleeping`, `waking`, `listening`, `thinking`, `speaking`, `reconnecting`, `muted`, `error`, `shuttingDown`).
  - Provides serializable state snapshots for the renderer.

- **Security & IPC**:
  - `contextIsolation: true`, `nodeIntegration: false`.
  - Explicit typed preload bridge (`window.mave`).
  - Strict payload validation with Zod schemas.

---

## Milestone 1.1: Local Wake Word (openWakeWord)

Milestone 1.1 provides local, on-device wake-word detection using openWakeWord:
- **Wake Word**: `MAVE` (/meɪv/ — “เมฟ”)
- **Engine**: Python `openwakeword` runtime managed by Electron via a supervised subprocess boundary (`services/wake/`).
- **Communication**: Strict newline-delimited JSON stdio protocol (`services/wake/src/mave_wake/protocol.py`).
- **Privacy & Security**: No cloud API keys required. Audio is processed strictly in local streaming chunks. No audio is persisted or transmitted.
- **Diagnostics UI**: Displays Wake engine status (`Ready` / `Listening` / `Not configured` / `Error`), Wake provider (`openWakeWord`), Microphone selector, Threshold slider (0.0 – 1.0), Last wake timestamp, and offline WAV diagnostic tester.
- **Offline Audio Testing**: Developers can evaluate local WAV files through the identical openWakeWord chunking and inference pipeline via the UI or CLI (`python -m mave_wake.main --test-wav <file.wav>`).

### Wake Model Configuration (Milestone 1.2)

- Default keyword ONNX model path:
  ```text
  assets/wake/mave.onnx
  ```
- If the model file is not yet present, MAVE starts safely in **Not configured** state without crashing, with full simulation and diagnostic capabilities.
- Custom MAVE model training will be completed in Milestone 1.2.

---

## Next Milestone: Realtime Voice (Milestone 2)

Milestone 2 will introduce OpenAI Realtime audio streaming sessions with WebRTC/WebSocket client adapters.

