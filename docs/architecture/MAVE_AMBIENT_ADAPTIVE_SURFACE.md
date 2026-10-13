# MAVE Ambient Adaptive Surface — Product & UX Architecture

**Status:** Vision / Architecture Locked  
**Implementation Target:** Milestone 4 — MAVE Surface  
**Current Project State When Written:** M2 Phase 8 completed; next is M2 Phase 9 — First Real Brain Provider

---

# 1. Core Product Principle

> **MAVE should not feel like an app the user has to open. MAVE should feel like an assistant that appears only when needed.**

The default MAVE experience is:

- ambient
- voice-first
- low-distraction
- context-aware
- visually adaptive
- smooth and premium
- always available without occupying screen space

MAVE is **not chat-window-first**.

A chat surface should appear only when:

- visual information is useful,
- the user explicitly requests it,
- MAVE needs to show something important,
- a task needs progress/status,
- an image/video/file/source needs to be displayed,
- translation/learning information benefits from a visual layer.

Otherwise MAVE should remain compact or invisible.

---

# 2. UX North Star

```text
User is working normally
        ↓
"Hey MAVE"
        ↓
Small ambient surface appears
        ↓
Listening animation
        ↓
MAVE responds by voice
        ↓
If no visual content is needed:
surface collapses automatically

If important visual content is needed:
surface expands smoothly
        ↓
Shows chat / image / video / translation / task status
        ↓
After inactivity:
surface collapses automatically
```

The user should never feel forced into a traditional chatbot workflow.

---

# 3. Surface Hierarchy

```text
Level 0 — Hidden / Ambient
Level 1 — Voice Capsule
Level 2 — Quick Information
Level 3 — Conversation / Context Panel
Level 4 — Task Workspace
```

The surface expands only as much as required.

---

# 4. Level 0 — Hidden / Ambient

Default state when MAVE is idle.

Possible behavior:

- completely hidden
- tiny status indicator
- optional compact MAVE presence icon
- background runtime remains active

Example:

```text
                                           ◉
```

Possible future settings:

```text
Ambient indicator:
- Hidden
- Minimal dot
- MAVE icon
```

---

# 5. Level 1 — Voice Capsule

Primary visible surface during voice interaction.

**Position:** bottom-right area of the active display.

Typical states:

- Listening
- Thinking
- Speaking
- Error
- Muted
- Task running

Example:

```text
                         ╭─────────────────────╮
                         │  ≋≋≋ Listening...  │
                         ╰─────────────────────╯
```

Thinking:

```text
                         ╭─────────────────────╮
                         │   ◌  ◉  ◌ Thinking │
                         ╰─────────────────────╯
```

Speaking:

```text
                         ╭─────────────────────╮
                         │  ▂▅▇▄▂▆▃▅▂  MAVE   │
                         ╰─────────────────────╯
```

When MAVE speaks, the surface should react to actual TTS audio activity where feasible. The goal is smooth, organic motion rather than a fake looping waveform.

---

# 6. Level 2 — Quick Information Surface

Used when a response benefits from a small amount of visual information.

Examples:

- weather
- timer
- definition
- translation
- quick status
- one recommendation
- short source card

Example:

```text
                         ╭──────────────────────────╮
                         │ awkward                  │
                         │ /ˈɔːkwəd/                │
                         │                          │
                         │ awkward = กระอักกระอ่วน │
                         │                          │
                         │ Example                  │
                         │ That was awkward.        │
                         ╰──────────────────────────╯
```

Suggested default inactivity:

```text
30–60 seconds
```

Final timeout should be configurable.

---

# 7. Level 3 — Conversation / Context Panel

This is the floating chat/context panel central to MAVE's product vision.

Open it when:

- MAVE has important information to show,
- the response contains images,
- the response contains video,
- the response contains files,
- sources are useful,
- code should be visible,
- translation/learning content is important,
- the user says "open chat",
- the user clicks the capsule,
- the user needs to inspect recent conversation.

**Position:** right side / bottom-right of the display.

Example:

```text
                  ╭───────────────────────────────╮
                  │ MAVE                          │
                  │                               │
                  │ Here's what I found.          │
                  │                               │
                  │ ╭───────────────────────────╮ │
                  │ │        IMAGE / VIDEO      │ │
                  │ ╰───────────────────────────╯ │
                  │                               │
                  │ Sources                       │
                  │ 1. ...                        │
                  │ 2. ...                        │
                  │                               │
                  │ Ask MAVE...              ↑    │
                  ╰───────────────────────────────╯
```

