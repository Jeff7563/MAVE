# MAVE Milestone 4 Specification — Ambient Adaptive Surface

**Status:** Implementation Specification Baseline  
**Milestone:** M4 — MAVE Surface  
**Depends on:** M0 Foundation, M1 Wake Runtime, M2 Conversation Runtime, M3 Voice Loop  
**Source of Truth:** `docs/architecture/MAVE_AMBIENT_SURFACE_RUNTIME.md` & `docs/architecture/MAVE_AMBIENT_ADAPTIVE_SURFACE.md`  

---

## 1. Objective

Milestone 4 gives MAVE a **persistent, adaptive desktop surface** that makes the voice assistant feel like a cohesive, ambient personal entity.

### The North Star:
> **"MAVE quietly exists on the desktop, never stealing focus. When spoken to, a compact ambient capsule reacts naturally to real audio levels, presents quick answers or expands into a rich context panel when visual content is beneficial, and collapses automatically when the interaction ends."**

---

## 2. Scope

1. **Surface Contracts & Presentation Model (`@mave/contracts`)**:
   - `SurfaceMode`, `SurfaceSnapshot`, `SurfaceEvent`, `SurfaceIntent` schemas.
   - `SurfaceContentBlock` schemas (text, markdown, code, image, confirmation, progress).
2. **Surface Window Runtime Foundation (Electron Main)**:
   - `SurfaceWindowManager` controlling the frameless, transparent BrowserWindow.
   - Dynamic work area positioning anchored to bottom-right of active display.
   - Multi-monitor tracking, DPI scaling handling, and display-change recovery.
   - Strict `showInactive()` enforcement and zero focus-stealing invariant.
3. **Surface State Controller (Main Orchestrator)**:
   - `SurfaceStateController` consuming M3 voice telemetry and M2 conversation streams.
   - Automatic mode arbitration (`ambient` $\rightarrow$ `listening` $\rightarrow$ `thinking` $\rightarrow$ `speaking` $\rightarrow$ `response` $\rightarrow$ `ambient`).
   - Priority arbitration and auto-collapse inactivity timers.
4. **Compact Ambient Surface (Level 0 / Level 1)**:
   - Minimal ambient indicator dot/pill.
   - Smooth Voice Capsule ($260 \times 60$ DIP) with organic audio-reactive visualizer.
5. **Voice-Reactive States & Waveform Visualizers**:
   - Dynamic listening animation driven by M3 `inputLevel` ($0.0\text{--}1.0$).
   - Subtle indeterminate thinking pulse.
   - Signature speaking waveform driven by M3 `outputLevel` ($0.0\text{--}1.0$).
   - Instant visual yield on user barge-in without error flashes.
6. **Adaptive Hybrid Morphing & Sizing System**:
   - Step-based native window envelope bounding.
   - Hardware-accelerated CSS container morphing between size classes.
7. **Compact Response Surface (Level 2)**:
   - Quick Information Card ($340 \times 140$ DIP) for short factual answers, vocabulary, and definitions.
8. **Expanded Context Panel (Level 3)**:
   - Context panel ($440 \times 580$ DIP) with sanitized markdown, code blocks, copy buttons, and dialogue history.
   - Pinning mechanism and scrollable progressive text streaming.
9. **Interactive Controls & Click-Through Integration**:
   - Safe mouse hover capture and transparent click-through via `setIgnoreMouseEvents`.
   - Escape key collapse, pin toggle, manual dismissal, and external link handling.
10. **Engineering Diagnostics Preservation**:
    - Retention of M3 `DeveloperVoice` and M2 `DeveloperChat` panels for engineering analysis.

---

## 3. Out of Scope

The following capabilities belong to later milestones and are strictly out of scope for M4:
- **Milestone 5 (Agent Runtime & Tools)**: Tool execution engine, bash/terminal runner, file manipulation tools, MCP server integrations, and permission approval logic (M4 provides only the visual confirmation slot).
- **Milestone 6 (Memory & Knowledge)**: Long-term vector memory, cross-session semantic search, and user profile databases.
- **Milestone 7 (Learning Engine)**: Automated SRS vocabulary scheduling, pronunciation grading models, and user proficiency analytics.
- **Milestone 8+ (Autonomous & Mobile)**: Autonomous background agent loops, proactive computer vision notifications, and mobile companion app sync.

---

## 4. Existing Prerequisites

Milestone 4 builds upon frozen, verified foundations:
- **M1 / M1.2**: Local `openWakeWord` runtime and state machine (`packages/core/src/state-machine`).
- **M2**: `ConversationRuntime`, `BrainRouter`, session context continuity, and SQLite store.
- **M3**: Verified real voice pipeline (`SounddeviceAudioInputProvider`, `FasterWhisperSTTProvider`, `EdgeTTSProvider`, `SounddeviceAudioOutput`, `VoiceSessionCoordinator`, `VoiceManager`).
- **M3 Telemetry**: Normalized real-time audio levels (`inputLevel`, `outputLevel`), progressive assistant streaming tokens (`assistant_chunk`), and typed IPC bridge.

