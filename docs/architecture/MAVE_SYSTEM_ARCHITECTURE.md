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

Provider Adapter Pattern:

```text
BrainRouter
├── FastBrainProvider
├── AgentBrainProvider
├── ResearchProvider
└── LocalProvider
```

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
├── Runtime
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
