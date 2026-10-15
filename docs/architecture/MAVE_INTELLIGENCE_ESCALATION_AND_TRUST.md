# MAVE Intelligence Escalation & Knowledge Trust Architecture

**Document Status:** Architecture Vision & Policy Specification — Source of Truth  
**Track:** Pre-M5 Parallel Architecture Track (Intelligence Escalation & Knowledge Trust Design)  
**Base Commit:** `4b1ac13 feat(intelligence): benchmark local fast brain candidates`  
**Target Delivery:** `docs/architecture/MAVE_INTELLIGENCE_ESCALATION_AND_TRUST.md`  
**Governing Invariants:**
1. `Similarity != Permission` (Recognizing a matching pattern is diagnostic evidence, never authority to mutate state or execute tools).
2. `Intelligence Escalation != Tool Permission` (Selecting which brain thinks is completely decoupled from granting real-world execution rights).

---

## 1. Executive Summary & Foundational Invariants

MAVE is a **desktop personal intelligence orchestrator**, not a wrapper around a single AI model or agent vendor. Under MAVE's Subscription-First architecture, intelligence is partitioned across:
- **Local Fast Brain** (`OllamaBrainProvider` hosting verified low-latency models such as `qwen2.5:3b-instruct` or `llama3.2:3b`),
- **Frontier Subscription Runtimes** (`Claude Code`, `Codex`, `Antigravity`), and
- **Grounded Research & Truth Systems** (Future Pre-M5 F1.8).

The central architectural dilemma of desktop intelligence orchestration is:
> **When should MAVE answer instantly and privately on-device using the Local Fast Brain, versus when must it escalate cognitive workload to heavyweight subscription or research runtimes?**

Simultaneously, when MAVE retrieves past solutions or historical runbooks from its memory, an even more critical safety boundary emerges:
> **Does past success under similar circumstances give MAVE autonomous authority to run commands or modify files?**

To resolve these questions deterministically and safely, this specification establishes two immutable architectural invariants.

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
│   │   Deterministic Decision Matrix:                                               │   │
│   │   • LOCAL_OK                  • ESCALATE_REASONING                             │   │
│   │   • LOCAL_WITH_KNOWLEDGE      • ESCALATE_CODING                                │   │
│   │   • LOCAL_DRAFT_VERIFY        • ESCALATE_AGENT                                 │   │
│   │   • CURRENT_INFO_REQUIRED     • USER_CLARIFICATION_REQUIRED                    │   │
│   │                                               │                                │   │
│   │                                               ▼                                │   │
│   │                                   Selected Brain / Model                       │   │
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
│   │                                        ├── ALLOW (Level 0/1 Safe)              │   │
│   │                                        ├── ASK   (Level 2/3 Risky)             │   │
│   │                                        └── DENY  (Prohibited)                  │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Invariant 1: Similarity != Permission
A vector match, semantic similarity score, or identical error string from a previous incident is **probabilistic diagnostic evidence**. It is **not** authorization to execute remedial commands.
- Even if MAVE has a `TRUSTED` knowledge record stating: *"When port 3000 is hung, kill PID via `kill -9`"*, observing a hung port on the user's host does **not** grant MAVE the right to blindly kill processes.
- High similarity entitles the system to form a hypothesis, present a verified diagnostic insight, or draft a proposed remediation. It **never** bypasses user consent or runtime tool policy.

### Invariant 2: Intelligence Escalation != Tool Permission
Deciding **which brain thinks** (Local vs Claude Code vs Codex vs Antigravity) is orthogonal to deciding **what actions may execute on the host**.
- Escalating a task to Claude Code grants Claude Code cognitive reasoning bandwidth and workspace context. It does **not** grant Claude Code ambient, unconstrained shell, filesystem, or browser rights.
- Any tool invocation proposed by any model—regardless of parameter scale or benchmark rank—must pass through MAVE's Milestone 5 Tool Permission Gate (`ALLOW`, `ASK`, `DENY`).

---

## 2. Escalation Categories & Deterministic Signal Matrix

MAVE rejects opaque, probabilistic "black-box meta-LLM routing" or brittle floating-point neural weighting for intelligence escalation. Routing decisions must be **deterministic, observable, interpretable, and auditable**.

### Deterministic Input Signals

