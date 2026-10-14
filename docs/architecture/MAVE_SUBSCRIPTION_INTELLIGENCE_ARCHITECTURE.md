# MAVE Subscription Intelligence Architecture

**Status:** Canonical Subscription Architecture — Pre-M5 Foundation (F1.5-S)  
**Created:** October 2026  
**Milestone:** Pre-M5 — Intelligence Provider Foundation  
**Companion Documents:**  
- [`MAVE_INTELLIGENCE_PROVIDER_ARCHITECTURE.md`](MAVE_INTELLIGENCE_PROVIDER_ARCHITECTURE.md) (General Provider & Contract Architecture)  
- [`MAVE_ROADMAP.md`](MAVE_ROADMAP.md) (Master Project Roadmap)  

---

## 1. Executive Summary & Purpose

MAVE's core intelligence strategy is **Subscription-First**:
```text
SUBSCRIPTION FIRST + LOCAL SECONDARY + PAID API OPTIONAL / DISABLED BY DEFAULT
```

MAVE does not merely toggle between vendors at a provider level. Instead, MAVE provides an intelligent multi-stage orchestration pipeline that separates:
1. **WHAT** kind of intelligence is required (Task Classification & Brain Profile)
2. **HOW** MAVE pays or accesses intelligence (Access & Billing Policy)
3. **WHICH** subscription runtime or provider handles it (Runtime Selection)
4. **WHICH** semantic model role is needed (Model Role Selection)
5. **WHICH** concrete runtime model is resolved (Runtime-Specific Model Resolution)
6. **EXECUTION** with intent preservation, responsive cancellation, and streaming output

```text
USER REQUEST
     ↓
Task Classification
     ↓
Brain Profile Policy (fast_conversation | deep_reasoning | agent_work | research | local_offline)
     ↓
Access / Billing Policy (Subscription First ──► Local Secondary ──► Paid API Blocked)
     ↓
Runtime Selection (Codex | Claude Code | Antigravity | Local | [Optional Paid API])
     ↓
Model Role Selection (FAST | BALANCED | REASONING | CODING | AGENT)
     ↓
Runtime-Specific Model Resolution (e.g. Claude Code → 'sonnet' | Codex → 'gpt-5.6-sol' | Antigravity → 'gemini-3.8-flash-high')
     ↓
EXECUTION (Pre-execution routing, progressive streaming, barge-in support)
```

---

## 2. Subscription-First Policy & Billing Guardrails

### 2.1 Default Access Policy
The default intelligence routing hierarchy is strictly:
1. **Subscription Runtime:** Consumer/developer accounts already paid by the user (ChatGPT/Codex, Claude Pro/Team, Google One/Gemini Advanced).
2. **Local Provider:** Private, offline-capable models running locally (Ollama, Llama.cpp, in-memory mocks).
3. **Fail / Inform User:** If no subscription or local route is available, inform the user rather than spending money.

### 2.2 Hard Invariant: Credential Presence != Billing Permission
- Presence of an API credential (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, etc.) in the user's environment for other projects **NEVER** grants MAVE permission to incur metered API charges.
- Paid APIs remain **BLOCKED BY DEFAULT** (`allowPaidApis: false`).
- A paid API provider can ONLY be routed if explicitly authorized by user configuration or per-turn request parameters (`allowPaidApis: true`).
- Enabling paid APIs cannot bypass privacy constraints (`localOnly: true` remains fail-closed) and cannot bypass profile semantics.

---

## 3. Brain Architecture vs Tool Architecture (The MCP Boundary)

MAVE strictly decouples intelligence from tool execution:

```text
┌─────────────────────────────────────────────────────────────┐
│                      MAVE CORE ENGINE                       │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
     [INTELLIGENCE LANE]                 [TOOL LANE]
               ▼                              ▼
┌──────────────────────────────┐┌──────────────────────────────┐
│     INTELLIGENCE ROUTER      ││         TOOL ROUTER          │
│ (Profile, Billing, Model)    ││    (Permissions, Registry)   │
└──────────────┬───────────────┘└─────────────┬────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐┌──────────────────────────────┐
│    SUBSCRIPTION RUNTIMES     ││          MCP LAYER           │
│ ├── OpenAI Codex             ││ ├── Roblox Studio MCP        │
│ ├── Anthropic Claude Code    ││ ├── Blender MCP              │
│ └── Google Antigravity       ││ ├── GitHub MCP               │
│                              ││ └── Filesystem / Browser     │
└──────────────────────────────┘└──────────────────────────────┘
```

1. **MCP is NOT the Brain:** The Model Context Protocol (MCP) is an RPC transport, protocol, and tool integration mechanism. It is never selected as an intelligence brain.
2. **Tool Authority Boundary:** In Milestone 5, when an intelligence runtime decides a tool should be executed, it requests a tool action. The MAVE Tool Router and Permission Policy arbitrate whether the tool may run on an MCP server. Pre-M5 runtimes operate with tool execution strictly blocked.
3. **Provider vs Transport:**
   - **Provider/Runtime:** `CodexProvider`, `ClaudeCodeProvider`, `AntigravityProvider`, `OpenAIBrainProvider`.
   - **Transport:** `CLI`, `MCP`, `Local HTTP`, `Official API`.
   - `BrainRouter` selects the **Provider/Runtime**, not the transport. If a runtime uses MCP internally as its transport, the router still routes to the named provider.

---

## 4. Semantic Model Roles (Decoupled from Vendor Generations)

MAVE introduces canonical **Model Roles** that represent semantic capacity rather than ephemeral vendor branding:

| Model Role | Semantic Description | Target Tasks | Example Latency |
|---|---|---|---|
| **`FAST`** | Low-latency, concise conversational response | Quick chat, language practice, simple queries | $\le 1\text{--}3\text{s}$ TTFT |
| **`BALANCED`** | General-purpose analytical and creative interaction | Summary, drafting, intermediate Q&A | $2\text{--}5\text{s}$ TTFT |
| **`REASONING`** | Multi-factor analytical and architectural thinking | Complex debugging, system evaluation | $5\text{--}15\text{s}$ TTFT |
| **`CODING`** | Syntactic precision, code review, patch generation | Code writing, refactoring, test fixes | Variable |
| **`AGENT`** | Multi-step workspace operations, planning, tools | Project implementation, file tree edits | Multi-step |

### 4.1 Invariant: No Frozen Vendor Model Generations
- Task policies and routing rules MUST NOT hardcode concrete vendor revisions (e.g. `claude-3-7-sonnet-20250219`, `gpt-5.6-sol`, `gemini-2.5-flash`).
- Task routing targets a **Model Role** within the selected runtime. The runtime resolves the role to whatever eligible model the user's account currently supports.
- When vendors rotate or release new models, MAVE's **Model Watch** updates role mappings without requiring code rewrites in Core or Router.

### 4.2 Critical Distinction: `ModelRole.FAST` vs `BrainProfile.fast_conversation`
- **`ModelRole.FAST`** denotes low relative latency and lightweight resource usage *within a runtime* (e.g., Claude Code Haiku, Codex Luna, Antigravity Flash-Low).
- **`BrainProfile.fast_conversation`** denotes the end-to-end voice loop profile requiring $\text{TTFT} \le 1.0\text{--}3.0\text{s}$ under MAVE's frozen contract, which strictly mandates a `model_provider`.
- Although Claude Code Haiku achieves ~2.34s warm TTFT, Claude Code is an `agent_runtime_provider` with CLI bootstrap (~1.1–1.7s) and sandbox overhead. Therefore, Haiku can satisfy `ModelRole.FAST` for agent workflows, but **cannot** satisfy `BrainProfile.fast_conversation`. Canonical subscription routing for `fast_conversation` remains: **NO CANONICAL SUBSCRIPTION FAST_CONVERSATION ROUTE YET**.

---

## 5. Runtime Model Mapping Matrix

Each subscription runtime maps MAVE model roles to its verified model inventory:

```text
[Codex Runtime] (Provider ID: 'codex', Discovery: runtime_cache / configured)
  FAST       ──► gpt-6-luna / gpt-5.6-luna
  BALANCED   ──► gpt-5.6-sol (codex default) / gpt-6-sol / gpt-5.6-terra / gpt-5.5
  REASONING  ──► gpt-6.1-sol / gpt-6-astra / gpt-6-sol / gpt-5.6-sol
  CODING     ──► gpt-5.6-sol (codex default) / gpt-6.1-sol / gpt-6-sol / gpt-6-astra
  AGENT      ──► gpt-5.6-sol / gpt-6.1-sol / gpt-6-sol

[Claude Code Runtime] (Provider ID: 'claude-code', Discovery: runtime_alias / runtime_observed)
  FAST       ──► haiku (claude-haiku-4-5-20251001)
  BALANCED   ──► sonnet (default: claude-sonnet-5) / haiku
  REASONING  ──► opus (default: claude-opus-5) / sonnet
  CODING     ──► sonnet (default) / opus
  AGENT      ──► sonnet (default)

[Antigravity Runtime] (Provider ID: 'antigravity', Discovery: runtime_enumerated / configured)
  FAST       ──► gemini-3.8-flash-low
  BALANCED   ──► gemini-3.8-flash-medium (default) / gemini-3.8-flash-low / gpt-oss-120b-medium
  REASONING  ──► claude-opus-4-6-thinking (default) / gemini-3.8-flash-high / claude-sonnet-4-6
  CODING     ──► gemini-3.8-flash-high (default) / claude-sonnet-4-6 / gemini-3.8-flash-medium
  AGENT      ──► gemini-3.8-flash-medium (default) / claude-sonnet-4-6
```

