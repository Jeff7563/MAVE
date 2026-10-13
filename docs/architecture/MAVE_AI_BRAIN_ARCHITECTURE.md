# MAVE AI Brain Architecture

## Principle

> **MAVE is not the model. MAVE selects and coordinates models.**

## Brain Profiles

MAVE distinguishes between **what kind of brain is needed** (Brain Profile) and **which engine delivers it** (Brain Provider).

```text
Intent / User Mode
       ↓
Brain Profile (Requirements & Latency Target)
       ↓
BrainProfilePolicy (Deterministic Resolver)
       ↓
BrainRouter (Capability Matching & Fallback)
       ↓
BrainProviderRegistry (Provider Adapters: mock, antigravity, ...)
```

### Defined Canonical Profiles

1. **`fast_conversation`**
   - **Purpose:** Normal interactive conversation, language practice, translation, quick Q&A, and future voice loops.
   - **Priorities:** Ultra-low latency, streaming, conversational flow, minimal input token overhead.
   - **Target:** Time-to-First-Token (TTFT) approximately $\le 1\text{--}3$ seconds where practical.
   - **Required Capabilities:** `streaming: true`, `fastChat: true`.
   - **Latency Class:** `interactive`.
   - **Status in M2:** No real production Fast Brain selected yet. `mock` provider is used for deterministic testing and architecture verification.

2. **`deep_reasoning`**
   - **Purpose:** Difficult analysis, architecture design, complex multi-factor decisions, long-form structured reasoning.
   - **Priorities:** High-depth quality over latency.
   - **Required Capabilities:** `streaming: true`, `reasoning: true`.
   - **Latency Class:** `normal`.
   - **Status in M2:** Future-facing profile. Remains unavailable until a dedicated deep reasoning provider route is established.

3. **`agent_work`**
   - **Purpose:** Project coding, repository analysis, multi-step actions, and future tool execution.
   - **Priorities:** Code synthesis, instruction following, file and system manipulation.
   - **Required Capabilities:** `streaming: true`, `coding: true` (Note: M2 intentionally does NOT require `toolUse: true` because Tool Registry and permissions are deferred to Milestone 5).
   - **Latency Class:** `normal`.
   - **Status in M2:** `antigravity` is the first real subscription candidate for this class (text-only in M2; tools disabled).

4. **`research`**
   - **Purpose:** Real-time information, source-grounded citations, fact checking, web-assisted research.
   - **Priorities:** Grounded factuality, citation verification.
   - **Required Capabilities:** `streaming: true`, `webResearch: true`.
   - **Latency Class:** `normal`.
   - **Status in M2:** Currently unavailable. Web search capabilities are not faked.

5. **`local_offline`**
   - **Purpose:** Offline operation, air-gapped private queries, zero-cost fallback.
   - **Priorities:** Privacy, zero network dependency, reliable local execution.
   - **Required Capabilities:** `streaming: true`, `local: true`.
   - **Latency Class:** `interactive`.
   - **Status in M2:** Future-facing profile. No local model runtime integrated yet.

---

## Provider Selection vs Profile Selection

To keep the architecture cleanly decoupled:
- **`BrainProfilePolicy`:** Encapsulates business logic describing *what kind of brain* is needed based on profile ID, resolving required capabilities, preferred providers, and fallback behavior.
- **`BrainProviderRegistry`:** Stores registered concrete provider adapters (`mock`, `antigravity`, future providers).
- **`BrainRouter`:** Matches profile requirements against available, healthy providers in the registry and manages fallback sequences.
- **Explicit Override:** Callers (e.g. Developer Chat, user settings) may specify `preferredProviderId`. Explicit caller overrides take precedence over automatic profile defaults while still validating capability safety.

---

## Current Provider Roles in M2

| Provider | Role in M2 | Latency Profile | Tool Support | Auth Strategy |
|---|---|---|---|---|
| **`mock`** | Deterministic tests, dev fallback, offline architecture verification | 15ms per chunk | Synthetic | None (zero external dependency) |
| **`antigravity`** | First real subscription AI brain, complex conversational / agent candidate | TTFT ~9–10s, total ~10s | Intentionally blocked in M2 | Official `agy` CLI via existing user auth |

