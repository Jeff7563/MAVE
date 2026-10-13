# MAVE Tool and Permission Model

## Goal

ทำให้ MAVE ลงมือทำงานได้จริง โดยยังคงให้ผู้ใช้ควบคุม

> **LLM may propose an action. Runtime decides whether the action is allowed.**

## Tool Registry

```ts
interface ToolDefinition {
  id: string;
  description: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  riskLevel: RiskLevel;
  timeoutMs: number;
}
```

Potential tools: Files, Folders, Terminal, Git, Browser, Search, Computer, Clipboard, MCP, Email, Calendar, Notes, Projects, Media, Automation

## Risk Levels

### Level 0 — Read Only
- read file
- list directory
- inspect Git status
- search docs

### Level 1 — Safe Local Action
- open file/folder
- run tests
- launch app

### Level 2 — External Side Effect
- send email
- post content
- modify calendar
- upload file

### Level 3 — Destructive / High Risk
- delete files
- reset repository
- overwrite important files
- destructive DB actions

Level 2–3 ต้องมี explicit approval ตาม policy; Level 3 ต้อง confirm เสมอ

## Permission Flow

```text
Tool Request
↓
Tool Registry
↓
Risk Classification
↓
Permission Policy
↓
Allowed?
├── Yes → Execute
└── No  → Ask Approval / Reject
```

## Permission Scope

รองรับ:
- once
- session
- folder
- project
- tool
- permanent preference

เช่น `Allow run_tests in MAVE repository` ไม่เท่ากับ `Allow terminal everywhere`

## Audit Record

เก็บ:
- task id
- tool id
- arguments (redacted เมื่อ sensitive)
- approval decision
- start/end time
- status/exit code
- summarized result
- error

## Terminal Tool

ต้องมี working directory, timeout, cancellation, output limit, dangerous command detection และ permission rules

## File Tool

แยก read/create/edit/move/delete permissions

## Git Tool

Read: status/diff/log/branch

Write: add/commit/checkout/branch

Risky: reset --hard, clean -fd, force push, branch delete → explicit approval

## Computer Control

ในอนาคต mouse/keyboard/window control ต้องมี immediate stop, visible active task, scoped access และไม่พิมพ์ secrets ลง unknown fields

## MCP

MCP ไม่ใช่ permission bypass; MCP tools ต้องผ่าน MAVE permission system เหมือน native tools

## Validation

ก่อน execute:
- validate schema
- normalize paths
- check scope
- classify risk
- reject unexpected arguments

## Long Tasks

ใช้ events:
- TASK_UPDATED
- TOOL_STARTED
- TOOL_PROGRESS
- TOOL_COMPLETED

## Recovery

เมื่อ tool fail:
1. capture error
2. explain clearly
3. offer retry
4. prevent infinite loops
5. preserve task state

## Permission UX

Prompt ต้องบอกว่า MAVE จะทำอะไร, ที่ไหน, ทำไม, ผลกระทบอะไร และขอบเขตเท่าไร
