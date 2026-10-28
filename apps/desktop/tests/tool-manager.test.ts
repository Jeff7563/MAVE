import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrainRequest, ConversationRuntimeEvent, ToolEvent } from '@mave/contracts';
import { createMaveDatabase, type MaveDatabase } from '@mave/database';
import { MockBrainProvider } from '@mave/providers';
import type { RunProcessOptions, RunProcessResult, SystemAdapter } from '@mave/tools';
import { ConversationManager } from '../src/main/conversation-manager.js';
import { resolveToolRoots, ToolManager } from '../src/main/tool-manager.js';

vi.mock('electron', () => ({
  app: undefined,
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() }
}));

class RecordingSystem implements SystemAdapter {
  readonly platform = 'win32' as const;
  readonly opened: string[] = [];
  async openExternal(target: string) {
    this.opened.push(target);
  }
  async openPath(target: string) {
    this.opened.push(target);
  }
  async launchApp(command: string) {
    this.opened.push(`app:${command}`);
  }
  async run(_c: string, _a: string[], _o?: RunProcessOptions): Promise<RunProcessResult> {
    return { exitCode: 0, stdout: 'ok', stderr: '', truncated: false, cancelled: false };
  }
}

async function collect(stream: AsyncIterable<ConversationRuntimeEvent>) {
  const events: ConversationRuntimeEvent[] = [];
  for await (const e of stream) events.push(e);
  return events;
}

describe('M5 tools in the desktop runtime', () => {
  let db: MaveDatabase;
  let system: RecordingSystem;
  let tools: ToolManager;
  let toolEvents: ToolEvent[];
  let lastBrainRequest: BrainRequest | undefined;
  let manager: ConversationManager;

  function build(responseText: string) {
    const mockProvider = new MockBrainProvider({
      responseBuilder: (req) => {
        lastBrainRequest = req;
        return responseText;
      },
      chunkSize: 7
    });
    manager = new ConversationManager({
      database: db,
      toolManager: tools,
      mockProvider,
      fastBrainProvider: null,
      antigravityWorkspaceDir: '/tmp/mave-test-agy'
    });
    return manager.getRuntime();
  }

  beforeEach(async () => {
    db = await createMaveDatabase(':memory:');
    system = new RecordingSystem();
    tools = new ToolManager({ repoRoot: '/tmp/mave-repo', system, env: {}, approvalTimeoutMs: 1000 });
    toolEvents = [];
    tools.onEvent((e) => toolEvents.push(e));
    lastBrainRequest = undefined;
  });

  afterEach(async () => {
    await manager?.dispose();
    await tools.dispose();
    db.close();
  });

  it('runs Thai quick commands instantly without calling the brain', async () => {
    const runtime = build('should not be used');
    const events = await collect(runtime.send({ message: 'เปิดยูทูปหน่อยครับ' }));
    expect(system.opened).toEqual(['https://www.youtube.com']);
    expect(lastBrainRequest).toBeUndefined();
    const done = events.find((e) => e.type === 'response_completed');
    expect(done && done.type === 'response_completed' ? done.text : '').toBe('เปิด YouTube แล้วครับ');
    expect(events.find((e) => e.type === 'provider_selected')).toMatchObject({ providerId: 'mave-actions' });
  });

  it('gives every brain the tool list in its system prompt', async () => {
    const runtime = build('Hello there!');
    await collect(runtime.send({ message: 'How are you today?' }));
    expect(lastBrainRequest?.systemPrompt).toContain('system.open_url');
    expect(lastBrainRequest?.systemPrompt).toContain('```mave-action');
  });

  it('hides brain action blocks from the stream and asks before running them', async () => {
    const runtime = build(
      'Sure, I will check.\n```mave-action\n{"tool":"system.open_url","args":{"url":"https://github.com"},"reason":"user asked"}\n```'
    );
    const events = await collect(runtime.send({ message: 'Can you show me GitHub?' }));
    const streamed = events
      .filter((e) => e.type === 'response_delta')
      .map((e) => (e.type === 'response_delta' ? e.text : ''))
      .join('');
    expect(streamed).not.toContain('mave-action');
    const done = events.find((e) => e.type === 'response_completed');
    expect(done && done.type === 'response_completed' ? done.text : '').toBe('Sure, I will check.');

    // Brain-proposed safe_local actions need approval.
    await vi.waitFor(() => expect(tools.listPendingApprovals()).toHaveLength(1));
    const approval = tools.listPendingApprovals()[0]!;
    expect(approval).toMatchObject({ toolId: 'system.open_url', source: 'brain', reason: 'user asked' });
    expect(system.opened).toEqual([]);

    expect(tools.handleApprovalResponse({ callId: approval.callId, decision: 'allow' })).toEqual({ ok: true });
    await vi.waitFor(() => expect(system.opened).toEqual(['https://github.com']));
    expect(toolEvents.map((e) => e.type)).toContain('tool_completed');
    expect(tools.getAudit()[0]).toMatchObject({ decision: 'approved', status: 'completed' });
  });

  it('runs typed commands from the UI and reports unmatched text', async () => {
    build('x');
    expect(await tools.handleRunCommand({ text: 'what is the weather' })).toEqual({ matched: false });
    const res = await tools.handleRunCommand({ text: 'open calculator' });
    expect(res).toMatchObject({ matched: true, toolId: 'system.launch_app' });
    await vi.waitFor(() => expect(system.opened).toEqual(['app:calc']));
  });

  it('rejects malformed IPC payloads', async () => {
    build('x');
    expect((await tools.handleCall({ toolId: 5 })).error?.code).toBe('invalid_args');
    expect(tools.handleApprovalResponse({ callId: 'nope', decision: 'allow' }).ok).toBe(false);
    expect(tools.handleApprovalResponse({ decision: 'allow' }).ok).toBe(false);
  });

  it('resolves default tool roots safely', () => {
    expect(resolveToolRoots({ MAVE_TOOL_ROOTS: 'C:\\project; D:\\work' }, '/x')).toEqual(['C:\\project', 'D:\\work']);
    expect(resolveToolRoots({}, '/home/me/project/MAVE')).toEqual(['/home/me/project/MAVE', '/home/me/project']);
    expect(resolveToolRoots({}, '/MAVE')).toEqual(['/MAVE']);
  });
});
