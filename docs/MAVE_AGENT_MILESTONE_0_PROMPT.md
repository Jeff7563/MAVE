# MAVE — Master Coding Agent Prompt
Version: 1.0
Target agent: Antigravity CLI (or any autonomous coding agent)
Project phase: Milestone 0 — Foundation
Primary platform: Windows
Language: TypeScript

---

## 0. Your Role

You are the primary implementation agent for **MAVE**, a personal AI voice assistant focused first on real-time English learning and later expanding into a cross-device personal assistant.

You are responsible for:
- planning,
- implementing,
- testing,
- debugging,
- documenting,
- and leaving the repository in a clean, runnable state.

Do not behave like a code-snippet assistant. Work like an engineer owning the task end-to-end.

Do not ask the user to make routine technical decisions that you can make safely yourself.

Only stop and ask for user input when:
1. a required secret/API key is missing,
2. an irreversible/destructive action is necessary,
3. an external account/setup step cannot be completed from the repository,
4. requirements are genuinely contradictory.

---

## 1. Source of Truth

Read this specification before changing code:

`docs/MAVE_v0.1_Specification.md`

If the file is not present in the repository, tell the user exactly where it must be placed and stop before implementing architectural decisions.

The spec is the product source of truth.

This prompt is the implementation source of truth for **Milestone 0**.

If there is a conflict:
1. Safety / security requirements win.
2. `MAVE_v0.1_Specification.md` wins over assumptions.
3. This prompt wins over incidental existing code unless preserving working code is clearly better.

---

## 2. Current Goal

Implement only:

# MAVE v0.1 — Milestone 0: Foundation

The goal is to create a stable, extensible Windows desktop foundation.

At the end of this milestone, MAVE should:
- install dependencies successfully,
- run in development mode,
- open an Electron desktop window,
- render a React UI,
- show the current assistant state,
- create a system tray icon/menu,
- initialize a local SQLite database,
- have a real XState state machine,
- have structured logging,
- have typed IPC boundaries,
- have basic unit tests,
- have basic Playwright smoke coverage,
- be organized so future wake-word, realtime voice, mobile, and cloud support do not require rewriting the core.

Do NOT implement wake-word detection yet.
Do NOT integrate OpenAI yet.
Do NOT integrate Picovoice yet.
Do NOT implement mobile yet.
Do NOT implement cloud sync yet.

---

## 3. Locked Technology Stack

Use:

### Runtime / language
- Node.js
- TypeScript
- strict TypeScript

### Workspace
- pnpm workspaces
- Turborepo

### Desktop
- Electron
- React
- Vite

### Core
- XState
- Zod

### Database
- SQLite
- Drizzle ORM
- drizzle-kit if needed for migrations

### Logging
- Pino

### Testing
- Vitest
- Playwright

Do not replace these with alternatives unless there is a hard compatibility problem.
If a compatibility problem exists, document it and choose the smallest safe deviation.

---

## 4. Architecture Principle

MAVE must be provider-independent.

Never make `packages/core` depend directly on:
- Electron,
- OpenAI,
- Picovoice,
- SQLite implementation details,
- Windows APIs,
- React.

The core should contain business logic and contracts, not platform code.

Follow this mental model:

```text
Experience Layer
    ↓
MAVE Core
    ↓
Provider Contracts / Ports
    ↓
Infrastructure / Providers
```

Examples:

```ts
export interface VoiceProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  interrupt(): Promise<void>;
}
```

```ts
export interface WakeWordProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

These interfaces may exist now even though their real providers are implemented in later milestones.

Do not overengineer them. Add only the minimum contracts that make the future boundary clear.

---

## 5. Target Repository Structure

Prefer this structure:

```text
mave/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/
│       │   ├── preload/
│       │   └── renderer/
│       ├── tests/
│       └── package.json
│
├── packages/
│   ├── core/
│   ├── contracts/
│   ├── database/
│   ├── providers/
│   ├── prompts/
│   └── shared/
│
├── docs/
│   └── MAVE_v0.1_Specification.md
│
├── scripts/
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

You may adjust minor folder details if tooling strongly benefits from it.

Do not flatten everything into the Electron app.

---

## 6. State Machine

Implement a real XState machine in `packages/core`.

Minimum v0.1 foundation states:

```text
starting
sleeping
waking
listening
thinking
speaking
reconnecting
muted
error
shuttingDown
```

For Milestone 0, only these transitions need to be interactively exercised:

```text
starting -> sleeping
sleeping -> waking
waking -> sleeping
sleeping -> muted
muted -> sleeping
* -> error
```

Create typed events.

Suggested event names:

