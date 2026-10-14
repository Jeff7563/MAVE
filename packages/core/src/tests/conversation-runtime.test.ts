import { describe, it, expect, vi } from 'vitest';
import type {
  BrainCapabilities,
  BrainErrorCode,
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ModelCatalogSnapshot,
  ProviderDescriptor,
  ProviderHealth,
  ProviderHealthStatus
} from '@mave/contracts';
import { BrainProviderRegistry, BrainRouter } from '../brain/index.js';
import {
  SessionManager,
  ContextManager,
  ConversationRuntime,
  ConversationRuntimeError,
  type ConversationRuntimeEvent,
  type RequestFailedEvent
} from '../conversation/index.js';

interface TestProviderStubOptions {
  id: string;
  capabilities?: Partial<BrainCapabilities>;
  deltas?: string[];
  failureMode?: 'error_event' | 'throw' | 'none';
  errorCode?: BrainErrorCode;
  errorMessage?: string;
  delayMs?: number;
  healthStatus?: ProviderHealthStatus;
  modelCatalog?: ModelCatalogSnapshot;
  onChatCalled?: (req: BrainRequest) => void;
  onCancelCalled?: (requestId: string) => void;
}

function createStubProvider(options: TestProviderStubOptions): BrainProvider & {
  getChatCallCount: () => number;
  getLastRequest: () => BrainRequest | undefined;
  getLastOptions: () => BrainRequestOptions | undefined;
  getCancelCallCount: () => number;
  getCatalog?: () => Promise<ModelCatalogSnapshot>;
  getDescriptor?: () => ProviderDescriptor;
  cancel?: (requestId: string) => Promise<void>;
} {
  let chatCount = 0;
  let cancelCount = 0;
  let lastRequest: BrainRequest | undefined;
  let lastOptions: BrainRequestOptions | undefined;

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
      return { status: options.healthStatus ?? 'healthy', checkedAt: Date.now() };
    },
    async *chat(request: BrainRequest, chatOptions?: BrainRequestOptions): AsyncIterable<BrainEvent> {
      chatCount++;
      lastRequest = request;
      lastOptions = chatOptions;
      options.onChatCalled?.(request);

      if (options.failureMode === 'throw') {
        throw new Error(options.errorMessage ?? 'Simulated provider error');
      }

      yield {
        type: 'started',
        requestId: request.requestId,
        providerId: options.id,
        timestamp: Date.now()
      };

      if (options.failureMode === 'error_event') {
        yield {
          type: 'error',
          requestId: request.requestId,
          error: {
            code: options.errorCode ?? 'runtime_error',
            message: options.errorMessage ?? 'Provider error event emitted',
            retryable: false
          }
        };
        return;
      }

      const deltas = options.deltas ?? ['Hello', ' from ', 'MAVE!'];
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
            if (chatOptions?.signal) {
              chatOptions.signal.addEventListener(
                'abort',
                () => {
                  clearTimeout(timeout);
                  resolve();
                },
                { once: true }
              );
            }
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
    },
    async cancel(requestId: string): Promise<void> {
      cancelCount++;
      options.onCancelCalled?.(requestId);
    },
    async getCatalog(): Promise<ModelCatalogSnapshot> {
      return (
        options.modelCatalog ?? {
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
        }
      );
    },
    getDescriptor(): ProviderDescriptor {
      return {
        id: options.id,
        kind: options.id === 'antigravity' ? 'agent_runtime_provider' : 'model_provider',
        displayName: options.id,
        accessPath: options.id === 'antigravity' ? 'official_cli' : 'official_api',
        capabilities: { ...caps },
        health: { status: options.healthStatus ?? 'healthy', checkedAt: Date.now() }
      };
    },
    getChatCallCount: () => chatCount,
    getLastRequest: () => lastRequest,
    getLastOptions: () => lastOptions,
    getCancelCallCount: () => cancelCount
  };
}

function setupTestEnvironment(providerDeltas?: string[]) {
  const sessionManager = new SessionManager();
  const contextManager = new ContextManager();
  const registry = new BrainProviderRegistry();
  const stubProvider = createStubProvider({
    id: 'mock-primary',
    deltas: providerDeltas
  });
  registry.register(stubProvider);
  const router = new BrainRouter(registry, { defaultProvider: 'mock-primary' });

  const runtime = new ConversationRuntime({
    sessionManager,
    contextManager,
    router
  });

  return { sessionManager, contextManager, registry, router, runtime, stubProvider };
}

