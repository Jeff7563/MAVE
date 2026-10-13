# MAVE Milestone 2 Closeout

## 1. Executive Summary

MAVE Milestone 2 (Conversation Runtime) is formally **complete**. Across 11 structured phases (Pre-M2 Phase 0 through Phase 10), MAVE has evolved from an audio-wake desktop prototype into a production-grade, provider-independent conversational runtime.

The core architecture strictly decouples MAVE's conversation workflow from external AI engines:
- `@mave/core` contains **zero vendor SDK imports** and manages sessions, context assembly, capability-based routing, and streaming orchestration.
- The persistence layer writes terminal conversation turns and session metadata without per-delta database churn.
- Electron Main exposes a secure, typed IPC streaming bridge with complete race, cancellation, and timeout protections.
- The runtime has been validated end-to-end with both a deterministic Mock Brain and a live, subscription-backed Google Antigravity CLI adapter with zero API keys required.
- MAVE Brain Profiles (`fast_conversation`, `agent_work`, `deep_reasoning`, `research`, `local_offline`) and deterministic routing policies have been established.
- The **Fast Brain latency gap** discovered during live validation (~9–10s TTFT for Antigravity) has been rigorously analyzed, leading to the decision to preserve Antigravity as an Agent Brain candidate while running Fast Brain evaluation in parallel with Milestone 3 (Voice Loop).

---

## 2. M2 Goal

The primary objective of Milestone 2 was defined in `MAVE_MILESTONE_2_SPEC.md`:

> **"MAVE must be able to hold a text conversation through a replaceable AI brain without the rest of the application knowing which vendor produced the answer."**

All design and engineering criteria established to satisfy this goal have been met:
1. Vendor-neutral contracts in `@mave/contracts`.
2. Extensible provider adapters in `@mave/providers`.
3. Deterministic session and context management in `@mave/core`.
4. High-reliability streaming and lifecycle control.
5. Verification via a dedicated Developer Chat test surface.

---

## 3. Final Architecture

The implemented M2 architecture enforces strict one-way dependency flows and isolation of concerns:

```text
                           ┌────────────────────────────┐
                           │   Electron Renderer        │
                           │   (DeveloperChat UI)       │
                           └─────────────┬──────────────┘
                                         │ typed IPC (mave:chat:*)
                                         ▼
                           ┌────────────────────────────┐
                           │   Electron Main            │
                           │   ConversationManager      │
                           └─────────────┬──────────────┘
                                         │
                                         ▼
                           ┌────────────────────────────┐
                           │   @mave/core               │
                           │   ConversationRuntime      │
                           └──────┬──────────────┬──────┘
                                  │              │
              ┌───────────────────┼──────────────┼───────────────────┐
              ▼                   ▼              ▼                   ▼
     ┌─────────────────┐ ┌────────────────┐ ┌─────────┐    ┌─────────────────┐
     │ SessionManager  │ │ ContextManager │ │ Policy  │    │  Conversation   │
     │                 │ │                │ │ Policy  │    │  Store (SQLite) │
     └─────────────────┘ └────────────────┘ └────┬────┘    └─────────────────┘
                                                 │
                                                 ▼
                                        ┌─────────────────┐
                                        │   BrainRouter   │
                                        └────────┬────────┘
                                                 │
                                                 ▼
                                        ┌─────────────────┐
                                        │ProviderRegistry │
                                        └────────┬────────┘
                                                 │
                       ┌─────────────────────────┴────────────────────────┐
                       ▼                                                  ▼
          ┌──────────────────────────┐                      ┌──────────────────────────┐
          │    @mave/providers       │                      │    @mave/providers       │
          │    MockBrainProvider     │                      │ AntigravityBrainProvider │
          └──────────────────────────┘                      └─────────────┬────────────┘
                                                                          │ Child Process
                                                                          ▼
                                                            ┌──────────────────────────┐
                                                            │ Google Antigravity CLI   │
                                                            │ (Official agy binary)    │
                                                            └──────────────────────────┘
```

---

## 4. Phase History

Milestone 2 was executed incrementally through 11 disciplined phases:

| Phase | Description | Commit Hash | Key Deliverables |
|---|---|---|---|
| **Pre-M2 Phase 0** | Architecture Contracts | `d364216191d96a481c3432a4bca9c57b9ed862eb` | Vendor-neutral `BrainProvider`, `BrainCapabilities`, `BrainRequest`, `BrainEvent`, `Session`, `ConversationTurn` schemas |
| **M2 Phase 1** | Mock Brain Provider | `1fc986241f246a0a3cc1b9a7002285a4a9f099fa` | Deterministic `MockBrainProvider` with configurable streaming delay, synthetic chunks, cancellation handling |
| **M2 Phase 2** | Provider Registry & Router | `ddd799f1ef567de9136cd0f6927da6ad1ef1c027` | `BrainProviderRegistry`, deterministic capability matching `BrainRouter`, fallback routing, health checking |
| **M2 Phase 3** | Session & Context Managers | `e5dc8c19beca4b26076bac42860309dc6a52e3a0` | `SessionManager`, token-budgeted `ContextManager`, multi-turn history formatting, system prompt injection |
| **M2 Phase 4** | Conversation Runtime | `fe5b21d8de0260c3f02b9b5178d227010558a3d9` | Core `ConversationRuntime` coordinating sessions, context, router, and streaming events end-to-end |
| **M2 Phase 5** | Database Persistence | `47e2cafd9f0249481372c72465c31eef008d4621` | `ConversationStore` interface, `SQLiteConversationStore`, session/turn tables, zero-per-delta write safety |
| **M2 Phase 6** | Typed Electron IPC | `46db833c69152cbc3c7b5d929060f61965bb218f` | Main `ConversationManager`, typed preload contracts, IPC event streaming, clean window deregistration |
| **M2 Phase 7** | Developer Text Chat UI | `e63a1318f9a5ee7b61cb245e6ba6c37ea04ef775` | Diagnostics-oriented text chat panel in Electron renderer, provider selector, stream viewer, token metrics |
| **M2 Phase 8** | Runtime Reliability Hardening | `92f65cbd3ee66beed977d7ec99997484341638d3` | Configurable timeouts, cancellation propagation, IPC acknowledgement race safety, terminal state arbitration |
| **M2 Phase 9** | First Real Brain Provider | `35cf74243fee8c64ed81886a7d79be2d7a67ebc2` | `AntigravityBrainProvider` via official `agy` CLI headless interface, live streaming parser, zero API keys |
| **M2 Phase 10** | Brain Profiles & Closeout | *Current Commit* | `BrainProfilePolicy`, canonical profile schemas, Fast Brain gap analysis, roadmap updates, architecture freeze |

---

## 5. Acceptance Matrix

Every requirement established in `MAVE_MILESTONE_2_SPEC.md` has been audited against the implementation:

| # | Acceptance Criterion | Status | Evidence / Verification Notes |
|---|---|---|---|
| 1 | Vendor-neutral `BrainProvider` contract | **PASS** | `packages/contracts/src/brain.ts` defines clean interface without vendor bias. |
| 2 | Core imports zero vendor SDK | **PASS** | `@mave/core` imports only `@mave/contracts` and internal modules. Zero vendor SDK dependencies. |
| 3 | Provider Registry | **PASS** | `BrainProviderRegistry` in `@mave/core` stores, registers, and queries providers dynamically. |
| 4 | Deterministic `BrainRouter` | **PASS** | Capability-based scoring and deterministic fallback selection without LLM-based routing logic. |
| 5 | Generic `BrainConfig` | **PASS** | Configuration schema is vendor-agnostic; no mandatory API key or billing fields. |
| 6 | Deterministic Mock Brain | **PASS** | `MockBrainProvider` generates deterministic output with configurable timing for reliable tests. |
| 7 | Real Brain Provider | **PASS** | `AntigravityBrainProvider` in `@mave/providers` connects to the official `agy` CLI binary. |
| 8 | Streaming Responses | **PASS** | Full streaming pipeline from provider `AsyncIterable<BrainEvent>` to Electron IPC to React renderer. |
| 9 | Conversation Sessions | **PASS** | `SessionManager` manages creation, metadata, turns, and state transitions. |
| 10 | Context Continuity | **PASS** | Multi-turn history is preserved and assembled into context for subsequent turns. |
| 11 | Conversation Persistence | **PASS** | Sessions and turns persisted in SQLite (`conversations.db`) with timestamps and metadata. |
| 12 | Session Hydration / Resume | **PASS** | Runtime supports hydrating sessions from SQLite and resuming multi-turn dialogue. |
| 13 | Typed IPC Boundary | **PASS** | Zod schemas validate all IPC messages across `contextBridge` preload boundary. |
| 14 | Renderer Text Chat UI | **PASS** | Developer Chat surface enables interactive testing, provider switching, and metrics display. |
| 15 | Request Cancellation | **PASS** | Active requests can be cancelled cleanly; process signals and abort controllers propagate. |
| 16 | Request Timeout | **PASS** | Configurable timeout triggers terminal failure and terminates hanging provider processes. |
| 17 | Fallback Architecture | **PASS** | Router cascades through defined fallback chain upon provider failure or unhealthy status. |
| 18 | Error Normalization | **PASS** | Vendor-specific errors mapped into standard `BrainError` with standardized error codes. |
| 19 | Provider Health Diagnostics | **PASS** | `health()` checks report status, latency, and operational readiness. |
| 20 | Security Boundaries | **PASS** | Main/Renderer process separation preserved; no raw child process access from renderer. |
| 21 | Zero Per-Delta DB Writes | **PASS** | SQLite writes occur only on terminal turn completion, cancellation, or failure (no streaming churn). |
| 22 | Wake Subsystem Regression | **PASS** | Python wake service and XState assistant machine remain 100% operational (all wake tests pass). |
| 23 | E2E Text Chat Integration | **PASS** | Playwright/Vitest E2E tests pass across Electron main and renderer. |
| 24 | Real Provider Manual Verification | **PASS** | Live Developer Chat manual test verified real streamed AI text and multi-turn context with Antigravity. |