| Signal Dimension | Type / Range | Description & Source |
| :--- | :--- | :--- |
| **`taskComplexity`** | `LOW` \| `MEDIUM` \| `HIGH` \| `FRONTIER` | Structural complexity of the task (token length, syntactic depth, multi-step dependency). |
| **`riskClass`** | `READ_ONLY` \| `SAFE_LOCAL` \| `MUTATION` \| `DESTRUCTIVE` | Potential blast radius of the requested action (M5 Risk Level 0 through 3). |
| **`currentInfoRequired`** | `BOOLEAN` | Whether the answer depends on real-world facts that change over time (prices, APIs, software versions, news). |
| **`researchRequired`** | `BOOLEAN` | Whether web search, documentation fetching, or external citation is necessary. |
| **`repoContextScope`** | `NONE` \| `FILE_LOCAL` \| `MULTI_FILE` \| `WORKSPACE_WIDE` | The structural boundary of code context required. |
| **`codeMutationRequired`**| `BOOLEAN` | Whether the request demands editing or generating multi-line project source code. |
| **`toolExecutionRequired`**| `BOOLEAN` | Whether native host tools (terminal, filesystem, git, MCP) are required. |
| **`multiStepPlanning`** | `BOOLEAN` | Whether task execution requires chaining $\ge 2$ dependent sequential actions. |
| **`knowledgeApplicability`**| `NONE` \| `PARTIAL` \| `EXACT_MATCH` | Whether retrieved knowledge records match the current OS, runtime, and project environment. |
| **`knowledgeFreshness`** | `FRESH` \| `ACCEPTABLE` \| `STALE` \| `EXPIRED` | Time elapsed since knowledge record was last verified relative to domain half-life. |
| **`historicalSuccess`** | `RATIO [0.0 - 1.0]` | Ratio of verified successful completions vs user corrections for this task category. |
| **`ambiguityLevel`** | `UNAMBIGUOUS` \| `MILD_ASSUMPTION` \| `HIGH_AMBIGUITY` | Degree of missing parameters or underspecified requirements in user prompt. |
| **`userMode`** | `AUTO` \| `PREFERRED` \| `LOCKED` | Explicit user operational directive. |
| **`privacyConstraint`** | `LOCAL_ONLY` \| `CLOUD_PERMITTED` | User or project privacy setting (`localOnly: true` forces strict on-device containment). |
| **`billingPolicy`** | `allowPaidApis: boolean` | MAVE subscription-first gate (`allowPaidApis` is `false` by default). |

### Deterministic Decision Table

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

ELSE IF multiStepPlanning == TRUE OR taskComplexity == FRONTIER:
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

### Semantic Definitions

1. **`LOCAL_OK`**:
   - **Target Runtime:** Local Fast Brain (`OllamaBrainProvider`).
   - **Characteristics:** Zero network egress, zero API cost, ultra-low TTFT ($\le 1.0\text{s}$), fully private.
   - **Application:** Daily conversation, small context queries, language tutoring, grammar check, simple translation, routine summaries.

2. **`LOCAL_WITH_KNOWLEDGE`**:
   - **Target Runtime:** Local Fast Brain augmented with verified in-context knowledge records.
   - **Characteristics:** Local model processes retrieved, highly-applicable prompt grounding.
   - **Application:** Local configuration help, personal preference recall, recurring project shortcuts where applicability matches exactly.

3. **`LOCAL_DRAFT_VERIFY`**:
   - **Target Runtime:** Local Fast Brain generates candidate; Frontier Subscription Runtime verifies/corrects.
   - **Characteristics:** Asymmetric token efficiency. Used when drafting is high-volume but verification is fast.
   - **Application:** Generating boilerplate code, translation candidates, or documentation stubs that require validation by a frontier model before presentation.

4. **`ESCALATE_REASONING`**:
   - **Target Runtime:** Subscription Runtime (`Claude Code` / `Antigravity` / `Codex`) mapped to `REASONING` Model Role.
   - **Characteristics:** Deep multi-turn inference, chain-of-thought analysis, architecture evaluation.
   - **Application:** System design trade-offs, debugging intricate race conditions, mathematical modeling.

5. **`ESCALATE_CODING`**:
   - **Target Runtime:** Subscription Runtime mapped to `CODING` Model Role.
   - **Characteristics:** Deep AST comprehension, syntax mastery, multi-file code synthesis.
   - **Application:** Writing complex algorithms, component refactoring, test suite generation.

6. **`ESCALATE_AGENT`**:
   - **Target Runtime:** Subscription Runtime mapped to `AGENT` Model Role.
   - **Characteristics:** Multi-turn plan decomposition, project-wide state tracking, tool orchestration loop.
   - **Application:** Feature implementation across multiple repository packages, automated migration, git conflict resolution.