```text
APP_READY
WAKE_DETECTED
WAKE_CANCELLED
MUTE
UNMUTE
ERROR
SHUTDOWN
```

Do not model the state as a set of independent booleans.

Expose a serializable state snapshot that the renderer can display.

---

## 7. Desktop UI

The UI should be intentionally minimal.

Initial window:

```text
MAVE

Status: Sleeping
Wake engine: Not configured
AI: Offline
Database: Ready
```

Include a small developer control area so Milestone 0 can simulate events:

- Simulate Wake
- Return to Sleep
- Toggle Mute
- Simulate Error

This is temporary developer UI.

The UI must consume state from the core/state layer, not maintain a second unrelated state model.

Avoid visual polish work.

---

## 8. Electron Responsibilities

Electron main process should own:
- application lifecycle,
- BrowserWindow lifecycle,
- system tray,
- native menu,
- secure IPC endpoints,
- database initialization,
- logging initialization,
- future provider lifecycle.

Renderer should NOT get Node integration.

Use:
- `contextIsolation: true`
- `nodeIntegration: false`
- a typed preload bridge

Do not expose arbitrary `ipcRenderer`.

Expose a small explicit API.

Example concept:

```ts
window.mave.getStatus()
window.mave.sendCommand(...)
window.mave.onStateChanged(...)
```

Use Zod to validate cross-process payloads where useful.

---

## 9. System Tray

Create a working MAVE tray menu.

Minimum:

```text
MAVE
├── Open MAVE
├── Wake (debug)
├── Sleep
├── Mute / Unmute
└── Quit
```

Tray commands should dispatch into the same state machine path used elsewhere.

Do not create separate logic for tray and UI actions.

If an icon asset is not yet available, use a small valid placeholder generated in-repo or a safe Electron-compatible fallback.
Do not block the milestone on branding.

---

## 10. Database

Create `packages/database`.

Use Drizzle + SQLite.

The database must initialize automatically.

For Milestone 0, implement at least these tables:

### settings
- id
- key
- value
- updated_at

### conversations
- id
- started_at
- ended_at
- mode
- summary
- duration_seconds

### conversation_turns
- id
- conversation_id
- speaker
- text
- created_at
- interrupted

### vocabulary
- id
- word
- normalized_word
- meaning_th
- example
- confidence
- times_seen
- times_used
- last_seen_at
- created_at

### mistakes
- id
- original_text
- corrected_text
- category
- explanation
- times_repeated
- last_seen_at
- created_at

### learning_events
- id
- event_type
- source_conversation_id
- payload_json
- created_at

### daily_stats
- date
- speaking_seconds
- english_turns
- new_words
- corrections
- sessions

The schema may use sensible SQLite-native types.

Provide migration support.

Store the runtime DB in an appropriate Electron user-data location, not in source control.

Tests may use a temporary/in-memory DB.

---

## 11. Contracts

Create a small `packages/contracts` package.

Include typed contracts for:
- assistant state snapshot,
- desktop commands,
- state-change event payload,
- settings shapes,
- provider interfaces that are clearly needed next.

Use Zod schemas where data crosses a runtime/process boundary.

Avoid duplicating types across packages.

---

## 12. Logging

Use Pino.

Create structured logs for:
- app startup,
- database initialization,
- state transition,
- tray action,
- IPC command,
- graceful shutdown,
- uncaught error.

Never log:
- secrets,
- API keys,
- authorization headers.

For development, human-readable pretty output is acceptable.

Production logging should remain structured.

---

## 13. Environment / Secrets

Create:

`.env.example`

Do NOT add any real secrets.

Include placeholders for future milestones:

```env
OPENAI_API_KEY=
PICOVOICE_ACCESS_KEY=
```

The application must run Milestone 0 without either secret.

`.env` must be ignored by Git.

---

## 14. Testing Requirements

### Unit tests

Use Vitest.

At minimum test:
1. core state machine initializes correctly,
2. APP_READY produces sleeping state,
3. WAKE_DETECTED transitions correctly,
4. mute/unmute path,
5. error state,
6. database schema initializes,
7. at least one typed IPC command validation case.

### Desktop smoke test

Use Playwright.

Test at minimum:
- Electron launches,
- MAVE heading is visible,
- initial status is displayed,
- clicking Simulate Wake changes visible state,
- returning to sleep changes it back.

If Electron Playwright integration requires a small test harness, implement it cleanly.

---

## 15. Code Quality Rules

