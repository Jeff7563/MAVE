# MAVE UI Surface Architecture

## Status

**Canonical UI / Surface Direction — Design Architecture**

This document defines how MAVE appears, expands, and presents information across ambient presence, conversation, rich results, workspaces, and system management.

The central product rule is:

> **MAVE is one assistant whose surface changes with context — not a collection of separate AI apps.**

UI implementation must preserve this identity even when MAVE is handling language learning, research, projects, tools, media, memory, or agent work.

---

## Purpose

MAVE UI คือ visual interface ของ conversation, voice, translation, tools, agents, tasks, sources, media, memory และ learning

Floating UI เป็นองค์ประกอบสำคัญของ product identity

The UI should feel like MAVE is quietly present with the user and only takes more screen space when the information or task genuinely requires it.

### Primary UX Principle

> **Information appears only when it becomes useful.**

The user should not have to open a large dashboard for ordinary conversation.

The surface should grow progressively:

```text
Presence
   ↓
Conversation
   ↓
Rich Context
   ↓
Workspace
```

MAVE should collapse back down when that complexity is no longer needed.

---

# 1. Canonical Surface Hierarchy

MAVE uses three primary interaction levels plus one secondary system-management surface.

```text
1. Presence Surface
2. Conversation Surface
3. Workspace Surface
4. System / Full App (secondary management surface)
```

This replaces the mental model of multiple separate applications such as a Language App, Research App, Project App, or Agent App.

Instead:

```text
                        MAVE
                         │
              ┌──────────┴──────────┐
              │                     │
          PRESENCE              CONVERSATION
              │                     │
         Listening              Rich Results
         Thinking                    │
         Speaking                Workspace
                                  ┌───┼────┐
                               Language Project Agent
```

The same MAVE identity remains visible throughout the hierarchy.

---

# 2. Presence Surface

The Presence Surface is MAVE's default visual form and should be the surface users see most often.

It replaces the idea that MAVE must always look like a traditional app window.

### Goals

- อยู่บนจอโดยรบกวนน้อย
- zero or near-zero visual clutter while idle
- show only the current MAVE state
- expand naturally when the user starts interacting
- support wake, voice, quick response, and collapse

### Canonical Forms

#### Idle / Sleeping

```text
╭────────────╮
│    MAVE    │
╰────────────╯
```

When nothing is happening, controls should disappear.

The surface should communicate presence, not demand attention.

#### Listening

```text
╭──────────────────────────────╮
│ MAVE │ waveform │ Listening… │
╰──────────────────────────────╯
```

Only controls relevant to active listening may appear.

#### Thinking

Use a compact state indicator unless richer information is actually available.

```text
MAVE • Thinking…
```

Do not fabricate detailed progress steps.

#### Speaking

```text
╭────────────────────────────────────╮
│ MAVE │ waveform │ Speaking │ controls │
╰────────────────────────────────────╯
```

A compact answer bubble may appear above when visual text is useful.

### Presence States

Canonical high-level states:

- sleeping
- waking
- listening
- transcribing
- thinking
- retrieving
- waiting_for_approval
- speaking
- task_running
- completed
- error
- offline

Exact runtime mapping may remain implementation-specific, but the UI must only expose states backed by observable runtime behavior.

---

# 3. Presence Mark / Orb

The MAVE Orb is a **Presence Mark**, not the main content area.

It should communicate identity and activity, but must not compete with information.

### Adaptive Scale Rule

```text
Idle / Home       → large / expressive
Listening         → active
Compact Chat      → small
Workspace         → icon-scale
Background Task   → status indicator
```

As information density increases, the Orb should become smaller.

### Orb Responsibilities

The Orb may express:

- wake / availability
- listening activity
- thinking / processing activity
- speaking activity
- background task status
- completion / attention state

The Orb should never consume large permanent space simply for decoration when the user needs to read or work.

---

# 4. Conversation Surface

The Conversation Surface is the primary daily-use visual interface.

It can appear as a floating compact panel, side panel, or expandable contextual surface depending on content.

