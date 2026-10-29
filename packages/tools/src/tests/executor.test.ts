import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ToolEvent } from '@mave/contracts';
import { InMemoryToolAuditLog } from '../audit.js';
import { ToolExecutor, type ApprovalHandler } from '../executor.js';
import { PermissionPolicy } from '../permission-policy.js';
import { ToolRegistry } from '../registry.js';
import type { ToolDefinition } from '../types.js';
import { FakeSystemAdapter } from './helpers.js';

function makeTool(overrides: Partial<ToolDefinition<{ value: string }>> = {}): ToolDefinition<{ value: string }> {
  return {
    id: 'test.echo',
    title: 'Echo',
    description: 'Echo a value',
    riskLevel: 'read_only',
    timeoutMs: 1000,
    argsSchema: z.object({ value: z.string() }).strict(),
    summarize: (a) => `Echo ${a.value}`,
    execute: async (a) => ({ output: `echo:${a.value}` }),
    ...overrides
  };
}

function setup(tool = makeTool(), approvalHandler?: ApprovalHandler, policy?: PermissionPolicy) {
  const registry = new ToolRegistry();
  registry.register(tool);
  const audit = new InMemoryToolAuditLog();
  const events: ToolEvent[] = [];
  let n = 0;
  const executor = new ToolExecutor({
    registry,
    audit,
    policy,
    system: new FakeSystemAdapter(),
    approvalHandler,
    approvalTimeoutMs: 200,
    onEvent: (e) => events.push(e),
    idFactory: () => `call-${++n}`
  });
  return { executor, audit, events };
}

