# MAVE Architecture Audit

**Date**: October 13, 2026  
**Auditor**: Antigravity Assistant  
**Repository Branch**: `feat/milestone-1-3-mave-v2`  
**Baseline Commit**: `f4e3b693ecb7cdaf867ca31f556edb46cab3b1c4`  
**Source of Truth Documents**: `docs/architecture/` (Pack v0.1: Vision, Principles, System Architecture, Roadmap, AI Brain, Tools & Permissions, Memory, UI Surface, Learning Engine)

---

## 1. Executive Summary

This architecture audit evaluates the current implementation of the MAVE project against the **MAVE Master Architecture Pack** (ten foundational architecture documents establishing MAVE as an always-available, provider-independent Personal AI Assistant runtime).

### High-Level Assessment
- **Overall Posture**: **Strong Foundation with Clean Modularity**. The codebase strictly honors the monorepo structure, process boundaries (Electron Main vs. Renderer vs. Python Wake Subprocess), and asynchronous NDJSON IPC protocols established during Milestone 0 and stabilized in Milestone 1.2.
- **Completed Milestones**:
  - **Milestone 0 (Foundation)**: pnpm monorepo, Turborepo, TypeScript strict mode, XState v5 core, SQLite/Drizzle schemas, Pino logging, Vitest unit testing, and Playwright Electron E2E smoke tests.
  - **Milestone 1 / 1.2 (Presence & Wake Runtime)**: Local openWakeWord ONNX inference, supervised background Python daemon, wake-word state coordination, 0 ghost wakes, 20/20 sleep recovery, offline WAV testing path, and V2 dataset validation / dry-run tooling.
- **Key Architectural Findings**:
  1. **Strict Process & Isolation Boundaries**: The separation between Electron Main, the React Renderer via typed `contextBridge`, and the isolated Python wake daemon via stdio NDJSON streams is exemplary and fully complies with the Master Vision.
  2. **Core Is Currently State-Machine Only**: `packages/core` currently houses only the XState v5 assistant lifecycle machine. Session management, context assembly, intent routing, provider routing, and task orchestration are not yet implemented (deferred by roadmap to Milestone 2 and Milestone 5).
  3. **Wake Telemetry Infiltration into Assistant Context**: `MaveMachineContext` directly stores 12 hardware/telemetry properties (e.g. microphone index, wake score, peak score). While effective for Milestone 1 developer diagnostics, hardware metrics should be namespaced before multi-modal inputs (STT, TTS, camera) multiply context attributes.
  4. **Legacy OpenAI Settings In Contracts**: `packages/contracts/src/settings.ts` still retains an early Milestone 0 draft schema (`realtime: { model: 'gpt-4o-realtime-preview' }`) which conflicts with Engineering Principle 1 ("Core Must Not Depend on One Provider") and the `BrainProvider` architecture.
  5. **SQLite Storage via In-Memory WASM (`sql.js`)**: `packages/database` utilizes `sql.js` (WebAssembly SQLite) with full-file synchronous disk exports on save. While completely functional for settings and early metadata, high-frequency writes during conversation turns or vector/task histories in later milestones will require transition to native or asynchronous SQLite.
- **Readiness for Milestone 2**: **B. READY FOR M2 WITH SMALL PREPARATION**. The repository does not require any major refactor. It only needs small contract alignments (defining `BrainProvider` interfaces and cleaning the legacy realtime schema) before implementing the Conversation Runtime.

---

## 2. Current Architecture Map

The diagram below reflects the **ACTUAL** current repository implementation as of commit `f4e3b69`:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ELECTRON RENDERER (UI)                            │
│  apps/desktop/src/renderer/                                                 │
│  ├── App.tsx (React Root, Local fallback simulation)                        │
│  ├── components/StatusCard.tsx (Assistant status, AI status, DB status)     │
│  └── components/DeveloperControls.tsx (Wake triggers, mic selector, score)  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ ContextBridge (window.mave)
                                       │ apps/desktop/src/preload/index.ts
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ELECTRON MAIN PROCESS (HOST)                         │
│  apps/desktop/src/main/                                                     │
│  ├── index.ts (App Lifecycle, Window management, Navigation security)      │
│  ├── ipc.ts (IPC Dispatcher: mave:get-status, mave:send-command)            │
│  ├── tray.ts (System Tray menu & background execution)                      │
│  └── wake-manager.ts (Wake Supervisor, Rearm guard, Diagnostics sync)       │
└──────────────┬───────────────────────┬──────────────────────┬───────────────┘
               │                       │                      │
               ▼                       ▼                      ▼
