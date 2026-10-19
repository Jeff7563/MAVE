# MAVE Office Architecture Handoff (2026-10-19)

**Handoff Date**: 2026-10-19
**Source Repository (Workplace)**: `D:\project\MAVE-f1.9`
**Office Audit Baseline HEAD**: `09e97cf079f02402481baad38c852a6fa835eced` (`09e97cf`)
**Protected Audit Branch**: `work/f1.9-diagnostics-audit` (Untouched, Unmodified)
**Dedicated Handoff Branch**: `docs/office-prep-20261019`
**Target Implementation Repository (Home PC)**: `C:\project\MAVE-f1.6`
**Target Implementation Branch**: `work/f1.9-diagnostics-implementation`
**Last Reported Home PC HEAD**: `327318a`

---

## 1. Executive Summary & Purpose

This handoff package archives the complete, verified, and reconciled pre-implementation architecture specifications completed on the Workplace Office PC on October 19, 2026.

These documents provide the authoritative blueprint for subsequent implementation and live hardware certification on the Home PC (`C:\project\MAVE-f1.6`).

> [!IMPORTANT]
> **DOCUMENTATION HANDOFF ONLY โ€” ZERO PRODUCTION IMPLEMENTATION ON THIS BRANCH**
> - The Office PC checkout contains the canonical architecture audit, **NOT** the live runtime implementation.
> - **Pre-M5 `toolUse: false` remains frozen and enforced.**
> - **Milestone 5 implementation is NOT authorized.**
> - No code, binary, model weight, or configuration file has been altered.

---

## 2. Program Lifecycle Status Matrix

To prevent conflation of planning with empirical completion, all program tracks are strictly classified:

| Milestone / Subsystem | Architectural Planning | Code Implementation | Live Hardware Verification / Certification | Current Operational Status |
| :--- | :--- | :--- | :--- | :--- |
| **Milestones M0โ€“M4** | COMPLETED | COMPLETED | CERTIFIED PASS | **CLOSED OUT** |
| **Pre-M5 F1.0โ€“F1.5** | COMPLETED | COMPLETED | CERTIFIED PASS | **CLOSED OUT** |
| **Pre-M5 F1.5-C3/C4** | COMPLETED | COMPLETED | C4-A PASS; C4-B PENDING HOME | **AWAITING HOME PC HARDWARE** |
| **Pre-M5 F1.6โ€“F1.8** | COMPLETED | COMPLETED | CERTIFIED PASS | **FROZEN AUDIT BASELINE** |
| **Pre-M5 F1.9-A/B/C** | COMPLETED | COMPLETED (Home PC) | PENDING HOME TEST SUITE | **BASE HEAD: 327318a** |
| **Pre-M5 F1.9-D.1** | COMPLETED | COMPLETED (Home PC) | **PENDING HOME VERIFICATION** | **HARD GATE FOR F1.9-G** |
| **Pre-M5 F1.9-E** | **PREPARATION COMPLETED** | **PENDING IMPLEMENTATION** | PENDING HOME TEST SUITE | **READY FOR HOME IMPLEMENTATION** |
| **Pre-M5 F1.9-F** | **PREPARATION COMPLETED** | **PENDING IMPLEMENTATION** | PENDING HOME TEST SUITE | **READY FOR HOME IMPLEMENTATION** |
| **Pre-M5 F1.9-G** | **CERTIFICATION PLAN COMPLETED**| N/A (Test Suite) | **PENDING HOME PC CERTIFICATION**| **BLOCKED BY D.1, E, AND F** |
| **Pre-M5 F1.10** | SPECIFIED | NOT STARTED | PENDING PRE-M5 FINISH | **CLOSEOUT PENDING** |
| **Milestone 5 (M5)** | **ARCH. PREPARATION COMPLETED**| **NOT AUTHORIZED** | **NOT AUTHORIZED** | **STRICTLY BLOCKED BY GATES 1โ€“8** |

---

## 3. Core Frozen Invariants

All handoff documents and subsequent implementations must uphold these non-negotiable architectural invariants:

1. **`OBSERVABILITY != AUTHORITY`**
   Diagnostics inspects system state, latency, and errors, but possesses **zero authority** to mutate files, execute commands, restart daemons, or spend API credits.
2. **`LLM PROPOSAL != EXECUTION AUTHORITY`**
   A model may draft an action proposal. The host runtime Permission Engine arbitrates whether the action is permitted.
3. **`SIMILARITY != PERMISSION`**
   Vector similarity or past success under matching conditions is diagnostic evidence, never autonomous authority to execute commands.
4. **`INTELLIGENCE ESCALATION != TOOL PERMISSION`**
   Selecting a higher cognitive brain (Claude Code, Codex, Antigravity) grants reasoning bandwidth, zero tool rights.
5. **`MCP != PERMISSION BYPASS`**
   Model Context Protocol tools pass through MAVE's native Permission Engine identically to local tools.
