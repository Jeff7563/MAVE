# MAVE Intelligence Escalation & Knowledge Trust Architecture

**Document Status:** Architecture Vision & Policy Specification — Source of Truth  
**Track:** Pre-M5 Parallel Architecture Track (Intelligence Escalation & Knowledge Trust Design)  
**Governing Invariants:**
1. `Similarity != Permission` (Recognizing a matching pattern is diagnostic evidence, never authority to mutate state or execute tools).
2. `Intelligence Escalation != Tool Permission` (Selecting which brain thinks is completely decoupled from granting real-world execution rights).
3. `Provider-Kind Integrity` (Conversational reasoning belongs to `model_provider`; workspace execution belongs to `agent_runtime_provider`).

---

## 1. Executive Summary & Foundational Invariants

MAVE is a **desktop personal intelligence orchestrator**, not a wrapper around a single AI model or agent vendor. Under MAVE's Subscription-First architecture, intelligence is partitioned across:
- **Local Fast Brain** (`OllamaBrainProvider` hosting an empirically qualified local conversational model — note that while `qwen2.5:1.5b` won C2 empirical qualification, no local model is promoted to `productionApproved` until F1.5-C3 resident memory qualification is complete),
- **Frontier Subscription Runtimes** (`Claude Code`, `Codex`, `Antigravity`), which operate strictly as `agent_runtime_provider` instances, and
- **Grounded Research & Truth Systems** (Future Pre-M5 F1.8).

The central architectural dilemma of desktop intelligence orchestration is:
> **When should MAVE answer instantly and privately on-device using the Local Fast Brain, versus when must it escalate cognitive workload to heavyweight subscription runtimes or research systems?**

Simultaneously, when MAVE retrieves past solutions or historical runbooks from its memory, an even more critical safety boundary emerges:
> **Does past success under similar circumstances give MAVE autonomous authority to run commands or modify files?**

To resolve these questions deterministically and safely, this specification establishes three immutable architectural invariants.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MAVE RUNTIME WORKFLOW                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│                                      User Input                                        │
│                                           │                                            │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                    BOUNDARY 1: COGNITIVE ESCALATION ENGINE                     │   │
│   │                                                                                │   │
│   │   Task Classifier & Signals ──► Knowledge Retrieval & Applicability            │   │
│   │                                               │                                │   │
│   │                                               ▼                                │   │
│   │   Semantic Decision Outcome:                                                   │   │
│   │   • LOCAL_OK                  • ESCALATE_REASONING                             │   │
│   │   • LOCAL_WITH_KNOWLEDGE      • ESCALATE_CODING                                │   │
│   │   • LOCAL_DRAFT_VERIFY        • ESCALATE_AGENT                                 │   │
│   │   • CURRENT_INFO_REQUIRED     • USER_CLARIFICATION_REQUIRED                    │   │
│   │                                               │                                │   │
│   │                                               ▼                                │   │
│   │                         BrainProfile & Provider-Kind Handoff                   │   │
│   │                         ├── model_provider (fast_conversation, deep_reasoning) │   │
│   │                         └── agent_runtime_provider (agent_work)                │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │ (Cognitive Reasoning / Proposed Action)    │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                 BOUNDARY 2: M5 TOOL PERMISSION & SECURITY GATE                 │   │
│   │                                                                                │   │
│   │                   Does the proposed output require tool execution?             │   │
│   │                                   │                                            │   │
│   │                    ┌──────────────┴──────────────┐                             │   │
│   │                    ▼                             ▼                             │   │
│   │             Pure Conversational Text      Tool Invocation                      │   │
│   │             (Presentation Surface)        (File/Shell/Git/MCP)                 │   │
│   │                                                  │                             │   │
│   │                                                  ▼                             │   │
│   │                                        M5 Permission Policy                    │   │
│   │                                        ├── ALLOW (Safe / Pre-cleared)          │   │
│   │                                        ├── ASK   (User Confirmation Needed)    │   │
│   │                                        └── DENY  (Prohibited by Policy)        │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Invariant 1: Similarity != Permission
A vector match, semantic similarity score, or identical error string from a previous incident is **probabilistic diagnostic evidence**. It is **not** authorization to execute remedial commands.
- Even if MAVE has a `TRUSTED` knowledge record stating: *"When port 3000 is hung, terminate PID via shell"*, observing a hung port on the user's host does **not** grant MAVE the right to blindly kill processes.
- High similarity entitles the system to form a hypothesis, present a verified diagnostic insight, or draft a proposed remediation. It **never** bypasses user consent or runtime tool policy.

### Invariant 2: Intelligence Escalation != Tool Permission
Deciding **which brain thinks** (Local vs Claude Code vs Codex vs Antigravity) is orthogonal to deciding **what actions may execute on the host**.
- Escalating a task to an agent runtime provider grants cognitive reasoning bandwidth and workspace context. It does **not** grant ambient, unconstrained shell, filesystem, or browser rights.
- Any tool invocation proposed by any model—regardless of parameter scale or benchmark rank—must pass through MAVE's Milestone 5 Tool Permission Gate (`ALLOW`, `ASK`, `DENY`).

### Invariant 3: Provider-Kind Integrity
Intelligence escalation must never act as a backdoor that breaks MAVE's frozen Provider-Kind architecture:
- `fast_conversation`, `deep_reasoning`, `research`, `local_offline` $\longrightarrow$ `model_provider`
- `agent_work` $\longrightarrow$ `agent_runtime_provider`
Escalating conversational reasoning cannot silently route a pure conversation to an `agent_runtime_provider`.

