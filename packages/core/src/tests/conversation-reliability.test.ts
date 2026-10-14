import { describe, it, expect, vi } from 'vitest';
import type {
  BrainCapabilities,
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ModelCatalogSnapshot,
  ProviderDescriptor,
  ProviderHealth
} from '@mave/contracts';
import { BrainProviderRegistry, BrainRouter } from '../brain/index.js';
import {
  SessionManager,
  ContextManager,
  ConversationRuntime,
  ConversationRuntimeError,
  type ConversationRuntimeEvent
} from '../conversation/index.js';

interface TestReliabilityStubOptions {
  id: string;
  capabilities?: Partial<BrainCapabilities>;
  deltas?: string[];
  delayMs?: number;
  hangForever?: boolean;
  emitLateDeltasAfterCompleted?: boolean;
  emitLateEventAfterCancelled?: BrainEvent;
  onChatCalled?: (req: BrainRequest) => void;
  onCancelCalled?: (requestId: string) => void;
}

function createReliabilityStubProvider(options: TestReliabilityStubOptions): BrainProvider & {
  getCancelCallCount: () => number;
  getChatCallCount: () => number;
  getCatalog?: () => Promise<ModelCatalogSnapshot>;
  getDescriptor?: () => ProviderDescriptor;
} {
  let cancelCount = 0;
  let chatCount = 0;

  const caps: BrainCapabilities = {
    streaming: true,
    fastChat: true,
    reasoning: false,
    coding: false,
    toolUse: false,
    multimodal: false,
    vision: false,
    webResearch: false,
    longContext: false,
    local: false,
    ...options.capabilities
  };

  return {
    id: options.id,
    getCapabilities(): BrainCapabilities {
      return { ...caps };
    },
    async health(): Promise<ProviderHealth> {
      return { status: 'healthy', checkedAt: Date.now() };
    },
    async *chat(request: BrainRequest, chatOptions?: BrainRequestOptions): AsyncIterable<BrainEvent> {
      chatCount++;
      options.onChatCalled?.(request);

      yield {
        type: 'started',
        requestId: request.requestId,
        providerId: options.id,
        timestamp: Date.now()
      };

      if (options.hangForever) {
        // Simulates a provider that hangs indefinitely and only unblocks if signal aborts
        await new Promise<void>((resolve) => {
          chatOptions?.signal?.addEventListener('abort', () => resolve(), { once: true });
        });
        if (chatOptions?.signal?.aborted) {
          yield {
            type: 'cancelled',
            requestId: request.requestId,
            reason: 'Hung provider aborted'
          };
        }
        return;
      }

      const deltas = options.deltas ?? ['Part 1', 'Part 2'];
      let accumulated = '';

      for (const chunk of deltas) {
        if (chatOptions?.signal?.aborted) {
          yield {
            type: 'cancelled',
            requestId: request.requestId,
            reason: 'Aborted during generation'
          };
          return;
        }

        if (options.delayMs && options.delayMs > 0) {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), options.delayMs);
            chatOptions?.signal?.addEventListener(
              'abort',
              () => {
                clearTimeout(timeout);
                resolve();
              },
              { once: true }
            );
          });
        }

        if (chatOptions?.signal?.aborted) {
          yield {
            type: 'cancelled',
            requestId: request.requestId,
            reason: 'Aborted during generation'
          };
          return;
        }

        accumulated += chunk;
        yield {
          type: 'delta',
          requestId: request.requestId,
          text: chunk
        };
      }

      yield {
        type: 'completed',
        requestId: request.requestId,
        text: accumulated,
        finishReason: 'stop'
      };

      if (options.emitLateDeltasAfterCompleted) {
        // Late invalid deltas emitted by broken provider after completed
        yield {
          type: 'delta',
          requestId: request.requestId,
          text: ' LATE ROGUE DELTA'
        };
      }

      if (options.emitLateEventAfterCancelled) {
        yield options.emitLateEventAfterCancelled;
      }
    },
    async cancel(requestId: string): Promise<void> {
      cancelCount++;
      options.onCancelCalled?.(requestId);
    },
    async getCatalog(): Promise<ModelCatalogSnapshot> {
      return {
        providerId: options.id,
        models: [
          {
            id: `${options.id}-default`,
            providerId: options.id,
            displayName: `${options.id}-default`,
            status: 'available',
            latencyClass: 'interactive',
            qualityClass: 'fast',
            costClass: 'low',
            contextClass: 'standard',
            contextWindowTokens: 8192,
            privacyClass: 'standard_cloud',
            capabilities: { ...caps }
          }
        ],
        refreshedAt: Date.now()
      };
    },
    getDescriptor(): ProviderDescriptor {
      return {
        id: options.id,
        kind: 'model_provider',
        displayName: options.id,
        accessPath: 'official_api',
        capabilities: { ...caps },
        health: { status: 'healthy', checkedAt: Date.now() }
      };
    },
    getCancelCallCount: () => cancelCount,
    getChatCallCount: () => chatCount
  };
}