### 5.1 Non-Generation Discovery & Provenance Hierarchy
MAVE strictly enforces non-generation model discovery. Inspecting model inventories **NEVER** burns generation tokens or AI subscription quota:
- **`runtime_enumerated`:** Models discovered via non-quota CLI introspection (e.g. `agy models`). Highest confidence.
- **`runtime_observed`:** Models discovered dynamically during streaming sessions (e.g. Claude session `init` event emitting canonical `model: 'claude-sonnet-5'`).
- **`runtime_alias`:** Official built-in CLI aliases provided by the vendor runtime (e.g. Claude `--model sonnet`, `--model opus`, `--model haiku`).
- **`runtime_cache`:** Local machine-readable caches maintained by vendor CLIs (e.g. `~/.codex/models_cache.json`). Validated against `fetched_at` staleness.
- **`configured`:** Static fallback descriptors when runtime CLI or cache file is unavailable.
- **`unknown`:** Unclassified source.

> [!IMPORTANT]
> If a subscription runtime lacks an eligible model for a requested role, that runtime is **ineligible** for that task, and the router falls back to the next compatible subscription or local runtime.

---

## 6. Empirical Subscription Runtime Audit

Audited October 2026 on local development environment:

### 6.1 OpenAI Codex
- **Local Executable:** `C:\Users\Jeffy\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe` (`codex-cli 0.154.0`).
- **Official Auth:** ChatGPT subscription OAuth stored in `~/.codex/auth.json` (`auth_mode: "chatgpt"`, zero stored API keys).
- **Transport & Reachability:** Websocket Responses API (`wss://chatgpt.com/backend-api/`).
- **Non-Interactive Mode:** `codex exec --ephemeral --skip-git-repo-check --json -s read-only "<prompt>"`.
- **Model Control:** `-m, --model <MODEL>` flag, config overrides `-c model="..."`.
- **Model Discovery:** Maintained locally in `~/.codex/models_cache.json`.
- **Quota Semantics:** Bound to ChatGPT subscription limits. Returns rate limit event upon exhaustion.
- **Billing Isolation Invariant:** `OPENAI_API_KEY` must be explicitly removed from subscription child process environments to prevent fallback to metered API billing.
- **Provider Kind:** **`agent_runtime_provider`** (incorporates command runner, sandbox, and file tools).
- **Voice Viability:** Unsuited for sub-2s voice TTFT (measured cold TTFT ~12.0s, total duration ~16.7s).

### 6.2 Anthropic Claude Code
- **Local Executable:** `C:\Users\Jeffy\.local\bin\claude.exe` (`2.1.251 (Claude Code)`).
- **Official Auth:** Claude Pro subscription OAuth via `claude.ai` (`organizationType: "claude_pro"`, `billingType: "stripe_subscription"`).
- **Non-Interactive Mode:** `claude -p "<prompt>" --verbose --tools "" --safe-mode --disable-slash-commands --strict-mcp-config --output-format stream-json --include-partial-messages --no-session-persistence`. Stdio must be `['ignore', 'pipe', 'pipe']` to prevent 3-second stdin timeout warning.
- **Model Control:** `--model <model>` (`sonnet`, `opus`, `haiku`, or canonical version string).
- **Model Discovery:** Discovered at runtime via session `init` event (no standalone machine-readable `claude models --list` command).
- **Quota Semantics:** Normalized from `rate_limit_event` (5-hour rolling session window utilization and resetsAt). Emits `quota_limited` error when `status: "rejected"`.
- **Billing Isolation Invariant:** Child environment explicitly strips `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_CUSTOM_HEADERS`, `CLAUDE_API_KEY`, and `CLAUDE_CODE_API_KEY`. Parent process environment is never modified globally.
- **Dangerous Permissions Guardrail:** Never invokes `--dangerously-skip-permissions`. Invariant strictly enforced.
- **Provider Kind:** **`agent_runtime_provider`** (CLI bootstrap takes 1.1–1.7s; warm TTFT is 2.3–3.8s).
- **Voice Viability:** Unsuited for sub-2s interactive voice TTFT under `agent_runtime_provider` semantics, but highly capable for `deep_reasoning`, `coding`, and `agent_work`.

### 6.3 Google Antigravity
- **Local Executable:** `C:\Users\Jeffy\AppData\Local\agy\bin\agy.exe` (`1.3.5`).
- **Official Auth:** Google account subscription.
- **Integration:** `AntigravityBrainProvider` via `agy --input-format stream-json --output-format stream-json --sandbox --disable-slash-commands`.
- **Model Discovery:** Non-quota command `agy models` lists available models and roles (`gemini-3.8-flash-high`, `gemini-3.8-flash-medium`, `gemini-3.8-flash-low`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, `gpt-oss-120b-medium`).
- **Model Control:** `--model <model>`, `--effort <effort>`.
- **Provider Kind:** **`agent_runtime_provider`**.
- **Voice Viability:** Unsuited for interactive voice TTFT (measured cold TTFT ~7.9s, turn latency ~12.9s).

### 6.4 Empirical Subscription Runtime Benchmark Matrix (Local Measurements)

Controlled local benchmarks conducted on development machine (October 2026, RTX 3060 Ti host, Windows 11):
Short prompt: *"Say OK only."* (Zero API tokens, official consumer subscriptions only).

| Runtime | Model / Alias | Semantic Role | CLI Boot | Cold TTFT | Warm TTFT (Avg) | Total Latency (Avg) | Cancellation | Tools Disabled? | Eligible for `fast_conversation`? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Claude Code** | `haiku` | `BALANCED` | 1,135 ms | 2,810 ms | 2,342 ms *(5 runs)* | 3,004 ms | Yes (32 ms) | Yes (`--tools ""`) | **No** (agent runtime, >2s TTFT) |
| **Claude Code** | `sonnet` | `BALANCED` / `CODING` | 1,220 ms | 3,692 ms | 3,805 ms *(5 runs)* | 4,972 ms | Yes (35 ms) | Yes (`--tools ""`) | **No** (agent runtime, >3.5s TTFT) |
| **Claude Code** | `opus` | `REASONING` | 1,210 ms | 2,999 ms | 3,075 ms *(2 runs)* | 3,652 ms | Yes (30 ms) | Yes (`--tools ""`) | **No** (agent runtime, >3s TTFT) |
| **Antigravity** | `gemini-3.8-flash-low` | `AGENT` / `BALANCED` | 2,740 ms | 7,892 ms | ~7,900 ms | 12,945 ms | Yes (45 ms) | Yes (`--sandbox`) | **No** (agent runtime, >7s TTFT) |
| **OpenAI Codex**| `gpt-5.6-sol` (default)| `CODING` / `REASONING` | 1,040 ms | 11,988 ms| ~12,000 ms| 16,721 ms | Yes (40 ms) | Yes (`-s read-only`)| **No** (agent runtime, >11s TTFT) |

*Note on TTFT Separation:*
For Claude Code Haiku, the Anthropic cloud API reports an internal `ttft_ms` of 1,036–1,243 ms. The remaining ~1,100–1,300 ms observed by MAVE represents local child process creation, Node/V8 bootstrap, CLI configuration loading, and stdio pipe serialization.


---

## 7. The Subscription Fast-Brain Gap

### 7.1 Empirical Diagnosis
MAVE's M3 voice loop demands an interactive voice turn-taking latency of $\text{TTFT} \le 1.0\text{--}3.0\text{s}$.
- All three available subscription runtimes (`Codex`, `Claude Code`, `Antigravity`) are architected as **agent runtimes**: they inspect project state, initialize sandboxes, evaluate workspace rules, and run supervisor loops.
- Even when tools are disabled (e.g. `claude --tools ""`), process boot and cloud roundtrip require $3\text{--}10\text{s}$.
- Under MAVE's frozen F1.1 provider-kind semantics, `fast_conversation` strictly requires a `model_provider`.

### 7.2 Strict Invariant: No Provider-Kind Faking
- MAVE will **NEVER** falsely reclassify an agent runtime as a `model_provider` merely to satisfy `fast_conversation`.
- Doing so would violate latency budgets, introduce unpredictable tool/shell risks, and break architectural integrity.

### 7.3 Formal Finding: `SUBSCRIPTION FAST-BRAIN GAP`
MAVE formally acknowledges a **SUBSCRIPTION FAST-BRAIN GAP**. The resolution path is:
1. **Short Term:** Developer/test fallback via `mock` model provider; optional explicit Paid API opt-in (`allowPaidApis: true`) for low-latency voice testing.
2. **Medium Term (F1.6 / F1.7):** Direct subscription-backed conversational transport if an official low-overhead streaming endpoint becomes available.
3. **Long Term:** Local quantized Fast Brain (e.g. 3B–8B model on local GPU/NPU) providing guaranteed zero-cost, sub-second TTFT.

