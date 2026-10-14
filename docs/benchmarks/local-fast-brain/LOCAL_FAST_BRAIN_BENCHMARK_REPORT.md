# MAVE PRE-M5 — F1.5-C2 EMPIRICAL BENCHMARK & QUALIFICATION REPORT
## LOCAL FAST BRAIN ON HOST HARDWARE (RTX 3060 Ti 8GB)

- **Date:** 2026-10-14
- **Branch:** `feat/pre-m5-intelligence-providers`
- **Benchmark Script:** `scripts/benchmark-local-fast-brain.ts`
- **Raw Metrics File:** `docs/benchmarks/local-fast-brain/benchmark-metrics.json`
- **Smoke Verification Script:** `scripts/smoke-live-fast-brain.ts`

---

## 1. Hardware & System Environment

| Dimension | Specification |
|---|---|
| **Operating System** | Windows 11 Pro 64-bit |
| **CPU** | 12th Gen Intel(R) Core(TM) i5-12400F (6 physical cores, 12 logical threads, up to 4.4 GHz) |
| **System Memory** | 32 GB DDR4 (31.8 GB visible) |
| **GPU** | NVIDIA GeForce RTX 3060 Ti 8GB (8,192 MiB GDDR6, 4,864 CUDA cores) |
| **GPU Driver** | NVIDIA 610.88 |
| **Baseline GPU Usage** | ~2,002 MiB (Windows DWM, displays, background desktop tasks) |
| **Inference Daemon** | Ollama version 0.33.2 on local loopback `http://127.0.0.1:11434` |
| **STT Coexistence Target**| `services/stt` `faster-whisper` (`large-v3-turbo` on CUDA `float16`, ~1,600 MiB VRAM footprint) |

---

## 2. Benchmark Invariants & Methodology

- **Authoritative MAVE Pipeline:**
  `BrainRouter` $\to$ `ModelCatalogRuntime` $\to$ `OllamaBrainProvider` $\to$ local Ollama HTTP API $\to$ `BrainEvents` (`started`, `delta`, `completed`).
- **Controlled Generation Settings:**
  - Context window (`num_ctx`): 4,096 tokens (4K conversational context)
  - Temperature: 0.7
  - Top-P: 0.9
  - Token budget: 150–250 tokens
  - Keep-alive: 5 minutes (`keep_alive: '5m'`)
- **Cold vs. Warm Methodology:**
  - **Cold Run:** Prior models explicitly unloaded using POST `/api/generate` with `keep_alive: 0`. GPU memory verified back to baseline and `/api/ps` empty before initiating cold run. Minimum 2 cold runs recorded per model.
  - **Warm Run:** Model resident in GPU VRAM. Steady-state TTFT and generation throughput measured across minimum 3 warm runs.
- **Thinking Model Protocol (`deepseek-r1:7b`):**
  Measured both raw TTFT (first internal token) and **User-Visible TTFT** (first token outside `<think>...</think>`). Internal thinking tokens were audited for conversational voice feasibility.
- **Non-Generative Exclusion:** `nomic-embed-text:latest` was excluded from conversational benchmarking.

---

## 3. Stage A Performance & Screening Matrix (5 Generative Candidates)

| Candidate Model | Parameters | Quantization | Ollama Digest | Resident VRAM | Peak GPU Used | Available Headroom | Median Cold TTFT | Median Warm TTFT | Eval Speed | Stage A Status |
|---|---|---|---|---|---|---|---|---|---|---|
| **`qwen2.5:1.5b`** | 1.5B | Q4_K_M | `65ec0654...` | **1,112 MiB** | 3,284 MiB | **4,908 MiB** | 2,571.5 ms | **96.0 ms** | 16.9 tok/s | **QUALIFIED (Finalist)** |
| **`qwen2.5:7b`** | 7.6B | Q4_K_M | `845dbda0...` | **4,528 MiB** | 6,664 MiB | **1,528 MiB** | 4,755.5 ms | **393.0 ms** | 16.7 tok/s | **QUALIFIED (Finalist)** |
| `qwen2.5-coder:7b`| 7.6B | Q4_K_M | `dae161e2...` | 4,528 MiB | 6,664 MiB | 1,528 MiB | 4,997.0 ms | 89.0 ms | 16.7 tok/s | **ELIMINATED** (Code syntax specialization) |
| `deepseek-r1:7b` | 7.6B | Q4_K_M | `755ced02...` | 4,528 MiB | 6,664 MiB | 1,528 MiB | 6,526.0 ms | **1,495.0 ms** | 71.2 tok/s | **ELIMINATED** (`<think>` stream delays TTFT) |
| `llava:7b` | 7.0B | Q4_0 | `8dd30f6b...` | 4,493 MiB | 6,629 MiB | 1,563 MiB | 18,248.0 ms | 369.0 ms | 16.6 tok/s | **ELIMINATED** (Vision specialist) |

