# MAVE Milestone 5 — Agent Runtime & Tools (Foundation) + M4 Surface Foundation

**Status:** Foundation implemented (2026-10-28) on branch `claude/project-thread-pkgz8h`
**Goal:** จาก "ตอบได้" → "ทำงานได้" — MAVE สั่งเปิดเว็บ/แอป/โฟลเดอร์, รันคำสั่ง, และสั่งงาน coding agent (Claude Code / Codex / Antigravity) ได้ โดยที่ผู้ใช้ยังควบคุมทุกอย่าง

> **LLM may propose an action. Runtime decides whether the action is allowed.**

---

## 1. Why M5 foundation before finishing M4

ผู้ใช้ต้องการ MAVE แบบ JARVIS: "สั่งเปิดนู่นนี่นั่น" และ "สั่ง Claude Code / Codex / Antigravity ได้" งานนี้จึงทำ M5 foundation ก่อน แล้วทำ M4 Surface foundation (UI V2) ต่อ เพื่อให้ approval cards และ task progress มีที่แสดงผลตั้งแต่วันแรก

M2/M3 subsystems ไม่ถูก refactor (Engineering Principle 14). มีการเพิ่ม hook เดียวใน `ConversationRuntime`: `systemPromptProvider` (optional, ไม่บังคับ)

---

## 2. Architecture

```text
User text / voice transcript
        ↓
ActionAwareConversationRuntime (desktop main)
        ├── QuickCommandMatcher matched? ("เปิดยูทูป", "open vscode")
        │        ↓ yes → ActionBrainProvider ('mave-actions') → ToolExecutor
        │                 (no LLM round trip — instant; reply is spoken/streamed)
        └── no → normal ConversationRuntime → BrainRouter → brain
                 (system prompt includes the tool list, mave-action/1)
                        ↓
                 StreamingActionFilter hides ```mave-action blocks from text/TTS
                        ↓
                 on completion → ToolExecutor (source: "brain")

ToolExecutor
  validate (zod, strict) → classify risk (static + dynamic, raise-only)
  → hard block → PermissionPolicy → (ApprovalHandler → Surface Approval card)
  → execute with timeout + AbortSignal → redact → audit → ToolEvents → UI