function setupReliabilityEnv(stubOptions?: Partial<TestReliabilityStubOptions>, runtimeOptions?: { defaultTimeoutMs?: number }) {
  const sessionManager = new SessionManager();
  const contextManager = new ContextManager();
  const registry = new BrainProviderRegistry();
  const stubProvider = createReliabilityStubProvider({
    id: 'reliability-stub',
    ...stubOptions
  });
  registry.register(stubProvider);
  const router = new BrainRouter(registry, { defaultProvider: 'reliability-stub' });
  const runtime = new ConversationRuntime({
    sessionManager,
    contextManager,
    router,
    ...runtimeOptions
  });

  return { sessionManager, contextManager, registry, router, runtime, stubProvider };
}

describe('ConversationRuntime Reliability — Timeout Hardening', () => {
  it('1. rejects invalid non-positive timeoutMs with invalid_request', async () => {
    const { runtime } = setupReliabilityEnv();

    await expect(async () => {
      for await (const _ of runtime.send({ message: 'Hello' }, { timeoutMs: 0 })) {}
    }).rejects.toThrow('timeoutMs must be a positive number');

    await expect(async () => {
      for await (const _ of runtime.send({ message: 'Hello' }, { timeoutMs: -100 })) {}
    }).rejects.toThrow(ConversationRuntimeError);
  });

  it('2. triggers request_failed with provider_timeout when per-request timeout expires', async () => {
    const { runtime, stubProvider, sessionManager } = setupReliabilityEnv({
      deltas: ['chunk1', 'chunk2', 'chunk3'],
      delayMs: 60
    });

    const events: ConversationRuntimeEvent[] = [];
    // Set 40ms timeout, but provider requires 3 * 60ms = 180ms
    for await (const event of runtime.send({ message: 'Test timeout' }, { timeoutMs: 40 })) {
      events.push(event);
    }

    const failedEvent = events.find((e) => e.type === 'request_failed');
    expect(failedEvent).toBeDefined();
    if (failedEvent && failedEvent.type === 'request_failed') {
      expect(failedEvent.error.code).toBe('provider_timeout');
      expect(failedEvent.error.message).toContain('40ms');
      expect(failedEvent.error.retryable).toBe(true);
    }

    // Provider cancel hook should have been triggered
    expect(stubProvider.getCancelCallCount()).toBe(1);

    // Turn should be marked failed with timeout message
    const sessions = sessionManager.listSessions();
    const assistantTurn = sessionManager.getTurns(sessions[0]!.id).find((t) => t.role === 'assistant');
    expect(assistantTurn?.status).toBe('failed');
    expect(assistantTurn?.error).toContain('40ms');

    // No cancelled event emitted when timeout is the reason
    expect(events.some((e) => e.type === 'request_cancelled')).toBe(false);

    // Active request tracking cleaned up
    expect(runtime.getActiveRequestCount()).toBe(0);
  });

  it('3. uses defaultTimeoutMs from runtime options when per-request timeout is omitted', async () => {
    const { runtime } = setupReliabilityEnv(
      {
        deltas: ['chunk1', 'chunk2'],
        delayMs: 60
      },
      { defaultTimeoutMs: 35 }
    );

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ message: 'Test default timeout' })) {
      events.push(event);
    }

    const failedEvent = events.find((e) => e.type === 'request_failed');
    expect(failedEvent).toBeDefined();
    if (failedEvent && failedEvent.type === 'request_failed') {
      expect(failedEvent.error.code).toBe('provider_timeout');
      expect(failedEvent.error.message).toContain('35ms');
    }
  });

  it('4. throws ConversationRuntimeError with provider_timeout when throwOnError is true', async () => {
    const { runtime } = setupReliabilityEnv({
      deltas: ['chunk1', 'chunk2'],
      delayMs: 80
    });

    await expect(async () => {
      for await (const _ of runtime.send(
        { message: 'Test throw on timeout' },
        { timeoutMs: 30, throwOnError: true }
      )) {}
    }).rejects.toThrow(ConversationRuntimeError);

    try {
      for await (const _ of runtime.send(
        { message: 'Test throw on timeout' },
        { timeoutMs: 30, throwOnError: true }
      )) {}
    } catch (err) {
      const cErr = err as ConversationRuntimeError;
      expect(cErr.code).toBe('provider_timeout');
    }
  });

  it('5. breaks out of hung provider stream upon timeout', async () => {
    const { runtime, stubProvider } = setupReliabilityEnv({
      hangForever: true
    });

    const events: ConversationRuntimeEvent[] = [];
    const startTime = Date.now();
    for await (const event of runtime.send({ message: 'Hung provider' }, { timeoutMs: 50 })) {
      events.push(event);
    }
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(500); // Exited promptly around 50ms, didn't hang
    expect(events.some((e) => e.type === 'request_failed' && e.error.code === 'provider_timeout')).toBe(true);
    expect(stubProvider.getCancelCallCount()).toBe(1);
    expect(runtime.getActiveRequestCount()).toBe(0);
  });
});

