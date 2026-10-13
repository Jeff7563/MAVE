# MAVE Master Vision

## 1. Product Definition

**MAVE** คือ Personal AI Assistant ที่พร้อมใช้งานตลอดเวลา สามารถสนทนา เข้าใจบริบท วิเคราะห์ข้อมูล ค้นคว้าข้อมูลที่เชื่อถือได้ ลงมือทำงานผ่านเครื่องมือและเอเจนต์หลายระบบ จดจำสิ่งที่มีคุณค่า และช่วยให้ผู้ใช้พัฒนาทักษะของตัวเองอย่างต่อเนื่อง

MAVE ไม่ใช่ ChatGPT clone และไม่ใช่แอป voice chat ธรรมดา

MAVE คือระบบที่ทำหน้าที่เป็นชั้นกลางระหว่าง:

- ผู้ใช้
- AI models
- agents
- tools
- local computer
- external services
- memory
- knowledge
- learning
- UI
- voice

## 2. North Star

> **MAVE should reduce the distance between thinking about something and getting it done — while helping the user understand, learn, and improve along the way.**

ภาษาไทย:

> **คิดอะไรขึ้นมา → เรียก MAVE → เข้าใจ → ลงมือทำ → ได้ผลลัพธ์ → เราเก่งขึ้น**

## 3. Long-Term Experience

```text
User
  ↓
"Hey MAVE"
  ↓
MAVE understands current context
  ↓
Conversation / Analysis / Research / Action
  ↓
Voice + Floating UI
  ↓
Text / Translation / Images / Video / Files / Sources / Progress
  ↓
Useful knowledge and learning events are retained
  ↓
MAVE remains available for the next request
```

ผู้ใช้ไม่ควรรู้สึกว่ากำลัง “เปิด AI อีกตัวหนึ่ง” แต่ควรรู้สึกว่า **MAVE อยู่ใกล้เสมอ และเมื่อต้องการอะไรก็แค่เรียกมัน**

## 4. Five Product Pillars

### Assistant
- สนทนาเป็นธรรมชาติ
- ตอบคำถามและอธิบายเรื่องยากให้ง่าย
- ช่วยคิดและช่วยตัดสินใจ
- รักษาบริบทต่อเนื่อง

### Operator
- เปิดไฟล์/โฟลเดอร์/โปรแกรม
- ใช้ terminal, Git, browser, MCP tools
- เรียก specialized agents
- ทำ workflow หลายขั้นตอน

### Analyst
- วิเคราะห์โค้ด logs เอกสาร project status และปัญหา
- เปรียบเทียบทางเลือกและ trade-offs

### Teacher
- ฝึกภาษาอังกฤษและภาษาอื่น
- แปล ENG ↔ TH
- แนะนำประโยคที่เป็นธรรมชาติกว่า
- จำศัพท์และข้อผิดพลาดที่เกิดซ้ำ
- ทำ recap และ review

### Memory
- working context
- conversation history
- preferences/goals
- project state
- knowledge
- learning progress

## 5. MAVE Is Not an AI Model

> **Claude, Gemini, GPT, Local LLM และโมเดลอื่นเป็นเพียง Brain Providers ไม่ใช่ตัว MAVE เอง**

```text
MAVE
├── Gemini
├── Claude
├── GPT
└── Local Models
```

MAVE Runtime เป็นตัวเลือกว่าจะใช้ brain ใดสำหรับงานใด

## 6. Always-Available Presence

MAVE ควรเข้าถึงได้ผ่าน:
- Wake word
- Global hotkey
- Floating UI
- Text input
- Voice input
- Notifications
- Mobile companion ในอนาคต

## 7. JARVIS-Like Experience

สิ่งที่ทำให้ MAVE ใกล้ JARVIS ไม่ใช่แค่ intelligence แต่คือ:

1. Presence — เรียกแล้วตอบ
2. Continuity — จำและต่อบทสนทนาได้
3. Agency — ลงมือทำงาน
4. Visibility — แสดงสิ่งที่กำลังทำ
5. Trust — permission และ audit ชัดเจน
6. Learning — ช่วยให้ผู้ใช้เก่งขึ้น
7. Identity — UI, voice, animation, behavior สม่ำเสมอ

## 8. Product Principles

- Local-first เมื่อเหมาะสม
- Provider-independent
- Privacy-aware
- Permission-aware
- Observable
- Recoverable
- Human-in-control
- Fast for simple interactions
- Powerful for complex tasks
- Never dependent on one AI vendor

## 9. MAVE v1 Success Scenario

```text
Windows starts
↓
MAVE runs in background

User: "Hey MAVE"
MAVE: "Yeah?"

User: "Can we practice English?"
→ สนทนา
→ Floating UI แสดง transcript / Thai translation / vocabulary / corrections

User: "ช่วยดูโปรเจกต์ MAVE ว่าตอนนี้ถึงไหน"
→ อ่าน project context
→ route ไป agent/tool ที่เหมาะสม
→ แสดง task progress
→ สรุปผล

User: "จำอันนี้ไว้"
→ เก็บ memory ที่เหมาะสม

MAVE returns to standby
```

## 10. Early Non-Goals

- unrestricted autonomous computer control
- continuous screen capture by default
- multi-user household assistant
- full standalone mobile runtime
- storing every conversation forever
- destructive actions without explicit policy/approval

## 11. Final Vision

MAVE คือระบบที่:

> **รับรู้ → เข้าใจ → เลือกสมอง → ใช้เครื่องมือ → ลงมือทำ → อธิบาย → จดจำ → ช่วยให้ผู้ใช้พัฒนา**
