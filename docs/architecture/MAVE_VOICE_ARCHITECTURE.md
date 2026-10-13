# MAVE Voice Architecture

## 1. Vision

Milestone 3 (M3) establishes the spoken conversational runtime for **MAVE** (Modular Ambient Virtual Entity). The long-term vision of MAVE is to deliver a seamless, JARVIS-like ambient presence: always available, naturally conversational, highly responsive, capable of complex execution, and deeply respectful of user privacy.

In Milestone 2, MAVE validated text-first conversation:
$$\text{User Text} \longrightarrow \text{Conversation Runtime} \longrightarrow \text{Brain Router} \longrightarrow \text{AI Provider} \longrightarrow \text{Streaming Text}$$

Milestone 3 evolves this capability into an end-to-end spoken voice loop:
$$\text{Wake Phrase} \longrightarrow \text{Listen} \longrightarrow \text{Speech-to-Text} \longrightarrow \text{Conversation Runtime} \longrightarrow \text{Streaming Brain} \longrightarrow \text{Text-to-Speech} \longrightarrow \text{Spoken Audio}$$

### Core Architectural Principles for Voice
1. **Voice-First & Interruptible:** Spoken interaction must feel natural. When the user speaks while MAVE is responding, MAVE must halt speech immediately (barge-in) and pivot to listening without crashing or corrupting dialogue history.
2. **Strict Layer Separation:**
   $$\text{Wake Detection} \neq \text{Speech-to-Text (STT)} \neq \text{Brain Reasoning} \neq \text{Text-to-Speech (TTS)} \neq \text{Surface UI}$$
   - **Wake Detection:** Low-power, continuous listening for trigger phrases while idle (`sleeping`).
   - **STT:** High-accuracy phonetic transcription of conversational audio into structured text.
   - **Brain Reasoning:** Intent resolution, contextual knowledge retrieval, and token generation (`@mave/core`).
   - **TTS:** Low-latency synthesis of textual sentences into spoken waveforms.
   - **Surface UI:** Visual representation (floating capsule, waveforms, cards) defined in Milestone 4.
3. **Provider-Independent:** Voice contracts must not be coupled to any single cloud vendor (e.g., Google, ElevenLabs, OpenAI) or local engine (e.g., Whisper, Piper, Kokoro).
4. **Privacy-by-Default:** Raw microphone audio is strictly ephemeral and processed in memory. No ambient audio is permanently recorded or uploaded without explicit user intent.

---

## 2. End-to-End Voice Pipeline

The MAVE voice loop coordinates audio hardware, neural decoders, runtime state machines, and generative AI models.

### Normal Turn Flow
```text
[User Speaks: "Hey MAVE"]
        │
        ▼
┌──────────────────────────────┐
│ Wake Detection (openWakeWord)│  (Macro-state: sleeping)
└──────────────┬───────────────┘
        │ Wake Detected! Stop wake capture & rearm guard
        ▼
┌──────────────────────────────┐
│ VoiceSessionCoordinator      │  (Macro-state: waking -> listening)
└──────────────┬───────────────┘
        │ Start microphone capture
        ▼
┌──────────────────────────────┐
│ AudioInputProvider           │  (Emits 16kHz PCM chunks)
└──────────────┬───────────────┘
        │ Stream PCM frames
        ▼
┌──────────────────────────────┐
│ VAD / Speech Boundary Detector│  (Tracks voice onset & silence pause)
└──────────────┬───────────────┘
        │ Stream active speech audio
        ▼
┌──────────────────────────────┐
│ STTProvider                  │  (Emits partial transcripts)
└──────────────┬───────────────┘
        │ User finishes speaking (Silence / End-of-Utterance)
        ▼
┌──────────────────────────────┐
│ Final Transcript             │  (Macro-state: thinking)
└──────────────┬───────────────┘
        │ Submit to M2 ConversationRuntime
        ▼
┌──────────────────────────────┐
│ ConversationRuntime + Router │  (Selects Brain Profile: fast_conversation)
└──────────────┬───────────────┘
        │ Streams response text tokens
        ▼
┌──────────────────────────────┐
│ Streaming Text Chunker       │  (Safe syntactic sentence/clause boundaries)
└──────────────┬───────────────┘
        │ Synthesizes sentence 1 before LLM finishes sentence 3
        ▼
┌──────────────────────────────┐
│ TTSProvider                  │  (Macro-state: speaking)
└──────────────┬───────────────┘
        │ PCM / Audio buffers
        ▼
┌──────────────────────────────┐
│ AudioOutput (Playback)       │  (Emits output amplitude for M4 capsule)
└──────────────┬───────────────┘
        │ Playback completed
        ▼
┌──────────────────────────────┐
│ Conversational Follow-Up     │  (Remain listening for 5-8s or sleep)
└──────────────────────────────┘
```