---

## 5. M4 Phased Implementation Roadmap

Milestone 4 is executed in 11 disciplined engineering phases:

| Phase | Title | Key Deliverables |
|---|---|---|
| **M4.0** | **Architecture & Milestone Specification** | Canonical `MAVE_AMBIENT_SURFACE_RUNTIME.md`, `MAVE_MILESTONE_4_SPEC.md`, roadmap updates, and architecture freeze. |
| **M4.1** | **Surface Contracts & Presentation Model** | Typed Zod schemas in `@mave/contracts` (`SurfaceSnapshot`, `SurfaceMode`, `SurfaceIntent`, `SurfaceContentBlock`). |
| **M4.2** | **Surface Window Runtime Foundation** | `SurfaceWindowManager` in Electron Main; frameless transparent window, work area anchoring, multi-monitor tracking, `showInactive()` enforcement. |
| **M4.3** | **Compact Ambient Surface (Capsule)** | Renderer `SurfaceView` foundation; Level 0 idle indicator and Level 1 Voice Capsule ($260 \times 60$ DIP). |
| **M4.4** | **Voice-Reactive States & Visualizers** | M3 telemetry integration; live input/output level reactive waveforms, thinking pulse, and barge-in visual yield. |
| **M4.5** | **Adaptive Envelope & Morph System** | Hybrid envelope bounds sizing with fluid GPU-accelerated CSS morphing between size classes. |
| **M4.6** | **Compact Response Surface (Quick Info)** | Level 2 Quick Information Card ($340 \times 140$ DIP); vocabulary, short definition, and factual card layouts. |
| **M4.7** | **Expanded Context Panel (Rich Content)** | Level 3 Context Panel ($440 \times 580$ DIP); sanitized markdown, code blocks, streaming text container, and conversation continuity. |
| **M4.8** | **Interaction, Focus & Click-Through** | Hit-testing via `setIgnoreMouseEvents`, pinning toggle, escape dismissal, and external link shell bridge. |
| **M4.9** | **Multi-Monitor, Persistence & Reliability** | Monitor disconnect recovery, DPI scaling resilience, window position persistence, and renderer reload rehydration. |
| **M4.10**| **End-to-End Surface Closeout** | Full live validation, reliability audit, regression baselines, performance benchmarks, and M4 closeout record. |

---

## 6. Deliverables per Phase

### Phase M4.1 — Contracts & Presentation State Model
- Package: `@mave/contracts` & `@mave/core`
- Deliverables:
  - `SurfaceMode` enum (`hidden`, `ambient`, `listening`, `thinking`, `speaking`, `compact_response`, `expanded_response`, `confirmation`, `progress`, `error`).
  - Presentation dimensions: `SurfaceSizeClass`, `SurfaceInteractionMode`, `SurfaceFocusIntent`, `SurfaceActivity`, `SurfaceSource`, `SurfacePriority`.
  - Semantic content blocks: `SurfaceContentBlock` discriminated union (`text`, `markdown`, `code`, `vocabulary`, `confirmation`, `progress`, `source`, `status`).
  - Typed schemas: `SurfaceSnapshotSchema`, `SurfaceEventSchema`, `SurfaceActionSchema`, `SurfacePresentationIntentSchema`.
  - `SURFACE_IPC_CHANNELS` constants (`GET_SNAPSHOT`, `EVENT`, `DISPATCH_ACTION`).
  - Presentation Engine in `@mave/core/src/surface/`:
    - `classifyResponseContent` & `StreamingResponseClassifier`: semantic sizing and stable streaming promotion.
    - `SurfaceStateController`: deterministic state transitions, focus-preservation security invariant, priority arbitration, auto-collapse policies.
    - `VoiceSurfaceAdapter`: decoupled translation of M3 voice diagnostics into surface presentation intents.

### Phase M4.2 — Surface Window Runtime Foundation
- Package: `apps/desktop/src/main/surface/`
- Deliverables:
  - `SurfaceWindowManager` implementation owning native `BrowserWindow`.
  - `calculateWorkAreaAnchor(display, sizeClass)` positioning logic.
  - Multi-monitor tracking via Electron `screen` event listeners.
  - `showInactive()` display wrapper with focus locking.

### Phase M4.3 — Compact Ambient Surface
- Package: `apps/desktop/src/renderer/src/components/surface/`
- Deliverables:
  - Root `SurfaceView.tsx` with Preload bridge subscription.
  - `AmbientIndicator.tsx` (Level 0 mini dot).
  - `VoiceCapsule.tsx` (Level 1 base container with MAVE branding).