┌───────────────────────────┐ ┌───────────────────┐ ┌─────────────────────────┐
│       @mave/core          │ │  @mave/database   │ │    @mave/providers      │
│ packages/core/src/        │ │ packages/database │ │ packages/providers/src/ │
│ ├── machine.ts (XState v5)│ │ ├── client.ts     │ │ ├── wake/openwakeword.ts│
│ ├── service.ts            │ │ │   (sql.js WASM) │ │ │   (Process Supervisor)│
│ └── types.ts              │ │ └── schema.ts     │ │ └── wake/mock.ts        │
│     (MaveMachineContext)  │ │     (Drizzle ORM) │ │     (Test Mock)         │
└───────────────────────────┘ └───────────────────┘ └───────────┬─────────────┘
                                                                │
                                                                │ Stdio (NDJSON)
                                                                │ ChildProcess
                                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PYTHON WAKE SERVICE (OUT-OF-PROCESS)                    │
│  services/wake/src/mave_wake/                                               │
│  ├── main.py (Daemon Coordinator & Event Loop)                              │
│  ├── engine.py (openWakeWord ONNX Runtime Engine)                           │
│  ├── audio.py (sounddevice 16kHz Mono 16-bit PCM Audio Capture)             │
│  ├── protocol.py (NDJSON Serialization / Deserialization)                   │
│  └── config.py (Model Resolution & Threshold Clamping)                      │
│                                                                             │
│  Assets & Offline Tooling:                                                  │
│  ├── assets/wake/mave.onnx (Deployed V1 Model)                              │
│  ├── services/wake/tools/record_dataset.py (Local Audio Recorder)           │
│  ├── services/wake/tools/benchmark_model.py (ONNX Benchmark Suite)          │
│  ├── services/wake/tools/validate_dataset.py (Audio Format & QA Validator)  │
│  └── training/wake/mave-v2/colab/train_mave_v2.py (V2 Pipeline & Dry-Run)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Architecture Compliance Matrix