---

# 8. Chat Visibility vs Conversation History

Visible chat state and durable conversation history are separate.

```text
Conversation persists
        ↓
SQLite / future memory systems

UI may:
open
collapse
hide
reopen
```

Hiding the panel must never delete the conversation.

---

# 9. Automatic Appearance Policy

MAVE should decide how much UI to show based on the response.

```text
MAVE Response
      ↓
Surface Policy Engine
      ↓
Which surface is required?
```

Example policy:

```text
Simple conversational reply
→ Voice Capsule only

Translation / definition
→ Quick Information Surface

Image / video / rich source
→ Conversation Panel

Complex explanation user should inspect
→ Conversation Panel

Long-running task
→ Task Surface

Critical approval request
→ Persistent visible surface

User says "open chat"
→ Conversation Panel

User says "keep this open"
→ Pin current surface
```

---

# 10. Surface Importance Levels

## Low Importance

Examples:

- greeting
- thanks
- short conversational response

Behavior:

```text
Voice only
or
Voice Capsule
```

## Medium Importance

Examples:

- vocabulary
- short translation
- quick factual result
- simple status

Behavior:

```text
Quick Card
→ temporary
→ collapse after inactivity
```

## High Importance

Examples:

- debugging result
- research result
- image/video
- important source
- comparison
- multi-step instructions

Behavior:

```text
Conversation Panel
→ remain for 2–5 minutes after last interaction
→ then collapse
```

## Persistent

Examples:

- task still running
- user approval required
- user pinned content
- failure requiring action

Behavior:

```text
Do not auto-hide
until:
- task completed
- user acts
- user dismisses
```

---

# 11. Level 4 — Task Workspace

Used for substantial agent work.

Example:

```text
╭────────────────────────────────────╮
│ MAVE — Project Analysis            │
│                                    │
│ ● Reading repository               │
│ ✓ Architecture scanned             │
│ ● Running tests                    │
│ ○ Preparing recommendation         │
│                                    │
│ Files                              │
│ ├─ runtime.ts                      │
│ ├─ router.ts                       │
│ └─ ...                             │
│                                    │
│ [Cancel]                           │
╰────────────────────────────────────╯
```

The Task Workspace should display:

- task name
- current step
- progress
- tools/actions
- approval requests
- output artifacts
- errors
- final summary

The user should still be able to hold a separate conversation while a long-running task executes.

---

# 12. Voice Commands for Surface Control

Future commands:

```text
"MAVE, open chat."
"MAVE, close chat."
"MAVE, hide this."
"MAVE, keep this open."
"MAVE, pin this."
"MAVE, show me that again."
"MAVE, show the source."
"MAVE, open the image."
"MAVE, go back."
```

These control UI surface state, not conversation storage.

---

# 13. Auto-Hide Behavior

Do not use a timer alone.

Decision inputs:

```text
content importance
+
current task state
+
user interaction
+
pin state
+
surface type
```

Possible defaults:

```text
Voice Capsule:
collapse shortly after interaction ends

Quick Info:
30–60 sec inactivity

Conversation Panel:
2–5 min inactivity

Task Workspace:
stay while task is active

Pinned Surface:
never auto-hide
```

User interaction resets inactivity.

---

# 14. Focus Behavior

MAVE should not steal focus merely because information appears.

Default:

```text
MAVE appears
↓
current application keeps focus
```

Only when the user clicks, uses a hotkey, or explicitly opens chat should MAVE become interactive.

---

# 15. Passive vs Interactive Mode

```text
Passive Mode
- no focus stealing
- visual feedback
- click-through where appropriate

Interactive Mode
- accepts keyboard
- accepts mouse
- text input enabled
- controls enabled
```

---

# 16. Learning / Translation Surface

Language learning should be integrated into the ambient interface.

Example:

```text
MAVE says:
"I think you should try another approach."
```

Visual layer:

```text
╭─────────────────────────────────╮
│ EN                              │
│ I think you should try another  │
│ approach.                       │
│                                 │
│ TH                              │
│ ผมคิดว่าคุณควรลองอีกแนวทางหนึ่ง │
│                                 │
│ Vocabulary                      │
│ approach = วิธีการ / แนวทาง     │
╰─────────────────────────────────╯
```

Possible actions:

- save vocabulary
- listen again
- show pronunciation
- show natural alternative
- practice phrase

---

# 17. Rich Media Surface

MAVE Surface should eventually render:

```text
Text
Translation
Vocabulary
Source
Image
Video
Audio
File
Code
Table
Chart
Task
Progress
Approval
Error
```