### Interruption / Barge-In Flow
```text
[MAVE is speaking sentence 2]
        │
[User begins speaking: "Wait, cancel that..."]
        │
        ▼
┌──────────────────────────────┐
│ AudioInputProvider + VAD     │  (Acoustic echo filtered speech onset detected)
└──────────────┬───────────────┘
        │ USER_SPEECH_STARTED dispatched
        ▼
┌──────────────────────────────┐
│ VoiceSessionCoordinator      │
├──────────────────────────────┤
│ 1. AudioOutput.stop()        │  (Halt speaker playback immediately < 100ms)
│ 2. TTSProvider.cancel()      │  (Cancel pending synthesis)
│ 3. Runtime.cancel() if active│  (Halt LLM generation if still streaming)
│ 4. Transition to listening   │  (Macro-state: speaking -> listening)
└──────────────┬───────────────┘
        │ Route new speech into STTProvider
        ▼
┌──────────────────────────────┐
│ STTProvider                  │  (Transcribes fresh utterance cleanly)
└──────────────────────────────┘
```

---

## 3. Voice Component Boundaries

| Component | Responsibility | Boundary / Package |
|---|---|---|
| **`AudioInputProvider`** | Enumerate microphones, capture raw PCM audio frames, expose hardware sample rates, stop/start capture. | `@mave/contracts`, implemented in `@mave/providers` |
| **`STTProvider`** | Accept PCM frames, produce partial and final text transcripts, report confidence and language hints. | `@mave/contracts`, implemented in `@mave/providers` |
| **`TTSProvider`** | Synthesize text phrases into spoken audio streams/buffers, support immediate cancellation and voice selection. | `@mave/contracts`, implemented in `@mave/providers` |
| **`AudioOutput`** | Stream audio buffers to hardware output device, manage volume, emit real-time amplitude/level events, handle hard stop. | `@mave/contracts`, implemented in `@mave/providers` |
| **`VoiceSessionCoordinator`**| Coordinate voice turns, manage wake-to-listen handoff, route final transcripts into `ConversationRuntime`, pipeline streaming TTS, handle barge-in. | `@mave/core` / Electron Main |
| **`VoiceActivityDetector`**| Analyze incoming PCM frames for speech energy/phonetic onset and end-of-utterance silence boundaries. | Part of Audio/STT pipeline |
| **`VoiceSession`** | Holds active multi-turn voice context, turn counters, audio state, and active request references. | `@mave/core` |
| **`VoiceEvent` / `TranscriptEvent`** | Canonical typed contracts emitted across IPC for UI feedback and diagnostics. | `@mave/contracts` |

---

## 4. AudioInputProvider

### Responsibilities
- Query available audio input hardware devices without vendor lock-in.
- Capture real-time audio streams from the selected microphone.
- Deliver discrete, sequenced audio frames (`AudioFrame`) via an async iterable or event stream.
- Provide clean start, pause, stop, and disposal lifecycles.
- Handle hardware unplug or device disconnection gracefully.

### Audio Ownership Architecture
> **Architectural Decision:** Wake listening and active STT capture maintain **separate capture lifecycles**. The Python wake service does NOT permanently own microphone capture.

