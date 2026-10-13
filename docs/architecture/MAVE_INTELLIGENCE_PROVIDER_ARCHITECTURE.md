# MAVE Intelligence & Provider Architecture

**Status:** Architecture Vision — Source of Truth  
**Created after:** MAVE Milestone 2 Phase 10 Closeout  
**M2 Status:** Complete — Ready for M3 with Fast-Brain work in parallel  
**Primary Purpose:** Define how MAVE should combine direct AI models, agent runtimes, knowledge sources, routing policy, and future multi-provider intelligence without becoming dependent on one vendor or one AI runtime.

---

# 1. Core Principle

> **MAVE is not Gemini, Claude, GPT, Antigravity, or any single model. MAVE is the intelligence orchestration layer above all of them.**

The user interacts with **MAVE**.

MAVE decides:

1. What kind of task is this?
2. Does the answer require fresh or authoritative information?
3. Does the task require a fast model, deep model, research pipeline, local model, or agent runtime?
4. Which provider/model is currently best and available?
5. Does the task require tools?
6. Does the task require user approval?
7. How should the result be presented?

The user should normally not need to think about the vendor behind the response.

---

# 2. Intelligence Layer Overview

MAVE intelligence is divided into three major layers:

```text
                         MAVE
                           │
                 Intelligence Orchestrator
                           │
        ┌──────────────────┼───────────────────┐
        │                  │                   │
        ▼                  ▼                   ▼
  MODEL BRAINS       AGENT RUNTIMES       KNOWLEDGE / TRUTH
        │                  │                   │
 Gemini-family       Antigravity             Web/Search
 Claude-family       Claude Code*            Memory
 GPT-family          Codex/Other*             Files
 Local models        Future agents            Database
                                             Calendar
                                             Email
                                             Project docs
```

`*` Future integrations only. They are not automatically assumed to be available.

---

# 3. Model Brain vs Agent Runtime

This distinction is foundational.

## 3.1 Model Brain

A **Model Brain** is a relatively direct model-response path.

Concept:

```text
MAVE
 ↓
Model Provider
 ↓
Selected Model
 ↓
Response
```

Typical uses:

- conversation
- translation
- language tutoring
- quick Q&A
- summarization
- writing
- reasoning
- classification
- conversational voice loop

Advantages:

- lower latency
- smaller system overhead
- fewer injected tool schemas
- easier cancellation
- more suitable for natural voice interaction
- easier to switch model according to task

Examples of future provider families:

```text
GeminiProvider
├── fast model
├── balanced model
└── strong reasoning model

ClaudeProvider
├── fast model
├── balanced model
└── strong reasoning model

OpenAIProvider
├── fast model
├── balanced model
└── strong reasoning model

LocalModelProvider
├── small local model
└── larger local model
```

The exact available model names are runtime/provider details and may change over time.

---

## 3.2 Agent Runtime

An **Agent Runtime** is an AI execution environment around one or more underlying models.

Concept:

```text
MAVE
 ↓
Agent Provider
 ↓
Agent Runtime / Harness
 ↓
Model
+
Planning
+
Workspace
+
Tools
+
Files
+
Browser
+
Terminal
+
MCP
+
Execution
```

Typical uses:

- coding
- project analysis
- repository work
- multi-step workflows
- research workflows
- tool-heavy work
- file changes
- debugging
- long-running tasks

Current first real example:

```text
MAVE
 ↓
AntigravityBrainProvider
 ↓
agy CLI
 ↓
Antigravity Agent Runtime
 ↓
Underlying AI model
```

Antigravity is therefore **not the same thing as a Gemini model**.

It is an agent environment that can use an underlying model while also carrying agent instructions, tools, environment context, permissions, and orchestration.

---

# 4. Why Antigravity Is Heavy

A direct model request may conceptually contain:

```text
system instruction
+
conversation history
+
user request
```

An agent runtime may contain:

```text
agent system instructions
+
planning rules
+
tool definitions
+
tool schemas
+
workspace information
+
permissions
+
sandbox context
+
browser/file/terminal/MCP tool descriptions
+
conversation history
+
user request
```

This explains why a very small user request can still produce large prompt-token usage when routed through an agent harness.

MAVE's live Antigravity verification showed approximately:

```text
TTFT:            ~9–10 seconds
Total latency:   ~10 seconds
Prompt overhead: ~12k+ tokens on a minimal request
```

Therefore:

> **Antigravity is valuable as an Agent Brain candidate, but it is not the ideal Fast Brain for natural voice turn-taking.**

---

# 5. Provider Families and Multiple Models

MAVE should support multiple models under the same provider family.

The architecture should not treat:

```text
Gemini
Claude
GPT
```

as single fixed models.

Instead:

```text
Provider Family
   ↓
Available Models
   ↓
Model Selection Policy
```

Example conceptual architecture:

```text
GeminiProvider
├── interactive / fast model
├── balanced model
└── deep reasoning model

ClaudeProvider
├── interactive model
├── balanced model
└── deep reasoning model

OpenAIProvider
├── interactive model
├── balanced model
└── deep reasoning model
```

MAVE may later route not only to a provider, but to a provider **and a model profile**.

---

# 6. Agent Providers Can Also Use Different Models

An Agent Runtime may itself support multiple underlying models.

Example:

```text
MAVE
 ↓
Antigravity
 ↓
selected underlying model
```

This is different from a direct model path:

```text
MAVE
 ↓
GeminiProvider
 ↓
Gemini model
```

The first path carries agent-runtime overhead and agent capabilities.

The second path is intended to be a lighter model-response path.

MAVE must preserve this distinction.

---

# 7. Brain Profiles

Brain Profiles describe **what kind of intelligence the task needs**, not which vendor to call.

Canonical M2 profiles:

```text
fast_conversation
deep_reasoning
agent_work
research
local_offline
```

## 7.1 fast_conversation

Use for:

- everyday conversation
- English practice
- translation
- quick explanations
- voice assistant turn-taking
- short Q&A

Priorities:

- low time-to-first-token
- low overhead
- streaming
- bilingual quality
- reliable cancellation
- conversational continuity

Target:

```text
TTFT ideally <= 1–3 seconds
Total response preferably <= 4–6 seconds for ordinary turns
```

Current production-quality provider:

> **Not selected yet**

---

## 7.2 deep_reasoning

Use for:

- difficult architecture decisions
- complex analysis
- long reasoning
- planning
- high-quality decision support

Priority:

```text
reasoning quality > latency
```

This can eventually map to a stronger direct model.

---

## 7.3 agent_work

Use for:

- repository analysis
- coding work
- file modifications
- debugging
- multi-step project work
- future computer/tool workflows

Current candidate:

```text
Antigravity
```

Important:

M2 currently keeps Antigravity **conversation-only** and blocks tools.

Full agent actions require M5 Tool + Permission architecture.

---

## 7.4 research

Use for:

- current information
- source-backed answers
- news
- verification
- multi-source synthesis

Research should not mean "ask a model from memory."

Correct pattern:

```text
Search / authoritative source retrieval
 ↓
Verified context
 ↓
Model Brain
 ↓
Source-grounded answer
```

---

## 7.5 local_offline

Use for:

- offline operation
- private tasks
- low-cost simple tasks
- fallback behavior

No production implementation is assumed yet.

---

# 8. Information Source Is Separate from the Brain

A major MAVE principle:

> **The AI model is not the database of truth.**

MAVE should distinguish:

```text
"Who should THINK?"
```

from:

```text
"Where should the FACTS come from?"
```

Possible truth/context sources:

```text
Model internal knowledge
Web / Search
Authoritative APIs
Calculator
Current time/weather/data tools
MAVE Memory
Project Memory
Files
Documents
Database
Calendar
Email
Screen context
Task results
```

The model then reasons over the appropriate context.

---

# 9. Correctness Policy

MAVE cannot guarantee that an LLM is always correct.

Instead, MAVE should apply a **Truth Requirement Policy**.

## 9.1 Stable General Knowledge

Examples:

```text
"What does awkward mean?"
"Explain a JavaScript array."
"How do I say this in English?"
```

Possible route:

```text
Fast Model
→ answer directly
```

---

## 9.2 Current / Time-Sensitive Facts

Examples:

```text
"What happened today?"
"What is the current price?"
"What is the latest version?"
"What time is it in London?"
```

Correct route:

```text
Current Data Source
→ verified context
→ Model Brain
→ answer + source where useful
```