7. **`CURRENT_INFO_REQUIRED`**:
   - **Target Runtime:** Pre-M5 F1.8 Research / Truth Engine Handoff.
   - **Characteristics:** Model static parametric memory is bypassed or augmented with external real-time verification.
   - **Application:** Queries about latest package versions, breaking API changes, real-time news, current events.

8. **`USER_CLARIFICATION_REQUIRED`**:
   - **Target Runtime:** MAVE Interaction Surface (Ambient Capsule / Card).
   - **Characteristics:** Halts cognitive pipeline; solicits missing parameter or user intent clarification before burning compute or risking error.
   - **Application:** Contradictory instructions, missing critical file paths, ambiguous destructive commands.

---

## 4. Local Safe Task Domain & Hard Boundaries

The Local Fast Brain is optimized for **latency, privacy, and conversational flow**. It is explicitly qualified for bounded cognitive domains and strictly prohibited from attempting autonomous unbounded tasks.

```text
┌──────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────┐
│              LOCAL SAFE TASK DOMAIN (QUALIFIED)          │           HARD BOUNDARIES (NEVER LOCAL AUTONOMOUS)       │
├──────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
│ • Casual conversation, chit-chat, conversational empathy │ • Multi-file repository refactoring                      │
│ • Bilingual language tutoring & practice (Thai / English)│ • Architectural system design & trade-off evaluation     │
│ • Grammar explanation, vocabulary definitions, phrasing  │ • Destructive git/shell/file operations                  │
│ • Direct translation of short-to-medium sentences        │ • Mutable real-world facts (stock prices, latest news)   │
│ • Summarizing small user-provided texts (<= 1500 tokens) │ • Current API / package version specifications           │
│ • Simple logic puzzles and elementary arithmetic         │ • Unsupervised multi-step autonomous planning            │
│ • Known personal preferences & daily checklists          │ • Tasks where knowledge applicability assumptions fail   │
│ • High-frequency voice interaction loop (TTFT <= 1.0s)   │ • Tool invocations without M5 approval                   │
└──────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────┘
```

---

## 5. Escalation Triggers

Deterministic heuristics detect when an incoming request exceeds the boundary of the Local Safe Task Domain.

```text
                                Request Input
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │         Does intent match any trigger?       │
               └──────────────────────┬───────────────────────┘
                                      │
     ┌────────────────────────────────┼────────────────────────────────┐
     ▼                                ▼                                ▼
[CODING TRIGGER]             [REASONING TRIGGER]               [TEMPORAL TRIGGER]
• Multi-file AST             • Architectural analysis          • "Latest", "recent"
• Refactor repository        • Race condition audit            • Current pricing/news
• Complex test generation    • Mathematical proof              • Library version change
     │                                │                                │
     ▼                                ▼                                ▼
ESCALATE_CODING               ESCALATE_REASONING               CURRENT_INFO_REQUIRED
```

### Concrete Trigger Heuristics
1. **Multi-File Context Trigger:** Request references $> 1$ file path, project directory tree, or monorepo workspace dependencies $\longrightarrow$ `ESCALATE_CODING` or `ESCALATE_AGENT`.
2. **Code Generation Trigger:** Request asks to write, edit, or fix implementation code exceeding 20 lines $\longrightarrow$ `ESCALATE_CODING`.
3. **Temporal Drift Trigger:** Request contains temporal markers (`"latest"`, `"current"`, `"recent"`, `"today"`, `"version 2026"`, `"deprecated"`) combined with volatile topics $\longrightarrow$ `CURRENT_INFO_REQUIRED`.
4. **Destructive Command Trigger:** Request asks to delete, wipe, reset, drop, or kill system/git resources $\longrightarrow$ `ESCALATE_AGENT` + M5 Tool Gate (`ASK`).
5. **Deep Reasoning Trigger:** Request asks for architectural comparison, root cause failure analysis across multiple systems, or trade-off matrices $\longrightarrow$ `ESCALATE_REASONING`.

---

## 6. Current Information Gate (`CURRENT_INFO_REQUIRED`)

Static model weights—whether running locally in Ollama or in cloud frontier models—suffer from **knowledge cutoff blindness** and **parametric hallucination**.

### The Temporal Sensitivity Rule
> **"Does the correct answer depend on information that may have changed since model training or that exists outside MAVE's local static repository?"**

