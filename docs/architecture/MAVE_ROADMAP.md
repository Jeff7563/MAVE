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

## Milestone 1.3 — Personalized MAVE V2 (Parallel / Deferred Quality Track)

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

## Milestone 4 — MAVE Surface ✅

Goal: Ambient Adaptive Surface — MAVE quietly exists near the user and expands only when visual complexity is useful (COMPLETED in Phases M4.0–M4.10).

Detailed Architecture & Closeout Records:
- [`MAVE_AMBIENT_SURFACE_RUNTIME.md`](MAVE_AMBIENT_SURFACE_RUNTIME.md)
- [`MAVE_MILESTONE_4_SPEC.md`](MAVE_MILESTONE_4_SPEC.md)
- [`MAVE_MILESTONE_4_CLOSEOUT.md`](MAVE_MILESTONE_4_CLOSEOUT.md)
- [`MAVE_AMBIENT_ADAPTIVE_SURFACE.md`](MAVE_AMBIENT_ADAPTIVE_SURFACE.md)
- [`MAVE_UI_SURFACE_ARCHITECTURE.md`](MAVE_UI_SURFACE_ARCHITECTURE.md)

Phased Implementation Roadmap:
- **M4.0 — Architecture & Milestone Specification** ✅
- **M4.1 — Surface Contracts & Presentation Model** ✅
- **M4.2 — Surface Window Runtime Foundation** ✅
- **M4.3 — Compact Ambient Surface (Capsule)** ✅
- **M4.4 — Voice-Reactive States & Visualizers** ✅
- **M4.5 — Adaptive Envelope & Morph System** ✅
- **M4.6 — Compact Response Surface (Quick Info)** ✅
- **M4.7 — Expanded Context Panel (Rich Content)** ✅
- **M4.8 — Interaction, Focus & Click-Through** ✅
- **M4.9 — Multi-Monitor, Persistence & Reliability** ✅
- **M4.10 — End-to-End Surface Closeout** ✅

Result: Real Ambient Adaptive Surface with zero focus stealing, hybrid adaptive envelopes, voice-reactive PresenceMark, compact quick info card, expanded rich context panel with safe Markdown/code, click-through hit-testing, dedicated least-privilege preload, multi-monitor reliability, settings persistence, and 100% test pass rate.

## Pre-M5 — Intelligence Provider Foundation ← CURRENT

Goal: วางรากฐาน Intelligence Provider Architecture, Multi-Model Catalog, Low-Latency Fast Brain, Deep Reasoning Provider, Intent-Preserving Fallback และ Decoupled Truth Routing ให้พร้อมและเสถียรก่อนให้สิทธิ์ MAVE ทำงานจริงใน Milestone 5

Detailed Architecture Record:
- [`MAVE_INTELLIGENCE_PROVIDER_ARCHITECTURE.md`](MAVE_INTELLIGENCE_PROVIDER_ARCHITECTURE.md)
- [`MAVE_SUBSCRIPTION_INTELLIGENCE_ARCHITECTURE.md`](MAVE_SUBSCRIPTION_INTELLIGENCE_ARCHITECTURE.md)

Program Sequence:
- **F1.0 Architecture Audit & Modernization** ✅ COMPLETE
- **F1.1 Provider & Model Contracts** ✅ COMPLETE + FROZEN
- **F1.2 Provider Registry & Health Hardening** ✅ COMPLETE + HARDENED
- **F1.3 Model Catalog & Model Policy Runtime** ✅ COMPLETE + HARDENED
- **F1.4 Intelligence Routing & Intent-Preserving Fallback** ✅ COMPLETE + HARDENED
- **F1.4.1 Typed Model Execution Handoff** ✅ COMPLETE
- **F1.5-P Optional Paid API Adapter (`OpenAIBrainProvider`)** ✅ IMPLEMENTED (OPTIONAL / DISABLED BY DEFAULT)
- **F1.5-S Subscription Runtime Foundation & Billing Policy** ✅ COMPLETE (SUBSCRIPTION-FIRST ADOPTED)
  - **F1.5-S1 Claude Code Subscription Runtime Normalization** ✅ COMPLETE
  - **F1.5-S2 Runtime Model Catalog & Model Role Engine** ✅ COMPLETE
  - **F1.5-S2.1 Runtime Model Handoff & Availability Hardening** ✅ COMPLETE
  - **F1.5-S3 Task → Runtime → Model Routing Engine** ✅ COMPLETE
  - **F1.5-S3.1 Routing Telemetry & Executable Provider Hardening** ✅ COMPLETE
  - **F1.5-S3.2 Codex Subscription Runtime Normalization** ✅ CURRENT / COMPLETE
  - **F1.5-S4 Quota-Aware Subscription Fallback & Window Recovery** ← NEXT
- **F1.6 Production Deep Brain**
- **F1.7 Agent Runtime Normalization (`ClaudeCode` / `Antigravity` / `Codex`)**
- **F1.8 Research / Truth Routing**
- **F1.9 Diagnostics, Quota & Reliability**
- **F1.10 End-to-End Provider Foundation Closeout**

2. **F2 — Real Brain Integration / Tuning**: Live model benchmarking, bilingual conversational tuning (Thai/English), prompt optimization, and voice latency calibration.
3. **UI Redesign**: Desktop UI refinement, Developer Diagnostics UI, settings interface.
4. **Full MAVE E2E Stabilization**: End-to-end integration across Voice, Surface, Brain, and Fallback.
5. **Milestone 5 — Tools + Permissions + Security**: Tool execution authority and local security boundary.

## Milestone 5 — Agent Runtime & Tools ← NEXT (After Pre-M5 Foundation)

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