6. **`SUBSCRIPTION ACCESS != TOOL AUTHORITY`**
   Subscription CLI availability does not bypass MAVE policy or grant blanket host execution permission.
7. **`Pre-M5 toolUse = false`**
   All active providers and contracts enforce `toolUse: false`. Agent CLIs run in safe, restricted modes.

---

## 4. Handoff Document Index

This documentation package contains the following reconciled architecture specifications:

1. [`F1_9_E_PREPARATION.md`](./F1_9_E_PREPARATION.md)
   **Degraded-Mode Arbitration, Recovery Policy & Failure Classification**
   - Formalizes Degraded Modes A through F.
   - Enforces the 6 canonical recovery classes (`SAFE_AUTOMATIC`, `USER_RETRY`, `REAUTH_REQUIRED`, `CONFIGURATION_REQUIRED`, `MANUAL_SERVICE_RECOVERY`, `BLOCKED_BY_POLICY`).
   - Locks the F1.4 midstream commit boundary (`provider.chat()` invocation = execution commitment; zero hidden cross-provider retry).
   - Enforces the F1.8 Degraded Truth Invariant for `CURRENT` / `BREAKING` factual claims.
   - Reconciles canonical 7 phases and 5 lowercase severities.

2. [`F1_9_F_PREPARATION.md`](./F1_9_F_PREPARATION.md)
   **Diagnostic Snapshot Aggregation, Privacy-Safe Support Export & Read-Only IPC**
   - Defines the `MaveDiagnosticSnapshot` aggregation architecture.
   - Preserves the authoritative 8-status `ProviderHealth` contract with companion `operationalHealth: 'unknown'`.
   - Specifies allowlist-only support export bundle generation with zero prompt/secret/path leakage.
   - Establishes read-only Electron IPC channels in `apps/desktop/src/main/ipc.ts` with frame origin validation.
   - Defines the F01โ€“F36 test suite.

3. [`F1_9_G_CERTIFICATION_PLAN.md`](./F1_9_G_CERTIFICATION_PLAN.md)
   **Live Reliability Certification Strategy & Test Matrix**
   - Defines the 4-gate entry requirements.
   - Preserves `TEST-F1.9-01` through `TEST-F1.9-20` verbatim from Section 30 of the F1.9 audit.
   - Corrects Home PC target hardware to **NVIDIA RTX 3060 Ti, 8 GB VRAM**.
   - Enforces the C3.1 zero-startup-prewarm invariant.
   - Disentangles `traceId` (global pipeline token) from `requestId` (independent child spans).
   - Distinguishes audio buffer dispatch proxy observation from confirmed acoustic onset.
   - Flags unverified script commands and candidate limits.

4. [`M5_ARCHITECTURE_PREPARATION.md`](./M5_ARCHITECTURE_PREPARATION.md)
   **Milestone 5 Pre-Implementation Architecture Review & Reconciliation**
   - Documents actual adapter reality across Claude (`--tools ""`), Codex (`--sandbox read-only`), and Antigravity (process kill on tool step).
   - Classifies Agent CLI Tool Brokering as **UNVERIFIED PROVIDER CAPABILITY**.
   - Recommends an initial M5 MVP built strictly on MAVE-owned native tools.
   - Specifies the Trusted Approval Contract (anti-spoofing, single-use tokens, TOCTOU revalidation).
   - Decouples task cancellation from voice barge-in and audio interrupts.
   - Establishes the 16-threat security model and corrected `TEST-M5-01` through `TEST-M5-28` matrix.

---

## 5. Home PC Action Sequence (`C:\project\MAVE-f1.6`)

When resuming work on the Home PC:

```text
[ ] Step 1: Fetch and inspect the handoff branch:
    git fetch origin docs/office-prep-20261019

[ ] Step 2: Confirm Home PC working tree and base HEAD:
    git status (must be clean)
    git log -1 --oneline (confirm base 327318a on work/f1.9-diagnostics-implementation)

[ ] Step 3: Execute Gate 1 (F1.9-D.1 Live Verification):
    Verify live voice timestamps and latency spans on RTX 3060 Ti hardware.

[ ] Step 4: Implement Gate 2 (F1.9-E Degraded Modes):
    Implement Modes Aโ€“F, 6 recovery classes, and F1.4 midstream commit boundary.

[ ] Step 5: Implement Gate 3 (F1.9-F Snapshot & Support Export):
    Implement MaveDiagnosticSnapshot, allowlist export, and read-only IPC handlers.

[ ] Step 6: Execute Gate 4 (F1.9-G Reliability Certification):
    Execute TEST-F1.9-01 through TEST-F1.9-20.

[ ] Step 7: Execute Gate 5 (F1.10 Provider Foundation Closeout):
    Synthesize live evidence and close out the Pre-M5 foundation.

[ ] Step 8: Milestone 5 Authorization:
    Request explicit user authorization before starting M5 implementation.
```
