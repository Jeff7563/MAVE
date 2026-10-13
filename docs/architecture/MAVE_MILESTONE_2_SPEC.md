# MAVE Milestone 2 Specification — Conversation Runtime

**Status:** Draft for implementation planning  
**Milestone:** M2 — Conversation Runtime  
**Depends on:** M0 Foundation, M1 Presence/Wake Runtime, M1.2 Wake Lifecycle Stabilization, M1.3 wake-model work continuing independently  
**Source of Truth:** `docs/architecture/` Master Architecture Pack + `MAVE_ARCHITECTURE_AUDIT.md`

---

# 1. Decision from Architecture Audit

The architecture audit classifies the repository as:

> **B. READY FOR M2 WITH SMALL PREPARATION**

No large refactor is required before Milestone 2.

The following foundations must remain stable:

- existing XState assistant lifecycle
- Python openWakeWord service
- Electron Main wake supervisor
- secure Electron IPC / preload separation
- existing monorepo boundaries
- current wake lifecycle quality gates

Milestone 2 begins only after a small contract-alignment phase.

---

# 2. Milestone 2 Goal

Milestone 2 turns MAVE from a wake-capable desktop runtime into a **provider-independent, text-first conversational runtime**.

At the end of M2, the following flow must work:

```text
User types a message
        ↓
Electron Renderer
        ↓
Electron Main / MAVE Runtime
        ↓
SessionManager
        ↓
Context assembly
        ↓
BrainRouter
        ↓
BrainProvider
        ↓
Streaming response
        ↓
Renderer
        ↓
Conversation persisted to database
```

The runtime must support:

- provider-neutral contracts
- deterministic brain selection
- streaming text
- session lifecycle
- fallback
- cancellation
- conversation persistence
- provider diagnostics

---

# 3. Core M2 Principle

> **MAVE owns the conversation workflow. The AI provider is only a brain capability.**

No provider may become the MAVE runtime itself.

Correct dependency direction:

```text
Renderer
   ↓
Electron Main
   ↓
@mave/core
   ↓
BrainRouter
   ↓
BrainProvider contract
   ↓
@mave/providers
   ↓
Official provider integration
```

Forbidden direction:

```text
@mave/core
   ↓
Gemini SDK / Claude SDK / OpenAI SDK
```

`@mave/core` must remain vendor-independent.

---

# 4. Important Provider Strategy

MAVE must NOT assume that every cloud brain is accessed through a paid API.

The user already has multiple AI subscriptions. MAVE should support official subscription-backed clients / CLIs / integrations where the provider explicitly supports that usage.

Therefore:

- do not hardcode API-key billing assumptions into core contracts
- do not make API keys mandatory in generic `BrainConfig`
- do not use unofficial OAuth/token reuse or authentication hacks
- keep provider adapters replaceable
- allow provider transport to be:
  - official CLI
  - official desktop/client integration
  - official SDK/API
  - local runtime
  - mock provider

Milestone 2 should validate the architecture first with a deterministic Mock Brain, then add **one officially supported real provider route** as a separate sub-phase.

---

# 5. M2 Scope

## 5.1 In Scope

### Contracts

- `BrainProvider`
- `BrainCapabilities`
- `BrainRequest`
- `BrainEvent`
- `BrainResponse`
- `ProviderHealth`
- `BrainConfig`
- `Session`
- `ConversationTurn`
- `StreamingChunk`
- request / response IDs
- cancellation-compatible request metadata

### Runtime

- `SessionManager`
- minimal `ContextManager`
- `BrainRouter`
- conversation request coordinator
- streaming coordinator
- provider fallback
- provider health handling
- request cancellation

### Providers

- deterministic Mock Brain Provider
- one real provider adapter using an officially supported access path
- provider health diagnostics

### Persistence

- create/resume conversation
- store user turns
- store assistant turns
- provider metadata
- timestamps
- request IDs
- completion/error status

### Desktop

- minimal text-chat developer surface
- streaming response display
- cancel action
- provider / route diagnostics

### Verification

- unit tests
- integration tests
- IPC streaming tests
- persistence tests
- fallback tests
- cancellation tests
- Electron E2E text-chat smoke test