#### Why Wake Must Not Own Continuous Audio:
1. **Single Point of Failure:** If the Python wake process crashes or hangs, voice interaction would be completely disabled.
2. **Unnecessary IPC Serialization:** Streaming continuous 16kHz uncompressed PCM from Python to Node via standard I/O pipes adds unnecessary latency and CPU overhead.
3. **Provider Flexibility:** Node-based cloud STT providers (e.g. streaming WebSockets) or native Web Audio modules in Electron Main require direct, low-latency audio feeds.
4. **Lifecycle Independence:** Wake detection operates under low-power idle constraints, whereas conversational audio requires dynamic gain, voice activity detection, and acoustic echo cancellation.

---

## 5. Audio Format Contract

MAVE establishes a single, vendor-neutral **Canonical Internal Audio Format**:

| Parameter | Canonical Value | Rationale |
|---|---|---|
| **Encoding** | **Linear PCM** | Raw uncompressed samples; universal compatibility across neural models. |
| **Data Type** | **16-bit Signed Integer (`int16`, Little-Endian)** | Standard audio depth for openWakeWord, Whisper, and speech engines. |
| **Sample Rate** | **16,000 Hz (16 kHz)** | Optimal for speech recognition; balances acoustic bandwidth with memory footprint ($32\text{ KB/s}$). |
| **Channels** | **1 (Mono)** | Speech processing models operate on single-channel audio. |
| **Standard Frame Size** | **1280 samples ($80\text{ ms}$, $2560\text{ bytes}$)** | Aligns with openWakeWord chunking and low-latency VAD frame steps. |

### Contract Representation
```ts
export interface AudioFrame {
  data: Int16Array;
  sampleRate: 16000;
  channels: 1;
  timestamp: number;
  sequenceNumber: number;
}
```

---

## 6. STTProvider

The `STTProvider` interface is vendor-neutral, allowing MAVE to run local models (e.g., `faster-whisper`, `sherpa-onnx`) or cloud services (e.g., Google Cloud Speech-to-Text, OpenAI Realtime/Whisper) interchangeably:

```ts
export interface STTCapabilities {
  streaming: boolean;
  partialTranscripts: boolean;
  wordTimestamps: boolean;
  supportedLanguages: string[]; // e.g., ['th', 'en']
  offline: boolean;
}

export interface STTProvider {
  readonly id: string;
  getCapabilities(): STTCapabilities;
  health(): Promise<ProviderHealth>;
  transcribeStream(
    audioStream: AsyncIterable<AudioFrame>,
    options?: STTOptions
  ): AsyncIterable<TranscriptEvent>;
  cancel?(sessionId: string): Promise<void>;
}
```

---

## 7. Transcript Events

To prevent unstable intermediate text from corrupting persistent conversation state, MAVE strictly differentiates **partial** from **final** transcripts:

```ts
export type TranscriptEvent =
  | { type: 'speech_started'; timestamp: number }
  | { type: 'partial_transcript'; text: string; confidence?: number; timestamp: number }
  | { type: 'final_transcript'; text: string; confidence: number; language?: string; timestamp: number }
  | { type: 'speech_ended'; timestamp: number }
  | { type: 'cancelled'; reason: string; timestamp: number }
  | { type: 'error'; error: string; timestamp: number };
```

- **Partial Transcripts (`isFinal: false`):** Emitted at 100–250ms intervals. Consumed exclusively by UI surfaces (M4 Floating Capsule/Panel) for real-time visual feedback. Never submitted to `ConversationRuntime`.
- **Final Transcripts (`isFinal: true`):** Emitted upon verified speech boundary. Submitted to `ConversationRuntime.execute()` and committed to SQLite turn history.

---

## 8. Voice Activity / End-of-Utterance (EOU)

Determining when a user has finished speaking without forcing them to press a button is critical to a natural conversational feel:

1. **Lightweight Energy + Neural VAD:** Evaluates RMS energy and phonetic probability on each $80\text{ms}$ audio frame.
2. **Silence Threshold:**
   - Default conversational silence window: $600\text{--}900\text{ ms}$.
   - Short silence ($< 400\text{ ms}$) allows for natural inter-word pauses without cutting the user off.
3. **Safety Caps:**
   - **Minimum Speech Duration:** $300\text{ ms}$ (rejects background clicks, coughs, and microphone bumps).
   - **Maximum Utterance Duration:** $20\text{ seconds}$ (prevents runaway audio buffering if continuous ambient noise prevents silence detection).

