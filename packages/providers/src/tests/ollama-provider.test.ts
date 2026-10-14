import { describe, it, expect, vi } from 'vitest';
import type { BrainEvent, BrainRequest } from '@mave/contracts';
import { isModelCatalogProvider, ModelCatalogSnapshotSchema } from '@mave/contracts';
import {
  OllamaBrainProvider,
  OLLAMA_PROVIDER_ID,
  assertLoopbackEndpoint,
  normalizeOllamaModelId,
  sanitizeOllamaErrorMessage
} from '../brain/ollama.js';

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

describe('OllamaBrainProvider (F1.5-C1 Local Model Provider Foundation)', () => {
  const sampleRequest: BrainRequest = {
    requestId: 'req-ollama-1',
    sessionId: 'sess-local-1',
    intent: 'conversation',
    systemPrompt: 'You are MAVE, a local voice assistant.',
    messages: [
      { role: 'user', content: 'สวัสดี MAVE ช่วยแนะนำร้านอาหารหน่อย' }
    ]
  };

  describe('1. Provider Identity & Contracts', () => {
    it('implements ModelCatalogProvider and passes isModelCatalogProvider guard', () => {
      const provider = new OllamaBrainProvider();
      expect(isModelCatalogProvider(provider)).toBe(true);
      expect(provider.id).toBe(OLLAMA_PROVIDER_ID);
    });

    it('returns ProviderDescriptor conforming to model_provider and local_runtime', () => {
      const provider = new OllamaBrainProvider();
      const desc = provider.getDescriptor();

      expect(desc.id).toBe('ollama');
      expect(desc.kind).toBe('model_provider');
      expect(desc.accessPath).toBe('local_runtime');
      expect(desc.displayName).toContain('Ollama Local');
      expect(desc.capabilities.local).toBe(true);
      expect(desc.capabilities.fastChat).toBe(true);
      expect(desc.capabilities.streaming).toBe(true);
      expect(desc.capabilities.cancellation).toBe(true);
      // Pre-M5 Safety invariant: NO autonomous tool execution authority
      expect(desc.capabilities.toolUse).toBe(false);
    });
  });

  describe('2. Localhost Security & Endpoint Policy', () => {
    it('accepts loopback addresses (127.0.0.1, localhost, ::1)', () => {
      expect(() => assertLoopbackEndpoint('http://127.0.0.1:11434')).not.toThrow();
      expect(() => assertLoopbackEndpoint('http://localhost:11434')).not.toThrow();
      expect(() => assertLoopbackEndpoint('http://[::1]:11434')).not.toThrow();
      expect(() => new OllamaBrainProvider({ baseUrl: 'http://127.0.0.1:11434' })).not.toThrow();
      expect(() => new OllamaBrainProvider({ baseUrl: 'http://localhost:11434' })).not.toThrow();
    });

    it('rejects remote / non-loopback endpoints to prevent external network egress', () => {
      expect(() => assertLoopbackEndpoint('http://192.168.1.100:11434')).toThrow(/loopback\/local/);
      expect(() => assertLoopbackEndpoint('https://api.ollama.com')).toThrow(/loopback\/local/);
      expect(() => assertLoopbackEndpoint('http://external-host.net:11434')).toThrow(/loopback\/local/);
      expect(() => new OllamaBrainProvider({ baseUrl: 'http://10.0.0.5:11434' })).toThrow(/loopback\/local/);
    });

    it('throws descriptive error on malformed URLs', () => {
      expect(() => assertLoopbackEndpoint('not-a-url')).toThrow(/Invalid Ollama endpoint URL/);
    });
  });

  describe('3. Model Tag Normalization & Sanitization', () => {
    it('normalizes Ollama model tags into canonical slugs', () => {
      expect(normalizeOllamaModelId('qwen2.5:7b')).toBe('ollama-qwen2.5-7b');
      expect(normalizeOllamaModelId('qwen2.5:1.5b')).toBe('ollama-qwen2.5-1.5b');
      expect(normalizeOllamaModelId('deepseek-r1:7b')).toBe('ollama-deepseek-r1-7b');
      expect(normalizeOllamaModelId('library/llama3:8b')).toBe('ollama-library-llama3-8b');
      expect(normalizeOllamaModelId('ollama-already-prefixed')).toBe('ollama-already-prefixed');
    });

    it('sanitizes local filesystem paths from error messages', () => {
      const windowsPath = 'Error loading model at D:\\Ollama\\models\\blobs\\sha256-abc12345 file corrupted';
      const sanitizedWin = sanitizeOllamaErrorMessage(windowsPath);
      expect(sanitizedWin).not.toContain('D:\\Ollama');
      expect(sanitizedWin).toContain('<path>');

      const unixPath = 'Error opening /var/lib/ollama/models/manifests/qwen failed';
      const sanitizedUnix = sanitizeOllamaErrorMessage(unixPath);
      expect(sanitizedUnix).not.toContain('/var/lib/ollama');
      expect(sanitizedUnix).toContain('<path>');
    });
  });

  describe('4. Health Check (Zero Generation Token Invariant)', () => {
    it('dispatches GET /api/version and consumes ZERO generation tokens', async () => {
      let requestedUrl = '';
      let requestedMethod = '';

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        requestedUrl = url;
        requestedMethod = init?.method ?? 'GET';
        return createJsonResponse({ version: '0.33.2' }, 200);
      });

      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });
      const health = await provider.health();

      expect(requestedUrl).toBe('http://127.0.0.1:11434/api/version');
      expect(requestedMethod).toBe('GET');
      expect(health.status).toBe('healthy');
      expect(health.message).toContain('0.33.2');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns unavailable when daemon is offline or connection refused', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      const health = await provider.health();
      expect(health.status).toBe('unavailable');
      expect(health.message).toContain('unreachable');
      expect(health.message).toContain('ECONNREFUSED');
    });

    it('returns degraded when server returns 500', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse({ error: 'internal daemon error' }, 500));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      const health = await provider.health();
      expect(health.status).toBe('degraded');
      expect(health.message).toContain('HTTP 500');
    });
  });

  describe('5. Dynamic Model Catalog Introspection (GET /api/tags)', () => {
    it('introspects installed models from local daemon', async () => {
      const mockTags = {
        models: [
          {
            name: 'qwen2.5:1.5b',
            size: 986000000,
            details: {
              family: 'qwen2',
              families: ['qwen2'],
              parameter_size: '1.5B',
              quantization_level: 'Q4_K_M',
              context_length: 32768
            }
          },
          {
            name: 'deepseek-r1:7b',
            size: 4680000000,
            details: {
              family: 'qwen2',
              parameter_size: '7.6B',
              quantization_level: 'Q4_K_M',
              context_length: 131072
            }
          }
        ]
      };

      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(mockTags, 200));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      const catalog = await provider.getCatalog();
      expect(() => ModelCatalogSnapshotSchema.parse(catalog)).not.toThrow();

      expect(catalog.providerId).toBe('ollama');
      expect(catalog.models).toHaveLength(2);

      const qwen = catalog.models.find((m) => m.id === 'ollama-qwen2.5-1.5b');
      expect(qwen).toBeDefined();
      expect(qwen?.costClass).toBe('free');
      expect(qwen?.privacyClass).toBe('local_only');
      expect(qwen?.latencyClass).toBe('interactive');
      expect(qwen?.qualityClass).toBe('fast');
      expect(qwen?.capabilities.fastChat).toBe(true);
      expect(qwen?.capabilities.supportsThai).toBe(true);
      expect(qwen?.capabilities.toolUse).toBe(false);

      const deepseek = catalog.models.find((m) => m.id === 'ollama-deepseek-r1-7b');
      expect(deepseek).toBeDefined();
      expect(deepseek?.costClass).toBe('free');
      expect(deepseek?.privacyClass).toBe('local_only');
      expect(deepseek?.qualityClass).toBe('reasoning');
      expect(deepseek?.contextClass).toBe('massive');
      expect(deepseek?.contextWindowTokens).toBe(131072);
    });

    it('returns empty catalog safely when daemon fails or is offline', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      const catalog = await provider.getCatalog();
      expect(catalog.providerId).toBe('ollama');
      expect(catalog.models).toHaveLength(0);
      expect(catalog.refreshedAt).toBeGreaterThan(0);
    });

    it('resolves concrete model tag mapping correctly', async () => {
      const mockTags = {
        models: [
          { name: 'qwen2.5:7b', details: { parameter_size: '7B' } }
        ]
      };
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(mockTags, 200));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      await provider.getCatalog();

      expect(provider.resolveConcreteModelTag('ollama-qwen2.5-7b')).toBe('qwen2.5:7b');
      expect(provider.resolveConcreteModelTag('qwen2.5:7b')).toBe('qwen2.5:7b');
    });
  });

  describe('6. Execution Contract & Error Handling', () => {
    it('fails-closed when options.modelId is missing', async () => {
      const provider = new OllamaBrainProvider();
      const events: BrainEvent[] = [];

      for await (const ev of provider.chat(sampleRequest)) {
        events.push(ev);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('error');
      if (events[0]?.type === 'error') {
        expect(events[0].error.code).toBe('model_unavailable');
        expect(events[0].error.message).toContain('requires a resolved modelId');
      }
    });

    it('fails-closed when modelId is unmapped or empty', async () => {
      const provider = new OllamaBrainProvider();
      const events: BrainEvent[] = [];

      for await (const ev of provider.chat(sampleRequest, { modelId: '' })) {
        events.push(ev);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('error');
    });

    it('emits error event when server returns HTTP 404 (model not found)', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('model not found', { status: 404 }));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      const events: BrainEvent[] = [];
      for await (const ev of provider.chat(sampleRequest, { modelId: 'ollama-nonexistent-1b' })) {
        events.push(ev);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('error');
      if (events[0]?.type === 'error') {
        expect(events[0].error.code).toBe('model_unavailable');
        expect(events[0].error.message).toContain('404');
      }
    });

    it('emits error event when daemon is unreachable', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      const events: BrainEvent[] = [];
      for await (const ev of provider.chat(sampleRequest, { modelId: 'ollama-qwen2.5-7b' })) {
        events.push(ev);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('error');
      if (events[0]?.type === 'error') {
        expect(events[0].error.code).toBe('provider_unavailable');
        expect(events[0].error.message).toContain('ECONNREFUSED');
      }
    });
  });

  describe('7. Progressive Streaming & Barge-In Cancellation', () => {
    it('streams NDJSON chunks with started, delta, and completed events', async () => {
      const ndjsonChunks = [
        { model: 'qwen2.5:1.5b', message: { role: 'assistant', content: 'สวัสดี' }, done: false },
        { model: 'qwen2.5:1.5b', message: { role: 'assistant', content: 'ครับ มี' }, done: false },
        { model: 'qwen2.5:1.5b', message: { role: 'assistant', content: 'ร้านแนะนำ' }, done: false },
        {
          model: 'qwen2.5:1.5b',
          message: { role: 'assistant', content: '' },
          done: true,
          done_reason: 'stop',
          prompt_eval_count: 18,
          eval_count: 24,
          total_duration: 350000000
        }
      ];

      let postedBody: any = null;
      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        postedBody = JSON.parse(init?.body as string);
        return createMockNdjsonResponse(ndjsonChunks, 200);
      });

      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });
      const events: BrainEvent[] = [];

      for await (const ev of provider.chat(sampleRequest, { modelId: 'ollama-qwen2.5-1.5b' })) {
        events.push(ev);
      }

      // Verify request payload
      expect(postedBody).toBeDefined();
      expect(postedBody.model).toBe('qwen2.5:1.5b');
      expect(postedBody.stream).toBe(true);
      expect(postedBody.messages).toHaveLength(2); // System prompt + user message
      expect(postedBody.messages[0].role).toBe('system');
      expect(postedBody.messages[1].role).toBe('user');

      // Verify event progression: started -> 3 deltas -> completed
      expect(events[0]?.type).toBe('started');
      if (events[0]?.type === 'started') {
        expect(events[0].providerId).toBe('ollama');
        expect(events[0].modelId).toBe('ollama-qwen2.5-1.5b');
      }

      const deltas = events.filter((e) => e.type === 'delta');
      expect(deltas).toHaveLength(3);
      const fullDeltaText = deltas.map((d) => (d.type === 'delta' ? d.text : '')).join('');
      expect(fullDeltaText).toBe('สวัสดีครับ มีร้านแนะนำ');

      const completed = events.find((e) => e.type === 'completed');
      expect(completed).toBeDefined();
      if (completed && completed.type === 'completed') {
        expect(completed.text).toBe('สวัสดีครับ มีร้านแนะนำ');
        expect(completed.finishReason).toBe('end_turn');
        expect(completed.usage?.promptTokens).toBe(18);
        expect(completed.usage?.completionTokens).toBe(24);
        expect(completed.usage?.totalTokens).toBe(42);
        expect(completed.usage?.estimatedCostUsd).toBe(0); // Zero external API cost
        expect(completed.timing?.timeToFirstTokenMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('aborts immediately and emits cancelled event if signal is pre-aborted', async () => {
      const mockFetch = vi.fn();
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      const controller = new AbortController();
      controller.abort();

      const events: BrainEvent[] = [];
      for await (const ev of provider.chat(sampleRequest, { modelId: 'ollama-qwen2.5-7b', signal: controller.signal })) {
        events.push(ev);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('cancelled');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('cancels mid-stream on AbortSignal (M3 Barge-In)', async () => {
      const controller = new AbortController();
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        start(streamController) {
          streamController.enqueue(encoder.encode(JSON.stringify({
            model: 'qwen2.5:7b',
            message: { role: 'assistant', content: 'กำลังเริ่ม...' },
            done: false
          }) + '\n'));
        },
        cancel() {
          // Stream cancelled
        }
      });

      const mockFetch = vi.fn().mockResolvedValue(new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'application/x-ndjson' }
      }));

      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });
      const events: BrainEvent[] = [];

      for await (const ev of provider.chat(sampleRequest, { modelId: 'ollama-qwen2.5-7b', signal: controller.signal })) {
        events.push(ev);
        if (ev.type === 'delta') {
          // Simulate user barge-in voice interruption
          controller.abort();
        }
      }

      const types = events.map((e) => e.type);
      expect(types).toContain('started');
      expect(types).toContain('delta');
      expect(types).toContain('cancelled');
      expect(types).not.toContain('completed');
    });
  });
});