---

## 2. Escalation Categories & Deterministic Signal Matrix

MAVE rejects opaque, unvalidated "black-box meta-LLM routing" or arbitrary floating-point neural weighting for intelligence escalation. Routing decisions must be **deterministic, observable, interpretable, and auditable**.

### Deterministic Input Signals

| Signal Dimension | Qualitative Levels | Description & Semantic Boundary |
| :--- | :--- | :--- |
| **`taskComplexity`** | `LOW` \| `MEDIUM` \| `HIGH` \| `FRONTIER` | Structural depth: simple dialogue vs single-file bounded logic vs multi-file AST vs architectural systems. |
| **`riskClass`** | `READ_ONLY` \| `SAFE_LOCAL` \| `MUTATION` \| `DESTRUCTIVE` | Potential blast radius: read inspection vs safe reversible actions vs file edits vs irreversible state destruction. |
| **`currentInfoRequired`** | `BOOLEAN` | Whether the answer depends on real-world facts that change over time (APIs, library versions, news). |
| **`researchRequired`** | `BOOLEAN` | Whether source retrieval, official documentation fetching, or external citation is necessary. |
| **`repoContextScope`** | `NONE` \| `BOUNDED_LOCAL` \| `MULTI_FILE` \| `WORKSPACE_WIDE` | The structural boundary of project context required for cognitive synthesis. |
| **`codeMutationRequired`**| `BOOLEAN` | Whether the request demands altering project source files versus conversational code explanation. |
| **`toolExecutionRequired`**| `BOOLEAN` | Whether native host tools (terminal, filesystem, git, MCP) are required for completion. |
| **`multiStepPlanning`** | `BOOLEAN` | Whether task execution requires chaining sequential, state-dependent operations. |
| **`knowledgeApplicability`**| `NONE` \| `PARTIAL` \| `EXACT_MATCH` | Whether retrieved knowledge records match the current OS, runtime, and project environment. |
| **`knowledgeFreshness`** | `FRESH` \| `ACCEPTABLE` \| `STALE` \| `EXPIRED` | Elapsed time relative to domain validity horizon without positive re-verification. |
| **`historicalSuccess`** | `UNPROVEN` \| `FREQUENT_CORRECTION` \| `VERIFIED_SUCCESS` | Qualitative empirical track record for this category based strictly on verified outcomes. |
| **`ambiguityLevel`** | `UNAMBIGUOUS` \| `MILD_ASSUMPTION` \| `HIGH_AMBIGUITY` | Degree of missing parameters or underspecified intent in user request. |
| **`userMode`** | `AUTO` \| `PREFERRED` \| `LOCKED` | Explicit user operational directive. |
| **`privacyConstraint`** | `LOCAL_ONLY` \| `CLOUD_PERMITTED` | User or project privacy setting (`localOnly: true` forces strict on-device containment). |
| **`billingPolicy`** | `allowPaidApis: boolean` | MAVE subscription-first gate (`allowPaidApis` is `false` by default). |

### Deterministic Policy Evaluation

```text
IF privacyConstraint == LOCAL_ONLY:
    OUTPUT = (taskComplexity <= MEDIUM) ? LOCAL_OK : (LOCAL_WITH_KNOWLEDGE or LOCAL_FAIL_CLOSED)
    ESCALATION TO CLOUD PROHIBITED UNDER ALL CIRCUMSTANCES.

ELSE IF userMode == LOCKED:
    OUTPUT = ROUTE TO LOCKED_PROVIDER (No auto-escalation or auto-fallback).

ELSE IF currentInfoRequired == TRUE OR researchRequired == TRUE:
    OUTPUT = CURRENT_INFO_REQUIRED (Handoff to F1.8 Research / Truth Engine)

ELSE IF ambiguityLevel == HIGH_AMBIGUITY AND taskComplexity >= HIGH:
    OUTPUT = USER_CLARIFICATION_REQUIRED

ELSE IF repoContextScope in [MULTI_FILE, WORKSPACE_WIDE] OR codeMutationRequired == TRUE:
    OUTPUT = (riskClass == DESTRUCTIVE) ? ESCALATE_AGENT : ESCALATE_CODING

ELSE IF multiStepPlanning == TRUE:
    OUTPUT = ESCALATE_AGENT

ELSE IF taskComplexity == FRONTIER:
    OUTPUT = ESCALATE_REASONING

ELSE IF knowledgeApplicability == EXACT_MATCH AND knowledgeFreshness in [FRESH, ACCEPTABLE]:
    OUTPUT = LOCAL_WITH_KNOWLEDGE

ELSE IF taskComplexity == LOW:
    OUTPUT = LOCAL_OK

ELSE:
    OUTPUT = ESCALATE_REASONING
```

---

## 3. Semantic Escalation Outcomes

The escalation engine produces a typed decision from a closed semantic outcome enum:

```ts
export type IntelligenceEscalationOutcome =
  | 'LOCAL_OK'
  | 'LOCAL_WITH_KNOWLEDGE'
  | 'LOCAL_DRAFT_VERIFY'
  | 'ESCALATE_REASONING'
  | 'ESCALATE_CODING'
  | 'ESCALATE_AGENT'
  | 'CURRENT_INFO_REQUIRED'
  | 'USER_CLARIFICATION_REQUIRED';
```

### Semantic Definitions & Boundaries