---

## 8. User Override Modes: Auto, Preferred, Locked

MAVE defines three deterministic user selection modes:

```text
┌─────────────────┬─────────────────────────────────────────────────────────────┐
│ Mode            │ Semantic Behavior                                           │
├─────────────────┼─────────────────────────────────────────────────────────────┤
│ **AUTO**        │ Evaluates role compatibility, filters available models,     │
│                 │ and resolves ties via deterministic priority scoring.       │
│                 │ Ranks AVAILABLE strictly above UNKNOWN. Selects UNKNOWN     │
│                 │ only optimistically if no verified AVAILABLE model exists.  │
│ **PREFERRED**   │ Validates preferred model; if AVAILABLE, selects it.        │
│                 │ If UNKNOWN, selects it (without pretending it is verified). │
│                 │ If UNAVAILABLE/exhausted: falls back to AUTO if allowed     │
│                 │ (fallbackOccurred: true); else fails closed with error.     │
│ **LOCKED**      │ Strictly requires exact model match and role compatibility. │
│                 │ Attempts exact model if AVAILABLE or UNKNOWN. Fails closed  │
│                 │ if UNAVAILABLE or quota-limited. Silent switching FORBIDDEN.│
└─────────────────┴─────────────────────────────────────────────────────────────┘
```

### 8.1 Conservative Availability Principles: Discovery != Availability != Entitlement
1. **`runtime_enumerated`:** Models discovered via live non-quota introspection for the currently authenticated account (e.g. `agy models`) are marked `available`.
2. **`runtime_observed`:** Models verified dynamically during streaming sessions (e.g. Claude session `init` event emitting `model: 'claude-sonnet-5'`) transition to `available` upon verified initialization.
3. **`runtime_alias`:** CLI aliases (`sonnet`, `opus`, `haiku`) start as **`unknown`**. Alias existence does NOT prove current account entitlement.
4. **`runtime_cache`:** Local CLI caches (`~/.codex/models_cache.json`) start as **`unknown`**. Cache file existence does NOT guarantee active subscription entitlement, and stale cache entries (`fetched_at` older than 7 days) are explicitly flagged `metadata.stale = true`.
5. **`configured`:** Static fallback configurations start as **`unknown`**.
6. **`unavailable` / `quota_limited` / `rate_limited`:** Strictly excluded from selection in all modes.

### 8.2 Deterministic Tie-Breaking Order (AUTO Selection)
When multiple candidate models in a subscription runtime satisfy a requested Model Role:
1. **Availability Hierarchy:** Verified `available` models (score 1) strictly outrank unverified `unknown` models (score 2).
2. **Role-Specific Priority:** Explicit `metadata.rolePriority[role]` or `metadata.defaultFor` (lower score = higher preference).
3. **Generic Model Priority:** `metadata.priority` rating from CLI or cache.
4. **Discovery Source Hierarchy:** `runtime_enumerated` > `runtime_observed` > `runtime_alias` > `runtime_cache` > `configured` > `unknown`.
5. **Deterministic Collation:** Alphabetical sort on `modelId` ensuring 100% reproducible selection across restarts.

### 8.3 Execution Handoff & Provider Bypass Elimination
F1.4.1 established the clear semantic flow:
```text
CALLER PREFERENCE                     ROUTING / SELECTION LAYER                   EXECUTION TARGET
BrainRequest.overrides.preferredModelId ──────► selectRuntimeModel() ──────► BrainRequestOptions.modelId
(User intent & provenance)                    (Deterministic resolution)    (Per-invocation execution)
```

- **Strict Provider Invariant (No Preference Bypass):**
  Subscription runtime providers (`ClaudeCodeBrainProvider`, `AntigravityBrainProvider`) strictly **NEVER** consume `request.overrides.preferredModelId` directly as an execution target. Only the routing and model selection layer interprets caller preferences. Providers receive the resolved execution target exclusively via `options?.modelId || this.defaultModel`.
- **Concurrency & State Isolation:**
  `BrainRequestOptions.modelId` travels strictly per invocation. Provider singleton instances maintain zero mutable current-model state, ensuring simultaneous concurrent requests execute with independent model options safely without cross-contamination.
- **Midstream Retry Prohibition (F1.4 Preservation):**
  Once provider execution begins with a selected model (even an `unknown` model selected optimistically), there is NO automatic midstream cross-provider retry. If the runtime CLI or cloud rejects the model, the turn fails cleanly with `model_unavailable` rather than executing an unexpected silent fallback.
- **Contract Boundary Status:**
  `BrainRequestOptions.modelId` is semantically generic across all `BrainProvider` kinds (both direct `model_provider` and `agent_runtime_provider`). **ZERO CONTRACT EXPANSION REQUIRED.**

---

## 9. Task → Runtime → Model Routing Engine (F1.5-S3)

MAVE's intelligence routing engine provides a deterministic, multi-stage pipeline:

```text
Task Intent
    ↓
Brain Profile
    ↓
Access / Billing Policy (Subscription First → Local Secondary → Paid API Blocked)
    ↓
Provider / Runtime Selection (AUTO | PREFERRED | LOCKED)
    ↓
Model Role Selection (FAST | BALANCED | REASONING | CODING | AGENT)
    ↓
Concrete Model Selection (RuntimeModelCatalog.selectRuntimeModel)
    ↓
Execution Handoff (options.modelId per-invocation)
```

### 9.1 Task Classification Matrix & Vendor Independence
Task Policy maps user intent and conversational context into canonical `BrainProfileId` and semantic `ModelRole`:

| Task Intent | Profile ID | Model Role | Context / Notes |
|:---|:---|:---|:---|
| `quick_chat` | `fast_conversation` | `FAST` | Ultra-low latency voice or short text interaction |
| `general_conversation` | `fast_conversation` | `BALANCED` | Default conversational turn |
| `language` | `fast_conversation` | `FAST` | Interactive language practice |
| `deep_reasoning` | `deep_reasoning` | `REASONING` | Conversational deep analysis without tool execution |
| `planning` | `deep_reasoning` / `agent_work` | `REASONING` | Conversational planning → `deep_reasoning`; Project/agent planning → `agent_work` |
| `coding` | `agent_work` | `CODING` | Code generation, editing, review |
| `agent_work` | `agent_work` | `AGENT` | Autonomous multi-step tool execution / workflows |
| `research` | `research` | `REASONING` | Broad information synthesis |
| `local_private` | `local_offline` | `BALANCED` | Offline-only, local-only privacy guarantee |

**Zero Vendor Leakage:** `TaskPolicy` strictly contains no vendor names (`claude`, `codex`, `antigravity`, `openai`). It operates purely on semantic profiles and model roles.

### 9.2 Runtime Selection Modes (AUTO, PREFERRED, LOCKED)
For profile candidates (e.g. `agent_work` candidate pool):

1. **AUTO:**
   Evaluates runtime eligibility based on health and model role support. Sorts candidates by deterministic priority:
   - `CODING`: `claude-code` → `codex` → `antigravity`
   - `AGENT`: `antigravity` → `claude-code` → `codex`
   - `REASONING`: `claude-code` → `codex` → `antigravity`
   - `BALANCED`: `claude-code` → `antigravity` → `codex`
   - `FAST`: `claude-code` → `antigravity` → `codex`
2. **PREFERRED:**
   Attempts the user's preferred runtime first.
   - If healthy and role-compatible: selects it.
   - If unavailable or role-incompatible and `allowFallback: true`: falls back to AUTO priorities with diagnostic flag `fallbackOccurred: true`.
   - If `allowFallback: false`: fails closed immediately.
3. **LOCKED:**
   Pins execution strictly to the specified runtime (`lockedRuntimeId`).
   - If the runtime is missing, unhealthy, or lacks a model satisfying the role: fails immediately (`provider_not_found`, `no_healthy_provider`, or `capability_not_supported`).
   - Silent switching is forbidden.

### 9.3 Provider-Kind Architectural Boundaries & Subscription Gaps
MAVE maintains strict integrity of provider kinds:
- `fast_conversation`, `deep_reasoning`, `research`, `local_offline` $\to$ strictly `model_provider`.
- `agent_work` $\to$ strictly `agent_runtime_provider`.

**Honest Subscription Status & Gaps (No Architecture Cheating):**
1. **`fast_conversation`:**
   **NO CANONICAL SUBSCRIPTION MODEL_PROVIDER ROUTE YET.**
   Subscription runtimes (`claude-code`, `codex`, `antigravity`) are agent runtimes executed via CLI subprocesses with ~1.1–1.7s bootstrap latency. They cannot fulfill voice low-latency conversational budgets (~1–3s TTFT under `model_provider` semantics). They are not routed into `fast_conversation` due to provider-kind architectural boundaries (they are `agent_runtime_provider`, not `model_provider`). If no direct local or subscription `model_provider` is available, paid APIs remain blocked by default.
2. **`deep_reasoning`:**
   **NO CANONICAL SUBSCRIPTION MODEL_PROVIDER ROUTE YET.**
   Pure conversational deep reasoning belongs to `model_provider`. Subscription runtimes are preserved for `agent_work`.
