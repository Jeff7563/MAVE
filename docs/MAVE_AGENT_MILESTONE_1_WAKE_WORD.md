# MAVE — Coding Agent Prompt
## Milestone 1: Local Wake Word

Version: 1.0
Target agent: Antigravity CLI or equivalent autonomous coding agent
Primary platform: Windows
Project: MAVE
Phase: MAVE v0.1 — Milestone 1

---

## 0. Role

You are the implementation agent for MAVE.

Work as an engineer owning the milestone end-to-end:
- inspect,
- plan,
- implement,
- test,
- debug,
- document,
- and leave the repository clean.

Do not behave like a snippet generator.

Do not ask the user about routine engineering decisions that can be made safely from the repository and specifications.

Stop only when:
1. a required external credential or model file is needed for a real-device manual test,
2. an irreversible/destructive action is required,
3. requirements genuinely conflict,
4. an external account action cannot be performed locally.

---

## 1. Required Reading

Before changing implementation code, read completely:

- `docs/MAVE_v0.1_Specification.md`
- `docs/MAVE_AGENT_MILESTONE_0_PROMPT.md`
- `README.md`

Then inspect the implementation created in Milestone 0.

Do not assume the Milestone 0 result report is sufficient; inspect the actual code and package configuration.

---

## 2. Current Goal

Implement:

# MAVE v0.1 — Milestone 1: Local Wake Word

At the end of this milestone, the Windows desktop application must be capable of:

```text
MAVE running
    ↓
state = sleeping
    ↓
local microphone capture
    ↓
Porcupine processes frames locally
    ↓
user says "MAVE"
    ↓
WAKE_DETECTED
    ↓
existing MAVE state machine receives the event
    ↓
state = waking
    ↓
UI/tray reflects detection
```

This milestone is LOCAL WAKE ONLY.

Do NOT integrate OpenAI.
Do NOT create a realtime AI session.
Do NOT implement speech-to-text.
Do NOT implement text-to-speech.
Do NOT implement microphone handoff to WebRTC yet.
Do NOT implement mobile.
Do NOT implement cloud sync.

---

## 3. Official Wake Word

Product name:

`MAVE`

Spoken target:

`/meɪv/` ("เมฟ")

The user-facing product name must always remain `MAVE`.

For Picovoice Console training, the preferred phrase is:

`MAVE`

If Picovoice's phrase validation/pronunciation handling is unreliable for that spelling, the user may train the spoken keyword using:

`Maeve`

while the application label remains `MAVE`.

Do not rename the product to Maeve.

---

## 4. Locked Wake Stack

Use:

- `@picovoice/porcupine-node`
- `@picovoice/pvrecorder-node`

Wake processing must happen locally on the machine.

Use the Node.js Porcupine SDK, not the browser/React Porcupine SDK.

The renderer must not own the always-on wake microphone.

The wake engine belongs to the desktop infrastructure/main side.

Check the current Picovoice Node documentation before implementation for exact constructor/API details.

---

## 5. Architecture Boundary

Milestone 0 established a provider-independent architecture. Preserve it.

The existing core must continue to have no direct dependency on Picovoice.

Expected conceptual structure:

```text
packages/core
    ↑
WakeWordProvider contract
    ↑
PicovoiceWakeWordProvider
    ↑
Electron desktop lifecycle
```

Implement the real provider in an infrastructure/provider package or an appropriate desktop infrastructure module.

Prefer a package similar to:

```text
packages/providers/
  wake-picovoice/
```

if the current monorepo structure supports that cleanly.

If `packages/providers` already contains suitable boundaries, integrate there rather than creating duplicate architecture.

Do not place Porcupine logic in React components.

---

## 6. Provider Lifecycle

Review the existing `WakeWordProvider` contract from Milestone 0.

Extend it only if necessary.

The implementation must support, conceptually:

```ts
interface WakeWordProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
```

and a way to deliver:

```text
WAKE_DETECTED
```

to the application.

The concrete API does not need to match the snippet exactly.

Requirements:
- start must be safe and predictable,
- stop must release/stop microphone activity,
- repeated start/stop operations must not create duplicate loops,
- dispose must free Porcupine and recorder resources,
- shutdown must not leave microphone resources open.

Design this lifecycle carefully because Milestone 3 will require microphone handoff to realtime voice.

---

## 7. Audio Capture

Use PvRecorder to capture PCM frames.

Porcupine exposes the required frame length/sample rate information. Use the required frame length rather than an arbitrary hardcoded value when possible.

Pipeline:

```text
PvRecorder
   ↓ PCM frame
Porcupine.process(...)
   ↓
keyword index >= 0
   ↓
WAKE_DETECTED
```

Use the selected microphone device or the system default.

---

## 8. Microphone Device Management

Add support for enumerating available PvRecorder input devices.