1. **`LOCAL_OK`**:
   - **Target Profile / Kind:** `fast_conversation` $\to$ `model_provider` (qualified Local Fast Brain).
   - **Characteristics:** Zero network egress, zero API cost, low TTFT, on-device containment.
   - **Application:** Daily conversation, small context queries, language tutoring, grammar checks, simple translations, routine summaries.

2. **`LOCAL_WITH_KNOWLEDGE`**:
   - **Target Profile / Kind:** `fast_conversation` or `local_offline` $\to$ `model_provider` (qualified Local Fast Brain grounded with verified in-context knowledge).
   - **Characteristics:** Local model processes retrieved, highly-applicable prompt grounding.
   - **Application:** Local configuration advice, personal preference recall, recurring project shortcuts where applicability matches exactly.

3. **`LOCAL_DRAFT_VERIFY`**:
   - **Target Profile / Kind:** Hybrid pipeline (qualified Local Fast Brain generates candidate; higher-tier brain verifies).
   - **Characteristics:** Compact verification may reduce cloud work in suitable tasks where candidate drafting is large but verification is bounded.
   - **Application:** Boilerplate code templates, structured schema formatting, or translation candidates that require review before final presentation.

4. **`ESCALATE_REASONING`**:
   - **Target Semantic:** Request for higher cognitive reasoning capability.
   - **Boundary Constraint:** Belongs to `deep_reasoning` $\longrightarrow$ `model_provider`. It does **not** automatically route to an `agent_runtime_provider`. (See Section 6 for Route-Gap handling).
   - **Application:** Complex trade-off evaluation, abstract architecture discussions, mathematical modeling.

5. **`ESCALATE_CODING`**:
   - **Target Profile / Kind:** `agent_work` $\longrightarrow$ `agent_runtime_provider` (Claude Code / Codex / Antigravity).
   - **Characteristics:** Deep AST comprehension, syntax mastery, multi-file code generation.
   - **Application:** Writing multi-line algorithms, component refactoring, test suite synthesis.

6. **`ESCALATE_AGENT`**:
   - **Target Profile / Kind:** `agent_work` $\longrightarrow$ `agent_runtime_provider`.
   - **Characteristics:** Multi-turn plan decomposition, project-wide state tracking, tool orchestration loop.
   - **Application:** Feature implementation across multiple repository packages, automated migration, workspace refactoring.

7. **`CURRENT_INFO_REQUIRED`**:
   - **Target Profile / Kind:** `research` $\longrightarrow$ Pre-M5 F1.8 Research / Truth Engine Handoff.
   - **Characteristics:** Static parametric memory is declared insufficient; fresh source retrieval is mandated.
   - **Application:** Queries about latest package releases, breaking API changes, current events.

8. **`USER_CLARIFICATION_REQUIRED`**:
   - **Target Interface:** MAVE Interaction Surface (Ambient Capsule / Card).
   - **Characteristics:** Halts cognitive pipeline; solicits missing parameter or user intent clarification before burning compute or risking error.
   - **Application:** Ambiguous destructive commands, contradictory requirements, missing workspace paths.

---

## 4. Distinguishing Complex Thinking from Agent Work

A fundamental architectural error is assuming that high complexity automatically makes a task `agent_work`.

> **Cognitive complexity alone does NOT convert a conversational request into agent work.**

```text
┌────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────┐
│          COMPLEX CONVERSATIONAL THINKING (DEEP BRAIN)      │                 AGENT WORK (AGENT RUNTIME)                 │
├────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ • BrainProfile: deep_reasoning                             │ • BrainProfile: agent_work                                 │
│ • ProviderKind: model_provider                             │ • ProviderKind: agent_runtime_provider                     │
│ • "Explain the trade-offs of Paxos vs Raft"                │ • "Inspect this repository and refactor consensus layer"   │
│ • "Analyze why this algorithm has O(N^2) complexity"       │ • "Run tests, fix failing assertions, and commit changes"  │
│ • "Help me reason about microservices vs monolith here"    │ • "Analyze 15 project files and apply migration patch"     │
│ • Interaction: Conversational dialogue on Ambient Surface  │ • Interaction: Multi-turn workspace task loop              │
│ • Tool Execution: None (Pure cognitive synthesis)          │ • Tool Execution: Filesystem, shell, git, MCP tools        │
└────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────┘
```

When a user asks MAVE to think deeply, explain, or compare concepts conversationally, the requirement is `deep_reasoning` for a `model_provider`. Only when the task involves inspecting workspace state, modifying files, or coordinating tools does `TaskPolicy` resolve to `agent_work`.

---

## 5. Local Safe Task Domain & Hard Boundaries

The Local Fast Brain is optimized for **low latency, local privacy, and conversational flow**. It is explicitly qualified for bounded cognitive domains and strictly prohibited from attempting autonomous unbounded tasks.

```text
┌──────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────┐
│              LOCAL SAFE TASK DOMAIN (QUALIFIED)          │           HARD BOUNDARIES (NEVER LOCAL AUTONOMOUS)       │
├──────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
│ • Casual conversation, chit-chat, conversational empathy │ • Multi-file repository refactoring                      │
│ • Bilingual language tutoring & practice (Thai / English)│ • Architectural system design & trade-off evaluation     │
│ • Grammar explanation, vocabulary definitions, phrasing  │ • Destructive git/shell/file operations                  │
│ • Direct translation of conversational sentences         │ • Mutable real-world facts (live prices, latest news)    │
│ • Summarizing bounded in-context user texts              │ • Current API / package version specifications           │
│ • Simple logic puzzles and elementary arithmetic         │ • Unsupervised multi-step autonomous planning            │
│ • Known personal preferences & daily checklists          │ • Tasks where knowledge applicability assumptions fail   │
│ • High-frequency voice interaction loop (low TTFT)       │ • Tool invocations without M5 approval                   │
└──────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────┘
```

