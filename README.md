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
  - `packages/providers`: Mock adapters establishing clean boundaries for future audio/wake providers.
  - `packages/prompts`: System prompt definitions and learning mode instructions.

- **State Machine**:
  - Explicit XState v5 state machine (`starting`, `sleeping`, `waking`, `listening`, `thinking`, `speaking`, `reconnecting`, `muted`, `error`, `shuttingDown`).
  - Provides serializable state snapshots for the renderer.

- **Security & IPC**:
  - `contextIsolation: true`, `nodeIntegration: false`.
  - Explicit typed preload bridge (`window.mave`).
  - Strict payload validation with Zod schemas.

---

## Next Milestone: Local Wake Word

Milestone 1 will implement always-on local wake-word detection using Picovoice Porcupine and PvRecorder on Windows, transitioning MAVE from `sleeping` to `waking` upon speaking **"MAVE"**.