3. **`language`:**
   **TASK POLICY READY — ROUTE PROVIDER GAP REMAINS.**
   Semantic task mapping resolves `language` $\to$ `fast_conversation` + `FAST`. However, actual execution requires an eligible subscription or local `model_provider`. Subscription agent runtimes are rejected at the provider-kind boundary.
4. **`research`:**
   **TASK POLICY READY — ROUTE PROVIDER GAP REMAINS.**
   Semantic task mapping resolves `research` $\to$ `research` + `REASONING`. However, execution remains constrained by `research` profile requiring `model_provider` and `webResearch: true`. Full retrieval/grounding is future F1.8 work.
5. **Zero Contract Expansion:**
   Pre-M5 routing hardening requires 0 public contract changes to `@mave/contracts`. All routing enhancements exist strictly within `@mave/core` internal types and runtime models.

### 9.4 Evaluated Provider != Attempted Provider (Routing Telemetry Semantics)
MAVE strictly restores and enforces canonical F1.4 routing telemetry semantics:
1. **Candidate Evaluation != Execution Attempt:**
   - Probing candidate provider health, fetching model catalogs, or evaluating runtime model roles does NOT constitute an execution attempt.
   - **Pre-execution (`decision.telemetry`):**
     - `attemptedProviderIds = []`
     - `attemptedModelIds = []`
     - `routeAttempts = 0`
   - Pre-execution candidate evaluation belongs strictly in internal diagnostics:
     - `diagnostics.evaluatedProviderIds`: Full list of candidate provider IDs evaluated.
     - `diagnostics.skippedRuntimes`: Records non-executable or incompatible skips (e.g. `runtime_not_executable`).
     - `diagnostics.providersEvaluated`, `diagnostics.runtimeModelsEvaluated`, `diagnostics.selectionReason`.
2. **Actual Execution Telemetry (`executionTelemetry`):**
   - Only when `provider.chat()` is actually invoked does an execution attempt occur.
   - For an invoked agent runtime:
     - `attemptedProviderIds = [selectedRuntimeProviderId]`
     - `routeAttempts = 1`
     - `attemptedModelIds = []` (preserving canonical frozen agent runtime telemetry shape).
3. **Pre-Execution Fallback Semantics:**
   - Pre-execution fallback (e.g. Preferred candidate is unavailable or unhealthy $\to$ AUTO candidate selected) does NOT create an attempt.
   - `routeAttempts` remains 0 until the final selected provider actually begins execution.
4. **Midstream Failure Prohibition:**
   - Once `provider.chat()` begins, cross-provider retry is strictly prohibited.
   - If the selected provider fails midstream, the request fails immediately; no secondary provider is attempted.

### 9.5 Codex Subscription Runtime Normalization (F1.5-S3.2)
1. **Executable Provider Status:**
   - OpenAI Codex is normalized into a first-class, executable `agent_runtime_provider` implemented by `CodexBrainProvider`.
   - Before registration in `BrainProviderRegistry`, Codex safely reports as `runtime_not_executable` during routing candidate evaluation.
   - After registration, Codex is fully executable when health and auth checks pass.
2. **ChatGPT Subscription Authentication & Billing Isolation:**
   - Authenticated via official ChatGPT subscription auth stored in `~/.codex/auth.json` (`auth_mode: "chatgpt"`).
   - Strict Billing Safety: Child process environment explicitly strips `OPENAI_API_KEY`, `OPENAI_KEY`, `OPENAI_BASE_URL`, `OPENAI_API_BASE`, `OPENAI_ORG_ID`, `OPENAI_ORGANIZATION`, `OPENAI_PROJECT_ID`, and `CODEX_API_KEY`.
   - Parent process environment is never modified globally. Credential presence != billing permission.
3. **Pre-M5 Tool Suppression & Headless Non-interactive Execution:**
   - Enforces `--sandbox read-only` and terminates process immediately if any tool execution (`command_execution`, `file_change`, `tool_call`, etc.) is attempted. Zero dangerous approval bypass.
   - Piped non-interactive execution: uses `exec --json --ephemeral --sandbox read-only --skip-git-repo-check -` with prompt written to stdin and stdin closed immediately.
   - Stream event normalization: maps NDJSON `item.completed` (`agent_message`) and `item.delta` to MAVE `delta`, `turn.completed` to `BrainUsage`, and error/exit codes to canonical `BrainErrorCode`.
4. **Model Execution Handoff:**
   - Receives resolved runtime model strictly through `options.modelId` (with fallback to default configured provider model). Never reads `request.overrides.preferredModelId` directly.
5. **Selection & Routing Integration:**
   - S3 CODING fallback priority: `Claude Code` $\to$ `Codex` $\to$ `Antigravity`.
   - In AUTO mode: Codex participates as an eligible executable candidate.
   - In PREFERRED mode: Codex is prioritized, falling back to priority list if allowed.
   - In LOCKED mode: Codex is exclusively selected; if unavailable, routing fails closed without silent fallback.

---

## 10. Future Settings Contract (Design Specification)

*(UI implementation deferred to post-Pre-M5 UI Redesign)*

### 10.1 AI Runtimes Panel
```text
┌──────────────────────────────────────────────────────────────┐
│ AI Runtimes                                                  │
├──────────────────────────────────────────────────────────────┤
│ [✓] OpenAI Codex          Status: Ready (ChatGPT Auth)       │
│     Default Model Role:   Auto (gpt-5.6-sol)                 │
│     Allowed for:          [✓] Coding  [✓] Deep Reasoning     │
│                                                              │
│ [✓] Anthropic Claude Code Status: Ready (Claude Pro Auth)    │
│     Default Model Role:   Auto (Sonnet)                      │
│     Allowed for:          [✓] Deep Reasoning  [✓] Planning   │
│                                                              │
│ [✓] Google Antigravity    Status: Ready (Google One Auth)    │
│     Default Model Role:   Auto (Gemini 3.8 Flash High)       │
│     Allowed for:          [✓] Agent Work  [✓] Project Tasks  │
│                                                              │
│ [ ] Paid Cloud APIs       Status: Disabled by Default        │
│     [Enable Paid APIs]    Requires explicit billing opt-in   │
└──────────────────────────────────────────────────────────────┘
```

### 10.2 Task Routing Panel
```text
┌──────────────────────────────────────────────────────────────┐
│ Task Routing Rules                                           │
├──────────────────────────────────────────────────────────────┤
│ Quick Conversation:  Runtime: [ Auto ▼ ]   Role: [ FAST      ▼ ]│
│ Deep Reasoning:      Runtime: [ Auto ▼ ]   Role: [ REASONING ▼ ]│
│ Coding:              Runtime: [ Auto ▼ ]   Role: [ CODING    ▼ ]│
│ Agent Work:          Runtime: [ Auto ▼ ]   Role: [ AGENT     ▼ ]│
│ Language Practice:   Runtime: [ Auto ▼ ]   Role: [ FAST      ▼ ]│
└──────────────────────────────────────────────────────────────┘
```

---

## 11. Quota-Aware Routing Engine & Subscription Fallback (F1.5-S4 Implementation)

### 11.1 Architectural Invariants & Non-Negotiable Boundaries
1. **Health $\neq$ Quota (No Health Distortion):**
   - Health represents binary operational infrastructure status (`healthy`, `degraded`, `unhealthy`, `unconfigured`).
   - Quota represents subscription billing/capacity exhaustion (`quota_limited`, `rate_limited`).
   - A runtime whose quota is temporarily exhausted remains `healthy` in provider health checks; its operational infrastructure is not degraded or broken.
2. **Zero Breaking Changes to `@mave/contracts`:**
   - Canonical brain error codes (`'quota_limited'`, `'rate_limited'`) and model availability schemas already existed. No new error types or interface mutations were introduced to `@mave/contracts`.
3. **Pre-Execution Only Routing Fallback (F1.4 Invariant):**
   - Fallback to alternative subscription runtimes occurs **STRICTLY PRE-EXECUTION** within `BrainRouter.route()`.
   - Once `provider.chat()` invocation begins, **NO mid-stream cross-provider fallback** is permitted.
   - If a provider yields or throws `quota_limited` / `rate_limited` mid-turn:
     - The request terminates cleanly with a typed `request_failed` event.
     - `executionTelemetry` records `routeAttempts: 1` and `selectedProviderId`.
     - `RuntimeQuotaStore` records the quota limitation.
     - Next-turn requests automatically skip the exhausted runtime and route cleanly to the next eligible candidate.
4. **Strict Provider-Kind Boundaries:**
   - `agent_work` tasks are restricted exclusively to `agent_runtime_provider` instances (`Claude Code`, `Codex`, `Antigravity`).
   - Under no circumstances does an exhausted subscription agent runtime fall back to a direct `model_provider` or local LLM.
5. **Paid API Safety (Default-Deny Policy):**
   - Metered/Paid APIs remain strictly blocked (`allowPaidApis: false`).
   - Quota exhaustion on subscription runtimes never triggers accidental fallback to paid APIs. Credential presence != billing permission.

