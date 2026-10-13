# MAVE Memory Architecture

## Goal

ให้ MAVE ใช้ข้อมูลในอดีตอย่างมีประโยชน์ โดยไม่เก็บทุกอย่างแบบไร้ขอบเขต

> **Memory is curated context, not a dump of all conversations.**

## Memory Types

```text
Memory
├── Working Memory
├── Conversation Memory
├── Personal Memory
├── Project Memory
├── Knowledge Memory
└── Learning Memory
```

### Working Memory
current session, intent, active files/tasks/language และ recent turns; ส่วนใหญ่หมดอายุเมื่อ session จบ

### Conversation Memory
session metadata, messages, cards, sources, linked tasks สำหรับ history/resume/search

### Personal Memory
preferences, recurring goals, selected defaults, preferred language, working style

### Project Memory
เช่น current milestone, architecture decisions, branch, blockers, completed work ของแต่ละ project

### Knowledge Memory
documents, notes, architecture docs, references, manuals สำหรับ retrieval

### Learning Memory
vocabulary, grammar issues, recurring mistakes, exercises, confidence และ review schedule

## Storage Strategy

### SQLite
- sessions
- messages
- preferences
- tasks
- memories
- learning records

### Vector Index
ใช้เฉพาะ semantic retrieval ที่มีประโยชน์ เช่น documents, long notes, project knowledge

ไม่ควร vectorize ทุก record โดย default

## Memory Record

```ts
interface MemoryRecord {
  id: string;
  type: MemoryType;
  content: string;
  source: MemorySource;
  createdAt: string;
  updatedAt?: string;
  confidence?: number;
  importance?: number;
  expiresAt?: string;
  projectId?: string;
  tags?: string[];
}
```

## Provenance

Source examples:
- user_explicit
- conversation_inference
- project_file
- tool_result
- learning_engine

## Memory Write Policy

```text
Conversation
↓
Memory Candidate
↓
Policy Check
↓
Useful + Durable?
├── No → discard
└── Yes → save
```

Explicit user memory มี priority สูงกว่าการ infer อัตโนมัติ

## Sensitive Data

ไม่เก็บ passwords, API keys, tokens, secrets หรือ raw credentials

## Retrieval

Context Manager ดึงเฉพาะ relevant memory เช่น project analysis ควรดึง current milestone/architecture/blockers แต่ไม่ดึง unrelated language history

Ranking อาจใช้ relevance, recency, importance, confidence, project match, explicitness

## Lifecycle

Memory ต้อง create/update/merge/expire/archive/delete ได้

Current branch เป็นข้อมูลชั่วคราวที่ update/expire ได้; preference บางอย่างอยู่ได้นานกว่า

## User Control

Full app ควรมี memory page สำหรับ view/search/edit/delete/pin/export

## Context Budget

อย่าส่ง memory ทั้งหมดเข้า model; ส่ง top relevant summaries ตาม budget

## Safety Principle

> **MAVE should remember enough to be helpful, but not so much that it becomes uncontrolled or invasive.**
