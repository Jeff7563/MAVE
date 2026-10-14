import { describe, it, expect, beforeEach } from 'vitest';
import type {
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ConversationTurn,
  ModelCatalogProvider,
  ModelCatalogSnapshot,
  ProviderDescriptor,
  Session
} from '@mave/contracts';
import { ConversationRuntime } from '../conversation/runtime.js';
import { SessionManager } from '../conversation/session-manager.js';
import { ContextManager } from '../conversation/context-manager.js';
import { BrainRouter } from '../brain/router.js';
import { BrainProviderRegistry } from '../brain/provider-registry.js';
import { InMemoryConversationStore } from '../conversation/in-memory-store.js';
import { ConversationRuntimeError } from '../conversation/runtime-types.js';

class MockStreamProvider implements BrainProvider, ModelCatalogProvider {
  readonly id: string;
  private readonly chunks: string[];
  public lastRequest?: BrainRequest;

  constructor(id: string, chunks: string[] = ['Hello', ' world', '!']) {
    this.id = id;
    this.chunks = chunks;
  }

  getCapabilities() {
    return {
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
    };
  }

  async health() {
    return { status: 'healthy' as const, checkedAt: Date.now() };
  }

  async getCatalog(): Promise<ModelCatalogSnapshot> {
    return {
      providerId: this.id,
      models: [
        {
          id: `${this.id}-default`,
          providerId: this.id,
          displayName: `${this.id}-default`,
          status: 'available',
          latencyClass: 'interactive',
          qualityClass: 'fast',
          costClass: 'low',
          contextClass: 'standard',
          contextWindowTokens: 8192,
          privacyClass: 'standard_cloud',
          capabilities: this.getCapabilities()
        }
      ],
      refreshedAt: Date.now()
    };
  }

  getDescriptor(): ProviderDescriptor {
    return {
      id: this.id,
      kind: 'model_provider',
      displayName: this.id,
      accessPath: 'official_api',
      capabilities: this.getCapabilities(),
      health: { status: 'healthy', checkedAt: Date.now() }
    };
  }

  async *chat(
    request: BrainRequest,
    options?: BrainRequestOptions
  ): AsyncIterable<BrainEvent> {
    this.lastRequest = request;
    yield { type: 'started', requestId: request.requestId, providerId: this.id };

    for (const chunk of this.chunks) {
      if (options?.signal?.aborted) {
        yield { type: 'cancelled', requestId: request.requestId, reason: 'Aborted' };
        return;
      }
      yield { type: 'delta', requestId: request.requestId, text: chunk };
    }

    yield {
      type: 'completed',
      requestId: request.requestId,
      finishReason: 'stop'
    };
  }
}

class FailingStreamProvider implements BrainProvider, ModelCatalogProvider {
  readonly id = 'failing-provider';

  getCapabilities() {
    return {
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
    };
  }

  async health() {
    return { status: 'healthy' as const, checkedAt: Date.now() };
  }

  async getCatalog(): Promise<ModelCatalogSnapshot> {
    return {
      providerId: this.id,
      models: [
        {
          id: `${this.id}-default`,
          providerId: this.id,
          displayName: `${this.id}-default`,
          status: 'available',
          latencyClass: 'interactive',
          qualityClass: 'fast',
          costClass: 'low',
          contextClass: 'standard',
          contextWindowTokens: 8192,
          privacyClass: 'standard_cloud',
          capabilities: this.getCapabilities()
        }
      ],
      refreshedAt: Date.now()
    };
  }

  getDescriptor(): ProviderDescriptor {
    return {
      id: this.id,
      kind: 'model_provider',
      displayName: this.id,
      accessPath: 'official_api',
      capabilities: this.getCapabilities(),
      health: { status: 'healthy', checkedAt: Date.now() }
    };
  }

  async *chat(request: BrainRequest): AsyncIterable<BrainEvent> {
    yield { type: 'started', requestId: request.requestId, providerId: this.id };
    yield { type: 'delta', requestId: request.requestId, text: 'Partial text before boom' };
    yield {
      type: 'error',
      requestId: request.requestId,
      error: {
        code: 'runtime_error',
        message: 'Engine exploded',
        retryable: false
      }
    };
  }
}