---

## 6. Real Brain Verification

The first real AI provider integration was verified using the official **Google Antigravity CLI** (`agy`):

1. **Automated Unit & Integration Tests:**
   - Provider tests use a fixture executable (`agy-fixture.js`) that simulates real NDJSON streams, ANSI escape codes, error streams, and signal termination without consuming user quota.
   - 100% of provider unit tests pass in CI/local runs.
2. **Live CLI Verification:**
   - Dedicated script `scripts/test-antigravity-live.ts` verified that the user's local authenticated `agy` session streams real AI answers without requiring `GEMINI_API_KEY` or billing configuration.
3. **Developer Chat Manual Verification:**
   - Tested through the actual Electron desktop app.
   - Turn 1: Successfully streamed answer to a greeting.
   - Turn 2: Preserved context and answered follow-up questions referencing the prior turn.
   - Provider metadata, request IDs, and turn records correctly populated the Developer Chat UI and SQLite database.

---

## 7. Brain Profile Architecture

In Phase 10, MAVE formalized the concept of **Brain Profiles** to decouple *what capability is needed* from *which specific provider satisfies it*:

```text
Intent / User Mode
       ↓
Brain Profile (Requirements & Latency Target)
       ↓
BrainProfilePolicy (Deterministic Resolver)
       ↓
BrainRouter (Capability Matching & Fallback)
       ↓
BrainProviderRegistry (mock, antigravity, ...)
```

### Canonical Profiles

- **`fast_conversation`:** Ultra-low latency conversational streaming (TTFT $\le 1\text{--}3$s). Requires `streaming: true`, `fastChat: true`.
- **`deep_reasoning`:** Complex analysis and architectural synthesis. Requires `streaming: true`, `reasoning: true`.
- **`agent_work`:** Code synthesis and multi-step tasks. Requires `streaming: true`, `coding: true` (M2 intentionally does not require `toolUse: true` since tool runtime is deferred to M5).
- **`research`:** Fact-grounded web search and citation verification. Requires `streaming: true`, `webResearch: true`.
- **`local_offline`:** Air-gapped, zero-cost private query execution. Requires `streaming: true`, `local: true`.

### Override Hierarchy
Explicit caller overrides (`preferredProviderId`) always take precedence over profile defaults, ensuring developers and users can force specific providers when desired.

---

## 8. Fast Brain Gap

Live verification with Google Antigravity CLI revealed a critical architectural insight:

| Metric | Measured Live (Antigravity) | Target for Voice Loop (`fast_conversation`) |
|---|---|---|
| **Time-to-First-Token (TTFT)** | ~9.3 seconds | $\le 1\text{--}3$ seconds |
| **Total Request Latency** | ~10.2 seconds | $\le 4\text{--}6$ seconds |
| **Input Overhead** | ~12,800 tokens | Minimal (~200–500 tokens) |

### Why Antigravity Cannot Be the Default Fast Brain
Google Antigravity CLI is designed as an agentic coding assistant. It initializes workspace environments, loads project context, injects system instructions, and evaluates agentic loops before outputting text. While ideal for **`agent_work`**, this overhead introduces a ~9–10 second delay before the first token is emitted. In natural human-to-assistant voice dialogue, an 8–10 second silence creates an awkward, broken user experience.

### Architectural Decision
- Antigravity remains configured as an **Agent Brain** candidate.
- Antigravity is **not** promoted to the default `fast_conversation` brain.
- Fast Brain selection is tracked as an active evaluation running in parallel with Milestone 3.

---

## 9. Known Limitations

