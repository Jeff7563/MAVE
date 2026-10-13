# MAVE Milestone 3 Specification — Voice Loop

**Status:** Implementation Specification  
**Milestone:** M3 — Voice Loop  
**Depends on:** M0 Foundation, M1 Presence / Wake Runtime, M1.2 Wake Lifecycle Stabilization, M2 Conversation Runtime  
**Source of Truth:** `docs/architecture/MAVE_VOICE_ARCHITECTURE.md` + Master Architecture Pack  

---

## 1. Goal

Milestone 3 turns MAVE into a **conversational voice assistant** capable of end-to-end hands-free dialogue:
$$\text{Wake} \longrightarrow \text{Listen} \longrightarrow \text{Transcribe} \longrightarrow \text{Reason} \longrightarrow \text{Synthesize} \longrightarrow \text{Speak} \longrightarrow \text{Follow-Up / Sleep}$$

M3 establishes the core audio abstractions, streaming pipelines, progressive speech synthesis, barge-in interruption, and clean wake handoffs necessary to deliver a fluid spoken conversational experience without binding MAVE to any single cloud or local speech vendor.

---

## 2. M3 North Star

> **"A user can wake MAVE by voice, speak a natural bilingual request, hear an intelligent answer spoken aloud, and interrupt MAVE at any time without latency degradation, echo loops, or state corruption."**

---

## 3. Dependencies from M1 & M2

Milestone 3 directly leverages the frozen foundations built in prior milestones:
- **From M1 / M1.2:**
  - `WakeWordProvider` abstraction and `OpenWakeWordProvider`.
  - Supervisor lifecycle in `apps/desktop/src/main/wake-manager.ts`.
  - Stable assistant macro-state machine in `packages/core/src/state-machine/machine.ts`.
- **From M2:**
  - `ConversationRuntime` streaming orchestration.
  - `SessionManager` multi-turn dialogue management.
  - `ContextManager` token budgeting and prompt assembly.
  - `BrainRouter` and `BrainProfilePolicy` with canonical profiles (`fast_conversation`).
  - `SQLiteConversationStore` zero-per-delta persistence.
  - Typed IPC streaming bridges and correlation hardening.

---

## 4. In Scope

1. **Vendor-Neutral Voice Contracts (`@mave/contracts`):**
   - `AudioInputProvider` & `AudioFrame`
   - `STTProvider` & `TranscriptEvent`
   - `TTSProvider` & `SpeechRequest`
   - `AudioOutput` playback interface
   - `VoiceSessionCoordinator` events & diagnostics
2. **Canonical Audio Pipeline:**
   - 16 kHz, 16-bit signed, mono Linear PCM format standard.
   - Discrete 80ms (1280 samples) audio frame chunking.
3. **VoiceSessionCoordinator (`@mave/core` / Main):**
   - Seamless microphone handoff from wake detection.
   - VAD-assisted speech boundary detection.
   - Pipelined streaming TTS chunker (sentence-level progressive synthesis).
   - Conversational follow-up timer (5–8s listening window).
4. **Barge-In & Cancellation:**
   - Real-time speech onset detection during active playback.
   - Immediate audio cutoff ($< 100\text{ ms}$).
   - Propagation of cancellation to TTS and Brain generation while preserving turn text in database.
5. **Acoustic Self-Hearing Prevention:**
   - Wake engine shutdown during active speech.
   - Acoustic echo suppression during barge-in detection.
6. **Deterministic Mock Test Fixtures:**
   - `MockAudioInputProvider`, `MockSTTProvider`, `MockTTSProvider`, `MockAudioOutput`.
   - Automated offline testing with synthetic audio fixtures.
7. **First Real STT & TTS Providers:**
   - One real production speech-to-text adapter.
   - One real production text-to-speech adapter.
8. **Surface Telemetry & Diagnostics:**
   - Real-time output amplitude events ($50\text{--}60\text{ Hz}$) for M4 capsule reactivity.
   - Developer Voice Diagnostics UI panel in Electron Renderer.

---

## 5. Explicitly Out of Scope

