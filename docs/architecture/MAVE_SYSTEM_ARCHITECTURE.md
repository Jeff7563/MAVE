# MAVE System Architecture

## 1. High-Level Architecture

```text
                         USER
                           │
                    Voice / Text / UI
                           │
                           ▼
               ┌────────────────────────┐
               │   Interaction Layer    │
               │ Wake / Floating UI     │
               │ Hotkey / Notifications │
               └────────────┬───────────┘
                            │
                            ▼
               ┌────────────────────────┐
               │      MAVE Runtime      │
               │ Assistant State        │
               │ Session Manager        │
               │ Intent Router          │
               │ Context Manager        │
               │ Permission Manager     │
               │ Task Orchestrator      │
               └────────────┬───────────┘
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Brain Layer  │     │ Tool Layer   │     │ Memory Layer │
│ Gemini       │     │ MCP          │     │ SQLite       │
│ Claude       │     │ Computer     │     │ Vector       │
│ GPT          │     │ Files/Git    │     │ Knowledge    │
│ Local        │     │ Browser      │     │ Learning     │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Response System   │
                  │ Voice / Chat      │
                  │ Cards / Media     │
                  │ Task Progress     │
                  └───────────────────┘
```

## 2. Existing Foundation

```text
Monorepo
├── apps/desktop
├── packages/core
├── packages/providers
├── services/wake
├── assets/wake
└── training/wake
```

Stack: pnpm, Turborepo, TypeScript, Electron, React, XState, SQLite, Drizzle, Python, openWakeWord, ONNX

## 3. Interaction Layer

รับ input จาก wake word, push-to-talk, text input, global hotkey, Floating Panel, Full App และ Mobile client ในอนาคต

Interaction layer ส่ง event เข้า Runtime เท่านั้น ห้ามเรียก AI provider/tool โดยตรง

### 3.1 Voice Subsystem (Milestone 3 — Completed)

Spoken voice interaction connects wake detection, speech recognition, reasoning, and speech synthesis:
```text
WakeWord (openWakeWord in Python service)
      ↓
VoiceSessionCoordinator (Electron Main)
      ↓
AudioInputProvider (16 kHz Linear PCM, 16-bit mono)
      ↓
STTProvider (partial & final transcripts)
      ↓
ConversationRuntime (@mave/core)
      ↓
StreamingTextChunker (progressive sentence boundaries)
      ↓
TTSProvider (speech synthesis)
      ↓
AudioOutput (speaker playback + 50Hz amplitude telemetry)
```
Complete specification & closeout records: [`MAVE_VOICE_ARCHITECTURE.md`](MAVE_VOICE_ARCHITECTURE.md), [`MAVE_MILESTONE_3_SPEC.md`](MAVE_MILESTONE_3_SPEC.md), and [`MAVE_MILESTONE_3_CLOSEOUT.md`](MAVE_MILESTONE_3_CLOSEOUT.md).

### 3.2 Ambient Adaptive Surface Subsystem (Milestone 4 — Completed)

The Ambient Adaptive Surface is MAVE's primary visual desktop presence, providing an anchored, morphing overlay that reflects assistant state without disrupting the user's desktop workflow:

```text
Voice / Assistant State Telemetry (Core)
               ↓
SurfaceStateController (Core state machine, presentation intents & response classification)
               ↓ IPC (SurfaceEvent / Snapshot)
SurfaceWindowManager (Electron Main native window & bounds coordinator)
               ↓ Electron BrowserWindow APIs (win.setBounds, win.setIgnoreMouseEvents, win.setAlwaysOnTop)
Surface BrowserWindow (Transparent, always-on-top, frameless)
               ↓ Preload (Least-privilege window.mave.surface bridge)
Surface Renderer (React, pure CSS compositor)
```

Key Architectural Invariants:
- **No Passive Focus Stealing**: Passive state transitions (wake, listening, thinking, speaking, compact/expanded presentation) never steal OS focus (`focusable: false`, `showInactive()`). Focus is acquired strictly upon intentional user interaction (`focus-acquire` IPC) and released cleanly back to the previous desktop application (`focus-release` / blur).
- **Zero Raw Audio in Renderer**: Surface renderer only consumes normalized scalar audio telemetry (`inputLevel` / `outputLevel`: 0.0–1.0) and presentation state snapshots. Audio capture and playback remain in Electron Main / Python services.
- **Single Ambient Window**: One native BrowserWindow instance hosts all visual envelope sizes (`ambient` 280x80, `compact` 280x80, `card` 360x180, and `expanded` 440x580 DIP) via fluid CSS layout transitions within discrete native window envelopes.
- **Click-Through Outside Content**: Transparent hit-testing regions pass desktop mouse clicks directly through to underlying applications (`setIgnoreMouseEvents(true, { forward: true })`) when the cursor is outside visible surface cards.
- **Safe Content Rendering**: Markdown and rich cards rely on AST-based token parsing (`marked.lexer()`) and strict React text escaping with URL scheme whitelisting (`http:`, `https:`); raw HTML injection is strictly inert.
- **Display Topology & Multi-Monitor Resilience**: Bounds coordinator handles DPI scaling, taskbar repositioning, display reconnects, and off-screen recovery with display clamping and persistent user preferences in SQLite (`surface.preferences`).