The following limitations are explicitly recognized as the current state of the codebase:
1. **No Selected Production Fast Brain:** `mock` remains the default provider in configuration until a fast provider ($\le 1\text{--}3$s TTFT) is selected.
2. **Antigravity Overhead:** Antigravity TTFT is ~9–10s, with ~12k prompt token overhead.
3. **Tools Disabled:** Antigravity CLI tools (`--no-tools`) are strictly disabled in M2.
4. **Synchronous Whole-File DB Persistence:** SQLite via `sql.js` serializes whole database files on disk writes.
5. **Developer Chat Surface:** The text chat UI is a developer diagnostic tool, not the final MAVE Floating Surface.
6. **No STT / TTS:** Audio input and speech synthesis are not implemented.
7. **No Long-Term Memory / RAG:** Conversation history is per-session without cross-session semantic search.
8. **No Tool / Permission Model:** System actions and terminal executions cannot be invoked by LLMs.
9. **No Autonomous Agents:** Multi-step autonomous agent execution loops do not exist.
10. **No Mobile / Remote Surface:** MAVE is strictly a local desktop runtime.

*(None of these are bugs; all are deliberate roadmap boundaries).*

---

## 10. Architecture Freeze

The following core modules are considered **stable and frozen** as of Milestone 2 closeout:

1. `packages/contracts/src/brain.ts` & `chat.ts` (Contracts and Zod schemas)
2. `BrainProvider` interface
3. `BrainProviderRegistry`
4. `BrainRouter`
5. `BrainProfilePolicy`
6. `SessionManager`
7. `ContextManager`
8. `ConversationRuntime`
9. `ConversationStore` & `SQLiteConversationStore`
10. Typed Electron IPC channels and validation handlers
11. Timeout and Cancellation lifecycle arbitration
12. `AntigravityBrainProvider` adapter boundary
13. Developer Chat test surface

Future milestones will extend these components via clean composition, rather than refactoring their core contracts.

---

## 11. Deferred Work

Future roadmap items remain allocated to their designated milestones:

- **Milestone 3 (Voice Loop):** STT abstraction, TTS abstraction, voice state machine, partial transcript streaming, barge-in / interruption handling, silence detection, parallel Fast Brain evaluation.
- **Milestone 4 (MAVE Surface):** Floating Orb, Floating Panel, glassmorphism design, message cards, window dragging/docking.
- **Milestone 5 (Agent Runtime & Tools):** Tool Registry, permission gates, human-in-the-loop approvals, MCP client, terminal/file tools.
- **Milestone 6 (Memory):** Working memory, vector store, long-term memory policy, user privacy deletion controls.
- **Milestone 7+:** Learning Engine, context awareness, multimodal cards, cross-device companion.

---

## 12. M3 Readiness

The conversation runtime architecture is **100% ready for Milestone 3 (Voice Loop)**.

Milestone 3 requires:
- Streaming text input into `ConversationRuntime.execute()`: **Ready**.
- Progressive streaming chunks for TTS consumption: **Ready**.
- Immediate cancellation on user speech barge-in: **Ready**.
- Session and turn context continuity: **Ready**.

The lack of a finalized Fast Brain does **not** block Milestone 3 architectural development. Milestone 3 can build STT, TTS, and barge-in pipelines using `MockBrainProvider` (and test real audio loops with Antigravity), while real Fast Brain provider evaluation proceeds in parallel.

---

## 13. Risks

1. **Voice Conversation Latency:** If a real Fast Brain with TTFT $\le 1\text{--}3$s is not identified before M3 closeout, live voice conversations will feel sluggish.
2. **CLI External Dependency:** `AntigravityBrainProvider` relies on the installed `agy` CLI binary and its headless output format. Upstream changes to `agy` CLI output flags would require adapter updates.
3. **Database File Size:** Synchronous whole-file serialization with `sql.js` will experience performance degradation if conversation histories grow into tens of thousands of turns before M5/M6 database migration.

---

## 14. Final Decision

### **B. M2 COMPLETE — READY FOR M3 WITH FAST-BRAIN WORK IN PARALLEL**

### Rationale:
- **Milestone 2 Acceptance:** 24 out of 24 acceptance criteria have **passed**. All core contracts, session management, streaming runtime, persistence, typed IPC, timeouts, cancellations, and real provider verification are fully functional and tested.
- **Architectural Soundness:** The design cleanly separates MAVE runtime from AI vendors. Core imports zero vendor SDKs.
- **Real Brain Verified:** The official Google Antigravity CLI operates flawlessly as a subscription-backed brain.
- **Pragmatic Quality Gate:** Rather than prematurely crowning Antigravity as the voice-conversation brain despite its ~9–10s latency, the architecture honestly documents the Fast Brain gap and establishes Brain Profiles so that a dedicated Fast Brain can be plugged in during M3 without altering core systems.

MAVE Milestone 2 is officially closed. Ready to proceed to Milestone 3.

