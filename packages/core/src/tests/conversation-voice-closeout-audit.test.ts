import { describe, it, expect, vi } from 'vitest';
import {
  BrainProviderRegistry,
  BrainRouter,
  ContextManager,
  ConversationRuntime,
  SessionManager
} from '../index.js';
import { InMemoryConversationStore } from '../conversation/in-memory-store.js';
import {
  OllamaBrainProvider,
  AntigravityBrainProvider,
  OpenAIBrainProvider
} from '@mave/providers';
import type {
  BrainCapabilities,
  BrainRequest,
  BrainRequestOptions,
  ModelCatalogProvider,
  ModelCatalogSnapshot,
  ProviderDescriptor,
  ProviderHealth
} from '@mave/contracts';
import {
  LanguageRoleplayStateSchema,
  PronunciationGuidanceSchema,
  assertNoFakePronunciationScoring,
  stepOutOfRoleplay,
  resumeRoleplay
} from '@mave/contracts';

const QUALIFIED_QWEN_DIGEST = '65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b';

function createMockNdjsonResponse(lines: unknown[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const item of lines) {
        const line = typeof item === 'string' ? item : JSON.stringify(item);
        controller.enqueue(encoder.encode(line + '\n'));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'application/x-ndjson' }
  });
}

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

interface StubCatalogOptions {
  id: string;
  deltas?: string[];
  delayMs?: number;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  midStreamError?: string;
  onCancel?: () => void;
}

function createCatalogModelStub(options: StubCatalogOptions): ModelCatalogProvider {
  let lastRequest: BrainRequest | undefined;
  let lastOptions: BrainRequestOptions | undefined;
  let cancelCalled = false;

  const caps: BrainCapabilities = {
    streaming: true,
    fastChat: true,
    reasoning: true,
    coding: false,
    toolUse: false,
    multimodal: false,
    vision: false,
    webResearch: false,
    longContext: false,
    local: true,
    structuredOutput: true,
    cancellation: true,
    supportsThai: true,
    supportsEnglish: true
  };

  return {
    id: options.id,
    getCapabilities: () => caps,
    health: async (): Promise<ProviderHealth> => ({
      status: options.healthStatus ?? 'healthy',
      checkedAt: Date.now()
    }),
    getCatalog: async (): Promise<ModelCatalogSnapshot> => ({
      providerId: options.id,
      models: [
        {
          id: `${options.id}-default`,
          providerId: options.id,
          displayName: `${options.id}-default`,
          status: 'available',
          latencyClass: 'interactive',
          qualityClass: 'fast',
          costClass: 'free',
          contextClass: 'standard',
          contextWindowTokens: 8192,
          privacyClass: 'local_only',
          capabilities: caps
        }
      ],
      refreshedAt: Date.now()
    }),
    getDescriptor: (): ProviderDescriptor => ({
      id: options.id,
      kind: 'model_provider',
      displayName: options.id,
      accessPath: 'local_runtime',
      capabilities: caps,
      health: { status: options.healthStatus ?? 'healthy', checkedAt: Date.now() }
    }),
    async *chat(req: BrainRequest, opts?: BrainRequestOptions) {
      lastRequest = req;
      lastOptions = opts;

      yield { type: 'started', requestId: req.requestId, providerId: options.id, modelId: `${options.id}-default` };

      if (options.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }

      const deltas = options.deltas ?? ['Hello ', 'from stub!'];
      for (const d of deltas) {
        if (opts?.signal?.aborted) {
          yield { type: 'cancelled', requestId: req.requestId, reason: 'user_cancelled' };
          return;
        }
        yield { type: 'delta', requestId: req.requestId, text: d };
      }

      if (options.midStreamError) {
        yield {
          type: 'error',
          requestId: req.requestId,
          error: { code: 'runtime_error', message: options.midStreamError, retryable: false }
        };
        return;
      }

      if (opts?.signal?.aborted) {
        yield { type: 'cancelled', requestId: req.requestId, reason: 'user_cancelled' };
        return;
      }

      const fullText = deltas.join('');
      yield { type: 'completed', requestId: req.requestId, text: fullText };
    },
    cancel: async () => {
      cancelCalled = true;
      options.onCancel?.();
    },
    // Inspection helpers attached
    ...({
      getLastRequest: () => lastRequest,
      getLastOptions: () => lastOptions,
      isCancelCalled: () => cancelCalled
    } as any)
  };
}

