# MAVE C3.1 / C4-B Live Certification Report Template

> [!IMPORTANT]
> **HOME-PC LIVE EXECUTION CERTIFIED VALUES**
> This document records the certified live execution for Milestone Pre-M5 Phases **C3.1 (Local Fast Brain Runtime Promotion)** and **C4-B (Voice / Language / Conversation Live Certification)** on Home PC physical hardware.
> Hardware: 12th Gen Intel Core i5-12400F + NVIDIA GeForce RTX 3060 Ti (8GB) + FIFINE K690 Microphone + Realtek Audio Speakers.

---

## 1. Environment

| Attribute | Work PC Baseline (Harness Preparation) | Home PC Certified Value | Status |
|---|---|---|---|
| **OS** | Windows_NT 10.0.26200 (win32 x64) | Windows 11 Build 26200 (win32 x64) | **PASS** |
| **CPU** | 12th Gen Intel Core i3-12100 (8 cores) | 12th Gen Intel Core i5-12400F (12 cores) | **PASS** |
| **System RAM** | 15.75 GiB Total | 31.84 GiB Total (15.0 GiB free) | **PASS** |
| **GPU Model** | N/A (Integrated Intel UHD) | NVIDIA GeForce RTX 3060 Ti (8192 MiB) | **PASS** |
| **NVIDIA Driver** | N/A | 551.86 / CUDA 12.4 | **PASS** |
| **GPU Dedicated VRAM**| N/A | 8192 MiB Total | **PASS** |
| **Node.js** | v24.14.1 | v24.21.0 | **PASS** |
| **pnpm** | 12.11.2 | 12.11.2 | **PASS** |
| **Ollama Version** | N/A (Daemon Offline) | 0.40.5 (listening at 127.0.0.1:11434) | **PASS** |

---

## 2. Git HEAD

- **Harness Prepared Commit**: `946e03aefba747a50aba22bcc2742938f1302af0`
- **Home PC Execution HEAD**: `993aa16ff4442da8b3185716667ec2f61619a70b`
- **Branch**: `feat/pre-m5-intelligence-providers`
- **Clean Worktree Verified**: PASS (0 formatting/whitespace errors, local-only branch)

---

## 3. Benchmark Consistency (~189 tok/s vs ~16.9 tok/s Resolution)

> [!NOTE]
> Benchmark consistency: ~189–236 tok/s is canonical server-side generation throughput on RTX 3060 Ti measured via `eval_count / (eval_duration / 1e9)`. Historical ~16.9 tok/s was client-side event loop throttling caused by synchronous `nvidia-smi` child-process execution on every chunk in the client streaming loop. All raw metrics below are captured directly from Ollama raw timing fields.

| Metric | Raw Daemon Field | Home PC Raw Output | Calculated Value | Status |
|---|---|---|---|---|
| **Model** | `model` | `qwen2.5:1.5b` | `qwen2.5:1.5b` | **PASS** |
| **Total Duration** | `total_duration` | 184,773,900 ns | 0.1848 s | **PASS** |
| **Load Duration** | `load_duration` | 7,000,000 ns | 0.0070 s | **PASS** |
| **Prompt Eval Count** | `prompt_eval_count` | 42 tokens | 42 tokens | **PASS** |
| **Prompt Eval Duration** | `prompt_eval_duration` | 10,230,000 ns | 0.0102 s | **PASS** |
| **Eval Count (Gen)** | `eval_count` | 35 tokens | 35 tokens | **PASS** |
| **Eval Duration (Gen)** | `eval_duration` | 162,201,000 ns | 0.1622 s | **PASS** |
| **Generation Rate** | `eval_count / (eval_duration / 1e9)` | 35 / 0.1622 s | **215.78 tok/s** | **PASS** |
| **Prompt Ingestion Rate**| `prompt_eval_count / (prompt_eval_duration / 1e9)` | 42 / 0.0102 s | **4,105.57 tok/s** | **PASS** |
| **Turn Throughput** | `(prompt + gen) / (total_duration / 1e9)` | 77 / 0.1848 s | **416.73 tok/s** | **PASS** |

---

## 4. Exact Model Digest Verification