---

## 6. Local Escalation Failure & The Deep Reasoning Route Gap

Under MAVE's Subscription-First foundation:
1. Subscription runtimes (`Claude Code`, `Codex`, `Antigravity`) are normalized as **`agent_runtime_provider`** instances.
2. Paid APIs (`OpenAI API`, `Anthropic API`) are optional and **disabled by default** (`allowPaidApis: false`).
3. MAVE currently possesses **NO canonical subscription direct `model_provider` for `deep_reasoning`**.

### The Architectural Route Gap
When the Local Fast Brain evaluates a conversational request and determines:
> *"This task requires deep analytical reasoning, but no file edits or agent tools"*

MAVE encounters an architectural **ROUTE GAP**. The system cannot silently dispatch this request to `Claude Code` or `Codex` without violating the provider-kind boundary and incurring heavy agent overhead.

```text
Conversational Query: "Help me evaluate database consistency trade-offs"
                                │
                                ▼
                       Task Complexity: HIGH
                       Repo Scope: NONE
                       Tool Need: FALSE
                                │
                                ▼
               Semantic Outcome: ESCALATE_REASONING
               BrainProfile: deep_reasoning
               Provider Kind Required: model_provider
                                │
                                ▼
                  Provider Registry Audit:
                  - Local Fast Brain: INSUFFICIENT REASONING
                  - Claude Code / Codex: WRONG KIND (agent_runtime_provider)
                  - Paid APIs: DISABLED BY DEFAULT
                                │
                                ▼
                     ARCHITECTURAL ROUTE GAP
```

### Valid Architectural Resolutions
Rather than pretending a subscription agent runtime fills this conversational slot, MAVE resolves this gap through defined architectural paths:
1. **F1.6 Production Deep Brain (Future Planned Resolution):** Integrate a qualified direct `model_provider` for deep conversational reasoning.
2. **Qualified Heavier Local Direct Model:** Use a higher-parameter local model if host hardware permits.
3. **Honest Transparent Failure:** Inform the user cleanly:
   > *"This topic requires deep analytical reasoning beyond MAVE's current local conversational capacity."*
4. **Explicit Optional Paid API (User-Enabled):** If the user has explicitly provided an API key and enabled `allowPaidApis: true`, route to a configured paid direct model provider.

---

## 7. Current Information Gate (`CURRENT_INFO_REQUIRED`)

Static model weights—whether running locally in Ollama or in cloud frontier models—suffer from **knowledge cutoff blindness** and **parametric hallucination**.

### The Temporal Sensitivity Rule
> **"Does the correct answer depend on information that may have changed since model training or that exists outside MAVE's local static repository?"**

If **YES**, static knowledge is declared **insufficient**.

```text
User Request: "OpenAI ล่าสุดเปลี่ยน API อะไรบ้างในเดือนนี้"
                                  │
                                  ▼
                     Current Information Gate
                                  │
      ┌───────────────────────────┴───────────────────────────┐
      │ Temporal Sensitivity: HIGH                            │
      │ Entity: API Specifications                            │
      │ Knowledge Horizon: Outside Static Training Cutoff     │
      └───────────────────────────┬───────────────────────────┘
                                  │
                                  ▼
               SEMANTIC ROUTE: CURRENT_INFO_REQUIRED
                                  │
                                  ▼
             Handoff to Pre-M5 F1.8 Research / Truth Engine
```

### Implementation Neutrality
F1.8 owns **retrieval, source grounding, freshness verification, and truth routing**.
This specification does **not** mandate real-time web scraping. The transport mechanism in F1.8 may utilize:
- Web search engines,
- Official documentation APIs,
- Enterprise connectors, or
- Curated external knowledge feeds.

---

## 8. Knowledge Applicability Model

Traditional RAG systems store unstructured strings or naive `problem -> solution` vector embeddings. When retrieved, small variations in OS, shell environment, library version, or user permissions cause runtime failures.

MAVE introduces the **Structured Knowledge Applicability Schema**. Knowledge is not merely a solution; it is a **bounded assertion of validity**.

### Knowledge Record Schema

```ts
export type RiskClass = 'READ_ONLY' | 'SAFE_LOCAL' | 'MUTATION' | 'DESTRUCTIVE';

export type KnowledgeTrustState =
  | 'NEW'
  | 'OBSERVED'
  | 'VERIFIED'
  | 'TRUSTED'
  | 'STALE'
  | 'REJECTED';

export interface KnowledgeApplicabilityConditions {
  /** Target Operating System family and minimum versions */
  readonly os?: ('windows' | 'linux' | 'darwin')[];
  /** Specific architecture (x64, arm64) */
  readonly architecture?: ('x64' | 'arm64')[];
  /** Required installed runtimes or CLIs */
  readonly requiredBinaries?: Record<string, string>;
  /** Environment variables required to be present */
  readonly requiredEnv?: string[];
  /** File or directory patterns that must exist in current workspace */
  readonly workspacePatterns?: string[];
}

export interface KnowledgeNonApplicableConditions {
  /** Incompatible runtime versions or environments */
  readonly incompatibleEnvironments?: string[];
  /** Conflicting packages or tools */
  readonly conflictingTools?: string[];
}

export interface KnowledgeRecord {
  readonly id: string;
  readonly topic: string;
  readonly title: string;
  readonly summary: string;

  /** Formal bounds of validity */
  readonly applicability: KnowledgeApplicabilityConditions;
  readonly nonApplicability: KnowledgeNonApplicableConditions;
  readonly environmentAssumptions: string[];

  /** Origin and traceability */
  readonly provenance: {
    readonly source: 'user_explicit' | 'teacher_distillation' | 'automated_test' | 'runbook';
    readonly authorModelOrUser: string;
    readonly createdAt: string;
  };

  /** Verification evidence */
  readonly verifiedResult: {
    readonly expectedOutcomeSignature?: string;
    readonly verificationMethod: 'exit_code_zero' | 'unit_test_pass' | 'user_confirmation';
  };
  readonly lastVerifiedAt?: string;
  readonly successCount: number;
  readonly failureOrCorrectionCount: number;

  /** Operational metadata */
  readonly riskClass: RiskClass;
  readonly freshnessHalfLifeDays: number;
  readonly trustState: KnowledgeTrustState;
}
```