If **YES**, local memory and base model knowledge are declared **insufficient**.

```text
User Request: "OpenAI ล่าสุดเปลี่ยน API อะไรบ้างในเดือนนี้"
                                  │
                                  ▼
                     Current Information Gate
                                  │
      ┌───────────────────────────┴───────────────────────────┐
      │ Temporal Sensitivity: HIGH                            │
      │ Entity: OpenAI API Specifications                     │
      │ Knowledge Horizon: Outside Static Training Cutoff     │
      └───────────────────────────┬───────────────────────────┘
                                  │
                                  ▼
               SEMANTIC ROUTE: CURRENT_INFO_REQUIRED
                                  │
                                  ▼
             Handoff to Pre-M5 F1.8 Research / Truth Engine
             (Retrieves grounded web sources, docs, diffs)
                                  │
                                  ▼
             Cognitive Model synthesizes grounded response
```

### Contract Handoff Interface
The escalation engine emits a structured handoff payload to the future F1.8 subsystem:

```ts
export interface CurrentInfoHandoff {
  readonly query: string;
  readonly entities: string[];
  readonly temporalWindow: {
    readonly requiresLatest: boolean;
    readonly relativeAnchor?: string;
  };
  readonly targetKnowledgeDomain: 'software_api' | 'news' | 'market' | 'general_web';
  readonly requiredOutputForm: 'citations_required' | 'summary_with_sources';
}
```

---

## 7. Knowledge Applicability Model

Traditional RAG systems store unstructured strings or naive `problem -> solution` vector embeddings. When retrieved, small variations in OS, shell environment, library version, or user permissions cause disastrous execution failures.

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
  /** Required installed runtimes or CLIs (e.g., node >= 20, git >= 2.40, ollama) */
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

## 8. Knowledge Trust Lifecycle & State Machine

Knowledge in MAVE is not static. It moves through a strict lifecycle based on **empirical verification, environmental drift, and user feedback**.

```text
                             ┌──────────────┐
                             │     NEW      │
                             └──────┬───────┘
                                    │ Teacher/User solves problem once
                                    ▼
                             ┌──────────────┐
                             │   OBSERVED   │
                             └──────┬───────┘
                                    │ Repeated success (>= 2) with zero corrections
                                    ▼
                             ┌──────────────┐
              ┌─────────────►│   VERIFIED   │◄────────────┐
              │              └──────┬───────┘             │
              │                     │ High success (>= 5, ratio > 0.95)
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

### State Definitions & Transition Matrix

| Initial State | Event / Trigger | Target State | Policy Rationale |
| :--- | :--- | :--- | :--- |
| **`NEW`** | Ingested from single session or frontier model suggestion. | **`OBSERVED`** | Candidate solution captured; unproven in production. |
| **`OBSERVED`** | Successfully executed $\ge 2$ times under matching applicability with 0 corrections. | **`VERIFIED`** | Demonstrated empirical repeatability. |
| **`VERIFIED`** | Successfully executed $\ge 5$ times with success ratio $> 0.95$ under identical conditions. | **`TRUSTED`** | High-confidence operational knowledge. |
| **`TRUSTED`** / **`VERIFIED`**| Environment changes (OS update, Node version bump, repo refactor) OR time exceeds `freshnessHalfLifeDays`. | **`STALE`** | Assumptions may no longer hold; must re-qualify before trusting. |
| **`STALE`** | Successfully verified under new environment conditions. | **`VERIFIED`** | Restored through positive empirical evidence. |
| **`ANY`** | Verification fails, execution throws error, or user explicitly rejects/corrects solution. | **`REJECTED`** | Immediate demotion to prevent toxic recurring failure loops. |

---

## 9. Knowledge Does Not Grant Tool Authority

This is the operational embodiment of **`Similarity != Permission`**.

```text
   Retrieved Knowledge Record:
   "To resolve port 3000 lock on Windows: Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force"
                                      │
                                      ▼
                        Trust State: TRUSTED (Score 0.99)
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
      │ Tool: terminal.execute                                        │
      │ Action: Process Termination (Kill PID)                        │
      │ Risk Level: Level 3 (High Risk / Process State Mutation)      │
      └───────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
                           DECISION: ASK USER
              (Surface displays proposed command & requires confirmation)
