import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import type { BrainRequest } from '@mave/contracts';
import {
  ClaudeCodeBrainProvider,
  type SpawnFactory
} from '../brain/claude.js';
import {
  CLAUDE_CODE_PROVIDER_ID,
  CLAUDE_ROLE_MAPPING,
  resolveClaudeModelForRole
} from '../brain/claude/models.js';
import {
  buildClaudeCodePrompt,
  MAVE_CLAUDE_CONVERSATIONAL_INSTRUCTION
} from '../brain/claude/prompt.js';
import {
  redactDiagnosticText
} from '../brain/claude/parser.js';

function createMockChildProcess(): {
  child: ChildProcess;
  emitStdout: (chunk: string) => void;
  emitStderr: (chunk: string) => void;
  emitClose: (code: number | null, signal?: NodeJS.Signals | null) => void;
  emitError: (err: Error) => void;
} {
  const child = new EventEmitter() as unknown as ChildProcess;
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  (child as any).stdout = stdout;
  (child as any).stderr = stderr;
  (child as any).stdin = null;
  (child as any).killed = false;
  (child as any).kill = vi.fn(() => {
    (child as any).killed = true;
    queueMicrotask(() => {
      stdout.end();
      stderr.end();
      child.emit('close', null, 'SIGTERM');
    });
    return true;
  });

  return {
    child,
    emitStdout: (chunk: string) => stdout.write(chunk),
    emitStderr: (chunk: string) => stderr.write(chunk),
    emitClose: (code: number | null, signal: NodeJS.Signals | null = null) => {
      stdout.end();
      stderr.end();
      child.emit('close', code, signal);
    },
    emitError: (err: Error) => child.emit('error', err)
  };
}

function req(id: string, text = 'Hello Claude'): BrainRequest {
  return {
    requestId: id,
    sessionId: 'sess-1',
    intent: 'conversation',
    messages: [{ role: 'user', content: text }]
  };
}