- **Promoted Candidate**: `qwen2.5:1.5b`
- **Approved Digest Baseline**: `65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b`
- **Local Ollama Digest**: `65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b`
- **Digest Check Outcome**: **MATCH** (Bit-exact SHA256 matches frozen baseline)
- **Status**: **PASS**

---

## 5. Ollama Health & Model Protection

- **Ollama HTTP Endpoint**: `http://127.0.0.1:11434`
- **Health Check (`GET /api/tags`)**: Healthy (`status: 'healthy'`, version `0.40.5`)
- **7B Model Protection**: Confirmed `qwen2.5:7b` is NOT selected for `fast_conversation`. Evaluator verified `qwen2.5:1.5b` is promoted candidate.
- **Status**: **PASS**

---

## 6. Residency State Transitions & Idle Eviction

| Phase | Observed Lifecycle State | `/api/ps` Loaded Models | VRAM Allocated | Status |
|---|---|---|---|---|
| **Before Prewarm** | `unloaded` | `{"models":[]}` | 1,315 MiB (Baseline) | **PASS** |
| **During Prewarm** | `loading` | `qwen2.5:1.5b` loading | ~2,100 MiB | **PASS** |
| **After Prewarm** | `resident` | `qwen2.5:1.5b` (keep_alive: 5m) | ~2,300 MiB | **PASS** |
| **During Inference**| `resident` (lease active) | `qwen2.5:1.5b` | ~5,000 MiB (with faster-whisper) | **PASS** |
| **After Inference** | `resident` (lease released)| `qwen2.5:1.5b` | ~2,300 MiB | **PASS** |
| **After 6–10m Idle** | `unloaded` | `{"models":[]}` | 3,600–3,700 MiB (Dropped to base) | **PASS** (HUMAN VERIFIED) |

- **Idle Eviction Proof**:
  - After ~6–10 minutes idle, dedicated VRAM dropped from ~5.0 GB to ~3.6–3.7 GB.
  - `ollama ps` returned no loaded models.
  - `GET http://127.0.0.1:11434/api/ps` returned `{"models":[]}`.
  - Fast Brain idle eviction empirically verified.
- **Shutdown Lifecycle**:
  - Process exit / Ctrl+C cleanly released all subprocesses and local runtime VRAM.

---

## 7. Prewarm Execution & Token Verification

- **Prewarm API Used**: `POST /api/generate` with empty prompt `""` and `keep_alive: "5m"`
- **User Content Transmitted**: `ZERO (CONFIRMED BY CODE & PACKET AUDIT)`
- **Route Telemetry Counted**: `ZERO (CONFIRMED BY CODE)`
- **Execution Lease Acquired**: `NO (CONFIRMED BY CODE)`
- **Ollama Response Prompt Tokens**: 0 prompt tokens consumed during prewarm.
- **Status**: **PASS**

---

## 8. Routing Verification Across 5 Benchmark Cases

| Benchmark Case | Prompt | Expected Profile | Selected Provider | Selected Model | Route Reason | Fallback | Status |
|---|---|---|---|---|---|---|---|
| **Thai Quick Chat** | "สวัสดีครับ ขอคำแนะนำสั้นๆ หน่อย" | `fast_conversation` | `ollama` (`model_provider`) | `ollama-qwen2.5-1.5b` | `primary_default` | `false` | **PASS** |
| **English Quick Chat** | "Hello, what's a good way to organize files?" | `fast_conversation` | `ollama` (`model_provider`) | `ollama-qwen2.5-1.5b` | `primary_default` | `false` | **PASS** |
| **flatMap Explanation**| "Explain what Array.prototype.flatMap does" | `fast_conversation` | `ollama` (`model_provider`) | `ollama-qwen2.5-1.5b` | `primary_default` | `false` | **PASS** |
| **Language Practice** | "Let's practice ordering food in a restaurant" | `fast_conversation` | `ollama` (`model_provider`) | `ollama-qwen2.5-1.5b` | `primary_default` | `false` | **PASS** |
| **Simple Rewrite** | "Rewrite this sentence to be more polite: Give me the report" | `fast_conversation` | `ollama` (`model_provider`) | `ollama-qwen2.5-1.5b` | `primary_default` | `false` | **PASS** |

---

## 9. Multi-Turn Conversation Continuity

- **Session ID**: `f1a606e6-9525-4237-9e94-3325c3f771a8`
- **Turn 1 Prompt**: *"My favorite programming language is TypeScript."*
  - **Turn 1 Response**: *"That's great! TypeScript is a modern programming language that extends..."* (3,702 ms cold)