### Responsibilities

- always-on-top when appropriate
- draggable / resizable where appropriate
- keyboard focus
- text input
- voice transcript
- streaming response
- lightweight history
- response cards
- source/media previews
- task status
- expand / collapse

### Core Principle

> **Conversation first, app second.**

The user should be able to continue working in another application while MAVE shows the answer next to the current context.

Example:

```text
Desktop / Current App

                         ┌──────────────────┐
                         │ MAVE • Chat      │
                         │                  │
                         │ Answer           │
                         │ [Video Card]     │
                         │ [Source Card]    │
                         │ Summary          │
                         │                  │
                         │ Ask MAVE...      │
                         └──────────────────┘
```

This is preferred over forcing the user into a full-screen dashboard for ordinary information lookup.

---

# 5. Rich Context Expansion

The Conversation Surface may expand when the answer requires visual complexity.

Examples:

- video result
- image
- file preview
- translation breakdown
- code block
- source list
- chart
- comparison
- approval request
- task progress

The surface expands because useful information exists, not because MAVE entered an arbitrary visual mode.

### Progressive Disclosure

```text
Compact response
      ↓
Quick card
      ↓
Conversation panel
      ↓
Workspace
```

Each transition should preserve conversation continuity.

---

# 6. Workspace Surface

Workspace is reserved for tasks that genuinely need sustained space.

Examples:

- project work
- agent workflow
- multi-file analysis
- structured research
- language practice session
- long planning task
- task execution with approvals

### Workspace Responsibilities

- conversation
- plan
- agent progress
- observable task steps
- approval requests
- files / sources
- outputs
- task history
- cancellation
- final result

Workspace must be minimizable while MAVE continues operating.

### Canonical Project Workspace Pattern

```text
Conversation
│
├── Agent / Task Workflow
│
├── Files
├── Sources
├── Outputs
└── Progress / Approvals
```

Workspace is not the default home for ordinary chat.

---

# 7. Experiences Are Contexts, Not Separate MAVE Identities

Language, Research, Projects, Coding, Planning, and Agents are **experiences inside MAVE**.

Do not present them as separate product identities.

Incorrect conceptual model:

```text
MAVE
├── Language App
├── Research App
├── Project App
├── Chat App
└── Agent App
```

Canonical model:

```text
MAVE
├── Conversation
├── Language
├── Research
├── Projects
├── Coding
├── Planning
├── Memory
└── Tools
```

### Language Experience

Language learning may have a dedicated Workspace layout when the task needs it, but global branding remains MAVE.

Avoid global copy such as:

```text
Your AI language assistant
```

Prefer contextual labels such as:

```text
Language Practice
Language Coach
Japanese • Speaking
```

Language is one capability of MAVE, not the definition of MAVE itself.

---

# 8. System / Full App

The Full App is a secondary management surface, not the default daily interaction surface.

It may contain:

- complete conversation history
- task history
- memory management
- project management
- settings
- integrations
- permissions
- diagnostics
- provider/runtime configuration
- learning history / analytics

### Important Rule

The Full App should not become a dense dashboard that exposes every subsystem at once.

It should organize durable information and controls that do not belong in the ambient conversational surface.

---

# 9. Provider Visibility Rule

Users talk to **MAVE**, not to vendor/provider names.

Provider selection should normally happen automatically through the Intelligence Router.

Do not make provider selection a prominent Home screen element.

Provider/runtime controls belong under:

```text
Settings
  → Intelligence
      → Providers / Runtimes
```

or Developer Diagnostics.

Normal UI may expose semantic status where useful:

```text
MAVE • Local
MAVE • Deep Reasoning
MAVE • Research
MAVE • Agent Working
```

Vendor names should be secondary diagnostic/configuration detail unless the user explicitly chooses a provider/runtime.

---

# 10. Intent Buttons Are Suggestions, Not Mandatory Modes

Buttons such as:

- Search
- Analyze
- Create
- Write
- Code
- Plan

may exist as shortcuts or suggestions.

They must not become a required pre-selection step before the user can talk to MAVE.

