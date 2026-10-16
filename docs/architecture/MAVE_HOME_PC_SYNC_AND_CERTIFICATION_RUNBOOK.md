# MAVE Home-PC Pre-Sync & Reproducibility Runbook

> [!IMPORTANT]
> **PRE-HOME SYNC & REPRODUCIBILITY AUDIT — ZERO CODE CHANGES**
> This runbook prepares MAVE for a safe, deterministic transition from Work PC to Home PC prior to executing **C3.1 (Local Fast Brain Runtime)** and **C4-B (Voice / Language / Conversation)** live physical certification.
>
> **CRITICAL DIRECTIVE**:
> **DO NOT RUN C3.1 / C4-B CERTIFICATION UNTIL SOURCE PARITY IS VERIFIED ON THE HOME PC.**
> - Do not perform destructive resets (`git reset --hard`).
> - Do not blindly force-push or blind-pull into diverged branches.
> - Do not modify models, pull new models, or alter production code.

---

## 1. Work-PC Current State & Commit Manifest

### Current Working-Tree Baseline
- **Repository Path**: `D:\project\MAVE-pre-m5`
- **Current Branch**: `feat/pre-m5-intelligence-providers`
- **Current HEAD Commit**: Target commit `fix(intelligence): harden local brain residency lifecycle` (following `754b4dc`)
- **Working Tree Status**: Clean (`nothing to commit, working tree clean`)

### Complete Intelligence Sprint Commit Chain
The following 8 sequential commits comprise the entire C4-A conversation closeout, certification harness, F1.6 Deep Brain audit, and C3.1 static residency lifecycle hardening:

| Order | Short SHA | Commit Title | Purpose & Architectural Scope |
|---|---|---|---|
| **1** | `fb8915c` | `feat(intelligence): prepare conversation voice closeout` | **C4-A Closeout**: Language learning contracts, VoiceManager handoff, TaskPolicy normalization, telemetry propagation. |
| **2** | `946e03a` | `fix(intelligence): harden conversation closeout contracts` | **C4-A.1 Hardening**: Isolated conversational coding from `agent_work`; removed invented latency gates; hardened prewarm tokens. |
| **3** | `0de60a5` | `test(intelligence): prepare home runtime certification harness` | **Certification Harness**: Non-destructive measurement utilities, nanosecond Ollama timing, 7-phase VRAM sampler, report template. |
| **4** | `540e55a` | `docs(intelligence): audit deep brain architecture` | **F1.6 Audit**: Initial architecture gap analysis, provider-kind taxonomy, and F1.7 roadmap reconciliation. |
| **5** | `07d8335` | `docs(intelligence): harden deep brain architecture` | **F1.6 Hardening**: Corrected VRAM co-residency math (~3,478 MiB / ~8,130 MiB); removed speculative offload gates; decoupled Brain from UI. |
| **6** | `0e4fce5` | `docs(intelligence): align deep brain surface terminology` | **F1.6 Terminology Alignment**: Replaced legacy ring/orb phrasing with canonical MAVE UI V2 presence/companion/workspace definitions. |
| **7** | `754b4dc` | `docs(intelligence): prepare home certification sync runbook` | **Pre-Home Sync Runbook**: Reproducibility manifest, Home-PC prerequisite gates, and conflict handling protocols. |
| **8** | *(HEAD)* | `fix(intelligence): harden local brain residency lifecycle` | **C3.1 Static Hardening**: LocalBrainResidencyPolicy, zero-preload startup invariant, single-flight prewarm, active lease safety. |

### C3 Ancestry Verification
- **Promoted C3 Base Commit**: `68e1d07699fb1d2402c20a24d9dc82a0987a357e` (`feat(intelligence): promote local fast brain runtime`)
- **Ancestry Verification**: Verified via `git merge-base --is-ancestor 68e1d07699fb1d2402c20a24d9dc82a0987a357e HEAD` $\to$ **Exit Code 0 (CONFIRMED ANCESTOR)**. History is completely linear and preserves all C3 residency/qualification contracts.

---

## 2. Protected-Path & Code Integrity Audit

A comprehensive diff audit across the entire intelligence sprint (`a943edc..HEAD`) confirms:
- **`docs/pic/*`**: 0 modifications.
- **`docs/uiref/*`**: 0 modifications.
- **`apps/desktop/src/renderer/*`**: 0 modifications (UI V2 foundation remains 100% frozen).
- **Runtime Changes**: Strictly confined to `packages/core`, `packages/contracts`, and non-destructive scripts in `scripts/certification/`. Zero production model changes.