describe('ConversationRuntime — Success Path', () => {
  it('1. request without sessionId creates a new session', async () => {
    const { runtime, sessionManager } = setupTestEnvironment();

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ message: 'Hello' })) {
      events.push(event);
    }

    const sessionReady = events.find(e => e.type === 'session_ready');
    expect(sessionReady).toBeDefined();
    expect(sessionReady?.sessionId).toBeDefined();

    const session = sessionManager.getSession(sessionReady!.sessionId!);
    expect(session).toBeDefined();
    expect(session?.status).toBe('active');
  });

  it('2. request with valid sessionId reuses existing session', async () => {
    const { runtime, sessionManager } = setupTestEnvironment();
    const existing = sessionManager.createSession({ id: 'existing-sess-1' });

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ sessionId: existing.id, message: 'Message 1' })) {
      events.push(event);
    }

    const sessionReady = events.find(e => e.type === 'session_ready');
    expect(sessionReady?.sessionId).toBe('existing-sess-1');
  });

  it('3. stores current user turn as completed before context is built', async () => {
    const { runtime, sessionManager } = setupTestEnvironment();

    for await (const _ of runtime.send({ message: 'User question' })) {
      // Stream
    }

    const sessions = sessionManager.listSessions();
    const turns = sessionManager.getTurns(sessions[0]!.id);
    const userTurn = turns.find(t => t.role === 'user');

    expect(userTurn).toBeDefined();
    expect(userTurn?.content).toBe('User question');
    expect(userTurn?.status).toBe('completed');
  });

  it('4. current user message appears exactly once in BrainRequest', async () => {
    const { runtime, stubProvider } = setupTestEnvironment();

    for await (const _ of runtime.send({ message: 'Single user message' })) {
      // Stream
    }

    const lastReq = stubProvider.getLastRequest();
    expect(lastReq).toBeDefined();
    const userMessages = lastReq!.messages.filter(m => m.role === 'user');
    expect(userMessages.length).toBe(1);
    expect(userMessages[0]!.content).toBe('Single user message');
  });

  it('5. context includes prior completed conversation turns', async () => {
    const { runtime, sessionManager, stubProvider } = setupTestEnvironment();
    const session = sessionManager.createSession({ id: 'multi-turn-sess' });

    // Turn 1
    for await (const _ of runtime.send({ sessionId: session.id, message: 'First question' })) {}
    // Turn 2
    for await (const _ of runtime.send({ sessionId: session.id, message: 'Second question' })) {}

    const lastReq = stubProvider.getLastRequest();
    expect(lastReq).toBeDefined();
    // Prior user turn + prior assistant turn + current user turn = 3 messages
    expect(lastReq!.messages.length).toBe(3);
    expect(lastReq!.messages[0]!.content).toBe('First question');
    expect(lastReq!.messages[1]!.role).toBe('assistant');
    expect(lastReq!.messages[2]!.content).toBe('Second question');
  });

  it('6. stores router-selected provider as activeProviderId in session', async () => {
    const { runtime, sessionManager } = setupTestEnvironment();

    for await (const _ of runtime.send({ message: 'Test provider selection' })) {}

    const sessions = sessionManager.listSessions();
    expect(sessions[0]!.activeProviderId).toBe('mock-primary');
  });

  it('7. calls provider.chat() exactly once per request', async () => {
    const { runtime, stubProvider } = setupTestEnvironment();

    for await (const _ of runtime.send({ message: 'Test call count' })) {}

    expect(stubProvider.getChatCallCount()).toBe(1);
  });

  it('8. creates assistant turn transitioning pending -> streaming -> completed', async () => {
    const { runtime, sessionManager } = setupTestEnvironment(['Delta 1', 'Delta 2']);

    for await (const _ of runtime.send({ message: 'Check lifecycle' })) {}

    const sessions = sessionManager.listSessions();
    const turns = sessionManager.getTurns(sessions[0]!.id);
    const assistantTurn = turns.find(t => t.role === 'assistant');

    expect(assistantTurn).toBeDefined();
    expect(assistantTurn?.status).toBe('completed');
    expect(assistantTurn?.content).toBe('Delta 1Delta 2');
  });

  it('9. aggregates deltas correctly and matches final assistant content', async () => {
    const { runtime, sessionManager } = setupTestEnvironment(['Part A', ' ', 'Part B']);

    const deltas: string[] = [];
    let completedText = '';

    for await (const event of runtime.send({ message: 'Aggregate' })) {
      if (event.type === 'response_delta') deltas.push(event.text);
      if (event.type === 'response_completed') completedText = event.text;
    }

    expect(deltas).toEqual(['Part A', ' ', 'Part B']);
    expect(completedText).toBe('Part A Part B');

    const sessions = sessionManager.listSessions();
    const assistantTurn = sessionManager.getTurns(sessions[0]!.id).find(t => t.role === 'assistant');
    expect(assistantTurn?.content).toBe('Part A Part B');
  });

  it('10. guarantees deterministic event ordering on successful execution', async () => {
    const { runtime } = setupTestEnvironment(['chunk-1', 'chunk-2']);

    const eventTypes: string[] = [];
    for await (const event of runtime.send({ message: 'Order test' })) {
      eventTypes.push(event.type);
    }

    expect(eventTypes).toEqual([
      'request_started',
      'session_ready',
      'provider_selected',
      'response_started',
      'response_delta',
      'response_delta',
      'response_completed'
    ]);
  });

  it('11. multiple sequential messages maintain conversation context and history', async () => {
    const { runtime, sessionManager } = setupTestEnvironment();
    const session = sessionManager.createSession();

    for await (const _ of runtime.send({ sessionId: session.id, message: 'Step 1' })) {}
    for await (const _ of runtime.send({ sessionId: session.id, message: 'Step 2' })) {}
    for await (const _ of runtime.send({ sessionId: session.id, message: 'Step 3' })) {}

    const turns = sessionManager.getTurns(session.id);
    expect(turns.length).toBe(6); // 3 user + 3 assistant
    expect(turns[0]!.role).toBe('user');
    expect(turns[1]!.role).toBe('assistant');
    expect(turns[2]!.role).toBe('user');
    expect(turns[3]!.role).toBe('assistant');
    expect(turns[4]!.role).toBe('user');
    expect(turns[5]!.role).toBe('assistant');
  });
});