### 11.2 State & Storage (`RuntimeQuotaStore`)
- Located in `@mave/core/brain/quota/store.ts`.
- Manages in-memory tracking of subscription quota states per provider ID:
  ```typescript
  interface RuntimeQuotaState {
    readonly providerId: string;
    readonly status: 'unknown' | 'available' | 'quota_limited' | 'rate_limited';
    readonly observedAt: number;
    readonly resetAt?: number;
    readonly source: 'runtime_error' | 'successful_execution' | 'explicit_probe' | 'manual_invalidation' | 'unknown';
    readonly reason?: string;
    readonly lifecycleToken?: string;
  }
  ```
- **Concurreny & Stale Observation Protection:**
  - Observations with older timestamps (`observedAt < existing.observedAt`) are rejected.
  - For simultaneous observations with identical timestamps, higher-severity status wins (`quota_limited` > `rate_limited` > `available` > `unknown`).
- **Sensitive Text Sanitization:**
  - Error reasons undergo automatic pattern redaction (`[REDACTED]`) to guarantee zero exposure of API tokens, bearer headers, or session cookies in quota diagnostics or logs.
- **Provider Instance Lifecycle Binding:**
  - If a provider is unregistered and re-registered with a new lifecycle token, previous quota observations are unlinked and expire immediately to `'unknown'`.

### 11.3 Window Expiration Semantics
- **No Hardcoded Assumptions:**
  - MAVE does not assume a global "5-hour" limit. `resetAt` is stored only when explicitly reported by provider events/headers (e.g., Claude `rate_limit_event.resetsAt`, OpenAI HTTP 429 reset headers).
- **Expiration to Unknown:**
  - When `clock() >= resetAt`, the quota block expires strictly to status `'unknown'`, **NEVER** automatically to `'available'`.
  - Entitlement must be proven by successful runtime execution or explicit probe.
  - Active blocks are evaluated dynamically via `isQuotaBlocked(state, now)`.

### 11.4 Pre-Execution Routing Selection Policy
- In `BrainRouter.route()`:
  - **LOCKED Mode:** If the locked runtime is quota-limited, router fails immediately with `quota_limited` / `rate_limited` (`attemptedProviderIds: []`). Fallback is forbidden.
  - **PREFERRED Mode (`allowFallback: false`):** If preferred runtime is quota-limited, router fails immediately with `quota_limited` (`attemptedProviderIds: []`).
  - **PREFERRED Mode (`allowFallback: true`):** Skips quota-limited preferred runtime and falls back to the next eligible priority candidate.
  - **AUTO Mode:** Evaluates candidate runtimes in configured priority order; skips quota-limited runtimes pre-execution.
  - **Quota Routing Preferences:**
    - `priority_first` (default): Preserves configured priority order among all non-blocked candidates (`available` and `unknown`), preventing transient one-off runs from demoting the primary runtime.
    - `available_first`: Prioritizes verified `available` runtimes ahead of `unknown` runtimes.
- **Telemetry Invariant:**
  - Skipped quota-blocked runtimes are never contacted, never pushed to `attemptedProviderIds`, and never increment `routeAttempts`.
  - Diagnostics surface `quotaSkippedProviders`, `providerQuotaState`, `quotaPreference`, and `quotaSelectionReason`.

### 11.5 Next-Turn Execution Fallback & Telemetry
```text
TURN 1:
User Request
  → Router selects Claude Code (Primary)
  → Execution begins: claude.chat()
  → Claude encounters quota limit: emits error ('quota_limited', resetAt)
  → ConversationRuntime emits request_failed ('quota_limited')
  → QuotaStore records Claude Code as quota_limited
  → Request terminates cleanly (routeAttempts = 1, NO midstream fallback)

TURN 2:
User Follow-up Request
  → Router pre-evaluates candidates
  → Claude Code is skipped (QuotaStore.isBlocked = true)
  → Router selects Codex (attemptedProviderIds = ['codex'], routeAttempts = 0)
  → Execution begins: codex.chat()
  → Codex succeeds: emits completed
  → ConversationRuntime emits response_completed
  → QuotaStore records Codex as available
  → Turn 2 completes cleanly (routeAttempts = 1)
```

---

### 11.6 Quota Scope & Blocked-State Hardening (F1.5-S4.1)

To prevent model-specific capacity limits or generic transient errors from corrupting provider-level subscription routing:

#### 1. Explicit Quota Scopes
Quota signals are partitioned into three distinct semantic scopes:
- **`runtime`:** Provider-level subscription limits (e.g., Claude rolling 5-hour/7-day windows, ChatGPT Plus/Pro plan limits, project-wide daily quota). Stored in `RuntimeQuotaStore` and blocks provider-level routing until `resetAt`.
- **`model`:** Model-specific capacity or rate limits (e.g., `claude-3-opus`, `gpt-4o`, `GenerateContentRequestsPerMinutePerModel`). Integrated directly with `RuntimeModelCatalog` by updating model `availability: 'quota_limited'` and storing `metadata.resetAt`. **NEVER** blocks the provider runtime; alternate eligible models in the same subscription runtime remain fully routable.
- **`unknown`:** Generic rate limit or HTTP 429 signals lacking explicit model or account context. Fails the immediate invocation with precision (`quota_limited` / `rate_limited`) but **NEVER** falsely blocks the provider account-wide on subsequent turns.

#### 2. Scope-Aware Overwrite Protection
In `RuntimeQuotaStore`:
- An active runtime-scoped block (`scope: 'runtime'`) can **NEVER** be cleared or downgraded by a model-scoped observation (`scope: 'model'`), whether that observation is a successful execution (`status: 'available'`) or a model error (`status: 'quota_limited'`).
- A successful model execution updates only that specific model in `RuntimeModelCatalog` and records `scope: 'model'` in `RuntimeQuotaStore`, preserving any active runtime block.
- Only a runtime-scoped success (`scope: 'runtime', status: 'available'`) with a newer observation timestamp can clear an active runtime block.

#### 3. Strict Model Expiration to 'unknown'
In `RuntimeModelCatalog`:
- When `now >= metadata.resetAt`, model availability transitions strictly to `'unknown'`, **NEVER** automatically to `'available'`.
- Models in `'unknown'` state become eligible for optimistic AUTO candidate selection, where actual entitlement will be verified upon execution.
- `RuntimeModelCatalog.clearExpired(now)` batch-cleans expired model blocks across all tracked subscription runtimes.

#### 4. Error Precision for Blocked Candidates
When all candidate runtimes are blocked before execution:
- If all candidates are `quota_limited` $\to$ `code: 'quota_limited'`, message indicates all candidates are quota limited.
- If all candidates are `rate_limited` $\to$ `code: 'rate_limited'`, message indicates all candidates are rate limited.
- If candidates are mixed $\to$ deterministic `code: 'quota_limited'` with explanatory message: `"All candidate subscription runtimes [...] are currently quota or rate limited"`.

---

### 11.7 Authoritative State Ownership & Model Rotation (F1.5-S5 Closeout)

#### 1. Authoritative State Partitioning
- **Runtime-Wide Quota:** Authoritatively owned by `RuntimeQuotaStore`, keyed strictly by `providerId`. Only `scope: 'runtime'` states can actively block a provider runtime (`isQuotaBlocked(state) === true`).
- **Model-Specific Quota:** Authoritatively owned by `RuntimeModelCatalog`, keyed by `[runtimeProviderId, modelId]`. Each model descriptor maintains its own independent `availability` (`quota_limited`, `rate_limited`, `available`, `unknown`) and optional `metadata.resetAt`.
- **Unknown-Scope Diagnostics:** Non-authoritative diagnostics. Fails the immediate execution turn cleanly without claiming account-wide exhaustion, leaving provider unblocked for subsequent turns.
- **Zero Collision Guarantee (Design A):** Model-scoped observations are not stored in `RuntimeQuotaStore.states` under provider-level keys. Thus, Model A (`claude-3-opus`) being `quota_limited` cannot overwrite or clear Model B (`claude-3-5-sonnet`) being `available`, and Model B's successful execution cannot clear Model A's quota block.

#### 2. Vendor-Neutral Model Rotation
- `@mave/core` contains zero concrete vendor model generation names or hardcoded entitlement lists.
- Model mapping flows dynamically: `TaskIntent` $\to$ `BrainProfile` $\to$ `ModelRole` $\to$ `selectRuntimeModel()` via `RuntimeModelCatalog`.
- When vendors release new models, aliases, or revisions tomorrow (e.g., `gpt-5`, `claude-4`, `gemini-3`):
  - `TaskPolicy`, `BrainProfile`, access/billing policies, and quota architecture require **ZERO changes**.
  - Only provider-private discovery adapters or configuration mappings require additive updates.

#### 3. Honest Route Gap Accounting
- **`fast_conversation`:** Requires direct `model_provider` with interactive latency ($\approx 1\text{--}3\text{s}$ voice TTFT). Agent runtimes (`Claude Code`, `Codex`, `Antigravity`) are **NOT** model providers and must never be routed to `fast_conversation`. Direct subscription route gap remains open.
- **`deep_reasoning`:** Requires direct `model_provider` with deep reasoning quality. Direct subscription route gap remains open.
- **`language`:** Task policy and role mappings are ready; direct conversational subscription route gap remains open.
- **`research`:** Task policy ready; full truth/retrieval architecture is scheduled for Milestone F1.8.

