# MAVE C3.1 / C4-B Live Certification Report Template

> [!IMPORTANT]
> **HOME-PC LIVE EXECUTION TEMPLATE**
> This document is the official certification report template for Milestone Pre-M5 Phases **C3.1 (Local Fast Brain Runtime)** and **C4-B (Voice / Language / Conversation Live Certification)**.
> All hardware-dependent fields are pre-populated with `NOT RUN — HOME PC REQUIRED`.
> **Never write `PASS` placeholders before physical execution on Home PC.**

---

## 1. Environment

| Attribute | Work PC Baseline (Harness Preparation) | Home PC Certified Value | Status |
|---|---|---|---|
| **OS** | Windows_NT 10.0.26200 (win32 x64) | `NOT RUN — HOME PC REQUIRED` | PENDING |
| **CPU** | 12th Gen Intel(R) Core(TM) i3-12100 (8 cores) | `NOT RUN — HOME PC REQUIRED` | PENDING |
| **System RAM** | 15.75 GiB Total | `NOT RUN — HOME PC REQUIRED` | PENDING |
| **GPU Model** | N/A (Integrated Intel UHD) | `NOT RUN — HOME PC REQUIRED` (Target: RTX 3060 Ti) | PENDING |
| **NVIDIA Driver** | N/A | `NOT RUN — HOME PC REQUIRED` | PENDING |
| **GPU Dedicated VRAM**| N/A | `NOT RUN — HOME PC REQUIRED` (Target: 8192 MiB) | PENDING |
| **Node.js** | v24.14.1 | `NOT RUN — HOME PC REQUIRED` (Target: Node >=20) | PENDING |
| **pnpm** | 12.11.2 | `NOT RUN — HOME PC REQUIRED` | PENDING |
| **Ollama Version** | N/A (Daemon Offline) | `NOT RUN — HOME PC REQUIRED` | PENDING |

---

## 2. Git HEAD

- **Harness Prepared Commit**: `946e03aefba747a50aba22bcc2742938f1302af0`
- **Home PC Execution Commit**: `NOT RUN — HOME PC REQUIRED`
- **Branch**: `feat/pre-m5-intelligence-providers`
- **Clean Worktree Verified**: `NOT RUN — HOME PC REQUIRED`

---

## 3. Benchmark Consistency (~189 tok/s vs ~16.9 tok/s Resolution)

> [!NOTE]
> Benchmark consistency: ~189–236 tok/s is canonical server-side generation throughput on RTX 3060 Ti measured via eval_count / (eval_duration / 1e9). Historical ~16.9 tok/s was client-side event loop throttling caused by synchronous nvidia-smi child-process execution on every chunk in the client streaming loop. All raw metrics are captured directly from Ollama.

| Metric | Raw Daemon Field | Home PC Raw Output | Calculated Value |
|---|---|---|---|
| **Model** | `model` | `NOT RUN — HOME PC REQUIRED` | `qwen2.5:1.5b` |
| **Total Duration** | `total_duration` | `NOT RUN — HOME PC REQUIRED` ns | `NOT RUN — HOME PC REQUIRED` s |
| **Load Duration** | `load_duration` | `NOT RUN — HOME PC REQUIRED` ns | `NOT RUN — HOME PC REQUIRED` s |
| **Prompt Eval Count** | `prompt_eval_count` | `NOT RUN — HOME PC REQUIRED` tokens | `NOT RUN — HOME PC REQUIRED` |
| **Prompt Eval Duration** | `prompt_eval_duration` | `NOT RUN — HOME PC REQUIRED` ns | `NOT RUN — HOME PC REQUIRED` s |
| **Eval Count (Gen)** | `eval_count` | `NOT RUN — HOME PC REQUIRED` tokens | `NOT RUN — HOME PC REQUIRED` |
| **Eval Duration (Gen)** | `eval_duration` | `NOT RUN — HOME PC REQUIRED` ns | `NOT RUN — HOME PC REQUIRED` s |
| **Generation Rate** | `eval_count / (eval_duration / 1e9)` | `NOT RUN — HOME PC REQUIRED` | `NOT RUN — HOME PC REQUIRED` tok/s |
| **Prompt Ingestion Rate**| `prompt_eval_count / (prompt_eval_duration / 1e9)` | `NOT RUN — HOME PC REQUIRED` | `NOT RUN — HOME PC REQUIRED` tok/s |
| **Turn Throughput** | `(prompt + gen) / (total_duration / 1e9)` | `NOT RUN — HOME PC REQUIRED` | `NOT RUN — HOME PC REQUIRED` tok/s |