---

# 6. Explicitly Out of Scope

The following MUST NOT be implemented in Milestone 2:

- STT
- TTS
- realtime voice loop
- Floating Orb
- premium animation system
- final Floating Chat Window
- computer control
- terminal tool execution
- MCP tool execution
- general Tool Registry
- permission levels
- autonomous agents
- vector memory
- long-term memory policy
- language-learning analyzer
- automated vocabulary extraction
- mobile client
- proactive assistant behavior

These belong to later milestones.

---

# 7. Phase 0 — Required Pre-M2 Preparation

Before runtime implementation, complete only these small architecture fixes.

## 7.1 Brain Contracts

Add vendor-neutral brain contracts under:

```text
packages/contracts/
```

Recommended conceptual contract:

```ts
export interface BrainProvider {
  id: string;

  getCapabilities(): BrainCapabilities;

  health(): Promise<ProviderHealth>;

  chat(
    request: BrainRequest,
    options?: BrainRequestOptions
  ): AsyncIterable<BrainEvent>;

  cancel?(requestId: string): Promise<void>;
}
```

### BrainCapabilities

Capabilities must describe what a provider can do, not who the provider is.

Example:

```ts
export interface BrainCapabilities {
  streaming: boolean;
  fastChat: boolean;
  reasoning: boolean;
  coding: boolean;
  toolUse: boolean;
  multimodal: boolean;
  vision: boolean;
  webResearch: boolean;
  longContext: boolean;
  local: boolean;
}
```

Do not encode vendor names into capabilities.

---

## 7.2 Brain Request Contract

Conceptually:

```ts
export interface BrainRequest {
  requestId: string;
  sessionId: string;
  intent: string;
  messages: MaveMessage[];
  context: ContextBundle;
}
```

The first M2 context bundle should remain minimal.

Do not implement long-term memory retrieval yet.

Possible M2 context:

```text
recent conversation turns
active conversation mode
selected provider preference
basic runtime metadata
```

---

## 7.3 Brain Event Contract

Streaming must be structured.

Recommended event categories:

```text
started
delta
completed
cancelled
error
```

Example:

```ts
type BrainEvent =
  | { type: "started"; requestId: string; providerId: string }
  | { type: "delta"; requestId: string; text: string }
  | { type: "completed"; requestId: string; usage?: BrainUsage }
  | { type: "cancelled"; requestId: string }
  | { type: "error"; requestId: string; error: BrainError };
```

Do not stream raw vendor response objects across the application.

---

# 8. Settings Contract Cleanup

The audit found an old provider-specific realtime configuration in:

```text
packages/contracts/src/settings.ts
```

The old configuration must no longer be the generic AI configuration for MAVE.

Introduce a generic block such as:

```ts
brain: {
  defaultProvider: string;
  fallbackChain: string[];
  timeoutMs: number;
}
```

Provider-specific configuration belongs under provider-scoped settings, not in core brain settings.

Example future structure:

```text
brain
├── defaultProvider
├── fallbackChain
└── timeoutMs

providers
├── gemini
├── claude
├── openai
└── local
```

## Migration Rule

Do not silently break existing settings.

If the old `realtime` block already exists in persisted settings:

- support schema migration, or
- explicitly deprecate while retaining backward compatibility during M2

Do not delete stored settings without migration logic.

---

# 9. Session Contracts

Milestone 2 introduces a runtime session abstraction.

A session should track at minimum:

```text
sessionId
createdAt
updatedAt
status
mode
activeProviderId
```

Possible status values:

```text
active
ended
error
```

Do not put long-running agent tasks into the conversation session state machine.

---

# 10. Conversation Turns

Each turn should contain at minimum:

```text
turnId
sessionId
role
content
createdAt
requestId
providerId (assistant responses)
status
```

Roles:

```text
user
assistant
system
```

Possible response status:

```text
streaming
completed
cancelled
failed
```

---

# 11. SessionManager

Location:

```text
packages/core/
```

Responsibilities:

- create conversation session
- load active session
- end session
- append turn
- associate request with session
- provide recent conversation context

It must NOT:

- call vendor SDKs
- perform tool actions
- manage wake hardware
- implement UI logic