The following items are strictly deferred to future milestones:
- **Milestone 4:** Floating Capsule, Floating Orb, glassmorphism UI window, draggable canvas surfaces.
- **Milestone 5:** Tool Registry, terminal execution, MCP tools, filesystem operations, permissions.
- **Milestone 6:** Long-term vector memory, cross-session semantic search, personal memory graphs.
- **Milestone 7:** Automated vocabulary extraction, pronunciation grading, language learning analytics.
- **Milestone 8+:** Computer vision, proactive autonomous notifications, mobile companion sync.

---

## 6. Planned Voice Contracts

*(Conceptual schemas to be formalized in `@mave/contracts` during M3.1)*

### 6.1 Audio Input & Framing
```ts
export interface AudioFrame {
  data: Int16Array;
  sampleRate: 16000;
  channels: 1;
  timestamp: number;
  sequenceNumber: number;
}

export interface AudioInputDeviceInfo {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface AudioInputProvider {
  readonly id: string;
  listDevices(): Promise<AudioInputDeviceInfo[]>;
  startCapture(deviceIndex?: number): Promise<void>;
  stopCapture(): Promise<void>;
  streamFrames(): AsyncIterable<AudioFrame>;
  isCapturing(): boolean;
}
```

### 6.2 Speech-to-Text (STT)
```ts
export interface STTCapabilities {
  streaming: boolean;
  partialTranscripts: boolean;
  wordTimestamps: boolean;
  supportedLanguages: string[]; // e.g. ['th', 'en']
  offline: boolean;
}

export type TranscriptEvent =
  | { type: 'speech_started'; timestamp: number }
  | { type: 'partial_transcript'; text: string; confidence?: number; timestamp: number }
  | { type: 'final_transcript'; text: string; confidence: number; language?: string; timestamp: number }
  | { type: 'speech_ended'; timestamp: number }
  | { type: 'cancelled'; reason: string; timestamp: number }
  | { type: 'error'; error: string; timestamp: number };

export interface STTProvider {
  readonly id: string;
  getCapabilities(): STTCapabilities;
  health(): Promise<ProviderHealth>;
  transcribeStream(
    audioStream: AsyncIterable<AudioFrame>,
    options?: { languageHints?: string[] }
  ): AsyncIterable<TranscriptEvent>;
  cancel?(sessionId: string): Promise<void>;
}
```

### 6.3 Text-to-Speech (TTS)
```ts
export interface TTSCapabilities {
  streaming: boolean;
  supportedLanguages: string[];
  voices: { id: string; name: string; language: string; gender?: string }[];
  offline: boolean;
}

export interface SpeechRequest {
  text: string;
  voiceId?: string;
  language?: string;
  rate?: number;
}

export interface TTSProvider {
  readonly id: string;
  getCapabilities(): TTSCapabilities;
  health(): Promise<ProviderHealth>;
  synthesize(request: SpeechRequest): AsyncIterable<AudioFrame>;
  cancel?(requestId: string): Promise<void>;
}
```

### 6.4 Audio Output & Playback
```ts
export interface AudioOutputDeviceInfo {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface AudioOutput {
  readonly id: string;
  listDevices(): Promise<AudioOutputDeviceInfo[]>;
  playStream(stream: AsyncIterable<AudioFrame>): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  setVolume(volume: number): Promise<void>; // 0.0 to 1.0
  onLevel(callback: (level: number) => void): () => void; // 0.0 to 1.0
  isPlaying(): boolean;
}
```

---

## 7. Voice State Model

MAVE operates a **two-tier state model**:
1. **Macro-Lifecycle (Global Assistant State Machine):**
   Managed by the proven XState machine in `@mave/core`:
   $$\text{sleeping} \xrightarrow{\text{WAKE\_DETECTED}} \text{waking} \xrightarrow{\text{START\_LISTENING}} \text{listening} \xrightarrow{\text{USER\_SPEECH\_ENDED}} \text{thinking} \xrightarrow{\text{ASSISTANT\_SPEAKING}} \text{speaking} \xrightarrow{\text{ASSISTANT\_FINISHED}} \text{listening} \xrightarrow{\text{TIMEOUT}} \text{sleeping}$$
   *(Barge-In transition: $\text{speaking} \xrightarrow{\text{USER\_SPEECH\_STARTED}} \text{listening}$)*
