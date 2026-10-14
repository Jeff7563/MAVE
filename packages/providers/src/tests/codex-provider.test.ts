import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { BrainRequest } from '@mave/contracts';
import {
  CodexBrainProvider,
  type SpawnFactory
} from '../brain/codex.js';
import {
  CODEX_PROVIDER_ID
} from '../brain/codex/models.js';
import {
  buildCodexPrompt,
  MAVE_CODEX_CONVERSATIONAL_INSTRUCTION
} from '../brain/codex/prompt.js';
import {
  classifyCodexError,
  mapCodexUsage,
  redactDiagnosticText
} from '../brain/codex/parser.js';

function createMockChildProcess(): {
  child: ChildProcess;
  stdinData: string;
  stdinEnded: boolean;
  emitStdout: (chunk: string) => void;
  emitStderr: (chunk: string) => void;
  emitClose: (code: number | null, signal?: NodeJS.Signals | null) => void;
  emitError: (err: Error) => void;
} {
  const child = new EventEmitter() as unknown as ChildProcess;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();

  let stdinData = '';
  let stdinEnded = false;

  stdin.on('data', (d) => {
    stdinData += d.toString();
  });
  stdin.on('end', () => {
    stdinEnded = true;
  });
  stdin.on('finish', () => {
    stdinEnded = true;
  });

  (child as any).stdout = stdout;
  (child as any).stderr = stderr;
  (child as any).stdin = stdin;
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
    get stdinData() {
      return stdinData;
    },
    get stdinEnded() {
      return stdinEnded;
    },
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

function req(id: string, text = 'Hello Codex'): BrainRequest {
  return {
    requestId: id,
    sessionId: 'sess-1',
    intent: 'conversation',
    messages: [{ role: 'user', content: text }]
  };
}

describe('CodexBrainProvider', () => {
  describe('Provider Identity & Capabilities', () => {
    it('declares canonical provider id "codex"', () => {
      const provider = new CodexBrainProvider();
      expect(provider.id).toBe(CODEX_PROVIDER_ID);
      expect(provider.id).toBe('codex');
    });

    it('declares agent_runtime_provider capabilities without faking model_provider', () => {
      const provider = new CodexBrainProvider();
      const caps = provider.getCapabilities();

      expect(caps.streaming).toBe(true);
      expect(caps.reasoning).toBe(true);
      expect(caps.coding).toBe(true);
      expect(caps.longContext).toBe(true);
      expect(caps.cancellation).toBe(true);
      // HARD INVARIANT: fastChat is false because Codex is an agent runtime, not a direct model_provider
      expect(caps.fastChat).toBe(false);
      // HARD INVARIANT: Pre-M5 tool execution is strictly blocked
      expect(caps.toolUse).toBe(false);
      expect(caps.local).toBe(false);
    });

    it('exposes runtime model descriptors', async () => {
      const provider = new CodexBrainProvider();
      const models = await provider.getRuntimeModels();

      expect(models.length).toBeGreaterThanOrEqual(1);
      const sol = models.find((m) => m.modelId.includes('sol'));
      expect(sol).toBeDefined();
      expect(sol?.supportedRoles).toContain('CODING');
    });
  });

  describe('Health Probing', () => {
    it('returns healthy when codex --version exits 0 and auth.json has chatgpt auth', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, _args, _opts) => {
        queueMicrotask(() => {
          mock.emitStdout('codex-cli 0.154.0\n');
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const health = await provider.health();

      // If user's ~/.codex/auth.json exists on disk, it reflects ChatGPT Auth
      if (fs.existsSync(path.join(os.homedir(), '.codex', 'auth.json'))) {
        expect(health.status).toBe('healthy');
        expect(health.message).toContain('OpenAI Codex CLI is ready');
      } else {
        expect(health.status).toBe('unconfigured');
      }
    });

    it('returns unconfigured when codex --version exits non-zero', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, _args, _opts) => {
        queueMicrotask(() => {
          mock.emitStderr('codex: command not found\n');
          mock.emitClose(127);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const health = await provider.health();

      expect(health.status).toBe('unconfigured');
      expect(health.message).toContain('unavailable');
    });

    it('returns unconfigured when process spawn throws (ENOENT)', async () => {
      const spawnFactory: SpawnFactory = vi.fn(() => {
        throw new Error('ENOENT spawn codex');
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const health = await provider.health();

      expect(health.status).toBe('unconfigured');
      expect(health.message).toContain('ENOENT spawn codex');
    });
  });

  describe('Subscription Billing Safety & Spawn Guardrails', () => {
    it('explicitly removes OPENAI_API_KEY and related billing variables from child environment', async () => {
      let capturedEnv: NodeJS.ProcessEnv | undefined;
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, _args, opts: SpawnOptions) => {
        capturedEnv = opts.env;
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'item.completed',
              item: { id: 'item_1', type: 'agent_message', text: 'Hello!' }
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              type: 'turn.completed',
              usage: { input_tokens: 10, output_tokens: 5 }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      // Temporarily set metered billing variables in parent env
      process.env['OPENAI_API_KEY'] = 'sk-proj-metered-secret-key';
      process.env['OPENAI_KEY'] = 'sk-metered-key';
      process.env['OPENAI_BASE_URL'] = 'https://api.openai.com/v1';
      process.env['OPENAI_ORG_ID'] = 'org-12345';
      process.env['OPENAI_PROJECT_ID'] = 'proj-12345';
      process.env['CODEX_API_KEY'] = 'codex-key-123';

      try {
        const provider = new CodexBrainProvider({ spawnFactory });
        const events: any[] = [];
        for await (const ev of provider.chat(req('r1'))) {
          events.push(ev);
        }

        // Child process environment must NOT contain any OpenAI billing variables
        expect(capturedEnv).toBeDefined();
        expect(capturedEnv?.['OPENAI_API_KEY']).toBeUndefined();
        expect(capturedEnv?.['OPENAI_KEY']).toBeUndefined();
        expect(capturedEnv?.['OPENAI_BASE_URL']).toBeUndefined();
        expect(capturedEnv?.['OPENAI_ORG_ID']).toBeUndefined();
        expect(capturedEnv?.['OPENAI_PROJECT_ID']).toBeUndefined();
        expect(capturedEnv?.['CODEX_API_KEY']).toBeUndefined();

        // Global parent process environment must remain untouched
        expect(process.env['OPENAI_API_KEY']).toBe('sk-proj-metered-secret-key');
      } finally {
        delete process.env['OPENAI_API_KEY'];
        delete process.env['OPENAI_KEY'];
        delete process.env['OPENAI_BASE_URL'];
        delete process.env['OPENAI_ORG_ID'];
        delete process.env['OPENAI_PROJECT_ID'];
        delete process.env['CODEX_API_KEY'];
      }
    });

    it('enforces safe headless arguments and non-interactive stdin pipe', async () => {
      let capturedArgs: string[] = [];
      let capturedOpts: SpawnOptions | undefined;
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, args, opts: SpawnOptions) => {
        capturedArgs = args;
        capturedOpts = opts;
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'item.completed',
              item: { id: 'item_1', type: 'agent_message', text: 'OK' }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      for await (const _ of provider.chat(req('r2', 'Test prompt text'))) {}

      // Hard Invariants verification
      expect(capturedArgs).not.toContain('--dangerously-bypass-approvals-and-sandbox');
      expect(capturedArgs).not.toContain('--dangerously-bypass-hook-trust');
      expect(capturedArgs).toContain('exec');
      expect(capturedArgs).toContain('--json');
      expect(capturedArgs).toContain('--ephemeral');
      expect(capturedArgs).toContain('--sandbox');
      const sandboxIndex = capturedArgs.indexOf('--sandbox');
      expect(capturedArgs[sandboxIndex + 1]).toBe('read-only');
      expect(capturedArgs).toContain('--skip-git-repo-check');
      expect(capturedArgs[capturedArgs.length - 1]).toBe('-'); // Stdin pipe

      // Stdio invariant: stdin must be 'pipe' and prompt written to it
      expect(capturedOpts?.stdio).toEqual(['pipe', 'pipe', 'pipe']);
      expect(capturedOpts?.shell).toBe(false);
      expect(mock.stdinData).toContain('Test prompt text');
      expect((mock.child.stdin as PassThrough).writableEnded).toBe(true);
    });
  });

  describe('Model Handoff & Concurrency Safety', () => {
    it('passes options.modelId as -m flag', async () => {
      let capturedArgs: string[] = [];
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, args) => {
        capturedArgs = args;
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'item.completed',
              item: { id: 'item_1', type: 'agent_message', text: 'Answer' }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      for await (const _ of provider.chat(req('r-model'), { modelId: 'gpt-6.1-sol' })) {}

      expect(capturedArgs).toContain('-m');
      const mIdx = capturedArgs.indexOf('-m');
      expect(capturedArgs[mIdx + 1]).toBe('gpt-6.1-sol');
    });

    it('strictly ignores request.overrides.preferredModelId in provider', async () => {
      let capturedArgs: string[] = [];
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, args) => {
        capturedArgs = args;
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'item.completed',
              item: { id: 'item_1', type: 'agent_message', text: 'Answer' }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const requestWithOverride: BrainRequest = {
        ...req('r-override'),
        overrides: { preferredModelId: 'gpt-6-luna', localOnly: false }
      };

      for await (const _ of provider.chat(requestWithOverride)) {}

      // Must NOT contain preferredModelId if options.modelId was not passed
      expect(capturedArgs).not.toContain('gpt-6-luna');
      expect(capturedArgs).not.toContain('-m');
    });

    it('falls back to configured default model only when options.modelId is omitted', async () => {
      let capturedArgs: string[] = [];
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, args) => {
        capturedArgs = args;
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'item.completed',
              item: { id: 'item_1', type: 'agent_message', text: 'Answer' }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory, model: 'gpt-5.6-sol' });
      for await (const _ of provider.chat(req('r-default'))) {}

      expect(capturedArgs).toContain('-m');
      const mIdx = capturedArgs.indexOf('-m');
      expect(capturedArgs[mIdx + 1]).toBe('gpt-5.6-sol');
    });

    it('supports concurrent invocations with different models without shared mutable state', async () => {
      const capturedModels: string[] = [];
      const spawnFactory: SpawnFactory = vi.fn((_cmd, args) => {
        const mock = createMockChildProcess();
        const mIdx = args.indexOf('-m');
        if (mIdx !== -1) {
          capturedModels.push(args[mIdx + 1]);
        }
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'item.completed',
              item: { id: 'item_1', type: 'agent_message', text: 'OK' }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const task1 = (async () => {
        for await (const _ of provider.chat(req('req-1'), { modelId: 'gpt-5.6-sol' })) {}
      })();
      const task2 = (async () => {
        for await (const _ of provider.chat(req('req-2'), { modelId: 'gpt-6-luna' })) {}
      })();
      const task3 = (async () => {
        for await (const _ of provider.chat(req('req-3'), { modelId: 'gpt-6.1-sol' })) {}
      })();

      await Promise.all([task1, task2, task3]);
      expect(capturedModels).toHaveLength(3);
      expect(capturedModels).toContain('gpt-5.6-sol');
      expect(capturedModels).toContain('gpt-6-luna');
      expect(capturedModels).toContain('gpt-6.1-sol');
    });
  });

  describe('Streaming Event Normalization & Execution', () => {
    it('normalizes NDJSON events into started, delta, and completed events with usage', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'thread.started',
              thread_id: 'thread-123'
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              type: 'turn.started'
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              type: 'item.completed',
              item: { id: 'item_1', type: 'agent_message', text: 'Hello, ' }
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              type: 'item.completed',
              item: { id: 'item_2', type: 'agent_message', text: 'world!' }
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              type: 'turn.completed',
              usage: { input_tokens: 200, output_tokens: 15 }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-stream-1'), { modelId: 'gpt-5.6-sol' })) {
        events.push(ev);
      }

      expect(events[0]).toMatchObject({
        type: 'started',
        requestId: 'req-stream-1',
        providerId: 'codex',
        modelId: 'gpt-5.6-sol'
      });
      expect(events[1]).toEqual({
        type: 'delta',
        requestId: 'req-stream-1',
        text: 'Hello, '
      });
      expect(events[2]).toEqual({
        type: 'delta',
        requestId: 'req-stream-1',
        text: 'world!'
      });
      expect(events[3]).toMatchObject({
        type: 'completed',
        requestId: 'req-stream-1',
        text: 'Hello, world!',
        finishReason: 'end_turn',
        usage: { promptTokens: 200, completionTokens: 15, totalTokens: 215 }
      });
    });

    it('normalizes item.delta streaming chunks if emitted', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'item.delta',
              delta: { text: 'Streamed chunk 1 ' }
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              type: 'item.delta',
              delta: { text: 'chunk 2' }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-stream-delta'))) {
        events.push(ev);
      }

      const deltas = events.filter((e) => e.type === 'delta');
      expect(deltas).toHaveLength(2);
      expect(deltas[0].text).toBe('Streamed chunk 1 ');
      expect(deltas[1].text).toBe('chunk 2');
      const completed = events.find((e) => e.type === 'completed');
      expect(completed?.text).toBe('Streamed chunk 1 chunk 2');
    });
  });

  describe('Pre-M5 Tool Execution Suppression Guardrail', () => {
    it('terminates process immediately and yields security error if tool execution is attempted', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'item.completed',
              item: { id: 'item_cmd', type: 'command_execution', command: 'ls -la' }
            }) + '\n'
          );
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-tool-block'))) {
        events.push(ev);
      }

      expect(mock.child.kill).toHaveBeenCalled();
      const errorEv = events.find((e) => e.type === 'error');
      expect(errorEv).toBeDefined();
      expect(errorEv.error.code).toBe('provider_unavailable');
      expect(errorEv.error.message).toContain('Tool execution was attempted by OpenAI Codex but is strictly prohibited');
    });

    it('terminates process on file_change tool attempt', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'item.completed',
              item: { id: 'item_file', type: 'file_change', path: 'test.txt' }
            }) + '\n'
          );
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-file-block'))) {
        events.push(ev);
      }

      expect(mock.child.kill).toHaveBeenCalled();
      const errorEv = events.find((e) => e.type === 'error');
      expect(errorEv).toBeDefined();
      expect(errorEv.error.code).toBe('provider_unavailable');
    });
  });

  describe('Quota & Error Handling', () => {
    it('normalizes turn.failed with quota/rate limit error to quota_limited', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'turn.failed',
              error: { message: 'You have reached your usage limit. Try again in 2 hours.' }
            }) + '\n'
          );
          mock.emitClose(1);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-quota-1'))) {
        events.push(ev);
      }

      const errorEv = events.find((e) => e.type === 'error');
      expect(errorEv).toBeDefined();
      expect(errorEv.error.code).toBe('quota_limited');
      expect(errorEv.error.message).toContain('usage limit');
    });

    it('normalizes unsupported model error to model_unavailable', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              type: 'error',
              message: "The 'gpt-x' model is not supported when using Codex with a ChatGPT account."
            }) + '\n'
          );
          mock.emitClose(1);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-model-err'), { modelId: 'gpt-x' })) {
        events.push(ev);
      }

      const errorEv = events.find((e) => e.type === 'error');
      expect(errorEv).toBeDefined();
      expect(errorEv.error.code).toBe('model_unavailable');
    });

    it('normalizes auth failure to auth_required', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStderr('Unauthorized: Stored ChatGPT tokens: false. Please run `codex login`\n');
          mock.emitClose(1);
        });
        return mock.child;
      });

      const provider = new CodexBrainProvider({ spawnFactory });
      const events: any[] = [];
      for await (const ev of provider.chat(req('req-auth-err'))) {
        events.push(ev);
      }

      const errorEv = events.find((e) => e.type === 'error');
      expect(errorEv).toBeDefined();
      expect(errorEv.error.code).toBe('auth_required');
    });
  });

  describe('Cancellation', () => {
    it('cancels immediately if AbortSignal is already aborted', async () => {
      const spawnFactory = vi.fn();
      const provider = new CodexBrainProvider({ spawnFactory });

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
    });

    it('terminates active process and yields cancelled event when cancel(requestId) is called', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => mock.child);

      const provider = new CodexBrainProvider({ spawnFactory });

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

  describe('Prompt Builder & Diagnostic Utilities', () => {
    it('builds canonical conversation prompt strictly from BrainRequest', () => {
      const request: BrainRequest = {
        requestId: 'p1',
        sessionId: 's1',
        intent: 'conversation',
        systemPrompt: 'You are concise.',
        messages: [
          { role: 'user', content: 'What is 5+5?' },
          { role: 'assistant', content: '10' },
          { role: 'user', content: 'Add 2.' }
        ]
      };

      const prompt = buildCodexPrompt(request);
      expect(prompt).toContain(MAVE_CODEX_CONVERSATIONAL_INSTRUCTION);
      expect(prompt).toContain('System Context:\nYou are concise.');
      expect(prompt).toContain('User: What is 5+5?');
      expect(prompt).toContain('MAVE: 10');
      expect(prompt).toContain('User (current message): Add 2.');
    });

    it('redacts credentials and file paths in diagnostics', () => {
      const text = 'Failed with token: sk-proj-secret at C:\\Users\\Jeffy\\code and /home/user/code';
      const redacted = redactDiagnosticText(text);

      expect(redacted).not.toContain('sk-proj-secret');
      expect(redacted).not.toContain('C:\\Users\\Jeffy\\code');
      expect(redacted).not.toContain('/home/user/code');
    });

    it('maps usage correctly', () => {
      expect(mapCodexUsage()).toBeUndefined();
      expect(mapCodexUsage({ input_tokens: 100, output_tokens: 50 })).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      });
    });

    it('classifies errors accurately', () => {
      expect(classifyCodexError('rate limit exceeded')).toBe('quota_limited');
      expect(classifyCodexError('plan limit reached (429)')).toBe('quota_limited');
      expect(classifyCodexError('model not found')).toBe('model_unavailable');
      expect(classifyCodexError('unauthorized login required')).toBe('auth_required');
      expect(classifyCodexError('operation timed out')).toBe('provider_timeout');
      expect(classifyCodexError('abort sigterm')).toBe('generation_cancelled');
      expect(classifyCodexError('unknown generic error')).toBe('provider_unavailable');
    });
  });
});