| Subsystem / Area | Current Status | Target Architecture | Gap Analysis | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **1. Monorepo Structure** | **IMPLEMENTED** | pnpm workspace + Turborepo modular packages | High compliance. Clear packages (`contracts`, `core`, `database`, `providers`, `shared`, `desktop`, `services/wake`). | Low |
| **2. @mave/core Responsibilities** | **PARTIALLY IMPLEMENTED** | Assistant state, session lifecycle, routing, context, permissions, task orchestration | Currently only contains the XState lifecycle machine. Missing session, context, and routing managers. | High (M2) |
| **3. XState Assistant Lifecycle** | **IMPLEMENTED** | 8 primary states (`starting` $\to$ `sleeping` $\to$ `waking` $\to$ `listening` $\to$ `thinking` $\to$ `speaking`) | Fully matches target architecture. Clean guards, actions, and event-driven transitions. | Low |
| **4. Electron Main / Renderer Separation** | **IMPLEMENTED** | Secure Electron IPC, context isolation, preload bridge, non-blocking UI | Implemented with `contextIsolation: true`, `nodeIntegration: false`, typed IPC, navigation blockers. | Low |
| **5. Provider Abstraction** | **PARTIALLY IMPLEMENTED** | Multi-domain provider contracts (`WakeWordProvider`, `VoiceProvider`, `BrainProvider`) | `WakeWordProvider` is implemented; `BrainProvider` and `VoiceProvider` (STT/TTS) are deferred to M2 and M3. | High (M2) |
| **6. Wake Provider & Python Service** | **IMPLEMENTED** | Local-first openWakeWord ONNX supervisor over NDJSON IPC | Fully implemented, benchmarked, 0 ghost wakes, 20/20 return-to-sleep recovery, offline test path. | Low |
| **7. SQLite / Drizzle Database Layer** | **PARTIALLY IMPLEMENTED** | Local-first relational schema for settings, sessions, memories, tasks, audit | Schema has `settings`, `conversations`, `conversation_turns`, `vocabulary`, `mistakes`, `learning_events`. Missing `tasks`, `memories`, `tool_audit`. | Medium (M5/M6) |
| **8. Session Handling** | **DEFERRED BY ROADMAP** | `SessionManager` managing session IDs, context, language mode, active tasks | Database has `conversations` table, but runtime session manager in `@mave/core` does not exist yet. | High (M2) |
| **9. Context Handling** | **DEFERRED BY ROADMAP** | `ContextManager` curating working memory, selected files, preferences | Context assembly engine does not exist in runtime yet. | High (M2) |
| **10. Brain Provider Abstraction** | **DEFERRED BY ROADMAP** | Multi-brain interface (`id`, `capabilities`, `chat()`, `health()`, `cancel()`) | Not implemented. Legacy schema in contracts points to OpenAI Realtime. Needs `BrainProvider` interface. | High (M2) |
| **11. Brain Routing** | **DEFERRED BY ROADMAP** | `BrainRouter` selecting Fast Brain, Reasoning, Agent, Research, Local | Not implemented. Targeted for Milestone 2. | High (M2) |
| **12. Tool Architecture** | **DEFERRED BY ROADMAP** | `ToolRegistry` with schemas, risk levels, timeouts, MCP bridges | Not implemented. Targeted for Milestone 5. | Future (M5) |
| **13. Permission Model** | **DEFERRED BY ROADMAP** | Level 0–3 risk classification with scoped user approval flows | Not implemented. Targeted for Milestone 5. | Future (M5) |
| **14. Task Runtime** | **DEFERRED BY ROADMAP** | Separate state machine for background / agent tasks (`Queued` $\to$ `Running`) | Correctly decoupled; assistant state machine does not contain task states. Task runtime deferred to M5. | Future (M5) |
| **15. Memory Architecture** | **DEFERRED BY ROADMAP** | 6 memory tiers (Working, Conversation, Personal, Project, Knowledge, Learning) | Partial tables exist in SQLite (`vocabulary`, `mistakes`); active memory policy engine deferred to M6. | Future (M6) |
| **16. Learning Architecture** | **DEFERRED BY ROADMAP** | Extraction, pattern normalization, review queue, daily recap | Mode prompts exist in `@mave/prompts`; runtime event analysis deferred to Milestone 7. | Future (M7) |
| **17. UI Architecture** | **PARTIALLY IMPLEMENTED** | 4 surfaces (Orb, Floating Panel, Task Workspace, Full App) + Card System | Single 440x580 developer dashboard window exists. Floating Panel and card system deferred to Milestone 4. | Medium (M4) |
| **18. IPC Boundaries** | **IMPLEMENTED** | Type-safe Zod-validated two-way IPC via Electron contextBridge | Implemented (`mave:get-status`, `mave:send-command`, `mave:state-changed`) with strict validation. | Low |
| **19. Logging / Diagnostics** | **IMPLEMENTED** | Structured JSON logging with subsystem namespacing & telemetry | Implemented via Pino in `@mave/shared`, NDJSON in Python, real-time score and hardware telemetry. | Low |
| **20. Tests and Quality Gates** | **IMPLEMENTED** | Automated build, typecheck, unit, integration, and E2E gates | Implemented: 49 Python tests, 17 TypeScript unit tests, 1 Playwright Electron smoke test, 0 failures. | Low |
| **21. Security & Privacy Boundaries** | **IMPLEMENTED** | Local-first audio, no raw cloud streaming, context isolation | Audio processed 100% locally on CPU/ONNX. Popups denied, navigation restricted, sandbox configured. | Low |
| **22. Cancellation / Timeout / Recovery** | **PARTIALLY IMPLEMENTED** | Request cancellation, tool timeouts, supervisor auto-restart | Implemented for Wake Engine supervisor (auto-restart, rearm guard, lifecycle boundaries). LLM streaming abort deferred to M2. | Medium (M2) |

---

## 4. What Is Already Correct (Do NOT Rewrite)

The following architectural foundations are solidly engineered, fully verified, and **must not be rewritten or disrupted**:

1. **XState Assistant Lifecycle Coordinator (`packages/core/src/state-machine/machine.ts`)**:
   - The state machine implements the exact sequence required by `MAVE_SYSTEM_ARCHITECTURE.md`: `starting` $\to$ `sleeping` $\to$ `waking` $\to$ `listening` $\to$ `thinking` $\to$ `speaking` $\to$ `sleeping`.
   - Transitions are guarded, deterministic, and fully covered by unit tests.
2. **Out-of-Process Python Wake Service (`services/wake/`)**:
   - Isolating Python audio capture and ONNX inference into a dedicated background process prevents native dependency crashes (sounddevice, ONNXRuntime, OpenWakeWord) from bringing down the Electron host.
   - Communication strictly uses standard input/output NDJSON protocols, making the service language-agnostic and replaceable.
