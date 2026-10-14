import { describe, it, expect, vi } from 'vitest';
import type { BrainRequest, BrainRequestOptions } from '@mave/contracts';
import {
  OpenAIBrainProvider,
  OPENAI_PROVIDER_ID,
  OPENAI_FAST_MODEL_ID,
  OPENAI_BALANCED_MODEL_ID,
  sanitizeErrorMessage
} from '../brain/openai.js';

function createMockSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' }
  });
}

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('OpenAIBrainProvider (F1.5 Production Fast Brain Candidate)', () => {
  const sampleRequest: BrainRequest = {
    requestId: 'req-fast-1',
    sessionId: 'sess-1',
    intent: 'conversation',
    systemPrompt: 'You are MAVE.',
    messages: [
      { role: 'user', content: 'สวัสดี MAVE' }
    ]
  };

  describe('Configuration & Initialization', () => {
    it('1. provider identification matches canonical contracts', () => {
      const provider = new OpenAIBrainProvider({ apiKey: 'test-key' });
      expect(provider.id).toBe(OPENAI_PROVIDER_ID);
      expect(provider.isConfigured()).toBe(true);

      const descriptor = provider.getDescriptor();
      expect(descriptor.id).toBe(OPENAI_PROVIDER_ID);
      expect(descriptor.kind).toBe('model_provider');
      expect(descriptor.accessPath).toBe('official_api');
      expect(descriptor.defaultModelId).toBe(OPENAI_FAST_MODEL_ID);
    });

    it('2. isConfigured reflects absence of apiKey', () => {
      const origKey = process.env['OPENAI_API_KEY'];
      delete process.env['OPENAI_API_KEY'];
      try {
        const provider = new OpenAIBrainProvider({ apiKey: '' });
        expect(provider.isConfigured()).toBe(false);
      } finally {
        if (origKey !== undefined) {
          process.env['OPENAI_API_KEY'] = origKey;
        }
      }
    });

    it('3. sanitizeErrorMessage redacts bearer tokens, sk- keys, and paths', () => {
      const raw = 'Failed at C:\\Users\\Secret\\test.ts with Bearer sk-12345678901234567890abcdef and key sk-99887766554433221100aabb';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('Secret');
      expect(sanitized).not.toContain('12345678901234567890abcdef');
      expect(sanitized).not.toContain('99887766554433221100aabb');
      expect(sanitized).toContain('Bearer [REDACTED]');
      expect(sanitized).toContain('sk-[REDACTED]');
      expect(sanitized).toContain('[PATH_REDACTED]');
    });

    it('4. default apiMode is responses and can be configured to chat_completions', () => {
      const defaultProvider = new OpenAIBrainProvider({ apiKey: 'test' });
      expect(defaultProvider.getApiMode()).toBe('responses');

      const chatProvider = new OpenAIBrainProvider({ apiKey: 'test', apiMode: 'chat_completions' });
      expect(chatProvider.getApiMode()).toBe('chat_completions');
    });
  });

  describe('Health Checks (Zero Generation Quota Guarantees)', () => {
    it('5. health returns unconfigured with zero network calls when apiKey is missing', async () => {
      const mockFetch = vi.fn();
      const provider = new OpenAIBrainProvider({ apiKey: '', fetchFn: mockFetch });

      const health = await provider.health();
      expect(health.status).toBe('unconfigured');
      expect(health.message).toContain('not configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('6. health calls GET /models (metadata endpoint, never generation endpoint)', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        requestedUrl = url;
        requestedMethod = init?.method ?? 'GET';
        return createJsonResponse({ data: [{ id: 'gpt-4o-mini' }] }, 200);
      });

      const provider = new OpenAIBrainProvider({
        apiKey: 'sk-test-key-valid-12345',
        baseUrl: 'https://api.openai.com/v1',
        fetchFn: mockFetch
      });

      const health = await provider.health();
      expect(health.status).toBe('healthy');
      expect(requestedUrl).toBe('https://api.openai.com/v1/models');
      expect(requestedMethod).toBe('GET');
      expect(requestedUrl).not.toContain('chat/completions');
      expect(requestedUrl).not.toContain('responses');
    });

    it('7. health translates 401/403 into auth_error without leaking auth headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createJsonResponse({ error: { message: 'Incorrect API key provided: sk-secret' } }, 401)
      );

      const provider = new OpenAIBrainProvider({
        apiKey: 'sk-invalid-key-99999',
        fetchFn: mockFetch
      });

      const health = await provider.health();
      expect(health.status).toBe('auth_error');
      expect(health.message).toContain('authentication failed');
      expect(health.message).not.toContain('sk-invalid-key');
    });

    it('8. health translates 429 quota into quota_limited and rate limit into rate_limited', async () => {
      // Quota check
      const mockFetchQuota = vi.fn().mockResolvedValue(
        createJsonResponse({ error: { code: 'insufficient_quota', message: 'You exceeded your current quota' } }, 429)
      );
      const providerQuota = new OpenAIBrainProvider({ apiKey: 'sk-key', fetchFn: mockFetchQuota });
      const healthQuota = await providerQuota.health();
      expect(healthQuota.status).toBe('quota_limited');

      // Rate limit check
      const mockFetchRate = vi.fn().mockResolvedValue(
        createJsonResponse({ error: { code: 'rate_limit_exceeded', message: 'Rate limit reached' } }, 429)
      );
      const providerRate = new OpenAIBrainProvider({ apiKey: 'sk-key', fetchFn: mockFetchRate });
      const healthRate = await providerRate.health();
      expect(healthRate.status).toBe('rate_limited');
    });

    it('9. health translates 5xx and network failures into unavailable', async () => {
      const mockFetch500 = vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 500 }));
      const provider500 = new OpenAIBrainProvider({ apiKey: 'sk-key', fetchFn: mockFetch500 });
      const health500 = await provider500.health();
      expect(health500.status).toBe('unavailable');

      const mockFetchThrow = vi.fn().mockRejectedValue(new Error('Connection refused at 127.0.0.1:443'));
      const providerThrow = new OpenAIBrainProvider({ apiKey: 'sk-key', fetchFn: mockFetchThrow });
      const healthThrow = await providerThrow.health();
      expect(healthThrow.status).toBe('unavailable');
      expect(healthThrow.message).toContain('unreachable');
    });
  });

  describe('Model Catalog & Descriptors', () => {
    it('10. exposes canonical ModelCatalogSnapshot with normalized ModelIds and documented context/cost', async () => {
      const provider = new OpenAIBrainProvider({ apiKey: 'test-key' });
      const catalog = await provider.getCatalog();

      expect(catalog.providerId).toBe(OPENAI_PROVIDER_ID);
      expect(catalog.models.length).toBe(2);

      const fastModel = catalog.models.find(m => m.id === OPENAI_FAST_MODEL_ID);
      expect(fastModel).toBeDefined();
      expect(fastModel?.providerId).toBe(OPENAI_PROVIDER_ID);
      expect(fastModel?.latencyClass).toBe('interactive');
      expect(fastModel?.qualityClass).toBe('fast');
      expect(fastModel?.costClass).toBe('low');
      expect(fastModel?.contextWindowTokens).toBe(128000);
      expect(fastModel?.status).toBe('available');
      expect(fastModel?.capabilities.fastChat).toBe(true);
      expect(fastModel?.capabilities.streaming).toBe(true);
      expect(fastModel?.capabilities.supportsThai).toBe(true);
      expect(fastModel?.capabilities.supportsEnglish).toBe(true);

      const balancedModel = catalog.models.find(m => m.id === OPENAI_BALANCED_MODEL_ID);
      expect(balancedModel).toBeDefined();
      expect(balancedModel?.qualityClass).toBe('balanced');
      expect(balancedModel?.latencyClass).toBe('balanced');
      expect(balancedModel?.costClass).toBe('medium');
      expect(balancedModel?.contextWindowTokens).toBe(128000);
    });

    it('11. catalog models show unavailable when unconfigured', async () => {
      const provider = new OpenAIBrainProvider({ apiKey: '' });
      const catalog = await provider.getCatalog();
      for (const m of catalog.models) {
        expect(m.status).toBe('unavailable');
      }
    });
  });

  describe('Execution & Invariants', () => {
    it('12. direct model route strictly requires options.modelId', async () => {
      const provider = new OpenAIBrainProvider({ apiKey: 'test-key' });

      // Missing options
      const events: any[] = [];
      for await (const evt of provider.chat(sampleRequest)) {
        events.push(evt);
      }
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('error');
      expect(events[0].error.code).toBe('model_unavailable');
      expect(events[0].error.message).toContain('requires a resolved modelId');

      // Empty options.modelId
      const events2: any[] = [];
      for await (const evt of provider.chat(sampleRequest, {} as BrainRequestOptions)) {
        events2.push(evt);
      }
      expect(events2[0].type).toBe('error');
      expect(events2[0].error.code).toBe('model_unavailable');
    });

    it('13. unknown options.modelId fails with model_unavailable', async () => {
      const provider = new OpenAIBrainProvider({ apiKey: 'test-key' });

      const events: any[] = [];
      for await (const evt of provider.chat(sampleRequest, { modelId: 'non-existent-model' })) {
        events.push(evt);
      }
      expect(events[0].type).toBe('error');
      expect(events[0].error.code).toBe('model_unavailable');
      expect(events[0].error.message).toContain("Unknown or unmapped model 'non-existent-model'");
    });

    it('14. chat fails safely when apiKey is unconfigured', async () => {
      const provider = new OpenAIBrainProvider({ apiKey: '' });

      const events: any[] = [];
      for await (const evt of provider.chat(sampleRequest, { modelId: OPENAI_FAST_MODEL_ID })) {
        events.push(evt);
      }
      expect(events[0].type).toBe('error');
      expect(events[0].error.code).toBe('provider_unconfigured');
    });

    it('15. modern Responses API streaming happy path (default apiMode)', async () => {
      const responsesSseChunks = [
        'data: {"type": "response.created"}\n\n',
        'data: {"type": "response.output_text.delta", "delta": "สวัสดี"}\n\n',
        'data: {"type": "response.output_text.delta", "delta": "ครับ MAVE พร้อม"}\n\n',
        'data: {"type": "response.output_text.delta", "delta": "ให้บริการ"}\n\n',
        'data: {"type": "response.completed", "response": {"status": "completed", "usage": {"input_tokens": 12, "output_tokens": 8, "total_tokens": 20}}}\n\n'
      ];

      let capturedUrl = '';
      let capturedBody: any;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init?.body as string);
        return createMockSseResponse(responsesSseChunks);
      });

      const provider = new OpenAIBrainProvider({
        apiKey: 'sk-test-key-12345',
        fetchFn: mockFetch
      });

      const events: any[] = [];
      for await (const evt of provider.chat(sampleRequest, { modelId: OPENAI_FAST_MODEL_ID })) {
        events.push(evt);
      }

      // Check Responses API endpoint & payload
      expect(capturedUrl).toContain('/responses');
      expect(capturedBody.model).toBe('gpt-4o-mini'); // Adapter-private mapping verified!
      expect(capturedBody.instructions).toBe('You are MAVE.');
      expect(capturedBody.input).toEqual([
        { role: 'user', content: 'สวัสดี MAVE' }
      ]);
      expect(capturedBody.stream).toBe(true);
      expect(capturedBody.store).toBe(false); // Stateless privacy confirmed!

      // Check events stream
      expect(events[0].type).toBe('started');
      expect(events[0].providerId).toBe(OPENAI_PROVIDER_ID);
      expect(events[0].modelId).toBe(OPENAI_FAST_MODEL_ID);

      const deltas = events.filter(e => e.type === 'delta').map(e => e.text);
      expect(deltas.join('')).toBe('สวัสดีครับ MAVE พร้อมให้บริการ');

      const completed = events.find(e => e.type === 'completed');
      expect(completed).toBeDefined();
      expect(completed.text).toBe('สวัสดีครับ MAVE พร้อมให้บริการ');
      expect(completed.usage).toEqual({
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20
      });
      expect(completed.timing.timeToFirstTokenMs).toBeGreaterThanOrEqual(0);
      expect(completed.timing.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(completed.finishReason).toBe('completed');
    });

    it('16. legacy Chat Completions API streaming happy path (apiMode = chat_completions)', async () => {
      const chatSseChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":4,"total_tokens":14}}\n\n',
        'data: [DONE]\n\n'
      ];

      let capturedUrl = '';
      let capturedBody: any;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init?.body as string);
        return createMockSseResponse(chatSseChunks);
      });

      const provider = new OpenAIBrainProvider({
        apiKey: 'sk-test-key-12345',
        apiMode: 'chat_completions',
        fetchFn: mockFetch
      });

      const events: any[] = [];
      for await (const evt of provider.chat(sampleRequest, { modelId: OPENAI_FAST_MODEL_ID })) {
        events.push(evt);
      }

      expect(capturedUrl).toContain('/chat/completions');
      expect(capturedBody.messages).toEqual([
        { role: 'system', content: 'You are MAVE.' },
        { role: 'user', content: 'สวัสดี MAVE' }
      ]);

      const deltas = events.filter(e => e.type === 'delta').map(e => e.text);
      expect(deltas.join('')).toBe('Hello World');

      const completed = events.find(e => e.type === 'completed');
      expect(completed?.usage).toEqual({
        promptTokens: 10,
        completionTokens: 4,
        totalTokens: 14
      });
      expect(completed?.finishReason).toBe('stop');
    });

    it('17. AbortSignal cancellation aborts stream promptly', async () => {
      const controller = new AbortController();

      const encoder = new TextEncoder();
      let streamCancelled = false;
      const slowStream = new ReadableStream({
        async start(streamController) {
          streamController.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"Part 1"}\n\n'));
          // Wait briefly, abort, and attempt next
          await new Promise(r => setTimeout(r, 20));
          if (!streamCancelled) {
            streamController.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"Part 2"}\n\n'));
            streamController.close();
          }
        },
        cancel() {
          streamCancelled = true;
        }
      });

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(slowStream, { headers: { 'Content-Type': 'text/event-stream' } })
      );

      const provider = new OpenAIBrainProvider({
        apiKey: 'sk-test-key-12345',
        fetchFn: mockFetch
      });

      const events: any[] = [];
      for await (const evt of provider.chat(sampleRequest, {
        modelId: OPENAI_FAST_MODEL_ID,
        signal: controller.signal
      })) {
        events.push(evt);
        if (evt.type === 'delta') {
          controller.abort('barge_in');
        }
      }

      const types = events.map(e => e.type);
      expect(types).toContain('started');
      expect(types).toContain('delta');
      expect(types).toContain('cancelled');
      expect(types).not.toContain('completed');
    });

    it('18. provider handles 401 authentication error safely in chat', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createJsonResponse({ error: { message: 'Invalid API key' } }, 401)
      );

      const provider = new OpenAIBrainProvider({ apiKey: 'sk-bad-key', fetchFn: mockFetch });

      const events: any[] = [];
      for await (const evt of provider.chat(sampleRequest, { modelId: OPENAI_FAST_MODEL_ID })) {
        events.push(evt);
      }

      expect(events[1].type).toBe('error');
      expect(events[1].error.code).toBe('provider_auth');
      expect(events[1].error.message).toContain('authentication failed');
    });

    it('19. provider handles 429 quota and rate limit errors safely in chat', async () => {
      const mockFetchQuota = vi.fn().mockResolvedValue(
        createJsonResponse({ error: { code: 'insufficient_quota', message: 'Quota exceeded' } }, 429)
      );
      const providerQuota = new OpenAIBrainProvider({ apiKey: 'sk-key', fetchFn: mockFetchQuota });
      const eventsQuota: any[] = [];
      for await (const evt of providerQuota.chat(sampleRequest, { modelId: OPENAI_FAST_MODEL_ID })) {
        eventsQuota.push(evt);
      }
      expect(eventsQuota[1].error.code).toBe('quota_limited');

      const mockFetchRate = vi.fn().mockResolvedValue(
        createJsonResponse({ error: { code: 'rate_limit', message: 'Slow down' } }, 429)
      );
      const providerRate = new OpenAIBrainProvider({ apiKey: 'sk-key', fetchFn: mockFetchRate });
      const eventsRate: any[] = [];
      for await (const evt of providerRate.chat(sampleRequest, { modelId: OPENAI_FAST_MODEL_ID })) {
        eventsRate.push(evt);
      }
      expect(eventsRate[1].error.code).toBe('rate_limited');
    });

    it('20. concurrency safety: concurrent invocations with distinct modelIds execute independently', async () => {
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        const modelName = body.model;
        const sse = [
          `data: {"type":"response.output_text.delta","delta":"Response from ${modelName}"}\n\n`,
          'data: {"type":"response.completed"}\n\n'
        ];
        return createMockSseResponse(sse);
      });

      const provider = new OpenAIBrainProvider({ apiKey: 'sk-key', fetchFn: mockFetch });

      const [res1, res2] = await Promise.all([
        (async () => {
          const evts: any[] = [];
          for await (const e of provider.chat({ ...sampleRequest, requestId: 'req-c1' }, { modelId: OPENAI_FAST_MODEL_ID })) {
            evts.push(e);
          }
          return evts;
        })(),
        (async () => {
          const evts: any[] = [];
          for await (const e of provider.chat({ ...sampleRequest, requestId: 'req-c2' }, { modelId: OPENAI_BALANCED_MODEL_ID })) {
            evts.push(e);
          }
          return evts;
        })()
      ]);

      const delta1 = res1.find(e => e.type === 'delta')?.text;
      const delta2 = res2.find(e => e.type === 'delta')?.text;

      expect(delta1).toBe('Response from gpt-4o-mini');
      expect(delta2).toBe('Response from gpt-4o');
    });
  });
});