### Stage A Elimination Details:
1. **`deepseek-r1:7b`:** The model consistently emits extensive internal thinking chains inside `<think>...</think>` before producing user-visible text. In multiple screening tasks (`thai_slang`, `english_casual`, `instruction_following`, `uncertainty`), the 200-token generation limit was exhausted while the model was still reasoning inside `<think>`, producing 0 visible answer tokens. User-visible TTFT averaged $1,495\text{--}3,003\text{ ms}$, failing interactive voice constraints ($\le 1\text{--}3\text{s}$). Reallocated to future Milestone local `deep_reasoning`.
2. **`llava:7b`:** Multimodal vision specialist. Cold start required 32.7 seconds on run 1. High 4.5 GB VRAM footprint without conversational voice optimization.
3. **`qwen2.5-coder:7b`:** Code-specialized model with programming syntax bias. Outperformed on conversational brevity and everyday interaction by general instruction models.

---

## 4. Stage B Deep Conversational Qualification (Top 2 Finalists)

### 100-Point Transparent Qualification Scoring Rubric

| Category | Max Points | `qwen2.5:1.5b` | `qwen2.5:7b` | Qualitative Evaluation Findings |
|---|---|---|---|---|
| **Thai Conversation** | 20 | 16.5 | **18.5** | `qwen2.5:7b` demonstrates deep mastery of Thai slang, emotional empathy, and natural conversational flow. `qwen2.5:1.5b` is fluent, grammatically correct, and conversational, with slight lexical simplification. |
| **English Conversation** | 10 | 8.5 | **9.5** | Both models converse naturally in casual English; 7B provides richer metaphorical and descriptive range. |
| **Language Learning** | 15 | 13.0 | **14.5** | Both correctly diagnose grammar errors (`He don't` $\to$ `He doesn't`) and offer situational examples. 7B provides deeper bilingual contrastive analysis. |
| **Instruction Following** | 15 | 12.5 | **13.5** | Both strictly obey negative constraints ("ห้ามเกิน 1 คำถาม", "ไม่เกิน 15 คำ", 3 choices). |
| **Voice Friendliness** | 10 | **9.0** | 8.0 | `qwen2.5:1.5b` produces clean, concise spoken-style responses without markdown clutter, making it superior for TTS playback. 7B occasionally uses markdown headers and bullet lists. |
| **Short Reasoning** | 10 | 8.0 | **9.0** | Both solve budget allocation and everyday verbal logic problems accurately. |
| **Uncertainty / Reliability** | 5 | 4.0 | **4.5** | Both explicitly identify unknowable future events (e.g. backpack contents) rather than hallucinating confident facts. |
| **Warm Latency** | 7 | **7.0** | 6.0 | `qwen2.5:1.5b` achieved **96 ms median warm TTFT** (sub-100ms) vs 393 ms for `qwen2.5:7b`. |
| **Cold Latency** | 3 | 1.0 | 1.0 | 1.5B cold TTFT is 2,571 ms vs 4,755 ms for 7B. |
| **VRAM & Coexistence** | 5 | **5.0** | 3.0 | 1.5B requires only **1,112 MiB** VRAM (4.9 GB free headroom); 7B consumes **4,528 MiB** (1.5 GB free headroom). |
| **TOTAL SCORE** | **100** | **84.5** | **87.5** | **BOTH MODELS PASS QUALIFICATION THRESHOLD ($\ge 75/100$)** |

