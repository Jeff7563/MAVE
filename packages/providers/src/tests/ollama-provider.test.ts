import { describe, it, expect, vi } from 'vitest';
import type { BrainEvent, BrainRequest } from '@mave/contracts';
import { isModelCatalogProvider, ModelCatalogSnapshotSchema } from '@mave/contracts';
import {
  OllamaBrainProvider,
  OLLAMA_PROVIDER_ID,
  assertLoopbackEndpoint,
  normalizeOllamaModelId,
  sanitizeOllamaErrorMessage,
  isGenerativeChatModel,
  type LocalModelQualification,
  type OllamaTagModel
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

describe('OllamaBrainProvider (F1.5-C1.1 Local Provider Qualification & Catalog Hardening)', () => {
  const sampleRequest: BrainRequest = {
    requestId: 'req-ollama-1',
    sessionId: 'sess-local-1',
    intent: 'conversation',
    systemPrompt: 'You are MAVE, a local voice assistant.',
    messages: [
      { role: 'user', content: 'สวัสดี MAVE ช่วยแนะนำร้านอาหารหน่อย' }
    ]
  };

  describe('1. Provider Identity & Transport Capabilities', () => {
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
      expect(desc.capabilities.streaming).toBe(true);
      expect(desc.capabilities.cancellation).toBe(true);

      // C3 promotion: Promoted qwen2.5:1.5b reflects in provider capabilities
      expect(desc.capabilities.fastChat).toBe(true);
      expect(desc.capabilities.reasoning).toBe(false);
      expect(desc.capabilities.coding).toBe(false);
      expect(desc.capabilities.supportsThai).toBe(true);
      expect(desc.capabilities.supportsEnglish).toBe(true);
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

  describe('3. Generative Model Detection & Embedding Filtering', () => {
    it('identifies generative completion models correctly', () => {
      const chatModel: OllamaTagModel = {
        name: 'qwen2.5:1.5b',
        capabilities: ['completion', 'tools']
      };
      expect(isGenerativeChatModel(chatModel)).toBe(true);

      const visionModel: OllamaTagModel = {
        name: 'llava:7b',
        capabilities: ['completion', 'vision']
      };
      expect(isGenerativeChatModel(visionModel)).toBe(true);
    });

    it('identifies and filters out embedding-only models', () => {
      const embedModel: OllamaTagModel = {
        name: 'nomic-embed-text:latest',
        capabilities: ['embedding'],
        details: { family: 'nomic-bert' }
      };
      expect(isGenerativeChatModel(embedModel)).toBe(false);

      const legacyEmbedModel: OllamaTagModel = {
        name: 'bge-large-en-v1.5:latest'
      };
      expect(isGenerativeChatModel(legacyEmbedModel)).toBe(true);

      const embedHeuristicModel: OllamaTagModel = {
        name: 'all-minilm-embed:latest',
        details: { family: 'bert' }
      };
      expect(isGenerativeChatModel(embedHeuristicModel)).toBe(false);
    });
  });

  describe('4. Model Tag Normalization & Collision Safety', () => {
    it('normalizes Ollama model tags into canonical slugs', () => {
      expect(normalizeOllamaModelId('foo:latest')).toBe('ollama-foo-latest');
      expect(normalizeOllamaModelId('foo:7b')).toBe('ollama-foo-7b');
      expect(normalizeOllamaModelId('foo:7b-q4')).toBe('ollama-foo-7b-q4');
      expect(normalizeOllamaModelId('organization/model:tag')).toBe('ollama-organization-model-tag');
      expect(normalizeOllamaModelId('ollama-already-prefixed')).toBe('ollama-already-prefixed');
    });

    it('preserves distinct normalized model IDs across supported tags without collision', () => {
      const tags = ['foo:latest', 'foo:7b', 'foo:7b-q4', 'organization/model:tag'];
      const normalized = tags.map((t) => normalizeOllamaModelId(t));
      const unique = new Set(normalized);
      expect(unique.size).toBe(tags.length);
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

  describe('5. Health Check (Zero Generation Token Invariant)', () => {
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

  describe('6. Dynamic Model Catalog & Qualification Hardening', () => {
    it('introspects generative models and EXCLUDES embedding-only models', async () => {
      const mockTags = {
        models: [
          {
            name: 'nomic-embed-text:latest',
            size: 274000000,
            details: { family: 'nomic-bert', parameter_size: '137M' },
            capabilities: ['embedding']
          },
          {
            name: 'qwen2.5:1.5b',
            size: 986000000,
            details: { family: 'qwen2', parameter_size: '1.5B', context_length: 32768 },
            capabilities: ['completion', 'tools']
          },
          {
            name: 'llava:7b',
            size: 4700000000,
            details: { family: 'llama', families: ['llama', 'clip'], parameter_size: '7B', context_length: 32768 },
            capabilities: ['completion', 'vision']
          },
          {
            name: 'deepseek-r1:7b',
            size: 4680000000,
            details: { family: 'qwen2', parameter_size: '7.6B', context_length: 131072 },
            capabilities: ['completion', 'thinking']
          }
        ]
      };

      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(mockTags, 200));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch, qualifications: [] });

      const catalog = await provider.getCatalog();
      expect(() => ModelCatalogSnapshotSchema.parse(catalog)).not.toThrow();

      // nomic-embed-text MUST be excluded
      expect(catalog.models).toHaveLength(3);
      const embedModel = catalog.models.find((m) => m.id.includes('embed'));
      expect(embedModel).toBeUndefined();

      // Unbenchmarked qwen2.5:1.5b does NOT claim fastChat, Thai, or English qualification
      const qwen = catalog.models.find((m) => m.id === 'ollama-qwen2.5-1.5b');
      expect(qwen).toBeDefined();
      expect(qwen?.capabilities.fastChat).toBe(false);
      expect(qwen?.capabilities.supportsThai).toBe(false);
      expect(qwen?.capabilities.supportsEnglish).toBe(false);
      expect(qwen?.capabilities.local).toBe(true);
      expect(qwen?.displayName).toContain('Candidate');

      // Multimodal llava has vision, but does NOT claim fastChat
      const llava = catalog.models.find((m) => m.id === 'ollama-llava-7b');
      expect(llava).toBeDefined();
      expect(llava?.capabilities.vision).toBe(true);
      expect(llava?.capabilities.multimodal).toBe(true);
      expect(llava?.capabilities.fastChat).toBe(false);
      expect(llava?.qualityClass).toBe('balanced');

      // deepseek-r1 does NOT claim reasoning qualification without approval
      const deepseek = catalog.models.find((m) => m.id === 'ollama-deepseek-r1-7b');
      expect(deepseek).toBeDefined();
      expect(deepseek?.capabilities.reasoning).toBe(false);
      expect(deepseek?.capabilities.fastChat).toBe(false);
      expect(deepseek?.contextClass).toBe('massive');
    });

    it('promotes model capabilities ONLY when explicitly qualified (C2 readiness)', async () => {
      const mockTags = {
        models: [
          {
            name: 'qwen2.5:1.5b',
            size: 986000000,
            details: { family: 'qwen2', parameter_size: '1.5B', context_length: 32768 },
            capabilities: ['completion', 'tools']
          }
        ]
      };

      const qualification: LocalModelQualification = {
        modelIdOrTag: 'qwen2.5:1.5b',
        productionApproved: true,
        fastChatSuitable: true,
        thaiQualified: true,
        englishQualified: true,
        targetRole: 'FAST',
        benchmarkEvidence: {
          measuredWarmTtftMs: 202,
          measuredEvalTokPerSec: 189.7,
          benchmarkDate: '2026-10-14'
        }
      };

      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(mockTags, 200));
      const provider = new OllamaBrainProvider({
        fetchFn: mockFetch,
        qualifications: [qualification]
      });

      const catalog = await provider.getCatalog();
      const qwen = catalog.models.find((m) => m.id === 'ollama-qwen2.5-1.5b');

      expect(qwen).toBeDefined();
      expect(qwen?.capabilities.fastChat).toBe(true);
      expect(qwen?.capabilities.supportsThai).toBe(true);
      expect(qwen?.capabilities.supportsEnglish).toBe(true);
      expect(qwen?.qualityClass).toBe('fast');
      expect(qwen?.displayName).toContain('Qualified');
    });

    it('disambiguates colliding model tags gracefully', async () => {
      const mockTags = {
        models: [
          { name: 'foo/bar:7b', capabilities: ['completion'] },
          { name: 'foo-bar:7b', capabilities: ['completion'] }
        ]
      };

      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(mockTags, 200));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      const catalog = await provider.getCatalog();
      expect(catalog.models).toHaveLength(2);
      expect(catalog.models[0]?.id).not.toBe(catalog.models[1]?.id);
      expect(provider.resolveConcreteModelTag(catalog.models[0]!.id)).toBe('foo/bar:7b');
      expect(provider.resolveConcreteModelTag(catalog.models[1]!.id)).toBe('foo-bar:7b');
    });

    it('resolves concrete model tag mapping correctly', async () => {
      const mockTags = {
        models: [
          { name: 'qwen2.5:7b', capabilities: ['completion'] }
        ]
      };
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(mockTags, 200));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      await provider.getCatalog();

      expect(provider.resolveConcreteModelTag('ollama-qwen2.5-7b')).toBe('qwen2.5:7b');
      expect(provider.resolveConcreteModelTag('qwen2.5:7b')).toBe('qwen2.5:7b');
    });
  });

  describe('7. Execution Contract & Progressive Streaming', () => {
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
      }
    });

    it('executes direct streaming for any installed generative model via options.modelId', async () => {
      const ndjsonChunks = [
        { model: 'qwen2.5:1.5b', message: { role: 'assistant', content: 'สวัสดี' }, done: false },
        { model: 'qwen2.5:1.5b', message: { role: 'assistant', content: 'ครับ' }, done: false },
        {
          model: 'qwen2.5:1.5b',
          message: { role: 'assistant', content: '' },
          done: true,
          done_reason: 'stop',
          prompt_eval_count: 10,
          eval_count: 12,
          total_duration: 300000000
        }
      ];

      const mockFetch = vi.fn().mockResolvedValue(createMockNdjsonResponse(ndjsonChunks, 200));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });
      const events: BrainEvent[] = [];

      for await (const ev of provider.chat(sampleRequest, { modelId: 'ollama-qwen2.5-1.5b' })) {
        events.push(ev);
      }

      expect(events[0]?.type).toBe('started');
      const deltas = events.filter((e) => e.type === 'delta');
      expect(deltas).toHaveLength(2);

      const completed = events.find((e) => e.type === 'completed');
      expect(completed).toBeDefined();
      if (completed && completed.type === 'completed') {
        expect(completed.text).toBe('สวัสดีครับ');
        expect(completed.usage?.totalTokens).toBe(22);
        expect(completed.usage?.estimatedCostUsd).toBe(0);
      }
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
        cancel() {}
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