Requirements:

- default microphone selection must work,
- expose device names in the MAVE settings/developer UI,
- allow selection of a device,
- persist selected device setting locally,
- gracefully handle a previously selected device disappearing,
- provide a clear error instead of crashing if no input device exists.

Do not build an elaborate settings design.

A simple developer/settings panel is enough.

---

## 9. Wake Configuration

Support at least:

```text
enabled
microphoneDeviceIndex
sensitivity
keywordModelPath
```

Initial sensitivity:

```text
0.50
```

Valid range:

```text
0.0 – 1.0
```

Expose developer testing around:

```text
0.40 – 0.70
```

Validate configuration.

---

## 10. Secrets

Picovoice AccessKey is a secret.

Expected local development environment variable:

```env
PICOVOICE_ACCESS_KEY=
```

Rules:
- never commit a real AccessKey,
- never expose it to the React renderer,
- never log it,
- never include it in error dumps,
- read it only in trusted Electron/main/provider infrastructure.

The app must still start cleanly when the key is missing.

When missing, wake status should be `Not configured` instead of crashing.

Tests must not require a real AccessKey.

---

## 11. Custom Keyword Model

The real live wake test requires a Windows Porcupine `.ppn` custom keyword model.

Provide configuration for its location.

Recommended logical location:

```text
assets/wake/mave_windows.ppn
```

Do not assume the file exists.

Requirements:
- validate that the configured file exists before starting the real wake engine,
- show a clear `keyword model missing` state,
- do not crash,
- do not fabricate a `.ppn`,
- do not attempt to train a model from code in this milestone.

If licensing/repository policy is uncertain, keep the model local and document the expected path.

---

## 12. Wake Engine Runtime

The wake loop must not freeze Electron.

Use a cancellable asynchronous processing loop or another reliable isolation strategy.

If using the Electron main process:
- ensure frame reading does not block normal app IPC/window lifecycle,
- support cancellation cleanly.

If using worker threads:
- verify the Picovoice native package works correctly there,
- do not add worker complexity unless it materially improves reliability.

Choose the simplest verified implementation.

Do not use an unbounded `while(true)` loop without cancellation.

---

## 13. State Machine Integration

Do not create a second state machine.

Use the existing MAVE core state machine.

When the provider detects the wake word:

```text
WAKE_DETECTED
```

must enter the same event path used by the Milestone 0 debug simulation.

Expected behavior:

```text
sleeping
   ↓ WAKE_DETECTED
waking
```

Since realtime voice is not implemented yet, do not fake AI/listening functionality.

It is acceptable for MAVE to remain in `waking` until manual Sleep or a clearly documented development-only timeout returns it to `sleeping`.

---

## 14. Wake Lifecycle vs MAVE State

The wake engine should normally run only while wake detection is meaningful.

At minimum:

```text
sleeping → wake engine STARTED
waking   → wake engine STOPPED
muted    → wake engine STOPPED
shutdown → wake engine DISPOSED
```

When MAVE returns to sleeping:
- restart wake capture cleanly.

This is essential for future microphone handoff.

Test repeated cycles.

---

## 15. UI / Diagnostics

Extend the existing minimal status UI.

Display:

```text
MAVE

Status: Sleeping
Wake engine: Ready / Listening / Not configured / Error
Microphone: <device name>
Wake word: MAVE
Sensitivity: 0.50
Last wake: <time or Never>
AI: Offline
Database: Ready
```

Provide:
- microphone selector,
- sensitivity control,
- Restart Wake Engine,
- existing debug controls if useful.

When detected, visibly show `MAVE detected` and last detection time.

Do not build polished animations yet.

---

## 16. Error Handling

Handle at least:

### Missing AccessKey
- application runs,
- wake engine = Not configured.

### Missing `.ppn`
- application runs,
- clear diagnostic state.

### No microphone
- application runs,
- wake engine = Error / unavailable.

### Invalid microphone index
- fall back safely and explain it.

### Picovoice initialization error
- log sanitized details,
- expose concise UI status.

### Recorder read failure
- stop/release resources,
- enter safe error state,
- allow Restart Wake Engine.

### Application quit
- stop recorder,
- release PvRecorder,
- release Porcupine.

No crash loops.

---

## 17. Logging

Add structured logs for:

```text
wake.initializing
wake.ready
wake.started
wake.detected
wake.stopped
wake.restarting
wake.error
wake.disposed

audio.device_selected
audio.device_missing
```

Never log:
- Picovoice AccessKey,
- raw audio,
- environment secrets.

---

## 18. Privacy

Milestone 1 must preserve:

> Always listening does not mean always uploading.

While MAVE is sleeping:
- wake audio is processed locally,
- raw microphone audio is not written to disk,
- microphone audio is not sent to OpenAI or another cloud provider.