---

## 4. Exact Model Digest Verification

- **Promoted Candidate**: `qwen2.5:1.5b`
- **Approved Digest Baseline**: `65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b`
- **Local Ollama Digest**: `NOT RUN — HOME PC REQUIRED`
- **Digest Check Outcome**: `NOT RUN — HOME PC REQUIRED` (Target: `MATCH`)

---

## 5. Ollama Health & Model Tags

- **Ollama HTTP Endpoint**: `http://127.0.0.1:11434`
- **Health Check (`GET /api/tags`)**: `NOT RUN — HOME PC REQUIRED`
- **7B Model Protection**: Confirm `qwen2.5:7b` is NOT selected for `fast_conversation`: `NOT RUN — HOME PC REQUIRED`

---

## 6. Residency State Transitions

| Phase | Observed Lifecycle State | `/api/ps` Loaded Models | VRAM Allocated | Status |
|---|---|---|---|---|
| **Before Prewarm** | `unloaded` | `NOT RUN — HOME PC REQUIRED` | `NOT RUN — HOME PC REQUIRED` | PENDING |
| **During Prewarm** | `loading` | `NOT RUN — HOME PC REQUIRED` | `NOT RUN — HOME PC REQUIRED` | PENDING |
| **After Prewarm** | `resident` | `NOT RUN — HOME PC REQUIRED` | `NOT RUN — HOME PC REQUIRED` | PENDING |
| **During Inference**| `resident` (lease active) | `NOT RUN — HOME PC REQUIRED` | `NOT RUN — HOME PC REQUIRED` | PENDING |
| **After Inference** | `resident` (lease released)| `NOT RUN — HOME PC REQUIRED` | `NOT RUN — HOME PC REQUIRED` | PENDING |
| **After 5m Idle** | `unloaded` | `NOT RUN — HOME PC REQUIRED` | `NOT RUN — HOME PC REQUIRED` | PENDING |

---

## 7. Prewarm Execution & Token Verification

- **Prewarm API Used**: `POST /api/generate` with empty prompt `""` and `keep_alive: "5m"`
- **User Content Transmitted**: `ZERO (CONFIRMED BY CODE)`
- **Route Telemetry Counted**: `ZERO (CONFIRMED BY CODE)`
- **Execution Lease Acquired**: `NO (CONFIRMED BY CODE)`
- **Ollama Response Prompt Tokens**: `NOT RUN — HOME PC REQUIRED` (inspect actual token counters live)

---

## 8. Routing Verification Across 5 Benchmark Cases

| Benchmark Case | Prompt | Expected Profile | Selected Provider | Selected Model | Route Reason | Status |
|---|---|---|---|---|---|---|
| **Thai Quick Chat** | "สวัสดีครับ ขอคำแนะนำสั้นๆ หน่อย" | `fast_conversation` | `NOT RUN` | `NOT RUN` | `NOT RUN` | PENDING |
| **English Quick Chat** | "Hello, what's a good way to organize files?" | `fast_conversation` | `NOT RUN` | `NOT RUN` | `NOT RUN` | PENDING |
| **flatMap Explanation**| "Explain what Array.prototype.flatMap does" | `fast_conversation` | `NOT RUN` | `NOT RUN` | `NOT RUN` | PENDING |
| **Language Practice** | "Let's practice ordering food in a restaurant" | `fast_conversation` | `NOT RUN` | `NOT RUN` | `NOT RUN` | PENDING |
| **Simple Rewrite** | "Rewrite this sentence to be more polite: Give me the report" | `fast_conversation` | `NOT RUN` | `NOT RUN` | `NOT RUN` | PENDING |

---

## 9. Multi-Turn Conversation Continuity

