import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import {
  BrainProviderRegistry,
  BrainRouter,
  ContextManager,
  ConversationRuntime,
  SessionManager
} from '@mave/core';
import { createMaveDatabase, SQLiteConversationStore, type MaveDatabase } from '@mave/database';
import { AntigravityBrainProvider, MockBrainProvider, type SpawnFactory } from '@mave/providers';
import type { ConversationRuntimeEvent } from '@mave/contracts';

function createMockChildProcess(): {
  child: ChildProcess;
  emitStdout: (chunk: string) => void;
  emitStderr: (chunk: string) => void;
  emitClose: (code: number | null, signal?: NodeJS.Signals | null) => void;
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
    emitStdout: (chunk: string) => {
      if (!stdout.writableEnded) {
        stdout.write(chunk);
      }
    },
    emitStderr: (chunk: string) => {
      if (!stderr.writableEnded) {
        stderr.write(chunk);
      }
    },
    emitClose: (code: number | null, signal: NodeJS.Signals | null = null) => {
      if (!stdout.writableEnded) stdout.end();
      if (!stderr.writableEnded) stderr.end();
      child.emit('close', code, signal);
    },
    getStdinData: () => stdinData
  };
}

describe('Antigravity Integration Pipeline', () => {
  let db: MaveDatabase;
  let store: SQLiteConversationStore;
  let providerRegistry: BrainProviderRegistry;
  let mockProvider: MockBrainProvider;
  let sessionManager: SessionManager;
  let contextManager: ContextManager;

  beforeEach(async () => {
    db = await createMaveDatabase(':memory:');
    store = new SQLiteConversationStore(db);
    providerRegistry = new BrainProviderRegistry();
    mockProvider = new MockBrainProvider();
    providerRegistry.register(mockProvider);
    sessionManager = new SessionManager();
    contextManager = new ContextManager();
  });

  it('orchestrates end-to-end streaming with AntigravityBrainProvider and persists to SQLite', async () => {
    const mockProc = createMockChildProcess();
    const spawnFactory: SpawnFactory = vi.fn((_cmd, args) => {
      if (args.includes('--version')) {
        const versionProc = createMockChildProcess();
        queueMicrotask(() => {
          versionProc.emitStdout('1.3.4\n');
          versionProc.emitClose(0);
        });
        return versionProc.child;
      }

      queueMicrotask(() => {
        mockProc.emitStdout(JSON.stringify({ event: 'init', init: {} }) + '\n');
        mockProc.emitStdout(
          JSON.stringify({
            event: 'step_update',
            step_update: { step_type: 'agent_response', text_delta: 'Greetings ' }
          }) + '\n'
        );
        mockProc.emitStdout(
          JSON.stringify({
            event: 'step_update',
            step_update: { step_type: 'agent_response', text_delta: 'from Google Antigravity!' }
          }) + '\n'
        );
        mockProc.emitStdout(
          JSON.stringify({
            event: 'result',
            result: {
              status: 'SUCCESS',
              response: 'Greetings from Google Antigravity!',
              usage: { input_tokens: 30, output_tokens: 8, total_tokens: 38 }
            }
          }) + '\n'
        );
        mockProc.emitClose(0);
      });
      return mockProc.child;
    });

    const antigravityProvider = new AntigravityBrainProvider({
      cwd: 'C:\\fake\\workspace',
      spawnFactory
    });
    providerRegistry.register(antigravityProvider);

    const router = new BrainRouter({
      registry: providerRegistry,
      defaultProvider: 'mock'
    });

    const runtime = new ConversationRuntime({
      sessionManager,
      contextManager,
      router,
      store
    });

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({
      requestId: 'req-integ-1',
      message: 'Hello Antigravity Brain',
      preferredProviderId: 'antigravity'
    })) {
      events.push(event);
    }

    // 1. Verify runtime event sequence
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('request_started');
    expect(eventTypes).toContain('session_ready');
    expect(eventTypes).toContain('provider_selected');
    expect(eventTypes).toContain('response_started');
    expect(eventTypes).toContain('response_delta');
    expect(eventTypes).toContain('response_completed');

    const providerEvent = events.find((e) => e.type === 'provider_selected') as any;
    expect(providerEvent.providerId).toBe('antigravity');

    const completedEvent = events.find((e) => e.type === 'response_completed') as any;
    expect(completedEvent.text).toBe('Greetings from Google Antigravity!');
    expect(completedEvent.usage).toEqual({
      promptTokens: 30,
      completionTokens: 8,
      totalTokens: 38
    });

    // 2. Verify persistence in SQLite
    const session = await store.getSession(completedEvent.sessionId);
    expect(session).not.toBeNull();
    expect(session?.activeProviderId).toBe('antigravity');

    const turns = await store.getTurns(completedEvent.sessionId);
    expect(turns).toHaveLength(2);

    const userTurn = turns.find((t) => t.role === 'user');
    expect(userTurn?.content).toBe('Hello Antigravity Brain');
    expect(userTurn?.status).toBe('completed');

    const assistantTurn = turns.find((t) => t.role === 'assistant');
    expect(assistantTurn?.content).toBe('Greetings from Google Antigravity!');
    expect(assistantTurn?.providerId).toBe('antigravity');
    expect(assistantTurn?.status).toBe('completed');
  });

  it('persists failed turn when Antigravity attempts tool execution', async () => {
    const mockProc = createMockChildProcess();
    const spawnFactory: SpawnFactory = vi.fn((_cmd, args) => {
      if (args.includes('--version')) {
        const versionProc = createMockChildProcess();
        queueMicrotask(() => {
          versionProc.emitStdout('1.3.4\n');
          versionProc.emitClose(0);
        });
        return versionProc.child;
      }

      queueMicrotask(() => {
        mockProc.emitStdout(
          JSON.stringify({
            event: 'step_update',
            step_update: { step_type: 'tool', tool_name: 'bash' }
          }) + '\n'
        );
      });
      return mockProc.child;
    });

    const antigravityProvider = new AntigravityBrainProvider({
      cwd: 'C:\\fake\\workspace',
      spawnFactory
    });
    providerRegistry.register(antigravityProvider);

    const router = new BrainRouter({
      registry: providerRegistry,
      defaultProvider: 'mock'
    });

    const runtime = new ConversationRuntime({
      sessionManager,
      contextManager,
      router,
      store
    });

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({
      requestId: 'req-integ-tool-fail',
      message: 'Run bash command',
      preferredProviderId: 'antigravity'
    })) {
      events.push(event);
    }

    const failedEvent = events.find((e) => e.type === 'request_failed') as any;
    expect(failedEvent).toBeDefined();
    expect(failedEvent.error.code).toBe('provider_invalid_response');
    expect(failedEvent.error.message).toContain('Antigravity attempted tool use');

    // Verify turn marked failed in SQLite
    const turns = await store.getTurns(failedEvent.sessionId);
    const assistantTurn = turns.find((t) => t.role === 'assistant');
    expect(assistantTurn?.status).toBe('failed');
  });

  it('persists cancelled turn when request is cancelled mid-flight', async () => {
    const mockProc = createMockChildProcess();
    const abortController = new AbortController();

    const spawnFactory: SpawnFactory = vi.fn((_cmd, args) => {
      if (args.includes('--version')) {
        const versionProc = createMockChildProcess();
        queueMicrotask(() => {
          versionProc.emitStdout('1.3.4\n');
          versionProc.emitClose(0);
        });
        return versionProc.child;
      }

      queueMicrotask(() => {
        mockProc.emitStdout(
          JSON.stringify({
            event: 'step_update',
            step_update: { step_type: 'agent_response', text_delta: 'Partial text...' }
          }) + '\n'
        );
      });
      return mockProc.child;
    });

    const antigravityProvider = new AntigravityBrainProvider({
      cwd: 'C:\\fake\\workspace',
      spawnFactory
    });
    providerRegistry.register(antigravityProvider);

    const router = new BrainRouter({
      registry: providerRegistry,
      defaultProvider: 'mock'
    });

    const runtime = new ConversationRuntime({
      sessionManager,
      contextManager,
      router,
      store
    });

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send(
      {
        requestId: 'req-integ-cancel',
        message: 'Cancel this please',
        preferredProviderId: 'antigravity'
      },
      { signal: abortController.signal }
    )) {
      events.push(event);
      if (event.type === 'response_delta') {
        abortController.abort('User cancelled');
      }
    }

    const cancelledEvent = events.find((e) => e.type === 'request_cancelled') as any;
    expect(cancelledEvent).toBeDefined();

    // Verify turn marked cancelled in SQLite
    const turns = await store.getTurns(cancelledEvent.sessionId);
    const assistantTurn = turns.find((t) => t.role === 'assistant');
    expect(assistantTurn?.status).toBe('cancelled');
  });
});