2. **Micro-Lifecycle (VoiceSessionCoordinator Internal Coordinator):**
   Lightweight event-driven sub-states inside the coordinator:
   - `AUDIO_CAPTURING`: Microphone active, streaming frames.
   - `VAD_ACTIVE`: Speech detected above ambient threshold.
   - `STT_STREAMING`: Emitting partial transcripts to UI.
   - `LLM_STREAMING`: Generating token stream from `ConversationRuntime`.
   - `TTS_PIPELINING`: Converting sentence chunks to audio.
   - `PLAYBACK_ACTIVE`: Emitting audio to speakers and telemetry to surface.

---

## 8. Wake $\longrightarrow$ Voice Handoff

```text
Step 1: Assistant in 'sleeping' state.
        Wake engine owns microphone via sounddevice (Python).

Step 2: Wake phrase "Hey MAVE" detected.
        Python emits {"type": "wake", "score": 0.85}.

Step 3: Electron Main wake-manager.ts receives wake event.
        - Checks state is 'sleeping' and rearmGuardMs has passed.
        - Dispatches WAKE_DETECTED to XState machine.
        - State machine transitions to 'waking'.

Step 4: Microphones Released.
        - wake-manager.ts detects non-sleeping state and calls OpenWakeWordProvider.stop().
        - Python AudioCapture closes sounddevice.InputStream and drains queues.
        - Hardware device is completely freed.

Step 5: Voice Session Initialized.
        - VoiceSessionCoordinator initiates turn and starts AudioInputProvider.
        - Fresh audio buffers capture user speech with zero buffer bleed.

Step 6: Return to Sleeping.
        - Voice session terminates after conversational timeout.
        - AudioInputProvider stops and frees microphone.
        - State machine transitions to 'sleeping'.
        - wake-manager.ts activates rearmGuardMs (300ms) and restarts OpenWakeWordProvider.
```

---

## 9. Speech-to-Text Pipeline

1. **Microphone Capture:** `AudioInputProvider` delivers raw 16kHz PCM chunks.
2. **Voice Activity Detection:** Lightweight energy + zero-crossing VAD identifies speech onset.
3. **Streaming Transcription:** Audio frames are piped into `STTProvider.transcribeStream()`.
4. **Partial Transcripts:** Emitted across IPC for live display in Developer Chat / M4 Surface.
5. **Silence Detection:** When speech ceases for $> 600\text{--}900\text{ ms}$, end-of-utterance is triggered.
6. **Final Transcript:** Emitted and verified. `AudioInputProvider` pauses capture, and coordinator transitions state to `thinking`.

---

## 10. Brain Handoff

The final transcript is submitted to `ConversationRuntime.execute()`:
- `profileId: 'fast_conversation'`
- `BrainProfilePolicy` resolves requirements (`streaming: true`, `fastChat: true`).
- `BrainRouter` selects the optimal active provider.
- In M3 development: `MockBrainProvider` generates deterministic streamed chunks; in live evaluation: `AntigravityBrainProvider` or an evaluated Fast Brain is utilized.
- LLM output streams as progressive token events (`type: 'delta'`).

---

## 11. Text-to-Speech Pipeline

1. **Chunk Ingestion:** `StreamingTextChunker` collects streaming LLM tokens.
2. **Sentence Boundary Detection:** Flushes at `.`, `!`, `?`, `\n`, or clause boundaries (min 6 words).
3. **Synthesis Dispatch:** Sentence 1 is dispatched to `TTSProvider.synthesize()` while sentence 2 is being generated.
4. **Playback Pipelining:** Synthesized PCM frames are fed into `AudioOutput.playStream()`.
5. **Telemetry Stream:** `AudioOutput` emits RMS amplitude at 50Hz for M4 UI reactive waveforms.

---

## 12. Streaming Strategy (Latency Minimization)

$$\text{LLM Token Generation} \parallel \text{Text Chunking} \parallel \text{TTS Synthesis} \parallel \text{Audio Playback}$$