- **Session ID**: `NOT RUN — HOME PC REQUIRED`
- **Turn 1 Prompt**: *"My favorite programming language is TypeScript."*
  - **Turn 1 Response**: `NOT RUN — HOME PC REQUIRED`
- **Turn 2 Prompt**: *"Why do people like it?"*
  - **Turn 2 Response**: `NOT RUN — HOME PC REQUIRED`
- **Turn 3 Prompt**: *"What language did I say I liked?"*
  - **Turn 3 Response**: `NOT RUN — HOME PC REQUIRED`
- **Continuity Check**: Did Turn 3 mention TypeScript? `NOT RUN — HOME PC REQUIRED`

---

## 10. Language Experience Semantics

- **Target Language**: English (`en`)
- **Native Language**: Thai (`th`)
- **Structural Contracts**: `PASSED IN WORK-PC HARNESS TEST`
- **Anti-Hallucination Guard**: `PASSED IN WORK-PC HARNESS TEST (fake scoring blocked)`
- **Roleplay Step-Out**: `PASSED IN WORK-PC HARNESS TEST`
- **Roleplay Resume**: `PASSED IN WORK-PC HARNESS TEST`
- **Live Conversational Correction**: `NOT RUN — HOME PC REQUIRED`
- **Live Vocabulary Observation**: `NOT RUN — HOME PC REQUIRED`

---

## 11. Cancellation & Streaming F1.4 Invariant

- **Cancellation Point**: Mid-stream after delta 2
- **Stream Termination**: Immediate abort: `NOT RUN — HOME PC REQUIRED`
- **Hidden Retry Attempted**: Confirm `fallbackUsed === false`: `NOT RUN — HOME PC REQUIRED`
- **Route Attempts Increment**: Confirm `routeAttempts === 1`: `NOT RUN — HOME PC REQUIRED`

---

## 12. Voice Loop End-to-End Latency

| Boundary Step | Timestamp (ms) | Delta / Duration | Status |
|---|---|---|---|
| **Acoustic Wake Detected** | `NOT RUN` | Baseline (0ms) | PENDING |
| **Speech Ended (VAD)** | `NOT RUN` | `NOT RUN` | PENDING |
| **STT Transcript Ready** | `NOT RUN` | STT Latency: `NOT RUN — HOME PC REQUIRED` ms | PENDING |
| **BrainRouter Resolved** | `NOT RUN` | Router Latency: `NOT RUN — HOME PC REQUIRED` ms | PENDING |
| **First Token Emitted (TTFT)** | `NOT RUN` | Brain TTFT: `NOT RUN — HOME PC REQUIRED` ms | PENDING |
| **TTS First Audio Chunk (TTFA)**| `NOT RUN` | TTS TTFA: `NOT RUN — HOME PC REQUIRED` ms | PENDING |
| **Audio Playback Started** | `NOT RUN` | Time to Speech: `NOT RUN — HOME PC REQUIRED` ms | PENDING |
| **Turn Completed** | `NOT RUN` | Total Turn Duration: `NOT RUN — HOME PC REQUIRED` ms | PENDING |

---

## 13. Runtime $\longleftrightarrow$ UI Surface State Flow

- **Presence Mark State Flow**:
  $$\text{sleeping} \longrightarrow \text{waking} \longrightarrow \text{listening} \longrightarrow \text{thinking} \longrightarrow \text{speaking} \longrightarrow \text{listening}$$
- **Visual Color Synchronization**: `NOT RUN — HOME PC REQUIRED`
- **Quick Card Response Presentation**: `NOT RUN — HOME PC REQUIRED`
- **Expanded Context Presentation**: `NOT RUN — HOME PC REQUIRED`

---

## 14. NVIDIA VRAM Memory Table

| Phase | Description | Total VRAM (MiB) | Used VRAM (MiB) | Free VRAM (MiB) | Utilization (%) |
|---|---|---|---|---|---|
| **1. BASELINE** | System idle, MAVE desktop running, Ollama idle | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |
| **2. STT_LOADED** | faster-whisper CUDA model resident | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |
| **3. BRAIN_RESIDENT** | `qwen2.5:1.5b` prewarmed resident in VRAM | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |
| **4. STT_PLUS_BRAIN** | Both STT and Fast Brain co-resident | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |
| **5. ACTIVE_STT** | User speaking, microphone capture & VAD | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |
| **6. ACTIVE_INFERENCE**| Local Fast Brain token generation stream | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |
| **7. POST_IDLE_UNLOAD**| After 5 minutes idle timeout (eviction) | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |

- **Peak VRAM Cap Compliance**: Must remain $\le 8192\text{ MiB}$ without system paging: `NOT RUN — HOME PC REQUIRED`

---

## 15. Latency Calibration Table

| Sample # | Turn Prompt | Mode | STT (ms) | Brain TTFT (ms) | Brain Total (ms) | TTS TTFA (ms) | Turn Total (ms) |
|---|---|---|---|---|---|---|---|
| **1** | Thai greeting | COLD | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |
| **2** | Thai follow-up | WARM | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |
| **3** | English greeting | WARM | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |
| **4** | Code explanation | WARM | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |
| **5** | Language practice | WARM | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |

### Aggregated Latency Statistics
- **Brain TTFT (Warm)**: Min = `NOT RUN`, Median = `NOT RUN`, Max = `NOT RUN` (Canonical: ~1–3s)
- **STT Latency**: Min = `NOT RUN`, Median = `NOT RUN`, Max = `NOT RUN`
- **TTS TTFA**: Min = `NOT RUN`, Median = `NOT RUN`, Max = `NOT RUN`

---

## 16. Idle Unload Verification

- **Configured Idle Keep-Alive**: `5m` (300 seconds)
- **Start of Idle Period**: `NOT RUN — HOME PC REQUIRED`
- **End of Idle Period**: `NOT RUN — HOME PC REQUIRED`
- **Model Evicted from `/api/ps`**: `NOT RUN — HOME PC REQUIRED`
- **VRAM Restored to Baseline**: `NOT RUN — HOME PC REQUIRED`

---

## 17. Ollama Daemon Restart & Reconciliation

- **Pre-Restart State**: `DAEMON_HEALTHY`, model resident: `NOT RUN — HOME PC REQUIRED`
- **Daemon Stopped**: Detected offline: `NOT RUN — HOME PC REQUIRED`
- **Residency Manager Cache Cleared**: Stale lease rejected: `NOT RUN — HOME PC REQUIRED`
- **Daemon Restarted**: Reconnected within 30s: `NOT RUN — HOME PC REQUIRED`
- **Reconciliation Chat Request**: Executed successfully: `NOT RUN — HOME PC REQUIRED`

---

## 18. M1–M4 Regression Verification

- **M1.2 Wake Lifecycle**: Zero ghost wake, clean sleep return: `NOT RUN — HOME PC REQUIRED`
- **M2 Conversation**: Multi-turn text chat continuity: `NOT RUN — HOME PC REQUIRED`
- **M3 Spoken Loop**: Microphone capture $\to$ EdgeTTS audio playback: `NOT RUN — HOME PC REQUIRED`
- **M4 Ambient Surface**: PresenceMark morphs & envelopes without focus stealing: `NOT RUN — HOME PC REQUIRED`

---

## 19. Known Hardware & Environmental Limitations

1. **Acoustic Echo Cancellation (AEC)**:
   - Without hardware/DSP AEC, microphone capture during loud audio output will pick up assistant speech.
   - User must use headphones or programmatic interruption (spacebar / UI click) to avoid acoustic feedback.
2. **GPU Co-Residency**:
   - `qwen2.5:1.5b` is promoted to keep peak VRAM under 6.5 GB on RTX 3060 Ti 8GB when faster-whisper CUDA is loaded.
   - `qwen2.5:7b` is intentionally blocked from fast conversation.

---

## 20. Final Certification Decision

- **Phase C3.1 Local Fast Brain Runtime**: `NOT RUN — HOME PC REQUIRED`
- **Phase C4-B Voice / Language Closeout**: `NOT RUN — HOME PC REQUIRED`
- **Certification Date**: `NOT RUN — HOME PC REQUIRED`
- **Evaluator Signature**: `NOT RUN — HOME PC REQUIRED`