Do not implement audio recording/history.

---

## 19. Tests

Automated tests must not depend on:
- a physical microphone,
- a real Picovoice AccessKey,
- a real `.ppn`.

Use dependency injection/fake providers.

Add coverage for at least:

1. wake provider lifecycle abstraction,
2. start called when entering sleeping,
3. stop called when leaving sleeping,
4. WAKE_DETECTED reaches the existing state machine,
5. mute stops wake engine,
6. unmute/sleep restarts wake engine,
7. repeated start does not create duplicate active loops,
8. stop/dispose are safely repeatable,
9. missing configuration produces `Not configured`,
10. wake configuration validation,
11. secrets never appear in renderer-facing status.

Extend Electron/Playwright smoke coverage to verify:
- wake diagnostics render,
- mocked wake detection changes state,
- last wake appears,
- returning to sleep restores expected wake lifecycle.

Keep real microphone detection as a manual test.

---

## 20. Native Package / Build Handling

Porcupine and PvRecorder use native/runtime resources.

Inspect the Milestone 0 Electron `tsup`/bundling configuration.

Do not incorrectly inline native modules/resources.

Keep packages external where required and make development mode work reliably.

Do not rewrite the Electron build system unless necessary.

Document future packaging requirements if installer packaging is not yet part of the repository.

---

## 21. Baseline & Verification

Before implementation, run the existing Milestone 0 verification.

If Milestone 0 is already broken, stop and report it rather than hiding the regression.

After implementation, run and fix:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm test:e2e
```

All previous tests must still pass.

---

## 22. Manual Live Test

After the user locally supplies:
- `PICOVOICE_ACCESS_KEY`,
- Windows `.ppn` model,

the live test should be:

```text
1. Run pnpm dev.
2. MAVE reports Wake engine Ready/Listening.
3. Say "MAVE".
4. MAVE detects it.
5. State leaves sleeping.
6. Recorder stops.
7. Return MAVE to sleep.
8. Recorder restarts.
9. Repeat at least 20 times.
```

Add useful diagnostics for this test.

Do not ask the user to paste an AccessKey into chat. It belongs only in local `.env`.

---

## 23. Git Rules

Work on the Milestone 1 feature branch.

Do not modify the default branch directly.

When implementation and automated verification pass:
- create a local commit,
- do NOT push unless explicitly instructed.

---

## 24. Acceptance Criteria

Milestone 1 automated implementation is complete when:

- [ ] Milestone 0 remains green
- [ ] Picovoice dependencies are integrated in trusted code
- [ ] real Picovoice WakeWordProvider exists
- [ ] microphone devices can be enumerated
- [ ] selected microphone can be persisted
- [ ] sensitivity is configurable
- [ ] AccessKey remains secret
- [ ] missing AccessKey is handled safely
- [ ] missing `.ppn` is handled safely
- [ ] wake detection dispatches existing WAKE_DETECTED
- [ ] wake starts in sleeping
- [ ] wake stops when leaving sleeping
- [ ] wake restarts on return to sleeping
- [ ] mute disables wake capture
- [ ] shutdown frees resources
- [ ] raw audio is not saved
- [ ] no wake audio is sent to cloud
- [ ] diagnostics UI works
- [ ] fake-provider automated coverage exists
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm test:e2e` passes
- [ ] live-test instructions are documented

Full live acceptance additionally requires:
- [ ] actual Windows microphone test
- [ ] actual custom MAVE/Maeve `.ppn`
- [ ] actual Picovoice AccessKey
- [ ] live "MAVE" detection
- [ ] at least 20 successful wake/sleep cycles
- [ ] false positives observed during normal room use

Do not claim live items passed unless genuinely tested.

---

## 25. Final Report Format

Return:

```text
MAVE Milestone 1 — Result

Status:
PASS / PARTIAL / BLOCKED

Baseline:
- branch:
- baseline commit:
- baseline tests:

Implemented:
- ...

Architecture:
- ...

Wake lifecycle:
- ...

Security/privacy:
- ...

Verification:
- pnpm build:
- pnpm typecheck:
- pnpm test:
- pnpm test:e2e:

Live wake verification:
- AccessKey configured: YES/NO
- .ppn configured: YES/NO
- microphone tested: YES/NO
- "MAVE" detected live: YES/NO
- 20-cycle test: PASS/FAIL/NOT RUN

Known issues:
- ...

Manual steps required:
- ...

Git:
- branch:
- commit:
- status:
- pushed: NO

Ready for Milestone 2:
YES / NO / AUTOMATED-ONLY
```

Do not paste large source files.

---

# Begin

Inspect the repository and verify Milestone 0 first.

Then implement MAVE v0.1 Milestone 1 — Local Wake Word end-to-end without integrating any realtime AI service.