```

1. **Knowledge is Cognitive Grounding Only:** Knowledge records inform the model's diagnosis and help draft the proposed plan.
2. **Execution Authority Lives in M5:** The decision to execute any system command, file edit, or network call resides exclusively in MAVE's Tool Permission Policy (`ALLOW`, `ASK`, `DENY`).
3. **No Backdoor:** High trust state (`TRUSTED`) does **not** lower a tool's Risk Level from Level 3 to Level 0.

---

## 10. Local Draft $\longrightarrow$ Big Brain Verify

The `LOCAL_DRAFT_VERIFY` pattern allows MAVE to achieve **frontier-grade output quality** while conserving expensive subscription quota and network bandwidth.

### Economic & Latency Trade-Off Analysis

```text
High Token Generation (Local Fast Brain) ──► Compact Verification (Frontier Brain)
[Drafting: 800 tokens on-device @ 0ms/0$]      [Audit: 150 prompt tokens @ fast TTFT]
```

#### When `LOCAL_DRAFT_VERIFY` is Highly Beneficial:
- **Boilerplate & Test Generation:** Local model drafts 50 lines of unit tests following an existing project pattern. Frontier model only audits for edge cases and syntax correctness ($O(1)$ verification).
- **Structured Schema Formatting:** Local model extracts and structures loose user notes into JSON/YAML. Frontier model checks schema compliance.
- **Bilingual Translation Review:** Local model drafts Thai-to-English translation. Frontier model reviews natural phrasing and idiomatic tone.

#### When `LOCAL_DRAFT_VERIFY` is Harmful (Quota & Latency Waste):
- **Complex Architecture / High Ambiguity:** When the local model has a $< 40\%$ probability of drafting a correct solution, the frontier model must discard the draft entirely and regenerate from scratch. This results in:
  - $2\times$ token latency (Local time + Frontier time),
  - Cluttered prompt context containing incorrect local draft hallucinations,
  - Wasted local compute.

#### Activation Policy
`LOCAL_DRAFT_VERIFY` is strictly restricted to tasks where:
$$\text{TaskComplexity} \le \text{MEDIUM} \quad \land \quad \text{AmbiguityLevel} == \text{UNAMBIGUOUS} \quad \land \quad \text{DraftFailureCost} == \text{LOW}$$

---

## 11. Task Experience Learning & Empirical Routing

MAVE learns routing efficiency **empirically over time** across discrete task categories without modifying model weights.

### Task Category Bucketing

```text
                     Task Category Empirical Telemetry
┌────────────────────────────┬─────────────────────────────┬───────────────────────────┐
│ Category A (Local Mastery) │ Category B (Fragile Local)  │ Category C (Cloud Native) │
│ • Thai-English greetings   │ • PowerShell regex parsing  │ • Multi-package AST edits │
│ • Markdown formatting      │ • Git rebasing diagnostics  │ • Architectural design    │
│ • Unit test boilerplate    │ • Docker compose networking │ • Full feature creation   │
├────────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ Historical Success: > 96%  │ Historical Success: 42%     │ Historical Success: < 5%  │
│ ROUTE: LOCAL_OK            │ ROUTE: ESCALATE_REASONING   │ ROUTE: ESCALATE_AGENT     │
└────────────────────────────┴─────────────────────────────┴───────────────────────────┘
```

### The Incompetence Anti-Pattern
> **Rule:** A model's self-reported confidence (*"I am 100% confident I can fix this backend issue"*) is **never** accepted as evidence of capability.

Only **objective system signals** update task routing competence:
- Zero user follow-up corrections within 3 minutes of completion.
- Automated test suites passing on first try.
- Compiler exit code `0`.
- User explicit positive rating or acceptance.

---

## 12. System-Derived Confidence Formulation

Traditional LLM self-confidence metrics are dangerously misleading—small models frequently display high confidence while hallucinating catastrophic errors.

MAVE computes confidence at the **system level**, combining independent environmental signals.

### Confidence Formula

$$C_{\text{system}} = w_a \cdot A_{\text{match}} + w_f \cdot F_{\text{knowledge}} + w_s \cdot S_{\text{history}} - w_c \cdot C_{\text{complexity}} - w_m \cdot M_{\text{ambiguity}} - w_r \cdot R_{\text{risk}}$$

Where:
- $A_{\text{match}} \in [0, 1]$: Exactness of knowledge applicability conditions to host environment.
- $F_{\text{knowledge}} \in [0, 1]$: Freshness decay factor based on elapsed time vs half-life.
- $S_{\text{history}} \in [0, 1]$: Empirical historical success ratio for this task category.
- $C_{\text{complexity}} \in [0, 1]$: Task structural complexity penalty.
- $M_{\text{ambiguity}} \in [0, 1]$: Missing information / ambiguity penalty.
- $R_{\text{risk}} \in [0, 1]$: Blast radius penalty (M5 Risk Levels).

### Hard Confidence Clamps
1. **Ambiguity Clamp:** If $M_{\text{ambiguity}} > 0.5$, $C_{\text{system}}$ is hard-clamped to $\le 0.40$ (forces `USER_CLARIFICATION_REQUIRED`).
2. **Destructive Risk Clamp:** If $R_{\text{risk}} == \text{DESTRUCTIVE}$, $C_{\text{system}}$ is hard-clamped to $\le 0.30$ (forces explicit human approval `ASK`).
3. **Model Self-Confidence Weight:** If model emits a self-confidence probability $p_{\text{self}}$, it is weighted at $\le 0.05$ in the overall evaluation.

---

## 13. Intelligence Routing vs. Tool Authority Boundary

The system maintains a rigid architectural separation between cognitive choice and host action permissions:

```text
                    MAVE Orchestrator (packages/core)
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
Intelligence Router                                Tool Permission Engine
(Decides WHO thinks)                               (Decides WHAT executes)
         │                                                   │
         ├─► Local Ollama                                    ├─► Level 0: ALLOW (read files, git status)
         ├─► Claude Code                                     ├─► Level 1: ALLOW (run tests, open window)
         ├─► Codex                                           ├─► Level 2: ASK   (network egress, git push)
         └─► Antigravity                                     └─► Level 3: ASK   (delete files, kill PID)