### Phase M4.4 — Voice-Reactive Visualizers
- Package: `apps/desktop/src/renderer/src/components/surface/`
- Deliverables:
  - `AudioWaveform.tsx` driven by normalized `inputLevel` and `outputLevel`.
  - Indeterminate rhythmic thinking indicator.
  - Zero-lag transition on user barge-in.

### Phase M4.5 — Adaptive Morph System
- Package: `apps/desktop/src/renderer/src/` & `apps/desktop/src/main/`
- Deliverables:
  - Envelope bounding coordination between Main and Renderer.
  - CSS GPU transform easing curves (250 ms cubic-bezier).

### Phase M4.6 — Compact Response Surface
- Package: `apps/desktop/src/renderer/src/components/surface/`
- Deliverables:
  - `QuickInfoCard.tsx` (Level 2 card).
  - Vocabulary, definition, and short answer typography.
  - Configurable 30 s auto-collapse timer.

### Phase M4.7 — Expanded Context Panel
- Package: `apps/desktop/src/renderer/src/components/surface/`
- Deliverables:
  - `ExpandedContextPanel.tsx` (Level 3 panel).
  - Sanitized markdown renderer with syntax-highlighted code blocks.
  - Stable progressive text streaming viewport.
  - User pin toggle (`pinned` mode).

### Phase M4.8 — Interaction, Focus & Click-Through
- Package: `apps/desktop/src/main/` & `apps/desktop/src/preload/`
- Deliverables:
  - Dynamic `setIgnoreMouseEvents` hover bridge.
  - Keyboard escape listener.
  - Safe `shell.openExternal()` link sanitizer.

### Phase M4.9 — Multi-Monitor & Reliability
- Package: `apps/desktop/src/main/surface/`
- Deliverables:
  - Display unplug and DPI change re-anchoring.
  - Renderer crash/reload snapshot rehydration.
  - Settings persistence for user window preference.

### Phase M4.10 — Closeout
- Package: `docs/architecture/`
- Deliverables:
  - `MAVE_MILESTONE_4_CLOSEOUT.md`.
  - Full suite verification and formal acceptance matrix.

---

## 7. Acceptance Criteria

| # | Acceptance Criterion | Verification Method | Pass Condition |
|---|---|---|---|
| 1 | **Zero Focus-Stealing** | Automated E2E & Live Test | Active text typing in external app is never interrupted on Wake, Listening, Speaking, or Response. |
| 2 | **Work Area Anchoring** | Automated & Live Test | Surface anchors accurately to bottom-right, respecting taskbar position (bottom, top, left, right). |
| 3 | **Multi-Monitor Stability** | Live Test | Surface anchors to the active cursor display and does not glitch across monitors. |
| 4 | **DPI Resilience** | Live Test | Surface maintains sharp layout across 100%, 125%, and 150% Windows scaling. |
| 5 | **Audio-Reactive Motion** | Live Test | Waveform animations pulse cleanly to real speech without raw audio buffer access. |
| 6 | **Adaptive Sizing** | Automated & Live Test | Short answers stay in compact card; complex markdown/code expands to panel. |
| 7 | **Barge-In Reaction** | Live Test | Surface visual yields immediately ($< 50$ms) from speaking to listening upon interruption. |
| 8 | **Deterministic Auto-Collapse** | Automated & Live Test | Capsule collapses after $3\text{--}5$s, quick card after $30$s, panel after $2$m unless pinned. |
| 9 | **Pinning Permanence** | Live Test | Pinned cards remain visible indefinitely until user explicitly unpins or dismisses. |
| 10 | **Click-Through Integrity** | Live Test | Transparent padding is click-through; buttons and card content intercept clicks properly. |
| 11 | **Zero Idle GPU/CPU Overhead** | Benchmark | Idle ambient state consumes $< 0.1\%$ CPU and negligible GPU draw. |
| 12 | **Security & Sanitization** | Automated Test | Markdown renders safely without executing scripts or injecting arbitrary HTML. |
| 13 | **Diagnostics Preservation** | Live Test | Existing M3 Developer Voice panel remains accessible alongside the ambient surface. |

---

## 8. Test Strategy

1. **Automated Contract Tests (`packages/contracts`)**:
   - Unit tests validating all `SurfaceSnapshot`, `SurfaceEvent`, and `SurfaceIntent` schemas against valid and malformed payloads.
2. **Automated Window Controller Tests (`apps/desktop/tests`)**:
   - Mocked Electron tests verifying work area calculations, multi-monitor display selection, and DPI coordinate clamping.
   - Tests asserting `showInactive()` calls and `focusable: false` defaults.
