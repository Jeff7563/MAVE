# MAVE Intelligence & Provider Architecture

**Status:** Canonical Intelligence Architecture — Modernized after Milestone 4 Closeout  
**Created after:** MAVE Milestone 2 Phase 10 Closeout  
**Modernized after:** MAVE Milestone 4 Phase 10 Closeout (Pre-M5 Intelligence Provider Foundation)  
**Historical Base:** M0, M1, M2, M3, M4 COMPLETE  
**Current Milestone Track:** Pre-M5 Foundation (F1 Intelligence Provider Runtime & F2 Real Brain Tuning)  
**Primary Purpose:** Define MAVE's canonical intelligence provider, model catalog, routing, fallback, telemetry, and knowledge architecture, establishing a vendor-neutral orchestration foundation across direct model providers, agent runtimes, and knowledge sources before granting execution authority in Milestone 5.
**Canonical Subscription Architecture:** [`MAVE_SUBSCRIPTION_INTELLIGENCE_ARCHITECTURE.md`](MAVE_SUBSCRIPTION_INTELLIGENCE_ARCHITECTURE.md)

---

# 1. Executive Summary & Audit of Previous Architecture

The original `MAVE_INTELLIGENCE_PROVIDER_ARCHITECTURE.md` was authored following Milestone 2 (Phase 10), when MAVE had completed its first provider-independent `ConversationRuntime`, `SessionManager`, `ContextManager`, `BrainRouter`, `BrainProfilePolicy`, and its first real subscription provider adapter (`AntigravityBrainProvider` via the official `agy` CLI).

Since that time, MAVE has completed:
1. **Milestone 3 (Spoken Voice Loop):** Full acoustic wake detection (`openWakeWord`), 16 kHz PCM streaming audio input, local STT (`faster-whisper`), progressive sentence chunking (`StreamingTextChunker`), speech synthesis (`EdgeTTS`), low-latency audio playback (`sounddevice`), and programmatic barge-in interruption.
2. **Milestone 4 (Ambient Adaptive Surface):** A zero-focus-stealing, multi-envelope desktop presentation layer (`Capsule`, `Quick Info card`, `Expanded Context panel`), voice-reactive `PresenceMark` visualizer, least-privilege preload isolation, and multi-monitor display anchoring.

### 1.1 Section-by-Section Audit of Post-M2 Document

| Original Section | Original Topic | Status in Audit | Modernization Applied |
|---|---|---|---|
| **Header** | Status & Milestone context | **STALE** | Updated from post-M2 / pre-M3 state to post-M4 closeout and Pre-M5 foundation. |
| **Section 1** | Core Principle | **VALID** | Invariant preserved: MAVE is the intelligence orchestration layer above providers. |
| **Section 2** | Intelligence Layer Overview | **VALID** | Three-tier architecture (Model Brains, Agent Runtimes, Knowledge/Truth) affirmed. |
| **Section 3** | Model Brain vs Agent Runtime | **PARTIALLY VALID** | Valid concept; formalized into distinct `ModelProvider` and `AgentRuntimeProvider` taxonomies. |
| **Section 4** | Why Antigravity Is Heavy | **VALID** | Preserved exact historical telemetry (~9–10s TTFT, 12k+ token overhead) explaining why it cannot serve as Fast Brain. |
| **Section 5** | Multiple Models per Provider | **PARTIALLY VALID** | Elevated from conceptual example to canonical `ModelCatalog` and `ModelDescriptor` architecture. |
| **Section 6** | Agent Model Selection | **VALID** | Preserved rule: agent runtime model selection is strictly distinct from direct model provider selection. |
| **Section 7** | Brain Profiles | **VALID** | Kept the 5 canonical profiles (`fast_conversation`, `deep_reasoning`, `agent_work`, `research`, `local_offline`). |
| **Section 8** | Information Source Separate from Brain | **VALID** | Core invariant: "Who should THINK?" is separate from "Where do FACTS come from?". |
| **Section 9** | Correctness & Truth Requirement Policy | **VALID** | Truth requirement classification rules preserved and structured into the routing pipeline. |
| **Section 10–11** | Routing & Provider Selection Pipeline | **PARTIALLY VALID** | Refined into canonical two-stage resolution: Provider Selection followed by Model Selection. |
| **Section 12** | Automatic vs Explicit Override | **VALID** | Preserved default Auto with explicit overrides, adding strict override precedence rules. |
| **Section 13** | Future Provider Architecture | **PARTIALLY VALID** | Diagram modernized to include Knowledge/Truth providers and concrete catalog layers. |
| **Section 14** | Capability Not Vendor Identity | **VALID** | Router matches normalized capability flags, not vendor marketing brands. |
| **Section 15–16** | Model Policy in Providers / Agents | **FUTURE VISION** | Formalized responsibility boundary between `BrainProfilePolicy`, `BrainRouter`, and `ModelPolicy`. |
| **Section 17** | Fast Brain Requirements | **STALE / VALID** | Stale reference to "future STT/TTS" removed (M3 complete); latency and quality targets reaffirmed. |
| **Section 18** | Agent Brain Requirements | **VALID** | Requirements affirmed; latency tolerance justified by multi-step task complexity. |
| **Section 19** | M5 Tool/Permission Boundary | **VALID** | Strict invariant: agent runtimes request tools; MAVE Tool Registry & Permission Policy arbitrate. |
| **Section 20** | Current Antigravity Safety Position | **VALID** | Text-only execution active; tool execution blocked until Milestone 5. |
| **Section 21** | Future Multi-Agent Possibility | **FUTURE VISION** | Maintained as future architectural direction; premature implementation avoided. |
| **Section 22–23** | User Experience & Transparency | **VALID** | Ambient Surface presents unified MAVE identity; diagnostics remain in Developer UI. |
| **Section 24** | Failure & Fallback | **PARTIALLY VALID** | Expanded into explicit fallback chains, fallback latency budgets, and intent preservation. |
| **Section 25–26** | Quota, Cost & Access Paths | **VALID** | Affirmed official access paths (API, CLI, local) and non-assumption of consumer subscription equivalence. |
| **Section 27** | Privacy Routing | **VALID** | Privacy routing (`local_only=true`) defined as a strict fail-closed constraint. |
| **Section 28** | MAVE Identity vs Provider Personality | **VALID** | Prompt layering: MAVE Identity + Conversation Mode + Task Context + Provider Adapter. |
| **Section 29** | Relationship to M3 Voice | **STALE** | Updated: M3 Voice loop is now COMPLETE. Fast Brain TTFT is the real-world voice bottleneck. |
| **Section 30** | Relationship to M4 Ambient Surface | **STALE** | Updated: M4 Ambient Surface is now COMPLETE. Provider activity states mapped to Surface presentation. |
| **Section 31** | Architecture Freeze After M2 | **VALID** | Core primitives (`BrainProvider`, `BrainRouter`, `BrainProfilePolicy`, etc.) confirmed as the bedrock. |
| **Section 32** | Current State | **STALE** | Corrected: M0–M4 complete; Pre-M5 F1/F2 sequence active; M5 is next after provider foundation. |
| **Section 33** | Key Decisions Locked | **VALID** | Existing 15 decisions preserved; 10 new canonical decisions locked. |
| **Section 34–35** | Product Vision & Statement | **VALID** | Final architectural statement reaffirmed. |

---

# 2. Core Architectural Principles & Invariants

```text
       ┌─────────────────────────────────────────────────────────────┐
       │                            USER                             │
       └──────────────────────────────┬──────────────────────────────┘
                                      │ interacts with
                                      ▼
       ┌─────────────────────────────────────────────────────────────┐
       │                            MAVE                             │
       │       Unified Identity, Persona, Memory, and Voice          │
       └──────────────────────────────┬──────────────────────────────┘
                                      │ orchestrates
                                      ▼
       ┌─────────────────────────────────────────────────────────────┐
       │             INTELLIGENCE ORCHESTRATION LAYER                │
       │    Truth Policy ──► Profile Policy ──► Router ──► Model     │
       └───────┬──────────────────────┼──────────────────────┬───────┘
               │                      │                      │
               ▼                      ▼                      ▼
       ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
       │ MODEL PROVIDER│      │ AGENT RUNTIME │      │KNOWLEDGE/TRUTH│
       │ Direct Models │      │ Harness/Tools │      │  Data Sources │
       └───────────────┘      └───────────────┘      └───────────────┘
```

1. **MAVE is NOT a vendor brand:** MAVE is neither OpenAI, Anthropic, Google, Gemini, Claude, nor Antigravity. MAVE is the personal intelligence operating layer that coordinates models, agents, tools, knowledge, memory, and desktop presentation.
2. **User interacts with MAVE:** The user addresses MAVE. MAVE decides what kind of intelligence is required, whether fresh facts are needed, which provider and concrete model to call, and how to present the response.
3. **Repository code is the source of truth:** Canonical types reside in `packages/contracts/src/brain.ts`, core logic in `packages/core/src/brain/`, and concrete adapters in `packages/providers/src/brain/`. Class and interface names in documentation must match the implementation.
4. **No marketing model names hard-coded in Core:** Vendor identifiers (`gemini-2.5-flash`, `claude-3-7-sonnet`, `gpt-4o-mini`, etc.) belong strictly in provider adapters, configuration, and model catalogs. `@mave/core` routes using profiles, capabilities, and policies.
5. **Decoupled Thinking vs Facts:** The question "Who should THINK?" is strictly decoupled from "Where do FACTS come from?". The model is a reasoning engine, not an infallible database.
6. **Provider health and model availability are distinct:** A provider adapter may be healthy while one of its underlying models is quota-limited or deprecated.
7. **Task intent preservation during fallback:** Conversational requests must never fall back to heavyweight agent harnesses unless explicitly authorized.

---

# 3. Provider Taxonomy

MAVE defines three first-class, non-interchangeable intelligence categories. They have distinct lifecycles, execution models, token overheads, and permission constraints:

```text
                           Provider Categories
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
   ModelProvider          AgentRuntimeProvider         KnowledgeProvider
 (Direct Model Path)     (Execution Environment)     (Authoritative Truth)
  - Streaming generation   - Multi-step execution      - Real-time web search
  - Low latency            - Planning & workspace      - Project repository
  - Lightweight prompt     - Tool invocation (M5)      - Structured database
  - Normalized deltas      - CLI / Agent harness       - Personal memory store
```