---

## 9. TTSProvider

The `TTSProvider` contract abstracts speech synthesis engines:

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
  language?: string; // 'th' | 'en'
  rate?: number;     // 0.8 to 1.5
}

export interface TTSProvider {
  readonly id: string;
  getCapabilities(): TTSCapabilities;
  health(): Promise<ProviderHealth>;
  synthesize(request: SpeechRequest): AsyncIterable<AudioFrame>;
  cancel?(requestId: string): Promise<void>;
}
```

---

## 10. Streaming TTS (Progressive Synthesis)

Waiting for an LLM to generate an entire multi-sentence answer before beginning speech synthesis introduces unacceptable latency ($3\text{--}8\text{ seconds}$).

### Pipelined Progressive Chunking Architecture
1. **Token Buffering:** `StreamingTextChunker` receives raw token deltas from `ConversationRuntime`.
2. **Syntactic Boundary Detection:** Splits tokens into speakable phrases at punctuation markers:
   - Full stops (`.`, `!`, `?`, `\n`)
   - Natural clause pauses (`;`, `,`, `:` with a minimum 6-word threshold)
3. **Pipelined Execution:**
   ```text
   LLM generates Sentence 1 ──► TTS synthesizes Sentence 1 ──► Audio plays Sentence 1
   LLM generates Sentence 2 ──► TTS synthesizes Sentence 2 ──► Queued in AudioOutput
   LLM generates Sentence 3 ──► TTS synthesizes Sentence 3 ──► Queued in AudioOutput
   ```
4. **Prosody Preservation:** Chunker avoids breaking mid-word or across numbers, ensuring natural spoken inflection.

---

## 11. VoiceSessionCoordinator

The `VoiceSessionCoordinator` in Electron Main is the central conductor of the M3 voice subsystem.

### Explicit Responsibilities
- Coordinates the wake-to-voice handoff upon `WAKE_DETECTED`.
- Starts and stops `AudioInputProvider`.
- Feeds audio into `STTProvider` and monitors `TranscriptEvent` streams.
- Upon receiving a final transcript, dispatches it to `ConversationRuntime.execute()` using the `fast_conversation` profile.
- Consumes the resulting token stream, pipes it through `StreamingTextChunker`, and feeds chunks into `TTSProvider`.
- Sends synthesized audio frames to `AudioOutput`.
- Listens for barge-in signals, propagating immediate cancellation across TTS, audio playback, and LLM generation.
- Implements conversational follow-up timeouts ($5\text{--}8\text{s}$ window) before returning to `sleeping`.

### Explicit Non-Responsibilities
- Does NOT implement vendor-specific STT or TTS algorithms.
- Does NOT implement Brain routing logic (delegated to `BrainRouter`).
- Does NOT render UI elements (delegated to Renderer / M4 Surface).
- Does NOT manage long-term semantic memory (delegated to M6).

---

## 12. Voice State Lifecycle

MAVE coordinates voice using a two-tier state model:

### Macro-Lifecycle (Root XState Machine)
The stable XState assistant machine (`packages/core/src/state-machine/machine.ts`) controls macro states:
$$\text{sleeping} \longrightarrow \text{waking} \longrightarrow \text{listening} \longrightarrow \text{thinking} \longrightarrow \text{speaking} \longrightarrow \text{listening} / \text{sleeping}$$

### Micro-Lifecycle (VoiceSessionCoordinator Internal States)
High-frequency audio streaming transitions are managed inside `VoiceSessionCoordinator` to avoid polluting global state context:
- `AUDIO_CAPTURING`
- `VAD_SPEECH_ACTIVE`
- `STT_STREAMING`
- `LLM_STREAMING`
- `TTS_SYNTHESIZING`
- `PLAYBACK_ACTIVE`
- `BARGE_IN_TRIGGERED`

---

## 13. Wake $\longrightarrow$ Voice Handoff

To prevent microphone conflicts, duplicate capture, and audio buffer bleeding:

```text
1. Assistant in 'sleeping':
   - OpenWakeWordProvider owns microphone via sounddevice
   - Buffer size: 1280 samples, continuous ONNX inference