---

## 3. Certification Harness Inventory

The Home PC certification suite resides at current `HEAD` and includes the following utilities:

| Script / Entrypoint | Path | Purpose |
|---|---|---|
| **Master Harness** | [`scripts/certification/runner.ts`](file:///d:/project/MAVE-pre-m5/scripts/certification/runner.ts) | Master runner: gathers environment, checks exact digest, runs 5 benchmark routing cases, samples VRAM. |
| **Package Command** | `pnpm cert:home` | Exposed in root `package.json` (`tsx scripts/certification/runner.ts`). |
| **Timing Capture** | [`scripts/certification/timing-capture.ts`](file:///d:/project/MAVE-pre-m5/scripts/certification/timing-capture.ts) | Records raw nanoseconds to resolve the historical ~189 tok/s vs ~16.9 tok/s discrepancy. |
| **Multi-Turn Runner** | [`scripts/certification/multi-turn-runner.ts`](file:///d:/project/MAVE-pre-m5/scripts/certification/multi-turn-runner.ts) | Verifies 3-turn conversational context recall ("TypeScript"). |
| **Language Runner** | [`scripts/certification/language-runner.ts`](file:///d:/project/MAVE-pre-m5/scripts/certification/language-runner.ts) | Validates learning stages (`seen` $\to$ `practiced` $\to$ `reviewed`) and enforces zero fake pronunciation scores. |
| **Cancellation Check** | [`scripts/certification/cancellation-runner.ts`](file:///d:/project/MAVE-pre-m5/scripts/certification/cancellation-runner.ts) | Verifies immediate `AbortSignal` cessation with zero phantom tokens and zero fallback retry. |
| **Voice Loop Helper** | [`scripts/certification/voice-check-helper.ts`](file:///d:/project/MAVE-pre-m5/scripts/certification/voice-check-helper.ts) | Calculates boundary timestamps (Wake $\to$ STT $\to$ Brain $\to$ TTS $\to$ Presence) and manual audio checklist. |
| **Restart Helper** | [`scripts/certification/restart-helper.ts`](file:///d:/project/MAVE-pre-m5/scripts/certification/restart-helper.ts) | Step-by-step guidance for verifying Ollama daemon crash recovery and `/api/ps` state reconciliation. |
| **Report Template** | [`docs/architecture/MAVE_C3_1_C4_B_HOME_LIVE_CERTIFICATION_TEMPLATE.md`](file:///d:/project/MAVE-pre-m5/docs/architecture/MAVE_C3_1_C4_B_HOME_LIVE_CERTIFICATION_TEMPLATE.md) | Official 20-section certification template pre-populated with `NOT RUN — HOME PC REQUIRED`. |

---

## 4. Home-PC Prerequisite Manifest

Before initiating any certification commands, the Home PC environment must fulfill the following prerequisites across all categories:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      HOME PC PREREQUISITE MATRIX                       │
├────────────────────┬───────────────────────────────────────────────────┤
│ REPOSITORY         │ • Branch: feat/pre-m5-intelligence-providers      │
│                    │ • Verified Clean Worktree (git status clean)      │
│                    │ • Verified HEAD == Target commit 8 (fix(intelligence): ...) │
│                    │ • Dependencies: pnpm install --frozen-lockfile    │
├────────────────────┼───────────────────────────────────────────────────┤
│ RUNTIME            │ • Node.js >= 20.x, pnpm >= 9.x/10.x               │
│                    │ • Local Ollama daemon active at 127.0.0.1:11434   │
│                    │ • Model: qwen2.5:1.5b pre-existing in Ollama      │
│                    │ • Exact Digest: 65ec06548149b04c096a120e4...      │
│                    │ • DO NOT pull, upgrade, or replace model          │
│                    │ • Python runtime with faster-whisper available    │
│                    │ • EdgeTTS network reachable                       │
│                    │ • Paid APIs disabled (allowPaidApis = false)      │
├────────────────────┼───────────────────────────────────────────────────┤
│ HARDWARE           │ • NVIDIA GeForce RTX 3060 Ti (8192 MiB VRAM)      │
│                    │ • NVIDIA Game Ready / Studio Driver (CUDA 12+)   │
│                    │ • nvidia-smi accessible on Windows PATH           │
│                    │ • Working microphone (Default recording device)   │
│                    │ • Working speakers/headphones (Default playback)  │
├────────────────────┼───────────────────────────────────────────────────┤
│ MANUAL OPERATOR    │ • Seated human operator for voice/barge-in checks │
│                    │ • Visual observation of MAVE wordmark presence    │
└────────────────────┴───────────────────────────────────────────────────┘
```

---

## 5. Safe Synchronization Options

Three safe synchronization methods are available. **Method A is recommended** when remote branch tracking is active.

### Method A: Remote Synchronization via Git (Recommended)
Because Work PC's HEAD is tracked on `origin/feat/pre-m5-intelligence-providers`, Home PC can fast-forward cleanly:

1. **Home PC Step 1 — Pre-Fetch Inspection**:
   ```powershell
   git status
   git branch -vv
   git log --oneline -3
   ```
   *Verify working tree is clean and currently on `feat/pre-m5-intelligence-providers`.*
2. **Home PC Step 2 — Fetch Remote State**:
   ```powershell
   git fetch origin
   ```
3. **Home PC Step 3 — Divergence Check Before Merging**:
   ```powershell
   git log --left-right --graph origin/feat/pre-m5-intelligence-providers...HEAD
   ```
   - If output shows only `>` commits (Home is simply behind): **SAFE TO FAST-FORWARD**.
   - If output shows `<` commits (Home has local commits not on origin): **STOP! Follow Section 6**.
4. **Home PC Step 4 — Fast-Forward**:
   ```powershell
   git merge --ff-only origin/feat/pre-m5-intelligence-providers
   ```
5. **Home PC Step 5 — Verify Parity**:
   ```powershell
   git rev-parse HEAD
   # Must match Work PC HEAD commit (fix(intelligence): harden local brain residency lifecycle)
   ```

---

### Method B: Git Bundle Transfer (Offline / Push-Avoidance Alternative)
If remote GitHub synchronization is bypassed or offline transfer is preferred:

1. **Work PC — Create Bundle**:
   ```powershell
   git bundle create C:\path\to\mave-intelligence.bundle a943edc..HEAD
   ```
2. **Transfer**: Copy `mave-intelligence.bundle` via local USB or network drive to Home PC.
3. **Home PC — Verify and Fetch Bundle**:
   ```powershell
   git bundle verify C:\path\to\mave-intelligence.bundle
   git fetch C:\path\to\mave-intelligence.bundle feat/pre-m5-intelligence-providers:bundle-incoming
   git merge --ff-only bundle-incoming
   git branch -d bundle-incoming
   ```

---

### Method C: Patch Set Application (Recovery Fallback Only)
If git bundle or remote fast-forward cannot be used:
1. **Work PC — Export Patches**:
   ```powershell
   git format-patch a943edc..HEAD -o ./patches
   ```
2. **Home PC — Apply Patches Safely**:
   ```powershell
   git apply --check ./patches/*.patch
   git am ./patches/*.patch
   ```

---

## 6. Home-PC Conflict Safety & Divergence Handling

If the Home PC already contains local commits (e.g. from earlier local C3 experiments or local fixes), **DO NOT blind-pull or blind-rebase**. Follow this explicit triage:

```mermaid
flowchart TD
    Start["Home PC: git fetch origin"] --> CheckStatus{"Inspect:<br/>git status & git log --left-right"}

    CheckStatus -->|Clean & Simply Behind| FastForward["Case A: Fast-Forward<br/>git merge --ff-only origin/...<br/>SAFE"]
    CheckStatus -->|Uncommitted Local Work| StopStash["Case B: Uncommitted Changes<br/>STOP! Stash or Commit to Task Branch<br/>NEVER reset --hard"]
    CheckStatus -->|Diverged History (Local Commits Exist)| StopDiverged["Case C: Diverged History<br/>STOP CONDITIONS TRIGGERED!<br/>Backup Branch -> Manual Review"]

    StopDiverged --> Backup["git branch backup/home-local-pre-sync"]
    Backup --> Compare["git log --cherry-pick --right-only origin/...HEAD"]
    Compare --> Resolve["Reconcile with Pair Programmer<br/>DO NOT force-push or blind-merge"]
```

### Case A: Clean Fast-Forward
- `git status` is clean.
- `git rev-list HEAD..origin/feat/pre-m5-intelligence-providers` has commits, but `origin/feat/pre-m5-intelligence-providers..HEAD` is empty.
- **Action**: Run `git merge --ff-only origin/feat/pre-m5-intelligence-providers`.

### Case B: Uncommitted Local Work on Home PC
- `git status` shows modified or untracked files.
- **Action**: **STOP!**
  - Run `git diff` to review the modifications.
  - If valuable: commit to a temporary branch (`git checkout -b temp/home-work-stash && git commit -m "chore: save local home work"`).
  - Return to `feat/pre-m5-intelligence-providers` and ensure clean worktree before merging.
  - **NEVER use `git reset --hard` or `git clean -fd`**.

### Case C: Diverged Commit Histories
- Both Work PC and Home PC have commits that the other does not have.
- **Action**: **CRITICAL STOP!**
  1. Create immediate backup branch:
     ```powershell
     git branch backup/home-c3-divergence
     ```
  2. Inspect the divergence:
     ```powershell
     git log --oneline --left-right --boundary origin/feat/pre-m5-intelligence-providers...HEAD
     ```
  3. Determine if the Home PC commits are already superseded by Work PC's C4-A closeout.
  4. If Home PC has unique fixes, cherry-pick them onto a new version branch. **Never force-rebase shared history.**

---

## 7. Exact Home-PC Certification Start Gate

Before running `pnpm cert:home`, all 6 gate criteria must be confirmed:

```powershell
# GATE 1: Verify correct branch
git branch --show-current
# -> Must output: feat/pre-m5-intelligence-providers

# GATE 2: Verify exact commit
git rev-parse HEAD
# -> Must match Work PC HEAD commit (fix(intelligence): harden local brain residency lifecycle)

# GATE 3: Verify clean working tree
git status
# -> Must output: "nothing to commit, working tree clean"

# GATE 4: Verify Ollama daemon reachability & model tag
curl.exe http://127.0.0.1:11434/api/tags
# -> Must return JSON containing "qwen2.5:1.5b"

# GATE 5: Verify GPU & nvidia-smi
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
# -> Must return: "NVIDIA GeForce RTX 3060 Ti, 8192 MiB" (or equivalent)

# GATE 6: Verify dependencies are fresh
pnpm install --frozen-lockfile
# -> Must finish with exit code 0
```

> [!CAUTION]
> If ANY of the 6 gates fail, **ABORT CERTIFICATION**. Resolve the prerequisite before running the test harness.

---

## 8. Certification Execution Sequence

Once all 6 gates are green, execute the certification steps on Home PC in this exact order:

```powershell
# Step 1: Run the master automated certification harness
pnpm cert:home

# Step 2: Capture raw Ollama nanosecond counters (resolves ~189 vs ~16.9 tok/s)
pnpm tsx scripts/certification/timing-capture.ts

# Step 3: Run multi-turn conversational memory check
pnpm tsx scripts/certification/multi-turn-runner.ts

# Step 4: Run language pedagogy & anti-hallucination check
pnpm tsx scripts/certification/language-runner.ts

# Step 5: Run mid-stream cancellation check
pnpm tsx scripts/certification/cancellation-runner.ts

# Step 6: Run voice boundary timestamp helper & perform manual audio checks
pnpm tsx scripts/certification/voice-check-helper.ts

# Step 7: Run daemon restart observation
pnpm tsx scripts/certification/restart-helper.ts
```

### Result Artifact Handling
- The certification runner and scripts print structured results to `stdout` (`console.log`).
- **No secret files or source files are overwritten.**
- Copy the empirical values from the terminal into a new report file:
  `docs/architecture/MAVE_C3_1_C4_B_HOME_LIVE_CERTIFICATION_REPORT.md` (instantiated from the template).

---

## 9. Current Milestone Roadmap Snapshot

As of this runbook, the milestone states are strictly recorded as:

- **UI V2 Visual Architecture**: `FROZEN`
- **C3 Local Fast Brain Code**: `COMPLETE` (awaiting physical Home-PC certification)
- **C4-A Voice / Language Closeout**: `COMPLETE` (deterministic contracts hardened)
- **Home Certification Harness**: `READY`
- **C3.1 Local Fast Brain Runtime Certification**: `HOME-PC REQUIRED (PENDING LIVE EXECUTION)`
- **C4-B Voice / Conversation Live Certification**: `HOME-PC REQUIRED (PENDING LIVE EXECUTION)`
- **F1.6 Deep Brain Architecture Audit**: `FROZEN (AUDIT COMPLETE)`
- **F1.6 Deep Brain Implementation**: `NOT STARTED`
- **F1.7 Agent Runtime Normalization**: `COMPLETE (FULFILLED VIA F1.5-S1..S5)`
- **Paid APIs**: `DISABLED BY DEFAULT (allowPaidApis = false)`