### 3.1 ModelProvider (Direct Model Path)
A `ModelProvider` exposes a direct text/multimodal inference interface to one or more foundation models.
- **Key Responsibilities:**
  - Expose a normalized `ModelCatalog` containing supported models and their capability descriptors.
  - Deliver low-overhead, progressive token/delta streaming via `AsyncIterable<BrainEvent>`.
  - Provide prompt-level cancellation via `AbortSignal`.
  - Report provider-level and model-level health, rate limits, and quota status.
  - Normalize provider-specific requests and responses into canonical MAVE contracts.
  - Supply telemetry: Time-to-First-Token (TTFT), total latency, and token usage.
- **What it does NOT own:**
  - Does NOT own MAVE persona or prompt rules (owned by `@mave/prompts`).
  - Does NOT own session history or multi-turn turns (owned by `@mave/core` `SessionManager`).
  - Does NOT own tool execution permissions (owned by M5 Security Boundary).
  - Does NOT own Surface presentation states (owned by `@mave/core` `SurfaceStateController`).

### 3.2 AgentRuntimeProvider (Execution Environment)
An `AgentRuntimeProvider` wraps an autonomous AI agent harness or CLI execution environment.
- **Key Responsibilities:**
  - Coordinate long-running, multi-step engineering or computer-use tasks.
  - Manage isolated workspace directories and execution environments.
  - Parse structured agent events (step updates, reasoning, plan revisions).
  - Select and utilize provider-supported underlying models.
- **Distinction from Model Provider:**
  - Agent runtimes inject heavy harness prompts, tool schemas, workspace manifests, and planning loops (e.g. Antigravity injects 12k+ tokens on a minimal prompt).
  - Antigravity is an Agent Runtime, **not** a direct Gemini model.
- **Permission Constraint:**
  - Tool execution remains strictly blocked until Milestone 5. An agent runtime may *request* an action, but MAVE's Tool Registry and Permission Policy must arbitrate execution.

### 3.3 KnowledgeProvider / TruthProvider (Authoritative Truth Sources)
A `KnowledgeProvider` retrieves verified, factual context from authoritative sources before reasoning begins.
- **Key Responsibilities:**
  - Fetch real-time external data (web search, weather, financial data, news).
  - Query local personal context (MAVE Memory, SQLite stores, project documents, files).
  - Return structured, citation-grounded context blocks to be injected into the prompt context bundle.
- **What it does NOT do:**
  - Does NOT generate conversational prose or synthesize final user answers (that is delegated to the selected Model Brain).

---

# 4. Multiple Models per Provider & Model Catalog Architecture

One provider family (Google, Anthropic, OpenAI, Local) exposes multiple concrete models with divergent latency, cost, and capability profiles. MAVE must never model a vendor as a single monolithic entity.

```text
Provider Family (e.g., GoogleProvider)
       │
       ▼
Model Catalog (Normalized Registry of ModelDescriptors)
 ├── fast_interactive    (e.g., lightweight flash tier)
 ├── balanced_general    (e.g., standard multimodal tier)
 └── deep_reasoning      (e.g., extended thinking tier)
       │
       ▼
Model Policy Resolution
       │
       ▼
Concrete Vendor Model ID (Adapter-internal)
```

### 4.1 Canonical ModelDescriptor Architecture

Every model exposed by a provider adapter is described by a canonical, typed descriptor:

```ts
export interface ModelDescriptor {
  /** Unique MAVE-normalized stable ModelId (e.g., 'mock-fast-v1', 'openai-fast-primary', 'anthropic-reasoning-primary', 'local-model-offline') */
  readonly id: string;
  /** Owning provider identifier matching BrainProvider.id */
  readonly providerId: string;
  /** Human-readable display name for developer diagnostics */
  readonly displayName: string;
  /** Operational availability status */
  readonly status: 'available' | 'quota_limited' | 'rate_limited' | 'deprecated' | 'unavailable';
  
  /** Qualitative latency classification */
  readonly latencyClass: 'interactive' | 'balanced' | 'heavy';
  /** Qualitative intelligence / quality classification */
  readonly qualityClass: 'fast' | 'balanced' | 'reasoning';
  /** Cost tier classification */
  readonly costClass: 'free' | 'low' | 'medium' | 'high';
  /** Context window capacity class */
  readonly contextClass: 'standard' | 'large' | 'massive';
  /** Exact integer context window token capacity (optional) */
  readonly contextWindowTokens?: number;

  /** Feature capabilities */
  readonly capabilities: BrainCapabilities;

  /** Privacy & data protection class */
  readonly privacyClass: 'local_only' | 'private_cloud' | 'standard_cloud';
}
```

### 4.2 Dynamic Catalog Management & Capability Boundary
- **`ModelCatalogProvider` Capability Interface:** Providers that maintain a dynamic model catalog implement `ModelCatalogProvider`, exposing `getCatalog(): Promise<ModelCatalogSnapshot>` and `getDescriptor(): ProviderDescriptor`.
- **`BrainProvider` Remains Catalog-Free:** The base `BrainProvider` interface is preserved without catalog methods, maintaining 100% backward compatibility with M2/M3/M4 providers (`MockBrainProvider`, `AntigravityBrainProvider`). Callers narrow via `isModelCatalogProvider(provider)`.
- **Single Source of Truth for Models:** `ModelCatalogSnapshot` is the **sole source of truth** for model inventory (`models: ModelDescriptor[]`). `ProviderDescriptor` holds provider-level metadata only (`id`, `kind`, `displayName`, `accessPath`, `capabilities`, `health`, `defaultModelId?`, `documentationUrl?`); it does not duplicate model lists. `defaultModelId` is provider configuration, not catalog inventory.
- **Adapter-Private Concrete Model Identifiers:** Concrete vendor revision strings (e.g., `gpt-4o-2024-08-06`, `claude-3-7-sonnet-20250219`) remain strictly adapter-private configuration details, requiring **zero modifications to `@mave/core` routing logic** when vendor versions rotate.

---

# 5. Canonical Brain Profiles

Brain Profiles describe **what kind of intelligence the task requires**, completely decoupled from vendor identity. MAVE maintains 5 canonical profiles established in Milestone 2:

```text
                               Brain Profiles
                                     │
      ┌──────────────┬───────────────┼───────────────┬──────────────┐
      │              │               │               │              │
      ▼              ▼               ▼               ▼              ▼
fast_conversation deep_reasoning agent_work      research     local_offline
 (Interactive)     (Analytical)   (Execution)   (Grounded)      (Private)
```

### 5.1 `fast_conversation`
- **Primary Use Cases:** Spoken voice turn-taking (Milestone 3), English practice and language tutoring, everyday chit-chat, quick Q&A, and live translation.
- **Priorities:** Ultra-low TTFT, continuous streaming, lightweight input token footprint, bilingual fluency (Thai + English), prompt-level cancellation.
- **Latency UX Targets:**
  - $\text{TTFT} \le 1.0\text{--}3.0\text{ seconds}$
  - Ordinary full response $\le 4.0\text{--}6.0\text{ seconds}$
- **Current Production Status:** **NOT SELECTED / NOT PRODUCTION READY**. (Antigravity is unsuitable due to ~9–10s latency; Mock provider is used for deterministic verification).

### 5.2 `deep_reasoning`
- **Primary Use Cases:** Architectural analysis, code structure review, complex trade-off decisions, deep planning, and multi-factor reasoning.
- **Priorities:** Quality of reasoning and structural correctness over speed.
- **Route Preference:** Direct high-tier ModelProvider (e.g. reasoning model) rather than an agent harness, unless the task explicitly requires workspace file modifications.

### 5.3 `agent_work`
- **Primary Use Cases:** Multi-step repository work, debugging cycles, code generation, file system manipulation, automated test execution, and future desktop actions.
- **Priorities:** Multi-step planning, tool schemas, workspace awareness, error recovery.
- **Current Candidate:** `AntigravityBrainProvider` (`agy` CLI).
- **Security Invariant:** Operating in conversation-only mode; tool execution blocked until Milestone 5.

### 5.4 `research`
- **Primary Use Cases:** Current news, verified technical documentation, time-sensitive facts, multi-source fact checking.
- **Architecture:** Two-stage retrieval-synthesis pipeline. Research does not mean "ask a model's internal memory."

### 5.5 `local_offline`
- **Primary Use Cases:** Air-gapped privacy queries, offline operation, zero-network environments, sensitive personal notes.
- **Security Invariant:** Hard fail-closed constraint. If `local_offline` is requested, cloud providers are forbidden from fallback.

---

# 6. Request Classification & Routing Pipeline

Every incoming user request undergoes a disciplined, multi-stage pipeline:

```text
                           User Request
                                │
                                ▼
                   Stage 1: Intent Understanding
                  (Spoken text, Chat, or Action)
                                │
                                ▼
                 Stage 2: Truth Requirement Check
                ├── Requires authoritative data? ──► Knowledge Provider (Web, DB, Files)
                └── General reasoning?           ──► Pass through verified context
                                │
                                ▼
                 Stage 3: Brain Profile Selection
                     (BrainProfilePolicy)
                Translates intent to BrainProfileId:
                e.g., 'fast_conversation', 'deep_reasoning'
                                │
                                ▼
                 Stage 4: Provider Selection
                        (BrainRouter)
                Matches Profile & Capabilities against
                healthy, registered BrainProviders
                                │
                                ▼
                 Stage 5: Model Selection
                         (ModelPolicy)
                Selects concrete ModelDescriptor within
                the chosen provider
                                │
                                ▼
                 Stage 6: Execution & Streaming
                Emits normalized BrainEvent stream
                                │
                                ▼
                 Stage 7: Presentation Dispatch
                Voice (TTS) / Ambient Surface (Capsule / Card / Panel)
```

---

# 7. Policy Separation: BrainProfilePolicy vs BrainRouter vs ModelPolicy

To prevent overlapping responsibilities and source-of-truth conflicts, MAVE strictly separates the three intelligence selection concerns:

| Component | Question Answered | Inputs | Output |
|---|---|---|---|
| **`BrainProfilePolicy`** | *What kind of intelligence does this task need?* | `BrainProfileId`, caller overrides | `BrainProfileResolution` (required capabilities, latency class, candidate preferences, fallback chain) |
| **`BrainRouter`** | *Which registered provider can fulfill these requirements?* | `BrainProfileResolution`, `BrainProviderRegistry`, provider health | `BrainRouteDecision` (selected `BrainProvider`, fallback flag, route reason) |
| **`ModelPolicy`** | *Which concrete model inside that provider should execute?* | Selected provider, profile, model catalog, user cost/latency preference | Concrete `ModelDescriptor` / model ID |

### 7.1 Architecture of `IntelligenceOrchestrator`
MAVE avoids creating a monolithic "god class" named `IntelligenceOrchestrator`. Instead, orchestration is an **architectural pattern** composed of deterministic, single-responsibility primitives:
- `TruthRequirementPolicy`: Determines if knowledge retrieval is needed.
- `BrainProfilePolicy`: Resolves capability requirements.
- `BrainRouter`: Resolves provider adapter.
- `ModelPolicy`: Resolves concrete model within adapter.
- `ConversationRuntime`: Manages multi-turn turns, session context assembly, timeout enforcement, streaming, and cancellation.

---

# 8. Provider & Model Health Model

Provider health and model availability are decoupled to reflect real-world AI API conditions.

```text
Provider Health Status (Canonical):
  ├── 'healthy'        : Operational and responding to health pings (accepts legacy 'ready')
  ├── 'degraded'       : Elevated latency, secondary fallback active
  ├── 'unhealthy'      : Failing health checks or error state (accepts legacy 'error')
  ├── 'unconfigured'   : Missing credentials, binaries, or prerequisites
  ├── 'quota_limited'  : Account-level quota exhausted
  ├── 'rate_limited'   : Temporary HTTP 429 / concurrency throttle
  ├── 'auth_error'     : Invalid API key or expired token
  └── 'unavailable'    : Service down or network unreachable

Model Availability Status:
  ├── 'available'      : Ready for inference
  ├── 'quota_limited'  : Specific model quota depleted
  ├── 'rate_limited'   : Model-specific rate limit active
  ├── 'deprecated'     : Vendor announced deprecation; replacement mapped
  └── 'unavailable'    : Model temporarily disabled by provider
```

### 8.1 Health Monitoring Principles
- Health checks must be lightweight (e.g. `agy --version`, HTTP endpoint ping) and **must never consume AI generation quota**.
- Router degradation logic:
  1. Healthy primary candidate wins immediately.
  2. Degraded primary is bypassed if a healthy fallback candidate exists.
  3. If all candidates are degraded, the first degraded candidate is used.
  4. Unconfigured, quota-limited, and unhealthy candidates are strictly skipped.

---

# 9. Fallback Architecture & Latency Budgets

Fallback must preserve the user's intent. Uncontrolled fallback creates jarring UX degradation.

```text
                  fast_conversation Request
                             │
                             ▼
                 Primary Fast Model Provider
                             │
                  Fails / Quota / Timeout?
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
   Alternate Fast Provider       Silent Fallback to 10s Agent?
   (Maintains low-latency Voice)   (FORBIDDEN BY POLICY)
              │
    All Fast Providers Down?
              │
              ▼
   Graceful Notification
   "Fast voice brain is currently unavailable."
```

### 9.1 Invariant: No Silent Profile Downgrades
- A 1-second conversational query must **never silently fall back to a 10-second agent harness** like Antigravity.
- If all providers matching the requested `fast_conversation` profile are unavailable, MAVE reports an explicit, normalized error (`fast_brain_unavailable`) rather than freezing the voice loop.

### 9.2 Fallback Chains & Latency Budget
- **Maximum Provider Budget:** At most 2 distinct provider attempts (`providerAttempts <= 2`) per conversational turn.
- **Atomic Route Attempt vs Provider Limit:** The 2-provider limit is distinct from atomic model route attempts: fallback within the same provider (Model 1 $\to$ Model 2) consumes route attempts without incrementing distinct provider attempts.
- **Voice Mode Fallback Latency Budget:** Cumulative fallback routing must not exceed $4.0\text{ seconds}$.
- **Fallback Chain Resolution:**
  $$\text{Provider A (Model 1)} \longrightarrow \text{Provider A (Model 2)} \longrightarrow \text{Provider B (Model 1)} \longrightarrow \text{Graceful Error}$$

---

# 10. Timeout, Cancellation & Streaming Contracts

### 10.1 Timeout Model
Different profiles operate under distinct timeout expectations enforced by `ConversationRuntime`:
- `fast_conversation`: $10\text{ seconds}$ default timeout.
- `deep_reasoning`: $45\text{--}60\text{ seconds}$ timeout.
- `agent_work`: Task-level heartbeat and progress monitoring rather than a rigid HTTP timeout.
- `research`: $15\text{ seconds}$ retrieval budget + $30\text{ seconds}$ synthesis budget.

### 10.2 Cancellation Contract
- Cancellation is universal across all providers via `AbortSignal` and optional `BrainProvider.cancel(requestId)`.
- When user speech is detected during assistant playback (barge-in), `VoiceSessionCoordinator` triggers barge-in, aborting the active generation immediately and truncating downstream TTS chunking.

### 10.3 Streaming Normalization
The core runtime accepts only canonical `BrainEvent` sequences:
- `started`: Generation commenced with provider and timestamp metadata.
- `delta`: Incremental text chunk emitted for progressive display and TTS chunking.
- `completed`: Full text assembled, token usage metadata, and finish reason.
- `cancelled`: Clean cancellation acknowledgement.
- `error`: Normalized `BrainError` with code and retryable flag.

Provider adapters normalize vendor-specific streaming protocols (SSE, NDJSON, WebSockets) into this canonical contract.

---

# 11. Telemetry, Usage Metrics & Developer Diagnostics

Production surfaces (Capsule, Quick Info card) remain MAVE-branded and uncluttered. Rich provider telemetry is routed exclusively to Developer Diagnostics:

```ts
export interface GenerationUsage {
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
  readonly estimatedCostUsd?: number;
}

export interface GenerationTiming {
  readonly timeToFirstTokenMs?: number;
  readonly totalDurationMs?: number;
}

export interface RouteTelemetry {
  readonly selectedProviderId: string;
  readonly selectedModelId?: string;
  readonly profileId?: BrainProfileId;
  readonly routeReason?: RouteReason | string;
  readonly fallbackUsed: boolean;
  readonly attemptedProviderIds: string[];
  readonly attemptedModelIds: string[];
  readonly routeAttempts: number;
}

export interface BrainTelemetry {
  readonly requestId: string;
  readonly sessionId: string;
  readonly route: RouteTelemetry;
  readonly timing?: GenerationTiming;
  readonly usage?: GenerationUsage;
  readonly finishReason?: string;
}
```

---

# 12. User Overrides & Precedence Hierarchy

While MAVE routes automatically by default, power users and developers may set explicit overrides in settings or developer chat:

```text
                          PREVALENCE HIERARCHY
                          
     1. Privacy Policy (Strict Fail-Closed Constraint)
        └── BrainRequest.localOnly is the canonical privacy constraint.
        └── If effectiveLocalOnly=true, cloud providers are STRICTLY FORBIDDEN.
        
     2. Security & Capability Requirements
        └── Cannot route to a provider missing required capabilities.
        
     3. Explicit Caller Override (User Setting / Developer Chat)
        └── Preferred Provider ID / Specific Model ID / Route Overrides.
        
     4. Profile Policy Mapping
        └── Configured profile-to-provider mappings.
        
     5. Automatic Default Routing
        └── Health-checked primary candidate with fallback.
```

- **Fail-Closed Privacy Invariant:** Canonical privacy is defined on `BrainRequest.localOnly`. Under `resolveEffectiveLocalOnly(request)`, if either `request.localOnly === true` OR `overrides.localOnly === true`, execution strictly remains `localOnly=true`. An override of `localOnly=false` can **never** weaken or cancel an active privacy constraint.
- **Unavailable Override Handling:** If a user explicitly requests an unavailable model or provider, MAVE **does not silently substitute an unrelated provider**. It reports the issue and requests guidance or provides a clear override error.

---

# 13. MAVE Identity, Prompt Architecture & Session Continuity

Switching AI providers between turns must not disrupt the assistant's persona or memory.

```text
               Prompt Assembly (ContextManager & @mave/prompts)
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 1. MAVE Master Identity (Name, demeanor, voice, boundaries)            │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 2. Interaction Mode Rules (Voice briefness, Tutor mode, Markdown safe) │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 3. Context Bundle (Authoritative truth, Memory, Project metadata)      │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 4. Multi-turn Session History (Canonical turns from SessionManager)    │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 5. Provider-Specific Adapter Framing (System/User/Assistant packing)   │
 └────────────────────────────────────────────────────────────────────────┘
```

- **Canonical Session Ownership:** `SessionManager` and `SQLiteConversationStore` are the single source of truth for conversation turns. Provider-native conversation IDs are transient adapter details.
- **Turn-by-Turn Provider Switching:** Turn 1 may execute on Fast Brain A, and Turn 2 on Deep Brain B. Both turns persist into the identical MAVE session.

---

# 14. Voice & Ambient Surface Integration (Milestones 3 & 4 Alignment)

### 14.1 Milestone 3 Spoken Voice Loop
The Voice Subsystem is fully implemented and operational:
$$\text{Wake Detection} \longrightarrow \text{Audio Capture} \longrightarrow \text{faster-whisper STT} \longrightarrow \text{ConversationRuntime} \longrightarrow \text{StreamingTextChunker} \longrightarrow \text{EdgeTTS} \longrightarrow \text{Audio Output}$$

- **Current Voice Bottleneck:** Antigravity CLI introduces ~9–10 seconds TTFT, making natural spoken conversation sluggish.
- **The F1 Objective:** Deliver a direct `ModelProvider` capable of $\text{TTFT} \le 1.0\text{--}3.0\text{s}$ to enable seamless voice turn-taking.