---

## 9. Knowledge Trust Lifecycle & Policy Semantics

Knowledge in MAVE moves through a strict lifecycle based on **empirical verification, environmental drift, and user feedback**.

```text
                             ┌──────────────┐
                             │     NEW      │
                             └──────┬───────┘
                                    │ Teacher/User solves problem once
                                    ▼
                             ┌──────────────┐
                             │   OBSERVED   │
                             └──────┬───────┘
                                    │ Repeated success with zero corrections
                                    ▼
                             ┌──────────────┐
              ┌─────────────►│   VERIFIED   │◄────────────┐
              │              └──────┬───────┘             │
              │                     │ High success across multiple sessions
              │                     ▼                     │
              │              ┌──────────────┐             │
              │              │   TRUSTED    │             │
              │              └──────┬───────┘             │
              │                     │                     │
              │ Environment drift / │ TTL expired         │ Re-verified in
              │ version bump        ▼                     │ new environment
              │              ┌──────────────┐             │
              └──────────────┤    STALE     ├─────────────┘
                             └──────┬───────┘
                                    │ Falsified / Failed verification / User reject
                                    ▼
                             ┌──────────────┐
                             │   REJECTED   │
                             └──────────────┘
```

### State Definitions & Transition Semantics

| State | Semantic Definition | Transition Criteria (Policy-Configurable Defaults) |
| :--- | :--- | :--- |
| **`NEW`** | Candidate solution newly ingested from a single session or teacher output. | Captured from single instance; unproven in runtime environment. |
| **`OBSERVED`** | Candidate solution recorded with structured applicability metadata. | Demonstrated initial viability; pending empirical repetition. |
| **`VERIFIED`** | Demonstrated empirical repeatability under matching applicability. | Repeated verified successes without user correction *(Illustrative default: $\ge 2\text{--}3$ runs)*. |
| **`TRUSTED`** | High-confidence operational knowledge. | Consistent success across sessions under identical applicability *(Illustrative default: $\ge 5$ runs with high success ratio)*. |
| **`STALE`** | Assumptions may no longer hold; must re-qualify before trusting. | Triggered by environment drift, OS/runtime upgrade, or validity half-life expiration. |
| **`REJECTED`** | Falsified or dangerous; permanently barred from automatic retrieval. | Immediate demotion triggered by failed verification, test failure, or explicit user rejection. |

*Note: All numeric transition values are policy-configurable defaults subject to empirical tuning in Milestones 6 & 7.*

---

## 10. Knowledge Does Not Grant Tool Authority

This is the operational embodiment of **`Similarity != Permission`**.

```text
   Retrieved Knowledge Record:
   "To resolve port conflict: Stop-Process -Id <pid> -Force"
                                      │
                                      ▼
                        Trust State: TRUSTED
                                      │
               ┌──────────────────────┴──────────────────────┐
               │         Does this grant MAVE permission     │
               │         to execute Stop-Process in shell?   │
               └──────────────────────┬──────────────────────┘
                                      │
                                      ▼
                                NO. NEVER.
                                      │
                                      ▼
                      M5 Tool Permission Evaluation
                                      │
      ┌───────────────────────────────┴───────────────────────────────┐
      │ Action: Process Termination                                   │
      │ Evaluation: Must be evaluated by M5 ALLOW / ASK / DENY policy │
      └───────────────────────────────────────────────────────────────┘
```

1. **Knowledge is Cognitive Grounding Only:** Knowledge records inform the model's diagnosis and help draft the proposed plan.
2. **Execution Authority Lives in M5:** The decision to execute any system command, file edit, or network call resides exclusively in MAVE's Tool Permission Policy (`ALLOW`, `ASK`, `DENY`).
3. **No Backdoor:** High trust state (`TRUSTED`) does **not** lower a tool's risk classification or bypass user confirmation.

---

## 11. Local Draft $\longrightarrow$ Big Brain Verify

The `LOCAL_DRAFT_VERIFY` pattern allows MAVE to evaluate **collaborative cognitive pipelines** where appropriate:

```text
High Token Generation (Local Fast Brain) ──► Compact Verification (Frontier Brain)
```

### Qualitative Evaluation
- **When Beneficial:** Suitable for large, structured drafts where verification is bounded and fast (e.g., standard unit test boilerplate or JSON schema compliance).
- **When Harmful (Token & Latency Waste):** On high-ambiguity or complex architectural queries, local drafts have high error rates. A frontier model must discard the draft and regenerate from scratch, resulting in compounding latency and wasted compute.
- **Cost Realism:** Verification is **not** inherently fixed or $O(1)$ token cost; verification overhead scales with draft length, syntactic complexity, and the auditing model's context window.