---

## 12. Follow-Up Phasing Plan

- **F1.5-S (COMPLETE):** Subscription-First foundation, access/billing classification, paid API blocking, runtime audits, canonical architecture documentation.
- **F1.5-S1 (COMPLETE):** Claude Code subscription runtime normalization (`ClaudeCodeBrainProvider`).
- **F1.5-S2 (COMPLETE):** Runtime Model Catalog & Model Role mapping engine (`RuntimeModelCatalog`, `selectRuntimeModel`).
- **F1.5-S2.1 (COMPLETE):** Runtime model handoff and availability hardening (`options.modelId` per-invocation).
- **F1.5-S3 (COMPLETE):** Task $\to$ Runtime $\to$ Model deterministic routing engine (`TaskPolicy`, `RuntimePolicy`, AUTO/PREFERRED/LOCKED).
- **F1.5-S3.1 (COMPLETE):** Routing telemetry & executable provider hardening (`attemptedProviderIds` vs evaluated candidates).
- **F1.5-S3.2 (COMPLETE):** Codex subscription runtime normalization (`CodexBrainProvider`, ChatGPT auth, billing isolation, headless execution, tool suppression).
- **F1.5-S3.3 (COMPLETE):** Tri-runtime live smoke verification (Claude Code, OpenAI Codex, Google Antigravity).
- **F1.5-S4 (COMPLETE):** Quota-aware subscription runtime routing & next-turn fallback engine (`RuntimeQuotaStore`, pre-execution routing skip, fail-closed boundaries).
- **F1.5-S4.1 (COMPLETE):** Quota scope & blocked-state hardening (`scope: 'runtime' | 'model' | 'unknown'`, `RuntimeModelCatalog` model quota integration, resetAt expiration to unknown, scope-aware overwrite protection).
- **F1.5-S5 (COMPLETE):** Subscription Intelligence final closeout audit (Authoritative state ownership, cross-model collision safety, model rotation readiness, documentation alignment, and tri-runtime closeout).
- **F1.5-C0 (COMPLETE):** Subscription Conversational Brain feasibility audit (evaluated subscription CLIs vs local model provider for fast_conversation and deep_reasoning; recommended Local Fast Brain).
- **F1.5-C1 (COMPLETE):** Local Model Provider Foundation (`OllamaBrainProvider` direct model provider, loopback localhost security, non-generation health check, dynamic catalog introspection, progressive NDJSON streaming, and zero paid API billing).
- **F1.5-C1.1 (COMPLETE):** Local Provider Qualification & Catalog Hardening (decoupled transport capabilities, non-generative embedding filter, unbenchmarked candidate isolation, tag collision safety, and qualification decoupling).
- **F1.5-C2 (COMPLETE):** Local Fast Brain Empirical Benchmarking & Model Qualification (latency, bilingual Thai/English quality, resident VRAM measurement, empirical threshold evaluation).
- **F1.5-C3 (NEXT):** Local Model Lifecycle & Resident Memory Management.
- **F1.5-C4:** Conversational Brain Closeout Audit.

---

## 13. Conversational Brain Feasibility Audit (F1.5-C0)

### 13.1 Executive Summary & Core Finding
The objective of F1.5-C0 was to determine whether MAVE can establish an official, subscription-backed execution path that behaves semantically as a true `model_provider` for `fast_conversation` and `deep_reasoning`, avoiding paid API tokens while preserving provider-kind boundaries.

**Conclusion:**  
**NO official subscription-backed `model_provider` path exists.**  
All three commercial subscription developer CLIs (Claude Code, OpenAI Codex, and Google Antigravity) are fundamentally engineered as **agent runtimes** (`agent_runtime_provider`). Even when run in one-shot or print modes (`-p`, `exec`, `--print`) with tools artificially suppressed:
1. They maintain intrinsic agent personas, project-scanning behaviors, workspace boundaries, and multi-step orchestration harnesses.
2. They introduce severe process initialization and scanning overhead ($2.5\text{--}12.0\text{s}$), failing the interactive voice TTFT threshold ($\approx 1\text{--}3\text{s}$).
3. Attempting to classify them as `model_provider` would violate MAVE's provider-kind semantics and distort session state ownership.
4. Accessing raw conversational model endpoints without per-token paid APIs would require reverse-engineering undocumented web APIs or intercepting browser session cookies, which is strictly forbidden.

**Recommended Path:**  
**`LOCAL FAST BRAIN RECOMMENDED`**  
A dedicated local inference engine (e.g., local Ollama/llama.cpp serving an efficient bilingual Thai/English model like Qwen 2.5 3B/7B on the host RTX 3060 Ti 8GB GPU) delivers pure `model_provider` semantics, ultra-low TTFT ($\approx 150\text{--}600\text{ms}$), complete privacy, and zero token costs, establishing an optimal hybrid architecture alongside MAVE's subscription agent runtimes.

---

### 13.2 Decision Matrix

| Evaluation Dimension | Claude Subscription (`claude`) | OpenAI Codex (`codex`) | Google Antigravity (`agy`) | Local ModelProvider (Ollama / llama.cpp) |
|---|---|---|---|---|
| **Official Supported Access?** | Yes (`claude` CLI) | Yes (`codex` CLI) | Yes (`agy` CLI) | Yes (Local HTTP / process API) |
| **Subscription-Backed?** | Yes (Claude Pro/Max) | Yes (ChatGPT Plus/Pro) | Yes (Google Subscription) | N/A (100% Free / Local Hardware) |
| **True `model_provider` Semantics?** | **NO** (Agent harness) | **NO** (Agent harness) | **NO** (Agent harness) | **YES** (Direct prompt $\to$ stream) |
| **Autonomous Agent Loop?** | Yes | Yes | Yes | **None** |
| **Tools Suppressible?** | Partial (`--tools ""`) | **NO** (Sandbox only) | **NO** (Sandbox only) | **YES** (Zero native tools) |
| **MAVE Owns Session State?** | No (CLI internal session) | No (Codex threads) | No (CLI conversation) | **YES** (Stateless requests) |
| **Streaming Output?** | Yes (`stream-json`) | Yes (`--json` JSONL) | Yes (`stream-json`) | Yes (SSE / NDJSON token chunks) |
| **Cancellation?** | Yes (SIGINT / process kill) | Yes (SIGINT / process kill) | Yes (SIGINT / process kill) | Yes (`AbortSignal` / disconnect) |
| **Model Selection?** | Dynamic (`--model`) | Dynamic (`-m`) | Dynamic (`--model`) | Dynamic (`model: string`) |
| **Process Reuse / Pooling?** | High risk (state leakage) | Experimental (`app-server`) | High risk | **YES** (Native persistent server) |
| **Measured/Expected TTFT?** | $3.5\text{--}8.0\text{s}$ (FAIL) | $2.5\text{--}6.0\text{s}$ (FAIL) | $4.0\text{--}12.0\text{s}$ (FAIL) | **$150\text{--}600\text{ms}$ (PASS: $\le 1\text{--}3\text{s}$)** |
| **`fast_conversation` Eligible?** | **INELIGIBLE** | **INELIGIBLE** | **INELIGIBLE** | **ELIGIBLE** (Ideal candidate) |
| **`deep_reasoning` Eligible?** | Ineligible for direct | Ineligible for direct | Ineligible for direct | **ELIGIBLE** (e.g., DeepSeek-R1 7B) |
| **Implementation Complexity?** | High (wrapper/hack) | High (hack/sandboxing) | High (hack/sandboxing) | Low (Standard OpenAI-compatible client) |
| **Architectural Risk?** | **Critical** (Provider-kind faking) | **Critical** (Provider-kind faking) | **Critical** (Provider-kind faking) | **Low** (Clean decoupled provider) |

---

### 13.3 Recommended Hybrid Target Architecture
MAVE adopts a clean, decoupled 4-tier intelligence architecture:
1. **Fast Conversation / Voice / Language:**  
   $\to$ **Local Direct `model_provider`** (Ollama / llama-server with Qwen 2.5 3B–7B on RTX 3060 Ti).  
   - Latency: $\approx 150\text{--}600\text{ms}$ TTFT.  
   - Cost: \$0.00 / zero per-token billing.  
   - Privacy: 100% offline, local memory.  
   - Capabilities: Native bilingual Thai and English conversational fluency.
2. **Deep Reasoning:**  
   $\to$ **Local Capable Reasoning Provider** (e.g., DeepSeek-R1-Distill 7B) or future dedicated direct reasoning provider without agent tool overhead.
3. **Agent Work / Heavyweight Coding:**  
   $\to$ **Claude Code / OpenAI Codex / Google Antigravity** via MAVE's verified F1.5-S subscription agent runtime engine (`agent_runtime_provider`).  
   - Cost: Covered by existing user subscriptions.  
   - Capabilities: Multi-step software engineering, repository mutation, terminal execution.
4. **Tool Execution Authority:**  
   $\to$ **Milestone 5 MCP & MAVE Tool Router**, preserving strict least-privilege security boundaries.

