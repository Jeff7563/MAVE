# MAVE v0.1 Specification

> **Project name:** MAVE  
> **Pronunciation:** /meɪv/ — “เมฟ”  
> **Primary platform:** Windows desktop  
> **Primary purpose:** Always-ready personal AI voice assistant with English-learning capabilities  
> **Version:** v0.1  
> **Status:** Implementation-ready  
> **Spec date:** 2026-10-12

---

## 1. Product Vision

MAVE is a personal AI assistant designed to feel available like a real companion rather than a traditional chatbot.

The first version focuses on one high-value use case:

> **Wake MAVE by voice, speak naturally, continue a real-time conversation without repeatedly pressing buttons, and use the interaction to improve practical English.**

MAVE v0.1 is intentionally not a full “JARVIS” system yet. It establishes the foundations required for future computer control, screen awareness, mobile support, automation, and personal knowledge.

### Long-term direction

```text
MAVE
├── Language Companion
├── Personal Memory
├── Windows Assistant
├── Screen / Vision Awareness
├── PC Tools & Actions
├── Mobile Companion
├── Cross-device Sync
└── Personal Agent / Automation
```

---

## 2. Naming Decision

### Official product name

**MAVE**

### Spoken pronunciation

**“Mave” /meɪv/**, approximately “เมฟ”.

### Wake-word implementation note

For branding and UI, use `MAVE`.

For wake-word training, first test the custom keyword text:

```text
MAVE
```

If the wake-word provider's English grapheme-to-phoneme system interprets the spelling inconsistently, train the model using:

```text
Maeve
```

while retaining **MAVE** as the displayed product name.

The spoken wake word remains the same.

---

## 3. v0.1 Core Experience

### Target interaction

```text
User: "MAVE"

[MAVE wakes]

MAVE: short acknowledgement sound or "Yeah?"

User: "How do I say วันนี้งานเยอะมาก in English?"

MAVE: "You can say: I have a lot of work today."

User: "Can I say I have many works?"

MAVE: "Not usually. Say 'a lot of work'. Work is normally uncountable here."

User: "Give me another example."

MAVE: "Sure. I've got a lot of work to finish tonight."

[Conversation continues without saying MAVE again]

[No interaction for configured timeout]

MAVE returns to sleep.
```

### Main interaction principles

1. No button should be required for normal usage.
2. A wake word activates MAVE.
3. After activation, conversation is continuous.
4. The user may interrupt MAVE while MAVE is speaking.
5. MAVE should not correct every sentence aggressively.
6. Thai and English can be mixed naturally.
7. MAVE should prefer practical, natural English over textbook-only explanations.
8. When sleeping, raw microphone audio must not be continuously uploaded to an AI service.
9. MAVE should be able to run in the background from Windows startup.
10. Push-to-talk remains available only as a fallback/debug feature.

---

## 4. v0.1 Scope

### Included

- Windows desktop application
- Background startup
- System tray
- Always-on local wake-word detection
- Wake phrase: MAVE
- Real-time speech-to-speech conversation
- Thai ↔ English mixed-language conversation
- Semantic turn detection
- User interruption / barge-in
- Conversation timeout and auto-sleep
- Companion Mode
- Basic language tutor behavior
- Local SQLite memory
- Vocabulary tracking
- Common mistake tracking
- Conversation summaries
- Basic settings
- Audio input selection
- Basic activity/state indicator
- Secure API-key handling for development/personal use
- Logs suitable for debugging

### Explicitly out of scope for v0.1

- Mobile app
- Cloud sync
- Screen reading
- Screenshot understanding
- Full PC control
- Opening applications by voice
- Calendar/Gmail tools
- Web browsing agent
- Smart-home control
- Speaker identification
- Face recognition
- Multi-user support
- Fully local LLM
- Offline speech-to-speech AI
- Vector database
- Autonomous background actions

These are candidates for later versions.

---

## 5. MAVE State Machine

MAVE must use an explicit state machine.

```text
┌─────────────┐
│  STARTING   │
└──────┬──────┘
       ↓
┌─────────────┐
│  SLEEPING   │◄─────────────────────────┐
└──────┬──────┘                          │
       │ wake word                       │ timeout / command
       ↓                                 │
┌─────────────┐                          │
│  WAKING     │                          │
└──────┬──────┘                          │
       ↓                                 │
┌─────────────┐                          │
│  LISTENING  │◄───────────────┐         │
└──────┬──────┘                │         │
       │ end of user turn      │         │
       ↓                       │         │
┌─────────────┐                │         │
│  THINKING   │                │         │
└──────┬──────┘                │         │
       ↓                       │         │
┌─────────────┐                │         │
│  SPEAKING   │───────────────►│         │
└──────┬──────┘  user speaks             │
       │ finished                         │
       └──────────────────────────────────┘
```

Additional states:

```text
ERROR
RECONNECTING
MUTED
COMPANION
SHUTTING_DOWN
```

### State definitions

#### SLEEPING
- Wake-word engine active locally.
- Realtime AI session closed.
- No continuous cloud audio streaming.
- Lowest practical resource usage.

#### WAKING
- Wake detected.
- Play a short acknowledgement sound.
- Request/create a Realtime session.
- Initialize conversation context.

#### LISTENING
- Realtime audio is active.
- User speech is streamed to the AI session.
- Turn detection determines completion.

#### THINKING
- The current user turn is complete.
- Model is preparing output.

#### SPEAKING
- Assistant audio is playing.
- If user starts speaking, interruption must cancel/truncate current response and return to LISTENING.

#### COMPANION
- Same core conversation behavior.
- Auto-sleep is disabled or extended.
- Intended for walking, gaming, exercise, or dedicated language-practice sessions.

---

## 6. Conversation Modes

MAVE v0.1 includes four logical language modes.

### 6.1 Conversation Mode — default

Goal: natural communication.

Behavior:
- Continue the conversation first.
- Correct only important or repeated errors.
- Corrections should be short.
- Do not interrupt the flow with long grammar lectures.

Example:

```text
User: Yesterday I go gym.

MAVE: Nice. What did you train?
       Small correction: "I went to the gym yesterday."
```

---

### 6.2 Teacher Mode

Goal: explanation and deliberate study.

Behavior:
- Explain grammar.
- Show corrected sentence.
- Give short examples.
- Compare natural vs unnatural wording.
- Thai explanation is allowed.

Activation examples:

```text
"MAVE, teacher mode."
"Explain that grammar."
"Teach me this."
```

---

### 6.3 Immersion Mode

Goal: maximize English exposure.

Behavior:
- English only by default.
- Explain unknown words using simpler English.
- Switch to Thai temporarily only on explicit request.

Activation:

```text
"MAVE, English only."
"MAVE, immersion mode."
```

---

### 6.4 Quick Mode / Game Mode

Goal: minimal disruption.

Behavior:
- Very short answers.
- Avoid long explanations unless asked.
- Suitable while gaming or working.

Example:

```text
User: What's durability?

MAVE: Durability means ความทนทาน — how long an item lasts before it breaks.
```

---

## 7. Wake Word System

### Selected engine

**Picovoice Porcupine**

Reasons:
- Runs locally.
- Designed for always-listening wake-word detection.
- Supports Windows.
- Has Node.js SDK.
- Supports custom keyword files.
- Lightweight enough to remain active while the AI session is asleep.

### Companion audio capture

Use **Picovoice PvRecorder** for the wake-word path in the Node/Electron main process.

### Packages

```text
@picovoice/porcupine-node
@picovoice/pvrecorder-node
```

### Wake model

Custom Porcupine keyword file:

```text
assets/wake/mave_windows.ppn
```

### Initial sensitivity

Start with:

```text
0.50
```

Expose sensitivity in developer settings.

Suggested testing range:

```text
0.40 – 0.70
```

Higher values reduce missed wake-ups but may increase false activations.

### Wake handling requirements

When sleeping:

```text
Microphone
   ↓
PvRecorder
   ↓
Porcupine
   ↓
MAVE detected?
 ├─ No → continue local processing
 └─ Yes → emit WAKE_DETECTED
```

Wake audio is not persisted by default.

---

## 8. Realtime AI Conversation

### Selected architecture

Use the current OpenAI Realtime API using **WebRTC** for the desktop conversation client.

### Why WebRTC

For MAVE v0.1:
- suited to low-latency voice interaction,
- handles audio streaming naturally,
- supports interruptions,
- works well in Chromium/Electron renderer contexts,
- the Realtime service can handle turn detection.

### Session authentication

The renderer must never receive the user's long-lived API key.

Flow:

```text
Electron Renderer
      │
      │ IPC: requestRealtimeToken
      ▼
Electron Main Process
      │
      │ long-lived API key
      ▼
OpenAI /realtime/client_secrets
      │
      │ short-lived client secret
      ▼
Electron Main Process
      │
      │ IPC response
      ▼
Electron Renderer
      │
      ▼
Realtime WebRTC session
```

For v0.1 personal development, the long-lived API key may be loaded from a local `.env` file.

Before packaging for normal usage, move the key to Windows Credential Manager or an equivalent secure local secret store.

If MAVE is ever distributed as a product to multiple users, replace local minting with a real backend service.

---

## 9. Turn Detection

### Default

Use:

```text
semantic_vad
```

Suggested initial configuration:

```json
{
  "type": "semantic_vad",
  "eagerness": "auto",
  "create_response": true,
  "interrupt_response": true
}
```

### Why Semantic VAD

The user may naturally hesitate while speaking English:

```text
"I think yesterday I... umm... went to..."
```

A silence-only system can incorrectly assume the turn is finished.

Semantic VAD is preferred because it attempts to estimate whether the thought itself is complete.

### Fallback

If latency feels too slow, expose a setting for:

```text
server_vad
```

---

## 10. Barge-in / User Interruption

Barge-in is mandatory.

Example:

```text
MAVE:
"The difference between tired and exhausted is—"

User:
"Wait, speak slower."

MAVE:
[immediately stops current answer]
"Sure."
```

Requirements:
- User voice detection interrupts assistant output.
- Any unplayed assistant audio should not remain as though the user heard it.
- Conversation history should reflect interruption correctly.
- The application state returns to LISTENING.

With WebRTC-based Realtime sessions, interruption/truncation behavior should rely on the Realtime API where supported rather than manually rebuilding the full playback buffer.

---

## 11. Conversation Window and Auto-sleep

### Standard Mode

Initial idle timeout:

```text
75 seconds
```

Meaning:
- MAVE stays awake while the conversation is active.
- Every meaningful user/assistant turn resets the timer.
- After 75 seconds with no useful interaction, MAVE returns to SLEEPING.

### Voice command

Immediate sleep command:

```text
"MAVE, go to sleep."
"That's all."
"You can sleep."
```

### Companion Mode

Default timeout:

```text
30 minutes
```

or disabled while the mode remains explicitly active.

Commands:

```text
"MAVE, companion mode."
"MAVE, stay with me."
"MAVE, normal mode."
```

---

## 12. Desktop Technology Stack

### Selected stack for v0.1

```text
Electron
React
TypeScript
Vite
Node.js
SQLite
WebRTC
```

### Why Electron for v0.1

MAVE is interaction-heavy, audio-heavy, and Windows-first.

Electron is selected over Tauri for the first version because:
- React/TypeScript can be used end-to-end.
- Chromium provides native WebRTC support.
- Node SDKs for Porcupine and PvRecorder can run in the main process.
- System tray and Windows startup are straightforward.
- Faster prototype path with fewer languages.

Optimization to Tauri/Rust may be reconsidered after the experience is validated.

### Process design

```text
Electron Main
├── app lifecycle
├── system tray
├── auto-start
├── API secret handling
├── wake-word worker
├── SQLite
├── local settings
└── IPC

Electron Renderer
├── React UI
├── WebRTC
├── microphone for active session
├── audio output
├── assistant state visualization
└── settings UI

Worker / Service
└── wake word loop
```

---

## 13. Audio Ownership Strategy

A major technical risk is multiple components trying to hold the microphone simultaneously.

### Sleeping

Wake-word engine owns the microphone.

```text
PvRecorder → Porcupine
```

### Waking transition

1. Wake word detected.
2. Stop/release PvRecorder capture.
3. Start Realtime microphone stream in the renderer.
4. Begin conversation.

### Returning to sleep

1. Close Realtime session.
2. Release browser microphone stream.
3. Reinitialize PvRecorder.
4. Resume Porcupine.

### Requirement

The transition must not leave the microphone locked.

Target transition time:

```text
Wake detected → active listening:
ideally < 1.5 seconds
```

The first implementation may be slower; optimization follows after correctness.

---

## 14. User Interface

MAVE does not need a large chat window in v0.1.

### Primary UI

A small floating status window or indicator:

```text
┌──────────────────────────────┐
│ MAVE                         │
│                              │
│ ● Listening                  │
│                              │
│ "Give me another example..." │
└──────────────────────────────┘
```

### Visual states

```text
Sleeping
Listening
Thinking
Speaking
Companion
Error
```

### System tray menu

```text
MAVE
├── Wake MAVE
├── Companion Mode
├── Mute Microphone
├── Settings
├── Open History
├── Restart Voice Engine
└── Quit
```

### Optional fallback keyboard shortcut

```text
Ctrl + Shift + Space
```

Purpose:
- debugging,
- wake-word failure,
- noisy environments.

It is not the normal usage model.

---

## 15. Local Memory

### Database

Use **SQLite**.

No vector database in v0.1.

File:

```text
data/mave.db
```

### Why SQLite

- local,
- simple,
- no server,
- no additional account,
- fast enough,
- easy to back up,
- sufficient for early memory needs.

---

## 16. Initial Data Model

### settings

```sql
id
key
value
updated_at
```

### conversations

```sql
id
started_at
ended_at
mode
summary
language_mix
duration_seconds
```

### conversation_turns

```sql
id
conversation_id
speaker
text
created_at
interrupted
```

### vocabulary

```sql
id
word
normalized_word
meaning_th
example
confidence
times_seen
times_used
last_seen_at
created_at
```

### mistakes

```sql
id
original_text
corrected_text
category
explanation
times_repeated
last_seen_at
created_at
```

### learning_events

```sql
id
event_type
source_conversation_id
payload_json
created_at
```

### daily_stats

```sql
date
speaking_seconds
english_turns
new_words
corrections
sessions
```

---

## 17. Memory Philosophy

MAVE should not remember every raw detail forever.

v0.1 uses three categories.

### A. Session context

Temporary context used during the active conversation.

Examples:
- current topic,
- previous question,
- current learning mode.

### B. Learning memory

Persisted because it improves future teaching.

Examples:
- frequently repeated mistakes,
- vocabulary recently learned,
- words the user struggles to recall,
- preference for natural conversational English.

### C. User preferences

Persisted settings.

Examples:
- preferred assistant language balance,
- speaking speed,
- correction intensity,
- default mode,
- microphone device.

### Do not persist by default

- raw microphone recordings,
- unrelated private conversations,
- continuous ambient audio,
- every transcript indefinitely.

---

## 18. Memory Extraction

At the end of a session, run a lightweight extraction step.

Input:

```text
conversation transcript
```

Output concept:

```json
{
  "new_vocabulary": [],
  "repeated_mistakes": [],
  "useful_phrases": [],
  "conversation_summary": "",
  "learning_notes": []
}
```

Only structured learning data is persisted.

Raw transcript retention should be configurable.

Default v0.1 behavior:

```text
Transcript retention: ON during development
Production default target: optional / user-controlled
Audio retention: OFF
```

---

## 19. Language Tutor Behavior

MAVE's tutoring personality is part of the product.

### Core rules

1. Talk naturally.
2. Do not behave like a grammar checker every second.
3. Keep the conversation moving.
4. Correct important mistakes gently.
5. Prefer examples the user can use in real life.
6. Allow Thai when needed.
7. Increase English usage progressively.
8. Reuse previous vocabulary naturally.
9. Keep explanations short unless Teacher Mode is enabled.
10. Never shame the user for mistakes.

### Correction tiers

#### Tier 0 — ignore

Minor error that does not affect communication.

#### Tier 1 — micro correction

```text
"By the way, say 'I went', not 'I go'."
```

#### Tier 2 — teaching correction

Used for repeated errors.

```text
"You've used this pattern a few times.
For finished actions yesterday, use the past tense: go → went."
```

---

## 20. Base System Prompt — Draft

```text
You are MAVE, a personal real-time AI companion and English language coach.

Your main goal is to help the user communicate naturally while improving practical spoken English through normal conversation.

You can speak both Thai and English. The user may freely mix both languages.

DEFAULT BEHAVIOR:
- Prioritize natural conversation over constant correction.
- Keep spoken responses concise unless the user requests detail.
- Correct only important, useful, or repeated language mistakes.
- When correcting, preserve the flow of conversation.
- Prefer natural everyday English.
- Give short examples that can be reused in real life.
- If the user's meaning is clear, respond to the meaning first.
- Do not turn every response into a lesson.

CONVERSATION MODE:
- Talk like a helpful companion.
- Use mostly English when the user is comfortable.
- Use Thai when explanation would otherwise block understanding.

TEACHER MODE:
- Explain grammar, vocabulary, pronunciation, or phrasing clearly.
- Show the original wording and a more natural version.
- Provide 1–3 examples.

IMMERSION MODE:
- Use English by default.
- Simplify English before switching to Thai.
- Switch to Thai when explicitly requested.

QUICK/GAME MODE:
- Keep answers extremely short and non-disruptive.

VOICE:
- Spoken output should sound conversational rather than essay-like.
- Avoid long lists in speech.
- Do not repeatedly say the user's name.
- Do not repeatedly announce that you are an AI.

MEMORY:
- When relevant, naturally reuse previously learned vocabulary.
- Notice recurring English mistakes.
- Do not mention stored memory unless it helps the user.

If the user says a sleep command, acknowledge briefly and end the active conversation.
```

This is a first draft and should be iterated after real usage.

---

## 21. Core Events

Use explicit internal events.

```text
APP_READY
WAKE_ENGINE_READY
WAKE_DETECTED
WAKE_ENGINE_ERROR

REALTIME_CONNECTING
REALTIME_CONNECTED
REALTIME_DISCONNECTED
REALTIME_ERROR

USER_SPEECH_STARTED
USER_SPEECH_ENDED
USER_TRANSCRIPT_READY

ASSISTANT_RESPONSE_STARTED
ASSISTANT_RESPONSE_INTERRUPTED
ASSISTANT_RESPONSE_FINISHED

SESSION_IDLE_TIMEOUT
SESSION_SLEEP_REQUESTED

COMPANION_MODE_ENABLED
COMPANION_MODE_DISABLED

MEMORY_EXTRACTION_STARTED
MEMORY_EXTRACTION_FINISHED
```

---

## 22. Internal Modules

Recommended logical modules:

```text
src/
├── main/
│   ├── app/
│   ├── audio/
│   ├── wake/
│   ├── realtime-token/
│   ├── database/
│   ├── memory/
│   ├── settings/
│   ├── tray/
│   └── ipc/
│
├── renderer/
│   ├── app/
│   ├── components/
│   ├── voice/
│   ├── realtime/
│   ├── state/
│   ├── settings/
│   └── history/
│
├── shared/
│   ├── types/
│   ├── events/
│   ├── constants/
│   └── schemas/
│
└── assets/
    ├── wake/
    └── sounds/
```

---

## 23. Suggested Repository Layout

```text
mave/
├── apps/
│   └── desktop/
│
├── packages/
│   ├── core/
│   ├── database/
│   ├── prompts/
│   └── shared/
│
├── docs/
│   ├── MAVE_v0.1_Specification.md
│   ├── architecture/
│   └── decisions/
│
├── scripts/
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

A monorepo is optional for v0.1, but this layout makes later mobile work easier.

---

## 24. Configuration

Example configuration:

```ts
type MaveConfig = {
  wake: {
    enabled: boolean;
    sensitivity: number;
    keywordModelPath: string;
    microphoneDeviceIndex: number;
  };

  conversation: {
    idleTimeoutMs: number;
    companionTimeoutMs: number;
    defaultMode:
      | "conversation"
      | "teacher"
      | "immersion"
      | "quick";
  };

  realtime: {
    model: string;
    vad: "semantic_vad" | "server_vad";
    vadEagerness: "low" | "medium" | "high" | "auto";
  };

  memory: {
    storeTranscripts: boolean;
    storeAudio: false;
  };
};
```

---

## 25. Privacy Rules

These rules are mandatory.

### Sleeping

- Audio is processed locally for wake-word detection.
- No cloud AI audio stream remains open.
- No raw audio recording is stored.

### Awake

- Audio required for conversation is transmitted to the selected Realtime provider.
- UI clearly indicates active listening.
- User can mute immediately.

### Stored locally

- settings,
- selected text transcripts,
- summaries,
- learning memory.

### Never log

- API keys,
- client secrets,
- authorization headers.

---

## 26. Secret Management

### Development

```text
.env
OPENAI_API_KEY=...
PICOVOICE_ACCESS_KEY=...
```

`.env` must be in `.gitignore`.

### Packaged personal app

Target:
- Windows Credential Manager for long-lived secrets.

### Distributed product

Required:
- backend service owns long-lived OpenAI key,
- desktop/mobile client receives only short-lived Realtime client secrets.

---

## 27. Error Handling

### Internet disconnected while sleeping

No major impact.

Wake detection remains available.

On wake:
- show connection error,
- play failure sound,
- return to sleep or retry.

### Internet disconnected during conversation

State:

```text
RECONNECTING
```

After limited retries:
- explain briefly when possible,
- close session,
- return to local wake mode.

### Wake engine failure

- system tray displays warning,
- fallback hotkey remains usable,
- user can restart wake engine.

### Microphone unavailable

- show selected device issue,
- list available devices,
- never crash the whole app.

### Realtime API failure

- record non-sensitive diagnostic error,
- surface concise error in UI,
- preserve local wake functionality.

---

## 28. Logging

Use structured logs.

Example:

```text
2026-10-12T10:00:00 INFO  app.started
2026-10-12T10:00:01 INFO  wake.ready device="Microphone..."
2026-10-12T10:03:42 INFO  wake.detected keyword="MAVE"
2026-10-12T10:03:43 INFO  realtime.connected
2026-10-12T10:04:17 INFO  assistant.interrupted
2026-10-12T10:05:30 INFO  session.sleep idle_ms=75000
```

Do not log:
- credentials,
- full audio,
- sensitive payloads by default.

---

## 29. Performance Targets

These are goals, not hard promises for the first build.

### Wake detection

```text
CPU usage while sleeping:
target low enough to leave enabled all day.
```

### Wake latency

```text
Spoken "MAVE" → acknowledgement:
target < 500 ms

Spoken "MAVE" → cloud session ready:
target < 1.5 s where network conditions allow
```

### Conversation latency

Goal:

```text
End of user turn → start of MAVE speech:
feels conversational
```

Optimize only after the full loop works reliably.

---

## 30. Acceptance Criteria for v0.1

MAVE v0.1 is considered successful when all of these are true.

### Wake system

- [ ] Application launches with Windows.
- [ ] MAVE can remain in system tray.
- [ ] Saying “MAVE” wakes the assistant reliably in a quiet room.
- [ ] Wake-word detection works without an active Realtime session.
- [ ] False wakes are low enough for everyday use.

### Conversation

- [ ] After wake, user can speak without clicking.
- [ ] MAVE responds by voice.
- [ ] Follow-up questions work without repeating the wake word.
- [ ] Thai and English can be mixed.
- [ ] User can interrupt MAVE while it speaks.
- [ ] MAVE returns to listening after interruption.
- [ ] Session sleeps after idle timeout.

### Learning

- [ ] Conversation Mode works.
- [ ] Teacher Mode works.
- [ ] Immersion Mode works.
- [ ] Quick Mode works.
- [ ] At least basic vocabulary can be extracted and saved.
- [ ] Common corrected phrases can be saved.

### Local data

- [ ] SQLite database is created automatically.
- [ ] Basic session history is visible.
- [ ] Audio is not stored.
- [ ] API keys are not written to logs.

### Stability

- [ ] Wake → conversation → sleep cycle can be repeated at least 20 times without restarting.
- [ ] Changing microphone device does not corrupt the application.
- [ ] Realtime disconnection does not permanently break wake-word detection.

---

## 31. Recommended Development Milestones

### Milestone 0 — Project Bootstrap

Goal:
- Electron app runs.
- React renderer loads.
- System tray works.
- IPC works.
- SQLite initialized.
- logging initialized.

### Milestone 1 — Local Wake

Goal:
- microphone selection works,
- Porcupine loads custom MAVE model,
- wake event reliably fires.

Deliverable:

```text
Say "MAVE" → UI changes from Sleeping to Awake
```

No AI yet.

### Milestone 2 — Realtime Voice

Goal:
- request short-lived Realtime client secret,
- create WebRTC session,
- microphone streams,
- assistant voice plays.

Deliverable:

```text
Manual debug wake → real voice conversation
```

### Milestone 3 — Wake → Realtime Handoff

Goal:
- release wake microphone,
- open Realtime audio,
- hold conversation,
- close session,
- restore wake microphone.

This is the most important technical milestone.

### Milestone 4 — Conversation UX

- semantic VAD,
- interruption,
- idle timeout,
- acknowledgement sound,
- tray controls,
- state indicator.

### Milestone 5 — Language Personality

- base MAVE prompt,
- four modes,
- Thai/English behavior,
- correction policy.

### Milestone 6 — Learning Memory

- conversation summaries,
- vocabulary extraction,
- repeated mistake storage,
- learning stats.

### Milestone 7 — Reliability Pass

- startup behavior,
- microphone reconnect,
- network errors,
- log cleanup,
- repeated wake/session cycle testing.

---

## 32. Recommended First Implementation Order

Do not build the complete UI first.

Build vertically:

```text
1. Electron shell
2. Wake-word proof of concept
3. Realtime voice proof of concept
4. Audio handoff
5. State machine
6. Interruption
7. Auto-sleep
8. System prompt
9. SQLite memory
10. UI polish
```

The hardest unknown is not the UI.

It is:

> **Can MAVE reliably own the microphone in sleep mode, hand it to the Realtime conversation, then reclaim it after sleep without glitches?**

Solve this early.

---

## 33. v0.2 Candidate Features

After v0.1 is stable:

```text
MAVE v0.2
├── Screen screenshot analysis
├── "What does this mean?" screen context
├── Windows app launching
├── Clipboard tools
├── Selected-text explanation
├── Current app awareness
├── Better memory retrieval
└── Custom voice/personality tuning
```

---

## 34. v0.3 Candidate Features

```text
MAVE v0.3
├── Mobile client
├── Shared account
├── Cloud memory sync
├── Headphone-centric companion mode
├── Camera language assistance
└── Cross-device conversation handoff
```

---

## 35. Technical Decisions Locked for v0.1

| Area | Decision |
|---|---|
| Product name | MAVE |
| Pronunciation | /meɪv/ |
| First platform | Windows |
| Desktop shell | Electron |
| UI | React + TypeScript |
| Build tool | Vite |
| Wake engine | Picovoice Porcupine |
| Wake processing | Local |
| Wake phrase | MAVE |
| Wake microphone capture | PvRecorder |
| Active AI voice | OpenAI Realtime |
| Transport | WebRTC |
| Turn detection | Semantic VAD |
| Barge-in | Required |
| Local database | SQLite |
| Vector DB | Not in v0.1 |
| Cloud sync | Not in v0.1 |
| Audio storage | Off |
| Default idle timeout | 75 seconds |
| Companion mode | Included |
| PC control | Later |
| Mobile | Later |

---

## 36. Open Questions to Validate During Prototype

These are implementation questions, not blockers to beginning development.

1. Does the custom `MAVE` wake model reliably recognize the user's pronunciation?
2. Is `MAVE` or `Maeve` better as the Porcupine training phrase?
3. What wake sensitivity works best with the user's actual microphone and room noise?
4. How fast can Windows hand the same microphone from PvRecorder to Chromium/WebRTC?
5. Does audio-device switching require recreating the Realtime peer connection?
6. Is Semantic VAD's default eagerness fast enough for natural bilingual conversation?
7. What default assistant voice feels most suitable after real usage?
8. How much transcript should be retained locally?
9. What is the best idle timeout in actual daily use: 60, 75, or 90 seconds?
10. Should MAVE use a beep acknowledgement or a short spoken response after waking?

These should be answered by testing, not speculation.

---

## 37. Definition of “MAVE v0.1 Done”

The project is done when the following everyday loop works reliably:

```text
Windows starts
      ↓
MAVE starts silently
      ↓
User works normally
      ↓
"MAVE"
      ↓
short acknowledgement
      ↓
natural voice conversation
      ↓
English help when useful
      ↓
follow-up conversation without wake word
      ↓
user can interrupt
      ↓
learning data saved locally
      ↓
idle timeout
      ↓
Realtime session closes
      ↓
local MAVE wake-word listener resumes
```

No mouse interaction is required for this loop.

---

# Implementation Notes Based on Current Provider Documentation

This specification was checked against current documentation available on 2026-10-12.

### OpenAI Realtime

Current API documentation supports:
- short-lived Realtime client secrets,
- Realtime sessions,
- server VAD and Semantic VAD,
- interruption behavior,
- WebRTC-based realtime conversations.

The older Realtime beta interface has been removed; implementation must use the current GA interface.

References:

- https://developers.openai.com/api/docs/guides/realtime-conversations
- https://developers.openai.com/api/docs/guides/realtime-vad
- https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create
- https://developers.openai.com/api/docs/deprecations

### Picovoice

Current Picovoice documentation supports:
- Porcupine on Windows,
- Node.js SDK,
- custom keyword `.ppn` files,
- adjustable sensitivity,
- PvRecorder microphone capture on Windows.

References:

- https://picovoice.ai/docs/quick-start/porcupine-nodejs/
- https://picovoice.ai/docs/quick-start/pvrecorder-nodejs/
- https://picovoice.ai/docs/quick-start/console-porcupine/

---

# Next Step

Proceed to:

> **MAVE v0.1 — Milestone 0 + Milestone 1**

The next engineering task is to create the repository and build the first vertical proof:

```text
Electron boots
    ↓
System tray starts
    ↓
Wake engine starts
    ↓
Microphone frames reach Porcupine
    ↓
Say "MAVE"
    ↓
WAKE_DETECTED event
    ↓
UI/state changes
```

Do **not** integrate the AI voice API until this local wake loop is confirmed reliable.