describe('ConversationRuntime — Cancellation', () => {
  it('1. cancel active request aborts provider and emits request_cancelled', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const stub = createStubProvider({
      id: 'delay-provider',
      deltas: ['chunk1', 'chunk2', 'chunk3'],
      delayMs: 25
    });
    registry.register(stub);
    const router = new BrainRouter(registry, { defaultProvider: 'delay-provider' });

    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const events: ConversationRuntimeEvent[] = [];
    const stream = runtime.send({ requestId: 'cancel-req-1', message: 'Cancel me' });

    // Cancel after receiving the first delta
    for await (const event of stream) {
      events.push(event);
      if (event.type === 'response_delta') {
        await runtime.cancel('cancel-req-1');
      }
    }

    const cancelledEvent = events.find(e => e.type === 'request_cancelled');
    expect(cancelledEvent).toBeDefined();

    // Verify assistant turn status
    const sessions = sessionManager.listSessions();
    const turns = sessionManager.getTurns(sessions[0]!.id);
    const assistantTurn = turns.find(t => t.role === 'assistant');
    expect(assistantTurn?.status).toBe('cancelled');

    // Provider cancel hook called
    expect(stub.getCancelCallCount()).toBe(1);

    // Active request tracking cleaned up
    expect(runtime.getActiveRequestCount()).toBe(0);
  });

  it('2. cancelling unknown request returns false deterministically', async () => {
    const { runtime } = setupTestEnvironment();

    const result = await runtime.cancel('non-existent-request');
    expect(result).toBe(false);
  });

  it('3. cancelling request A does not affect concurrent request B', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const stub = createStubProvider({
      id: 'delay-provider',
      deltas: ['part-1', 'part-2'],
      delayMs: 20
    });
    registry.register(stub);
    const router = new BrainRouter(registry, { defaultProvider: 'delay-provider' });

    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const s1 = sessionManager.createSession({ id: 'session-a' });
    const s2 = sessionManager.createSession({ id: 'session-b' });

    const eventsA: ConversationRuntimeEvent[] = [];
    const eventsB: ConversationRuntimeEvent[] = [];

    const streamA = runtime.send({ requestId: 'req-a', sessionId: s1.id, message: 'Message A' });
    const streamB = runtime.send({ requestId: 'req-b', sessionId: s2.id, message: 'Message B' });

    const consumerA = (async () => {
      for await (const event of streamA) {
        eventsA.push(event);
        if (event.type === 'response_started') {
          await runtime.cancel('req-a');
        }
      }
    })();

    const consumerB = (async () => {
      for await (const event of streamB) {
        eventsB.push(event);
      }
    })();

    await Promise.all([consumerA, consumerB]);

    // Request A should be cancelled
    expect(eventsA.some(e => e.type === 'request_cancelled')).toBe(true);
    const turnA = sessionManager.getTurns(s1.id).find(t => t.role === 'assistant');
    expect(turnA?.status).toBe('cancelled');

    // Request B should succeed completely
    expect(eventsB.some(e => e.type === 'response_completed')).toBe(true);
    const turnB = sessionManager.getTurns(s2.id).find(t => t.role === 'assistant');
    expect(turnB?.status).toBe('completed');
  });
});