---

## 12. Task Experience Learning & Empirical Routing

MAVE learns routing efficiency **empirically over time** across discrete task categories without modifying model weights.

### Empirical Learning Rules
1. **Verified Outcomes Only:** Routing competence is updated **only** by verified outcomes (clean compile exit code `0`, test suites passing, zero user follow-up corrections).
2. **Incompetence Anti-Pattern:** A model's self-reported confidence (*"I am confident I can solve this"*) is **never** accepted as evidence of competence.
3. **No Anecdotal Promotion:** A single successful resolution does not grant routing authority; empirical repeatability is required.

---

## 13. System Confidence Policy

Traditional LLM self-confidence is dangerously misleading—models frequently hallucinate with high self-reported confidence.

MAVE evaluates confidence at the **system level**, combining independent environmental evidence factors:
- **`applicabilityMatch`:** Exactness of knowledge applicability conditions to the host environment.
- **`freshness`:** Elapsed time relative to knowledge validity horizon.
- **`historicalVerifiedOutcomes`:** Verified empirical track record for this task category.
- **`ambiguityLevel`:** Degree of missing parameters in the user request.
- **`taskComplexity`:** Structural complexity of the task.
- **`riskClass`:** Blast radius and potential destructiveness of requested actions.
- **`environmentMatch`:** Host OS, installed toolchain, and workspace state integrity.

### Policy Invariants
- **Weak Signal Constraint:** Model self-reported confidence is treated as weak, unverified evidence.
- **Ambiguity Clamp:** High ambiguity forces `USER_CLARIFICATION_REQUIRED` regardless of model eagerness.
- **Risk Invariant:** State-mutating or destructive actions must always be submitted to MAVE's M5 Tool Permission Policy.

---

## 14. Intelligence Routing vs. Tool Authority Boundary

The system maintains a rigid architectural separation between cognitive choice and host action permissions:

```text
                    MAVE Orchestrator (packages/core)
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
Intelligence Router                                Tool Permission Engine
(Decides WHO thinks)                               (Decides WHAT executes)
         │                                                   │
         ├─► Local Ollama                                    │
         ├─► Claude Code (agent_runtime)                     ▼
         ├─► Codex (agent_runtime)                 M5 Permission Policy:
         └─► Antigravity (agent_runtime)           Evaluates ALLOW / ASK / DENY
```

- When an agent runtime provider is selected, it receives workspace files in its prompt context.
- When an agent runtime provider proposes a tool action, the action is intercepted by `@mave/core`.
- The action is evaluated by the **Tool Permission Engine (Milestone 5)** under `ALLOW`, `ASK`, or `DENY`.
- The cloud provider cannot execute anything on the user's host machine directly.

---

## 15. User Overrides, Privacy, and Billing Policies

### User Operational Modes
- **`AUTO`:** Deterministic multi-signal escalation engine selects optimal tier. Fallback follows frozen F1.4 / F1.5-S policy.
- **`PREFERRED`:** User's preferred provider is prioritized; fallback occurs only on health failure or quota exhaustion.
- **`LOCKED`:** Strict hard pin. `LOCKED local_ollama` will **never** silently escalate to cloud; `LOCKED claude_code` will **never** silently switch to Codex. Failures report cleanly without fallback.

### Privacy Invariant (`localOnly`)
- When `privacy.localOnly == true`, no user prompt, code, filename, or token may leave the local machine.
- Cloud escalation is completely blocked. If a task exceeds local capacity, MAVE **fails closed** and informs the user transparently on the Ambient Surface.

### Billing Invariant
- Paid APIs remain **disabled by default** (`allowPaidApis: false`).
- Escalation targets Subscription Runtimes (`Claude Code`, `Codex`, `Antigravity`).

---

## 16. Concrete End-to-End Walkthroughs

### Scenario A: Casual Chat ("วันนี้เหนื่อยจัง")
```text
1. User Input: "วันนี้เหนื่อยจัง"
2. Signals: taskComplexity: LOW, riskClass: READ_ONLY, currentInfoRequired: FALSE
3. Escalation Decision: LOCAL_OK
4. Intelligence Selection: Qualified Local Fast Brain (Ollama)
5. Tool Gate: None required (Pure conversational text)
6. Result: Empathetic Thai response delivered via M4 Compact Capsule.
```

### Scenario B: Language Tutoring ("ประโยคนี้ภาษาอังกฤษพูดยังไง")
```text
1. User Input: "ประโยคนี้ภาษาอังกฤษพูดยังไง: 'ฉันไม่ค่อยสะดวกคุยตอนนี้'"
2. Signals: taskComplexity: LOW, riskClass: READ_ONLY, currentInfoRequired: FALSE
3. Escalation Decision: LOCAL_OK
4. Intelligence Selection: Qualified Local Fast Brain
5. Tool Gate: None
6. Result: Returns natural translations ("I'm not really free to talk right now") and registers learning event in M7 Learning Engine.
```