3. **Electron Main Wake Supervisor (`apps/desktop/src/main/wake-manager.ts`)**:
   - Manages process lifecycle boundaries, prevents duplicate firing using the 300ms rearm guard, safely drains audio on transitions, and coordinates state between the engine and the database.
4. **IPC Security & Preload Architecture (`apps/desktop/src/main/ipc.ts`, `apps/desktop/src/preload/index.ts`)**:
   - Preload exposes minimal, typed capabilities (`getStatus`, `sendCommand`, `onStateChanged`).
   - Renderer cannot access Node.js APIs or execute arbitrary commands; all inputs are validated with Zod schemas.
5. **Monorepo Packaging & Turborepo Pipeline (`package.json`, `turbo.json`)**:
   - Clean package hierarchy (`contracts` $\to$ `shared` $\to$ `database`/`prompts` $\to$ `core`/`providers` $\to$ `desktop`).
   - Incremental builds, caching, typechecking, and testing are fully operational.

---

## 5. Architecture Gaps

### Critical Before Milestone 2
1. **Define `BrainProvider` Interface in `@mave/contracts`**:
   - Currently, `packages/contracts/src/providers.ts` only exports `WakeWordProvider` and `VoiceProvider`.
   - Before Milestone 2 can begin, `BrainProvider`, `BrainCapabilities`, `BrainRequest`, `BrainResponse`, `BrainEvent`, and `ProviderHealth` must be specified as contracts without tying to any specific cloud vendor.
2. **Purge Legacy OpenAI Realtime Schema from Contracts**:
   - `packages/contracts/src/settings.ts` lines 18–22 contain:
     ```ts
     realtime: z.object({
       model: z.string(),
       vad: z.enum(['semantic_vad', 'server_vad']),
       vadEagerness: z.enum(['low', 'medium', 'high', 'auto'])
     })
     ```
   - This directly violates Engineering Principle 1 ("Core Must Not Depend on One Provider") and Principle 18 ("Capability Over Provider Name"). It must be replaced or superseded by a generic `brain` configuration block.

### Important But Can Wait (Milestone 3 – Milestone 5)
1. **Wake Diagnostics Namespacing in `MaveMachineContext`**:
   - Currently, 12 wake-specific fields (`microphoneName`, `microphoneIndex`, `latestScore`, `peakScore`, `threshold`, etc.) sit directly at the root of `MaveMachineContext` in `packages/core/src/state-machine/types.ts`.
   - While harmless for M1 and M2, these should be nested into a `diagnostics.wake` sub-object before Milestone 3 (Voice) adds STT/TTS telemetry, preventing the assistant state context from bloating indefinitely.
2. **In-Memory WebAssembly SQLite (`sql.js`) Bottleneck**:
   - `packages/database/src/client.ts` uses `sql.js` and persists the entire database file to disk synchronously via `fs.writeFileSync(dbPath, Buffer.from(sqlite.export()))`.
   - Adequate for Milestone 2 text turn logging, but must be migrated to native asynchronous SQLite (or WAL-enabled SQLite) before Milestone 5/6 when high-frequency task logs and vector embeddings are stored.
3. **Renderer Standalone Fallback Simulation**:
   - `apps/desktop/src/renderer/src/App.tsx` lines 64–116 simulate state transitions when `window.mave` is undefined (browser dev mode).
   - This slightly breaks Principle 12 ("UI Must Be Renderer, Not Brain"). Mock simulation should be driven by injecting `MockWakeWordProvider` into the main process rather than duplicating state logic in the React component.

### Future Roadmap Items (Milestones 5 – 8)
- Tool Registry and Level 0–3 Permission Model (`MAVE_TOOL_AND_PERMISSION_MODEL.md`).
- Dedicated Task Runtime state machine (`MAVE_SYSTEM_ARCHITECTURE.md` Section 6).
- 6-tier curated Memory policy engine and vector index (`MAVE_MEMORY_ARCHITECTURE.md`).
- Floating Panel UI Surface with Card Renderers (`MAVE_UI_SURFACE_ARCHITECTURE.md`).
- Continuous Language Learning Analyzer (`MAVE_LEARNING_ENGINE.md`).

---

## 6. Technical Debt

The table below lists verified **real technical debt** currently present in the codebase (excluding features intentionally scheduled for future milestones):