describe('MAVE C4-A: Voice / Language / Conversation Closeout Audit Tests', () => {
  // ==========================================================================
  // Test 1: Fast conversational request resolves through BrainRouter
  // ==========================================================================
  it('1. fast conversational request resolves through BrainRouter using options.modelId', async () => {
    const mockTags = {
      models: [
        {
          name: 'qwen2.5:1.5b',
          digest: QUALIFIED_QWEN_DIGEST,
          details: { parameter_size: '1.5B', context_length: 32768 },
          capabilities: ['completion']
        }
      ]
    };

    let capturedOptions: BrainRequestOptions | undefined;
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/api/tags')) return createJsonResponse(mockTags);
      if (url.endsWith('/api/version')) return createJsonResponse({ version: '0.40.4' });
      if (url.endsWith('/api/generate')) return createJsonResponse({ done: true });
      if (url.endsWith('/api/chat')) {
        return createMockNdjsonResponse([
          { model: 'qwen2.5:1.5b', message: { role: 'assistant', content: 'Hi there!' }, done: true, prompt_eval_count: 5, eval_count: 5 }
        ]);
      }
      return createJsonResponse({});
    });

    const ollamaProvider = new OllamaBrainProvider({ fetchFn: mockFetch });
    const originalChat = ollamaProvider.chat.bind(ollamaProvider);
    ollamaProvider.chat = (req: BrainRequest, options?: BrainRequestOptions) => {
      capturedOptions = options;
      return originalChat(req, options);
    };

    const registry = new BrainProviderRegistry();
    registry.register(ollamaProvider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Ollama Local Fast Brain'
    });

    const router = new BrainRouter({
      registry,
      defaultProvider: 'ollama'
    });

    const runtime = new ConversationRuntime({
      sessionManager: new SessionManager(),
      contextManager: new ContextManager(),
      router,
      store: new InMemoryConversationStore()
    });

    const events: any[] = [];
    for await (const ev of runtime.send({
      message: 'Hello MAVE',
      taskIntent: 'quick_chat'
    })) {
      events.push(ev);
    }

    const completed = events.find((e) => e.type === 'response_completed');
    expect(completed).toBeDefined();
    expect(completed.text).toBe('Hi there!');

    // Invariant: Direct model execution target MUST use BrainRequestOptions.modelId
    expect(capturedOptions?.modelId).toBe('ollama-qwen2.5-1.5b');
  });

  // ==========================================================================
  // Test 2: Language request preserves language session metadata
  // ==========================================================================
  it('2. language request preserves language session metadata without destroying global conversation state', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();

    const stub = createCatalogModelStub({
      id: 'mock-language-provider',
      deltas: ['Hello! I am your English coach.']
    });

    registry.register(stub, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Mock Language Provider'
    });

    const router = new BrainRouter({ registry, defaultProvider: 'mock-language-provider' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    // Create session with language context metadata
    const session = sessionManager.createSession({
      id: 'lang-session-1',
      mode: 'conversation',
      metadata: {
        languageContext: {
          targetLanguage: 'en',
          nativeLanguage: 'th',
          experienceType: 'speaking_practice'
        }
      }
    });

    // Send language practice turn
    for await (const _ of runtime.send({
      sessionId: session.id,
      message: 'How do I say "ขอบคุณมาก" in English?',
      taskIntent: 'language_practice'
    })) {}

    const capturedRequest = (stub as any).getLastRequest() as BrainRequest;
    expect(capturedRequest).toBeDefined();
    // Invariant: Session metadata is cleanly forwarded in context bundle
    expect((capturedRequest.context as any)?.sessionMetadata?.languageContext?.targetLanguage).toBe('en');
    expect((capturedRequest.context as any)?.sessionMetadata?.languageContext?.experienceType).toBe('speaking_practice');

    // Invariant: Global conversation session state is completely preserved
    const retrievedSession = sessionManager.getSession('lang-session-1');
    expect(retrievedSession).toBeDefined();
    expect(retrievedSession!.id).toBe('lang-session-1');
    expect(retrievedSession!.status).toBe('active');
    expect(retrievedSession!.metadata?.languageContext).toBeDefined();
  });

  // ==========================================================================
  // Test 3: Normal conversation does not become agent_work
  // ==========================================================================
  it('3. normal conversation does not become agent_work and never selects agent runtimes', async () => {
    const registry = new BrainProviderRegistry();
    const mockModelProvider = createCatalogModelStub({ id: 'mock-chat-model' });
    const antigravityAgent = new AntigravityBrainProvider({ workingDirectory: '.' });

    registry.register(mockModelProvider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Chat Model'
    });
    registry.register(antigravityAgent, {
      kind: 'agent_runtime_provider',
      accessPath: 'official_cli',
      accessClass: 'subscription',
      displayName: 'Google Antigravity'
    });

    const router = new BrainRouter({
      registry,
      defaultProvider: 'mock-chat-model'
    });

    // Normal conversational intent must resolve to model_provider, never agent_work
    const decision = await router.route({
      taskIntent: 'general_conversation'
    });

    expect(decision.profileId).toBe('fast_conversation');
    expect(decision.providerKind).toBe('model_provider');
    expect(decision.providerId).toBe('mock-chat-model');
    expect(decision.providerId).not.toBe('antigravity');
  });

  // ==========================================================================
  // Test 4: Model provider / Agent runtime provider boundary
  // ==========================================================================
  it('4. strictly enforces model_provider vs agent_runtime_provider boundary', async () => {
    const registry = new BrainProviderRegistry();
    const mockModelProvider = createCatalogModelStub({ id: 'mock-model' });
    const antigravityAgent = new AntigravityBrainProvider({ workingDirectory: '.' });

    registry.register(mockModelProvider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Direct Model Provider'
    });
    registry.register(antigravityAgent, {
      kind: 'agent_runtime_provider',
      accessPath: 'official_cli',
      accessClass: 'subscription',
      displayName: 'Agent Runtime Provider'
    });

    // 1. fast_conversation CANNOT route to agent_runtime_provider
    const agentOnlyRegistry = new BrainProviderRegistry();
    agentOnlyRegistry.register(antigravityAgent, {
      kind: 'agent_runtime_provider',
      accessPath: 'official_cli',
      accessClass: 'subscription',
      displayName: 'Agent Runtime Provider'
    });
    const agentRouter = new BrainRouter({
      registry: agentOnlyRegistry,
      defaultProvider: 'antigravity'
    });
    await expect(
      agentRouter.route({
        profileId: 'fast_conversation'
      })
    ).rejects.toThrow();

    // 2. agent_work CANNOT route to model_provider (even if registered as default)
    const modelOnlyRegistry = new BrainProviderRegistry();
    modelOnlyRegistry.register(mockModelProvider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Direct Model Provider'
    });
    const modelRouter = new BrainRouter({
      registry: modelOnlyRegistry,
      defaultProvider: 'mock-model'
    });
    await expect(
      modelRouter.route({
        profileId: 'agent_work'
      })
    ).rejects.toThrow();
  });

  // ==========================================================================
  // Test 5: Streaming delta -> completion
  // ==========================================================================
  it('5. streams progressive deltas to completion and updates turn state', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();

    const stub = createCatalogModelStub({
      id: 'stream-provider',
      deltas: ['Hello ', 'world!']
    });

    registry.register(stub, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Stream Provider'
    });

    const router = new BrainRouter({ registry, defaultProvider: 'stream-provider' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const deltas: string[] = [];
    let completedText = '';

    for await (const ev of runtime.send({ message: 'Greet me' })) {
      if (ev.type === 'response_delta') {
        deltas.push(ev.text);
      } else if (ev.type === 'response_completed') {
        completedText = ev.text;
      }
    }

    expect(deltas).toEqual(['Hello ', 'world!']);
    expect(completedText).toBe('Hello world!');

    const sessions = sessionManager.listSessions();
    const turns = sessionManager.getTurns(sessions[0]!.id);
    const assistantTurn = turns.find((t) => t.role === 'assistant');
    expect(assistantTurn?.status).toBe('completed');
    expect(assistantTurn?.content).toBe('Hello world!');
  });

  // ==========================================================================
  // Test 6: Midstream error -> request_failed, no same-turn fallback
  // ==========================================================================
  it('6. midstream failure emits request_failed with NO same-turn cross-provider fallback (F1.4 invariant)', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();

    let fallbackCalled = false;

    const failingPrimary = createCatalogModelStub({
      id: 'failing-primary',
      deltas: ['First token '],
      midStreamError: 'Midstream socket drop'
    });

    const healthyFallback = createCatalogModelStub({
      id: 'healthy-fallback',
      deltas: ['Fallback answer']
    });
    const originalChat = healthyFallback.chat.bind(healthyFallback);
    healthyFallback.chat = (req, opts) => {
      fallbackCalled = true;
      return originalChat(req, opts);
    };

    registry.register(failingPrimary, { kind: 'model_provider', accessPath: 'local_runtime', accessClass: 'local' });
    registry.register(healthyFallback, { kind: 'model_provider', accessPath: 'local_runtime', accessClass: 'local' });

    const router = new BrainRouter({
      registry,
      defaultProvider: 'failing-primary',
      fallbackChain: ['healthy-fallback']
    });

    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const events: any[] = [];
    for await (const ev of runtime.send({ message: 'Will fail midstream' })) {
      events.push(ev);
    }

    const failed = events.find((e) => e.type === 'request_failed');
    expect(failed).toBeDefined();
    expect(failed.error.message).toBe('Midstream socket drop');

    // F1.4 Hard Invariant: NO cross-provider fallback once stream execution began
    expect(fallbackCalled).toBe(false);

    const sessions = sessionManager.listSessions();
    const turns = sessionManager.getTurns(sessions[0]!.id);
    const assistantTurn = turns.find((t) => t.role === 'assistant');
    expect(assistantTurn?.status).toBe('failed');
  });

  // ==========================================================================
  // Test 7: Cancellation
  // ==========================================================================
  it('7. cancellation aborts provider and marks turn cancelled', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();
    let cancelHookInvoked = false;

    const delayProvider = createCatalogModelStub({
      id: 'delay-provider',
      deltas: ['First chunk '],
      delayMs: 30,
      onCancel: () => {
        cancelHookInvoked = true;
      }
    });

    registry.register(delayProvider, { kind: 'model_provider', accessPath: 'local_runtime', accessClass: 'local' });
    const router = new BrainRouter({ registry, defaultProvider: 'delay-provider' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const events: any[] = [];
    const stream = runtime.send({ requestId: 'req-to-cancel', message: 'Please cancel' });

    for await (const ev of stream) {
      events.push(ev);
      if (ev.type === 'response_delta') {
        await runtime.cancel('req-to-cancel');
      }
    }

    const cancelledEv = events.find((e) => e.type === 'request_cancelled');
    expect(cancelledEv).toBeDefined();
    expect(cancelHookInvoked).toBe(true);

    const sessions = sessionManager.listSessions();
    const turns = sessionManager.getTurns(sessions[0]!.id);
    const assistantTurn = turns.find((t) => t.role === 'assistant');
    expect(assistantTurn?.status).toBe('cancelled');
  });

  // ==========================================================================
  // Test 8: localOnly fail-closed
  // ==========================================================================
  it('8. localOnly constraint fails closed when local provider is unavailable', async () => {
    const registry = new BrainProviderRegistry();
    const offlineOllamaFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const offlineOllama = new OllamaBrainProvider({ fetchFn: offlineOllamaFetch });

    registry.register(offlineOllama, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local'
    });

    const router = new BrainRouter({ registry, defaultProvider: 'ollama' });

    // With localOnly: true, offline local provider MUST fail-closed
    await expect(
      router.route({
        profileId: 'fast_conversation',
        localOnly: true
      })
    ).rejects.toThrow();
  });

  // ==========================================================================
  // Test 9: Model digest qualification enforcement
  // ==========================================================================
  it('9. exact digest qualification enforcement rejects unverified or tampered artifacts', async () => {
    const mockTags = {
      models: [
        {
          name: 'qwen2.5:1.5b',
          digest: 'corrupted_or_different_digest_12345',
          details: { parameter_size: '1.5B', context_length: 32768 },
          capabilities: ['completion']
        }
      ]
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/api/tags')) return createJsonResponse(mockTags);
      if (url.endsWith('/api/version')) return createJsonResponse({ version: '0.40.4' });
      return createJsonResponse({});
    });

    const provider = new OllamaBrainProvider({ fetchFn: mockFetch });
    const registry = new BrainProviderRegistry();
    registry.register(provider, { kind: 'model_provider', accessPath: 'local_runtime', accessClass: 'local' });

    const router = new BrainRouter({ registry, defaultProvider: 'ollama' });

    // Because the digest does NOT match the benchmarked production digest, it must NOT qualify as fastChat suitable
    await expect(
      router.route({
        profileId: 'fast_conversation'
      })
    ).rejects.toThrow();
  });

  // ==========================================================================
  // Test 10: Prewarm operation does not count as route attempt
  // ==========================================================================
  it('10. prewarm operation does not emit route telemetry or count route attempts', async () => {
    let generateBody: any;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/generate')) {
        generateBody = JSON.parse(init?.body as string);
        return createJsonResponse({ done: true });
      }
      return createJsonResponse({});
    });

    const provider = new OllamaBrainProvider({ fetchFn: mockFetch });
    const residencyMgr = provider.getResidencyManager();

    expect(residencyMgr.getState()).toBe('unloaded');
    expect(residencyMgr.getActiveLeases()).toBe(0);

    // Perform prewarm
    await provider.prewarm('qwen2.5:1.5b');

    // Prewarm state is now warm in VRAM, activeLeases is 0
    expect(residencyMgr.getState()).toBe('warm');
    expect(residencyMgr.getActiveLeases()).toBe(0);
    expect(generateBody.model).toBe('qwen2.5:1.5b');
    expect(generateBody.keep_alive).toBeDefined();
    // Zero user messages or prompt content in prewarm payload
    expect(generateBody.messages).toBeUndefined();
    expect(generateBody.prompt).toBeUndefined();
  });

  // ==========================================================================
  // Test 11: Conversation/session continuity
  // ==========================================================================
  it('11. preserves multi-turn conversation and session continuity across turns', async () => {
    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const registry = new BrainProviderRegistry();

    const stub = createCatalogModelStub({
      id: 'echo-provider',
      deltas: ['Answer received']
    });

    registry.register(stub, { kind: 'model_provider', accessPath: 'local_runtime', accessClass: 'local' });
    const router = new BrainRouter({ registry, defaultProvider: 'echo-provider' });
    const runtime = new ConversationRuntime({ sessionManager, contextManager, router });

    const session = sessionManager.createSession({ id: 'continuous-sess' });

    // Turn 1
    for await (const _ of runtime.send({ sessionId: session.id, message: 'Turn one' })) {}
    let lastReq = (stub as any).getLastRequest() as BrainRequest;
    expect(lastReq.messages.length).toBe(1);

    // Turn 2
    for await (const _ of runtime.send({ sessionId: session.id, message: 'Turn two' })) {}
    lastReq = (stub as any).getLastRequest() as BrainRequest;
    expect(lastReq.messages.length).toBe(3); // User1 + Assistant1 + User2

    // Turn 3
    for await (const _ of runtime.send({ sessionId: session.id, message: 'Turn three' })) {}
    lastReq = (stub as any).getLastRequest() as BrainRequest;
    expect(lastReq.messages.length).toBe(5); // User1 + Asst1 + User2 + Asst2 + User3

    // Verify session history integrity
    const turns = sessionManager.getTurns(session.id);
    expect(turns.length).toBe(6);
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
  });

  // ==========================================================================
  // Test 12: Roleplay step-out / resume semantics
  // ==========================================================================
  it('12. roleplay step-out and resume preserves roleplay state without wiping conversation history', () => {
    const initialRoleplay = LanguageRoleplayStateSchema.parse({
      scenarioId: 'cafe-order',
      scenarioTitle: 'Ordering at a London Coffee Shop',
      assistantRole: 'Barista',
      userRole: 'Customer',
      targetLanguage: 'en',
      nativeLanguage: 'th'
    });

    expect(initialRoleplay.isSteppedOut).toBe(false);

    // Step out to ask grammar question
    const steppedOut = stepOutOfRoleplay(initialRoleplay, 'ask_vocabulary_question');
    expect(steppedOut.isSteppedOut).toBe(true);
    expect(steppedOut.steppedOutReason).toBe('ask_vocabulary_question');
    expect(steppedOut.scenarioId).toBe('cafe-order');
    expect(steppedOut.assistantRole).toBe('Barista');

    // Resume roleplay
    const resumed = resumeRoleplay(steppedOut);
    expect(resumed.isSteppedOut).toBe(false);
    expect(resumed.steppedOutReason).toBeUndefined();
    expect(resumed.scenarioId).toBe('cafe-order');
  });

  // ==========================================================================
  // Test 13: No fake pronunciation scoring contract
  // ==========================================================================
  it('13. rejects fake pronunciation scores and enforces factual guidance only', () => {
    // Factual guidance passes schema
    const validGuidance = PronunciationGuidanceSchema.parse({
      wordOrPhrase: 'schedule',
      phonetic: '/ˈʃɛdjuːl/ or /ˈskɛdʒuːl/',
      syllables: ['sched', 'ule'],
      ipa: 'ˈskɛdʒ.uːl',
      guidanceTip: 'US pronunciation starts with "sk", British often starts with "sh".'
    });
    expect(validGuidance.wordOrPhrase).toBe('schedule');

    // Attempting to include fake scoring percentage or CEFR grade must be rejected
    expect(() => {
      assertNoFakePronunciationScoring({
        wordOrPhrase: 'schedule',
        scorePercentage: 87.5
      });
    }).toThrow(/Fake pronunciation\/mastery scoring/);

    expect(() => {
      assertNoFakePronunciationScoring({
        wordOrPhrase: 'schedule',
        cefrLevel: 'B2'
      });
    }).toThrow(/Fake pronunciation\/mastery scoring/);

    expect(() => {
      assertNoFakePronunciationScoring({
        wordOrPhrase: 'schedule',
        accuracyScore: 92
      });
    }).toThrow(/Fake pronunciation\/mastery scoring/);
  });

  // ==========================================================================
  // Test 14: Paid API remains default-deny
  // ==========================================================================
  it('14. paid API remains default-deny even if credentials or provider are present', async () => {
    const registry = new BrainProviderRegistry();
    const openaiProvider = new OpenAIBrainProvider({ apiKey: 'sk-test-token-present' });

    registry.register(openaiProvider, {
      kind: 'model_provider',
      accessPath: 'official_api',
      accessClass: 'paid_api',
      displayName: 'OpenAI API'
    });

    // Default configuration: allowPaidApis = false
    const router = new BrainRouter({
      registry,
      defaultProvider: 'openai',
      allowPaidApis: false
    });

    // Invariant: Credential presence != permission to incur API billing.
    await expect(
      router.route({
        profileId: 'fast_conversation',
        preferredProviderId: 'openai',
        allowFallback: false
      })
    ).rejects.toThrow(/paid API billing which is disabled by default policy/);
  });
});