describe('ConversationRuntime Reliability — Cancellation Propagation', () => {
  it('6. cancel() clears timeout timer so timeout never fires afterwards', async () => {
    const { runtime, stubProvider } = setupReliabilityEnv({
      deltas: ['slow-1', 'slow-2', 'slow-3'],
      delayMs: 30
    });

    const events: ConversationRuntimeEvent[] = [];
    const stream = runtime.send({ requestId: 'cancel-before-timeout', message: 'Cancel test' }, { timeoutMs: 150 });

    for await (const event of stream) {
      events.push(event);
      if (event.type === 'response_started') {
        const cancelled = await runtime.cancel('cancel-before-timeout');
        expect(cancelled).toBe(true);
      }
    }

    // Must be cancelled, NOT failed with timeout
    expect(events.some((e) => e.type === 'request_cancelled')).toBe(true);
    expect(events.some((e) => e.type === 'request_failed')).toBe(false);
    expect(stubProvider.getCancelCallCount()).toBe(1);
    expect(runtime.getActiveRequestCount()).toBe(0);
  });

  it('7. cancelling already finished request returns false', async () => {
    const { runtime } = setupReliabilityEnv({
      deltas: ['fast']
    });

    for await (const _ of runtime.send({ requestId: 'fast-req', message: 'Fast' })) {}

    const cancelled = await runtime.cancel('fast-req');
    expect(cancelled).toBe(false);
  });

  it('8. cancelling already timed-out request returns false', async () => {
    const { runtime } = setupReliabilityEnv({
      hangForever: true
    });

    for await (const _ of runtime.send({ requestId: 'timed-out-req', message: 'Hang' }, { timeoutMs: 30 })) {}

    const cancelled = await runtime.cancel('timed-out-req');
    expect(cancelled).toBe(false);
  });

  it('9. subsequent cancel calls on an already cancelled request return false', async () => {
    const { runtime } = setupReliabilityEnv({
      deltas: ['chunk1', 'chunk2'],
      delayMs: 50
    });

    const stream = runtime.send({ requestId: 'multi-cancel-req', message: 'Cancel twice' });
    const consumer = (async () => {
      for await (const _ of stream) {}
    })();

    // Wait a tick for stream to start
    await new Promise((r) => setTimeout(r, 10));

    const firstCancel = await runtime.cancel('multi-cancel-req');
    expect(firstCancel).toBe(true);

    const secondCancel = await runtime.cancel('multi-cancel-req');
    expect(secondCancel).toBe(false);

    await consumer;
  });
});