### Scenario C: Past Windows Share Issue ("Windows เครื่องนี้เปิด share ไม่ได้ เหมือนครั้งก่อน")
```text
1. User Input: "Windows เครื่องนี้เปิด share ไม่ได้ เหมือนครั้งก่อน"
2. Signals: taskComplexity: MEDIUM, riskClass: MUTATION, knowledgeApplicability: CHECKING
3. Knowledge Retrieval: Record retrieved with applicability conditions (OS: Windows).
4. INVARIANT CHECK: Similarity != Permission!
   - MAVE does NOT execute any configuration command blindly.
5. Escalation Decision: LOCAL_WITH_KNOWLEDGE
6. Local Brain Output: Explains the likely cause based on previous incident, asks diagnostic confirmation:
   > "ครั้งก่อนเกิดจาก service LanmanServer ไม่ได้ start คุณต้องการให้ MAVE ตรวจสอบ service นี้หรือไม่?"
7. User Confirms: "ใช่ ตรวจสอบเลย"
8. Tool Gate: M5 evaluates read command under ALLOW / ASK / DENY policy.
```

### Scenario D: Backend Refactor ("ช่วยแก้ backend repo นี้")
```text
1. User Input: "ช่วยแก้ backend repo นี้ ให้เปลี่ยน auth middleware เป็น JWT verification"
2. Signals: taskComplexity: HIGH, riskClass: MUTATION, repoScope: MULTI_FILE, codeMutationRequired: TRUE
3. Escalation Decision: ESCALATE_CODING
4. BrainProfile Mapping: agent_work
5. Intelligence Selection: Claude Code Subscription Runtime (agent_runtime_provider)
6. Cognitive Output: Claude Code analyzes AST, prepares diff patches.
7. Tool Gate: Proposed file writes are routed to M5 Tool Permission Engine for evaluation.
```

### Scenario E: Recent API Changes ("OpenAI ล่าสุดเปลี่ยน API อะไร")
```text
1. User Input: "OpenAI ล่าสุดเปลี่ยน API อะไรบ้างในสัปดาห์นี้"
2. Signals: temporalMarker: TRUE ("ล่าสุด", "สัปดาห์นี้"), currentInfoRequired: TRUE
3. Escalation Decision: CURRENT_INFO_REQUIRED
4. Orchestrator Action: Handoff to Pre-M5 F1.8 Research / Truth Engine.
5. Research Pipeline: Fetches official changelog via retrieval provider (search, API, or connector).
6. Synthesis: Formats verified factual points with source citations.
```

### Scenario F: Destructive Command ("ลบ branch นี้ให้หน่อย")
```text
1. User Input: "ลบ branch feat/legacy-test ให้หน่อย"
2. Signals: taskComplexity: LOW, riskClass: DESTRUCTIVE, toolExecutionRequired: TRUE
3. Escalation Decision: LOCAL_OK (Cognitive resolution of branch name is simple)
4. Local Brain Proposes Tool Action: git branch delete
5. INVARIANT CHECK: Intelligence Escalation != Tool Permission!
6. M5 Tool Gate: Evaluates destructive action against ALLOW / ASK / DENY policy.
7. Action: Halts execution and renders explicit confirmation dialog on M4 Surface before executing.
```

### Scenario G: Deep Conversational Analysis (Route-Gap Demonstration)
```text
1. User Input: "วิเคราะห์เปรียบเทียบ trade-offs ระหว่าง Paxos และ Raft ในแง่ leader failure recovery"
2. Signals: taskComplexity: FRONTIER, repoScope: NONE, codeMutation: FALSE, toolExecution: FALSE
3. Escalation Decision: ESCALATE_REASONING
4. BrainProfile Mapping: deep_reasoning (Requires model_provider)
5. ROUTE-GAP CHECK:
   - Qualified Local Fast Brain: Insufficient parameter scale for deep consensus proof.
   - Claude Code / Codex / Antigravity: agent_runtime_provider (Ineligible for direct conversation).
   - Paid APIs: Disabled by default.
6. MAVE Response: Reports route limitation cleanly or utilizes future F1.6 Deep Brain when available.
```

---

## 17. Failure Mode Analysis & Mitigations

| Failure Mode | Risk Description | Root Cause | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **False Similarity** | Applying a past solution to an unrelated problem that looked superficially identical. | Vector distance without applicability checking. | Strict `KnowledgeApplicabilityConditions` checking (OS, runtime, package version). |
| **Stale Knowledge** | Running a configuration command that is obsolete or harmful on updated software. | Knowledge aged past validity half-life. | Automatic transition to `STALE` on version drift or TTL expiration. |
| **Wrong Environment Assumptions** | Executing a Linux bash script on Windows PowerShell. | Unchecked environment assumptions. | Mandatory `environmentAssumptions` schema validation. Path and command normalizers in M5. |
| **Local Hallucination** | Small local model invents nonexistent APIs or incorrect syntax. | Model capacity limits on complex reasoning. | Heuristic escalation triggers: Multi-file or complex syntax queries are escalated to `ESCALATE_CODING`. |
| **Over-Escalation (Quota Waste)** | Routing trivial chit-chat or simple questions to expensive subscription models. | Overly aggressive complexity heuristics. | Strict `LOCAL_OK` qualification gate keeps conversational turns on-device. |
| **Under-Escalation** | Attempting to refactor an entire monorepo using an on-device local model. | Routing based purely on prompt length rather than semantic scope. | Deterministic workspace scope triggers force escalation to `ESCALATE_AGENT`. |
| **Privacy Leakage** | Sending sensitive personal or corporate data to cloud frontier providers. | Autonomous escalation without checking privacy constraints. | Hard fail-closed constraint: `privacy.localOnly == true` mathematically blocks cloud routing. |
| **Tool Authority Confusion** | Model assumes that proposing a tool call implies it has permission to run it. | Conflating cognitive generation with runtime execution rights. | Hard invariant: `Intelligence Escalation != Tool Permission`. M5 security gate intercepts all tool calls. |
| **Contamination Feedback Loops** | An erroneous local response is saved to memory and reinforces future mistakes. | Unverified memory writes. | Only verified outcomes promote knowledge to `VERIFIED` or `TRUSTED`. |