2. Wake phrase detected:
   - Python emits {"type": "wake", "score": 0.85}
   - wake-manager.ts sends WAKE_DETECTED to XState machine
   - State transitions to 'waking'

3. Wake Engine Release:
   - wake-manager.ts immediately calls OpenWakeWordProvider.stop()
   - Python sounddevice stream is closed, audio queue drained
   - Microphone device is 100% freed at OS level

4. Voice Engine Takeover:
   - VoiceSessionCoordinator calls AudioInputProvider.startCapture()
   - New audio stream opens with fresh, zeroed buffers
   - No audio overlap or buffer bleeding occurs

5. Return to Sleeping:
   - Voice session closes (timeout or sleep request)
   - AudioInputProvider.stopCapture() releases microphone
   - wake-manager.ts observes transition to 'sleeping'
   - rearmGuardMs (300ms) prevents ghost wakes from residual room acoustics
   - OpenWakeWordProvider.start() resumes wake listening
```

---

## 14. MAVE Hearing Itself (Self-Hearing Prevention)

When MAVE's speakers play synthesized voice responses, acoustic feedback into the microphone can trigger false wakes or echo loops.

### Three-Layer Prevention Strategy
1. **State Isolation:** The wake engine is strictly inactive during `waking`, `listening`, `thinking`, and `speaking`. MAVE cannot trigger its own wake phrase while awake.
2. **Acoustic Echo Cancellation (AEC):** Audio capture configuration requests OS-level hardware/system AEC (`echoCancellation: true` on supported platforms).
3. **Adaptive VAD Thresholding:** While `AudioOutput` is actively playing, the barge-in detector applies an elevated energy threshold and spectral subtraction based on the known outgoing TTS waveform, preventing normal speaker output from tripping barge-in.

---

## 15. Barge-In / Interruption

Barge-in allows users to cut off long assistant answers naturally:

1. **Detection:** While MAVE is in `speaking` state, `AudioInputProvider` remains active. When speech onset exceeds the echo-cancelled threshold:
2. **Instant Audio Cutoff:** `AudioOutput.stop()` terminates speaker playback within $< 100\text{ ms}$.
3. **Synthesis & LLM Cancellation:** `TTSProvider.cancel()` flushes pending sentence queues. If the Brain is still generating text, `ConversationRuntime.cancel(requestId)` is invoked.
4. **Turn State Preservation:**
   - The user turn and assistant response generated up to that moment remain saved in `ConversationStore`.
   - The assistant turn is flagged with `playbackStatus: 'interrupted'`.
   - The assistant's reasoning is **not deleted**, ensuring context coherence for the user's follow-up remark.
5. **Seamless Pivot:** State transitions directly to `listening`, and the newly captured audio frames are immediately streamed to `STTProvider`.

---

## 16. Cancellation Architecture

M3 voice cancellation reuses M2's hardened cancellation patterns:
- **Single Terminal Event Rule:** The first terminal transition (`completed`, `cancelled`, or `error`) permanently locks the turn state.
- **Propagation Chain:**
  $$\text{User Barge-In} \longrightarrow \text{Coordinator.cancelCurrentTurn()} \longrightarrow \begin{cases} \text{AudioOutput.stop()} \\ \text{TTSProvider.cancel()} \\ \text{ConversationRuntime.cancel()} \end{cases}$$
- **Zero Race Conditions:** Preload and IPC bridges reject out-of-order events using request ID correlation.

---

## 17. Fast Brain Integration

### Addressing the Latency Gap
In Milestone 2, live validation of `AntigravityBrainProvider` demonstrated robust reasoning but revealed:
- $\text{Time-to-First-Token (TTFT)} \approx 9\text{--}10\text{ seconds}$
- Total request latency $\approx 10.2\text{ seconds}$

An 8–10 second silence is unacceptable in spoken dialogue.

### M3 Strategy
- M3 decouples the voice pipeline from any specific provider.
- `MockBrainProvider` ($15\text{ms}$ chunk delay) is used for rapid, deterministic voice loop engineering and CI testing.
- `AntigravityBrainProvider` is preserved for complex conversational verification and agent tasks (`agent_work`).
- A dedicated **Fast Brain evaluation track** runs in parallel with M3 to identify a real AI provider with TTFT $\le 1\text{--}3\text{ seconds}$ for voice deployment.

---

## 18. Latency Budget

To achieve conversational fluidness, MAVE targets the following budget:

| Segment | Target Latency | Optimization Strategy |
|---|---|---|
| **Wake Detection Response** | $< 300\text{ ms}$ | Audio chime / visual pulse immediately on wake detection. |
| **End-of-Utterance (EOU) Detection** | $400\text{--}700\text{ ms}$ | Fast VAD silence cutoff. |
| **STT Finalization** | $200\text{--}600\text{ ms}$ | Streaming partial transcripts minimize final decoding time. |
| **Brain Time-to-First-Token (TTFT)** | $1000\text{--}2500\text{ ms}$ | Fast Brain profile with minimal input prompt overhead. |
| **TTS Time-to-First-Audio (TTFA)** | $200\text{--}500\text{ ms}$ | First sentence synthesized as soon as punctuation is reached. |
| **Total Perceived Turn Latency** | $\mathbf{2.0\text{--}4.0\text{ s}}$ | Progressive pipelining overlaps synthesis with generation. |

---

## 19. Language Architecture

MAVE is designed for fluent **Thai**, **English**, and **Code-Switching (Tenglish)**:
- **STT Models:** Must support multilingual acoustic decoding without requiring manual language toggling.
- **Language Hints:** Sessions can provide contextual hints (e.g., `hints: ['th', 'en']`) to bias acoustic search paths.
- **Transcript Integrity:** Transcripts preserve the exact spoken script (Thai script for Thai phrases, Latin script for English phrases) to facilitate language learning.

---

## 20. Language Learning Mode (M7 Preparation)

While the full Learning Engine belongs to Milestone 7, M3 captures the necessary voice metadata:
- Exact verbatim transcripts.
- Word-level confidence and timing markers (where available).
- Voice turn duration and pause cadence.
This metadata is saved to SQLite turns, enabling M7 to extract vocabulary, identify grammar patterns, and generate learning recaps later.

---

## 21. Audio Privacy

MAVE enforces uncompromising desktop privacy standards:
1. **Zero Ambient Storage:** Microphone audio is never written to disk during normal operation.
2. **Ephemeral Memory:** PCM buffers are stored in memory only for the duration of the active turn and immediately cleared.
3. **Explicit Diagnostics:** Audio recordings for model benchmarking or debugging require explicit user opt-in.
4. **Local-First Ready:** Cloud STT/TTS providers are strictly optional and clearly labeled in settings.

---

## 22. Audio Retention Policy

| Artifact | Persistence Policy | Storage Location |
|---|---|---|
| **Raw Microphone Audio** | **EPHEMERAL** (Memory only; dropped after turn) | RAM |
| **Partial Transcripts** | **EPHEMERAL** (Memory only; dropped after turn) | RAM |
| **Final Transcripts** | **PERSISTED** (Stored in database turn history) | `conversations.db` |
| **Synthesized Audio** | **EPHEMERAL** (Memory only; dropped after playback) | RAM |
| **Diagnostic Audio** | **OPT-IN ONLY** (Explicit user action) | `data/diagnostics/` |

---

## 23. Error Recovery

The voice runtime handles failures gracefully without crashing:
- **Microphone Disconnected:** Emits `DEVICE_ERROR`, aborts voice session, and notifies UI.
- **STT Failure / Network Drop:** Reverts to text fallback message; prompts user to repeat.
- **Silence Timeout:** If user wakes MAVE but says nothing for $6\text{ seconds}$, MAVE chirps softly and returns to `sleeping`.
- **TTS Failure:** Displays written answer on screen; logs non-fatal audio error.
- **Brain Timeout:** Respects M2 $30\text{s}$ timeout; speaks polite failure notification.

---

## 24. Device Management

- Supports selection of dedicated input (microphone) and output (speaker/headphones) devices.
- Uses OS device index and persistent hardware UUIDs.
- Gracefully falls back to system defaults if a chosen peripheral is disconnected.

---

## 25. Audio Output (Playback Boundary)

Synthesis (`TTSProvider`) is decoupled from hardware playback (`AudioOutput`):
- `TTSProvider` produces audio frames.
- `AudioOutput` manages hardware PCM streaming, master volume, mute state, pause/resume, and instant buffer flushes on barge-in.
- Emits real-time output level events (`0.0 to 1.0`) at $50\text{Hz}$ for UI waveform synchronization.

---

## 26. M4 Surface Signals

M3 exposes clean typed events over Electron IPC for the future M4 Ambient Adaptive Surface:
- `voice:state` (`idle`, `waking`, `listening`, `thinking`, `speaking`, `interrupted`)
- `voice:input-level` (Microphone RMS amplitude: `0.0 to 1.0`)
- `voice:output-level` (Speaker playback amplitude: `0.0 to 1.0`)
- `voice:transcript:partial` (Live streaming user words)
- `voice:transcript:final` (Finalized user text)

---

## 27. Audio-Reactive Speaking Signal

To drive the fluid animation of the MAVE capsule and Orb in Milestone 4:
- The playback stream calculates RMS amplitude:
  $$\text{RMS} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} x_i^2}$$
- Normalized to $[0.0, 1.0]$ with an exponential smoothing decay.
- Emitted at $60\text{ fps}$ via IPC without passing raw audio buffers to the Renderer.

---

## 28. Desktop Process Boundaries

```text
┌────────────────────────────────────────────────────────┐
│ Electron Renderer                                      │
│ - Developer Chat / Future M4 Surface                   │
│ - Renders UI and animations based on IPC events        │
└───────────────────────────▲────────────────────────────┘
                            │ Typed IPC (contextBridge)
