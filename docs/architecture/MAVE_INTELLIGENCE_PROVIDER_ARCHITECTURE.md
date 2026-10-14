# MAVE Intelligence & Provider Architecture

**Status:** Canonical Intelligence Architecture — Modernized after Milestone 4 Closeout  
**Created after:** MAVE Milestone 2 Phase 10 Closeout  
**Modernized after:** MAVE Milestone 4 Phase 10 Closeout (Pre-M5 Intelligence Provider Foundation)  
**Historical Base:** M0, M1, M2, M3, M4 COMPLETE  
**Current Milestone Track:** Pre-M5 Foundation (F1 Intelligence Provider Runtime & F2 Real Brain Tuning)  
**Primary Purpose:** Define MAVE's canonical intelligence provider, model catalog, routing, fallback, telemetry, and knowledge architecture, establishing a vendor-neutral orchestration foundation across direct model providers, agent runtimes, and knowledge sources before granting execution authority in Milestone 5.

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
  /** Unique normalized model ID (e.g., 'gemini-flash-conversation', 'claude-sonnet-reasoning') */
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

  /** Feature capabilities */
  readonly supportsStreaming: boolean;
  readonly supportsVision: boolean;
  readonly supportsToolUse: boolean;
  readonly supportsStructuredOutput: boolean;
  readonly supportsReasoning: boolean;
  readonly supportsLongContext: boolean;
  readonly supportsThai: boolean;
  readonly supportsEnglish: boolean;
  readonly supportsCancellation: boolean;

  /** Privacy & data protection class */
  readonly privacyClass: 'public_cloud' | 'private_cloud' | 'local_airgapped';
}
```

### 4.2 Dynamic Catalog Management
- Provider adapters expose their supported catalog via `getCatalog(): Promise<ModelDescriptor[]>`.
- Adding, updating, or deprecating a vendor model requires changes only inside `@mave/providers` (or user configuration), requiring **zero modifications to `@mave/core` routing logic**.

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
Provider Health Status:
  ├── 'healthy'        : Operational and responding to health pings
  ├── 'degraded'       : Elevated latency, secondary fallback active
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
- If all providers matching the requested `fast_conversation` profile are unavailable, MAVE reports an explicit, normalized error (`FAST_BRAIN_UNAVAILABLE`) rather than freezing the voice loop.

### 9.2 Fallback Chains & Latency Budget
- **Maximum Attempt Budget:** At most 2 provider attempts per conversational turn.
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
export interface BrainUsageTelemetry {
  readonly requestId: string;
  readonly sessionId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly profileId: BrainProfileId;
  readonly timeToFirstTokenMs: number;
  readonly totalLatencyMs: number;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
  readonly estimatedCostUsd?: number;
  readonly fallbackUsed: boolean;
  readonly attemptedProviderIds: string[];
  readonly finishReason?: string;
}
```

---

# 12. User Overrides & Precedence Hierarchy

While MAVE routes automatically by default, power users and developers may set explicit overrides in settings or developer chat:

```text
                          PREVALENCE HIERARCHY
                          
     1. Privacy Policy (Strict Fail-Closed Constraint)
        └── If local_only=true, cloud providers are FORBIDDEN.
        
     2. Security & Capability Requirements
        └── Cannot route to a provider missing required capabilities.
        
     3. Explicit Caller Override (User Setting / Developer Chat)
        └── Preferred Provider ID / Specific Model ID.
        
     4. Profile Policy Mapping
        └── Configured profile-to-provider mappings.
        
     5. Automatic Default Routing
        └── Health-checked primary candidate with fallback.
```

If a user explicitly requests an unavailable model or provider, MAVE **does not silently substitute an unrelated provider**. It reports the issue and requests guidance or provides a clear override error.

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

MAVE standardizes intelligence errors to prevent raw stack traces from reaching the user:

```ts
export type CanonicalIntelligenceErrorCode =
  | 'FAST_BRAIN_UNAVAILABLE'
  | 'PROFILE_UNAVAILABLE'
  | 'MODEL_UNAVAILABLE'
  | 'PROVIDER_UNCONFIGURED'
  | 'QUOTA_LIMITED'
  | 'RATE_LIMITED'
  | 'AUTH_REQUIRED'
  | 'LOCAL_PROVIDER_UNAVAILABLE'
  | 'ROUTING_TIMEOUT'
  | 'GENERATION_CANCELLED';
```

### 20.1 Fail-Closed vs Fail-Open Policies
- **Privacy Constraints:** **FAIL CLOSED**. If local-only operation is requested and no local provider is available, MAVE aborts the request and alerts the user (`LOCAL_PROVIDER_UNAVAILABLE`). Cloud fallback is never attempted.
- **Fast Brain Availability:** **FALLBACK WITHIN PROFILE**. If primary fast provider is down, alternate fast provider is tried. If none exist, fail gracefully with voice feedback (`FAST_BRAIN_UNAVAILABLE`).
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

### Phase F1.2 — Provider Registry & Health Hardening ← NEXT
- **Goal:** Extend `BrainProviderRegistry` to support dynamic registration, provider descriptors, and non-quota health checks.
- **Scope:** Registry lifecycle, health monitoring, error normalization.

### Phase F1.3 — Model Catalog & Model Policy
- **Goal:** Implement `ModelCatalog` and deterministic `ModelPolicy` in `@mave/core`.
- **Scope:** Provider catalog retrieval, model selection rules, deprecation handling.

### Phase F1.4 — Intelligence Routing & Intent-Preserving Fallback
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
   - Eliminated redundant `configured: boolean` in favor of canonical `ProviderHealth.status: 'unconfigured' | 'healthy' | 'degraded' | 'quota_limited' | 'rate_limited' | 'auth_error' | 'unavailable' | 'unhealthy'`.
   - Decoupled `ModelAvailabilityStatus` (`available`, `quota_limited`, `rate_limited`, `deprecated`, `unavailable`).
4. **Model Catalog Integrity:**
   - `ModelCatalogSnapshot` validates via Zod `superRefine` that every nested `ModelDescriptor.providerId` matches the parent `snapshot.providerId`.
5. **Additive Backward Compatibility:**
   - Extended `BrainCapabilities` with optional `structuredOutput`, `cancellation`, `supportsThai`, `supportsEnglish` to guarantee 100% backward compatibility for all existing M2/M3/M4 providers and test fixtures.
   - `BrainProvider.getCatalog?()` and `getDescriptor?()` are optional, with `ModelCatalogProvider` extending `BrainProvider` for catalog-capable providers.
6. **Telemetry Separation:**
   - Decoupled into `GenerationUsage` (tokens, cost), `GenerationTiming` (TTFT, total latency), and `RouteTelemetry` (selected provider/model, route reason, attempts, fallback flags).
7. **Local Privacy Enforcement:**
   - Machine-readable `localOnly: boolean` on `BrainRequest` and `BrainRouteOverrides`. Cloud models are rejected deterministically when `localOnly=true`.

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