---

# 18. Card Architecture

Potential components:

```text
MessageCard
TranslationCard
VocabularyCard
SourceCard
ImageCard
VideoCard
FileCard
CodeCard
TableCard
TaskCard
ProgressCard
ApprovalCard
ErrorCard
```

Cards are content units. The adaptive surface decides when and where to display them.

---

# 19. Motion Design

Animation is part of the interaction architecture.

Desired transition hierarchy:

```text
Hidden
↓
Orb / Indicator
↓ morph
Voice Capsule
↓ expand
Quick Card
↓ expand
Conversation Panel
↓ expand
Task Workspace
```

Preferred motion concepts:

- spring
- inertia
- opacity
- blur
- scale
- morphing geometry
- audio-reactive motion
- subtle glow
- smooth resize

Timing guidance:

```text
Micro interaction:
150–400 ms

Panel expansion:
300–600 ms
```

These are design targets, not hard constants.

---

# 20. Visual Direction

Keywords:

- modern
- premium
- calm
- minimal
- intelligent
- technical
- futuristic without becoming a game HUD
- smooth
- low visual noise

Avoid:

- excessive neon
- generic AI gradients everywhere
- too many borders
- over-animation
- permanent large chat window
- dashboard-first feeling

---

# 21. Desktop Positioning

Primary anchor:

> **Bottom-right / right side of the active monitor**

The surface may grow upward and leftward from that anchor.

Potential future settings:

```text
Anchor:
- bottom-right
- bottom-left
- custom

Display:
- active monitor
- primary monitor
- selected monitor
```

---

# 22. Electron Technical Direction

Potential M4 implementation:

```text
Electron BrowserWindow

- frameless
- transparent / translucent where supported
- always-on-top when appropriate
- dynamic dimensions
- rounded visual surface
- bottom-right positioning
- showInactive / non-focus behavior where appropriate
```

Possible options:

### Option A — Single Adaptive Window

```text
Capsule
→ Card
→ Chat
→ Workspace
```

Initial preference: **evaluate this first**.

### Option B — Multiple Specialized Windows

Separate overlay/chat/task windows.

More flexible, but adds window lifecycle complexity.

Do not decide permanently until M4 technical spike.

---

# 23. MAVE Surface Manager

Future concept:

```text
MaveSurfaceManager

├── currentSurface
├── desiredSurface
├── visibility
├── pinned
├── inactivity
├── content
├── focusMode
└── transitionState
```

It manages presentation state, not AI reasoning.

---

# 24. Surface Policy Engine

Responsibilities:

```text
Response arrives
↓
Inspect presentation hints / content
↓
Determine importance
↓
Select surface
↓
Set auto-hide policy
↓
Render
```

Potential inputs:

- response type
- cards present
- task active
- approval required
- media present
- user explicitly requested UI
- pinned state
- current focus state

---

# 25. Presentation Hints

Future response architecture may include:

```text
presentation:
- voice_only
- compact
- quick_card
- conversation
- workspace
- persistent
```

The AI provider may suggest presentation, but the MAVE Runtime / Surface Policy owns the final decision.

---

# 26. Runtime Relationship

Desired flow:

```text
Brain / Agent Result
        ↓
MAVE Response Model
        ↓
Surface Policy
        ↓
MAVE Surface Manager
        ↓
Renderer
```

Do not allow:

```text
LLM
→ directly manipulate BrowserWindow
```

---

# 27. Conversation History Relationship

```text
SQLite
  ↓
Conversation history service
  ↓
MAVE Surface
```

Surface visibility is ephemeral. Conversation history is durable.

---

# 28. Voice Relationship

M3 should provide:

```text
Listening state
Transcript
Thinking state
TTS speaking state
Audio activity / amplitude
```

M4 Surface consumes those signals.

This is the primary reason the full adaptive surface should be implemented **after M3 Voice Loop**.

---

# 29. Implementation Timing

## Current State

```text
M2 Phase 8 — Runtime Reliability Hardening  ✅
```

Next:

```text
M2 Phase 9 — First Real Brain Provider
```

## Recommended Order

```text
M2 Conversation Runtime
    ✅ Phase 0–8
    → Phase 9 First Real Brain
    → Finish M2

M3 Voice Loop
    → STT
    → TTS
    → natural voice conversation
    → interruption / barge-in
    → audio activity signals

M4 MAVE Surface
    → Ambient Adaptive UI
```

### Why not implement the final UI now?

The production surface depends on stable signals that do not exist yet:

- Listening
- Thinking
- Speaking
- Transcript
- TTS audio activity
- voice interruption
- rich response types
- later task progress

Building the final UI now would likely create rework when M3 defines the real voice lifecycle.

---

# 30. What Can Be Done Before M4

Before full implementation, it is safe to do:

### Architecture

- keep this document updated
- define future surface contracts
- define card schemas
- define presentation hints

### Design

- sketches
- Figma / Stitch concepts
- animation references
- visual experiments
- design tokens
- motion studies

### Technical Spike

Near the end of M3, create a disposable spike to test:

- transparent Electron window
- bottom-right anchoring
- show without focus
- dynamic resizing
- click-through behavior
- spring animation performance

Do not turn the spike into production M4 code prematurely.

---

# 31. Roadmap Placement

```text
M2 — Conversation Runtime
    ✅ Contracts
    ✅ Mock Brain
    ✅ Router
    ✅ Session / Context
    ✅ Runtime
    ✅ Persistence
    ✅ IPC
    ✅ Developer Chat
    ✅ Reliability
    → Real Brain

M3 — Voice Loop
    → STT
    → TTS
    → Barge-in
    → Voice conversation
    → Audio activity signals

M4 — MAVE Ambient Adaptive Surface
    → Surface contracts
    → Surface Manager
    → Surface Policy
    → Voice Capsule
    → Quick Cards
    → Conversation Panel
    → Rich Card Renderer
    → Auto-hide / Pin
    → Focus behavior
    → Motion system
    → Task Surface foundations
```

---

# 32. Suggested M4 Internal Phases

## M4.0 — Surface Contracts

Define:

- surface state
- visibility
- presentation hints
- card types
- pin state
- inactivity policy

## M4.1 — Electron Overlay Foundation

Test:

- frameless window
- transparency
- always-on-top
- bottom-right anchor
- no-focus show
- dynamic resize

## M4.2 — Voice Capsule

Implement:

```text
Listening
Thinking
Speaking
Idle
Error
```

## M4.3 — Adaptive Expansion

Implement:

```text
Capsule
→ Quick Card
→ Conversation Panel
```

## M4.4 — Conversation Surface

Implement:

- current conversation
- streaming
- translation
- recent history
- text input

## M4.5 — Surface Policy

Implement:

- automatic appearance
- inactivity collapse
- pin
- open/close commands

## M4.6 — Card Renderer

Initial:

- message
- translation
- vocabulary
- source
- image
- video
- file
- code
- error

## M4.7 — Motion & Audio Reactive Layer

Connect production motion to M3 voice/TTS state.

## M4.8 — Reliability / Multi-Monitor

Test:

- monitor changes
- fullscreen apps
- focus behavior
- DPI scaling
- window destruction/recreation
- performance

---

# 33. M4 Acceptance Experience

```text
User is coding in VS Code.

"Hey MAVE"

Small capsule appears bottom-right.
It does not steal focus.

MAVE listens.

User:
"What does reliable mean?"

MAVE speaks.

A small translation/vocabulary card appears.

After inactivity it collapses.

Later:

User:
"MAVE, show me the image you found."

Conversation panel smoothly expands.
Image card appears.

User:
"Keep this open."

Panel becomes pinned.

User:
"Close chat."

Panel smoothly collapses back into the ambient MAVE surface.
```

---

# 34. Long-Term Task Scenario

Future M5+ behavior:

```text
User:
"MAVE, analyze this project."

MAVE capsule:
Thinking...

↓ smoothly expands

Task Surface:
- Reading files
- Running tests
- Reviewing architecture

User continues working elsewhere.

Task completes.

MAVE:
"I found three issues."

Task Surface expands with:
- summary
- files
- code
- actions

After review:
surface collapses.
```

---

# 35. Key UX Rules

1. **Voice-first, not chat-first.**
2. **Do not occupy screen space without reason.**
3. **Never steal focus unnecessarily.**
4. **Expand based on information need.**
5. **History persists even when UI disappears.**
6. **Auto-hide depends on context, not timer alone.**
7. **User can always pin/open/close explicitly.**
8. **Task surfaces stay visible while user action is required.**
9. **Animations communicate state and continuity.**
10. **MAVE should feel integrated with the desktop, not like another website.**

---

# 36. Product Identity Statement

> **MAVE does not wait inside a chat window for the user to visit it.  
> MAVE stays quietly present, listens when called, speaks naturally, and brings visual information into the workspace only when it is useful.**

This principle should guide all future MAVE desktop UI decisions.
