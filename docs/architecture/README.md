# MAVE Master Architecture Pack

ชุดเอกสาร Source of Truth สำหรับโปรเจกต์ **MAVE** — Personal AI Assistant ที่มีเป้าหมายระยะยาวให้ใกล้เคียงประสบการณ์แบบ JARVIS: เรียกใช้งานได้ตลอด, สนทนาเป็นธรรมชาติ, วิเคราะห์และลงมือทำงาน, จัดการเครื่องมือและเอเจนต์หลายระบบ, แสดงผลผ่าน Floating UI, จดจำบริบท และช่วยให้ผู้ใช้เก่งขึ้นอย่างต่อเนื่อง

## Read Order

1. `MAVE_MASTER_VISION.md`
2. `MAVE_ENGINEERING_PRINCIPLES.md`
3. `MAVE_SYSTEM_ARCHITECTURE.md`
4. `MAVE_ROADMAP.md`
5. `MAVE_AI_BRAIN_ARCHITECTURE.md`
6. `MAVE_TOOL_AND_PERMISSION_MODEL.md`
7. `MAVE_MEMORY_ARCHITECTURE.md`
8. `MAVE_UI_SURFACE_ARCHITECTURE.md`
9. `MAVE_LEARNING_ENGINE.md`

## Current Project State

- Desktop: Electron + React
- Core: TypeScript + XState
- Monorepo: pnpm + Turborepo
- Local DB: SQLite / Drizzle
- Wake service: Python + openWakeWord
- Active wake model: `assets/wake/mave.onnx`
- Current focus: personalized MAVE V2 wake model / dataset / benchmark pipeline
- Next major architecture phase: Conversation Runtime / Brain Provider abstraction

## Core Direction

> **MAVE is not an AI model. MAVE is the runtime that coordinates models, tools, memory, voice, UI, and agents.**

North Star:

> **คิดอะไรขึ้นมา → เรียก MAVE → เข้าใจ → ลงมือทำ → ได้ผลลัพธ์ → เราเก่งขึ้น**
