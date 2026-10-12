# MAVE — Milestone 1.1: Replace Picovoice with openWakeWord

Target agent: Antigravity CLI
Platform: Windows
Branch: feat/milestone-1-openwakeword

## Goal
Refactor only the wake-word provider layer from Picovoice to openWakeWord while preserving MAVE Core, XState, IPC, diagnostics UI, tray, SQLite settings, logging, and tests.

Target architecture:

```text
Electron Main / TypeScript
  -> WakeWordProvider
  -> local wake-service boundary
  -> Python openWakeWord runtime
  -> ONNX wake model
```

Do NOT integrate OpenAI, realtime voice, STT, TTS, mobile, or cloud sync. Do NOT train the final MAVE model yet.

## Read first
- docs/MAVE_v0.1_Specification.md
- docs/MAVE_AGENT_MILESTONE_0_PROMPT.md
- docs/MAVE_AGENT_MILESTONE_1_WAKE_WORD.md
- README.md

Inspect the actual Milestone 1 implementation before editing.

## Preserve architecture
- `@mave/core` must remain provider-independent.
- Keep the existing `WAKE_DETECTED` event path.
- Do not create a second state machine.
- React must not access microphone hardware or Python directly.
- Keep the same wake lifecycle: sleeping=start wake engine, leaving sleeping=stop, muted=stop, shutdown=dispose.

## New provider
Implement `OpenWakeWordProvider`.

The TypeScript side should supervise a local Python process. Prefer newline-delimited JSON over stdio unless the repo already has a better local IPC abstraction.

Example protocol events:

```json
{"type":"status","status":"listening","device":"..."}
{"type":"wake_detected","model":"mave","score":0.83,"timestamp":"..."}
{"type":"error","code":"MODEL_MISSING","message":"..."}
```

Protocol messages go to stdout. Human diagnostic logs go to stderr. Never parse free-form logs as protocol.

## Python wake service
Add an isolated service, e.g.:

```text
services/wake/
  pyproject.toml
  src/mave_wake/
    main.py
    audio.py
    engine.py
    protocol.py
    config.py
  tests/
```

Requirements:
- openWakeWord runtime
- local microphone capture
- configurable input device
- configurable threshold
- configurable model path
- clean shutdown
- no raw audio persistence
- no cloud calls
- structured JSON protocol

Automated tests must not require a real microphone or final model.

## Model boundary
Expected configurable path:

```text
assets/wake/mave.onnx
```

Do not fabricate it. If missing, app must start and report `Not configured` or `Model missing`.

Final custom MAVE model training belongs to Milestone 1.2.

## Configuration
Use provider-neutral settings:
- wakeProvider = openwakeword
- enabled
- microphoneDevice
- threshold
- modelPath

Remove Picovoice-specific secret requirements from the active runtime path. Remove `PICOVOICE_ACCESS_KEY` from `.env.example` if no longer needed.

## Dependency cleanup
Remove active runtime dependency on:
- @picovoice/porcupine-node
- @picovoice/pvrecorder-node

Only after verifying there are no remaining active imports.

Do not rewrite Git history. The previous Picovoice commit remains the rollback point.

## Electron supervision
Create a safe subprocess supervisor:
- start only when wake should be active
- stop when leaving sleeping
- restart when returning to sleeping
- stop on mute
- terminate on app quit
- prevent duplicate processes
- detect unexpected exit
- bounded retry/backoff only
- never leave orphan Python processes

## Security/privacy
- no API key required
- no audio uploaded
- no audio stored
- validate renderer-supplied settings
- do not construct unsafe shell commands from renderer input

## Diagnostics UI
Preserve current UI and show:

```text
Status: Sleeping
Wake engine: Listening / Ready / Not configured / Error
Wake provider: openWakeWord
Microphone: ...
Wake word: MAVE
Threshold: ...
Last wake: ...
AI: Offline
Database: Ready
```

## Tests
Keep all existing tests green and add coverage for:
1. process supervisor start/stop
2. duplicate-start prevention
3. clean shutdown
4. JSON protocol parsing
5. malformed protocol handling
6. wake_detected -> WAKE_DETECTED -> waking
7. mute stops wake service
8. returning to sleep restarts it
9. missing model handled safely
10. unexpected process exit surfaced
11. Picovoice no longer required by active runtime

Python tests:
- protocol serialization
- config validation
- fake engine/inference abstraction
- no microphone required

## Verification
Before changes run:
```bash
pnpm build
pnpm typecheck
pnpm test
pnpm test:e2e
```

After changes run and fix:
```bash
pnpm build
pnpm typecheck
pnpm test
pnpm test:e2e
```

Also run the Python wake-service test suite.

## Git
Work only on:
```text
feat/milestone-1-openwakeword
```

Create a local commit only after verification. Do not push.

## Final report
Return:

```text
MAVE Milestone 1.1 — openWakeWord Refactor

Status:
PASS / PARTIAL / BLOCKED

Implemented:
- ...

Removed / retired:
- ...

Architecture:
- ...

Python wake service:
- ...

Electron supervision:
- ...

Verification:
- pnpm build:
- pnpm typecheck:
- pnpm test:
- pnpm test:e2e:
- python tests:

Live wake status:
- final MAVE model available: YES/NO
- microphone tested: YES/NO
- MAVE detected live: YES/NO

Known issues:
- ...

Manual steps required:
- ...

Git:
- branch:
- commit:
- status:
- pushed: NO

Ready for Milestone 1.2 model training:
YES / NO
```

Begin by inspecting the repository and verifying the current Milestone 1 branch. Preserve rollback safety and refactor only the wake provider.