### 14.2 Milestone 4 Ambient Adaptive Surface
The Ambient Surface dynamically reflects MAVE's activity:
- `sleeping` / `listening` / `thinking` / `speaking`: Expressed via `PresenceMark` RMS audio reactivity.
- `Quick Info card`: Renders short conversational responses ($360\times 180\text{ DIP}$).
- `Expanded Context panel`: Renders structured markdown, code blocks, and source citations ($440\times 580\text{ DIP}$).
- Provider marketing brands are **strictly omitted** from the ambient UI, appearing only in Developer Diagnostics.

---

# 15. Milestone 5 Tools, Permissions & Security Boundary

Milestone 5 will introduce the Execution Engine. The intelligence layer respects this strict boundary:

```text
                   AI Model / Agent Runtime
                             │
                             ▼
                    Requests Tool Action
             (e.g., readFile, gitCommit, terminal)
                             │
                             ▼
                  MAVE Tool Registry (M5)
                             │
                             ▼
                   Risk Classification
                             │
                             ▼
                   Permission Policy (M5)
                   ├── Read-only / Low-risk ──► Auto-approve (if configured)
                   └── Mutation / High-risk ──► Surface Approval Modal
                             │
                             ▼
                    Execution Sandbox (M5)
                             │
                             ▼
                      Verified Result
                             │
                             ▼
                    Returned to Brain
```

- In Pre-M5 (F1/F2), all tool execution attempts by providers are intercepted and terminated.
- Intelligence providers **never receive raw OS execution authority**.

---

# 16. Antigravity Safety Position & Current Role

- **Status in Pre-M5:**
  - Conversational streaming response: **WORKING**
  - Prompt cancellation: **WORKING**
  - Multi-turn context preservation: **WORKING**
  - Zero-credential subscription re-use via `agy` CLI: **WORKING**
  - Tool execution: **STRICTLY BLOCKED**
- **Canonical Role:** Antigravity is classified as an **`AgentRuntimeProvider`** candidate for `agent_work`. It is formally retired from consideration as the default `fast_conversation` brain due to architectural harness overhead (~12k tokens, ~9–10s TTFT).

---

# 17. Provider & Model Selection Criteria

### 17.1 Fast Brain Criteria (Selection Deferred to F1.5 / F2)
1. Official API or supported CLI integration (no scrapers or reverse-engineered tokens).
2. Ultra-low latency: TTFT target $\le 1.0\text{--}3.0\text{ seconds}$.
3. Progressive text streaming with early sentence boundary emission.
4. Clean cancellation under barge-in interruptions.
5. High Thai and English conversational fluency and natural language tutoring capability.
6. Predictable quota and rate-limiting behavior.
7. Text-only lightweight mode with minimal system prompt overhead.
8. Zero vendor lock-in in `@mave/core`.

### 17.2 Deep Brain Criteria (Selection Deferred to F1.6 / F2)
1. Superior complex reasoning, coding logic, and structural analysis.
2. Extended context window support.
3. Stable structured JSON / schema output.
4. Reliable prompt cancellation.
5. Official direct API access.

### 17.3 Local Model Criteria
1. Air-gapped execution with zero network transmission.
2. Hardware awareness (CPU/GPU memory bounds).
3. Graceful degradation on resource constraints.

> [!IMPORTANT]
> **No Model Winner Declared in F1.0**: F1.0 establishes the architecture only. No specific vendor (OpenAI, Anthropic, Google, local model) is declared as the winner without rigorous benchmark evidence in later phases.

---

# 18. Provider Evaluation Matrix & Benchmark Methodology

In subsequent phases (F1.5, F1.6, F2), prospective providers will be evaluated using a structured comparison matrix:

| Evaluation Metric | Description | Target / Measurement Unit |
|---|---|---|
| **TTFT** | Time from request dispatch to first emitted token | Milliseconds (Target: $\le 1500\text{ms}$) |
| **Total Latency** | Full response completion for 100-word turn | Seconds (Target: $\le 4.0\text{s}$) |
| **Thai Conversational Naturalness** | Colloquial fluency, particle usage, tone | Qualitative score (1–5) |
| **English Tutoring Quality** | Grammar correction, vocabulary explanation | Qualitative score (1–5) |
| **Streaming Chunk Cadence** | Smoothness and size of streamed text deltas | Average delta character length |
| **Barge-in Cancellation Speed** | Time from abort signal to process termination | Milliseconds (Target: $\le 200\text{ms}$) |
| **Context Overhead** | Provider-injected tokens before user message | Token count (Target: $\le 500$ tokens) |
| **Cost / Quota Predictability** | Stability under sustained conversational turns | Rate-limit error frequency |

### 18.1 Benchmark Test Battery
Evaluation requires repeatable automated benchmarks across standard test batteries:
1. `thai_greeting`: Short colloquial Thai greeting ("สวัสดี MAVE วันนี้เหนื่อยจัง").
2. `english_grammar_tutoring`: Language correction ("He go to school yesterday, is it correct?").
3. `quick_translation`: Idiomatic translation ("I feel under the weather แปลว่าอะไร").
4. `short_explanation`: Concise technical concept ("อธิบาย async/await สั้นๆ").
5. `deep_architecture_reasoning`: Complex system design comparison.
6. `cancellation_responsiveness`: Barge-in trigger after 3 chunks streamed.

---

# 19. Concrete Routing Scenarios

```text
Scenario A: Spoken Everyday Greeting
  User: "สวัสดี MAVE"
  Intent: Casual greeting / Voice turn
  Truth Check: None needed
  Brain Profile: 'fast_conversation'
  Provider: Direct ModelProvider (Fast tier)
  Target TTFT: < 2.0s
  Surface: Compact Quick Info Card / Voice Capsule

Scenario B: Language Practice
  User: "ช่วยอธิบายความแตกต่างระหว่าง Present Perfect กับ Past Simple หน่อย"
  Intent: English tutoring
  Truth Check: Stable linguistic knowledge
  Brain Profile: 'fast_conversation'
  Provider: Direct ModelProvider (Fast tier)
  Surface: Quick Info Card with progressive speech

Scenario C: Complex Architecture Evaluation
  User: "ช่วยวิเคราะห์ architecture decoupling ระหว่าง BrainRouter และ ModelPolicy อย่างละเอียด"
  Intent: Deep analytical reasoning
  Truth Check: Local architecture documentation
  Brain Profile: 'deep_reasoning'
  Provider: Direct ModelProvider (Reasoning tier)
  Surface: Expanded Context Panel with syntax highlighting

Scenario D: Multi-Step Repository Coding
  User: "เข้า repo นี้แล้วแก้ unit test ที่พังใน packages/core ให้ผ่านทั้งหมด"
  Intent: Repository modification & testing
  Truth Check: Repository files & test runner output
  Brain Profile: 'agent_work'
  Provider: AntigravityBrainProvider (Agent Runtime)
  M5 Boundary: Tool execution requests intercepted and presented for approval

Scenario E: Time-Sensitive News / Current Events
  User: "วันนี้ NVIDIA มีข่าวอะไรสำคัญบ้าง"
  Intent: Current event query
  Truth Check: REQUIRED (Current time-sensitive data)
  Pipeline: KnowledgeProvider (Web search) retrieves articles ──► BrainProfile ('research') ──► Grounded response with citations
  Surface: Expanded Context Panel with clickable source cards

Scenario F: Air-Gapped Privacy Query
  User: "บันทึกข้อมูลนี้ลง local เท่านั้น ห้ามส่งออกอินเทอร์เน็ต"
  Intent: Private personal note
  Truth Check: Local memory store
  Brain Profile: 'local_offline'
  Constraint: local_only=true
  Provider: LocalModelProvider (Fail-closed: cloud fallback strictly forbidden)
```

---

# 20. Error Taxonomy & Graceful Degradation

MAVE standardizes intelligence errors to prevent raw stack traces from reaching the user. Canonical emitted error codes are strictly **lowercase snake_case**:

```ts
export type CanonicalBrainErrorCode =
  // M2 foundational codes
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'provider_auth'
  | 'provider_limit'
  | 'provider_invalid_response'
  | 'cancelled'
  | 'runtime_error'
  // Pre-M5 normalized codes
  | 'fast_brain_unavailable'
  | 'profile_unavailable'
  | 'model_unavailable'
  | 'provider_unconfigured'
  | 'quota_limited'
  | 'rate_limited'
  | 'auth_required'
  | 'local_provider_unavailable'
  | 'routing_timeout'
  | 'generation_cancelled';
```

*(Note: Legacy uppercase strings such as `'FAST_BRAIN_UNAVAILABLE'` or `'QUOTA_LIMITED'` are accepted during parsing for compatibility and automatically normalized to lowercase).*

### 20.1 Fail-Closed vs Fail-Open Policies
- **Privacy Constraints:** **FAIL CLOSED**. If local-only operation is requested and no local provider is available, MAVE aborts the request and alerts the user (`local_provider_unavailable`). Cloud fallback is never attempted.
- **Fast Brain Availability:** **FALLBACK WITHIN PROFILE**. If primary fast provider is down, alternate fast provider is tried. If none exist, fail gracefully with voice feedback (`fast_brain_unavailable`).
- **Explicit Override:** **FAIL CLOSED TO USER CONFIRMATION**. If a user explicitly requested provider X and it is offline, MAVE alerts the user rather than silently switching to provider Y.

---

# 21. Implementation Roadmap: Pre-M5 F1 Program

The Pre-M5 intelligence foundation is divided into ten disciplined phases:

```text
 F1.0 ──► F1.1 ──► F1.2 ──► F1.3 ──► F1.4 ──► F1.5 ──► F1.6 ──► F1.7 ──► F1.8 ──► F1.9 ──► F1.10
 Audit   Contracts Registry Catalog Routing  Fast    Deep   Agent   Truth   Diag   Closeout
 (Now)                                       Brain   Brain  Runtime
```

### Phase F1.0 — Architecture Audit & Modernization ✅ COMPLETE
- **Goal:** Modernize `MAVE_INTELLIGENCE_PROVIDER_ARCHITECTURE.md` into the canonical post-M4 architecture.
- **Scope:** Complete architectural documentation, taxonomy, catalog design, routing pipeline, and audit. Zero runtime code changes.

