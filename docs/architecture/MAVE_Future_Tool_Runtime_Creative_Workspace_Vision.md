# MAVE — Future Tool Runtime & Creative Workspace Vision

> **Status:** PARKED / FUTURE PHASE  
> **Do not implement now.** Revisit after MAVE Core is complete and stable.

## 1. Why this idea matters

MAVE should eventually become more than an AI assistant that only answers questions or chats with the user.

The long-term goal is for the user to be able to say things like:

- “MAVE ทำวิดีโอนี้ให้หน่อย”
- “ตัดพื้นหลังรูปนี้แล้วทำโปสเตอร์ 4:5”
- “เอา PDF นี้ไปสรุปแล้วทำสไลด์”
- “สร้างเอกสารจากข้อมูลพวกนี้”
- “เปิดไฟล์ Excel แล้วทำ Dashboard”
- “ออกแบบ UI จาก reference นี้”
- “แก้คลิปนี้ให้เหมาะกับ TikTok / Reels / Shopee Video”
- “จัดเสียง ใส่ subtitle แล้ว export ให้พร้อมโพสต์”

The user should not have to think about which app, model, or tool to open.

MAVE should understand the **intent**, plan the work, choose the correct tools, execute the workflow, show progress, and return the finished artifact.

---

## 2. Core Vision

Traditional workflow:

```text
Human
  ↓
Choose App
  ↓
Learn App
  ↓
Operate Tools
  ↓
Export File
```

MAVE workflow:

```text
Human
  ↓
Natural Language Intent
  ↓
MAVE
  ↓
Understand
  ↓
Plan
  ↓
Choose Tools / Models / Apps
  ↓
Execute
  ↓
QA / Review
  ↓
Artifact
```

The central idea:

> **The user asks for an outcome. MAVE decides how to produce it.**

---

## 3. MAVE should not become one giant app

MAVE should NOT directly rebuild Photoshop, Premiere, Word, Excel, Figma, Blender, etc. inside MAVE Core.

Instead, MAVE should act as an **intelligence and orchestration layer**.

```text
                    MAVE
             Intelligence Layer
                    │
        ┌───────────┴───────────┐
        │                       │
 Conversation               Workspace
        │                       │
        └───────────┬───────────┘
                    │
              MAVE Tool Router
                    │
          MCP / APIs / Local Tools
                    │
 ┌──────────┬───────┼────────┬──────────┐
 │          │       │        │          │
Image     Video    Docs    Design     Data
Tools     Tools    Tools    Tools      Tools
```

Possible providers in the future:

- ArtCraft / Craft Apps
- FFmpeg
- Remotion
- Blender
- Figma
- Adobe tools
- Microsoft Office
- Google Workspace
- Image generation models
- Video generation models
- Local AI models
- Cloud AI models
- Browser / Computer Control
- Custom MAVE-native tools

MAVE must not be tightly coupled to any single provider.

---

## 4. ArtCraft as a Future Candidate

ArtCraft is interesting because its Craft Apps are designed around workflows that can be controlled by agents.

Potential future usage:

- PhotoCraft → image editing
- FilmCraft → video editing
- FigCraft / DesignCraft → UI and design
- WordCraft → documents
- GridCraft → spreadsheets / data
- DeckCraft → presentations
- PdfCraft → PDF workflows
- SoundCraft → audio
- VectorCraft → vector graphics
- CADCraft → CAD work

However:

> **ArtCraft is a candidate Tool Runtime, not the foundation of MAVE.**

MAVE should define its own generic tool interface first.

---

## 5. Proposed MAVE Tool Interface

Conceptual interface:

```text
MAVE Tool
├── describe()
├── capabilities()
├── inspect()
├── execute()
├── preview()
├── revise()
├── undo()
├── save()
├── export()
└── report_status()
```

MAVE Tool Router should be able to ask:

```text
What tools can:
- edit images?
- create a 9:16 video?
- manipulate a PDF?
- create slides?
- generate subtitles?
- export DOCX?
```

Then choose the best available provider.

---

## 6. Example — Image Workflow

User:

> “MAVE เอารูปนี้ออกพื้นหลัง แล้วทำโปสเตอร์ 4:5 ให้หน่อย”

MAVE:

```text
Intent Understanding
      ↓
Task Plan
      ↓
Image Tool
 ├─ Remove Background
 ├─ Extend / Resize Canvas
 ├─ Compose Layout
 ├─ Add Typography
 ├─ Color / Lighting Adjustment
 └─ Export PNG
      ↓
QA
      ↓
Poster Preview
```

Chat UI should only show what matters:

```text
MAVE

Creating your poster...

┌──────────────────────────────┐
│ Poster Preview               │
│                              │
│          [ IMAGE ]           │
│                              │
│ ✓ Background removed         │
│ ✓ 4:5 composition            │
│ ✓ Typography                 │
│ ✓ Final quality check        │
│                              │
│ Edit        Export           │
└──────────────────────────────┘
```

The full editor should only open if the user wants manual control.

---

## 7. Example — Video Workflow

User:

> “MAVE ทำคลิปขายสินค้าตัวนี้ 20 วิ ลง Shopee กับ TikTok”

Possible workflow:

```text
Product Reference
      ↓
MAVE Vision Analysis
      ↓
Research / Context
      ↓
Script
      ↓
Shot List
      ↓
Image / Video Generation
      ↓
Video Editor
      ↓
Voice
      ↓
Music / SFX
      ↓
Subtitle
      ↓
CTA
      ↓
QA
      ↓
Exports
 ├─ TikTok
 └─ Shopee Video
```