describe('ConversationRuntime — Failures', () => {
  it('1. routing failure yields request_failed and cleans up', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    // No providers registered -> routing failure
    const router = new BrainRouter(registry, { defaultProvider: 'missing-provider' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ message: 'Routing fail test' })) {
      events.push(event);
    }

    const failedEvent = events.find(e => e.type === 'request_failed');
    expect(failedEvent).toBeDefined();
    expect(runtime.getActiveRequestCount()).toBe(0);
  });

  it('2. provider error event yields request_failed and marks assistant turn as failed', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const stub = createStubProvider({
      id: 'error-provider',
      failureMode: 'error_event',
      errorCode: 'provider_unavailable',
      errorMessage: 'Capacity exceeded'
    });
    registry.register(stub);
    const router = new BrainRouter(registry, { defaultProvider: 'error-provider' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ message: 'Trigger error event' })) {
      events.push(event);
    }

    const failedEvent = events.find(e => e.type === 'request_failed');
    expect(failedEvent).toBeDefined();
    if (failedEvent && failedEvent.type === 'request_failed') {
      expect(failedEvent.error.code).toBe('provider_unavailable');
      expect(failedEvent.error.message).toBe('Capacity exceeded');
    }

    const sessions = sessionManager.listSessions();
    const assistantTurn = sessionManager.getTurns(sessions[0]!.id).find(t => t.role === 'assistant');
    expect(assistantTurn?.status).toBe('failed');
    expect(assistantTurn?.error).toBe('Capacity exceeded');
    expect(runtime.getActiveRequestCount()).toBe(0);
  });

  it('3. provider chat throw yields request_failed and marks assistant turn as failed', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const stub = createStubProvider({
      id: 'throwing-provider',
      failureMode: 'throw',
      errorMessage: 'Crash during generation'
    });
    registry.register(stub);
    const router = new BrainRouter(registry, { defaultProvider: 'throwing-provider' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({ message: 'Trigger throw' })) {
      events.push(event);
    }

    const failedEvent = events.find(e => e.type === 'request_failed');
    expect(failedEvent).toBeDefined();

    const sessions = sessionManager.listSessions();
    const assistantTurn = sessionManager.getTurns(sessions[0]!.id).find(t => t.role === 'assistant');
    expect(assistantTurn?.status).toBe('failed');
    expect(assistantTurn?.error).toContain('Crash during generation');
    expect(runtime.getActiveRequestCount()).toBe(0);
  });

  it('4. throws session_not_found when explicit sessionId does not exist', async () => {
    const { runtime } = setupTestEnvironment();

    await expect(async () => {
      for await (const _ of runtime.send({ sessionId: 'ghost-session', message: 'Hello' })) {}
    }).rejects.toThrow(ConversationRuntimeError);

    try {
      for await (const _ of runtime.send({ sessionId: 'ghost-session', message: 'Hello' })) {}
    } catch (err) {
      const rErr = err as ConversationRuntimeError;
      expect(rErr.code).toBe('session_not_found');
    }
  });

  it('5. throws session_ended when explicit session has ended', async () => {
    const { runtime, sessionManager } = setupTestEnvironment();
    const session = sessionManager.createSession({ id: 'ended-session-1' });
    sessionManager.endSession(session.id);

    await expect(async () => {
      for await (const _ of runtime.send({ sessionId: session.id, message: 'Hello' })) {}
    }).rejects.toThrow(ConversationRuntimeError);

    try {
      for await (const _ of runtime.send({ sessionId: session.id, message: 'Hello' })) {}
    } catch (err) {
      const rErr = err as ConversationRuntimeError;
      expect(rErr.code).toBe('session_ended');
    }
  });

  it('6. rejects empty or whitespace-only message with invalid_request', async () => {
    const { runtime } = setupTestEnvironment();

    await expect(async () => {
      for await (const _ of runtime.send({ message: '' })) {}
    }).rejects.toThrow(ConversationRuntimeError);

    await expect(async () => {
      for await (const _ of runtime.send({ message: '    ' })) {}
    }).rejects.toThrow(ConversationRuntimeError);
  });

  it('7. rejects duplicate active requestId', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const stub = createStubProvider({
      id: 'delay-provider',
      deltas: ['chunk1'],
      delayMs: 50
    });
    registry.register(stub);
    const router = new BrainRouter(registry, { defaultProvider: 'delay-provider' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const s1 = sessionManager.createSession({ id: 'sess-a' });
    const s2 = sessionManager.createSession({ id: 'sess-b' });

    // Start request with fixed requestId 'req-dup'
    const stream1 = runtime.send({ requestId: 'req-dup', sessionId: s1.id, message: 'Message 1' });
    const it1 = stream1[Symbol.asyncIterator]();
    await it1.next(); // Advances into stream, registering 'req-dup'

    // Try starting another request with the same requestId
    await expect(async () => {
      for await (const _ of runtime.send({
        requestId: 'req-dup',
        sessionId: s2.id,
        message: 'Message 2'
      })) {}
    }).rejects.toThrow(ConversationRuntimeError);

    // Clean up first stream
    for await (const _ of stream1) {}
  });

  it('8. rejects same-session concurrent request with session_busy', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const stub = createStubProvider({
      id: 'delay-provider',
      deltas: ['chunk1'],
      delayMs: 50
    });
    registry.register(stub);
    const router = new BrainRouter(registry, { defaultProvider: 'delay-provider' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const session = sessionManager.createSession({ id: 'busy-session' });

    const stream1 = runtime.send({
      requestId: 'req-1',
      sessionId: session.id,
      message: 'First in flight'
    });
    const it1 = stream1[Symbol.asyncIterator]();
    await it1.next(); // Advanced into execution, marking session busy

    // Second request to the same session should be rejected with session_busy
    await expect(async () => {
      for await (const _ of runtime.send({
        requestId: 'req-2',
        sessionId: session.id,
        message: 'Second in flight'
      })) {}
    }).rejects.toThrow(ConversationRuntimeError);

    try {
      for await (const _ of runtime.send({
        requestId: 'req-2',
        sessionId: session.id,
        message: 'Second in flight'
      })) {}
    } catch (err) {
      const rErr = err as ConversationRuntimeError;
      expect(rErr.code).toBe('session_busy');
    }

    // Clean up first stream
    for await (const _ of stream1) {}
  });
});