describe('ConversationRuntime Reliability — Terminal Event Arbitration', () => {
  it('10. drops rogue deltas emitted by provider after completion', async () => {
    const { runtime } = setupReliabilityEnv({
      deltas: ['A', 'B'],
      emitLateDeltasAfterCompleted: true
    });

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ message: 'Rogue test' })) {
      events.push(event);
    }

    const lastEvent = events[events.length - 1];
    expect(lastEvent?.type).toBe('response_completed');

    // Make sure no delta arrived after response_completed
    const completedIdx = events.findIndex((e) => e.type === 'response_completed');
    expect(completedIdx).toBe(events.length - 1);
  });

  it('11. exactly one terminal event emitted per request', async () => {
    const { runtime } = setupReliabilityEnv({
      deltas: ['X', 'Y']
    });

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ message: 'Single terminal test' })) {
      events.push(event);
    }

    const terminalEvents = events.filter((e) =>
      ['response_completed', 'request_cancelled', 'request_failed'].includes(e.type)
    );
    expect(terminalEvents.length).toBe(1);
    expect(terminalEvents[0]!.type).toBe('response_completed');
  });

  it('12. allows new request on same session immediately after previous request completes', async () => {
    const { runtime, sessionManager } = setupReliabilityEnv();
    const session = sessionManager.createSession({ id: 'sess-reuse' });

    // Request 1
    for await (const _ of runtime.send({ sessionId: session.id, message: 'Req 1' })) {}

    // Request 2 on same session should succeed immediately without session_busy
    const events2: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ sessionId: session.id, message: 'Req 2' })) {
      events2.push(event);
    }

    expect(events2.some((e) => e.type === 'response_completed')).toBe(true);
    expect(sessionManager.getTurns(session.id).length).toBe(4);
  });

  it('13. allows new request on same session immediately after previous request times out', async () => {
    const { runtime, sessionManager } = setupReliabilityEnv({
      deltas: ['d1', 'd2'],
      delayMs: 60
    });
    const session = sessionManager.createSession({ id: 'sess-timeout-reuse' });

    // Request 1 times out
    for await (const _ of runtime.send({ sessionId: session.id, message: 'Req 1' }, { timeoutMs: 30 })) {}

    // Request 2 should run without session_busy error
    const events2: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ sessionId: session.id, message: 'Req 2' }, { timeoutMs: 200 })) {
      events2.push(event);
    }

    expect(events2.some((e) => e.type === 'response_completed')).toBe(true);
  });

  it('14. allows new request on same session immediately after previous request is cancelled', async () => {
    const { runtime, sessionManager } = setupReliabilityEnv({
      deltas: ['d1', 'd2', 'd3'],
      delayMs: 40
    });
    const session = sessionManager.createSession({ id: 'sess-cancel-reuse' });

    // Request 1 is cancelled
    const stream1 = runtime.send({ requestId: 'r1', sessionId: session.id, message: 'Req 1' });
    for await (const event of stream1) {
      if (event.type === 'response_started') {
        await runtime.cancel('r1');
      }
    }

    // Request 2 succeeds
    const events2: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ sessionId: session.id, message: 'Req 2' })) {
      events2.push(event);
    }

    expect(events2.some((e) => e.type === 'response_completed')).toBe(true);
  });

  it('15. aborting before provider execution yields request_cancelled and cleans up', async () => {
    const { runtime } = setupReliabilityEnv();
    const abortController = new AbortController();
    abortController.abort(); // Pre-aborted

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ message: 'Pre-aborted' }, { signal: abortController.signal })) {
      events.push(event);
    }

    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('request_cancelled');
    expect(runtime.getActiveRequestCount()).toBe(0);
  });

  it('16. provider throwing exception after timeout still yields provider_timeout', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const throwingOnAbortProvider: BrainProvider & {
      getCatalog: () => Promise<ModelCatalogSnapshot>;
      getDescriptor: () => ProviderDescriptor;
    } = {
      id: 'throw-on-abort',
      getCapabilities: () => ({
        streaming: true,
        fastChat: true,
        reasoning: false,
        coding: false,
        toolUse: false,
        multimodal: false,
        vision: false,
        webResearch: false,
        longContext: false,
        local: false
      }),
      health: async () => ({ status: 'healthy', checkedAt: Date.now() }),
      async getCatalog(): Promise<ModelCatalogSnapshot> {
        return {
          providerId: 'throw-on-abort',
          models: [
            {
              id: 'm1',
              providerId: 'throw-on-abort',
              displayName: 'm1',
              status: 'available',
              latencyClass: 'interactive',
              qualityClass: 'fast',
              costClass: 'low',
              contextClass: 'standard',
              contextWindowTokens: 8192,
              privacyClass: 'standard_cloud',
              capabilities: {
                streaming: true,
                fastChat: true,
                reasoning: false,
                coding: false,
                toolUse: false,
                multimodal: false,
                vision: false,
                webResearch: false,
                longContext: false,
                local: false
              }
            }
          ],
          refreshedAt: Date.now()
        };
      },
      getDescriptor(): ProviderDescriptor {
        return {
          id: 'throw-on-abort',
          kind: 'model_provider',
          displayName: 'throw-on-abort',
          accessPath: 'official_api',
          capabilities: {
            streaming: true,
            fastChat: true,
            reasoning: false,
            coding: false,
            toolUse: false,
            multimodal: false,
            vision: false,
            webResearch: false,
            longContext: false,
            local: false
          },
          health: { status: 'healthy', checkedAt: Date.now() }
        };
      },
      async *chat(_req, opts) {
        yield { type: 'started', requestId: _req.requestId, providerId: 'throw-on-abort', timestamp: Date.now() };
        await new Promise((r) => setTimeout(r, 60));
        if (opts?.signal?.aborted) {
          throw new Error('Late crash after abort');
        }
        yield { type: 'completed', requestId: _req.requestId, text: 'Done' };
      }
    };
    registry.register(throwingOnAbortProvider);
    const router = new BrainRouter(registry, { defaultProvider: 'throw-on-abort' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ message: 'Crash test' }, { timeoutMs: 30 })) {
      events.push(event);
    }

    const failedEvt = events.find((e) => e.type === 'request_failed');
    expect(failedEvt).toBeDefined();
    if (failedEvt && failedEvt.type === 'request_failed') {
      expect(failedEvt.error.code).toBe('provider_timeout');
    }
  });

  it('17. enforces zero database writes during delta streaming (persisting only on terminal event)', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const stub = createReliabilityStubProvider({
      id: 'mock-delts',
      deltas: ['one', 'two', 'three', 'four', 'five']
    });
    registry.register(stub);
    const router = new BrainRouter(registry, { defaultProvider: 'mock-delts' });

    let updateTurnCalls = 0;
    let createTurnCalls = 0;
    const mockStore = {
      createSession: vi.fn(async () => {}),
      getSession: vi.fn(async () => undefined),
      updateSession: vi.fn(async () => {}),
      listSessions: vi.fn(async () => []),
      deleteSession: vi.fn(async () => {}),
      createTurn: vi.fn(async (turn) => {
        createTurnCalls++;
        return turn;
      }),
      updateTurn: vi.fn(async (turn) => {
        updateTurnCalls++;
        return turn;
      }),
      getTurns: vi.fn(async () => [])
    };

    const runtime = new ConversationRuntime({
      sessionManager,
      contextManager,
      router,
      store: mockStore as any
    });

    for await (const _ of runtime.send({ message: 'Delta persistence check' })) {}

    // Exactly 2 createTurn calls: user turn + assistant initial pending turn
    expect(createTurnCalls).toBe(2);
    // Exactly 1 updateTurn call: final completed turn (zero writes per delta!)
    expect(updateTurnCalls).toBe(1);
  });
});