The user does not need to manually coordinate all of these systems.

MAVE becomes the producer / editor / orchestrator.

---

## 8. Example — Document Workflow

User:

> “MAVE เอา PDF นี้ไปสรุปแล้วทำรายงานกับสไลด์ให้”

Possible workflow:

```text
PDF
 ↓
Extraction / Understanding
 ↓
MAVE Analysis
 ↓
Structured Notes
 ├─────────────┐
 ↓             ↓
Document      Presentation
Tool          Tool
 ↓             ↓
DOCX          PPTX
```

Potential outputs:

- Executive summary
- Full report
- Presentation
- Key findings
- Tables / charts
- Action items

---

## 9. Example — Data / Spreadsheet Workflow

User:

> “วิเคราะห์ยอดขายไฟล์นี้ แล้วทำ Dashboard ให้หน่อย”

```text
Spreadsheet
    ↓
MAVE Data Analysis
    ↓
Clean / Transform Data
    ↓
Metrics
    ↓
Charts
    ↓
Dashboard
    ↓
Insights
```

MAVE should be able to explain:

- What changed
- Why it changed
- What requires attention
- What the user should do next

---

## 10. Chat Mode vs Workspace Mode

This should follow the MAVE UI philosophy.

### Chat Mode

Default.

Use small artifact cards inside the conversation.

Suitable for:

- Previewing images
- Showing a video
- Displaying a document
- Showing search results
- Approving / rejecting
- Quick edits
- Export actions

### Workspace Mode

Only expand when needed.

Suitable for:

- Timeline editing
- Layer editing
- Slide editing
- Spreadsheet work
- Complex visual design
- Long documents
- Multi-file projects

Concept:

```text
Chat → Preview → Expand when needed
```

NOT:

```text
Open giant editor for every task
```

---

## 11. MAVE Local + Cloud Architecture

Long-term possibility:

```text
            MAVE Brain
            /        \
       Cloud          Local
         │              │
 AI Models / Web    Local Runtime
                        │
                ┌───────┼────────┐
                │       │        │
             Files    GPU     Local Apps
```

Benefits:

- Privacy
- Faster local file operations
- Use user's GPU where appropriate
- Lower cloud dependency
- Offline-capable workflows
- Control over sensitive artifacts

MAVE should decide whether work belongs locally or in the cloud.

---

## 12. Important Architectural Rule

Do not design:

```text
MAVE → ArtCraft
```

Design:

```text
MAVE
 ↓
Tool Abstraction Layer
 ↓
Providers
 ├─ ArtCraft
 ├─ Adobe
 ├─ Blender
 ├─ FFmpeg
 ├─ Office
 ├─ Google
 ├─ AI Models
 └─ Custom Tools
```

This prevents vendor lock-in and lets MAVE continuously adopt better tools.

---

## 13. Future Capability Categories

MAVE could eventually support:

### Creative

- Image generation
- Image editing
- Graphic design
- Posters
- Thumbnails
- Branding
- Vector design

### Video

- Video generation
- Editing
- Shot planning
- Subtitles
- Voiceover
- Music
- Color grading
- Reframing
- Shorts / Reels / TikTok conversion

### Documents

- DOCX
- PDF
- Reports
- Letters
- Contracts
- Notes
- Knowledge documents

### Presentation

- Pitch decks
- Reports
- School presentations
- Business reviews

### Data

- Spreadsheet editing
- Analysis
- Dashboards
- Charts
- Reports

### Audio

- Voice
- Cleaning
- SFX
- Music
- Podcast workflows

### Design / Development

- UI/UX
- Assets
- Prototypes
- Code
- Web apps
- 3D / Blender
- Game assets

---

## 14. MAVE's Future Role

MAVE should gradually move from:

```text
AI Assistant
```

to:

```text
AI Assistant
     ↓
AI Operator
     ↓
AI Creative Partner
     ↓
AI Computer Interface
```

The ideal experience:

> User: “MAVE ทำอันนี้ให้หน่อย”

MAVE:

1. Understands what “this” means.
2. Reads the available context.
3. Builds a plan.
4. Selects the correct tools.
5. Executes the workflow.
6. Checks its own work.
7. Returns a preview.
8. Lets the user revise through conversation.
9. Exports the finished artifact.

---

## 15. Current Decision

### NOW

Focus only on MAVE Core.

Priorities:

- Conversation
- Context
- Memory
- Voice
- UI
- Tool Router
- MCP
- Agent execution
- Tasks
- Computer control
- Artifact system
- Reliable orchestration

### LATER

After MAVE Core is mature:

- Evaluate ArtCraft
- Evaluate local creative runtimes
- Build MAVE Tool Abstraction Layer
- Prototype one creative workflow
- Add image workflow
- Add document workflow
- Add video workflow
- Add spreadsheet / presentation workflows
- Add more providers gradually

---

## 16. Revisit Trigger

Reopen this idea when:

- MAVE Core is stable
- Tool Router is working
- MCP / tool execution is reliable
- Artifact previews are implemented
- Conversation → Action flow feels natural
- MAVE can safely execute multi-step tasks

Then create a dedicated project:

> **MAVE Creative & Productivity Runtime**

---

## 17. North Star

> **MAVE should not make the user learn which tool to use.  
> MAVE should understand what the user wants and assemble the right tools to make it happen.**

That is the long-term direction.
