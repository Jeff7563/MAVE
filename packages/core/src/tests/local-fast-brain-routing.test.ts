import { describe, it, expect, vi } from 'vitest';
import {
  BrainProviderRegistry,
  BrainRouter,
  ContextManager,
  ConversationRuntime,
  SessionManager
} from '../index.js';
import { InMemoryConversationStore } from '../conversation/in-memory-store.js';
import { OllamaBrainProvider } from '@mave/providers';

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

describe('BrainRouter & Runtime Routing with Promoted Local Fast Brain (Pre-M5 F1.5-C3)', () => {
  const QUALIFIED_DIGEST = '65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b';

  it('1. AUTO FAST conversation selects promoted qwen2.5:1.5b', async () => {
    const mockTags = {
      models: [
        {
          name: 'qwen2.5:1.5b',
          digest: QUALIFIED_DIGEST,
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
    registry.register(provider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Ollama Local Model Provider'
    });

    const router = new BrainRouter({
      registry,
      defaultProvider: 'ollama'
    });

    const decision = await router.route({ profileId: 'fast_conversation' });
    expect(decision.providerId).toBe('ollama');
    expect(decision.modelId).toBe('ollama-qwen2.5-1.5b');
  });

  it('2. qwen2.5:7b NEVER automatically wins FAST conversation even if installed and has higher quality score', async () => {
    const mockTags = {
      models: [
        {
          name: 'qwen2.5:7b',
          digest: '845dbda0ea48ed749caafd9e6037047aa19acfcfd82e704d7ca97d631a0b697e',
          details: { parameter_size: '7.6B', context_length: 32768 },
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
    registry.register(provider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Ollama Local Model Provider'
    });

    const router = new BrainRouter({
      registry,
      defaultProvider: 'ollama'
    });

    // 7B is unapproved for production, so fast_conversation fails closed rather than picking 7B
    await expect(router.route({ profileId: 'fast_conversation' })).rejects.toThrow();
  });

  it('3. agent_work invariant: agent_work NEVER routes to Ollama conversational fast brain', async () => {
    const mockTags = {
      models: [
        {
          name: 'qwen2.5:1.5b',
          digest: QUALIFIED_DIGEST,
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
    registry.register(provider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Ollama Local Model Provider'
    });

    const router = new BrainRouter({
      registry,
      defaultProvider: 'ollama'
    });

    // agent_work requires agent_runtime_provider and coding: true
    await expect(router.route({ profileId: 'agent_work' })).rejects.toThrow();
  });

  it('4. localOnly constraint routes to local fast brain and fails closed when offline', async () => {
    const mockTags = {
      models: [
        {
          name: 'qwen2.5:1.5b',
          digest: QUALIFIED_DIGEST,
          details: { parameter_size: '1.5B', context_length: 32768 },
          capabilities: ['completion']
        }
      ]
    };

    const onlineFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/api/tags')) return createJsonResponse(mockTags);
      if (url.endsWith('/api/version')) return createJsonResponse({ version: '0.40.4' });
      return createJsonResponse({});
    });

    const onlineProvider = new OllamaBrainProvider({ fetchFn: onlineFetch });
    const registry = new BrainProviderRegistry();
    registry.register(onlineProvider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local'
    });

    const router = new BrainRouter({ registry, defaultProvider: 'ollama' });

    const decision = await router.route({
      profileId: 'fast_conversation',
      overrides: { localOnly: true }
    });
    expect(decision.providerId).toBe('ollama');
    expect(decision.modelId).toBe('ollama-qwen2.5-1.5b');

    // Offline provider fail-closed
    const offlineFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
    const offlineProvider = new OllamaBrainProvider({ fetchFn: offlineFetch });
    const offlineRegistry = new BrainProviderRegistry();
    offlineRegistry.register(offlineProvider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local'
    });

    const offlineRouter = new BrainRouter({ registry: offlineRegistry, defaultProvider: 'ollama' });
    await expect(
      offlineRouter.route({ profileId: 'fast_conversation', overrides: { localOnly: true } })
    ).rejects.toThrow();
  });

  it('5. chat execution records RouteTelemetry with routeAttempts: 1 and attemptedModelIds', async () => {
    const ndjson = [
      { model: 'qwen2.5:1.5b', message: { role: 'assistant', content: 'สวัสดี' }, done: false },
      {
        model: 'qwen2.5:1.5b',
        message: { role: 'assistant', content: 'ครับ' },
        done: true,
        prompt_eval_count: 5,
        eval_count: 10,
        total_duration: 100000000
      }
    ];

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/api/tags')) {
        return createJsonResponse({
          models: [{ name: 'qwen2.5:1.5b', digest: QUALIFIED_DIGEST, capabilities: ['completion'] }]
        });
      }
      if (url.endsWith('/api/version')) return createJsonResponse({ version: '0.40.4' });
      if (url.endsWith('/api/generate')) return createJsonResponse({ done: true });
      if (url.endsWith('/api/chat')) return createMockNdjsonResponse(ndjson);
      return createJsonResponse({});
    });

    const provider = new OllamaBrainProvider({ fetchFn: mockFetch });
    const registry = new BrainProviderRegistry();
    registry.register(provider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Ollama Local Model Provider'
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
      requestId: 'req-route-telemetry-c3',
      message: 'Hello',
      preferredProviderId: 'ollama'
    })) {
      events.push(ev);
    }

    const completed = events.find((e) => e.type === 'response_completed');
    expect(completed).toBeDefined();

    const telemetry = runtime.getExecutionTelemetry('req-route-telemetry-c3');
    expect(telemetry!.selectedProviderId).toBe('ollama');
    expect(telemetry!.selectedModelId).toBe('ollama-qwen2.5-1.5b');
    expect(telemetry!.attemptedProviderIds).toEqual(['ollama']);
    expect(telemetry!.attemptedModelIds).toEqual(['ollama-qwen2.5-1.5b']);
    expect(telemetry!.routeAttempts).toBe(1);
  });
});
