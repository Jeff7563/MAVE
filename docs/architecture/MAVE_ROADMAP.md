# MAVE Roadmap

## Philosophy

MAVE ต้องเติบโตจากระบบเล็กที่เสถียรไปสู่ Personal AI Assistant ที่ซับซ้อน โดยเพิ่ม capability ทีละ milestone และมี quality gate ชัดเจน

## Milestone 0 — Foundation ✅

- pnpm monorepo
- Turborepo
- Electron + React
- TypeScript
- XState
- SQLite / Drizzle
- providers / contracts / logging / tests

## Milestone 1 — Presence / Wake Runtime

Goal: ทำให้ MAVE มีตัวตนและพร้อมถูกเรียก

- local wake detection
- wake service supervisor
- assistant state machine
- microphone handling
- diagnostics
- offline WAV testing

## Milestone 1.2 — Wake Lifecycle Stabilization ✅

- 0 ghost wake
- 20/20 one-click return to sleep
- score diagnostics
- stale buffer/reset fixes

## Milestone 1.3 — Personalized MAVE V2 ← CURRENT

Current V1 live result:
- First-attempt: 14/20
- Ghost wake: 0
- Sleep recovery: 20/20

Scope:
- V1 archive
- real dataset recorder
- benchmark tool
- V2 training design
- pronunciation coverage
- near-miss negatives

Quality gate:
- first-attempt live recall ≥ 18/20
- target 19–20/20
- 0 ghost wake
- sleep recovery 20/20
- no material negative regression
- false-positive target ≤ 0.1/hour

Next:
1. Record real dataset
2. Benchmark V1
3. Analyze categories
4. Train V2
5. Benchmark V2
6. Promote only if gate passes

## Milestone 2 — Conversation Runtime ✅

Goal: provider-independent brain runtime (COMPLETED in Phases 0–10)

Deliverables:
- `BrainProvider` vendor-neutral contract & registry ✅
- `BrainRouter` with deterministic capability matching & fallback ✅
- `BrainProfilePolicy` with canonical profiles (`fast_conversation`, `agent_work`, etc.) ✅
- `SessionManager` & multi-turn `ContextManager` ✅
- `ConversationRuntime` streaming orchestration ✅
- `SQLiteConversationStore` turn persistence (zero per-delta writes) ✅
- Typed Electron IPC streaming with race & acknowledgement safety ✅
- Developer Text Chat UI test harness ✅
- Request timeout & cancellation propagation ✅
- First real subscription brain: official Google Antigravity CLI (`agy`) ✅
- Architecture freeze & verification across all M2 boundaries ✅

Result: Text chat creates sessions, routes providers, streams responses, persists turns, cancels cleanly, and works with both deterministic Mock and real subscription AI.

## Milestone 3 — Voice Loop ✅

Goal: natural wake-to-conversation flow (Spoken Voice Assistant — COMPLETED in Phases M3.0–M3.10)

Detailed Architecture & Closeout Records:
- [`MAVE_VOICE_ARCHITECTURE.md`](MAVE_VOICE_ARCHITECTURE.md)
- [`MAVE_MILESTONE_3_SPEC.md`](MAVE_MILESTONE_3_SPEC.md)
- [`MAVE_MILESTONE_3_CLOSEOUT.md`](MAVE_MILESTONE_3_CLOSEOUT.md)

Phased Implementation Roadmap:
- **M3.0 — Voice Architecture & Milestone 3 Specification** ✅
- **M3.1 — Voice Contracts & Audio Format Baseline** ✅
- **M3.2 — Deterministic Mock Voice Providers** ✅
- **M3.3 — Streaming Text Chunker & Progressive Speech** ✅
- **M3.4 — VoiceSessionCoordinator Core Runtime** ✅
- **M3.5 — Wake $\longleftrightarrow$ Voice Handoff Integration** ✅
- **M3.6 — Barge-In & Interruption Pipeline** ✅
- **M3.7A — Real Audio Input Provider** ✅
- **M3.7B — First Real STT Provider (`faster-whisper`)** ✅
- **M3.8 — First Real TTS Provider (`EdgeTTS`) & Audio Output** ✅
- **M3.9 — Voice IPC Streaming & Developer Diagnostics UI** ✅
- **M3.10 — End-to-End Voice Loop Closeout** ✅

Result: Real spoken voice loop with zero mic overlap, bilingual transcription, progressive speech chunking, real audio output, programmatic barge-in, developer diagnostics, and 100% test pass rate.

> [!IMPORTANT]
> **Parallel Fast Brain & Wake V2 Tracks**: While M3 voice loop is complete and ready for M4, parallel work continues on:
> 1. Fast Brain evaluation to bridge the ~9s TTFT gap to sub-2s conversational turn-taking.
> 2. Wake V2 retraining for enhanced single-syllable "MAVE" recall under M1.3.

## Milestone 4 — MAVE Surface ← CURRENT

Goal: Floating UI เป็น visual center

- Orb / Mini state
- Floating panel
- chat history
- transcript
- streaming messages
- card renderer
- always-on-top
- drag/resize
- global hotkey

Initial cards: Message, Translation, Vocabulary, Source, Image, File, Code, Task, Progress, Approval, Error

## Milestone 5 — Agent Runtime & Tools

Goal: จาก “ตอบได้” → “ทำงานได้”

- Task runtime
- Tool Registry
- permissions/approvals
- progress events
- cancellation/timeout/retry
- audit log
- files/folders/terminal/Git/MCP first

## Milestone 6 — Memory

- working memory
- conversation history
- personal preferences
- project memory
- knowledge retrieval
- memory write policy
- user edit/delete controls
- provenance

## Milestone 7 — Learning Engine

- language learning profile
- vocabulary extraction
- recurring mistake detection
- natural phrasing suggestions
- learning events
- recap/review queue
- progress analytics

## Milestone 8 — Context Awareness

Possible:
- active app
- selected text
- clipboard
- current repository
- screenshot on demand
- user-selected screen region

No continuous screen capture by default

## Milestone 9 — Multimodal Results

- image cards
- video previews
- rich links
- file previews
- source citations
- multimodal model support

## Milestone 10 — Cross-Device

Initial model:

```text
Desktop = Host
Mobile = Companion
```

## Milestone 11 — Proactive MAVE

- reminders
- project warnings
- failed task notifications
- vocabulary reviews
- contextual suggestions

Proactive ≠ intrusive

## Milestone 12 — Production

- installer
- auto-update
- crash recovery
- migrations
- backup
- settings export/import
- security review
- onboarding
- diagnostics

## MAVE v1 Definition

MAVE v1 ควรอย่างน้อยประกอบด้วย:

```text
M1 Presence
M2 Conversation
M3 Voice
M4 Surface
M5 Agent/Tools
M6 Memory
M7 Learning
```

เมื่อครบชุดนี้ MAVE จะเริ่มเป็น Personal AI Assistant ที่ใช้งานจริงได้ ไม่ใช่ prototype