describe('ConversationRuntime + Persistence Integration', () => {
  let sessionManager: SessionManager;
  let contextManager: ContextManager;
  let registry: BrainProviderRegistry;
  let router: BrainRouter;
  let store: InMemoryConversationStore;
  let provider: MockStreamProvider;
  let runtime: ConversationRuntime;

  beforeEach(() => {
    sessionManager = new SessionManager({ clock: () => 1000 });
    contextManager = new ContextManager();
    registry = new BrainProviderRegistry();
    provider = new MockStreamProvider('mock-stream');
    registry.register(provider);
    router = new BrainRouter({ registry, defaultProvider: 'mock-stream' });
    store = new InMemoryConversationStore();

    runtime = new ConversationRuntime({
      sessionManager,
      contextManager,
      router,
      store,
      clock: () => 1000
    });
  });

  // 1. new runtime request persists session
  it('1. new runtime request automatically persists new session', async () => {
    const events: any[] = [];
    for await (const event of runtime.send({ message: 'Hello MAVE' })) {
      events.push(event);
    }

    const sessionReady = events.find(e => e.type === 'session_ready');
    expect(sessionReady).toBeDefined();

    const storedSession = await store.getSession(sessionReady.sessionId);
    expect(storedSession).toBeDefined();
    expect(storedSession?.id).toBe(sessionReady.sessionId);
    expect(storedSession?.status).toBe('active');
  });

  // 2. user turn persisted
  it('2. completed user turn is persisted in store', async () => {
    const events: any[] = [];
    for await (const event of runtime.send({ message: 'What is the capital of France?' })) {
      events.push(event);
    }

    const sessionReady = events.find(e => e.type === 'session_ready');
    const turns = await store.getTurns(sessionReady.sessionId);

    const userTurn = turns.find(t => t.role === 'user');
    expect(userTurn).toBeDefined();
    expect(userTurn?.content).toBe('What is the capital of France?');
    expect(userTurn?.status).toBe('completed');
  });

  // 3. completed assistant turn persisted
  it('3. completed assistant turn is persisted in store', async () => {
    const events: any[] = [];
    for await (const event of runtime.send({ message: 'Hello' })) {
      events.push(event);
    }

    const sessionReady = events.find(e => e.type === 'session_ready');
    const turns = await store.getTurns(sessionReady.sessionId);

    const assistantTurn = turns.find(t => t.role === 'assistant');
    expect(assistantTurn).toBeDefined();
    expect(assistantTurn?.status).toBe('completed');
  });

  // 4. assistant accumulated content correct
  it('4. assistant accumulated content is accurately persisted', async () => {
    const customChunks = ['Alpha', ' ', 'Bravo', ' ', 'Charlie'];
    const customProvider = new MockStreamProvider('custom-p', customChunks);
    registry.register(customProvider);

    for await (const _ of runtime.send({
      message: 'Spell it',
      preferredProviderId: 'custom-p'
    })) {
      // consume
    }

    const sessions = await store.listSessions();
    const turns = await store.getTurns(sessions[0]!.id);
    const assistantTurn = turns.find(t => t.role === 'assistant');

    expect(assistantTurn?.content).toBe('Alpha Bravo Charlie');
  });

  // 5. provider selected metadata persisted
  it('5. provider selected metadata is persisted on session and turn', async () => {
    for await (const _ of runtime.send({ message: 'Route me' })) {
      // consume
    }

    const sessions = await store.listSessions();
    const session = sessions[0]!;
    expect(session.activeProviderId).toBe('mock-stream');

    const turns = await store.getTurns(session.id);
    const assistantTurn = turns.find(t => t.role === 'assistant');
    expect(assistantTurn?.providerId).toBe('mock-stream');
  });

  // 6. cancelled assistant state persisted
  it('6. cancelled assistant state is persisted in store', async () => {
    const abortController = new AbortController();

    // Provider that yields one delta then waits or cancels
    class CancellableProvider implements BrainProvider, ModelCatalogProvider {
      readonly id = 'cancellable';
      getCapabilities() {
        return { streaming: true, fastChat: true, reasoning: false, coding: false, toolUse: false, multimodal: false, vision: false, webResearch: false, longContext: false, local: false };
      }
      async health() { return { status: 'healthy' as const, checkedAt: 0 }; }
      async getCatalog(): Promise<ModelCatalogSnapshot> {
        return {
          providerId: this.id,
          models: [
            {
              id: `${this.id}-default`,
              providerId: this.id,
              displayName: `${this.id}-default`,
              status: 'available',
              latencyClass: 'interactive',
              qualityClass: 'fast',
              costClass: 'low',
              contextClass: 'standard',
              contextWindowTokens: 8192,
              privacyClass: 'standard_cloud',
              capabilities: this.getCapabilities()
            }
          ],
          refreshedAt: Date.now()
        };
      }
      getDescriptor(): ProviderDescriptor {
        return {
          id: this.id,
          kind: 'model_provider',
          displayName: this.id,
          accessPath: 'official_api',
          capabilities: this.getCapabilities(),
          health: { status: 'healthy', checkedAt: Date.now() }
        };
      }
      async *chat(_req: BrainRequest): AsyncIterable<BrainEvent> {
        yield { type: 'started', requestId: _req.requestId, providerId: this.id };
        yield { type: 'delta', requestId: _req.requestId, text: 'Partial text before cancel' };
        abortController.abort();
        yield { type: 'cancelled', requestId: _req.requestId, reason: 'User cancel' };
      }
    }
    registry.register(new CancellableProvider());

    const events: any[] = [];
    for await (const event of runtime.send(
      { message: 'Cancel test', preferredProviderId: 'cancellable' },
      { signal: abortController.signal }
    )) {
      events.push(event);
    }

    const sessions = await store.listSessions();
    const turns = await store.getTurns(sessions[0]!.id);
    const assistantTurn = turns.find(t => t.role === 'assistant');

    expect(assistantTurn?.status).toBe('cancelled');
    expect(assistantTurn?.content).toBe('Partial text before cancel');
  });

  // 7. failed assistant state persisted
  it('7. failed assistant state and error message are persisted in store', async () => {
    registry.register(new FailingStreamProvider());

    const events: any[] = [];
    for await (const event of runtime.send({
      message: 'Fail test',
      preferredProviderId: 'failing-provider'
    })) {
      events.push(event);
    }

    const sessions = await store.listSessions();
    const turns = await store.getTurns(sessions[0]!.id);
    const assistantTurn = turns.find(t => t.role === 'assistant');

    expect(assistantTurn?.status).toBe('failed');
    expect(assistantTurn?.content).toBe('Partial text before boom');
    expect(assistantTurn?.error).toBe('Engine exploded');
  });

  // 8. no DB write per response_delta
  it('8. strictly prevents DB writes on response_delta events (100 deltas test)', async () => {
    const hundredChunks = Array.from({ length: 100 }, (_, i) => `chunk_${i} `);
    const bigProvider = new MockStreamProvider('hundred-chunks-provider', hundredChunks);
    registry.register(bigProvider);

    const initialWriteCount = store.writeCount;

    for await (const _ of runtime.send({
      message: 'Stream 100 deltas',
      preferredProviderId: 'hundred-chunks-provider'
    })) {
      // consume stream
    }

    const writesOccurred = store.writeCount - initialWriteCount;
    // Expected writes:
    // 1. createSession
    // 2. createTurn (user)
    // 3. updateSession (provider selected)
    // 4. createTurn (assistant pending)
    // 5. updateTurn (assistant final completed)
    // Total writes should be exactly 5, NOT 100+ writes!
    expect(writesOccurred).toBe(5);
  });

  // 9. existing persisted session can be hydrated
  it('9. on-demand hydrates existing session from persistent store', async () => {
    const preExistingSession: Session = {
      id: 'stored-sess-42',
      createdAt: 500,
      updatedAt: 600,
      status: 'active',
      mode: 'conversation',
      title: 'Historical Session'
    };
    const preExistingTurn: ConversationTurn = {
      id: 'turn-old-1',
      sessionId: 'stored-sess-42',
      requestId: 'req-old',
      role: 'user',
      content: 'Past message',
      status: 'completed',
      createdAt: 550
    };

    await store.createSession(preExistingSession);
    await store.createTurn(preExistingTurn);

    // Fresh runtime with empty in-memory SessionManager
    const freshSessionManager = new SessionManager();
    const freshRuntime = new ConversationRuntime({
      sessionManager: freshSessionManager,
      contextManager,
      router,
      store
    });

    expect(freshSessionManager.hasSession('stored-sess-42')).toBe(false);

    // loadSession should hydrate it
    const loaded = await freshRuntime.loadSession('stored-sess-42');
    expect(loaded).toBeDefined();
    expect(freshSessionManager.hasSession('stored-sess-42')).toBe(true);

    const turns = freshSessionManager.getTurns('stored-sess-42');
    expect(turns).toHaveLength(1);
    expect(turns[0]?.content).toBe('Past message');
  });

  // 10. resumed conversation builds previous context
  it('10. resumed conversation includes previous turns in context', async () => {
    // 1st request on original runtime
    let sessionId: string = '';
    for await (const event of runtime.send({ message: 'My favorite color is Blue' })) {
      if (event.type === 'session_ready') {
        sessionId = event.sessionId;
      }
    }

    // Now spin up an entirely FRESH runtime instance sharing only the store
    const freshSessionManager = new SessionManager();
    const freshProvider = new MockStreamProvider('fresh-provider');
    const freshRegistry = new BrainProviderRegistry();
    freshRegistry.register(freshProvider);
    const freshRouter = new BrainRouter({
      registry: freshRegistry,
      defaultProvider: 'fresh-provider'
    });

    const freshRuntime = new ConversationRuntime({
      sessionManager: freshSessionManager,
      contextManager: new ContextManager(),
      router: freshRouter,
      store
    });

    // 2nd request to the same sessionId
    for await (const _ of freshRuntime.send({
      sessionId,
      message: 'What did I say earlier?'
    })) {
      // consume
    }

    // Inspect the messages passed to provider.chat()
    const lastRequest = freshProvider.lastRequest;
    expect(lastRequest).toBeDefined();
    expect(lastRequest?.messages).toHaveLength(3);
    expect(lastRequest?.messages[0]?.role).toBe('user');
    expect(lastRequest?.messages[0]?.content).toBe('My favorite color is Blue');
    expect(lastRequest?.messages[1]?.role).toBe('assistant');
    expect(lastRequest?.messages[1]?.content).toBe('Hello world!');
    expect(lastRequest?.messages[2]?.role).toBe('user');
    expect(lastRequest?.messages[2]?.content).toBe('What did I say earlier?');
  });

  // 11. independent sessions persist independently
  it('11. multiple sessions and turns persist independently without cross-talk', async () => {
    let sessionAId = '';
    for await (const e of runtime.send({ message: 'Session A message' })) {
      if (e.type === 'session_ready') sessionAId = e.sessionId;
    }

    let sessionBId = '';
    for await (const e of runtime.send({ message: 'Session B message' })) {
      if (e.type === 'session_ready') sessionBId = e.sessionId;
    }

    expect(sessionAId).not.toBe(sessionBId);

    const turnsA = await store.getTurns(sessionAId);
    const turnsB = await store.getTurns(sessionBId);

    expect(turnsA[0]?.content).toBe('Session A message');
    expect(turnsB[0]?.content).toBe('Session B message');
  });

  // 12. persistence failure becomes normalized runtime failure
  it('12. persistence failure surfaces normalized persistence_error', async () => {
    // Store that fails on createSession
    const failingStore: any = {
      createSession: async () => { throw new Error('Disk full'); },
      updateSession: async () => {},
      getSession: async () => undefined,
      createTurn: async () => {},
      updateTurn: async () => {},
      getTurns: async () => []
    };

    const faultyRuntime = new ConversationRuntime({
      sessionManager: new SessionManager(),
      contextManager,
      router,
      store: failingStore
    });

    const events: any[] = [];
    for await (const event of faultyRuntime.send({ message: 'Will fail write' })) {
      events.push(event);
    }

    const failureEvent = events.find(e => e.type === 'request_failed');
    expect(failureEvent).toBeDefined();
    expect(failureEvent.error.code).toBe('persistence_error');
    expect(failureEvent.error.message).toContain('Disk full');
  });

  // 13. runtime active-request cleanup still occurs after persistence error
  it('13. active request tracking is cleaned up after persistence failure', async () => {
    const failingStore: any = {
      createSession: async () => { throw new Error('Write failure'); },
      updateSession: async () => {},
      getSession: async () => undefined,
      createTurn: async () => {},
      updateTurn: async () => {},
      getTurns: async () => []
    };

    const faultyRuntime = new ConversationRuntime({
      sessionManager: new SessionManager(),
      contextManager,
      router,
      store: failingStore
    });

    try {
      for await (const _ of faultyRuntime.send(
        { message: 'Fail test' },
        { throwOnError: true }
      )) {
        // consume
      }
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConversationRuntimeError);
      expect(err.code).toBe('persistence_error');
    }

    // Active request count must be 0
    expect(faultyRuntime.getActiveRequestCount()).toBe(0);
  });
});