Complete specification & closeout records: [`MAVE_AMBIENT_ADAPTIVE_SURFACE.md`](MAVE_AMBIENT_ADAPTIVE_SURFACE.md), [`MAVE_AMBIENT_SURFACE_RUNTIME.md`](MAVE_AMBIENT_SURFACE_RUNTIME.md), [`MAVE_MILESTONE_4_SPEC.md`](MAVE_MILESTONE_4_SPEC.md), and [`MAVE_MILESTONE_4_CLOSEOUT.md`](MAVE_MILESTONE_4_CLOSEOUT.md).

## 4. Assistant Runtime

Responsibilities:
- assistant state
- session lifecycle
- intent classification
- context assembly
- provider routing
- permission checks
- task creation
- cancellation
- result aggregation
- response dispatch
- memory events

## 5. Assistant State Machine

```text
Starting
↓
Sleeping
↓
Waking
↓
Listening
↓
Understanding
↓
Thinking
↓
Speaking
↓
Sleeping
```

Additional: Error, Muted, Updating, Offline

Long-running task ไม่ควรถูก encode เป็น assistant state

## 6. Task Runtime

```text
Queued
↓
Planning
↓
WaitingApproval
↓
Running
↓
WaitingTool
↓
Running
↓
Completed
```

Alternate exits: Failed, Cancelled, TimedOut

## 7. Session Manager

Session metadata อาจมี:
- session id
- start time
- active language
- active project
- active application
- active task ids
- conversation mode
- provider route
- recent messages

## 8. Context Manager

Context sources:
- current conversation
- project memory
- selected files
- active screen/app
- preferences
- learning context
- tool results
- external research

ส่งเฉพาะ context ที่จำเป็น

## 9. Intent Router

Initial intents:
- conversation
- translation
- language_learning
- question_answering
- research
- coding
- project_analysis
- computer_action
- file_action
- automation
- memory_request
- media_request

## 10. Brain Layer

MAVE decouples "Who should think?" from "Where do facts come from?" through a three-tier provider taxonomy and deterministic routing pipeline:

```text
Intent / Request
       ↓
Truth Requirement Check (KnowledgeProvider: Web, DB, Files, Memory)
       ↓
BrainProfilePolicy (Canonical profiles: fast_conversation, deep_reasoning, agent_work, research, local_offline)
       ↓
BrainRouter (Provider selection & intent-preserving fallback)
       ↓
ModelPolicy (Concrete ModelDescriptor selection within provider catalog)
       ↓
Provider Adapters (@mave/providers)
├── ModelProvider (Direct streaming models: Google, Anthropic, OpenAI, Local)
├── AgentRuntimeProvider (Execution harnesses: Antigravity CLI, future agents)
└── KnowledgeProvider (Authoritative data retrieval)
```

Canonical specification: [`MAVE_INTELLIGENCE_PROVIDER_ARCHITECTURE.md`](MAVE_INTELLIGENCE_PROVIDER_ARCHITECTURE.md) and [`MAVE_AI_BRAIN_ARCHITECTURE.md`](MAVE_AI_BRAIN_ARCHITECTURE.md).

## 11. Tool Layer

```text
ToolRegistry
├── files
├── terminal
├── git
├── browser
├── search
├── computer
├── mcp
├── email
├── calendar
└── custom tools
```

ทุก tool ต้องประกาศ schema, risk, permission, timeout และ cancellation behavior

## 12. Memory Layer

SQLite สำหรับ structured records; Vector/Retrieval ใช้เฉพาะข้อมูลที่ semantic search มีประโยชน์

## 13. Response Layer

```ts
interface MaveResponse {
  message?: string;
  speech?: string;
  cards?: MaveCard[];
  sources?: SourceRef[];
  taskUpdates?: TaskUpdate[];
  suggestedActions?: SuggestedAction[];
}
```

## 14. Event Bus

ตัวอย่าง events:
- WAKE_DETECTED
- SESSION_STARTED
- TRANSCRIPT_PARTIAL
- TRANSCRIPT_FINAL
- INTENT_RESOLVED
- BRAIN_ROUTED
- TOOL_REQUESTED
- TOOL_APPROVAL_REQUIRED
- TOOL_COMPLETED
- TASK_UPDATED
- RESPONSE_STREAMED
- MEMORY_PROPOSED
- MEMORY_SAVED

## 15. Desktop Process Boundaries

```text
Electron Main
├── Runtime (ConversationRuntime)
├── VoiceSessionCoordinator
├── AudioInputProvider & AudioOutput
├── Provider Manager
├── Tool Manager
├── DB
├── Wake Supervisor
└── IPC

Renderer
├── Floating Surface
├── Full App
└── UI State

Python Wake Service
└── OpenWakeWord
```

## 16. Future Gateway

```text
                MAVE Gateway
                     │
        ┌────────────┴────────────┐
        │                         │
 Desktop Host                Mobile Companion
```

## 17. Security Boundary

LLM output must never equal execution authority. แยก model reasoning, tool permission, credential storage, OS access และ external side effects ออกจากกัน