| Debt Item | Location | Architectural Risk | Difficulty to Fix |
| :--- | :--- | :--- | :--- |
| **Vendor-Specific Realtime Schema** | `packages/contracts/src/settings.ts#L18-L22` | Locks configuration to OpenAI Realtime concepts (`semantic_vad`, `gpt-4o-realtime-preview`), causing confusion when adding Gemini, Claude, or local LLMs. | Low (Schema refactor) |
| **Root Context Hardware Pollution** | `packages/core/src/state-machine/types.ts#L9-L29` | Couples generic assistant state machine with microphone hardware device indices and openWakeWord model scores. | Low (Group into sub-property) |
| **Synchronous Whole-DB Save** | `packages/database/src/client.ts#L112-L120` | `sqlite.export()` copies and writes the whole database synchronously to disk on every save, which blocks the event loop on larger databases. | Medium (Migrate before M5/M6) |
| **Duplicate UI Mock Logic** | `apps/desktop/src/renderer/src/App.tsx#L64-L116` | UI renderer maintains its own shadow state-machine transitions when running outside Electron. | Low (Delegate to preload mock) |

---

## 7. Milestone 2 Readiness

### Readiness Assessment
- **Is the repository ready for Milestone 2?**  
  **Yes, with minor contract preparation.** The core architecture, process boundaries, build systems, and state machines are fully ready to support conversation orchestration.
- **What must be fixed first?**
  1. Define the vendor-neutral `BrainProvider` and `BrainRouter` type definitions in `packages/contracts/src/providers.ts`.
  2. Replace or deprecate the `realtime` schema in `packages/contracts/src/settings.ts` in favor of a vendor-neutral `brain` configuration.
- **What should explicitly NOT be changed?**
  - **Do NOT touch the XState machine state transitions**: The existing states (`sleeping`, `waking`, `listening`, `thinking`, `speaking`, `muted`, `error`) are already the exact states needed for conversation.
  - **Do NOT modify the Python wake engine or supervisor**: The openWakeWord daemon and `WakeManager` are passing all quality gates and must remain isolated.
  - **Do NOT begin audio STT/TTS in Milestone 2**: Milestone 2 is strictly **Text-First Conversation Runtime** (intent routing, provider abstraction, streaming, session storage, and cancellation). Audio voice loops belong to Milestone 3.

---

## 8. Recommended Pre-M2 Actions

To transition smoothly into Milestone 2 without refactoring or breaking existing systems, execute only these **three minimal steps**:

1. **Step 1: Add `BrainProvider` Interface to `@mave/contracts`**:
   - Add `BrainProvider`, `BrainCapabilities`, `BrainRequest`, `BrainResponse`, and `BrainEvent` interfaces as specified in `docs/architecture/MAVE_AI_BRAIN_ARCHITECTURE.md`.
2. **Step 2: Add `BrainConfig` to Settings Schema**:
   - In `packages/contracts/src/settings.ts`, define `brain: z.object({ defaultProvider: z.string(), fallbackChain: z.array(z.string()), timeoutMs: z.number() })` and deprecate `realtime`.
3. **Step 3: Define `Session` and `Message` Contracts**:
   - In `packages/contracts/src/`, declare the runtime contracts for `Session`, `ConversationTurn`, and `StreamingChunk` so `@mave/core` and the UI have strong end-to-end typing for text streaming.

---

## 9. Proposed Milestone 2 Boundaries

To maintain velocity and prevent scope creep, Milestone 2 boundaries must be strictly enforced:

### In-Scope for Milestone 2
- **`BrainProvider` Interface & Adapter Implementations**:
  - Mock Provider (deterministic testing).
  - Cloud / Fast Brain Adapter (e.g. Gemini 2.5 Flash or Claude 3.5 Haiku via official SDK/fetch).
- **`BrainRouter`**:
  - Deterministic capability-based routing (e.g. `fast_chat` capability).
  - Graceful fallback when the primary brain provider fails or times out.
- **`SessionManager` in `@mave/core`**:
  - Managing active conversation session IDs, start/end timestamps, and linking turns.
  - Persisting conversation turns to the existing `conversations` and `conversation_turns` database tables.
- **Streaming & Cancellation Support**:
  - `AsyncIterable` streaming chunks from Brain to Electron Main to Renderer over IPC (`mave:chat-stream`).
  - Request cancellation via `AbortController` when `SLEEP_REQUESTED` or user interruption occurs.