### Phase F1.1 — Provider & Model Contracts ✅ COMPLETE
- **Goal:** Codify the F1.0 architecture into stable, typed, vendor-neutral contracts and Zod schemas in `@mave/contracts`.
- **Scope:** `ProviderKind`, `ProviderDescriptor`, `ModelDescriptor`, `ModelCatalogSnapshot`, `BrainCapabilities`, `BrainTelemetry`, `RouteTelemetry`, `GenerationUsage`, `GenerationTiming`, and normalized error codes. 100% test pass rate with full backward compatibility.

### Phase F1.2 — Provider Registry & Health Hardening ✅ COMPLETE
- **Goal:** Turn `BrainProviderRegistry` into a hardened, race-safe runtime registry supporting dynamic registration with canonical IDs, metadata authority enforcement, explicit replacement, safe unregistration, provider descriptors, non-quota health probing, single-flight probe coordination, sanitized error normalization, and immutable snapshots.
- **Scope:** Hardened `BrainProviderRegistry`, canonical ID validation (no whitespace mutation), metadata authority boundary, unprobed provider health absence (`getDescriptor` returns `undefined` without fabricating fake statuses), revision guards against stale probe results, single-flight deduplication, sanitized timeout and throw normalization, in-memory TTL health caching, dynamic `ProviderDescriptor` synthesis with dynamic health hydration, and JSON-safe `ProviderRegistrySnapshot`. 100% test pass rate with zero M2/M3/M4 regressions.

### Phase F1.3 — Model Catalog & Model Policy Runtime ✅ COMPLETE
- **Goal:** Implement MAVE's canonical model inventory runtime (`ModelCatalogRuntime`) and deterministic model-selection policy (`ModelPolicy`) inside an already chosen provider.
- **Scope:** Dynamic catalog retrieval via `ModelCatalogProvider`, canonical schema validation, unique `ModelId` enforcement, registered provider identity invariant (`registry provider.id === snapshot.providerId === model.providerId`), bounded metadata timeout (default 5000ms), in-memory TTL caching (default 60000ms), explicit refresh, invalidation, single-flight concurrent fetch deduplication, stale-result protection against concurrent unregister and replacement, deep-cloned JSON-safe immutability, zero text generation during discovery, pure synchronous `ModelPolicy` with hard constraint filtering (fail-closed `local_only` privacy, availability status, required capabilities, max cost/latency limits, context capacity), explicit `preferredModelId` with `allowFallback` semantics, profile-based quality class ranking, defaultModelId preference, and deterministic lexical tie-breaking. 100% test pass rate with zero regressions.

### Phase F1.4 — Intelligence Routing & Intent-Preserving Fallback ← NEXT
- **Goal:** Upgrade `BrainRouter` to support two-stage routing (Provider $\to$ Model), fallback budgets, and strict fail-closed privacy constraints.
- **Scope:** Routing algorithms, fallback limits, unit tests.

### Phase F1.5 — Production Fast Brain Integration
- **Goal:** Implement the first official direct `ModelProvider` optimized for low-latency conversational voice.
- **Scope:** Streaming delta adapter, prompt cancellation, TTFT measurement, voice loop integration.

### Phase F1.6 — Production Deep Brain Integration
- **Goal:** Implement direct high-reasoning `ModelProvider` route for complex analysis.
- **Scope:** Structured output, long context handling, reasoning telemetry.

### Phase F1.7 — Agent Runtime Normalization
- **Goal:** Standardize `AntigravityBrainProvider` into canonical `AgentRuntimeProvider` taxonomy while maintaining the M5 tool block.
- **Scope:** Workspace encapsulation, event normalization, CLI supervisor.

### Phase F1.8 — Research & Truth Routing Foundation
- **Goal:** Implement `TruthRequirementPolicy` and decoupled knowledge context injection.
- **Scope:** Retrieval hooks, context bundle decoration, citation format.

### Phase F1.9 — Diagnostics, Quota Telemetry & Reliability
- **Goal:** Expose provider health, latency, token usage, and quota states via typed IPC to Developer Diagnostics.
- **Scope:** Telemetry persistence, IPC events, diagnostics UI integration.

### Phase F1.10 — End-to-End Provider Foundation Closeout
- **Goal:** Finalize verification across voice, ambient surface, text chat, and fallback scenarios.
- **Scope:** Full test pass baseline, performance benchmarks, and milestone closeout documentation.

### 21.1 Pre-M5 F1.1 Contract Decisions & Typings

1. **Fallback Terminology Clarification:**
   - **`routeAttempt`**: An atomic invocation of a specific `(ProviderId, ModelId)` pair.
   - **`providerAttempts`**: The distinct count/list of provider adapters contacted (`attemptedProviderIds: string[]`).
   - **`modelAttempts`**: The distinct count/list of models contacted (`attemptedModelIds: string[]`).
   - In F1.4 routing algorithms, max 2 distinct providers contacted corresponds to `attemptedProviderIds.length <= 2`, while total atomic route attempts across primary and fallback models is capped by policy.
2. **Provider Taxonomy:**
   - Strongly typed `ProviderKind` (`model_provider`, `agent_runtime_provider`, `knowledge_provider`). No vendor brands in taxonomy enum.
3. **Decoupled Health & Readiness (Single Source of Truth):**
   - Canonical `ProviderHealth.status: 'healthy' | 'degraded' | 'unhealthy' | 'unconfigured' | 'quota_limited' | 'rate_limited' | 'auth_error' | 'unavailable'`.
   - Legacy aliases (`ready` -> `healthy`, `error` -> `unhealthy`) are normalized automatically via `ProviderHealthStatusSchema` and `normalizeProviderHealthStatus`.
   - Decoupled `ModelAvailabilityStatus` (`available`, `quota_limited`, `rate_limited`, `deprecated`, `unavailable`).
4. **ModelId Semantics (Core Decoupled from Vendor Marketing):**
   - `ModelId` represents a **MAVE-normalized stable model identifier** (e.g. `openai-fast-primary`, `anthropic-reasoning-primary`, `local-llama-offline`, `mock-fast-v1`).
   - Concrete vendor marketing names (e.g. `gpt-4o-2024-08-06`, `claude-3-7-sonnet-20250219`) are adapter-private configuration details, strictly forbidden from being hardcoded into `@mave/core`.
5. **Catalog Exposure Strategy (Clean Capability Boundary):**
   - Base `BrainProvider` remains 100% backward-compatible with M2 (`id`, `getCapabilities()`, `health()`, `chat()`, `cancel?()`).
   - Catalog-capable providers implement the `ModelCatalogProvider` capability interface (`getCatalog()`, `getDescriptor()`).
   - Consumers narrow capability cleanly using `isModelCatalogProvider(provider)` type-guard.
6. **ProviderDescriptor vs ModelCatalogSnapshot (Single Source of Truth):**
   - `ProviderDescriptor`: Exclusively provider-level metadata (`id`, `kind`, `displayName`, `accessPath`, `capabilities`, `health`, `defaultModelId?`, `documentationUrl?`). Does NOT maintain duplicate model lists.
   - `ModelCatalogSnapshot`: Canonical single source of truth for the model inventory (`models: ModelDescriptor[]`).
7. **Local Privacy Enforcement & Fail-Closed Invariant:**
   - Canonical privacy constraint lives on `BrainRequest.localOnly: boolean`.
   - `resolveEffectiveLocalOnly(request)` enforces the security invariant: routing overrides can NEVER weaken `request.localOnly === true`. If either request or override specifies `localOnly=true`, execution strictly fails closed if no qualified local model exists.
8. **Model QualityClass Semantic Roles:**
   - `ModelQualityClass`: `'fast' | 'balanced' | 'reasoning'`. Differentiated from `BrainProfileId`.
   - `fast`: Ultra-low latency conversational flow.
   - `balanced`: General-purpose interactive analysis.
   - `reasoning`: Deep multi-factor chain-of-thought analysis.
   - Marketing terms like `frontier` or `pro` are rejected.
9. **Model ContextClass vs Numeric Limits:**
   - `ModelContextClass` (`standard`, `large`, `massive`): Qualitative tier for fast router rule matching.
   - `contextWindowTokens`: Exact integer context window token limit for prompt packing, sliding window truncation, and generation budgeting.
10. **PrivacyClass Non-Contractual Tiers:**
    - Canonical `ModelPrivacyClass`: `'local_only' | 'private_cloud' | 'standard_cloud'`.
    - `local_only`: On-device execution, zero external network traffic.
    - `private_cloud`: Cloud-hosted with verified enterprise/private zero-data-retention configuration.
    - `standard_cloud`: Standard cloud provider API with default data processing policy.
    - Legacy aliases (`local_airgapped` -> `local_only`, `public_cloud` -> `standard_cloud`) are normalized automatically.
11. **Intelligence Error Normalization:**
    - Canonical emitted error codes are strictly lowercase snake_case (`fast_brain_unavailable`, `model_unavailable`, `quota_limited`, etc.).
    - Legacy uppercase strings normalize deterministically via `BrainErrorCodeSchema` and `normalizeBrainErrorCode`.
12. **Telemetry Separation:**
    - Decoupled into `GenerationUsage` (tokens, cost), `GenerationTiming` (TTFT, total latency), and `RouteTelemetry` (selected provider/model, route reason, attempts, fallback flags).

### 21.2 Phase F1.2 Implemented Runtime Architecture (Provider Registry & Health Hardening)

1. **Strict Canonical Identity Enforcement & No Silent Mutation:**
   - Provider identity must be canonical (`id === id.trim() && id.length > 0`). Registration (`register`) and replacement (`replace`) reject leading/trailing whitespace by throwing `BrainRegistryError('invalid_provider_id')` without silent mutation.
   - Rejects duplicate IDs by throwing `BrainRegistryError('duplicate_provider')` to eliminate silent overwriting.
   - `replace(provider, metadata?)`: Explicit replacement mechanism requiring conscious caller intent. Validates canonical identity, increments internal entry revision, and invalidates cached health.
   - `unregister(providerId)`: Safely removes provider from lookup and enumeration; deletes cached health; returns `boolean`.
   - `require(providerId)`: Deterministically retrieves provider or throws `BrainRegistryError('provider_not_found')`.
   - `list()`: Returns all registered provider instances in deterministic insertion order (shallow array copy).