```

Packages:

| Package | New |
|---|---|
| `@mave/contracts` | `tools.ts` (risk, call, approval, result, audit, events, IPC), `surface.ts` |
| `@mave/tools` | registry, permission policy, executor, audit, workspace scope, command safety, app/site catalog, quick commands, action protocol, action provider, built-in tools |
| `@mave/providers` | `OpenAICompatibleBrainProvider` (Fast Brain) |
| `@mave/core` | `ConversationRuntimeOptions.systemPromptProvider` |
| `apps/desktop` | `ToolManager`, `ActionAwareConversationRuntime`, `SurfaceWindow`, tool & surface IPC, Surface renderer |

---

## 3. Risk & Permission

| Level | Risk | Examples | User typed it | Brain/agent proposed it |
|---|---|---|---|---|
| 0 | `read_only` | list folder, read file, git status | run | run |
| 1 | `safe_local` | open url/app/folder, web search, `pnpm test` | run | **ask** |
| 2 | `external_side_effect` | unknown shell commands, coding agents | **ask** | **ask** |
| 3 | `destructive` | `rm -rf`, `git reset --hard`, force push | **always ask** | **always ask** |

- Approval scopes: `once`, `session` (per tool + source class). Session grants never apply to destructive.
- No approval handler / timeout (5 min) → deny.
- Hard blocks (never run): remote-script pipes (`curl … | sh`), reading `.ssh`/`.env`/credentials, paths outside allowed folders, unknown apps, non-http(s) URLs (except allow-listed app URIs).
- Allowed folders: `MAVE_TOOL_ROOTS` (`;`-separated). Default: repo folder + its parent (e.g. `C:\project`), unless the parent is a drive root or home.
- Secrets redacted in outputs, progress lines, audit args (`sk-…`, `ghp_…`, `AIza…`, `xox…`, keys named password/token/secret…).

---

## 4. Built-in tools (v1)

| Tool | Risk | Notes |
|---|---|---|
| `system.open_url` | safe_local | site names (youtube, gmail, github, ยูทูป…) or URLs |
| `system.web_search` | safe_local | Google or YouTube search |
| `system.launch_app` | safe_local | catalog only (vscode, chrome, spotify, เครื่องคิดเลข…); Windows uses `Start-Process` |
| `system.open_path` | safe_local | inside allowed folders |
| `fs.list_directory` | read_only | ≤200 entries, hides node_modules/.git |
| `fs.read_text_file` | read_only | ≤64 KB, refuses secrets/binary |
| `git.status` | read_only | `git status --short --branch` |
| `terminal.run_command` | dynamic | known-safe → safe_local, else external, destructive patterns → destructive |
| `agent.delegate` | external_side_effect | `claude -p` (plan/acceptEdits), `codex exec` (read-only/workspace-write), `agy` stream-json; task via stdin |

Windows process notes: shell commands run through `cmd.exe /d /s /c "<cmd>"` with verbatim args; cancel uses `taskkill /T /F` (whole tree). POSIX uses process groups.

---

## 5. Quick Commands (Thai + English, deterministic)

Examples (see `packages/tools/src/tests/quick-commands.test.ts`):

```text
เปิดยูทูป / เปิด youtube ให้หน่อยครับ   → system.open_url
ช่วยเปิด vscode หน่อย / open calculator → system.launch_app
เปิดโฟลเดอร์ C:\project                 → system.open_path
ค้นหา ราคาทองวันนี้                     → system.web_search (google)
เปิดเพลง lofi ในยูทูป / play daft punk  → system.web_search (youtube)
git status / รันเทส / run pnpm build     → git.status / terminal.run_command
ให้ claude ช่วยสรุปว่าโปรเจกต์ถึงไหนแล้ว → agent.delegate (plan)
ask codex to fix the failing test        → agent.delegate (edit → asks first)
```

Normal conversation ("What does awkward mean?", "เปิดใจคุยกันหน่อย") is never matched.

---

## 6. Brain action protocol `mave-action/1`

Any brain can request actions inside its text answer:

````text
Sure, opening it now.
```mave-action
{"tool": "system.open_url", "args": {"url": "https://youtube.com"}, "reason": "user asked"}
```
````

- Max 3 actions per answer; malformed blocks are logged and ignored.
- Blocks are removed from streamed text, spoken text and the final text event.
- All run as `source: "brain"` → anything above read-only shows an Approval card.
- Native function-calling can replace this later without changing the executor.

---

## 7. Fast Brain (closes the ~9 s TTFT gap from M3)

`OpenAICompatibleBrainProvider` speaks the OpenAI Chat Completions streaming API, so one adapter covers Groq, Cerebras, Gemini (OpenAI endpoint), OpenRouter, OpenAI, Ollama, LM Studio, llama.cpp server, vLLM.

```text
MAVE_FAST_BRAIN=groq|cerebras|gemini|openrouter|openai|ollama|lmstudio|custom
MAVE_FAST_BRAIN_API_KEY=...        (or GROQ_API_KEY / GEMINI_API_KEY / ...)
MAVE_FAST_BRAIN_MODEL=...          (optional)
MAVE_FAST_BRAIN_BASE_URL=...       (custom only)
MAVE_DEFAULT_BRAIN=fast|antigravity|mock   (optional override)
```

When configured it becomes the default provider with `mock` as an inspectable fallback. Health uses the free `/models` endpoint. Errors map to `provider_auth` / `provider_limit` / `provider_unavailable`. Clean cancellation via AbortSignal.

Needs live measurement on the user's PC (target TTFT < 1.5 s).

---

## 8. M4 Surface foundation (UI V2)

Implemented from `MAVE_AMBIENT_ADAPTIVE_SURFACE.md` (Option A — single adaptive window):

- Frameless, transparent, always-on-top window, bottom-right of the display under the cursor, `showInactive` — never steals focus in passive modes.
- Modes: `orb` → `capsule` (audio-reactive waveform) → `card` → `panel` → `workspace`.
- Pure Surface Policy (`surface-state.ts`): approvals & long tasks persistent; importance-based auto-hide (capsule 4 s, low 6 s, medium 45 s, high 3 min); pin; Esc closes.
- Approval cards (Allow / Allow this session / Deny), task cards with live progress and Cancel.
- Global hotkey `Ctrl+Alt+M` (`MAVE_HOTKEY`). `MAVE_SURFACE=0` disables, `MAVE_CONSOLE=0` hides the developer console.
- Developer console stays as-is for diagnostics.

---

## 9. Verification

- Unit: tools 73, providers 144, core 217, desktop 110, contracts 61, database 22 — all passing.
- E2E (Electron, xvfb): 4/4 including the new surface + quick-command smoke test.
- Visual check of each surface mode rendered headless.

Not verified here (needs the user's Windows PC): real app launching, `claude`/`codex`/`agy` CLIs, Fast Brain live latency, transparent window on Windows 11, multi-monitor.

---

## 10. Non-goals (this phase)

- Unrestricted computer control (mouse/keyboard) — later, behind explicit scope and immediate stop.
- MCP client — next phase; MCP tools must go through the same executor.
- Persistent audit in SQLite — in-memory now (`ToolAuditSink` ready for a SQLite sink).
- Permanent/folder-scoped permission preferences.
- Multi-agent orchestration.

---

## 11. Next phases

1. **M5.1** SQLite audit sink + permission preferences UI.
2. **M5.2** MCP client (`@modelcontextprotocol/sdk`) → MCP tools registered into `ToolRegistry`.
3. **M5.3** Agent task workspace: stream Claude Code `--output-format stream-json` steps into task cards; resumable sessions.
4. **M4.x** Surface polish: Windows 11 acrylic, translation/vocabulary cards, rich cards (image/source/code), multi-monitor tests.
5. **Voice**: Thai STT/TTS upgrades (see `MAVE_OPEN_SOURCE_ADOPTION.md`), AEC for speaker barge-in.
