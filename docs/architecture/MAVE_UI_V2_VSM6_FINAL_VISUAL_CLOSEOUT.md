# MAVE UI V2 — VSM6: Final Cross-Surface Visual Integration, Motion Continuity & Prototype Closeout

## 1. Executive Summary & Objective

**VSM6** marks the final visual integration, motion continuity, and prototype closeout for the **MAVE UI V2 Adaptive Visual System**. 

The primary objective of this phase is to ensure that:
$$\text{Presence} \longrightarrow \text{Quick Response} \longrightarrow \text{Conversation} \longrightarrow \text{Desktop Companion} \longrightarrow \text{Rich Cards} \longrightarrow \text{Workspace} \longrightarrow \text{Presence}$$
feels like **ONE adaptive MAVE interface**, governed by a singular visual language and calm, desktop-first spatial physics, rather than a fragmented set of disconnected applications.

---

## 2. Visual Hierarchy & Cross-Surface Identity

All surfaces share the authentic **MAVE Design System Foundation** established in the MAVE UI Kit:

| Design Dimension | Authoritative Token / Rule | Concrete Implementation |
| :--- | :--- | :--- |
| **Canvas Background** | `--mave-bg: #05060D` with atmospheric radial gradients | Deep, low-contrast dark backdrop (`radial-gradient` cyan/violet subtle glows) |
| **Glass Surfaces** | `--mave-glass-gradient`, `backdrop-filter: blur(22px) saturate(140%)` | Semi-translucent glass panels with 1px border (`var(--mave-edge)`) and inner top highlight |
| **Wordmark Typography**| `'Jost', sans-serif`, weight: 300, tracking: `0.36em` – `0.42em` | Centered, unhurried, calm wordmark capsule across Idle Presence and surface headers |
| **Interface Typography**| `'Manrope', sans-serif`, weights: 400 (regular), 600 (semi-bold) | Humanist, legibly structured body text with authentic kerning and contrast |
| **Monospace / Labels** | `'JetBrains Mono', monospace`, tracking: `0.18em`, uppercase | Faint uppercase identifiers (`YOU`, `MAVE`, `DIFF`, `SOURCE`, `WHY`) |
| **Iconography** | Unified SVG icon component library (`Icons.tsx`) | Authoritative `1.75px` stroke weight, rounded caps/joins, zero raw unicode emojis |
| **Color Accents** | Primary: `#5B84FF` (Blue), Voice/Live: `#5FD2FF` (Cyan), Cognitive: `#9A72FF` (Violet) | Status indicators: `#5FE0A8` (Success), `#FFC46B` (Warning), `#FF7A85` (Error) |

---

## 3. Surface Relationships & Adaptive Spatial Topology

```mermaid
stateDiagram-v2
    [*] --> Level1_Presence : Ambient Idle
    
    Level1_Presence --> Level1_QuickResponse : Direct Query ("What is X?")
    Level1_QuickResponse --> Level1_Presence : Auto-dismiss / Esc
    
    Level1_Presence --> Level2_Companion : "Open Companion" / Contextual Expansion
    Level1_QuickResponse --> Level2_Companion : Expand Button Clicked
    
    Level2_Companion --> Level2_FloatingConversation : Detach / Expand to Center
    Level2_FloatingConversation --> Level2_Companion : Dock to Edge (380px)
    
    Level2_Companion --> Level3_Workspace : Complex Task / Diff Review / Roleplay
    Level2_FloatingConversation --> Level3_Workspace : Promote Artifact to Canvas
    
    Level3_Workspace --> Level2_Companion : Minimize to Conversation
    Level3_Workspace --> Level1_Presence : Collapse to Ambient Presence
```

### 3.1 Level 1: Ambient Presence (`PresenceSurface`)
- **Idle State:** Extremely compact capsule (`fit-content`, 50px height, 25px radius) displaying only the unhurried `M A V E` wordmark with subtle resting specular edge.
- **Listening State:** Smooth horizontal expansion accommodating the active orb, wordmark, acoustic waveform, and subtle listening label with zero empty gaps.
- **Thinking State:** Cognitive living wave with gentle violet ambient halo without acoustic bar flickering.
- **Speaking State:** Dynamic waveform reflecting audio RMS levels paired with responsive quick response capsule when immediate synthesis occurs.

