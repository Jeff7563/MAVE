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

## Milestone 2 — Conversation Runtime

Goal: provider-independent brain runtime

Deliverables:
- `BrainProvider`
- `BrainRouter`
- capability model
- provider health/fallback
- streaming
- session manager
- context manager
- intent router
- cancellation
- provider diagnostics

Done when text chat can create a session, route provider, stream response, fail over safely และเก็บ metadata

## Milestone 3 — Voice Loop

Goal: natural wake-to-conversation flow

- STT abstraction
- TTS abstraction
- partial transcript
- interruption/barge-in
- silence handling
- conversation timeout
- wake → listen → think → speak → continue

## Milestone 4 — MAVE Surface

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
