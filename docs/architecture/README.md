# MAVE Master Architecture Pack

ชุดเอกสาร Source of Truth สำหรับโปรเจกต์ **MAVE** — Personal AI Assistant ที่มีเป้าหมายระยะยาวให้ใกล้เคียงประสบการณ์แบบ JARVIS: เรียกใช้งานได้ตลอด, สนทนาเป็นธรรมชาติ, วิเคราะห์และลงมือทำงาน, จัดการเครื่องมือและเอเจนต์หลายระบบ, แสดงผลผ่าน Floating UI, จดจำบริบท และช่วยให้ผู้ใช้เก่งขึ้นอย่างต่อเนื่อง

## Read Order

1. `MAVE_MASTER_VISION.md`
2. `MAVE_ENGINEERING_PRINCIPLES.md`
3. `MAVE_SYSTEM_ARCHITECTURE.md`
4. `MAVE_ROADMAP.md`
5. `MAVE_AI_BRAIN_ARCHITECTURE.md`
6. `MAVE_VOICE_ARCHITECTURE.md`
7. `MAVE_MILESTONE_3_SPEC.md`
8. `MAVE_TOOL_AND_PERMISSION_MODEL.md`
9. `MAVE_MEMORY_ARCHITECTURE.md`
10. `MAVE_UI_SURFACE_ARCHITECTURE.md`
11. `MAVE_AMBIENT_ADAPTIVE_SURFACE.md`
12. `MAVE_AMBIENT_SURFACE_RUNTIME.md`
13. `MAVE_MILESTONE_4_SPEC.md`
14. `MAVE_LEARNING_ENGINE.md`

## Current Project State

- Desktop: Electron + React
- Core: TypeScript + XState
- Monorepo: pnpm + Turborepo
- Local DB: SQLite / Drizzle
- Wake service: Python + openWakeWord (`assets/wake/mave.onnx`)
- Milestone 2 Complete: Provider-independent Conversation Runtime, sessions, persistence, typed IPC streaming, official Antigravity CLI adapter
- Milestone 3 Complete: End-to-end Voice Loop (Audio Input, faster-whisper STT, EdgeTTS, sounddevice playback, progressive synthesis, programmatic barge-in, developer diagnostics)
- Current focus: Milestone 4 — MAVE Surface (Floating UI, Ambient Adaptive Surface) + parallel Fast Brain & Wake V2 evaluation

## Core Direction

> **MAVE is not an AI model. MAVE is the runtime that coordinates models, tools, memory, voice, UI, and agents.**

North Star:

> **คิดอะไรขึ้นมา → เรียก MAVE → เข้าใจ → ลงมือทำ → ได้ผลลัพธ์ → เราเก่งขึ้น**