---

## 18. Future Teacher Loop Design

The Teacher Loop establishes a **distillation flywheel** where high-capability frontier models mentor and elevate the local intelligence layer without cloud dependency during normal use.

```text
 1. Local Model encounters difficult task or user triggers escalation
                            │
                            ▼
 2. Frontier Subscription Model (Teacher) generates high-quality solution
                            │
                            ▼
 3. Verification Gate (Automated tests, compile check, or user sign-off)
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
            FAILED                      PASSED
     (Discard candidate)                  │
                                          ▼
                         4. Knowledge Distillation Engine
                         - Extracts general applicability rules
                         - Records environment assumptions
                         - Packages verified solution record
                                          │
                                          ▼
                         5. Trust State assigned: OBSERVED
                         (Never automatically TRUSTED)
                                          │
                                          ▼
                         6. Stored in M6 Knowledge Memory
                                          │
                                          ▼
 7. Future identical requests handled directly by Local Fast Brain (LOCAL_WITH_KNOWLEDGE)
```

**Teacher Output Invariant:** An answer from Claude Code, Antigravity, or Codex is **not** inherently trusted truth. It enters the knowledge base as `NEW` or `OBSERVED`. It achieves `VERIFIED` only after passing objective verification gates.

---

## 19. Distinction: Runtime Memory vs. Model Weight Training

MAVE explicitly distinguishes **adaptive runtime learning** from **model weight modification (fine-tuning / LoRA)**:

```text
┌────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────┐
│         MAVE ADAPTIVE RUNTIME LEARNING (M6 / M7)           │              MODEL WEIGHT TRAINING (LORA / SFT)            │
├────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ • In-context memory retrieval (M6 Memory Engine)           │ • Modifying neural network matrix weights                  │
│ • Knowledge trust graph updates (OBSERVED -> TRUSTED)      │ • Fine-tuning / LoRA adapter creation                      │
│ • Deterministic routing adjustments based on history       │ • Requires high GPU compute, PyTorch/CUDA environments     │
│ • 100% auditable, user-editable, and instantly reversible  │ • Opaque changes, catastrophic forgetting risk             │
│ • Zero training latency; updates take effect in next turn  │ • High latency, offline training pipeline                  │
│ • Active across all current and future models              │ • Frozen to one specific base model architecture           │
└────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────┘
```

> **Architecture Decision:** MAVE achieves 95% of its personalization, accuracy, and operational memory through **Runtime In-Context Knowledge, Trust Graphs, and Routing Adaptation**. Local model weight fine-tuning is an optional, experimental concept deferred to future milestones.

---

## 20. Relationship to MAVE Roadmap Milestones

### Milestone 6 (Memory Storage Neutrality)
- M6 owns **persistence, retrieval, provenance, user edit/delete controls, and knowledge indexing**.
- Storage strategies (relational, document, or vector indexing) are implementation details of M6; this design remains storage-neutral while defining the **Applicability Schema, Provenance Model, and Trust State Lifecycle**.

### Milestone 7 (Learning Engine)
- M7 analyzes conversational mistakes, tracks vocabulary acquisition, and schedules reviews.
- This design supplies M7 with the **Teacher Loop distillation pipeline, Historical Outcome Telemetry, and Empirical Routing Categories**.

### Pre-M5 F1.8 (Research / Truth Routing Implementation Neutrality)
- F1.8 owns external source retrieval, freshness grounding, and citation synthesis.
- This design defines the **Current Information Gate (`CURRENT_INFO_REQUIRED`)** handoff contract without locking F1.8 to web scraping.

### Pre-M5 F1.5-C3 / F1.5-C4 Preservation
- This design is an **architecture and policy track only**.
- It does not modify local model qualification, resident memory management, or benchmark status. F1.5-C3 (Local Model Lifecycle) remains strictly next on the implementation sequence at the Home PC development node.

---

## 21. Summary of Canonical Invariants

1. **`Similarity != Permission`:** Vector similarity or recurring patterns provide diagnostic hypotheses, never authorization to alter system state or bypass permissions.
2. **`Intelligence Escalation != Tool Permission`:** Selecting a frontier model to think gives it cognitive bandwidth, never ambient tool execution rights on the user's host.
3. **`Provider-Kind Integrity`:** Conversational reasoning requests belong to `model_provider`; workspace agent actions belong to `agent_runtime_provider`. Complexity alone does not convert conversation into agent work.
4. **`Deep Reasoning Route-Gap Transparency`:** The absence of a canonical subscription direct `model_provider` for deep conversational reasoning is acknowledged and handled cleanly without backdoor routing.
5. **`Privacy Wins Fail-Closed`:** When `localOnly: true`, cloud escalation paths are mathematically closed; MAVE reports limits transparently rather than leaking context.
6. **`Paid APIs Disabled by Default`:** Escalation targets Subscription Runtimes (`Claude Code`, `Codex`, `Antigravity`). Paid APIs remain opt-in only.
7. **`Human in Control`:** All state-mutating and destructive operations must be evaluated against M5's Tool Permission Policy (`ALLOW`, `ASK`, `DENY`).