```

- When Claude Code or Codex is selected, it receives workspace files in its prompt context.
- When Claude Code or Codex responds with a proposed tool call (e.g., `execute_command("git reset --hard")`), the tool call is intercepted by `@mave/core`.
- The tool call is passed to the **Tool Permission Engine (Milestone 5)**.
- If the policy evaluates to `ASK`, MAVE renders the approval dialog on the Ambient Surface.
- The cloud provider cannot execute anything on the user's host machine directly.

---

## 14. User Overrides & Operational Modes

MAVE honors user sovereignty across three operational modes:

```text
┌─────────────────┬──────────────────────────────────────────────────────────────────────────┐
│ Mode            │ Operational Behavior & Escalation Invariants                             │
├─────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ **`AUTO`**      │ MAVE dynamically selects Local vs Subscription vs Research according to │
│                 │ deterministic escalation rules. Fallback follows frozen F1.4 policy.     │
├─────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ **`PREFERRED`** │ User specifies preferred runtime (e.g. `claude_code` or `local_ollama`). │
│                 │ MAVE routes to preferred runtime first; falls back to secondary only if  │
│                 │ preferred runtime is unhealthy or quota is exhausted.                   │
├─────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ **`LOCKED`**    │ User pins an exact provider/model. MAVE NEVER auto-escalates or switches.│
│                 │ • LOCKED `local_ollama` will NEVER send prompts to cloud runtimes.       │
│                 │ • LOCKED `claude_code` will NEVER switch to `codex` on error.            │
│                 │ If locked provider fails, MAVE reports error cleanly without fallback.   │
└─────────────────┴──────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Privacy & `localOnly` Semantics

When `privacy.localOnly` is enabled (globally or for a specific session/workspace):

1. **Strict Cloud Containment:** No user prompts, code snippets, filenames, or contextual tokens may leave the local machine.
2. **Escalation Invariant:** Escalation to `Claude Code`, `Codex`, `Antigravity`, or Paid APIs is **hard blocked**.
3. **Fail-Closed Behavior:** If a user requests a task requiring frontier reasoning (e.g., *"Refactor this monorepo"*) while `localOnly: true`:
   - MAVE does **not** silently violate privacy.
   - MAVE informs the user via the Ambient Surface:
     > *"This task requires Frontier Reasoning, but your session is set to Local Only. Please disable Local Only or allow cloud escalation to proceed."*

---

## 16. Concrete End-to-End Walkthroughs

### Scenario A: Casual Chat ("วันนี้เหนื่อยจัง")
```text
1. User Input: "วันนี้เหนื่อยจัง"
2. Signals: taskComplexity: LOW, riskClass: READ_ONLY, currentInfoRequired: FALSE, repoScope: NONE
3. Escalation Decision: LOCAL_OK
4. Intelligence Selection: Local Fast Brain (Ollama / qwen2.5:3b-instruct)
5. Tool Gate: None required (Pure conversational text)
6. Result: Empathetic Thai response delivered via M4 Compact Capsule in < 800ms.
```