---

## 14. Local Model Provider Foundation (F1.5-C1)

### 14.1 Motivation & Architectural Role
F1.5-C0 proved that commercial subscription CLIs (Claude Code, OpenAI Codex, Google Antigravity) cannot satisfy direct conversational brain profiles (`fast_conversation`, `language`) due to their inherent agent runtime architectures, non-suppressible tools, and prohibitive process initialization overhead ($2.5\text{--}12.0\text{s}$).

**F1.5-C1 implements MAVE's canonical local direct `model_provider`:** `OllamaBrainProvider`.  
This establishes a production-grade local fast conversational brain running on host hardware (NVIDIA GeForce RTX 3060 Ti 8GB VRAM) without consuming paid API tokens, faking provider kinds, or violating Pre-M5 tool authority constraints.

### 14.2 Technical Architecture & Guarantees

| Invariant | Specification | Enforcement Mechanism |
|---|---|---|
| **Provider ID** | `'ollama'` | Canonical `OLLAMA_PROVIDER_ID` constant |
| **Provider Kind** | `'model_provider'` | Implements `ModelCatalogProvider` (not `agent_runtime_provider`) |
| **Access Path** | `'local_runtime'` | Local daemon HTTP interface; zero remote egress |
| **Access Class** | `'local'` | Zero external billing, zero credit card / token consumption |
| **Privacy Class** | `'local_only'` | All prompt text and generation remain strictly on-device |
| **Host Confinement** | Loopback Only | `assertLoopbackEndpoint()` strictly validates hostname $\in \{127.0.0.1, \text{localhost}, ::1\}$ |
| **Health Probe** | Zero Generation Tokens | Hits `GET /api/version` (fast $\approx 15\text{ms}$); does NOT dispatch `/api/chat` or `/api/generate` |
| **Catalog Discovery** | Dynamic Local Introspection | Hits `GET /api/tags`; derives `ModelDescriptor` based on installed parameter size and quantization |
| **Model ID Handoff** | Explicit & Normalized | Requires `options.modelId`; resolves bidirectional mapping (`ollama-qwen2.5-1.5b` $\leftrightarrow$ `qwen2.5:1.5b`) |
| **Streaming Output** | Progressive NDJSON | Parses NDJSON stream line-by-line; emits `started`, `delta`, and `completed` events |
| **Barge-in Cancellation**| Instant AbortSignal | Interruption triggers `AbortController.abort()`, releasing lock and emitting `cancelled` |
| **Usage Tracking** | Accurate Token Counts | Captures `prompt_eval_count`, `eval_count`, `totalTokens`, `timeToFirstTokenMs`, and `estimatedCostUsd: 0` |
| **Tool Authority** | Zero Pre-M5 Authority | `capabilities.toolUse = false`; no tool invocation or execution hooks permitted |

### 14.3 Host Hardware & Resident Performance Profile
- **Host GPU:** NVIDIA GeForce RTX 3060 Ti (8GB GDDR6 VRAM, 4864 CUDA cores).
- **Installed Verified Models & File Footprints:**
  - `qwen2.5:1.5b` (0.92 GB on-disk weight file) $\to$ **Warm TTFT: 202 ms** (eval duration: 759 ms for 144 tokens $\to$ 189.7 tok/s generation throughput; total end-to-end latency: 961 ms $\to$ 149.8 tok/s overall throughput).
  - `qwen2.5:7b` (4.36 GB on-disk weight file) $\to$ Installed candidate on disk; bilingual Thai/English conversational quality and runtime VRAM footprint pending empirical qualification in F1.5-C2.
  - `deepseek-r1:7b` (4.36 GB on-disk weight file, 128k context) $\to$ Installed candidate on disk; local deep reasoning and runtime VRAM footprint pending empirical qualification in F1.5-C2.
- **Disk Size vs. Runtime VRAM Clarification:**
  - The reported 0.92 GB and 4.36 GB values represent physical model weight file sizes stored on disk, **not** dynamic runtime VRAM footprint.
  - Runtime VRAM usage includes base weights loaded into GPU memory, KV cache allocation (proportional to active context length), and scratchpad activation buffers. Precise VRAM metrics will be empirically captured during F1.5-C2 benchmarking.
- **VRAM Lifecycle Management:** Models are loaded into VRAM on request and kept resident via Ollama's 5-minute `keep_alive` window. When idle, memory automatically frees to 0 bytes VRAM.

### 14.4 Desktop & Routing Pipeline Integration
- **`apps/desktop/src/main/conversation-manager.ts`:** Instantiates `OllamaBrainProvider` as a registered `model_provider` with `accessPath: 'local_runtime'` and `accessClass: 'local'`. App startup is fully decoupled and never crashes if the local Ollama daemon is offline.
- **`packages/core/src/brain/brain-router.ts`:**
  - Resolves `fast_conversation` and `language` to `ollama` when present and healthy with qualified models.
  - Rejects `agent_runtime_provider` candidates fail-closed for direct conversational profiles.
  - Enforces `localOnly: true` privacy constraints, routing solely to local providers and rejecting cloud services.

### 14.5 Local Provider Qualification & Catalog Hardening (F1.5-C1.1)

#### 1. Transport Capabilities vs. Model Capabilities Decoupling
- `OllamaBrainProvider.getCapabilities()` represents transport/host capabilities only:
  - `streaming: true`, `local: true`, `structuredOutput: true`, `cancellation: true`.
  - Content/task capabilities (`fastChat: false`, `reasoning: false`, `coding: false`, `supportsThai: false`, `supportsEnglish: false`) remain `false` at the provider level until models are qualified.

#### 2. Non-Generative Discovery Filtering (`isGenerativeChatModel`)
- Ollama's `GET /api/tags` returns embedding, vision, and tool capabilities per model.
- Embedding-only models (such as `nomic-embed-text:latest` with `capabilities: ['embedding']`) lack generative text capabilities (`'completion'`).
- `isGenerativeChatModel()` strictly filters out embedding-only models, preventing them from appearing in MAVE's conversational model catalog.

#### 3. Unbenchmarked Discovered Candidate Isolation
- Auto-discovered models from local Ollama are registered with `(Local Ollama - Candidate)` in their display name.
- By default, unbenchmarked discovered models receive:
  - `fastChat: false`, `supportsThai: false`, `supportsEnglish: false`, `reasoning: false`, `qualityClass: 'balanced'`.
- This ensures that discovered models **cannot win AUTO routing** for `fast_conversation` or `language` tasks prior to empirical benchmarking in F1.5-C2.

#### 4. Explicit Model Qualification Decoupling
- Model qualifications are tracked via `LocalModelQualification` records.
- Only when a model has been empirically benchmarked and granted `productionApproved: true` are production capabilities (`fastChat: true`, `supportsThai: true`, etc.) assigned in the model catalog.
- If no qualified local models exist, `BrainRouter` fails closed with `fast_brain_unavailable` rather than selecting unbenchmarked or non-conversational models.

#### 5. Tag Collision Safety & Direct Syntax Fallback
- Unique Model IDs (`ollama-<normalized-slug>`) are disambiguated with incremental counters if multiple tags collide to the same base name.
- `resolveConcreteModelTag()` verifies the authoritative model ID mapping first, supports direct tag syntax (`<name>:<tag>`, `<org>/<model>:<tag>`), and provides fallback.

### 14.6 Teacher / Escalation Architecture Notes ("Similarity != Permission")
- While local models and cloud subscription models may share similar conversational interfaces, **similarity does not confer permission**.
- **Canonical Architectural Distinction:**
  - **Intelligence Escalation (Thinking / Answering):**  
    Escalation from Local Fast Brain $\to$ Commercial Subscription Runtimes (`Claude Code`, `Codex`, `Antigravity`) for deep reasoning, architectural planning, or complex coding may occur automatically according to MAVE's routing policy, task complexity, user preferences, and access/billing boundaries.
  - **Tool / Action Execution (Mutating Real State):**  
    Mutating files, executing shell commands, browser automation, or invoking external MCP tools must strictly pass through Milestone 5 permission policies: `ALLOW`, `ASK`, or `DENY`.
  - **Billing Protection:** Paid API usage strictly requires explicit user billing authorization (`allowPaidApis: true`).
  - **Lock Invariant:** `LOCKED` runtime/model selections must never be silently bypassed or overridden.
  - **Similarity != Permission:** Knowledge similarity or prompt overlap may inform routing heuristics, but never confers execution authority or tool privileges. Local conversational models remain in a zero-privilege stateless sandbox.

---

## 15. Local Fast Brain Empirical Benchmarking & Model Qualification (F1.5-C2)

### 15.1 Benchmark Objective & Methodology
Milestone F1.5-C2 empirically evaluated all currently installed local generative models on the user's host machine to determine the production candidate for MAVE's Fast Conversation Brain (`fast_conversation` profile / `FAST` role).