By overlapping synthesis of early sentences with ongoing LLM generation, Time-to-First-Audio (TTFA) is reduced from several seconds to **$200\text{--}500\text{ ms}$** after the first sentence completes generation.

---

## 13. Barge-In / Interruption

```text
1. Assistant in 'speaking' state; AudioOutput playing response.
2. User begins speaking: "Wait, stop..."
3. AudioInputProvider + VAD detects speech onset above acoustic echo threshold.
4. USER_SPEECH_STARTED dispatched immediately.
5. VoiceSessionCoordinator executes hard stop:
   - AudioOutput.stop() halts speakers (< 100ms)
   - TTSProvider.cancel() aborts pending synthesis
   - ConversationRuntime.cancel() aborts LLM generation if still active
6. Assistant turn in SQLite is flagged with playbackStatus: 'interrupted'.
   (Assistant response text is preserved for multi-turn context integrity).
7. Assistant transitions to 'listening', routing new audio directly to STT.
```

---

## 14. Cancellation Architecture

- Adheres to M2's **"First Terminal Event Wins"** guarantee.
- Request cancellations propagate synchronously through abort controllers and process signals.
- Out-of-order IPC events are rejected using unique turn/request ID correlation.

---

## 15. Privacy & Data Retention Policy

- **Microphone Audio:** 100% ephemeral in RAM; zero automatic disk retention.
- **Partial Transcripts:** 100% ephemeral in RAM; discarded after turn completion.
- **Final Transcripts:** Persisted to SQLite `conversations.db` with turn metadata.
- **Synthesized Voice:** 100% ephemeral in RAM; discarded after playback.
- **Diagnostics:** Audio WAV capture requires explicit user opt-in for benchmarking.

---

## 16. Device Management

- Supports dynamic selection of input and output hardware devices.
- Handles peripheral disconnections by falling back to OS system defaults.
- Retains user device preferences across app restarts in SQLite settings.

---

## 17. Error Model

| Error Scenario | Runtime Behavior | User Experience |
|---|---|---|
| **Microphone Disconnected** | Emits `DEVICE_ERROR`, stops capture. | Visual alert in UI; reverts to text input. |
| **STT Unreachable / Auth Fail** | Emits `STT_ERROR`, logs diagnostic. | Displays error card; suggests repeating. |
| **Silence Timeout (No Speech)** | 6-second timeout triggers graceful abort. | Soft chime; returns to `sleeping`. |
| **TTS Synthesis Failure** | Emits non-fatal `TTS_ERROR`. | Text answer displayed on screen silently. |
| **Brain Timeout (30s)** | Triggers M2 standard timeout cancellation. | Speaks friendly timeout notification. |

---

## 18. Latency Targets (Product Target)

$$\begin{aligned}
\text{Wake Acknowledgment Chime} &\le 300\text{ ms} \\
\text{Speech End (EOU) Detection} &\approx 400\text{--}700\text{ ms} \\
\text{STT Final Transcript} &\approx 200\text{--}600\text{ ms} \\
\text{Fast Brain TTFT} &\approx 1000\text{--}2500\text{ ms} \\
\text{TTS First Audio (Sentence 1)} &\approx 200\text{--}500\text{ ms} \\
\hline
\mathbf{Total\ Turn\ Turnaround} &\mathbf{\approx 2.0\text{--}4.0\text{ s}}
\end{aligned}$$

---

## 19. Fast Brain Requirements for Voice

To achieve natural JARVIS-like spoken flow:
1. **Time-to-First-Token:** $\le 1\text{--}3\text{ seconds}$ where practical.
2. **Minimal Input Overhead:** No heavy workspace or filesystem initialization on conversational turns.
3. **Streaming Support:** Low-latency token deltas.
4. **Bilingual Fluency:** High-quality Thai and English conversational naturalness.

---

## 20. M4 Surface Event Contract