---

# 12. Minimal ContextManager

Milestone 2 needs only a small context system.

Responsibilities:

```text
Current request
+ recent conversation turns
+ conversation mode
+ safe runtime metadata
```

Do not add:

- vector search
- personal long-term memory
- project RAG
- screen awareness
- tool context

Those belong to later milestones.

---

# 13. BrainRouter

The first router must be deterministic.

Do not build an AI-based router yet.

Inputs:

```text
intent
required capabilities
provider availability
provider health
user preference
fallback chain
```

Conceptual policy:

```text
Conversation
→ provider supporting fastChat + streaming

Complex reasoning
→ provider supporting reasoning

Offline
→ local provider if available

Primary unavailable
→ next provider in fallbackChain
```

Routing result should include:

```text
providerId
reason
fallbackUsed
```

for diagnostics.

---

# 14. Provider Registry

MAVE should maintain providers through a registry.

Concept:

```text
BrainProviderRegistry

register(provider)
get(providerId)
list()
health(providerId)
```

This allows:

```text
BrainRouter
      ↓
Provider Registry
      ↓
Selected BrainProvider
```

instead of importing concrete providers inside the router.

---

# 15. Provider Implementation Plan

## M2.0 — Mock Brain

Implement first.

Requirements:

- deterministic responses
- configurable delay
- streaming chunks
- forced failure mode
- forced timeout mode
- cancellation support

This provider is required for testing all runtime behavior without cloud dependencies.

## M2.1 — Runtime

Implement:

- session
- context
- router
- stream coordinator
- DB persistence
- IPC

using Mock Brain only.

## M2.2 — One Real Provider

Add exactly one officially supported provider route.

The access method must be documented.

It may use:

- official subscription-backed client / CLI if supported
- official SDK/API if explicitly chosen
- local runtime

M2 must not assume API billing as the only architecture.

## M2.3 — Fallback

After one real provider works:

```text
preferred provider
↓
health / timeout / failure
↓
fallback provider
↓
response
```

---

# 16. Streaming Architecture

Preferred flow:

```text
BrainProvider
   ↓ AsyncIterable<BrainEvent>
Conversation Runtime
   ↓
Electron Main
   ↓
IPC Stream
   ↓
Renderer
```

Do not send one IPC message per character.

Aggregate deltas where appropriate, roughly in short intervals such as 30–50 ms, while preserving responsive streaming.

Renderer must only display stream events.

It must not orchestrate provider calls.

---

# 17. Cancellation

Every conversation request must have:

```text
requestId
AbortController or equivalent cancellation primitive
```

Cancellation sources:

- user presses Cancel
- user starts replacement request
- assistant lifecycle requests stop/sleep where appropriate
- provider timeout
- application shutdown

Cancellation result must be reflected in:

- provider
- runtime
- database turn status
- UI

No abandoned "thinking forever" requests.

---

# 18. Assistant State Machine Integration

The existing XState lifecycle must NOT be redesigned in M2.

Current assistant states are already considered valid architecture.

M2 may connect conversation activity to existing states, but must not change the state topology merely to accommodate provider logic.

Rule:

> conversation runtime is a service coordinated by assistant state, not a replacement for assistant state.

Long-running tasks remain outside the assistant lifecycle.

---

# 19. Database Strategy for M2

The current `sql.js` database is acceptable for M2.

Do not migrate SQLite implementation during M2 unless a blocker is proven.

Use existing conversation tables where practical.

Required persistence:

```text
conversation/session
user turn
assistant turn
provider id
request id
timestamps
response status
```

Write behavior should avoid unnecessary full-file persistence during every tiny stream delta.

Recommended:

```text
Persist user turn
↓
Stream assistant response in memory
↓
Persist final assistant turn on completion/cancel/error
```

or use controlled debouncing if partial persistence is required.

Native/WAL SQLite migration remains a later milestone concern.

---

# 20. IPC Contracts

IPC must remain typed and validated.

Suggested conceptual channels:

```text
mave:chat-send
mave:chat-cancel
mave:chat-stream
mave:chat-session
```

Final naming should follow existing repository conventions.

Do not expose provider SDK objects to Renderer.