### Scenario B: Language Tutoring ("ประโยคนี้ภาษาอังกฤษพูดยังไง")
```text
1. User Input: "ประโยคนี้ภาษาอังกฤษพูดยังไง: 'ฉันไม่ค่อยสะดวกคุยตอนนี้'"
2. Signals: taskComplexity: LOW, riskClass: READ_ONLY, currentInfoRequired: FALSE
3. Escalation Decision: LOCAL_OK
4. Intelligence Selection: Local Fast Brain
5. Tool Gate: None
6. Result: Returns natural translations ("I'm not really free to talk right now"), vocabulary breakdown, and registers learning event in M7 Learning Engine.
```

### Scenario C: Past Windows Share Issue ("Windows เครื่องนี้เปิด share ไม่ได้ เหมือนครั้งก่อน")
```text
1. User Input: "Windows เครื่องนี้เปิด share ไม่ได้ เหมือนครั้งก่อน"
2. Signals: taskComplexity: MEDIUM, riskClass: MUTATION, knowledgeApplicability: CHECKING
3. Knowledge Retrieval: Record #SMB-402 retrieved ("SMBv1 disabled after Windows update").
4. Applicability Evaluation:
   - OS: Windows 11 (Match)
   - Binary: PowerShell (Match)
   - Trust State: VERIFIED
5. INVARIANT CHECK: Similarity != Permission!
   - MAVE does NOT execute "Enable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol".
6. Escalation Decision: LOCAL_WITH_KNOWLEDGE
7. Local Brain Output: Explains the likely cause based on previous incident, asks diagnostic confirmation:
   > "ครั้งก่อนเกิดจาก service LanmanServer ไม่ได้ start คุณต้องการให้ MAVE ตรวจสอบ service นี้หรือไม่?"
8. User Confirms: "ใช่ ตรวจสอบเลย"
9. Tool Gate: M5 allows Level 0 Read-Only command `Get-Service LanmanServer`.
```

### Scenario D: Backend Refactor ("ช่วยแก้ backend repo นี้")
```text
1. User Input: "ช่วยแก้ backend repo นี้ ให้เปลี่ยน auth middleware เป็น JWT verification"
2. Signals: taskComplexity: HIGH, riskClass: MUTATION, repoScope: MULTI_FILE, codeMutationRequired: TRUE
3. Escalation Decision: ESCALATE_CODING
4. Intelligence Selection: Claude Code Subscription Runtime (Model Role: CODING / sonnet)
5. Cognitive Output: Claude Code analyzes AST, generates diff patches for 4 files.
6. Tool Gate: Proposed file writes are routed to M5 Tool Permission Engine.
7. M5 Policy: Level 1/2 Workspace Modification requires user review. Diff presented on M4 Expanded Panel. User clicks "Apply".
```

### Scenario E: Recent API Changes ("OpenAI ล่าสุดเปลี่ยน API อะไร")
```text
1. User Input: "OpenAI ล่าสุดเปลี่ยน API อะไรบ้างในสัปดาห์นี้"
2. Signals: temporalMarker: TRUE ("ล่าสุด", "สัปดาห์นี้"), currentInfoRequired: TRUE
3. Escalation Decision: CURRENT_INFO_REQUIRED
4. Orchestrator Action: Handoff to Pre-M5 F1.8 Research / Truth Engine.
5. Research Pipeline: Fetches official OpenAI changelog via verified web connector.
6. Synthesis: Local or Deep Brain formats verified factual points with source citations.
```

### Scenario F: Destructive Command ("ลบ branch นี้ให้หน่อย")
```text
1. User Input: "ลบ branch feat/legacy-test ให้หน่อย"
2. Signals: taskComplexity: LOW, riskClass: DESTRUCTIVE, toolExecutionRequired: TRUE
3. Escalation Decision: LOCAL_OK (Cognitive task is simple: resolve branch name to git command)
4. Local Brain Proposes Tool Action: `git.branch_delete({ branch: "feat/legacy-test", force: true })`
5. INVARIANT CHECK: Intelligence Escalation != Tool Permission!
   - Even though Local Brain resolved the command trivially, it has ZERO authority to execute.
6. M5 Tool Gate: Level 3 Destructive Action detected.
7. Action: MAVE halts execution and renders explicit confirmation dialog on M4 Surface:
   > "Confirm permanent deletion of local branch 'feat/legacy-test'?"
8. Execution: Only runs if user clicks "Confirm Delete".
```