- **Text Chat Verification in UI**:
  - Simple developer text input area in the desktop UI to verify: Type message $\to$ Session created $\to$ Routed to Brain $\to$ Response streamed $\to$ Stored in DB $\to$ Metadata recorded.

### Out-of-Scope for Milestone 2 (Strictly Excluded)
- **NO Speech-to-Text (STT) or Text-to-Speech (TTS)** (belongs to Milestone 3).
- **NO Floating Window or Orb animations** (belongs to Milestone 4).
- **NO Tool execution, terminal, or computer control** (belongs to Milestone 5).
- **NO Complex vector retrieval or memory policies** (belongs to Milestone 6).
- **NO Automated language tutoring / correction engine** (belongs to Milestone 7).

---

## 10. Risk Register

| Risk | Probability | Impact | Mitigation Strategy |
| :--- | :---: | :---: | :--- |
| **Vendor API Leakage into Core** | Medium | High | Enforce strict rule: `@mave/core` must never import vendor SDKs (`@google/genai`, `@anthropic-ai/sdk`, `openai`). All vendor code must reside in `@mave/providers`. |
| **IPC Serialization Bottleneck During Fast Streaming** | Low | Medium | Stream aggregated text tokens/chunks at 30–50ms intervals over `win.webContents.send()` rather than firing an IPC event per character. |
| **`sql.js` Memory Pressure with Long Conversations** | Low | Low | Milestone 2 conversations are short text turns; batch saves or debouncing file writes prevents disk churn. Native SQLite migration planned for M5. |
| **Assistant State Machine Starvation During Long LLM Thinking** | Low | Medium | Ensure state transitions to `thinking` upon prompt dispatch and remains responsive to `SLEEP_REQUESTED` or `SHUTDOWN` events via `AbortController`. |

---

## 11. Final Recommendation

### Selection: **B. READY FOR M2 WITH SMALL PREPARATION**

### Rationale
The MAVE codebase is in an exceptionally clean state:
- Monorepo packages build without warnings.
- 100% of tests (49 Python tests, 17 TypeScript unit tests, 1 Playwright E2E test) pass cleanly.
- The wake-word subsystem is robustly isolated in its own supervised process and does not interfere with the desktop runtime.
- Electron IPC and window security follow best practices.

The only reason this is classified as **B** rather than **A** is the presence of the legacy OpenAI `realtime` schema in `@mave/contracts` and the absence of the formal `BrainProvider` TypeScript interfaces in `packages/contracts/src/providers.ts`. Adding these minimal, vendor-independent contracts prior to implementing Milestone 2 will ensure that MAVE's conversation runtime is built from day one on clean, provider-agnostic abstractions.

---

### Supporting Repository Evidence
- **Contracts Settings**: [`packages/contracts/src/settings.ts`](file:///d:/project/MAVE/packages/contracts/src/settings.ts#L18-L54)
- **Contracts Providers**: [`packages/contracts/src/providers.ts`](file:///d:/project/MAVE/packages/contracts/src/providers.ts#L1-L53)
- **Assistant State Machine**: [`packages/core/src/state-machine/machine.ts`](file:///d:/project/MAVE/packages/core/src/state-machine/machine.ts#L81-L231)
- **Machine Context Types**: [`packages/core/src/state-machine/types.ts`](file:///d:/project/MAVE/packages/core/src/state-machine/types.ts#L9-L29)
- **Database Client & Schema**: [`packages/database/src/client.ts`](file:///d:/project/MAVE/packages/database/src/client.ts#L112-L135), [`packages/database/src/schema.ts`](file:///d:/project/MAVE/packages/database/src/schema.ts#L10-L60)
- **Wake Manager Coordinator**: [`apps/desktop/src/main/wake-manager.ts`](file:///d:/project/MAVE/apps/desktop/src/main/wake-manager.ts#L51-L100)
- **Desktop Main & IPC**: [`apps/desktop/src/main/index.ts`](file:///d:/project/MAVE/apps/desktop/src/main/index.ts#L85-L132), [`apps/desktop/src/main/ipc.ts`](file:///d:/project/MAVE/apps/desktop/src/main/ipc.ts#L10-L100)
- **UI Standalone Fallbacks**: [`apps/desktop/src/renderer/src/App.tsx`](file:///d:/project/MAVE/apps/desktop/src/renderer/src/App.tsx#L64-L116)
- **Python Wake Service Daemon**: [`services/wake/src/mave_wake/main.py`](file:///d:/project/MAVE/services/wake/src/mave_wake/main.py#L26-L100)