describe('ClaudeCodeBrainProvider', () => {
  describe('Provider Identity & Capabilities', () => {
    it('declares canonical provider id "claude-code"', () => {
      const provider = new ClaudeCodeBrainProvider();
      expect(provider.id).toBe(CLAUDE_CODE_PROVIDER_ID);
      expect(provider.id).toBe('claude-code');
    });

    it('declares agent_runtime_provider capabilities without faking model_provider', () => {
      const provider = new ClaudeCodeBrainProvider();
      const caps = provider.getCapabilities();

      expect(caps.streaming).toBe(true);
      expect(caps.reasoning).toBe(true);
      expect(caps.coding).toBe(true);
      expect(caps.longContext).toBe(true);
      expect(caps.cancellation).toBe(true);
      // HARD INVARIANT: fastChat is false because Claude Code is an agent runtime, not a direct model_provider
      expect(caps.fastChat).toBe(false);
      // HARD INVARIANT: Pre-M5 tool execution is strictly blocked
      expect(caps.toolUse).toBe(false);
      expect(caps.local).toBe(false);
    });

    it('exposes internal runtime model snapshots', () => {
      const provider = new ClaudeCodeBrainProvider();
      const models = provider.getRuntimeModels();

      expect(models.length).toBeGreaterThanOrEqual(3);
      const sonnet = models.find((m) => m.modelId === 'sonnet');
      expect(sonnet).toBeDefined();
      expect(sonnet?.supportedRoles).toContain('BALANCED');
      expect(sonnet?.supportedRoles).toContain('CODING');
      expect(sonnet?.supportedRoles).toContain('REASONING');

      const opus = models.find((m) => m.modelId === 'opus');
      expect(opus).toBeDefined();
      expect(opus?.supportedRoles).toContain('REASONING');

      const haiku = models.find((m) => m.modelId === 'haiku');
      expect(haiku).toBeDefined();
    });
  });

  describe('Model Role Mapping Matrix', () => {
    it('maps REASONING to opus or sonnet', () => {
      expect(resolveClaudeModelForRole('REASONING')).toBe('opus');
      expect(CLAUDE_ROLE_MAPPING.REASONING).toContain('opus');
      expect(CLAUDE_ROLE_MAPPING.REASONING).toContain('sonnet');
    });

    it('maps CODING to sonnet or opus', () => {
      expect(resolveClaudeModelForRole('CODING')).toBe('sonnet');
      expect(CLAUDE_ROLE_MAPPING.CODING).toContain('sonnet');
    });

    it('maps AGENT to sonnet', () => {
      expect(resolveClaudeModelForRole('AGENT')).toBe('sonnet');
      expect(CLAUDE_ROLE_MAPPING.AGENT).toContain('sonnet');
    });

    it('maps BALANCED to sonnet', () => {
      expect(resolveClaudeModelForRole('BALANCED')).toBe('sonnet');
      expect(CLAUDE_ROLE_MAPPING.BALANCED).toContain('sonnet');
    });

    it('maps FAST role to haiku (ModelRole.FAST != BrainProfile.fast_conversation)', () => {
      expect(resolveClaudeModelForRole('FAST')).toBe('haiku');
      expect(CLAUDE_ROLE_MAPPING.FAST).toContain('haiku');
    });
  });

  describe('Health Probing', () => {
    it('returns healthy when claude --version exits 0', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, _args, _opts) => {
        queueMicrotask(() => {
          mock.emitStdout('2.1.251 (Claude Code)\n');
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new ClaudeCodeBrainProvider({ spawnFactory });
      const health = await provider.health();

      expect(health.status).toBe('healthy');
      expect(health.message).toContain('Claude Code CLI is ready');
    });

    it('returns unconfigured when claude --version exits non-zero', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, _args, _opts) => {
        queueMicrotask(() => {
          mock.emitStderr('command not found\n');
          mock.emitClose(127);
        });
        return mock.child;
      });

      const provider = new ClaudeCodeBrainProvider({ spawnFactory });
      const health = await provider.health();

      expect(health.status).toBe('unconfigured');
      expect(health.message).toContain('command not found');
    });

    it('returns unconfigured when process spawn throws', async () => {
      const spawnFactory: SpawnFactory = vi.fn(() => {
        throw new Error('ENOENT spawn claude');
      });

      const provider = new ClaudeCodeBrainProvider({ spawnFactory });
      const health = await provider.health();

      expect(health.status).toBe('unconfigured');
      expect(health.message).toContain('ENOENT spawn claude');
    });
  });

  describe('Subscription Billing Safety & Spawn Guardrails', () => {
    it('explicitly removes ANTHROPIC_API_KEY and related billing variables from child environment', async () => {
      let capturedEnv: NodeJS.ProcessEnv | undefined;
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, _args, opts: SpawnOptions) => {
        capturedEnv = opts.env;
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({ type: 'result', subtype: 'success', result: 'OK' }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      // Set global env temporarily to test sanitization
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-secret-12345';
      process.env['ANTHROPIC_AUTH_TOKEN'] = 'test-token';
      process.env['CLAUDE_API_KEY'] = 'test-claude-key';

      try {
        const provider = new ClaudeCodeBrainProvider({ spawnFactory });
        const events: any[] = [];
        for await (const ev of provider.chat(req('r1'))) {
          events.push(ev);
        }

        // Child process environment must NOT contain any Anthropic API keys
        expect(capturedEnv).toBeDefined();
        expect(capturedEnv?.['ANTHROPIC_API_KEY']).toBeUndefined();
        expect(capturedEnv?.['ANTHROPIC_AUTH_TOKEN']).toBeUndefined();
        expect(capturedEnv?.['CLAUDE_API_KEY']).toBeUndefined();

        // Global parent process environment must remain untouched
        expect(process.env['ANTHROPIC_API_KEY']).toBe('sk-ant-test-secret-12345');
      } finally {
        delete process.env['ANTHROPIC_API_KEY'];
        delete process.env['ANTHROPIC_AUTH_TOKEN'];
        delete process.env['CLAUDE_API_KEY'];
      }
    });

    it('enforces safe headless arguments: NO dangerous permissions bypass, tools disabled, safe-mode enabled', async () => {
      let capturedArgs: string[] = [];
      let capturedOpts: SpawnOptions | undefined;
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, args, opts: SpawnOptions) => {
        capturedArgs = args;
        capturedOpts = opts;
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({ type: 'result', subtype: 'success', result: 'OK' }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new ClaudeCodeBrainProvider({ spawnFactory, model: 'sonnet' });
      for await (const _ of provider.chat(req('r2'))) {}

      // Hard Invariants verification
      expect(capturedArgs).not.toContain('--dangerously-skip-permissions');
      expect(capturedArgs).not.toContain('--allow-dangerously-skip-permissions');
      expect(capturedArgs).toContain('-p');
      expect(capturedArgs).toContain('--tools');
      const toolsIndex = capturedArgs.indexOf('--tools');
      expect(capturedArgs[toolsIndex + 1]).toBe('');
      expect(capturedArgs).toContain('--safe-mode');
      expect(capturedArgs).toContain('--disable-slash-commands');
      expect(capturedArgs).toContain('--strict-mcp-config');
      expect(capturedArgs).toContain('--output-format');
      expect(capturedArgs).toContain('stream-json');
      expect(capturedArgs).toContain('--include-partial-messages');
      expect(capturedArgs).toContain('--no-session-persistence');
      expect(capturedArgs).toContain('--verbose');
      expect(capturedArgs).toContain('--model');
      expect(capturedArgs).toContain('sonnet');

      // Stdio invariant: stdin must be 'ignore' to prevent 3s wait warning
      expect(capturedOpts?.stdio).toEqual(['ignore', 'pipe', 'pipe']);
      expect(capturedOpts?.shell).toBe(false);
    });
  });

  describe('Streaming Event Normalization & Execution', () => {
    it('normalizes stream-json deltas into started, delta, and completed events', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'system',
              subtype: 'init',
              model: 'claude-sonnet-5'
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              type: 'stream_event',
              event: {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: 'Hello' }
              }
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              type: 'stream_event',
              event: {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: ' world!' }
              }
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              type: 'stream_event',
              event: {
                type: 'message_delta',
                delta: { stop_reason: 'end_turn' },
                usage: { input_tokens: 15, output_tokens: 4 }
              }
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              type: 'result',
              subtype: 'success',
              result: 'Hello world!',
              usage: { input_tokens: 15, output_tokens: 4, total_tokens: 19 }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new ClaudeCodeBrainProvider({ spawnFactory });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-stream-1'))) {
        events.push(ev);
      }

      expect(events[0]).toMatchObject({
        type: 'started',
        requestId: 'req-stream-1',
        providerId: 'claude-code'
      });
      expect(events[1]).toEqual({
        type: 'delta',
        requestId: 'req-stream-1',
        text: 'Hello'
      });
      expect(events[2]).toEqual({
        type: 'delta',
        requestId: 'req-stream-1',
        text: ' world!'
      });
      expect(events[3]).toMatchObject({
        type: 'completed',
        requestId: 'req-stream-1',
        text: 'Hello world!',
        finishReason: 'end_turn',
        usage: { promptTokens: 15, completionTokens: 4, totalTokens: 19 }
      });
    });

    it('falls back to assistant message or result text if streaming deltas were not emitted', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'result',
              subtype: 'success',
              result: 'Direct result fallback'
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new ClaudeCodeBrainProvider({ spawnFactory });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-fallback-1'))) {
        events.push(ev);
      }

      expect(events.find((e) => e.type === 'delta')?.text).toBe('Direct result fallback');
      const completed = events.find((e) => e.type === 'completed');
      expect(completed?.text).toBe('Direct result fallback');
    });
  });

  describe('Quota & Error Handling', () => {
    it('normalizes rate_limit_event with status "rejected" to quota_limited error', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'rate_limit_event',
              rate_limit_info: {
                status: 'rejected',
                resetsAt: 1791976200,
                rateLimitType: 'five_hour'
              }
            }) + '\n'
          );
          mock.emitClose(1);
        });
        return mock.child;
      });

      const provider = new ClaudeCodeBrainProvider({ spawnFactory });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-quota-1'))) {
        events.push(ev);
      }

      const errorEv = events.find((e) => e.type === 'error');
      expect(errorEv).toBeDefined();
      expect(errorEv.error.code).toBe('quota_limited');
      expect(errorEv.error.message).toContain('quota limit reached');
      expect(mock.child.kill).toHaveBeenCalled();
    });

    it('normalizes unrecognized_model error to model_unavailable', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStderr('[claude-code:unrecognized_model] {"model":"invalid-model"}');
          mock.emitClose(1);
        });
        return mock.child;
      });

      const provider = new ClaudeCodeBrainProvider({ spawnFactory, model: 'invalid-model' });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-model-err'))) {
        events.push(ev);
      }

      const errorEv = events.find((e) => e.type === 'error');
      expect(errorEv).toBeDefined();
      expect(errorEv.error.code).toBe('model_unavailable');
    });

    it('terminates process immediately and yields security error if tool execution is attempted', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'stream_event',
              event: {
                type: 'content_block_start',
                content_block: { type: 'tool_use', name: 'Bash' }
              }
            }) + '\n'
          );
        });
        return mock.child;
      });

      const provider = new ClaudeCodeBrainProvider({ spawnFactory });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-tool-block'))) {
        events.push(ev);
      }

      expect(mock.child.kill).toHaveBeenCalled();
      const errorEv = events.find((e) => e.type === 'error');
      expect(errorEv).toBeDefined();
      expect(errorEv.error.message).toContain('Tool execution was attempted by Claude Code but is strictly prohibited');
    });
  });

  describe('Cancellation', () => {
    it('cancels immediately if AbortSignal is already aborted', async () => {
      const spawnFactory = vi.fn();
      const provider = new ClaudeCodeBrainProvider({ spawnFactory });

      const controller = new AbortController();
      controller.abort();

      const events: any[] = [];
      for await (const ev of provider.chat(req('req-pre-cancel'), { signal: controller.signal })) {
        events.push(ev);
      }

      expect(spawnFactory).not.toHaveBeenCalled();
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('cancelled');
      expect(events[0].requestId).toBe('req-pre-cancel');
      expect(events[0].reason).toContain('This operation was aborted');
    });

    it('terminates active process and yields cancelled event when cancel(requestId) is called', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => mock.child);

      const provider = new ClaudeCodeBrainProvider({ spawnFactory });

      const chatPromise = (async () => {
        const events: any[] = [];
        for await (const ev of provider.chat(req('req-mid-cancel'))) {
          events.push(ev);
          if (ev.type === 'started') {
            await provider.cancel('req-mid-cancel');
            mock.emitClose(null, 'SIGTERM');
          }
        }
        return events;
      })();

      const events = await chatPromise;
      expect(mock.child.kill).toHaveBeenCalled();
      const cancelled = events.find((e) => e.type === 'cancelled');
      expect(cancelled).toBeDefined();
    });
  });

  describe('Diagnostics & Prompt Utilities', () => {
    it('redacts credentials and file paths in diagnostics', () => {
      const text = 'Failed with token: sk-ant-secret at C:\\Users\\Jeffy\\code and /home/user/code';
      const redacted = redactDiagnosticText(text);

      expect(redacted).not.toContain('sk-ant-secret');
      expect(redacted).not.toContain('C:\\Users\\Jeffy\\code');
      expect(redacted).not.toContain('/home/user/code');
    });

    it('builds canonical conversation prompt strictly from BrainRequest', () => {
      const request: BrainRequest = {
        requestId: 'p1',
        sessionId: 's1',
        intent: 'conversation',
        systemPrompt: 'You are concise.',
        messages: [
          { role: 'user', content: 'What is 2+2?' },
          { role: 'assistant', content: '4' },
          { role: 'user', content: 'Double it.' }
        ]
      };

      const prompt = buildClaudeCodePrompt(request);
      expect(prompt).toContain(MAVE_CLAUDE_CONVERSATIONAL_INSTRUCTION);
      expect(prompt).toContain('System Context:\nYou are concise.');
      expect(prompt).toContain('User: What is 2+2?');
      expect(prompt).toContain('MAVE: 4');
      expect(prompt).toContain('User (current message): Double it.');
    });
  });
});
