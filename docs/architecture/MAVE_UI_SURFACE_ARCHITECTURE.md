# MAVE UI Surface Architecture

## Purpose

MAVE UI คือ visual interface ของ conversation, voice, translation, tools, agents, tasks, sources, media, memory และ learning

Floating UI เป็นองค์ประกอบสำคัญของ product identity

## Surface Model

```text
1. Orb / Mini Surface
2. Floating Panel
3. Task Workspace
4. Full App
```

## Orb / Mini Surface

- อยู่บนจอโดยรบกวนน้อย
- แสดง state
- เปิด Floating Panel ได้

States: sleeping, waking, listening, thinking, speaking, task running, error

## Floating Panel

Daily-use surface:
- always-on-top
- draggable/resizable
- keyboard focus
- text input
- voice transcript
- streaming answer
- history
- card renderer
- task status
- expand/collapse

## Task Workspace

สำหรับงานใหญ่:
- agent progress
- plan
- tool actions
- approval requests
- files changed
- final result

ต้อง minimize ได้และคุยกับ MAVE ต่อได้

## Full App

- complete chat history
- task history
- learning dashboard
- memory
- settings
- providers
- diagnostics
- permissions
- integrations

## Card System

Initial cards:
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

## Translation Card

แสดง:
- Original
- Translation
- Natural alternative
- Grammar note
- Vocabulary
- Pronunciation note

Actions: listen, save vocabulary, practice, copy

## Task Card

แสดง task name, status, started, current step, agent และ progress

Actions: open, cancel, retry

## Approval Card

ตัวอย่าง:

```text
MAVE wants to run:
pnpm test

Directory:
D:\project\MAVE

Risk:
Safe local action

[Allow] [Deny]
```

## State Animation Language

- Sleeping: low motion
- Waking: pulse
- Listening: responsive waveform
- Thinking: controlled orbit/flow
- Speaking: soft audio-reactive animation
- Task running: secondary activity indicator
- Error: clear but non-alarming

## Design Direction

modern, minimal, premium, technical, calm, not overly game-like, ไม่ใช้ generic AI gradient มากเกินไป

Animation ต้อง purposeful

## UI Data Flow

```text
Runtime Events
↓
UI Store
↓
Surface Components
↓
Cards / Animations
```

UI ห้ามเรียก provider โดยตรง

## Learning Overlay

```text
EN: I’m not sure how to explain this.
TH: ผมไม่แน่ใจว่าจะอธิบายเรื่องนี้ยังไง

Natural:
I don't quite know how to put it.

Vocabulary:
put it = พูด/อธิบายออกมา
```

## Rich Media

รองรับ image, video preview, audio, link, code, file, charts ผ่าน card model

## Global Hotkey / Office Mode

Voice ไม่ใช่ช่องทางเดียว

Office Mode:
- text-first
- hotkey-first
- silent notifications
- voice output off

## Performance

Floating surface ต้องเปิดเร็ว, idle เบา, animation ลื่น และไม่ block runtime

## Future Mobile Surface

Mobile ใช้ same response/card schema แต่ renderer และ layout แยกจาก desktop