Electron IPC channel `mave:voice:event` exposes:
- `state`: `'idle' | 'waking' | 'listening' | 'thinking' | 'speaking' | 'interrupted'`
- `inputLevel`: `0.0 to 1.0` (Microphone RMS)
- `outputLevel`: `0.0 to 1.0` (Speaker RMS for capsule animation)
- `partialTranscript`: Live interim user text
- `finalTranscript`: Finalized user utterance
- `spokenChunk`: Current spoken sentence

---

## 21. Testing Strategy Without Microphone

Automated CI/CD requires **zero physical audio devices**:
- `MockAudioInputProvider`: Streams pre-recorded synthetic PCM buffers from disk fixtures.
- `MockSTTProvider`: Emits deterministic partial and final transcripts matched to frame timestamps.
- `MockTTSProvider`: Synthesizes deterministic synthetic audio buffers with duration markers.
- `MockAudioOutput`: Simulates playback clocks and records stop timestamps for barge-in validation.

---

## 22. Phase Breakdown

### M3.0 — Voice Architecture & Milestone 3 Specification *(Current)*
- **Objective:** Establish the comprehensive voice architecture and implementation specification.
- **Scope:** `MAVE_VOICE_ARCHITECTURE.md`, `MAVE_MILESTONE_3_SPEC.md`.
- **Non-Goals:** Code implementation.

### M3.1 — Voice Contracts & Audio Format Baseline
- **Objective:** Add vendor-neutral voice contracts in `@mave/contracts`.
- **Scope:** `AudioFrame`, `AudioInputProvider`, `STTProvider`, `TTSProvider`, `AudioOutput`, `TranscriptEvent`.
- **Tests:** Contract schema validations and audio format unit tests.

### M3.2 — Deterministic Mock Voice Providers
- **Objective:** Build mock audio input, mock STT, mock TTS, and mock output providers.
- **Scope:** `@mave/providers/src/voice/mock-*.ts`.
- **Tests:** Deterministic frame emission, transcript sequencing, synthetic audio playback.

### M3.3 — Streaming Text Chunker & Progressive Speech
- **Objective:** Implement punctuation-aware sentence chunker for streaming token feeds.
- **Scope:** `StreamingTextChunker` in `@mave/core`.
- **Tests:** Unit tests on English, Thai, code, and mixed conversational token streams.

### M3.4 — VoiceSessionCoordinator Core Runtime
- **Objective:** Central coordinator in Electron Main orchestrating audio, STT, Brain, and TTS.
- **Scope:** `VoiceSessionCoordinator` in `@mave/core` / Main.
- **Tests:** End-to-end mock voice turn (Audio In $\to$ Mock STT $\to$ Runtime $\to$ Mock TTS $\to$ Playback).

### M3.5 — Wake $\longleftrightarrow$ Voice Handoff Integration
- **Objective:** Seamless microphone transfer from Python wake engine to `AudioInputProvider`.
- **Scope:** Update `wake-manager.ts` and `VoiceSessionCoordinator` lifecycle handoffs.
- **Tests:** Device release verification, rearm guard tests, zero ghost-wake regression.

### M3.6 — Barge-In & Interruption Pipeline
- **Objective:** Low-latency playback cutoff on user speech onset during assistant speaking.
- **Scope:** Speech onset detector, hard cutoff in `AudioOutput`, cancellation dispatch.
- **Tests:** Simulated barge-in halts playback in $< 100\text{ms}$; preserves turn text in database.

### M3.7 — First Real STT Provider
- **Objective:** Integrate first production speech-to-text adapter.
- **Scope:** Real STT adapter in `@mave/providers`.
- **Tests:** Integration tests using audio fixtures and live microphone validation.

### M3.8 — First Real TTS Provider
- **Objective:** Integrate first production speech synthesis adapter.
- **Scope:** Real TTS adapter in `@mave/providers`.
- **Tests:** Audio buffer synthesis, Thai/English pronunciation, playback integration.

### M3.9 — Voice IPC Streaming & Developer Diagnostics UI
- **Objective:** Expose voice state and audio amplitude levels to Electron Renderer.
- **Scope:** Preload contracts, IPC handlers, Developer Voice UI panel.
- **Tests:** IPC roundtrip tests and React render tests.