---

## Fast Brain Gap & Production Requirements

### The Latency Gap Discovered in Phase 9
During live verification with the official Google Antigravity CLI, the integration performed flawlessly for session continuity, real AI text generation, and zero-key subscription re-use. However, real telemetry revealed:
- **Time-to-First-Token (TTFT):** ~9.3 seconds
- **Total Latency:** ~10.2 seconds
- **Input Overhead:** ~12,800 tokens for a simple prompt (due to Antigravity CLI system prompt and workspace loading overhead)

While this makes Antigravity an excellent candidate for **`agent_work`** and deep development tasks, it is **unsuitable as MAVE's default `fast_conversation` voice brain** (where voice turn-taking requires TTFT $\le 1\text{--}3$ seconds).

### Production Fast Brain Requirements
For natural voice conversation in Milestone 3, the future Fast Brain must satisfy:
1. **Official / Supported Integration:** No unauthorized scrapers, unofficial tokens, or piggyback auth hacks.
2. **Streaming:** Fast, progressive text delivery.
3. **Ultra-Low Latency:** Target TTFT $\le 1\text{--}3$ seconds where practical.
4. **Session Continuity:** Compatible with MAVE-owned session history and prompt assembly.
5. **Clean Cancellation:** Responsive cancellation when user interrupts or triggers barge-in.
6. **Predictable Quota / Subscription:** Stable access without unexpected rate-limiting.
7. **Safe Text-Only Mode:** Does not force tool execution overhead into conversational turns.
8. **Bilingual Fluency:** Strong Thai and English conversational and translation capability for language tutoring.
9. **No Vendor Lock-in in Core:** Provider adapter isolated in `@mave/providers`.

## Provider Interface

```ts
export interface BrainProvider {
  id: string;
  getCapabilities(): BrainCapabilities;
  health(): Promise<ProviderHealth>;
  chat(request: BrainRequest, options?: BrainRequestOptions): AsyncIterable<BrainEvent>;
  cancel?(requestId: string): Promise<void>;
}
```

## Capabilities

```ts
export interface BrainCapabilities {
  streaming: boolean;
  reasoning: boolean;
  toolUse: boolean;
  multimodal: boolean;
  vision: boolean;
  webResearch: boolean;
  coding: boolean;
  longContext: boolean;
  local: boolean;
}
```

## Router Inputs

BrainRouter ควรพิจารณา:
- intent
- capability
- latency
- provider availability
- quota state
- privacy
- task complexity
- context size
- local/cloud preference
- user override

## Example Routing

```text
"What does awkward mean?"
→ Fast Brain

"แปลประโยคนี้เป็นไทย"
→ Fast Brain

"วิเคราะห์ architecture repo นี้"
→ Reasoning / Agent Brain

"หาเหตุการณ์ล่าสุดพร้อม source"
→ Research Brain

Offline
→ Local Brain
```

## Fallback Policy

```text
Preferred Brain
↓ unavailable
Fallback 1
↓ unavailable
Fallback 2
↓
Local / graceful failure
```

บันทึก provider selected, reason, fallback, latency และ failure reason

## Subscription-Backed Providers

รองรับ official clients/CLI/supported integrations เมื่อผู้ให้บริการอนุญาต แต่ architecture ต้องสมมติว่า access method, quota และ policy เปลี่ยนได้เสมอ

ห้าม unofficial token reuse หรือ auth piggyback hacks

## Prompt Architecture

```text
System Identity
Runtime Rules
Mode Rules
Task Instructions
Context
Tool Results
User Input
```

Prompt templates ต้อง versioned

## Modes

- Conversation Mode
- Tutor Mode
- Work Mode
- Research Mode
- Developer Mode

Mode ไม่เท่ากับ provider

## Streaming & Cancellation

Fast conversation ต้อง stream; request ที่นานต้อง cancel ได้เมื่อ user บอก stop, เริ่ม request ใหม่ หรือ timeout

## Metrics

- time to first token
- total latency
- provider failure rate
- fallback rate
- answer benchmark
- quota estimate
- cancellation success

ช่วงแรกใช้ deterministic routing ก่อน adaptive routing