- **Canonical Path:** Invocations were routed through MAVE's real runtime stack (`BrainRouter` $\to$ `ModelCatalogRuntime` $\to$ `OllamaBrainProvider` $\to$ Ollama HTTP `/api/chat` $\to$ `BrainEvents`), measuring true end-to-end event latency.
- **Hardware Environment:**
  - Host OS: Windows 11
  - CPU: 12th Gen Intel(R) Core(TM) i5-12400F (6 cores, 12 threads)
  - System RAM: 32 GB (31.8 GB visible)
  - GPU: NVIDIA GeForce RTX 3060 Ti 8GB GDDR6 (driver 610.88, baseline desktop VRAM: ~2002 MiB)
  - Ollama Daemon: version 0.33.2 on `http://127.0.0.1:11434`
  - Audio STT Service: `faster-whisper` `large-v3-turbo` on CUDA (`float16`), allocating ~1.6 GB VRAM when active
- **Controlled Generation Parameters:**
  - Context window (`num_ctx`): 4096 (4K)
  - Temperature: 0.7
  - Top-P: 0.9
  - Max tokens (`num_predict`): 150–250 tokens
  - Model residency keep-alive: 5 minutes (`keep_alive: '5m'`)
- **Cold vs. Warm Methodology:**
  - **Cold Run:** Prior models explicitly unloaded via POST `/api/generate` with `keep_alive: 0`; verified `/api/ps` empty; measured cold model load duration and initial TTFT (min 2 runs).
  - **Warm Run:** Model resident in VRAM; measured steady-state TTFT, generation throughput, and end-to-end latency (min 3 runs).

### 15.2 Stage A: Performance & Latency Screening (All 5 Candidates)

| Model Tag | Parameters | Quantization | Ollama Digest | Resident VRAM | Peak GPU Used | GPU Headroom (8GB) | Median Cold TTFT | Median Warm TTFT | Median Gen Speed | Stage A Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| **`qwen2.5:1.5b`** | 1.5B | Q4_K_M | `65ec0654...` | **1,112 MiB** | 3,284 MiB | **4,908 MiB** | 2,571.5 ms | **96.0 ms** | 16.9 tok/s | **ADVANCED TO STAGE B** |
| **`qwen2.5:7b`** | 7.6B | Q4_K_M | `845dbda0...` | **4,528 MiB** | 6,664 MiB | **1,528 MiB** | 4,755.5 ms | **393.0 ms** | 16.7 tok/s | **ADVANCED TO STAGE B** |
| `qwen2.5-coder:7b`| 7.6B | Q4_K_M | `dae161e2...` | 4,528 MiB | 6,664 MiB | 1,528 MiB | 4,997.0 ms | 89.0 ms | 16.7 tok/s | **ELIMINATED** (Code syntax specialization) |
| `deepseek-r1:7b` | 7.6B | Q4_K_M | `755ced02...` | 4,528 MiB | 6,664 MiB | 1,528 MiB | 6,526.0 ms | **1,495.0 ms** | 71.2 tok/s | **ELIMINATED** (`<think>` stream delays TTFT) |
| `llava:7b` | 7.0B | Q4_0 | `8dd30f6b...` | 4,493 MiB | 6,629 MiB | 1,563 MiB | 18,248.0 ms | 369.0 ms | 16.6 tok/s | **ELIMINATED** (Multimodal vision specialist) |

#### Stage A Elimination Rationale:
1. **`deepseek-r1:7b`:** Produces mandatory chain-of-thought tokens inside `<think>...</think>` before emitting the first user-visible answer token. In screening runs, visible TTFT averaged $1,495\text{--}3,003\text{ ms}$, and multiple prompts exhausted the max-token budget while still in `<think>`, yielding empty or truncated responses. Unsuitable for interactive voice (`fast_conversation`). Ideal candidate for future local `deep_reasoning`.
2. **`llava:7b`:** Vision specialist with severe cold load times (32.7s run 1) and heavy 4.5 GB VRAM footprint without conversational voice optimization.
3. **`qwen2.5-coder:7b`:** Code generation syntax specialist; exhibited programming syntax bias in casual conversational turns compared to general instruction models.

---

### 15.3 Stage B: Conversational Qualification Matrix (100-Point Rubric)

| Evaluation Category | Weight | `qwen2.5:1.5b` | `qwen2.5:7b` | Notes & Comparison |
|---|---|---|---|---|
| **Thai Conversation** | 20 | 16.5 / 20 | **18.5 / 20** | 7B captures exceptional slang, emotional empathy, and natural tone; 1.5B is fluent and natural with simpler vocabulary. |
| **English Conversation** | 10 | 8.5 / 10 | **9.5 / 10** | Both natural and casual; 7B provides richer phrasing. |
| **Language Learning** | 15 | 13.0 / 15 | **14.5 / 15** | Both correctly diagnose grammar errors (`He don't` $\to$ `doesn't`); 7B offers superior bilingual explanation. |
| **Instruction Following** | 15 | 12.5 / 15 | **13.5 / 15** | Both adhere strictly to brevity and structural constraints. |
| **Voice Friendliness** | 10 | **9.0 / 10** | 8.0 / 10 | 1.5B produces ultra-clean, concise spoken sentences without excessive lists or markdown; ideal for TTS. |
| **Short Reasoning** | 10 | 8.0 / 10 | **9.0 / 10** | Both successfully solve budget division and everyday decision support. |
| **Uncertainty / Reliability** | 5 | 4.0 / 5 | **4.5 / 5** | Both acknowledge unanswerable/missing information without hallucinating. |
| **Warm Latency** | 7 | **7.0 / 7** | 6.0 / 7 | 1.5B median warm TTFT is **96 ms** vs 7B median warm TTFT of **393 ms**. |
| **Cold Latency** | 3 | 1.0 / 3 | 1.0 / 3 | 1.5B cold TTFT (2,571 ms) is almost 2x faster than 7B (4,755 ms). |
| **VRAM & Coexistence** | 5 | **5.0 / 5** | 3.0 / 5 | 1.5B uses **1,112 MiB** (leaves 4.9 GB free); 7B uses **4,528 MiB** (leaves 1.5 GB free). |
| **TOTAL QUALIFICATION SCORE** | **100** | **84.5 / 100** | **87.5 / 100** | **Both pass qualification threshold ($\ge 75/100$)** |

#### Multi-Turn Context Retention Test:
- Turn 1: User specifies: *"ผมชอบดื่มชาเขียวมะนาวหวานน้อย ไม่ชอบกาแฟเลยนะ จำไว้ด้วยล่ะ"*
- Turn 2: Intervening chit-chat: *"อากาศช่วงนี้เป็นยังไงบ้าง"*
- Turn 3: Recall prompt: *"บ่ายนี้ง่วงจัง แนะนำเครื่องดื่มให้ผมสักแก้วสิ"*
- **Result:** **BOTH MODELS PASSED cleanly.** Both models explicitly recommended green tea lemonade based on Turn 1 preference and avoided coffee.

---

### 15.4 Winner Recommendation & Hardware Coexistence Analysis

#### **QUALIFIED WINNER: `qwen2.5:1.5b` (`FAST` Role)**
1. **Instantaneous Voice Latency:** Median warm TTFT of **96 ms** (and down to 24–26 ms in live smoke) enables fluid, conversational voice turn-taking and responsive barge-in.
2. **Rock-Solid Hardware Headroom on 8GB GPU:**
   - Windows desktop baseline: ~2.0 GB VRAM
   - `faster-whisper` STT (`large-v3-turbo` CUDA `float16`): ~1.6 GB VRAM
   - `qwen2.5:1.5b` resident footprint: ~1.1 GB VRAM
   - **Total Active Footprint:** $2.0 + 1.6 + 1.1 = \mathbf{4.7\text{ GB}}$, leaving **3.3 GB of uncommitted VRAM headroom**.
   - Zero risk of CUDA out-of-memory errors or system RAM paging during concurrent STT and speech synthesis.
3. **Voice Friendliness:** Naturally concise output without conversational bloat.

#### **QUALIFIED RUNNER-UP: `qwen2.5:7b` (`BALANCED` Role)**
1. **Superior Nuance & Fluency:** Achieved 87.5/100 total score with richer bilingual explanations and empathetic Thai phrasing.
2. **Hardware Coexistence Warning on 8GB GPU:**
   - Active footprint with CUDA STT: $2.0 + 1.6 + 4.5 = \mathbf{8.1\text{ GB}}$, which exceeds the 8.0 GB physical boundary.
   - Running `qwen2.5:7b` alongside local CUDA STT risks VRAM contention and performance degradation.
   - Recommended as secondary candidate for text-only conversations or when audio STT runs on CPU.

---

### 15.5 C2 / C3 Boundary & Persistence Architecture
- **Fail-Closed Production Routing:** In strict compliance with Milestone C2 requirements, all models in [`CANONICAL_LOCAL_MODEL_QUALIFICATIONS`](file:///c:/project/MAVE/packages/providers/src/brain/qualification-data.ts) maintain:
  ```ts
  productionApproved: false
  ```
- AUTO routing for `fast_conversation` remains fail-closed (`fast_brain_unavailable`) until Milestone F1.5-C3.
- Milestone F1.5-C3 authoritatively owns:
  - Setting `productionApproved: true` for the winning candidate.
  - Configuring production default routing and model aliases.
  - Implementing persistent resident memory lifecycle and idle unload policies.