### M3.10 — End-to-End Voice Loop Closeout
- **Objective:** Full verification, latency budget audit, and M3 closeout documentation.
- **Scope:** End-to-end manual and automated acceptance tests, `MAVE_MILESTONE_3_CLOSEOUT.md`.
- **Tests:** Monorepo test suite, E2E tests, Python wake tests, manual voice check.

---

## 23. M3 Acceptance Criteria

| # | Criterion | Verification Method |
|---|---|---|
| 1 | Wake detection initiates voice session | Automated test with `MockWakeWordProvider` |
| 2 | Captured speech produces final transcript | Automated test with `MockSTTProvider` |
| 3 | Final transcript enters `ConversationRuntime` | Session turn verified in SQLite |
| 4 | LLM response streams progressively | Token events validated via mock stream |
| 5 | TTS begins before generation completes | Timestamp verification in progressive chunker |
| 6 | Synthesized audio plays through `AudioOutput` | Playback completion event verified |
| 7 | User interruption stops speech playback $< 100\text{ms}$ | Playback cancellation timestamp verified |
| 8 | New speech accepted immediately after interruption | Follow-up turn successfully initiated |
| 9 | Voice session cleanup is 100% reliable | No dangling timers, streams, or processes |
| 10 | Wake engine rearms cleanly without ghost wake | 20/20 return-to-sleep verification |
| 11 | Zero raw microphone audio retained by default | Verification of ephemeral memory buffers |
| 12 | Tests execute offline without physical microphone | 100% CI pass using mock providers |
| 13 | Thai and English conversational support | Verbatim multi-language transcript testing |
| 14 | Fast Brain can be swapped without voice core changes | Verified through `BrainProfilePolicy` |

---

## 24. Security & Privacy Gate

- **Microphone Access:** Audio capture only occurs while state is `listening` or `speaking` (barge-in monitoring).
- **RAM-Only Audio:** No audio WAV files written to disk during standard conversations.
- **Preload Isolation:** Raw PCM audio buffers are not exposed to the Electron Renderer. Only normalized level telemetry (`0.0 to 1.0`) crosses IPC.

---

## 25. Regression Gate

- **M1 / M1.2 Wake Stability:** All 49 Python pytest wake tests must continue to pass without modification.
- **M2 Conversation Runtime:** All 150 core tests, 68 desktop tests, and 2 Playwright E2E tests must continue to pass.
- **XState Machine Topology:** Core state machine transitions remain backward-compatible.

---

## 26. Architecture Freeze / No-Refactor List

The following systems must **NOT** be rewritten during Milestone 3:
1. `services/wake/` (Python openWakeWord engine)
2. `packages/core/src/state-machine/machine.ts` (Assistant macro-state topology)
3. `packages/core/src/conversation/runtime.ts` (`ConversationRuntime`)
4. `packages/core/src/brain/router.ts` (`BrainRouter`)
5. `packages/core/src/brain/profile-policy.ts` (`BrainProfilePolicy`)
6. `packages/database/src/sqlite-conversation-store.ts` (`SQLiteConversationStore`)

---

## 27. Definition of Done

Milestone 3 is complete when:
1. A user can say *"Hey MAVE"*, speak a query aloud, hear MAVE synthesize and speak the answer, and interrupt MAVE while speaking.
2. The entire loop executes with both deterministic mock providers (offline CI) and real STT/TTS adapters.
3. Microphone ownership transfers between wake and voice with zero device lockups or ghost wakes.
4. All 14 M3 acceptance criteria pass.
5. All M1 wake tests and M2 conversation tests remain green.

---

## 28. Final M3 Target Experience

```text
User: "Hey MAVE"
MAVE: (Soft chime, enters listening state)

User: "วันนี้เหนื่อยมาก ภาษาอังกฤษพูดยังไง"
MAVE: (Transcribes, thinks, begins speaking)
      "You can say, 'I'm really tired today.'"

User interrupts: "Wait, say it more naturally."
MAVE: (Instantly cuts off speech < 100ms, transitions to listening)
      (Thinks, responds)
      "A more natural way would be, 'I'm totally exhausted today' or 'I'm wiped out.'"
```