The user should be able to say:

```text
"ช่วยวิเคราะห์ไฟล์นี้ที"
```

and MAVE should infer the appropriate intent/routing.

Shortcuts accelerate interaction; they do not replace MAVE's routing intelligence.

---

# 11. Card System

Cards are contextual renderers used inside Conversation and Workspace surfaces.

Initial card families:

- MessageCard
- TranslationCard
- VocabularyCard
- SourceCard
- ImageCard
- VideoCard
- FileCard
- CodeCard
- TaskCard
- ProgressCard
- ApprovalCard
- ErrorCard

Potential future cards should follow the same response schema rather than create new standalone application surfaces.

---

# 12. Translation Card

Displays:

- Original
- Translation
- Natural alternative
- Grammar note
- Vocabulary
- Pronunciation note

Actions:

- listen
- save vocabulary
- practice
- copy

Translation Card can appear directly in compact conversation without opening the full Language Workspace.

---

# 13. Task Card

Displays:

- task name
- status
- started time
- current step
- responsible runtime/agent semantics where useful
- progress

Actions:

- open
- cancel
- retry

Task cards should show actual runtime state, not decorative progress.

---

# 14. Approval Card

Example:

```text
MAVE wants to run:
pnpm test

Directory:
D:\project\MAVE

Risk:
Safe local action

[Allow] [Deny]
```

Approval UX is governed by Milestone 5 Tool Permission Architecture.

The card is a renderer of permission state; it must not invent or bypass policy decisions.

---

# 15. Observable Progress Only — No Fake Thinking Steps

MAVE must not display fabricated execution steps simply to make the interface look intelligent.

Do not show:

```text
Looking up accurate translation…
Checking cultural context…
Reading sources…
```

unless those actions actually occurred in runtime telemetry.

### Allowed Generic State

```text
Thinking…
```

### Preferred Observable States

When backed by real execution events, UI may show:

```text
Searching the web…
Reading 4 sources…
Analyzing 3 files…
Using Local Fast Brain…
Waiting for approval…
Running code…
Preparing result…
```

The UI is an honest window into MAVE execution, not a theatrical chain-of-thought display.

---

# 16. State Animation Language

Animations should communicate state changes and activity.

- Sleeping: low motion
- Waking: soft pulse
- Listening: responsive waveform
- Transcribing: restrained pulse / text activity
- Thinking: controlled orbit / flow
- Retrieving: directional/progressive activity
- Speaking: soft audio-reactive motion
- Task running: secondary activity indicator
- Completed: brief confirmation
- Error: clear but non-alarming

Animation must always be purposeful.

---

# 17. Visual Hierarchy & Glow Language

The current blue / violet / cyan identity is retained, but glow is not a permanent decoration on every element.

### Principle

> **Resting UI is quiet. Active state earns glow.**

Suggested semantic visual language:

```text
Neutral  → resting / inactive
Blue     → listening / active interaction
Purple   → thinking / intelligence activity
Cyan     → retrieval / information
Green    → connected / completed
Orange   → warning / attention
Red      → blocked / destructive / critical
```

These are design semantics, not necessarily fixed RGB values.

Avoid simultaneous heavy glow on:

- every border
- every card
- every button
- Orb
- waveform
- background

If everything glows, nothing has visual priority.

---

# 18. Design Direction

MAVE should feel:

- modern
- minimal
- premium
- technical
- calm
- adaptive
- alive without being distracting

Avoid:

- overly game-like HUDs
- generic AI-gradient overload
- neon on every component
- dashboard density without contextual purpose
- provider/vendor-first UI
- fake progress indicators

---

# 19. UI Data Flow

```text
Runtime Events
      ↓
Presentation / UI Store
      ↓
Surface Decision
      ↓
Surface Components
      ↓
Cards / Animations
```

UI must never call intelligence providers directly.

### Important Separation

```text
Runtime decides WHAT is happening.
Presentation layer decides HOW to show it.
```

The UI must not become a second Brain Router.

---

# 20. Surface Decision Rules