The model should not guess from training memory.

---

## 9.3 User-Specific Facts

Examples:

```text
"What milestone is MAVE on?"
"What did we decide yesterday?"
"What project was I working on?"
```

Correct route:

```text
MAVE Memory / Project Store
→ relevant context
→ Model Brain
```

---

## 9.4 File / Project Facts

Examples:

```text
"Why is this test failing?"
"What does this file contain?"
```

Correct route:

```text
Actual file/repository data
→ Brain / Agent
```

Never rely only on remembered model knowledge when the real source is available.

---

# 10. Intelligence Routing Pipeline

Long-term target:

```text
User Request
     ↓
Intent / Request Understanding
     ↓
Truth Requirement Check
     │
     ├── Needs fresh/source-backed information?
     │       ↓
     │   Knowledge Retrieval
     │
     └── No external truth needed
             ↓
       Brain Profile Selection
             ↓
      ┌──────┼────────┐
      ▼      ▼        ▼
     Fast   Deep     Agent
      │      │        │
      ▼      ▼        ▼
   Model   Model   Agent Runtime
      │      │        │
      └──────┴────────┘
             ↓
        MAVE Response
             ↓
      Voice / Surface / Task
```

---

# 11. Provider Selection Pipeline

Profile selection and provider selection are different.

```text
Request
 ↓
Brain Profile
 ↓
Required Capabilities
 ↓
BrainRouter
 ↓
Provider
 ↓
Model / Agent configuration
```

Example:

```text
"What does reliable mean?"

profile:
fast_conversation

required:
streaming
fastChat

router:
select currently available Fast Brain
```

Another:

```text
"Analyze this repository and fix the test failures."

profile:
agent_work

router:
Antigravity / future agent provider
```

---

# 12. Automatic Routing vs Explicit Override

MAVE should normally route automatically.

The user should be able to say simply:

```text
"MAVE, help me with this project."
```

not:

```text
"MAVE, use model X version Y."
```

However explicit override must remain possible.

Examples:

```text
"MAVE, use Agent mode for this."
"MAVE, use Gemini for this."
"MAVE, use Claude and think carefully."
"MAVE, keep this local."
```

Potential UI modes:

```text
Auto
Fast
Deep
Agent
Research
Local
Specific Provider
Specific Model
```

Explicit override remains subject to capability/security requirements.

---

# 13. Future Provider Architecture

Conceptual target:

```text
                         MAVE
                           │
                   Intelligence Router
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
   MODEL PROVIDERS                      AGENT PROVIDERS
         │                                   │
  ┌──────┼───────┬───────┐           ┌──────┼─────────┐
  │      │       │       │           │      │         │
Gemini Claude  OpenAI   Local    Antigravity Claude*  Other*
  │      │       │       │
  ▼      ▼       ▼       ▼
multiple models per family
```

`*` Future integrations, only when officially supported and intentionally implemented.

---

# 14. Provider Capability Is Not Vendor Identity

Router logic should ask:

```text
What capabilities are required?
```

not:

```text
Which brand should I use?
```

Capabilities may include:

```text
streaming
fastChat
reasoning
coding
toolUse
multimodal
vision
webResearch
longContext
local
```

This keeps the architecture vendor-independent.

---

# 15. Model Selection Inside a Provider

A future ModelProvider may expose model options such as:

```text
interactive
balanced
reasoning
```

MAVE should eventually support a model-selection layer without hardcoding current marketing model names into Core.

Concept:

```text
Brain Profile
 ↓
Provider
 ↓
Model Policy
 ↓
Concrete model identifier
```

Exact model IDs belong in provider configuration/adapters.

---

# 16. Agent Model Selection

Agent providers may also expose underlying model configuration.

Example concept:

```text
Agent Provider:
Antigravity

Agent profile:
agent_work

Underlying model:
provider-supported model chosen by:
- user setting
- capability
- task complexity
- quota
```

MAVE should not assume:

```text
Antigravity = one specific Gemini model
```

---

# 17. Fast Brain Requirements

Before MAVE Voice becomes production-quality, a real Fast Brain should ideally provide:

- official integration
- no unsupported authentication hacks
- streaming
- low latency
- reliable cancellation
- MAVE-owned conversation state
- Thai + English quality
- good language tutoring
- predictable quotas
- no mandatory agent tool overhead
- safe text-only operation
- future STT → Brain → TTS compatibility

Performance target:

```text
TTFT: ideally <= 1–3 seconds
ordinary total response: preferably <= 4–6 seconds
```

This is a UX target, not a universal hard guarantee.

---

# 18. Agent Brain Requirements

Agent Runtime priorities differ:

- planning quality
- multi-step execution
- coding ability
- workspace understanding
- tool support
- recovery
- task progress
- long-running reliability

Latency can be higher because the task itself is substantial.

For example:

```text
"Hello MAVE"
```

should never require a heavy agent runtime.

But:

```text
"MAVE, inspect this repo, find the problem, fix it, and rerun the tests."
```

is appropriate for an agent.

---

# 19. M5 Tool/Permission Boundary

Agent providers must never bypass MAVE's permission architecture.

Future flow:

```text
Agent requests action
        ↓
MAVE Tool Registry
        ↓
Risk Classification
        ↓
Permission Policy
        ↓
Allow?
├── No → Ask user / deny
└── Yes
     ↓
Execute
     ↓
Return result to Agent
```

An underlying agent runtime being capable of tool use does **not** mean it automatically has permission to execute.

---

# 20. Current Antigravity Safety Position

During M2:

```text
Antigravity model response       ✅
Streaming                        ✅
Cancellation                     ✅
Multi-turn MAVE context          ✅

Agent tools                      BLOCKED
Repository access                BLOCKED
Browser actions                  BLOCKED
Terminal actions                 BLOCKED
MCP actions                      BLOCKED
Autonomous execution             BLOCKED
```

This remains intentional until M5.

---

# 21. Future Multi-Agent Possibility

Long-term, MAVE may orchestrate multiple specialists.

Example:

```text
                         MAVE
                           │
                    Task Orchestrator
              ┌────────────┼────────────┐
              ▼            ▼            ▼
          Code Agent   Reasoning Model   Research
              │            │            │
              └────────────┼────────────┘
                           ↓
                     MAVE Synthesis
                           ↓
                       User Result
```

This is future work.

Do not implement multi-agent orchestration prematurely.

---

# 22. User Experience Rule

The user should normally speak to **MAVE**, not to providers.

Desired:

```text
"MAVE, analyze this."
"MAVE, explain this."
"MAVE, help me practice English."
"MAVE, find current information."
```

Undesired as the default interaction:

```text
"Use vendor A model B with reasoning level C."
```

Provider/model overrides are advanced controls, not the primary UX.

---

# 23. Brain Transparency

MAVE may expose provider/model information in diagnostics and advanced settings.

Example:

```text
Profile: fast_conversation
Provider: GeminiProvider
Model: <current configured fast model>
```

But the normal interaction surface should preserve the unified MAVE identity.

---

# 24. Failure & Fallback

Future fallback should respect the profile.

Example:

```text
Fast Brain unavailable
↓
try another provider supporting fast_conversation
↓
if none:
explicitly tell user fast brain is unavailable
```

Do not silently route a 1-second conversational request into a 10-second agent runtime unless policy explicitly allows that fallback.

Agent fallback and Fast fallback may therefore differ.

---

# 25. Quota Awareness

MAVE should eventually understand provider health/quota state.

Potential future signals:

```text
healthy
degraded
unconfigured
quota limited
temporarily unavailable
```

Quota awareness may influence provider selection.

Do not automatically purchase credits or change billing configuration.

---

# 26. Cost / Subscription Principle

MAVE should prefer officially supported access paths.

Possible provider access forms:

```text
Official API
Official CLI
Official desktop/client integration
Local runtime
```

MAVE Core must not assume every paid chat subscription equals API access.

Authentication and billing belong to provider adapters/configuration.

---

# 27. Privacy Routing

Some future requests may explicitly require local-only processing.

Example:

```text
"MAVE, keep this local."
```

Possible route:

```text
local_offline
 ↓
LocalModelProvider
```

Cloud providers must not be silently used when local-only policy is active.

---

# 28. MAVE Identity vs Provider Personality

Provider output should not cause MAVE to feel like a different assistant every request.

Future prompt architecture should separate:

```text
MAVE Identity
+
Conversation Mode
+
Task Context
+
Provider Adapter
```

Providers supply intelligence.

MAVE owns:

- identity
- tone
- memory
- task state
- permissions
- UX
- conversation continuity

---

# 29. Relationship to M3 Voice

M3 Voice pipeline:

```text
Wake
 ↓
STT
 ↓
MAVE Conversation Runtime
 ↓
fast_conversation profile
 ↓
Real Fast Model Brain
 ↓
Streaming text
 ↓
TTS
 ↓
MAVE speaks
```

For complex spoken requests:

```text
Voice request
 ↓
MAVE recognizes substantial task
 ↓
agent_work profile
 ↓
Agent Runtime
 ↓
Task runs
 ↓
MAVE reports status/result
```

This allows voice interaction without forcing every spoken sentence through an agent runtime.

---

# 30. Relationship to M4 Ambient Surface

The Surface should reflect what MAVE is doing, not which provider brand is running.

Examples:

```text
fast_conversation
→ Voice Capsule

research result
→ Source Card / Conversation Surface

agent_work
→ Task Surface

image/video result
→ Rich Content Surface
```

Provider identity may remain visible only in diagnostics.

---

# 31. Architecture Freeze After M2

M2 established stable primitives:

- BrainProvider
- BrainProviderRegistry
- BrainRouter
- BrainProfilePolicy
- SessionManager
- ContextManager
- ConversationRuntime
- ConversationStore
- SQLiteConversationStore
- Typed IPC
- timeout/cancellation
- Antigravity provider boundary
- Mock provider
- Developer Chat harness

Future intelligence work should extend these concepts rather than bypass them.

---

# 32. Current State

After M2 Phase 10:

```text
M0 Foundation                         COMPLETE
M1 Presence / Wake                    COMPLETE foundation
M1.3 Personalized Wake V2             pending real dataset work

M2 Conversation Runtime               COMPLETE
├── Brain contracts                   PASS
├── Mock Brain                        PASS
├── Router                            PASS
├── Sessions / Context                PASS
├── Streaming Runtime                 PASS
├── Persistence                       PASS
├── IPC                               PASS
├── Developer Chat                    PASS
├── Reliability                       PASS
├── First Real Brain — Antigravity    PASS
└── Brain Profiles / Closeout         PASS

Next:
M3 Voice Loop

Parallel open item:
Select / integrate production Fast Brain
```

---

# 33. Key Decisions Locked

1. **MAVE is above all model and agent vendors.**
2. **Direct Model Brains and Agent Runtimes are distinct architecture categories.**
3. **One provider family may expose multiple models.**
4. **One Agent Runtime may also support different underlying models.**
5. **Antigravity is an Agent Runtime-backed provider, not equivalent to Gemini itself.**
6. **Antigravity is not the production Fast Brain.**
7. **Fast conversational requests should use a lighter direct model path.**
8. **Truth retrieval and Brain selection are separate concerns.**
9. **Fresh facts should use fresh sources rather than model memory alone.**
10. **Agent tool capability never bypasses MAVE permissions.**
11. **Users normally interact with MAVE, not individual providers.**
12. **Explicit advanced provider/model override remains available.**
13. **MAVE owns identity, memory, history, permissions, and presentation.**
14. **Provider adapters own vendor-specific integration details.**
15. **Future systems should extend the M2 architecture, not route around it.**

---

# 34. Product Vision

Long-term MAVE:

```text
User
 ↓
MAVE
 ↓
Understand intent
 ↓
Determine truth/context requirements
 ↓
Retrieve relevant knowledge
 ↓
Select Brain Profile
 ↓
Select Provider / Model / Agent Runtime
 ↓
Reason or execute
 ↓
Apply permissions
 ↓
Produce response
 ↓
Voice + Adaptive Surface
 ↓
Persist useful history / memory
```

The user experiences one assistant:

> **MAVE**

while the system underneath may dynamically use multiple models, providers, knowledge sources, and agent runtimes.

---

# 35. Final Architecture Statement

> **MAVE is a provider-independent personal intelligence operating layer. Direct AI models provide fast and deep reasoning. Agent runtimes provide heavyweight execution capabilities. Knowledge systems provide grounded truth and personal context. MAVE coordinates all of them into one continuous assistant identity.**