┌───────────────────────────▼────────────────────────────┐
│ Electron Main                                          │
│ - VoiceSessionCoordinator (Central orchestration)      │
│ - AudioInputProvider & AudioOutput                     │
│ - ConversationRuntime & SQLite persistence             │
│ - STT & TTS Adapter orchestration                      │
└───────────────────────────▲────────────────────────────┘
                            │ Supervised Subprocesses
┌───────────────────────────▼────────────────────────────┐
│ Dedicated Worker Services (Python / Native)            │
│ - Wake Engine (services/wake, openWakeWord)            │
│ - Local STT / TTS engines (if using local models)      │
└────────────────────────────────────────────────────────┘
```

---

## 29. Provider Process Strategy

For local neural models requiring Python or heavy native runtimes:
- **Persistent Service:** Maintain a supervised, warm background process (identical to the wake service architecture).
- **Reject Per-Session Spawning:** Spawning Python or loading neural weights per voice request incurs a $2\text{--}5\text{s}$ penalty and is prohibited.

---

## 30. Resource Constraints

The voice architecture accommodates consumer desktop configurations:
- **Local Fallback:** CPU-optimized quantized models (e.g., `faster-whisper` INT8, Piper TTS) for low-spec hardware.
- **Cloud Mode:** Zero-VRAM cloud STT/TTS for ultra-low local CPU usage.
- **GPU Acceleration:** CUDA/DirectML utilization when dedicated VRAM is detected.

---

## 31. Testing Strategy

Following MAVE's rigorous phased testing pattern:
$$\text{Contracts} \longrightarrow \text{Mock Providers} \longrightarrow \text{Coordinator Tests} \longrightarrow \text{Integration} \longrightarrow \text{Real Provider}$$
Automated CI tests must **never** require a physical microphone or live cloud connection.

---

## 32. Deterministic Voice Tests

All voice pipelines are testable via synthetic test fixtures:
- `MockAudioInputProvider`: Streams synthetic PCM frames from fixture WAV files on disk.
- `MockSTTProvider`: Emits pre-scripted partial and final transcripts tied to frame counts.
- `MockTTSProvider`: Generates synthetic PCM frames with deterministic duration markers.
- `MockAudioOutput`: Simulates playback clocks and records cancellation timestamps.

---

## 33. Manual Voice Verification

Manual end-to-end acceptance is validated in Phase M3.10:
1. Speak: *"Hey MAVE"* $\longrightarrow$ MAVE awakens and enters listening state.
2. Speak: *"How do I say วันนี้เหนื่อยมาก in English?"* $\longrightarrow$ MAVE transcribes, thinks, and begins speaking.
3. Interrupt: Speak *"Wait, stop"* while MAVE is speaking $\longrightarrow$ Audio halts instantly ($< 100\text{ms}$), MAVE enters listening state, and accepts the new prompt.

---

## 34. Relationship to Wake V2 Model Work

Milestone 1.3 personalized MAVE V2 model training proceeds completely independently. M3 connects to wake detection through the stable `WakeWordProvider` abstraction. Any improvements or retrained ONNX models in M1.3 plug in seamlessly without voice loop changes.

---

## 35. Relationship to Milestone 2

M3 does not rewrite M2. It builds directly on M2's frozen foundations:
- Reuses `ConversationRuntime.execute()` verbatim.
- Reuses `BrainProfilePolicy` and `BrainRouter`.
- Reuses `SessionManager` and `ContextManager`.
- Reuses `SQLiteConversationStore` for turn persistence.

---

## 36. Relationship to Milestone 4 (Ambient Surface)

M3 provides **audio signals and runtime state**. M4 provides **visual presentation**. M3 does not implement custom CSS, floating windows, or canvas visualizers.

---

## 37. Relationship to Milestone 5 (Agent Runtime)

When a voice command requests an agent action (e.g., *"MAVE, review my git status"*):
1. M3 transcribes the audio.
2. M2 resolves the `agent_work` profile.
3. M5 (future) handles tool execution and permissions.
M3 never executes tools directly.

---

## 38. Recommended M3 Internal Phases

| Phase | Title | Focus |
|---|---|---|
| **M3.0** | Voice Architecture & Specification | Formal architecture and implementation spec (Current Phase). |
| **M3.1** | Audio Contracts & Format Definitions | Vendor-neutral TypeScript contracts in `@mave/contracts`. |
| **M3.2** | Deterministic Audio Input & Mock Providers | `MockAudioInputProvider`, `MockSTTProvider`, `MockTTSProvider`, `MockAudioOutput`. |
| **M3.3** | Streaming Text Chunker & Progressive Speech | Phrase chunking algorithms and sentence boundary splitting. |
| **M3.4** | VoiceSessionCoordinator | Central voice orchestrator connecting audio, STT, runtime, and TTS. |
| **M3.5** | Wake $\longleftrightarrow$ Voice Handoff Integration | Clean microphone ownership transfer and rearm lifecycle. |
| **M3.6** | Barge-In & Cancellation Pipeline | Low-latency speech interruption and audio cutoff propagation. |
| **M3.7** | First Real STT Provider | First production speech recognition adapter. |
| **M3.8** | First Real TTS Provider | First production speech synthesis adapter. |
| **M3.9** | Voice IPC Streaming & Developer Diagnostics UI | Audio levels, live transcripts, and voice controls in Electron UI. |
| **M3.10** | End-to-End Voice Loop Closeout | Full integration verification, latency audit, and M3 closeout. |

---

## Provider Evaluation Criteria

### STT Provider Evaluation Matrix
- **Thai Accuracy:** High precision on colloquial Thai and tonal inflections.
- **English Accuracy:** Flawless international English vocabulary.
- **Code-Switching:** Seamless recognition of Thai mixed with English technical terms.
- **Streaming Latency:** Sub-second partial transcript delivery.
- **Resource Footprint:** Lightweight CPU/GPU memory consumption.
- **Privacy & Cost:** Predictable subscription pricing or air-gapped local execution.

### TTS Provider Evaluation Matrix
- **Bilingual Naturalness:** Fluent, natural prosody in both Thai and English.
- **Time-to-First-Audio (TTFA):** Under $400\text{ ms}$ for first synthesized sentence.
- **Interruption Responsiveness:** Clean cancellation without residual audio buffering.
- **Expressiveness:** Clear, engaging personal assistant tone without robotic artifacts.
- **Amplitude Telemetry:** Exposes output volume levels for M4 surface animation.