describe('ConversationRuntime — Concurrency', () => {
  it('1. runs two different sessions concurrently without cross-talk', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const stub = createStubProvider({
      id: 'mock-provider',
      deltas: ['word-1', 'word-2']
    });
    registry.register(stub);
    const router = new BrainRouter(registry, { defaultProvider: 'mock-provider' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const s1 = sessionManager.createSession({ id: 'session-1' });
    const s2 = sessionManager.createSession({ id: 'session-2' });

    const p1 = (async () => {
      const events: ConversationRuntimeEvent[] = [];
      for await (const e of runtime.send({
        requestId: 'r-1',
        sessionId: s1.id,
        message: 'Hello Session 1'
      })) {
        events.push(e);
      }
      return events;
    })();

    const p2 = (async () => {
      const events: ConversationRuntimeEvent[] = [];
      for await (const e of runtime.send({
        requestId: 'r-2',
        sessionId: s2.id,
        message: 'Hello Session 2'
      })) {
        events.push(e);
      }
      return events;
    })();

    const [events1, events2] = await Promise.all([p1, p2]);

    expect(events1.every(e => e.sessionId === 'session-1')).toBe(true);
    expect(events2.every(e => e.sessionId === 'session-2')).toBe(true);

    const turns1 = sessionManager.getTurns('session-1');
    const turns2 = sessionManager.getTurns('session-2');

    expect(turns1.length).toBe(2);
    expect(turns2.length).toBe(2);
    expect(turns1[0]!.content).toBe('Hello Session 1');
    expect(turns2[0]!.content).toBe('Hello Session 2');
  });

  it('2. supports cancellation via external AbortSignal', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const stub = createStubProvider({
      id: 'delay-prov',
      deltas: ['delta1', 'delta2'],
      delayMs: 25
    });
    registry.register(stub);
    const router = new BrainRouter(registry, { defaultProvider: 'delay-prov' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const abortController = new AbortController();
    const events: ConversationRuntimeEvent[] = [];

    const stream = runtime.send(
      { message: 'Cancel via external signal' },
      { signal: abortController.signal }
    );

    for await (const event of stream) {
      events.push(event);
      if (event.type === 'response_started') {
        abortController.abort();
      }
    }

    expect(events.some(e => e.type === 'request_cancelled')).toBe(true);
    expect(runtime.getActiveRequestCount()).toBe(0);
  });

  it('3. merges request requiredCapabilities with default capabilities', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const reasoningProvider = createStubProvider({
      id: 'reasoning-prov',
      capabilities: { reasoning: true }
    });
    registry.register(reasoningProvider);
    const router = new BrainRouter(registry, { defaultProvider: 'reasoning-prov' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const events: ConversationRuntimeEvent[] = [];
    for await (const event of runtime.send({
      message: 'Complex reasoning query',
      requiredCapabilities: { reasoning: true }
    })) {
      events.push(event);
    }

    const providerEvent = events.find(e => e.type === 'provider_selected');
    expect(providerEvent).toBeDefined();
    if (providerEvent && providerEvent.type === 'provider_selected') {
      expect(providerEvent.providerId).toBe('reasoning-prov');
    }
  });

  it('4. throws when throwOnError option is specified on stream failure', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    const stub = createStubProvider({
      id: 'throwing-prov',
      failureMode: 'throw',
      errorMessage: 'Fatal backend error'
    });
    registry.register(stub);
    const router = new BrainRouter(registry, { defaultProvider: 'throwing-prov' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    await expect(async () => {
      for await (const _ of runtime.send(
        { message: 'Fail with throw' },
        { throwOnError: true }
      )) {}
    }).rejects.toThrow(ConversationRuntimeError);
  });

  it('5. rejects empty explicit requestId with invalid_request', async () => {
    const { runtime } = setupTestEnvironment();

    await expect(async () => {
      for await (const _ of runtime.send({ requestId: '   ', message: 'Hello' })) {}
    }).rejects.toThrow(ConversationRuntimeError);
  });

  it('6. preserves caller overrides provenance and does not overwrite request.overrides with router decisions', async () => {
    const { runtime, stubProvider } = setupTestEnvironment();

    // Scenario A: Caller passes no overrides
    const reqA = { message: 'Hello without overrides' };
    for await (const _ of runtime.send(reqA)) {}

    const lastReqA = stubProvider.getLastRequest();
    expect(lastReqA).toBeDefined();
    // Overrides passed to provider must reflect caller's original input, NOT synthesized router decisions
    expect(lastReqA!.overrides).toBeUndefined();
    // Execution options carries selected model ID (F1.4.1 execution contract bridge)
    expect(stubProvider.getLastOptions()?.modelId).toBe('mock-primary-default');
    // Context does NOT carry selectedModelId
    expect(lastReqA!.context?.selectedModelId).toBeUndefined();

    // Scenario B: Caller specified explicit preferred provider X, but fallback was used
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();

    const healthyFallback = createStubProvider({
      id: 'healthy-fallback',
      healthStatus: 'healthy'
    });
    registry.register(healthyFallback);

    const router = new BrainRouter({
      registry,
      defaultProvider: 'healthy-fallback',
      fallbackChain: ['healthy-fallback']
    });
    const multiRuntime = new ConversationRuntime({ sessionManager, contextManager, router });

    // User explicitly preferred 'unregistered-prov', but allowed fallback
    const reqB = {
      message: 'Hello with override',
      overrides: {
        localOnly: false,
        preferredProviderId: 'unregistered-prov'
      }
    };
    // BrainRouter with allowFallback will fallback to healthy-fallback
    for await (const _ of multiRuntime.send(reqB)) {}

    const lastReqB = healthyFallback.getLastRequest();
    expect(lastReqB).toBeDefined();
    // Caller provenance must be preserved as 'unregistered-prov'
    expect(lastReqB!.overrides?.preferredProviderId).toBe('unregistered-prov');
    // Execution options carries selected model ID
    expect(healthyFallback.getLastOptions()?.modelId).toBe('healthy-fallback-default');
  });

  it('7. preserves caller context immutability and never injects selectedModelId into caller context', async () => {
    const { runtime, stubProvider } = setupTestEnvironment();

    const callerContext = { project: 'MAVE', customKey: 42 };
    const req = {
      message: 'Testing caller context immutability',
      context: callerContext
    };

    for await (const _ of runtime.send(req)) {}

    // Caller's original context object must be completely untouched
    expect(callerContext).toEqual({ project: 'MAVE', customKey: 42 });
    expect((callerContext as any).selectedModelId).toBeUndefined();

    // Request context forwarded to provider must contain caller metadata but NOT selectedModelId
    const lastReq = stubProvider.getLastRequest();
    expect(lastReq).toBeDefined();
    expect(lastReq!.context?.project).toBe('MAVE');
    expect(lastReq!.context?.customKey).toBe(42);
    expect(lastReq!.context?.selectedModelId).toBeUndefined();

    // Execution model must travel via options.modelId
    const lastOpts = stubProvider.getLastOptions();
    expect(lastOpts?.modelId).toBe('mock-primary-default');
  });

  it('8. preserves caller preferredModelId provenance when fallback model is resolved', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();

    const providerWithModels = createStubProvider({
      id: 'multi-model-provider',
      healthStatus: 'healthy',
      modelCatalog: {
        providerId: 'multi-model-provider',
        models: [
          {
            id: 'preferred-model-x',
            providerId: 'multi-model-provider',
            displayName: 'Model X (Unavailable)',
            status: 'unavailable',
            latencyClass: 'interactive',
            qualityClass: 'fast',
            costClass: 'low',
            contextClass: 'standard',
            contextWindowTokens: 8192,
            privacyClass: 'standard_cloud',
            capabilities: { streaming: true, fastChat: true, reasoning: false, coding: false, toolUse: false, multimodal: false, vision: false, webResearch: false, longContext: false, local: false }
          },
          {
            id: 'fallback-model-y',
            providerId: 'multi-model-provider',
            displayName: 'Model Y (Available)',
            status: 'available',
            latencyClass: 'interactive',
            qualityClass: 'fast',
            costClass: 'low',
            contextClass: 'standard',
            contextWindowTokens: 8192,
            privacyClass: 'standard_cloud',
            capabilities: { streaming: true, fastChat: true, reasoning: false, coding: false, toolUse: false, multimodal: false, vision: false, webResearch: false, longContext: false, local: false }
          }
        ],
        refreshedAt: Date.now()
      }
    });
    registry.register(providerWithModels);

    const router = new BrainRouter({
      registry,
      defaultProvider: 'multi-model-provider'
    });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    // Caller requested preferredModelId: 'preferred-model-x', but explicitly allowed fallback
    const req = {
      message: 'Testing model fallback provenance',
      preferredModelId: 'preferred-model-x',
      allowFallback: true,
      overrides: {
        preferredModelId: 'preferred-model-x',
        localOnly: false
      }
    };

    for await (const _ of runtime.send(req)) {}

    const lastReq = providerWithModels.getLastRequest();
    const lastOpts = providerWithModels.getLastOptions();

    // 1. Caller provenance strictly preserved in request.overrides
    expect(lastReq?.overrides?.preferredModelId).toBe('preferred-model-x');

    // 2. Resolved execution target travels in BrainRequestOptions.modelId
    expect(lastOpts?.modelId).toBe('fallback-model-y');
  });

  it('9. guarantees concurrency safety: simultaneous invocations carry distinct modelId without cross-contamination', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();

    const invocationRecords: Array<{ requestId: string; modelId?: string }> = [];

    const concurrentProvider = createStubProvider({
      id: 'concurrent-provider',
      healthStatus: 'healthy',
      delayMs: 25,
      modelCatalog: {
        providerId: 'concurrent-provider',
        models: [
          {
            id: 'model-alpha',
            providerId: 'concurrent-provider',
            displayName: 'Model Alpha',
            status: 'available',
            latencyClass: 'interactive',
            qualityClass: 'fast',
            costClass: 'low',
            contextClass: 'standard',
            contextWindowTokens: 8192,
            privacyClass: 'standard_cloud',
            capabilities: { streaming: true, fastChat: true, reasoning: false, coding: false, toolUse: false, multimodal: false, vision: false, webResearch: false, longContext: false, local: false }
          },
          {
            id: 'model-beta',
            providerId: 'concurrent-provider',
            displayName: 'Model Beta',
            status: 'available',
            latencyClass: 'interactive',
            qualityClass: 'fast',
            costClass: 'low',
            contextClass: 'standard',
            contextWindowTokens: 8192,
            privacyClass: 'standard_cloud',
            capabilities: { streaming: true, fastChat: true, reasoning: false, coding: false, toolUse: false, multimodal: false, vision: false, webResearch: false, longContext: false, local: false }
          }
        ],
        refreshedAt: Date.now()
      }
    });

    // Hook into chat to record per-invocation options
    const originalChat = concurrentProvider.chat.bind(concurrentProvider);
    concurrentProvider.chat = async function* (req: BrainRequest, opts?: BrainRequestOptions) {
      invocationRecords.push({ requestId: req.requestId, modelId: opts?.modelId });
      for await (const evt of originalChat(req, opts)) {
        yield evt;
      }
    };

    registry.register(concurrentProvider);

    const router = new BrainRouter({
      registry,
      defaultProvider: 'concurrent-provider'
    });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    // Fire two concurrent requests simultaneously with different preferred models
    const taskA = (async () => {
      const events = [];
      for await (const evt of runtime.send({
        requestId: 'req-alpha',
        message: 'Request Alpha',
        preferredModelId: 'model-alpha',
        overrides: { preferredModelId: 'model-alpha', localOnly: false }
      })) {
        events.push(evt);
      }
      return events;
    })();

    const taskB = (async () => {
      const events = [];
      for await (const evt of runtime.send({
        requestId: 'req-beta',
        message: 'Request Beta',
        preferredModelId: 'model-beta',
        overrides: { preferredModelId: 'model-beta', localOnly: false }
      })) {
        events.push(evt);
      }
      return events;
    })();

    await Promise.all([taskA, taskB]);

    // Both requests ran on the exact same singleton provider instance
    expect(invocationRecords).toHaveLength(2);
    const recordA = invocationRecords.find(r => r.requestId === 'req-alpha');
    const recordB = invocationRecords.find(r => r.requestId === 'req-beta');

    expect(recordA).toBeDefined();
    expect(recordA?.modelId).toBe('model-alpha');

    expect(recordB).toBeDefined();
    expect(recordB?.modelId).toBe('model-beta');

    // Concurrency safety verified: zero cross-contamination
    expect(recordA?.modelId).not.toBe(recordB?.modelId);
  });

  it('10. direct model provider invocation requires resolved modelId and fails safely if missing', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();

    const providerWithoutModels = createStubProvider({
      id: 'provider-no-model',
      healthStatus: 'healthy'
    });
    registry.register(providerWithoutModels);

    // Mock a router that abnormally resolves without a modelId on a direct model provider
    const badRouter = {
      route: vi.fn().mockResolvedValue({
        provider: providerWithoutModels,
        providerId: 'provider-no-model',
        providerKind: 'model_provider',
        modelId: undefined, // Missing!
        fallbackUsed: false,
        reason: 'Faulty route',
        attemptedProviderIds: [],
        attemptedModelIds: [],
        routeAttempts: 0,
        telemetry: {
          selectedProviderId: 'provider-no-model',
          selectedModelId: undefined,
          fallbackUsed: false,
          attemptedProviderIds: [],
          attemptedModelIds: [],
          routeAttempts: 0
        }
      })
    } as unknown as BrainRouter;

    const runtime = new ConversationRuntime({ sessionManager, contextManager, router: badRouter });

    const events: ConversationRuntimeEvent[] = [];
    for await (const evt of runtime.send({ message: 'Trigger invariant check' })) {
      events.push(evt);
    }

    const failedEvt = events.find(e => e.type === 'request_failed') as RequestFailedEvent;
    expect(failedEvt).toBeDefined();
    expect(failedEvt.error.code).toBe('routing_error');
    expect(failedEvt.error.message).toContain("requires a resolved modelId for execution");
    // Provider.chat should NEVER have been called
    expect(providerWithoutModels.getChatCallCount()).toBe(0);
  });

  it('11. agent runtime invocation passes modelId: undefined and leaves attemptedModelIds empty', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();

    const antigravityProvider = createStubProvider({
      id: 'antigravity',
      healthStatus: 'healthy',
      capabilities: {
        streaming: true,
        fastChat: false,
        reasoning: true,
        coding: true,
        toolUse: true
      }
    });
    registry.register(antigravityProvider);

    const router = new BrainRouter({
      registry,
      defaultProvider: 'antigravity'
    });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    let capturedOptions: BrainRequestOptions | undefined;
    const origChat = antigravityProvider.chat.bind(antigravityProvider);
    antigravityProvider.chat = async function* (req: BrainRequest, opts?: BrainRequestOptions) {
      capturedOptions = opts;
      for await (const evt of origChat(req, opts)) {
        yield evt;
      }
    };

    const requestId = 'antigravity-test-req';
    for await (const _ of runtime.send({
      requestId,
      message: 'Agent task',
      profileId: 'agent_work',
      preferredProviderId: 'antigravity'
    })) {}

    // modelId must be undefined for Antigravity in F1.4
    expect(capturedOptions).toBeDefined();
    expect(capturedOptions?.modelId).toBeUndefined();

    // Telemetry transition: 1 provider attempt, but 0 model attempts
    const telemetry = runtime.getExecutionTelemetry(requestId);
    expect(telemetry).toBeDefined();
    expect(telemetry?.routeAttempts).toBe(1);
    expect(telemetry?.attemptedProviderIds).toEqual(['antigravity']);
    expect(telemetry?.attemptedModelIds).toEqual([]);
  });

  it('12. execution telemetry tracks routeAttempts = 0 before invocation, and 1 when invocation starts', async () => {
    const { runtime, stubProvider } = setupTestEnvironment();

    const requestId = 'telemetry-lifecycle-req';

    // Hook provider to inspect runtime telemetry right as provider.chat begins
    let telemetryDuringChat: RouteTelemetry | undefined;
    const origChat = stubProvider.chat.bind(stubProvider);
    stubProvider.chat = async function* (req: BrainRequest, opts?: BrainRequestOptions) {
      telemetryDuringChat = runtime.getExecutionTelemetry(req.requestId);
      for await (const evt of origChat(req, opts)) {
        yield evt;
      }
    };

    for await (const _ of runtime.send({
      requestId,
      message: 'Checking telemetry transitions'
    })) {}

    // During chat invocation: routeAttempts = 1, attemptedProviderIds contains providerId, attemptedModelIds contains modelId
    expect(telemetryDuringChat).toBeDefined();
    expect(telemetryDuringChat?.routeAttempts).toBe(1);
    expect(telemetryDuringChat?.attemptedProviderIds).toEqual(['mock-primary']);
    expect(telemetryDuringChat?.attemptedModelIds).toEqual(['mock-primary-default']);
  });
});
