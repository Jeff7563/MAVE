# MAVE AI Brain Architecture

## Principle

> **MAVE is not the model. MAVE selects and coordinates models.**

## Brain Categories

```text
BrainRouter
├── Fast Brain
├── Reasoning Brain
├── Agent Brain
├── Research Brain
└── Local / Offline Brain
```

### Fast Brain
เหมาะกับ conversation, translation, language practice, simple Q&A และ quick explanation โดยเน้น latency ต่ำและ streaming

### Reasoning Brain
เหมาะกับ architecture, complex decisions, deep analysis และ long context

### Agent Brain
เหมาะกับ coding, project analysis, terminal/file operations, MCP workflows และ long-running tasks

### Research Brain
เหมาะกับ current information, source-grounded answers, comparison และ fact verification

### Local Brain
เหมาะกับ offline fallback, privacy-sensitive requests และ utility tasks

## Provider Interface

```ts
export interface BrainProvider {
  id: string;
  getCapabilities(): BrainCapabilities;
  health(): Promise<ProviderHealth>;
  chat(request: BrainRequest, options?: BrainRequestOptions): AsyncIterable<BrainEvent>;
  cancel?(requestId: string): Promise<void>;
}
```

## Capabilities

```ts
export interface BrainCapabilities {
  streaming: boolean;
  reasoning: boolean;
  toolUse: boolean;
  multimodal: boolean;
  vision: boolean;
  webResearch: boolean;
  coding: boolean;
  longContext: boolean;
  local: boolean;
}
```

## Router Inputs

BrainRouter ควรพิจารณา:
- intent
- capability
- latency
- provider availability
- quota state
- privacy
- task complexity
- context size
- local/cloud preference
- user override

## Example Routing

```text
"What does awkward mean?"
→ Fast Brain

"แปลประโยคนี้เป็นไทย"
→ Fast Brain

"วิเคราะห์ architecture repo นี้"
→ Reasoning / Agent Brain

"หาเหตุการณ์ล่าสุดพร้อม source"
→ Research Brain

Offline
→ Local Brain
```

## Fallback Policy

```text
Preferred Brain
↓ unavailable
Fallback 1
↓ unavailable
Fallback 2
↓
Local / graceful failure
```

บันทึก provider selected, reason, fallback, latency และ failure reason

## Subscription-Backed Providers

รองรับ official clients/CLI/supported integrations เมื่อผู้ให้บริการอนุญาต แต่ architecture ต้องสมมติว่า access method, quota และ policy เปลี่ยนได้เสมอ

ห้าม unofficial token reuse หรือ auth piggyback hacks

## Prompt Architecture

```text
System Identity
Runtime Rules
Mode Rules
Task Instructions
Context
Tool Results
User Input
```

Prompt templates ต้อง versioned

## Modes

- Conversation Mode
- Tutor Mode
- Work Mode
- Research Mode
- Developer Mode

Mode ไม่เท่ากับ provider

## Streaming & Cancellation

Fast conversation ต้อง stream; request ที่นานต้อง cancel ได้เมื่อ user บอก stop, เริ่ม request ใหม่ หรือ timeout

## Metrics

- time to first token
- total latency
- provider failure rate
- fallback rate
- answer benchmark
- quota estimate
- cancellation success

ช่วงแรกใช้ deterministic routing ก่อน adaptive routing