Surface selection should depend on presentation complexity, not provider identity.

Examples:

```text
Short spoken response
→ Presence Surface

Short answer + translation card
→ Presence + Quick Card

Several messages + media/source results
→ Conversation Surface

Project / multi-step task / approvals / files
→ Workspace

Settings / memory administration / diagnostics
→ Full App
```

The selected AI provider must not determine the layout directly.

---

# 21. Learning Overlay

Example:

```text
EN: I’m not sure how to explain this.
TH: ผมไม่แน่ใจว่าจะอธิบายเรื่องนี้ยังไง

Natural:
I don't quite know how to put it.

Vocabulary:
put it = พูด/อธิบายออกมา
```

Learning information can appear as a contextual card in Conversation and expand into a dedicated Language Workspace only when continued practice requires more space.

---

# 22. Rich Media

MAVE supports contextual rich content through the card system:

- image
- video preview
- audio
- links
- code
- files
- charts
- citations / sources

Rich media should normally appear inside the current conversation context rather than launching a separate page.

---

# 23. Global Hotkey / Office Mode

Voice is not the only interaction channel.

Office Mode:

- text-first
- hotkey-first
- silent notifications
- voice output off
- compact conversation surface preferred

This mode should preserve full MAVE intelligence while minimizing workplace disruption.

---

# 24. Performance

Presence and Conversation surfaces must:

- open quickly
- remain lightweight while idle
- animate smoothly
- avoid blocking runtime
- avoid unnecessary GPU-heavy decorative effects
- preserve conversation responsiveness

Workspace may use more resources, but must remain independent from intelligence execution so UI stalls do not block MAVE runtime behavior.

---

# 25. Future Mobile Surface

Mobile reuses the same semantic response/card model where practical, but renderer, navigation, and layouts are platform-specific.

```text
Shared semantics
≠
Shared desktop layout
```

Desktop may use floating/adaptive surfaces; mobile may use full-screen conversational navigation.

---

# 26. Implementation Timing Policy

The architecture may be prepared before the full UI Redesign milestone, but visual redesign and production replacement remain deferred until the roadmap reaches UI Redesign.

## Safe to build early — UI Foundation / Skeleton

Work that may be prepared in parallel without changing the current production UX:

- surface hierarchy types / internal presentation model
- mock runtime-event fixtures
- mock states: idle, listening, thinking, speaking, card result, task running
- card renderer boundaries
- presentation-store boundaries
- surface transition rules
- prototype-only component shells
- isolated developer preview / visual harness
- accessibility and keyboard behavior planning
- layout responsiveness constraints

This foundation should remain isolated and must not replace the current stable M4 surface prematurely.

## Deferred until UI Redesign

Do not freeze yet:

- final visual styling
- final colors / glow intensity
- final typography
- final spacing scale
- final Orb design
- final animation curves
- final Full App navigation hierarchy
- final Home dashboard layout
- production migration from current M4 renderer

The UI Redesign milestone owns final visual convergence after intelligence and voice behavior are stable.

---

# 27. Prototype Isolation Rule

Any early UI skeleton should be developed as a **parallel prototype**, not mixed into active Intelligence implementation.

Recommended development principle:

```text
Stable M4 UI
      │
      ├── Production path (unchanged)
      │
      └── UI V2 Prototype / Preview
              ↓
          mock events
              ↓
          surface states
              ↓
          cards / layouts
```

Only after the UI Redesign milestone approves the new system should production wiring begin.

This protects C3/C4/F1.x work from accidental UI regression while still allowing useful design-system and component exploration on machines without Local AI hardware.

---

# 28. Canonical Product Identity Summary

MAVE should not feel like a dashboard that contains AI features.

MAVE should feel like one intelligent presence that reveals exactly as much interface as the current task needs.

```text
Idle
→ almost invisible

Conversation
→ compact and contextual

Information
→ cards appear

Complex work
→ workspace expands

Task complete
→ collapses back down
```

The result should feel less like "opening an AI application" and more like **MAVE is already there and adapts around the user.**
