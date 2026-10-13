import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import type { BrainRequest } from '@mave/contracts';
import {
  AntigravityBrainProvider,
  type SpawnFactory
} from '../brain/antigravity.js';
import {
  buildAntigravityPrompt,
  MAVE_CONVERSATIONAL_INSTRUCTION
} from '../brain/antigravity/prompt.js';
import {
  classifyAntigravityError,
  mapAntigravityUsage,
  redactDiagnosticText
} from '../brain/antigravity/parser.js';

function createMockChildProcess(): {
  child: ChildProcess;
  emitStdout: (chunk: string) => void;
  emitStderr: (chunk: string) => void;
  emitClose: (code: number | null, signal?: NodeJS.Signals | null) => void;
  emitError: (err: Error) => void;
  getStdinData: () => string;
} {
  const child = new EventEmitter() as unknown as ChildProcess;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();

  let stdinData = '';
  stdin.on('data', (d) => {
    stdinData += d.toString();
  });

  (child as any).stdout = stdout;
  (child as any).stderr = stderr;
  (child as any).stdin = stdin;
  (child as any).killed = false;
  (child as any).kill = vi.fn(() => {
    (child as any).killed = true;
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
    emitError: (err: Error) => child.emit('error', err),
    getStdinData: () => stdinData
  };
}

function req(id: string, text = 'Hello'): BrainRequest {
  return {
    requestId: id,
    sessionId: 'sess-1',
    intent: 'conversation',
    messages: [{ role: 'user', content: text }]
  };
}

describe('AntigravityBrainProvider', () => {
  describe('Metadata and Capabilities', () => {
    it('has id "antigravity"', () => {
      const provider = new AntigravityBrainProvider({ cwd: 'C:\\fake\\workspace' });
      expect(provider.id).toBe('antigravity');
    });

    it('declares streaming and fastChat capabilities, disallowing tools and coding in M2', () => {
      const provider = new AntigravityBrainProvider({ cwd: 'C:\\fake\\workspace' });
      const caps = provider.getCapabilities();

      expect(caps.streaming).toBe(true);
      expect(caps.fastChat).toBe(true);
      expect(caps.toolUse).toBe(false);
      expect(caps.coding).toBe(false);
      expect(caps.reasoning).toBe(false);
      expect(caps.multimodal).toBe(false);
      expect(caps.local).toBe(false);
    });
  });

  describe('Health Checks', () => {
    it('returns healthy when agy --version exits with code 0', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn((_cmd, _args, _opts) => {
        queueMicrotask(() => {
          mock.emitStdout('1.3.4\n');
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const health = await provider.health();
      expect(health.status).toBe('healthy');
      expect(health.message).toContain('1.3.4');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(spawnFactory).toHaveBeenCalledWith(
        'agy',
        ['--version'],
        expect.objectContaining({ shell: false })
      );
    });

    it('returns unconfigured when agy --version exits with non-zero code', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStderr('Command not recognized\n');
          mock.emitClose(1);
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const health = await provider.health();
      expect(health.status).toBe('unconfigured');
      expect(health.message).toContain('Command not recognized');
    });

    it('returns unconfigured when child process emits spawn error (ENOENT)', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitError(new Error('spawn agy ENOENT'));
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const health = await provider.health();
      expect(health.status).toBe('unconfigured');
      expect(health.message).toContain('ENOENT');
    });

    it('returns unconfigured when health check times out after 3000ms', async () => {
      vi.useFakeTimers();
      try {
        const mock = createMockChildProcess();
        const spawnFactory: SpawnFactory = vi.fn(() => mock.child);

        const provider = new AntigravityBrainProvider({
          cwd: 'C:\\fake\\workspace',
          spawnFactory
        });

        const healthPromise = provider.health();
        vi.advanceTimersByTime(3100);

        const health = await healthPromise;
        expect(health.status).toBe('unconfigured');
        expect(health.message).toContain('timed out after 3000ms');
        expect(mock.child.kill).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Prompt Construction & Formatting', () => {
    it('builds prompt including system prompt, instructions, and user message', () => {
      const request: BrainRequest = {
        requestId: 'req-1',
        sessionId: 'sess-1',
        intent: 'conversation',
        messages: [{ role: 'user', content: 'Hello MAVE!' }],
        systemPrompt: 'You are MAVE voice assistant.'
      };

      const prompt = buildAntigravityPrompt(request);
      expect(prompt).toContain('You are MAVE voice assistant.');
      expect(prompt).toContain(MAVE_CONVERSATIONAL_INSTRUCTION);
      expect(prompt).toContain('User (current message): Hello MAVE!');
    });

    it('includes previous conversation turns chronologically', () => {
      const request: BrainRequest = {
        requestId: 'req-2',
        sessionId: 'sess-1',
        intent: 'conversation',
        messages: [
          { role: 'user', content: 'What is the weather today?' },
          { role: 'assistant', content: 'It is sunny and 72 degrees.' },
          { role: 'user', content: 'What was my previous question?' }
        ]
      };

      const prompt = buildAntigravityPrompt(request);
      expect(prompt).toContain('Conversation History:');
      expect(prompt).toContain('User: What is the weather today?');
      expect(prompt).toContain('MAVE: It is sunny and 72 degrees.');
      expect(prompt).toContain('User (current message): What was my previous question?');
    });
  });

  describe('Parser, Error Classification & Redaction', () => {
    it('classifies quota and rate limit errors as provider_limit', () => {
      expect(classifyAntigravityError('Resource has been exhausted (e.g. check quota).')).toBe('provider_limit');
      expect(classifyAntigravityError('Rate limit exceeded: 429 Too Many Requests')).toBe('provider_limit');
      expect(classifyAntigravityError('Daily credit quota reached')).toBe('provider_limit');
    });

    it('classifies auth errors as provider_auth', () => {
      expect(classifyAntigravityError('User not logged in. Please run agy auth login')).toBe('provider_auth');
      expect(classifyAntigravityError('Unauthorized: 401 Invalid credentials')).toBe('provider_auth');
      expect(classifyAntigravityError('Authentication session expired')).toBe('provider_auth');
    });

    it('classifies context overflow errors as provider_limit', () => {
      expect(classifyAntigravityError('Context window exceeded maximum tokens: 128000')).toBe('provider_limit');
      expect(classifyAntigravityError('Prompt is too large for the model')).toBe('provider_limit');
    });

    it('classifies network errors as provider_unavailable and timeouts as provider_timeout', () => {
      expect(classifyAntigravityError('ECONNREFUSED 127.0.0.1:443')).toBe('provider_unavailable');
      expect(classifyAntigravityError('Network connection timed out')).toBe('provider_timeout');
      expect(classifyAntigravityError('Service unavailable: 503 Bad Gateway')).toBe('provider_unavailable');
    });

    it('redacts sensitive file paths and auth tokens in diagnostics', () => {
      const sensitive = 'Failed at C:\\Users\\Administrator\\.antigravity\\auth.json with Bearer ya29.a0AfH6SM...';
      const redacted = redactDiagnosticText(sensitive);
      expect(redacted).not.toContain('Administrator');
      expect(redacted).not.toContain('ya29.a0AfH6SM');
      expect(redacted).toContain('<path>');
      expect(redacted).toContain('Bearer [REDACTED]');
    });

    it('maps Antigravity usage counters correctly', () => {
      const usage = mapAntigravityUsage({
        input_tokens: 150,
        output_tokens: 45,
        total_tokens: 195
      });
      expect(usage).toEqual({
        promptTokens: 150,
        completionTokens: 45,
        totalTokens: 195
      });
    });
  });

  describe('Security & Environment Isolation', () => {
    it('spawns with shell: false, sandbox flag, and strips GEMINI_API_KEY from environment', async () => {
      const prevApiKey = process.env['GEMINI_API_KEY'];
      const prevBaseUrl = process.env['GOOGLE_GEMINI_BASE_URL'];
      process.env['GEMINI_API_KEY'] = 'secret-leaked-key';
      process.env['GOOGLE_GEMINI_BASE_URL'] = 'https://custom-billing.example.com';

      try {
        const mock = createMockChildProcess();
        let capturedOpts: SpawnOptions | undefined = undefined;
        let capturedArgs: string[] = [];

        const spawnFactory: SpawnFactory = vi.fn((_cmd, args, opts) => {
          capturedArgs = args;
          capturedOpts = opts;
          queueMicrotask(() => {
            mock.emitStdout(JSON.stringify({ event: 'init', init: {} }) + '\n');
            mock.emitStdout(
              JSON.stringify({
                event: 'result',
                result: { status: 'SUCCESS', response: 'Hi there!' }
              }) + '\n'
            );
            mock.emitClose(0);
          });
          return mock.child;
        });

        const provider = new AntigravityBrainProvider({
          cwd: 'C:\\isolated\\workspace',
          spawnFactory
        });

        const events = [];
        for await (const event of provider.chat(req('req-sec-1', 'Hello'))) {
          events.push(event);
        }

        expect(capturedOpts).toBeDefined();
        expect(capturedOpts!.shell).toBe(false);
        expect(capturedOpts!.cwd).toBe('C:\\isolated\\workspace');
        expect(capturedOpts!.env?.['GEMINI_API_KEY']).toBeUndefined();
        expect(capturedOpts!.env?.['GOOGLE_GEMINI_BASE_URL']).toBeUndefined();

        expect(capturedArgs).toContain('--sandbox');
        expect(capturedArgs).toContain('--disable-slash-commands');
        expect(capturedArgs).toContain('--input-format');
        expect(capturedArgs).toContain('stream-json');
        expect(capturedArgs).toContain('--output-format');
        expect(capturedArgs).toContain('stream-json');
      } finally {
        if (prevApiKey !== undefined) process.env['GEMINI_API_KEY'] = prevApiKey;
        else delete process.env['GEMINI_API_KEY'];
        if (prevBaseUrl !== undefined) process.env['GOOGLE_GEMINI_BASE_URL'] = prevBaseUrl;
        else delete process.env['GOOGLE_GEMINI_BASE_URL'];
      }
    });
  });

  describe('Chat Streaming Execution', () => {
    it('happy path: emits started, deltas, and completed with usage', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(JSON.stringify({ event: 'init', init: { cwd: 'C:\\ws' } }) + '\n');
          mock.emitStdout(
            JSON.stringify({
              event: 'step_update',
              step_update: { step_type: 'agent_response', text_delta: 'Hello ' }
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              event: 'step_update',
              step_update: { step_type: 'agent_response', text_delta: 'from ' }
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              event: 'step_update',
              step_update: { step_type: 'agent_response', text_delta: 'Antigravity!' }
            }) + '\n'
          );
          mock.emitStdout(
            JSON.stringify({
              event: 'result',
              result: {
                status: 'SUCCESS',
                response: 'Hello from Antigravity!',
                usage: { input_tokens: 20, output_tokens: 5, total_tokens: 25 }
              }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const events = [];
      for await (const evt of provider.chat(req('req-happy', 'Hello'))) {
        events.push(evt);
      }

      expect(events[0]).toMatchObject({
        type: 'started',
        requestId: 'req-happy',
        providerId: 'antigravity'
      });

      const deltas = events.filter((e) => e.type === 'delta');
      expect(deltas).toHaveLength(3);
      expect((deltas[0] as any).text).toBe('Hello ');
      expect((deltas[1] as any).text).toBe('from ');
      expect((deltas[2] as any).text).toBe('Antigravity!');

      const completed = events.find((e) => e.type === 'completed') as any;
      expect(completed).toBeDefined();
      expect(completed.text).toBe('Hello from Antigravity!');
      expect(completed.usage).toEqual({
        promptTokens: 20,
        completionTokens: 5,
        totalTokens: 25
      });
      expect(completed.finishReason).toBe('stop');

      // Check stdin input sent to CLI
      const stdinContent = mock.getStdinData();
      expect(stdinContent).toContain('"event":"user"');
      expect(stdinContent).toContain('Hello');
    });

    it('falls back to result.response if no step_updates were received', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              event: 'result',
              result: {
                status: 'SUCCESS',
                response: 'Direct response without deltas',
                usage: { input_tokens: 10, output_tokens: 4 }
              }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const events = [];
      for await (const evt of provider.chat(req('req-fallback', 'Quick prompt'))) {
        events.push(evt);
      }

      const completed = events.find((e) => e.type === 'completed') as any;
      expect(completed).toBeDefined();
      expect(completed.text).toBe('Direct response without deltas');
    });

    it('strictly blocks tool execution: kills process and yields provider_invalid_response error', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              event: 'step_update',
              step_update: { step_type: 'tool', tool_name: 'view_file' }
            }) + '\n'
          );
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const events = [];
      for await (const evt of provider.chat(req('req-tool-block', 'Read my files'))) {
        events.push(evt);
      }

      expect(mock.child.kill).toHaveBeenCalled();

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent).toBeDefined();
      expect(errorEvent.error.code).toBe('provider_invalid_response');
      expect(errorEvent.error.message).toContain('Antigravity attempted tool use during conversation-only mode.');
      expect(errorEvent.error.retryable).toBe(false);
    });

    it('handles malformed NDJSON lines: kills child and yields provider_invalid_response', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout('NOT VALID JSON LINE\n');
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const events = [];
      for await (const evt of provider.chat(req('req-malformed', 'Test'))) {
        events.push(evt);
      }

      expect(mock.child.kill).toHaveBeenCalled();
      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent).toBeDefined();
      expect(errorEvent.error.code).toBe('provider_invalid_response');
      expect(errorEvent.error.message).toContain('Malformed NDJSON output');
    });

    it('handles result.status === "ERROR" with classified error code', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              event: 'result',
              result: {
                status: 'ERROR',
                error: { message: 'Quota exceeded for current billing project' }
              }
            }) + '\n'
          );
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const events = [];
      for await (const evt of provider.chat(req('req-quota-err', 'Hello'))) {
        events.push(evt);
      }

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent).toBeDefined();
      expect(errorEvent.error.code).toBe('provider_limit');
      expect(errorEvent.error.message).toContain('Quota exceeded');
      expect(errorEvent.error.retryable).toBe(true);
    });

    it('handles non-zero exit code with stderr diagnostics', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStderr('Unauthorized: Please authenticate with agy auth login\n');
          mock.emitClose(1);
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const events = [];
      for await (const evt of provider.chat(req('req-auth-fail', 'Hello'))) {
        events.push(evt);
      }

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent).toBeDefined();
      expect(errorEvent.error.code).toBe('provider_auth');
      expect(errorEvent.error.message).toContain('Unauthorized');
    });

    it('handles zero exit code without any output as provider_invalid_response', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const events = [];
      for await (const evt of provider.chat(req('req-empty-exit', 'Hello'))) {
        events.push(evt);
      }

      const errorEvent = events.find((e) => e.type === 'error') as any;
      expect(errorEvent).toBeDefined();
      expect(errorEvent.error.code).toBe('provider_invalid_response');
      expect(errorEvent.error.message).toContain('terminated without generating a response');
    });
  });

  describe('Cancellation and AbortSignal Handling', () => {
    it('returns cancelled immediately if signal is pre-aborted without spawning', async () => {
      const spawnFactory: SpawnFactory = vi.fn();
      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const abortController = new AbortController();
      abortController.abort('Pre-aborted test');

      const events = [];
      for await (const evt of provider.chat(
        req('req-pre-abort', 'Hi'),
        { signal: abortController.signal }
      )) {
        events.push(evt);
      }

      expect(spawnFactory).not.toHaveBeenCalled();
      expect(events).toEqual([
        {
          type: 'cancelled',
          requestId: 'req-pre-abort',
          reason: 'Pre-aborted test'
        }
      ]);
    });

    it('kills child process and yields cancelled when AbortSignal triggers mid-stream', async () => {
      const mock = createMockChildProcess();
      const abortController = new AbortController();

      const spawnFactory: SpawnFactory = vi.fn(() => {
        queueMicrotask(() => {
          mock.emitStdout(
            JSON.stringify({
              event: 'step_update',
              step_update: { step_type: 'agent_response', text_delta: 'First delta' }
            }) + '\n'
          );
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const events = [];
      for await (const evt of provider.chat(
        req('req-abort-mid', 'Hi'),
        { signal: abortController.signal }
      )) {
        events.push(evt);
        if (evt.type === 'delta') {
          abortController.abort('User clicked cancel');
        }
      }

      expect(mock.child.kill).toHaveBeenCalled();
      const cancelledEvent = events.find((e) => e.type === 'cancelled') as any;
      expect(cancelledEvent).toBeDefined();
      expect(cancelledEvent.reason).toBe('User clicked cancel');
    });

    it('kills active process via explicit cancel(requestId) method', async () => {
      const mock = createMockChildProcess();
      const spawnFactory: SpawnFactory = vi.fn(() => mock.child);

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      // Start stream
      const iterator = provider.chat(req('req-explicit-cancel', 'Hi'))[Symbol.asyncIterator]();

      // Advance to started
      await iterator.next();

      // Explicitly cancel
      await provider.cancel('req-explicit-cancel');

      expect(mock.child.kill).toHaveBeenCalled();
    });
  });
});
