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

---

## 5. Runtime Model Mapping Matrix

Each subscription runtime maps MAVE model roles to its supported model inventory:

```text
[Codex Runtime]
  FAST       ──► gpt-5.6-mini / fast candidate
  CODING     ──► gpt-5.6-sol / codex default
  REASONING  ──► o3 / reasoning candidate

[Claude Code Runtime]
  FAST       ──► haiku
  BALANCED   ──► sonnet (default)
  REASONING  ──► opus / sonnet-thinking

[Antigravity Runtime]
  FAST       ──► gemini-3.8-flash-low
  REASONING  ──► gemini-3.8-flash-high / claude-sonnet-4-6
  AGENT      ──► gemini-3.8-flash-medium (default)
```

> [!IMPORTANT]
> If a subscription runtime lacks an eligible model for a requested role, that runtime is **ineligible** for that task, and the router falls back to the next compatible subscription or local runtime.

---

## 6. Empirical Subscription Runtime Audit

Audited October 2026 on local development environment:

### 6.1 OpenAI Codex
- **Local Executable:** `C:\Users\Jeffy\AppData\Local\OpenAI\Codex\bin\9614f1d9b40d9c4f\codex.exe` (`0.162.0-alpha.17.2`).
- **Official Auth:** ChatGPT subscription OAuth stored in `~/.codex/auth.json` (`auth mode: chatgpt`, zero stored API keys).
- **Transport & Reachability:** Websocket Responses API (`wss://chatgpt.com/backend-api/`).
- **Non-Interactive Mode:** `codex exec --json --ephemeral -s read-only`.
- **Model Control:** `-m, --model <MODEL>` flag, config overrides `-c model="..."`.
- **Model Discovery:** Maintained locally in `~/.codex/models_cache.json`.
- **Quota Semantics:** Bound to ChatGPT subscription limits. Returns rate limit event upon exhaustion.
- **Provider Kind:** **`agent_runtime_provider`** (incorporates command runner, sandbox, and file tools).
- **Voice Viability:** Unsuited for sub-2s voice TTFT due to sandbox setup and agent scaffolding.

### 6.2 Anthropic Claude Code
- **Local Executable:** `C:\Users\Jeffy\.local\bin\claude.exe` (`v2.1.272`).
- **Official Auth:** Claude subscription OAuth via `claude.ai` (`subscriptionType: "pro"`, `apiProvider: "firstParty"`).
- **Non-Interactive Mode:** `claude -p "<prompt>" --output-format json --tools "" --safe-mode`.
- **Model Control:** `--model <model>` (`sonnet`, `opus`, `haiku`, or version string).
- **Model Discovery:** Enumerated via CLI help / settings.
- **Quota Semantics:** 5-hour rolling session windows and weekly limits. Emits limit text with reset timestamp upon exhaustion.
- **Billing Isolation Invariant:** If `ANTHROPIC_API_KEY` is set in the environment, Claude Code may divert to metered API billing. MAVE must sanitize child process environment.
- **Provider Kind:** **`agent_runtime_provider`** (workspace scanning and CLI boot incur 3–8s latency).
- **Voice Viability:** Unsuited for interactive voice TTFT.

### 6.3 Google Antigravity
- **Local Executable:** `C:\Users\Jeffy\AppData\Local\agy\bin\agy.exe` (`v1.3.4`).
- **Official Auth:** Google account subscription.
- **Integration:** `AntigravityBrainProvider` via `agy --print --output-format stream-json`.
- **Model Discovery:** Non-quota command `agy models` lists available models and roles (`gemini-3.8-flash-high`, `gemini-3.8-flash-medium`, `gemini-3.8-flash-low`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, `gpt-oss-120b-medium`).
- **Model Control:** `--model <model>`, `--effort <effort>`.
- **Provider Kind:** **`agent_runtime_provider`**.
- **Voice Viability:** Unsuited for interactive voice TTFT (turn latency 4–12s).

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
│ **AUTO**        │ MAVE autonomously selects optimal runtime and model role.   │
│ **PREFERRED**   │ Tries user's preferred runtime/model first; falls back if   │
│                 │ unavailable according to compatible policy.                 │
│ **LOCKED**      │ Strictly requires specified runtime/model. Fails closed and │
│                 │ informs user if unavailable. Silent switching forbidden.    │
└─────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 9. Future Settings Contract (Design Specification)

*(UI implementation deferred to post-Pre-M5 UI Redesign)*

### 9.1 AI Runtimes Panel
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

### 9.2 Task Routing Panel
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

## 10. Quota-Aware Routing & Intent-Preserving Fallback

### 10.1 Multi-Factor Routing Inputs
Future routing decisions synthesize:
`Task Profile` + `Runtime Health` + `Runtime Availability` + `Model Availability` + `Subscription Quota State` + `Model Role` + `User Mode (Auto/Preferred/Locked)` + `Billing Policy` + `Privacy Policy`.

### 10.2 Quota Fallback Hierarchy
When a subscription runtime hits its window quota (e.g. Claude 5-hour limit):
```text
Primary Subscription Runtime (e.g. Claude Code - REASONING)
     ↓ [Quota limit reached]
Compatible Subscription Runtime (e.g. Codex - REASONING)
     ↓ [Unavailable / Limit reached]
Compatible Subscription Runtime (e.g. Antigravity - REASONING)
     ↓ [All subscription routes exhausted]
Compatible Local Provider (Local REASONING)
     ↓ [No local provider]
Fail Closed / Inform User (Paid APIs remain BLOCKED unless enabled)
```

---

## 11. Follow-Up Phasing Plan

- **F1.5-S (CURRENT):** Subscription-First foundation, access/billing classification, paid API blocking, runtime audits, canonical architecture documentation.
- **F1.5-S1 (F1.7 Normalization):** Additive subscription runtime adapter normalization (`ClaudeCodeBrainProvider`, `CodexBrainProvider`).
- **F1.5-S2:** Runtime Model Catalog & Model Role mapping engine.
- **F1.5-S3:** Task $\to$ Runtime $\to$ Model deterministic routing integration.
- **F1.5-S4:** Quota-aware subscription fallback and window recovery monitoring.