Renderer receives only MAVE contracts.

---

# 21. Minimal M2 Developer UI

M2 UI exists only to verify runtime behavior.

Required:

```text
Text input
Send
Cancel
Streaming response
Session ID
Selected provider
Route/fallback indicator
Error state
```

Not required:

- final visual design
- floating glass UI
- Orb
- rich card system
- animations

Those remain Milestone 4.

---

# 22. Diagnostics

Add non-sensitive diagnostics for:

```text
requestId
sessionId
selected provider
routing reason
fallback used
start time
time to first chunk
total duration
completion state
error category
```

Never log:

- passwords
- tokens
- authentication secrets
- raw credentials
- private provider auth material

---

# 23. Error Model

M2 should normalize provider errors into MAVE errors.

Suggested categories:

```text
provider_unavailable
provider_timeout
provider_auth
provider_limit
provider_invalid_response
cancelled
runtime_error
```

Do not expose raw vendor exceptions directly to UI.

Raw errors may be retained in safe development logs after redaction.

---

# 24. Fallback Rules

Fallback should occur for:

- provider unavailable
- timeout
- temporary provider failure
- quota / usage limit where safely detectable

Fallback should generally NOT occur for:

- user cancellation
- invalid user request
- permission/security rejection
- deterministic application bug

Prevent infinite fallback loops.

---

# 25. Testing Requirements

## Contracts

Test:

- schemas
- serialization
- invalid values
- backward settings compatibility

## BrainRouter

Test:

- primary route
- capability mismatch
- unhealthy provider
- fallback
- no available provider

## Mock Brain

Test:

- streaming
- delay
- failure
- timeout
- cancellation

## SessionManager

Test:

- create
- resume
- append turn
- close
- concurrent request behavior

## Persistence

Test:

- user turn stored
- final assistant turn stored
- failed response status
- cancelled response status

## IPC

Test:

- send request
- stream chunks
- completion
- error
- cancellation

## E2E

Electron smoke flow:

```text
launch MAVE
↓
type message
↓
send
↓
session created
↓
Mock Brain selected
↓
response streams
↓
response completes
↓
conversation persisted
```

---

# 26. Standard Verification Gate

Before M2 is accepted:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm test:e2e
```

Wake service tests must continue passing:

```bash
pytest services/wake/tests
```

M2 changes must not reduce wake quality or alter wake service behavior.

---

# 27. Milestone 2 Acceptance Criteria

Milestone 2 is complete only when all of the following are true.

## Architecture

- [ ] `BrainProvider` is vendor-neutral
- [ ] core imports no vendor AI SDK
- [ ] provider registry exists
- [ ] deterministic BrainRouter exists
- [ ] provider settings are vendor-neutral at core level

## Conversation

- [ ] text request creates/uses session
- [ ] provider selected deterministically
- [ ] response streams to Renderer
- [ ] final conversation stored
- [ ] cancellation works
- [ ] timeout works
- [ ] fallback works

## Providers

- [ ] Mock Brain fully tested
- [ ] at least one real officially supported brain route verified
- [ ] provider failure does not crash MAVE

## Desktop

- [ ] developer text-chat path works
- [ ] current provider can be inspected
- [ ] error/fallback can be inspected

## Regression

- [ ] XState lifecycle remains stable
- [ ] wake manager unchanged unless absolutely necessary
- [ ] Python wake service unchanged
- [ ] wake tests still pass
- [ ] existing Electron security boundaries remain intact

---

# 28. Definition of Done — User Experience

At M2 completion, this must work without microphone:

```text
User opens MAVE

User types:
"Hello MAVE"

MAVE:
- creates a conversation session
- chooses a brain
- streams the answer
- shows selected provider
- stores the conversation

User sends another message

MAVE:
- keeps the same session context
- responds with prior-turn awareness

Provider fails

MAVE:
- records the failure
- selects valid fallback
- continues without application crash

User presses Cancel