---

## 17. Failure Mode Analysis & Mitigations

| Failure Mode | Risk Description | Root Cause | Concrete Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **False Similarity** | Applying a past solution to an unrelated problem that looked superficially identical. | Naive vector embedding distance without checking applicability constraints. | Strict `KnowledgeApplicabilityConditions` checking (OS, runtime, package version) before knowledge is admitted. |
| **Stale Knowledge** | Running a configuration command that is obsolete or harmful on updated OS/framework versions. | Knowledge record has aged past its validity half-life without re-verification. | Knowledge Trust Lifecycle: Records automatically transition to `STALE` on version drift or TTL expiration. |
| **Wrong Environment Assumptions** | Executing a Linux bash script on Windows PowerShell. | Lack of explicit environment boundary metadata in stored memory. | Mandatory `environmentAssumptions` schema validation. Path and command normalizers in M5. |
| **Local Hallucination** | Small local model invents nonexistent APIs or incorrect shell parameters. | Model parameter capacity limits on complex reasoning tasks. | Heuristic escalation triggers: Multi-file or complex syntax queries are escalated to `ESCALATE_CODING`. |
| **Over-Escalation (Quota Waste)** | Routing trivial chit-chat or simple questions to expensive subscription models. | Overly aggressive complexity heuristics. | Strict `LOCAL_OK` qualification gate keeps casual and conversational turns on-device. |
| **Under-Escalation** | Attempting to refactor an entire monorepo using an on-device 3B parameter model. | Routing based purely on user prompt length rather than semantic scope. | Deterministic AST / workspace file scope triggers force escalation to `ESCALATE_AGENT`. |
| **Privacy Leakage** | Sending sensitive personal or corporate data to cloud frontier providers. | Autonomous escalation without checking privacy constraints. | Hard fail-closed constraint: `privacy.localOnly == true` mathematically blocks cloud routing. |
| **Tool Authority Confusion** | Model assumes that proposing a tool call implies it has permission to run it. | Conflating cognitive generation with runtime execution rights. | Hard invariant: `Intelligence Escalation != Tool Permission`. M5 security gate intercepts all tool calls. |
| **Contamination Feedback Loops** | An erroneous local response is saved to memory and reinforces future mistakes. | Unverified memory writes. | Only verified outcomes (tests passing, user confirmation) promote knowledge to `VERIFIED` or `TRUSTED`. |

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

### Milestone 6 (Memory)
- M6 owns the **storage, indexing, user edit/delete controls, and persistence** of memory records in SQLite and vector stores.
- This design provides M6 with the **Knowledge Applicability Schema, Provenance Model, and Trust State Lifecycle**.

### Milestone 7 (Learning Engine)
- M7 analyzes conversational mistakes, tracks vocabulary acquisition, and schedules reviews.
- This design supplies M7 with the **Teacher Loop distillation pipeline, Historical Outcome Telemetry, and Empirical Routing Categories**.

### Pre-M5 F1.8 (Research / Truth Routing)
- F1.8 owns external web retrieval, real-time scraping, and citation synthesis.
- This design defines the **Current Information Gate (`CURRENT_INFO_REQUIRED`)** handoff contract that triggers F1.8.

### Pre-M5 F1.5-C3 / F1.5-C4 Preservation
- This design is an **architecture and policy track only**.
- It does not modify local model qualification, resident memory management, or benchmark status. F1.5-C3 (Local Model Lifecycle) remains next on the implementation sequence at the Home PC development node.

---

## 21. Summary of Canonical Invariants

1. **`Similarity != Permission`:** Vector similarity or recurring patterns provide diagnostic hypotheses, never authorization to alter system state or bypass permissions.
2. **`Intelligence Escalation != Tool Permission`:** Selecting a frontier model to think gives it cognitive bandwidth, never ambient tool execution rights on the user's host.
3. **`Privacy Wins Fail-Closed`:** When `localOnly: true`, cloud escalation paths are mathematically closed; MAVE reports limits transparently rather than leaking context.
4. **`Paid APIs Disabled by Default`:** Escalation targets Subscription Runtimes (`Claude Code`, `Codex`, `Antigravity`). Paid APIs remain opt-in only.
5. **`Human in Control`:** All Level 2/3 tool operations require explicit user approval via the M4 Ambient Surface.