3. **Automated Presentation Policy Tests (`packages/core` / `desktop`)**:
   - Unit tests for `SurfaceStateController` testing mode transitions, priority resolution, and auto-collapse timers.
4. **Playwright Desktop E2E Tests**:
   - Full Electron integration smoke test validating Wake $\rightarrow$ Capsule Appearance $\rightarrow$ Level Meter Reactions $\rightarrow$ Response Expansion $\rightarrow$ Auto-collapse.
5. **Security & Sanitization Tests**:
   - Automated checks asserting XSS attack payloads in response markdown are neutralized.

---

## 9. Performance Goals

- **Idle Resource Consumption**: $0\%$ CPU draw when MAVE is in `ambient` or `hidden` mode.
- **Visual Frame Rate**: Smooth 60 FPS CSS transitions during capsule bloom and waveform pulsing.
- **Native Bounds Handshake**: Native window envelope resizing executes in $< 16$ms.
- **Renderer Bundle Size**: Surface bundle impact $< 250$ KB gzipped.
- **GPU Budget**: Zero WebGL/3D overhead, reserving full RTX 3060 Ti memory for local `faster-whisper`.

---

## 10. UX Invariants

1. **Voice is the Primary Channel**: Visual surface is secondary and supportive; MAVE must remain fully usable even with eyes off the screen.
2. **Smallest Viable Presentation**: Never render a large card when a compact capsule or quick card suffices.
3. **Non-Intrusive Presence**: No sudden flashing, high-frequency blinking, or bouncy animations.
4. **Immediate Yield**: When the user speaks, MAVE yields instantly both audibly and visually.
5. **Dismissal Never Kills MAVE**: Closing the surface leaves the background assistant operational.

---

## 11. Security & IPC Requirements

- **Strict Sandbox**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` with minimal Preload surface API.
- **Typed IPC Only**: Zero raw audio frames, binary buffers, ChildProcess instances, or native Error objects crossing into the Renderer.
- **Safe Hyperlinks**: External URLs open strictly through Electron's `shell.openExternal()`.

---

## 12. M4 Definition of Done

Milestone 4 is officially complete when:
- [ ] MAVE has a real, persistent desktop ambient presence that does not feel like a chatbot window.
- [ ] Bottom-right anchoring works across all Windows taskbar orientations and multi-monitor setups.
- [ ] Keyboard focus is **never** stolen by passive voice activation or ambient response delivery.
- [ ] Compact Voice Capsule reacts dynamically to real microphone and speaker audio telemetry.
- [ ] Quick cards and expanded panels morph adaptively based on content semantics.
- [ ] Text streaming renders progressively without token-by-token window jitter.
- [ ] User can pin cards to keep them visible, or press Escape to dismiss.
- [ ] Inactivity auto-collapses temporary cards back to the ambient baseline.
- [ ] Click-through works on transparent boundaries without blocking underlying desktop apps.
- [ ] Full regression suite passes across Core, Providers, Desktop, Wake, STT, TTS, and E2E.
- [ ] Architecture remains fully ready to host Milestone 5 Tool/Agent approval cards.

---

## 13. Known Risks & Mitigations

| Risk | Impact | Architectural Mitigation |
|---|---|---|
| **Windows DWM Resize Jitter** | Resizing native transparent windows causes frame lag. | **Hybrid Envelope Strategy**: Native window steps to discrete envelope bounds; internal container morphs via 60 FPS CSS transforms. |
| **Accidental Focus Stealing** | User typing in other apps gets disrupted. | **Show-Inactive Rule**: Window created with `focusable: false` and shown exclusively via `showInactive()`. Focus enabled only on explicit click. |
| **Transparent Hit-Testing Traps** | Transparent window edges block clicks on desktop icons. | **Dynamic Mouse Ignore**: `setIgnoreMouseEvents(true, { forward: true })` toggled dynamically over transparent padding. |
| **Streaming Token Reflow Jitter** | Rapid LLM token delivery causes continuous layout jumping. | **Stable Viewport**: Cards open with predetermined height envelope; text streams inside internal scrolling container. |
| **Multi-Monitor DPI Glitches** | Window appears clipped or blurry on secondary displays. | **DIP Coordinates**: All sizing and coordinates calculated using Electron DIP units and work area metrics. |

---

## 14. Deferred Work

The following items are deferred to future milestones:
- **Milestone 5**: Tool approval cards, terminal execution stream cards, file permission modals.
- **Milestone 6**: Long-term memory cards and personal knowledge search panels.
- **Milestone 7**: Interactive vocabulary flashcards and language learning analytics panels.
- **Advanced Visual Polish**: Native Windows 11 Acrylic/Mica glassmorphism shaders (evaluated post-M4 baseline).