- TypeScript strict mode.
- Avoid `any`.
- No `@ts-ignore` unless documented with a real reason.
- No silent catch blocks.
- No hardcoded machine-specific paths.
- No hidden global singleton sprawl.
- Avoid circular package dependencies.
- Prefer explicit dependency injection at infrastructure boundaries.
- Keep business logic out of React components.
- Keep renderer free of direct Node APIs.
- Do not create abstractions with only imaginary use cases.
- Document architectural boundaries in short comments/README, not huge comment blocks.

---

## 16. Security Rules

Mandatory:

- `contextIsolation: true`
- `nodeIntegration: false`
- explicit preload bridge only
- validate IPC payloads
- no secrets in renderer
- no secrets in logs
- no dynamic `eval`
- no shell command execution in Milestone 0
- no remote content in BrowserWindow
- restrict navigation/new-window behavior

Use safe Electron defaults.

---

## 17. Documentation

Update/create `README.md`.

It should contain:

### Requirements
- Node version
- pnpm version
- Windows as current supported development platform

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Typecheck

```bash
pnpm typecheck
```

### Tests

```bash
pnpm test
```

### Desktop E2E

```bash
pnpm test:e2e
```

### Database

Document migration commands.

### Architecture

Briefly explain:
- apps vs packages,
- core independence,
- state machine,
- IPC,
- database,
- future provider adapters.

Also add a short section:

```text
Next milestone: Local Wake Word
```

---

## 18. Root Scripts

Provide sensible root scripts.

Target experience:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

All commands should work from repository root.

If linting is not explicitly locked, choose a standard low-maintenance setup appropriate for TypeScript/React.

---

## 19. Implementation Workflow

Follow this process.

### Step 1 — Inspect
Inspect the current repository before changing files.

Report internally:
- existing structure,
- package manager,
- existing code worth preserving,
- possible conflicts.

### Step 2 — Plan
Create a concise implementation plan.

Do not ask the user for approval unless the plan requires a destructive or major requirement change.

### Step 3 — Implement vertically
Prefer this order:

1. workspace/bootstrap,
2. shared/contracts,
3. core XState machine,
4. database,
5. Electron shell,
6. preload + IPC,
7. React status UI,
8. tray,
9. logging,
10. tests,
11. docs.

### Step 4 — Verify
Run:
- install if needed,
- build/typecheck,
- unit tests,
- Playwright smoke test.

Fix failures before declaring success.

### Step 5 — Cleanup
Remove:
- dead files,
- abandoned experimental code,
- debug console spam,
- duplicate types,
- unused dependencies.

### Step 6 — Final report
Return a concise implementation report.

---

## 20. Do Not Do These Things

Do NOT:
- integrate OpenAI,
- integrate Porcupine,
- request API credentials,
- build mobile,
- build cloud backend,
- add authentication,
- add pgvector,
- implement screen capture,
- implement Windows app control,
- create a huge polished UI,
- build speculative abstractions for v3,
- rewrite the product specification,
- commit real secrets,
- use Docker unless clearly necessary,
- add dependencies with no concrete role in Milestone 0.

---

## 21. Acceptance Criteria

Milestone 0 is complete only if all are true:

- [ ] `pnpm install` succeeds
- [ ] `pnpm dev` launches MAVE desktop
- [ ] Electron uses safe renderer settings
- [ ] React renderer displays current MAVE state
- [ ] real XState machine is used
- [ ] debug wake/sleep transitions work
- [ ] system tray works
- [ ] SQLite DB initializes
- [ ] Drizzle schema/migrations exist
- [ ] typed preload/IPC bridge exists
- [ ] Pino logs startup + transitions
- [ ] `pnpm typecheck` passes
- [ ] unit tests pass
- [ ] Playwright smoke test passes
- [ ] `.env.example` exists
- [ ] secrets are not required
- [ ] README explains how to run everything
- [ ] architecture keeps core independent of Electron/providers

Do not claim completion if any checked item was not verified.

If a test cannot be run because of environment restrictions, explicitly mark it as unverified and explain exactly why.

---

## 22. Final Response Format

When finished, report in this exact structure:

```text
MAVE Milestone 0 — Result

Status:
PASS / PARTIAL / BLOCKED

Implemented:
- ...

Architecture decisions:
- ...

Files/packages added:
- ...

Verification:
- pnpm build: PASS/FAIL
- pnpm typecheck: PASS/FAIL
- pnpm test: PASS/FAIL
- pnpm test:e2e: PASS/FAIL

Known issues:
- ...

Manual steps required from user:
- ...

Ready for Milestone 1:
YES / NO
```

Do not paste large source files into the final answer.
The repository is the source of truth.

---

# Begin

Read `docs/MAVE_v0.1_Specification.md`, inspect the repository, create the implementation plan, and execute **Milestone 0** end-to-end.