describe('ToolExecutor', () => {
  it('auto-allows read-only tools and audits them', async () => {
    const { executor, audit, events } = setup();
    const result = await executor.call({ toolId: 'test.echo', args: { value: 'hi' }, source: 'brain' });
    expect(result.ok).toBe(true);
    expect(result.output).toBe('echo:hi');
    expect(events.map((e) => e.type)).toEqual(['tool_requested', 'tool_started', 'tool_completed']);
    expect(audit.list()[0]).toMatchObject({ decision: 'auto_allowed', status: 'completed', toolId: 'test.echo' });
  });

  it('rejects unknown tools and invalid args without executing', async () => {
    const execute = vi.fn();
    const { executor } = setup(makeTool({ execute }));
    expect((await executor.call({ toolId: 'nope', args: {} })).error?.code).toBe('unknown_tool');
    expect((await executor.call({ toolId: 'test.echo', args: { value: 1 } })).error?.code).toBe('invalid_args');
    expect((await executor.call({ toolId: 'test.echo', args: { value: 'x', extra: true } })).error?.code).toBe('invalid_args');
    expect(execute).not.toHaveBeenCalled();
  });

  it('asks for approval when a brain proposes a safe_local action', async () => {
    const handler = vi.fn<ApprovalHandler>(async () => ({ decision: 'allow', scope: 'once' }));
    const { executor, audit, events } = setup(makeTool({ riskLevel: 'safe_local' }), handler);
    const result = await executor.call({ toolId: 'test.echo', args: { value: 'a' }, source: 'brain', reason: 'because' });
    expect(result.ok).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ summary: 'Echo a', reason: 'because', riskLevel: 'safe_local' });
    expect(events.some((e) => e.type === 'tool_approval_required')).toBe(true);
    expect(audit.list()[0]?.decision).toBe('approved');
  });

  it('runs safe_local actions from the user directly', async () => {
    const handler = vi.fn<ApprovalHandler>();
    const { executor } = setup(makeTool({ riskLevel: 'safe_local' }), handler);
    const result = await executor.call({ toolId: 'test.echo', args: { value: 'a' }, source: 'user' });
    expect(result.ok).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it('denies when the user declines, when there is no approval handler, or on timeout', async () => {
    const execute = vi.fn(async () => ({ output: 'ran' }));
    const declined = setup(makeTool({ riskLevel: 'external_side_effect', execute }), async () => ({ decision: 'deny', scope: 'once' }));
    expect((await declined.executor.call({ toolId: 'test.echo', args: { value: 'a' } })).error?.code).toBe('denied');
    expect(declined.audit.list()[0]?.status).toBe('denied');

    const noHandler = setup(makeTool({ riskLevel: 'external_side_effect', execute }));
    expect((await noHandler.executor.call({ toolId: 'test.echo', args: { value: 'a' } })).error?.code).toBe('denied');

    const slow = setup(makeTool({ riskLevel: 'external_side_effect', execute }), () => new Promise(() => undefined));
    expect((await slow.executor.call({ toolId: 'test.echo', args: { value: 'a' } })).error?.code).toBe('denied');
    expect(execute).not.toHaveBeenCalled();
  });

  it('remembers session approvals but never for destructive actions', async () => {
    const handler = vi.fn<ApprovalHandler>(async () => ({ decision: 'allow', scope: 'session' }));
    let risk: 'external_side_effect' | 'destructive' = 'external_side_effect';
    const { executor } = setup(makeTool({ riskLevel: 'read_only', classifyRisk: () => risk }), handler);
    await executor.call({ toolId: 'test.echo', args: { value: 'a' } });
    await executor.call({ toolId: 'test.echo', args: { value: 'b' } });
    expect(handler).toHaveBeenCalledTimes(1);

    risk = 'destructive';
    await executor.call({ toolId: 'test.echo', args: { value: 'c' } });
    await executor.call({ toolId: 'test.echo', args: { value: 'd' } });
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('dynamic risk can raise but never lower the declared risk', async () => {
    const handler = vi.fn<ApprovalHandler>(async () => ({ decision: 'allow', scope: 'once' }));
    const { executor } = setup(makeTool({ riskLevel: 'external_side_effect', classifyRisk: () => 'read_only' }), handler);
    await executor.call({ toolId: 'test.echo', args: { value: 'a' } });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('hard-blocks calls even before approval', async () => {
    const handler = vi.fn<ApprovalHandler>();
    const { executor, audit } = setup(makeTool({ block: () => 'nope' }), handler);
    const result = await executor.call({ toolId: 'test.echo', args: { value: 'a' } });
    expect(result.error).toEqual({ code: 'blocked', message: 'nope' });
    expect(handler).not.toHaveBeenCalled();
    expect(audit.list()[0]?.decision).toBe('blocked');
  });

  it('times out long tools', async () => {
    const { executor, audit } = setup(
      makeTool({ timeoutMs: 30, execute: () => new Promise(() => undefined) })
    );
    const result = await executor.call({ toolId: 'test.echo', args: { value: 'a' } });
    expect(result.error?.code).toBe('timeout');
    expect(audit.list()[0]?.status).toBe('timeout');
  });

  it('cancels in-flight tools by call id', async () => {
    const { executor } = setup(
      makeTool({
        execute: (_a, ctx) =>
          new Promise((_resolve, reject) => ctx.signal.addEventListener('abort', () => reject(new Error('stop'))))
      })
    );
    const pending = executor.call({ callId: 'c1', toolId: 'test.echo', args: { value: 'a' } });
    await new Promise((r) => setTimeout(r, 5));
    expect(executor.cancel('c1')).toBe(true);
    expect((await pending).error?.code).toBe('cancelled');
    expect(executor.listActive()).toEqual([]);
  });

  it('streams progress and redacts secrets in output, args and audit', async () => {
    const { executor, audit, events } = setup(
      makeTool({
        execute: async (a, ctx) => {
          ctx.progress('using sk-abcdefghijklmnopqrstuvwxyz');
          return { output: `token ${a.value}` };
        }
      })
    );
    const secret = 'ghp_abcdefghijklmnopqrstuvwxyz0123';
    const result = await executor.call({ toolId: 'test.echo', args: { value: secret } });
    expect(result.output).toBe('token [REDACTED]');
    const progress = events.find((e) => e.type === 'tool_progress');
    expect(progress && 'message' in progress ? progress.message : '').toBe('using [REDACTED]');
    expect(JSON.stringify(audit.list())).not.toContain(secret);
  });

  it('refuses to construct a policy that auto-allows destructive actions', () => {
    expect(() => new PermissionPolicy({ userAutoAllowUpTo: 'destructive' })).toThrow();
  });
});