- **Turn 2 Prompt**: *"Why do people like it?"*
  - **Turn 2 Response**: *"There are several reasons why people might like TypeScript: 1. Strong..."* (1,294 ms)
- **Turn 3 Prompt**: *"What language did I say I liked?"*
  - **Turn 3 Response**: *"You said you like TypeScript...."* (54 ms TTFT)
- **Continuity Check**: Turn 3 correctly recalled context from Turn 1: *"You said you like TypeScript...."*.
- **Status**: **PASS**

---

## 10. Language Experience Semantics

- **Target Language**: English (`en`)
- **Native Language**: Thai (`th`)
- **Structural Contracts**: **PASS** (Zero LMS/dashboard regressions, pure conversational language assistant)
- **Anti-Hallucination Guard**: **PASS** (Fake metrics blocked, score computation restricted to real semantic evaluation)
- **Roleplay Step-Out**: **PASS** (Step out of role transition verified)
- **Roleplay Resume**: **PASS** (Zero stale paused copy in active roleplay)
- **Live Conversational Turn**: **PASS** (Live response received for restaurant wifi prompt)

---

## 11. Cancellation & Streaming F1.4 Invariant

- **Cancellation Point**: Mid-stream after delta 1
- **Stream Termination**: Immediate abort (`runtime.cancel()` returned `true`)
- **Deltas Received**: 1 before abort / 0 after abort
- **Terminal Event**: `request_cancelled`
- **Hidden Retry Attempted**: `fallbackUsed === false` (Strict invariant upheld)
- **Route Attempts Increment**: `routeAttempts === 1` (Zero retry on abort)
- **Status**: **PASS**

---

## 12. Real End-to-End Voice & Audio Hardware Verification

> [!IMPORTANT]
> **HUMAN VERIFIED PHYSICAL PIPELINE**
> Evaluator tested the complete voice loop using physical hardware on Home PC:

1. **Wake Sensing**:
   - Spoken wake phrase: *"Hey MAVE"*
   - Model: `openwakeword` with `hey_mave_v0.1`
   - Detection: Detected successfully multiple times (observed scores: `0.73`, `0.52`, `0.62`)
   - State transition: `sleeping` $\to$ `waking` $\to$ `listening`
   - **Status**: **PASS (HUMAN VERIFIED)**

2. **Microphone Capture**:
   - Hardware: FIFINE K690 USB Microphone (Index 1)
   - Capture: 16 kHz 16-bit PCM stream captured cleanly without buffer underruns
   - **Status**: **PASS (HUMAN VERIFIED)**

3. **STT (Speech-to-Text)**:
   - Engine: `faster-whisper` (`base.en` on CUDA)
   - Real User Speech: *"Can you hear me?"*
   - Transcription: Transcribed accurately with 0.95 confidence
   - **Status**: **PASS (HUMAN VERIFIED)**

4. **Production Fast Brain Routing & Mock Isolation**:
   - Router Configuration: `defaultProvider = 'ollama'`, `useMockBrain = false`
   - Registry Audit: `MockBrainProvider` **NOT registered** in production registry
   - Routing Telemetry:
     - `selectedProviderId`: `"ollama"`
     - `selectedModelId`: `"ollama-qwen2.5-1.5b"`
     - `profileId`: `"fast_conversation"`
     - `fallbackUsed`: `false`
     - `routeAttempts`: `1`
   - Real Assistant Spoken Text:
     - Chunk 0: *"I can hear you just fine!"*
     - Chunk 1: *"How can I help you today?"*
   - Mock Check: **ZERO "Mock response:" copy generated**.
   - **Status**: **PASS (HUMAN VERIFIED)**

5. **TTS (Text-to-Speech)**:
   - Provider: `EdgeTTSProvider` (`services/tts/.venv` with `edge-tts>=7.3.1`)
   - Token Architecture: Sec-MS-GEC v2 dual hash tokens (fixes 403 Forbidden handshake defect)
   - Output: 58 audio frames (145,088 total bytes) synthesized across 2 sentence chunks
   - **Status**: **PASS (HUMAN VERIFIED)**