2. **Metadata Authority Boundary & Descriptor ID Invariant:**
   - Registration metadata hints display/configuration only (`kind`, `displayName`, `accessPath`, `defaultModelId`, `documentationUrl`).
   - Metadata `id` must match `provider.id` or throw `invalid_provider_id`. Metadata cannot override `id`, `health`, or `capabilities`.
   - Invariant: `registry ProviderId === BrainProvider.id === ProviderDescriptor.id`. If a `ModelCatalogProvider` returns a descriptor with a mismatched ID, it is rejected with `invalid_provider_id`.
3. **Strict Quota-Free Health Probing Invariant:**
   - Provider health checks must NEVER invoke text generation, prompt completion, agent task loops, or tool execution.
   - Probes must remain lightweight and fast (e.g. `agy --version`, deterministic mock status, process heartbeat).
4. **Single-Flight Concurrency & Deduplication:**
   - Concurrent calls to `refreshHealth(providerId)` share the active in-flight `Promise`, preventing duplicate process spawns or redundant probe calls.
5. **Stale-Result Rejection & Revision Token Guard:**
   - Every provider registration/replacement tracks an incremental `revision` token.
   - If a provider is replaced or unregistered while a probe is in flight, the probe completion detects the revision mismatch or missing entry and strictly discards the result, preventing health state resurrection.
6. **Sanitized Health Error & Timeout Normalization:**
   - Probes execute under a strict timeout (default 5000ms via `healthTimeoutMs`). Timed-out probes normalize deterministically to `status: 'unavailable'` with message `'Provider health check timed out.'`.
   - Thrown probe exceptions are caught and converted into canonical `ProviderHealth` with `status: 'unavailable'` and sanitized message `'Provider health check failed.'`, preventing internal filesystem paths, credentials, command arguments, or stack traces from leaking into diagnostics or IPC.
   - Legacy statuses (`ready`, `error`) are normalized to canonical enums (`healthy`, `unhealthy`).
7. **In-Memory TTL Caching & Unprobed State Absence:**
   - In-memory cache stores normalized health with configurable TTL (default 15000ms via `defaultHealthTtlMs`).
   - Prior to the first probe, `getHealth(providerId)` returns `undefined` (unknown = absence of health state).
   - `getDescriptor(providerId)` returns `undefined` before probe, eliminating false `unconfigured` or `unavailable` statuses. Static metadata is accessible synchronously via `getProviderMetadata(providerId)`, and fully hydrated descriptors via `resolveDescriptor(providerId)`.
8. **Immutable & Serializable Registry Snapshots:**
   - `getSnapshot(): ProviderRegistrySnapshot` returns deep-cloned, frozen, JSON-safe snapshots (`providers: readonly ProviderDescriptor[]`, `health: Record<string, ProviderHealth>`, `generatedAt: number`).
   - Only includes descriptors and health for providers with actual probed health.
   - Guarantees zero sensitive internal exception text, no raw class instances, and isolated clones immune to external caller mutation.

### 21.3 Phase F1.3 Implemented Runtime Architecture (Model Catalog & Model Policy Runtime)

1. **Separation of Concerns & Capability Boundary:**
   - `BrainProviderRegistry` owns provider instances and operational health.
   - `ModelCatalogRuntime` owns model inventory snapshots, TTL caching, discovery, and concurrency control.
   - `ModelPolicy` owns deterministic model selection rules given an already chosen provider.
   - Only providers implementing the `ModelCatalogProvider` capability interface (`isModelCatalogProvider`) support catalog retrieval. Providers without catalog support (e.g. `AntigravityBrainProvider` agent runtime) reject cleanly with `ModelCatalogError('catalog_not_supported')` without fabricating fake models.

2. **Metadata-Only Discovery & Zero Generation Overhead:**
   - `ModelCatalogRuntime.getCatalog()` invokes exclusively `provider.getCatalog()`.
   - Never calls `chat()`, never generates tokens, never consumes model quota, and never runs tools.

3. **Schema Validation, Duplicate Rejection & Provider Identity Invariant:**
   - Every raw catalog response is validated against canonical `ModelCatalogSnapshotSchema`.
   - Invariant enforced: `registry provider.id === snapshot.providerId === every ModelDescriptor.providerId`.
   - Duplicate `ModelId`s within a catalog are strictly rejected with `ModelCatalogError('catalog_invalid')`.

4. **In-Memory TTL Caching, Invalidation & Single-Flight Concurrency:**
   - Configurable in-memory cache TTL (default 60000ms via `defaultCatalogTtlMs`).
   - Synchronous inspection via `getCachedCatalog(providerId)` and `hasCatalog(providerId)`.
   - Explicit invalidation via `invalidateCatalog(providerId?)` and `clearCatalogCache()`.
   - Concurrent calls to `refreshCatalog(providerId)` are single-flighted, sharing the active in-flight `Promise`.
   - Cached catalog entries are bound to both the provider instance reference AND the registry lifecycle token (`getLifecycleToken()`). Any unregister, replace, or re-registration immediately invalidates cached catalog inventory even within the active TTL window and even if the identical JavaScript instance reference is re-registered.

5. **Sanitized Error Normalization & Bounded Timeout:**
   - Bounded metadata timeout (default 5000ms via `catalogTimeoutMs`). Timed-out requests throw `ModelCatalogError('catalog_timeout', 'Model catalog fetch timed out.')`.
   - Thrown provider errors normalize to `ModelCatalogError('catalog_unavailable', 'Model catalog fetch failed.')`. Schema validation errors normalize to `ModelCatalogError('catalog_invalid', "Model catalog for provider '<id>' returned malformed data.")`.
   - Guaranteed sanitization: raw vendor payloads, API keys (`API_KEY=...`), bearer tokens, and internal filesystem paths never leak into error messages, stack traces, or diagnostics.

6. **Stale-Result Protection Against Concurrency Races:**
   - If a provider is unregistered during fetch, the result is discarded and `ModelCatalogError('provider_not_found')` is thrown.
   - If a provider is replaced during fetch, the older instance's completed catalog is not cached for the replacement instance.
   - `getCachedCatalog` and `getCatalog` perform active lifecycle token verification against the registry on every cache access, automatically evicting stale cached entries if the provider was unregistered, replaced, or re-registered.

7. **Deep Immutability & JSON Safety:**
   - Snapshots returned by `ModelCatalogRuntime` are deep-cloned and frozen (`Object.freeze`) across all nested model descriptors and capability maps.
   - Entirely JSON-serializable without Map, Set, functions, or Error objects.

8. **Pure Synchronous Model Selection Policy (`ModelPolicy`):**
   - Pure, synchronous selection: consumes already-resolved data; makes zero I/O, network, or provider calls.
   - **Hard Constraint Filtering:**
     - **Privacy Fail-Closed:** `effectiveLocalOnly` is strictly fail-closed: resolved as `criteria.effectiveLocalOnly === true || criteria.overrides?.localOnly === true`. A `false` value in overrides or criteria cannot weaken a `true` value. If `effectiveLocalOnly = true`, models with `privacyClass !== 'local_only'` are strictly excluded. If no local model is available, selection fails closed.
     - **Operational Availability:** Only models with `status === 'available'` are eligible. `quota_limited`, `rate_limited`, `deprecated`, and `unavailable` are rejected.
     - **Required Capabilities:** Models must satisfy all required capabilities (`streaming`, `reasoning`, `coding`, `vision`, etc.). For optional language capabilities (`supportsThai`, `supportsEnglish`), `false` is rejected, `undefined` is permissive unless `strictLanguageCheck: true`.
     - **Cost & Latency Limits:** `maxCostClass` (`free < low < medium < high`) and `maxLatencyClass` (`interactive < balanced < heavy`) filter out non-compliant tiers.
     - **Context Capacity:** `requiredContextClass` and `requiredContextTokens` filter insufficient windows. When `requiredContextTokens` is specified, models with `contextWindowTokens === undefined` are rejected with `context_tokens_unknown`, enforcing fail-closed token capacity.
   - **Explicit Override Precedence & Strict Fallback Defaults:**
     - `preferredModelId` selects the preferred model immediately if valid and eligible.
     - If `preferredModelId` is specified and `allowFallback` is undefined, the default is STRICT (`allowFallback = false`), preventing silent drift to unintended models.
     - Fallback to general policy selection ONLY occurs when explicitly permitted (`allowFallback: true` at criteria level or resolved profile level).
     - If preferred model is missing or ineligible: fails closed if `allowFallback === false`; falls back to general policy selection if `allowFallback === true`.
   - **Deterministic Lexicographic Ranking:**
     - Profile Quality Class rank:
       - `fast_conversation`: fast + interactive (0) $\to$ fast (1) $\to$ balanced + interactive (2) $\to$ balanced (3) $\to$ reasoning (4)
       - `deep_reasoning`: reasoning (0) $\to$ balanced (1) $\to$ fast (2)
       - `research`: balanced (0) $\to$ reasoning (1) $\to$ fast (2)
       - `local_offline`: fast (0) $\to$ balanced (1) $\to$ reasoning (2)
       - `agent_work`: balanced (0) $\to$ reasoning (1) $\to$ fast (2)
     - Provider default model preference: `defaultModelId` gets priority over non-defaults.
     - Latency class preference: interactive $\to$ balanced $\to$ heavy.
     - Cost class preference: free $\to$ low $\to$ medium $\to$ high.
     - Stable Tie-breaker: lexicographic `model.id.localeCompare()`. Zero magic scores or arbitrary weights.
   - **Rejection Diagnostics:**
     - Typed, structured diagnostic rejection reasons recorded per model without exposing prompts or credentials.

### 21.4 Phase F1.4 Implemented Runtime Architecture (Intelligence Routing & Fallback Pipeline)