### Multi-Turn Context Retention Verification
- **Turn 1 (User):** *"ผมชอบดื่มชาเขียวมะนาวหวานน้อย ไม่ชอบกาแฟเลยนะ จำไว้ด้วยล่ะ"*
- **Turn 2 (Chit-chat):** *"อากาศช่วงนี้เป็นยังไงบ้าง"*
- **Turn 3 (Recall Test):** *"บ่ายนี้ง่วงจัง แนะนำเครื่องดื่มให้ผมสักแก้วสิ"*
- **Result:**
  - `qwen2.5:1.5b`: **PASS.** Recalled green tea lemonade, offered refreshing options, zero mention of coffee.
  - `qwen2.5:7b`: **PASS.** Explicitly referenced user preference: *"แก้วชาเขียวมะนาวที่คุณชอบนั้นเป็นทางเลือกที่ดีครับ... ไม่มากจนทำให้คุณนอนไม่หลับ"*.

---

## 5. Live Qualification Smoke Verification

Executed against `qwen2.5:1.5b` via [`scripts/smoke-live-fast-brain.ts`](file:///c:/project/MAVE/scripts/smoke-live-fast-brain.ts):
- **Thai Greeting:** *"สวัสดี MAVE วันนี้เป็นยังไงบ้าง"* $\to$ Warm TTFT: 2,712 ms (initial cold load), polite helpful Thai greeting.
- **English Short Advice:** *"Hey MAVE, what's a good 5-minute stretch routine?"* $\to$ **Warm TTFT: 25 ms** (total 719 ms).
- **Language Learning:** *"She don't know nothing"* $\to$ **Warm TTFT: 26 ms** (total 715 ms), correctly identifies double negative and subject-verb agreement (`She doesn't know anything`).
- **Voice Conciseness:** *"สรุปประโยชน์ของวิตามินซีใน 1 ประโยคสั้นๆ"* $\to$ **Warm TTFT: 24 ms** (total 189 ms), single concise sentence.

---

## 6. Hardware Coexistence & Sizing Analysis on 8GB GPU

```text
Total Physical GPU VRAM: 8,192 MiB (8.0 GB)

Scenario A: Qwen 2.5 1.5B (WINNER)
  [2,002 MiB] Windows 11 Desktop + DWM
  [1,600 MiB] faster-whisper (large-v3-turbo CUDA float16)
  [1,112 MiB] qwen2.5:1.5b (4K context KV cache + weights)
  -------------------------------------------------------------
  [4,714 MiB] Total Active Allocation
  [3,478 MiB] SAFE UNCOMMITTED HEADROOM (42.5% free) -> ZERO OOM RISK

Scenario B: Qwen 2.5 7B (RUNNER-UP)
  [2,002 MiB] Windows 11 Desktop + DWM
  [1,600 MiB] faster-whisper (large-v3-turbo CUDA float16)
  [4,528 MiB] qwen2.5:7b (4K context KV cache + weights)
  -------------------------------------------------------------
  [8,130 MiB] Total Active Allocation (~99.2% of VRAM)
  [   62 MiB] CRITICAL HEADROOM -> HIGH RISK OF CUDA OOM / PAGE SPILL
```

---

## 7. Qualification Decision & Phasing Handoff

### **WINNER: `qwen2.5:1.5b` (`FAST` Role Candidate)**
- **Role:** Fast Conversational Voice Brain (`fast_conversation`).
- **Qualification Score:** 84.5 / 100.
- **Key Justification:** Sub-100ms warm TTFT (96 ms median, 24–26 ms live smoke), 1.1 GB resident VRAM leaving 4.9 GB free headroom for concurrent CUDA STT, high voice friendliness, and solid bilingual Thai/English fluency.

### **RUNNER-UP: `qwen2.5:7b` (`BALANCED` Role Candidate)**
- **Role:** Balanced Conversational Brain (`fast_conversation` text-first or secondary high-nuance mode).
- **Qualification Score:** 87.5 / 100.
- **Key Justification:** Exceptional textual nuance and empathetic phrasing (18.5/20 Thai), but heavy 4.5 GB VRAM footprint risks contention with CUDA STT on the 8GB host GPU.

### **C2 / C3 Boundary Compliance:**
- **`productionApproved: false`** is strictly maintained for all candidates in [`CANONICAL_LOCAL_MODEL_QUALIFICATIONS`](file:///c:/project/MAVE/packages/providers/src/brain/qualification-data.ts).
- Production AUTO routing remains fail-closed until Milestone F1.5-C3.
- Milestone F1.5-C3 authoritatively owns:
  1. Promoting `qwen2.5:1.5b` to `productionApproved: true`.
  2. Setting default routing to `ollama-qwen2.5-1.5b`.
  3. Configuring persistent resident memory and idle unload lifecycle policies.