MAVE:
- cancels generation
- updates request state
- remains usable
```

This is the foundation on which Milestone 3 voice conversation will be built.

---

# 29. Explicit No-Refactor List

Do NOT rewrite these during M2:

```text
packages/core/src/state-machine/machine.ts
services/wake/
apps/desktop/src/main/wake-manager.ts
```

except for a proven integration requirement that cannot be solved through an adapter/service boundary.

Any proposed modification to these components must include:

- justification
- regression tests
- exact reason an adapter cannot solve it

---

# 30. Architecture Debt Deferred Beyond M2

The audit identified additional real debt.

These are intentionally NOT part of M2 unless proven blocking:

## Before / During M3

Namespace wake diagnostics under a structure such as:

```text
diagnostics.wake
```

instead of expanding root machine context indefinitely.

## Before M5/M6

Replace synchronous whole-file `sql.js` persistence with a more scalable SQLite strategy if real usage demonstrates the need.

## UI Cleanup

Move browser-development state simulation out of React business logic when the UI architecture is rebuilt.

These must not become excuses for a large M2 refactor.

---

# 31. Implementation Order

Recommended sequence:

```text
Phase 0
Architecture contracts
        ↓
Phase 1
Mock Brain Provider
        ↓
Phase 2
Provider Registry + BrainRouter
        ↓
Phase 3
SessionManager + minimal ContextManager
        ↓
Phase 4
Conversation Runtime + streaming
        ↓
Phase 5
Database persistence
        ↓
Phase 6
Electron IPC
        ↓
Phase 7
Developer text UI
        ↓
Phase 8
Cancellation + timeout
        ↓
Phase 9
One real provider adapter
        ↓
Phase 10
Fallback chain
        ↓
Full verification
```

Each phase should be separately testable.

---

# 32. Branch Strategy

Recommended implementation branch:

```text
feat/milestone-2-conversation-runtime
```

Do not mix MAVE V2 wake-model training changes into M2.

M1.3 wake work and M2 runtime work should remain separable.

---

# 33. Commit Strategy

Prefer small semantic commits:

```text
feat(contracts): add vendor-neutral brain and session contracts
feat(providers): add deterministic mock brain provider
feat(core): add brain provider registry and router
feat(core): add conversation session manager
feat(core): add streaming conversation runtime
feat(database): persist conversation runtime metadata
feat(desktop): add typed chat streaming IPC
feat(desktop): add M2 text conversation diagnostics UI
feat(core): add request cancellation and provider fallback
feat(providers): add first real brain adapter
test(m2): add conversation runtime integration coverage
```

Avoid one giant Milestone 2 commit.

---

# 34. M2 Guardrails for AI Coding Agents

Every coding agent working on M2 must follow these rules:

1. Read the complete `docs/architecture/` pack first.
2. Read `MAVE_ARCHITECTURE_AUDIT.md`.
3. Read this specification.
4. Inspect current implementation before modifying files.
5. Do not rewrite stable wake systems.
6. Do not introduce vendor SDK imports into `@mave/core`.
7. Do not start M3–M7 features early.
8. Do not use unofficial authentication workarounds.
9. Add tests for each runtime behavior.
10. Run full verification before committing.
11. Do not push unless explicitly instructed.
12. Report exact files changed and architecture decisions made.

---

# 35. Final M2 Architecture

Target after Milestone 2:

```text
                     Renderer
                        │
                  typed IPC stream
                        │
                        ▼
                  Electron Main
                        │
                        ▼
              Conversation Runtime
                        │
       ┌────────────────┼────────────────┐
       │                │                │
       ▼                ▼                ▼
SessionManager    ContextManager     BrainRouter
                                         │
                                         ▼
                                Provider Registry
                                  │      │      │
                                  ▼      ▼      ▼
                                Mock   Real   Future
                                Brain  Brain   Brain
                                         │
                                         ▼
                                BrainEvent Stream

                     Conversation DB
                           ▲
                           │
                    Session / Turns
```

This architecture is the required foundation for:

```text
M3 Voice Loop
M4 Floating MAVE Surface
M5 Agent Runtime
M6 Memory
M7 Learning Engine
```

---

# 36. Milestone 2 North Star

> **MAVE must be able to hold a text conversation through a replaceable AI brain without the rest of the application knowing which vendor produced the answer.**

When that statement is true, Milestone 2 has achieved its architectural purpose.