1. **Two-Stage Deterministic Routing Architecture:**
   - **Stage A: Provider Selection & Health Eligibility:**
     - Builds candidate pool in deterministic priority order: (1) explicit caller `preferredProviderId`, (2) requested or default provider (`defaultProvider`), (3) configured fallback chain (`fallbackChain`), and (4) remaining registered providers in stable lexicographical order if `allowFallback === true`.
     - Probes unprobed candidates on demand via `BrainProviderRegistry.health(id)` without redundant probes for already cached health.
     - Automatically skips unusable candidate providers with status `unhealthy`, `unconfigured`, `quota_limited`, `rate_limited`, `auth_error`, or `unavailable`.
     - Enforces deterministic Health Degradation Ordering: Healthy Primary $\to$ Healthy Fallback $\to$ Degraded Primary $\to$ Degraded Fallback. Degraded candidates are used strictly as a last resort when no healthy candidate is available.
   - **Stage B: Model Catalog Retrieval & Deterministic ModelPolicy Selection:**
     - For direct model providers (`model_provider`), implements strict catalog enforcement: MUST implement `ModelCatalogProvider`, load inventory snapshot via `ModelCatalogRuntime.getCatalog(id)`, and evaluate `ModelPolicy.select`.
     - Direct `model_provider` candidates lacking `ModelCatalogProvider` or yielding zero eligible models fail closed (cannot become model-less generation routes).
     - If catalog fetch fails (timeout, error) or yields zero eligible models, the router automatically skips to the next candidate in the fallback chain without failing the entire routing operation unless explicit overrides forbid fallback.

2. **Provider-Kind Profile Boundaries & Route Guards:**
   - **Direct Model Provider Invariant:** `model_provider` candidates MUST yield an eligible `ModelDescriptor` and `ModelId`.
   - **Agent Runtime Exception:** `agent_runtime_provider` (e.g. Antigravity) is the ONLY valid model-less route (`modelId = undefined`, no fake descriptor synthesized), valid until F1.7 normalizes underlying agent models.
   - **Knowledge Provider Guard:** `knowledge_provider` is an authoritative truth and retrieval source and MUST NEVER be returned as the final Brain conversational generation route (decoupled to F1.8).
   - **Profile Boundaries:**
     - `fast_conversation` $\to$ `model_provider` only (interactive latency, fast quality; strictly rejects agent runtimes).
     - `deep_reasoning` $\to$ `model_provider` only (reasoning quality; strictly rejects agent runtimes).
     - `agent_work` $\to$ `agent_runtime_provider` only (ordinary `model_provider` with `coding: true` cannot satisfy `agent_work`).
     - `local_offline` $\to$ `model_provider` with `local_only` eligible model.
     - `research` $\to$ synthesis `model_provider` (truth retrieval decoupled to F1.8).

3. **Privacy Invariant & Fail-Closed Enforcement:**
   - Resolves effective privacy constraint using canonical `resolveEffectiveLocalOnly(request)`.
   - Security invariant: overrides can NEVER weaken `localOnly === true`. If either request or override specifies `localOnly === true`, cloud models/providers (`privacyClass !== 'local_only'`) are rejected.
   - If no compliant local route exists, routing strictly fails closed by throwing `BrainRoutingError('local_provider_unavailable')`.