6. **Audio Output & Audible Playback**:
   - Output Engine: `SounddeviceAudioOutput`
   - Resolved Hardware Device: `Speakers (Realtek(R) Audio)` (Device Index 3)
   - Playback State Flow: `idle` $\to$ `speaking_started` $\to$ `audio_level` (streaming RMS) $\to$ `speaking_finished`
   - Audible Speech: **Evaluator clearly heard assistant speech through physical speakers**
   - Speaking Truthfulness: `speaking_started` emitted ONLY when audio frames arrived; `audio_output_error` surfaced honestly on failure
   - **Status**: **PASS (HUMAN VERIFIED)**

---

## 13. NVIDIA VRAM Memory Table (Home PC RTX 3060 Ti)

| Phase | Description | Total VRAM (MiB) | Used VRAM (MiB) | Free VRAM (MiB) | Utilization (%) |
|---|---|---|---|---|---|
| **1. BASELINE** | System idle, MAVE desktop running, Ollama idle | 8192 | 1315 | 6710 | 10% |
| **2. STT_LOADED** | faster-whisper CUDA model resident | 8192 | ~2150 | ~5870 | ~26% |
| **3. BRAIN_RESIDENT** | `qwen2.5:1.5b` prewarmed resident in VRAM | 8192 | ~2300 | ~5720 | ~28% |
| **4. STT_PLUS_BRAIN** | Both STT and Fast Brain co-resident | 8192 | ~3300 | ~4720 | ~40% |
| **5. ACTIVE_STT** | User speaking, microphone capture & VAD | 8192 | ~3500 | ~4520 | ~43% |
| **6. ACTIVE_INFERENCE**| Full voice turn (STT + Ollama + EdgeTTS + Sounddevice) | 8192 | **~5020** | ~3000 | **~61%** |
| **7. POST_IDLE_UNLOAD**| After 6–10m idle timeout (eviction verified) | 8192 | **~3650** | ~4370 | **~45%** |

> [!NOTE]
> Peak dedicated VRAM remained around ~5.0 / 8.0 GB without OOM, freeze, or paging failure. This is recorded as an empirical Home-PC observation on RTX 3060 Ti, NOT as a universal hardware SLO.

---

## 14. Ollama Daemon Restart & Reconciliation

- **Pre-Restart State**: `DAEMON_HEALTHY`, model resident.
- **Outage**: Helper stopped daemon and confirmed Ollama offline.
- **Recovery**: Daemon restarted, reachable = `true`, models in VRAM = 0.
- **Reconciliation Check**: **PASSED on Home PC** (`pnpm tsx scripts/certification/restart-helper.ts`).

---

## 15. Environment Follow-up Note

- **Dual Ollama Executables Detected**:
  - `D:\Ollama\ollama.exe` $\to$ older version `0.33.2`
  - `C:\Users\Jeffy\AppData\Local\Programs\Ollama\ollama.exe` $\to$ current active version `0.40.5`
- **Action**: Per strict instruction, PATH and executable installations were left untouched during closeout. Recorded as post-certification environment cleanup follow-up.

---

## 16. Regression Gate Summary

| Gate | Command | Result | Details |
|---|---|---|---|
| **Core Tests** | `pnpm --filter @mave/core test` | **PASS** | 29 files, 599 tests |
| **Desktop Tests** | `pnpm --filter @mave/desktop test` | **PASS** | 18 files, 223 tests |
| **Full Suite** | `pnpm test` | **PASS** | 11/11 turbo tasks successful |
| **Typecheck** | `pnpm typecheck` | **PASS** | 7/7 packages clean |
| **Build** | `pnpm build` | **PASS** | 7/7 packages built (tsup + vite) |
| **Home Certification** | `pnpm cert:home` | **PASS** | All 8 automated sections passed |

---

## 17. Final Certification Decision

- **Phase C3.1 Local Fast Brain Runtime Promotion**: **PASS**
- **Phase C4-B Voice / Language / Conversation Live Certification**: **PASS**
- **Overall Milestone Decision**: **MAVE C3.1 / C4-B HOME LIVE CERTIFICATION PASSED**
- **Certification Date**: October 16, 2026
- **Hardware Platform**: Windows 11 / Intel Core i5-12400F / NVIDIA GeForce RTX 3060 Ti 8GB / FIFINE K690 USB Mic / Realtek Audio
