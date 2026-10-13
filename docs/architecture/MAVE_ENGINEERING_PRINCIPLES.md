# MAVE Engineering Principles

## Purpose

กฎหลักสำหรับ developer และ AI agent ทุกตัวที่เข้ามาแก้ MAVE

## 1. Core Must Not Depend on One Provider

ห้ามให้ `@mave/core` import SDK ของ provider โดยตรง

```ts
interface BrainProvider {
  id: string;
  capabilities(): BrainCapabilities;
  chat(input: BrainRequest): Promise<BrainResponse>;
  health(): Promise<ProviderHealth>;
}
```

Provider-specific code ต้องอยู่ใน adapter/provider layer

## 2. MAVE Runtime Owns the Workflow

```text
Input
↓
Runtime
↓
Intent / Context
↓
Brain Selection
↓
Tool Request
↓
Permission Check
↓
Execution
↓
Result
↓
Response
↓
Memory
```

LLM เสนอ action ได้ แต่ Runtime เป็นผู้ตัดสินใจว่าจะอนุญาตและดำเนินการหรือไม่

## 3. Local-First, Cloud-Optional

ควร local เมื่อทำได้: wake detection, state, local memory, settings, permissions, logs, indexing และ utility logic

## 4. Privacy by Default

ห้าม:
- ส่ง raw microphone audio ขึ้น cloud โดยอัตโนมัติ
- เก็บ raw audio โดยไม่จำเป็น
- ส่งไฟล์ทั้งหมดให้ model โดยไม่ต้องใช้
- เก็บ secrets ใน logs
- ส่ง credentials เข้า prompt

## 5. Human in Control

MAVE ไม่ควร delete files, send messages, publish content, make purchases, reset repositories หรือ expose private data โดยไม่มี permission policy ที่เหมาะสม

## 6. Fast Path and Agent Path Must Be Separate

```text
Fast Path
- chat
- translation
- quick Q&A
- language practice

Agent Path
- coding
- research
- file/project analysis
- computer operations
- long-running tasks
```

## 7. Long Tasks Must Not Block Conversation

Assistant lifecycle และ Task lifecycle แยกกัน

## 8. Observable by Design

ต้อง inspect ได้: provider state, assistant state, task state, tool execution, permission decisions, memory writes, errors, latency

## 9. Recoverable by Design

Task สำคัญควรมี timeout, retry policy, cancellation, checkpoint เมื่อเหมาะสม และรายงาน failure เข้าใจง่าย

## 10. Source of Truth Before Code

ก่อน milestone ใหญ่:
1. อัปเดต architecture docs
2. เขียน milestone spec
3. ระบุ acceptance criteria
4. ระบุ non-goals
5. ค่อย implement

## 11. Structured Contracts Between Layers

ห้ามส่ง natural-language blob ไปทุก layer

```ts
type Intent =
  | { type: "conversation" }
  | { type: "translation"; targetLang: string }
  | { type: "task"; domain: string }
  | { type: "research" };
```

## 12. UI Must Be Renderer, Not Brain

UI รับ events/state แล้ว render; orchestration อยู่ใน runtime

## 13. Version Important Assets

ควร version prompt templates, provider adapters, model metadata, memory schema, tool contracts, task schemas, migrations และ wake models

## 14. Keep Stable Systems Stable

Subsystem ที่ผ่าน quality gate แล้วไม่ควรถูก refactor โดยไม่มีเหตุผลและไม่มี regression tests

## 15. Tests Are Quality Gates

ทุก milestone อย่างน้อยต้องผ่าน build, typecheck, unit tests, integration tests และ E2E เมื่อเกี่ยวข้อง

## 16. Explicit Failure Beats Silent Failure

Fallback ต้อง inspect ได้ เช่น `Claude unavailable → routed to Gemini`

## 17. No Unofficial Auth Hacks

ถ้าใช้ subscription-backed provider ให้ใช้ official client/CLI/supported integration เท่านั้น และ adapter ต้อง replaceable

## 18. Capability Over Provider Name

Runtime ควรเลือกจาก capabilities เช่น fast_chat, reasoning, coding, tool_use, multimodal, web_research, long_context, streaming

## 19. Optimize for User Experience

Wake feedback ต้องเร็ว, transcript ต้องมาเร็ว, response ควร stream, user ต้อง cancel ได้ และ idle UI ต้องเบา