4. **Overrides & Fallback Normalization:**
   - Explicit caller overrides (`preferredProviderId` or `preferredModelId`) default to STRICT (`allowFallback = false`), preventing unintended model hopping or provider drift.
   - Fallback is enabled only when explicitly permitted (`allowFallback: true`).
   - Provider + model override mismatches (requesting a model not belonging to the requested provider's catalog) strictly fail closed.

5. **Budgets, Hard Global Deadline, Cancellation & Single-Flight Preservation:**
   - **Maximum Provider Budget:** Enforces `maxProviderBudget` (configured on router or passed per request), capping the number of distinct providers contacted or probed during routing. Evaluation terminates immediately once budget is exhausted.
   - **Hard Global Routing Deadline:** Enforces pre-execution cumulative routing budget (default `timeoutMs: 4000ms`). All awaited health and catalog operations are raced against remaining budget (`deadline - Date.now()`) via `raceWithDeadlineAndSignal`, throwing `BrainRoutingError('routing_timeout')` immediately when deadline is reached without waiting for inner metadata timeouts.
   - **Responsive Cancellation:** All metadata awaits are raced against `AbortSignal`. Aborted signals throw `BrainRoutingError('cancelled')` immediately, terminating fallback evaluation promptly.
   - **Shared Single-Flight Preservation:** Routing deadline timeouts and caller cancellations detach safely without aborting or destroying shared in-flight health and catalog single-flight promises in registry and catalog runtimes.
   - **Provider Lifecycle Race Guard:** Validates provider instance identity and registry lifecycle tokens (`getLifecycleToken`) against concurrent replacement or unregistration during routing, throwing `BrainRoutingError('provider_unavailable')` if a race condition is detected.

6. **Execution Boundary, Provenance & Generation Fallback:**
   - **Route Attempts Semantics:** Telemetry records `routeAttempts: 0` before execution. An atomic `routeAttempt` represents an actual execution invocation of `provider.chat()`.
   - **Caller Provenance & Context Immutability:** `ConversationRuntime` preserves caller `request.overrides` intact without mutating user directives with router decisions. Caller `request.context` remains pristine for caller-supplied metadata with zero internal framework contamination.
   - **F1.4.1 Typed Model Execution Bridge:** Router-selected model handoff is transmitted cleanly and safely via `BrainRequestOptions.modelId?: ModelId` (an additive, backward-compatible field on `BrainRequestOptionsSchema`), eliminating intermediate mutable state or context pollution:
     - *User Requested:* `BrainRequest.overrides.preferredModelId` (caller preference/provenance).
     - *MAVE Resolved:* `BrainRouteDecision.modelId` (deterministic routing resolution).
     - *MAVE Executes:* `BrainRequestOptions.modelId` (per-invocation execution target).
   - **Direct Model Invariant:** A direct model route (`providerKind === 'model_provider'`) strictly requires a resolved `routeDecision.modelId !== undefined` prior to invoking `provider.chat()`. If missing, execution fails safely with a deterministic `routing_error`.
   - **Agent Runtime Invariant:** Agent runtimes (e.g. `antigravity`) do not consume direct model options; invocation passes `modelId: undefined` and records `attemptedModelIds: []`.
   - **Concurrency Safety:** Singleton provider instances handle concurrent requests safely because `modelId` travels strictly per-call in `BrainRequestOptions`.
   - **Generation-Time Fallback Policy (Option A):** Pre-execution routing fallback only. No generation-time fallback; once the first assistant-visible delta is emitted, the route stream is committed.
   - **Telemetry vs Diagnostics Separation:** Canonical `RouteTelemetry` adheres strictly to frozen `@mave/contracts` schema (`RouteTelemetrySchema.safeParse`). Evaluation metrics (`routingTimeMs`, `providersEvaluated`, `modelsEvaluated`) are isolated in internal `BrainRoutingDiagnostics` on `BrainRouteDecision`.
   - **Guaranteed Sanitization:** Zero API keys, bearer tokens, or internal filesystem paths are exposed in decision telemetry or error messages.
   - **Phase Status:** F1.4 & F1.4.1 FULLY CLOSED.

7. **F1.5 Production Fast Brain Integration (OpenAI Direct Model Provider):**
   - **Selected First Integration Candidate:** OpenAI (`OpenAIBrainProvider`).
   - **Selection Rationale:** Modern unified Responses API (`POST /v1/responses`) with native SSE streaming, zero external vendor SDK dependencies (uses native `fetch` and `ReadableStream`), non-generation metadata endpoint (`GET /v1/models`) consuming zero generation tokens for health checks, documented low-cost/interactive model tier, expected bilingual Thai/English conversational fluency, clean AbortSignal cancellation, and `.env.example` pre-alignment.
   - **Non-Permanent Candidate Status:** OpenAI is the *first production candidate to integrate* to prove direct ModelProvider architecture and execution handoff; it is NOT declared the permanent winner. F2 performs broader live empirical benchmarking and tuning across candidate providers.
   - **Current Recommended Endpoint Architecture:**
     - **Primary:** OpenAI Responses API (`POST /v1/responses`) with `instructions` and `input`, and explicitly setting `store: false` to ensure stateless requests and prevent server-side conversation retention, preserving MAVE `SessionManager` as the sole canonical store.
     - **Fallback/Compatibility:** Supports legacy Chat Completions API (`POST /v1/chat/completions`) via configurable `apiMode: 'chat_completions'`.
     - **Streaming Event Protocol:** Decodes both modern Responses SSE (`response.output_text.delta`, `response.completed` with `response.usage`) and Chat Completions SSE (`choices[0].delta.content`, `[DONE]`).
   - **Normalized Model IDs & Concrete Mapping:**
     - `openai-fast-primary` $\to$ `gpt-4o-mini` (fast interactive conversational model candidate, 128k context, low cost class).
     - `openai-balanced-primary` $\to$ `gpt-4o` (balanced multimodal reasoning model candidate, 128k context, medium cost class).
   - **Adapter-Private Model Boundary:** Concrete vendor revision strings (`gpt-4o-mini`, `gpt-4o`) remain strictly private to `packages/providers/src/brain/openai.ts`. `@mave/core` contains zero vendor strings.
   - **Non-Generation Health Check:** Dispatches `GET /v1/models` without consuming generation tokens. Differentiates `healthy`, `unconfigured`, `auth_error`, `quota_limited`, `rate_limited`, and `unavailable`. If unconfigured, returns `status: 'unconfigured'` without network traffic. Provider health verifies API accessibility; it does not guarantee model-level quota or live latency.
   - **Execution Contract Integration:** Consumes normalized `options.modelId` passed from `ConversationRuntime`. Fails deterministically with `model_unavailable` if `options.modelId` is omitted or unmapped.
   - **Progressive Streaming & Barge-in:** SSE chunks are normalized to canonical `started`, `delta`, `completed`, `cancelled`, `error` events. Text deltas emit immediately upon receipt, recording `timeToFirstTokenMs` (TTFT). `AbortSignal` cancellation terminates HTTP stream and reader instantly upon barge-in.
   - **M5 Permission Boundary:** Tool execution requests by the provider are strictly blocked.
   - **Latency & Benchmark State:**
     - **MAVE TTFT:** **UNVERIFIED** (No live API credential configured; 0 live runs executed. Mock transport verified timing calculation only).
     - **Thai/English Quality:** **UNVERIFIED LIVE** (Candidate capability based on vendor documentation; empirical testing deferred to credential configuration / F2).
   - **Compact Provider Comparison (Audited October 2026):**

     | Provider | Current Fast Candidate | Official Endpoint / API | Streaming | Credential | Implementation Status | Live Benchmark Status |
     | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
     | **OpenAI** | `gpt-4o-mini` | Responses API (`/v1/responses`) | SSE (`response.output_text.delta`) | `OPENAI_API_KEY` | **Integrated (Candidate #1)** | **Pending Credential** |
     | **Google Gemini** | `gemini-2.5-flash` / `gemini-2.0-flash` | Interactions / `generateContent` | SSE | `GEMINI_API_KEY` | Candidate for F2 | Deferred to F2 |
     | **Anthropic** | `claude-haiku-5-5` | Messages API (`/v1/messages`) | Custom SSE (`content_block_delta`) | `ANTHROPIC_API_KEY` | Candidate for F2 | Deferred to F2 |
     | **Groq** | `llama-3.1-8b-instant` / `llama-3.3-70b` | OpenAI-compatible completions | SSE | `GROQ_API_KEY` | Candidate for F2 | Deferred to F2 |

   - **Status:** F1.5-P OPTIONAL PAID API ADAPTER IMPLEMENTATION CURRENT — LIVE VERIFICATION OPTIONAL / PENDING.

### 21.5 Phase F1.5-S Implemented Runtime Architecture (Subscription-First Foundation & Access/Billing Policy)

1. **Strategic Pivot — Subscription-First Intelligence:**
   - **Default Intelligence Strategy:** **SUBSCRIPTION FIRST + LOCAL SECONDARY + PAID API OPTIONAL / DISABLED BY DEFAULT**.
   - MAVE defaults to user-already-paid consumer/developer subscription runtimes (ChatGPT/Codex, Claude Pro/Team, Google/Antigravity) and private local model fallbacks.
   - Metered cloud APIs (OpenAI API, Anthropic API, Gemini API, Groq API) remain strictly **optional** and **disabled by default**.

2. **OpenAI API Provider Status (F1.5-P Preserved):**
   - `OpenAIBrainProvider` is NOT deleted or rewritten. It is preserved as MAVE's production-ready Optional Paid API Provider adapter.
   - Architecture: Dual-endpoint Responses API (`POST /v1/responses`, `store: false`) and Chat Completions fallback (`POST /v1/chat/completions`), non-generation health check (`GET /v1/models`), Progressive SSE streaming, and 20 comprehensive unit tests.
   - Current Status: **IMPLEMENTED**, **OPTIONAL**, **LIVE UNVERIFIED**, **DISABLED BY DEFAULT**. No API key is requested, and zero API quota is spent during standard MAVE operation.

3. **Critical Invariant — Credential Presence != Billing Permission:**
   - A user having `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` in their shell/system environment for other projects does NOT grant MAVE permission to incur metered API charges.
   - Automatic routing and explicit overrides strictly refuse to route to `paid_api` providers unless explicit billing permission is granted via policy configuration.

4. **Access / Billing Classification (`ProviderAccessClass`):**
   - `@mave/core` introduces a canonical provider access and billing classification orthogonal to model token economics (`ModelCostClass`):
     - `subscription`: Usage drawn from an already-paid consumer/developer subscription quota (e.g. ChatGPT, Claude Pro, Google One/Gemini Advanced).
     - `local`: Runs on the user's local hardware without per-token charges (e.g. Ollama, Llama.cpp, in-memory mocks).
     - `paid_api`: Official metered commercial API that incurs per-token financial billing.

5. **BrainRouter Billing Policy Enforcement:**
   - `BrainRouterOptions` and `BrainRouteRequest` support `allowPaidApis?: boolean` (default: `false`).
   - `BrainRouter.route()` enforces a strict billing gate in the candidate evaluation loop: if `meta.accessClass === 'paid_api'` and `allowPaidApis !== true`, the candidate provider is skipped BEFORE health probing and BEFORE catalog fetching.
   - If an explicit user override requests a paid provider (`preferredProviderId = 'openai'`) without `allowPaidApis: true`, routing fails closed with `provider_unavailable`, notifying the user that paid API billing is disabled by policy.
   - Enabling paid APIs (`allowPaidApis: true`) CANNOT bypass privacy constraints (`localOnly: true` remains strictly fail-closed) and CANNOT bypass profile boundaries (`fast_conversation` still strictly requires interactive `model_provider`).

6. **MCP Boundary — MCP is NOT Billing and NOT the Brain:**
   - **MCP (Model Context Protocol)** is an RPC transport and tool interface (connecting MAVE to external software like Roblox Studio, Blender, GitHub).
   - MCP alone does NOT dictate whether an intelligence route is subscription, local, or paid.
   - Router selects PROVIDERS, not MCP transports. MCP tools remain strictly under the M5 Tool Router and Permission Policy; no execution authority is granted in Pre-M5.

7. **Empirical Subscription Runtime Audit:**
   - **OpenAI Codex:**
     - Discovered locally: `C:\Users\Jeffy\AppData\Local\OpenAI\Codex\bin\9614f1d9b40d9c4f\codex.exe` (`codex-cli 0.162.0-alpha.17.2`).
     - Auth: `chatgpt` OAuth tokens (`~/.codex/auth.json`), zero stored API keys, connected via `wss://chatgpt.com/backend-api/` (`wire API: responses`).
     - Non-interactive execution: `codex exec --json --ephemeral -s read-only`.
     - Classification: `agent_runtime_provider`. Includes command runner, filesystem sandbox, and multi-step agent loop; structurally unsuited for $\le 1\text{--}3\text{s}$ voice TTFT.
   - **Anthropic Claude Code:**
     - Discovered locally: `C:\Users\Jeffy\.local\bin\claude.exe` (`v2.1.272`).
     - Auth: `claude.ai` OAuth (`subscriptionType: "pro"`, `apiProvider: "firstParty"`).
     - Non-interactive execution: `claude -p "<prompt>" --output-format json --tools "" --safe-mode`.
     - API Billing Risk: If `ANTHROPIC_API_KEY` is present in env, Claude Code may prioritize paid API billing over subscription. MAVE must sanitize child process environment.
     - Classification: `agent_runtime_provider`. CLI startup + project scanning overhead ($>3\text{--}8\text{s}$) unsuited for interactive voice TTFT.
   - **Google Antigravity:**
     - Operational locally: `C:\Users\Jeffy\AppData\Local\agy\bin\agy.exe` (`v1.3.4`).
     - Auth: Google subscription credentials.
     - Integration: `AntigravityBrainProvider` via `--print --output-format stream-json`.
     - Classification: `agent_runtime_provider`. Turn latency (4–12s) unsuited for interactive voice TTFT.

8. **Architectural Finding — THE SUBSCRIPTION FAST-BRAIN GAP:**
   - All three available subscription runtimes (`Codex`, `Claude Code`, `Antigravity`) are **`agent_runtime_provider`** systems designed for workspace execution, tool orchestration, and multi-step engineering.
   - Under MAVE's frozen F1.1 provider-kind semantics, `fast_conversation` strictly requires a direct `model_provider` with `streaming: true` and `fastChat: true`.
   - Faking provider-kind to artificially route an agent runtime into `fast_conversation` violates MAVE latency constraints and architectural integrity.
   - **Formal Diagnosis: SUBSCRIPTION FAST-BRAIN GAP confirmed.** Fast conversational voice requires a future local Fast Brain or explicit paid API opt-in.
   - **Next Normalization Candidate:** Claude Code (`ClaudeCodeBrainProvider`) selected as the next additive subscription provider for agent/deep tasks in F1.7.

---

# 22. F2 Boundary & UI Redesign Boundary

- **Boundary between F1 and F2:**
  - **F1 (Intelligence Provider Runtime):** Focuses on the core architecture, contracts, registry, catalog, routing, official provider adapters, cancellation, and streaming reliability.
  - **F2 (Real Brain Integration / Tuning):** Focuses on live model benchmarking, bilingual conversational tuning (Thai/English), prompt template optimization, and voice latency calibration.
- **Boundary with UI Redesign:**
  - Ambient Surface remains clean, compact, and MAVE-branded.
  - No visual redesign of the Surface occurs in F1.
  - Provider health, model selection overrides, and telemetry are surfaced exclusively in the **Developer Diagnostics UI** (Electron Main window / Settings).

---

# 23. Key Decisions Locked

1. **MAVE is above all model and agent vendors.**
2. **Direct Model Providers, Agent Runtimes, and Knowledge Providers are distinct architecture categories.**
3. **One provider family may expose multiple concrete models via a normalized Model Catalog.**
4. **Concrete vendor model IDs are strictly prohibited from `@mave/core`.**
5. **Model Catalog provides normalized metadata (`latencyClass`, `qualityClass`, `costClass`, capabilities).**
6. **Provider health and model availability are decoupled.**
7. **Antigravity is classified as an Agent Runtime candidate, not the Fast Brain.**
8. **Fast conversational requests prefer direct, lightweight Model Providers.**
9. **Antigravity remains text-only; tool execution is strictly blocked until Milestone 5.**
10. **Truth retrieval and Brain reasoning are separate concerns.**
11. **Fresh facts must originate from authoritative Knowledge Providers, not model memory.**
12. **Agent tool capabilities never bypass MAVE's Milestone 5 Permission Boundary.**
13. **Users normally interact with MAVE; vendor overrides are advanced developer controls.**
14. **MAVE owns identity, tone, memory, history, task state, permissions, and desktop presentation.**
15. **ConversationRuntime and SessionManager remain the canonical source of truth for session continuity.**
16. **Provider-native session IDs are internal adapter details; switching providers between turns preserves full context.**
17. **Fallback preserves task intent; fast conversation never silently falls back to heavyweight agent harnesses.**
18. **Direct Model Providers and Agent Runtimes maintain separate fallback logic.**
19. **Fallback is constrained by a maximum attempt budget and voice latency budget.**
20. **Privacy constraints (`local_only=true`) strictly fail closed; cloud fallback is forbidden.**
21. **No AI model or provider winner is declared without empirical benchmark verification in F1/F2.**
22. **Future systems must extend established M2 primitives (`BrainProvider`, `BrainRouter`, `BrainProfilePolicy`), not bypass them.**

---

# 24. Final Architectural Statement

> **MAVE is a provider-independent personal intelligence operating layer. Direct Model Providers deliver ultra-low-latency conversation and deep reasoning. Agent Runtime Providers deliver heavyweight project execution within strict security boundaries. Knowledge Providers deliver authoritative truth and personal memory. MAVE coordinates all three into a single, unified, ambient companion.**