### 3.2 Level 2: Conversation & Desktop Companion (`ConversationShell`)
- **Docked Companion Mode (380px):** Sits unobtrusively on the screen edge (left or right) alongside host applications. Employs open spatial typography without message bubble containers.
- **Floating Expanded Mode:** Centered desktop canvas for deep conversational multi-turn inquiry.
- **Zero Jargon Invariant:** Replaced developer labels (`Sidecar`, `Presentation Mode`, `Surface Level`) with human-centric desktop terms (`Desktop Companion`, `Conversation`, `Pin on Top`).

### 3.3 Level 3: Artifact-Dominant Workspace (`WorkspaceShell`)
- **Core Law:** *The current artifact or task is primary.* Workspace is not a permanent 3-column application shell.
- **Diff Review Default:** `showConversation = false`, `showContext = false`. The diff artifact immediately commands the full viewport canvas.
- **Optional Drawer Rails:** Explicit user actions materialize the Conversation rail or Context panel as smooth drawers without resetting or shrinking the primary artifact unexpectedly.
- **Narrow Responsive Adaptation:** Automatically transitions to full-width overlaid drawers below 860px width (`@container (max-width: 860px)` and `@media (max-width: 860px)`).

---

## 4. Motion Foundation & Continuity Policy

MAVE motion follows three strict desktop-calibrated mathematical curves:

1. **Entrance Curve (`--mave-ease-enter`):**
   - Formula: `cubic-bezier(0.25, 1, 0.5, 1)` (*easeOutQuart*)
   - Duration: `450ms`
   - Purpose: Cards arriving, quick response materialization, dialog entrance.
2. **Surface Morph / Docking Curve (`--mave-ease-glide`):**
   - Formula: `cubic-bezier(0.65, 0, 0.35, 1)` (*easeInOutCubic*)
   - Duration: `800ms`
   - Purpose: Presence capsule expanding into conversation, workspace docking, drawer sliding.
3. **Micro-Interaction Curve (`--mave-ease-pop`):**
   - Formula: `cubic-bezier(0.34, 1.56, 0.64, 1)` (*easeOutBack*)
   - Duration: `200ms`
   - Purpose: Button presses, chip selection, presence orb pulse.

---

## 5. Reduced Motion Accessibility Contract

MAVE strictly respects user system preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --mave-dur-enter: 0.01ms !important;
    --mave-dur-glide: 0.01ms !important;
    --mave-dur-quick: 0.01ms !important;
    --mave-v2-motion-fast: 0.01ms !important;
    --mave-v2-motion-normal: 0.01ms !important;
    --mave-v2-motion-smooth: 0.01ms !important;
  }

  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Suppress continuous ambient and waveform movement */
  .mave-v2-waveform-bar,
  .mave-v2-thinking-wave,
  .mave-orb-canvas {
    animation: none !important;
    transform: none !important;
  }
}
```

- When reduced motion is active, animated acoustic waves and orb orbit rotations are halted.
- Non-animated visual indicators (e.g., solid color dots, status labels) clearly communicate state without visual disorientation.

---

## 6. Scroll Ownership Invariant

To eliminate awkward double scrollbars and scrolling collisions:
- **Outer Containers (`ConversationShell`, `WorkspaceShell`):** Hardened with `overflow: hidden` and `box-sizing: border-box`.
- **Dedicated Scroll Owners:**
  - In Conversation: Only `[data-testid="conversation-timeline"]` (`overflow-y: auto`) scrolls.
  - In Workspace: Only `[data-testid="workspace-primary-work-area"]` or specific artifact views scroll.
  - In Rich Cards: The card body handles its internal pre-formatted diff or code scroll without expanding the outer card boundary.
- **Scrollbar Styling:** Subtle, ultra-thin (5px), low-contrast WebKit scrollbars (`--mave-scrollbar-thumb: var(--mave-line)`) that fade into the glass canvas.

---

## 7. Prototype Boundary & Non-Regression Law

The MAVE UI V2 code adheres to rigorous architectural isolation:
1. **Isolated Namespace:** All V2 components exist exclusively within `apps/desktop/src/renderer/src/ui-v2/`.
2. **Zero Runtime Side Effects:** Interactive buttons emit typed synthetic callbacks (`onAllowApproval`, `onDenyApproval`, `onSendMessage`). No premature OS-level or IPC commands are wired.
3. **Production Isolation:** The existing production milestone 4 surface (`SurfaceView.tsx`, `MaveCapsule.tsx`) remains 100% untouched and functional.
4. **Read-Only Reference Integrity:** `docs/uiref/` and `docs/pic/` remain strictly unmodified read-only design references.

