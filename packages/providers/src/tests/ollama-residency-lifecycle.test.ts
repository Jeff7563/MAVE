import { describe, it, expect, vi } from 'vitest';
import type { BrainRequest, BrainEvent } from '@mave/contracts';
import {
  OllamaBrainProvider,
  OllamaResidencyManager,
  CANONICAL_LOCAL_MODEL_QUALIFICATIONS
} from '../brain/index.js';

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

describe('Local Fast Brain Residency & Lifecycle Gate (Pre-M5 F1.5-C3)', () => {
  const QUALIFIED_DIGEST = '65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b';

  describe('1. Model Identity & Exact Digest Promotion Gate', () => {
    it('exact digest qualification promotes qwen2.5:1.5b to productionApproved: true', async () => {
      const qwenQual = CANONICAL_LOCAL_MODEL_QUALIFICATIONS.find((q) => q.modelIdOrTag === 'qwen2.5:1.5b');
      expect(qwenQual).toBeDefined();
      expect(qwenQual?.productionApproved).toBe(true);
      expect(qwenQual?.fastChatSuitable).toBe(true);
      expect(qwenQual?.thaiQualified).toBe(true);
      expect(qwenQual?.englishQualified).toBe(true);
      expect(qwenQual?.targetRole).toBe('FAST');
      expect(qwenQual?.benchmarkEvidence?.digest).toBe(QUALIFIED_DIGEST);

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

      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(mockTags, 200));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      const catalog = await provider.getCatalog();
      const qwenDesc = catalog.models.find((m) => m.id === 'ollama-qwen2.5-1.5b');
      expect(qwenDesc).toBeDefined();
      expect(qwenDesc?.capabilities.fastChat).toBe(true);
      expect(qwenDesc?.capabilities.supportsThai).toBe(true);
      expect(qwenDesc?.capabilities.supportsEnglish).toBe(true);
      expect(qwenDesc?.qualityClass).toBe('fast');
      expect(qwenDesc?.displayName).toContain('(Local Ollama - Qualified)');
    });

    it('digest mismatch invalidates production qualification fail-closed', async () => {
      const mockTags = {
        models: [
          {
            name: 'qwen2.5:1.5b',
            digest: 'mismatched-unqualified-digest-deadbeef',
            details: { parameter_size: '1.5B', context_length: 32768 },
            capabilities: ['completion']
          }
        ]
      };

      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(mockTags, 200));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      const catalog = await provider.getCatalog();
      const qwenDesc = catalog.models.find((m) => m.id === 'ollama-qwen2.5-1.5b');
      expect(qwenDesc).toBeDefined();
      // Mismatch invalidates qualification
      expect(qwenDesc?.capabilities.fastChat).toBe(false);
      expect(qwenDesc?.capabilities.supportsThai).toBe(false);
      expect(qwenDesc?.capabilities.supportsEnglish).toBe(false);
      expect(qwenDesc?.displayName).toContain('(Local Ollama - Candidate)');
    });

    it('productionApproved is true ONLY for exact qwen2.5:1.5b; qwen2.5:7b remains productionApproved: false', () => {
      const qual7b = CANONICAL_LOCAL_MODEL_QUALIFICATIONS.find((q) => q.modelIdOrTag === 'qwen2.5:7b');
      expect(qual7b).toBeDefined();
      expect(qual7b?.productionApproved).toBe(false);
      expect(qual7b?.targetRole).toBe('BALANCED');
      expect(qual7b?.recommendedCandidate).toBe(false);

      const approvedModels = CANONICAL_LOCAL_MODEL_QUALIFICATIONS.filter((q) => q.productionApproved);
      expect(approvedModels).toHaveLength(1);
      expect(approvedModels[0]?.modelIdOrTag).toBe('qwen2.5:1.5b');
    });

    it('non-conversational and unapproved models (nomic, llava, deepseek-r1, coder) cannot claim fastChat', async () => {
      const mockTags = {
        models: [
          { name: 'nomic-embed-text:latest', capabilities: ['embedding'] },
          { name: 'llava:7b', capabilities: ['completion', 'vision'] },
          { name: 'deepseek-r1:7b', capabilities: ['completion', 'thinking'] },
          { name: 'qwen2.5-coder:7b', capabilities: ['completion'] }
        ]
      };

      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(mockTags, 200));
      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });

      const catalog = await provider.getCatalog();
      // Embedding is excluded
      expect(catalog.models.find((m) => m.id.includes('embed'))).toBeUndefined();

      // None of the others have fastChat
      for (const m of catalog.models) {
        expect(m.capabilities.fastChat).toBe(false);
      }
    });

    it('sets defaultModelId to ollama-qwen2.5-1.5b in provider descriptor when promoted', () => {
      const provider = new OllamaBrainProvider();
      const desc = provider.getDescriptor();
      expect(desc.defaultModelId).toBe('ollama-qwen2.5-1.5b');
    });
  });

  describe('2. Local Model Residency Manager Lifecycle', () => {
    it('single-flight model loading coalesces concurrent load calls into one API request', async () => {
      let generateCalls = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/generate')) {
          generateCalls++;
          await new Promise((r) => setTimeout(r, 20));
          return createJsonResponse({ done: true, done_reason: 'load' });
        }
        return createJsonResponse({});
      });

      const residency = new OllamaResidencyManager({ fetchFn: mockFetch });
      expect(residency.getState()).toBe('unloaded');

      const p1 = residency.load('qwen2.5:1.5b');
      const p2 = residency.load('qwen2.5:1.5b');
      const p3 = residency.load('qwen2.5:1.5b');

      expect(residency.getState()).toBe('loading');

      await Promise.all([p1, p2, p3]);

      expect(residency.getState()).toBe('warm');
      expect(generateCalls).toBe(1);
    });

    it('supports concurrent execution leases and tracks activeLeases ref-count', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse({ done: true }));
      const residency = new OllamaResidencyManager({ fetchFn: mockFetch });

      const lease1 = await residency.acquireLease('qwen2.5:1.5b');
      expect(residency.getState()).toBe('in_use');
      expect(residency.getActiveLeases()).toBe(1);

      const lease2 = await residency.acquireLease('qwen2.5:1.5b');
      expect(residency.getState()).toBe('in_use');
      expect(residency.getActiveLeases()).toBe(2);

      lease1.release();
      expect(residency.getState()).toBe('in_use');
      expect(residency.getActiveLeases()).toBe(1);

      lease2.release();
      expect(residency.getState()).toBe('warm');
      expect(residency.getActiveLeases()).toBe(0);
    });

    it('unload does NOT unload while an active request owns the model (lease protection)', async () => {
      let unloadCalls = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/api/generate')) {
          const body = JSON.parse((init?.body as string) || '{}');
          if (body.keep_alive === 0) unloadCalls++;
          return createJsonResponse({ done: true });
        }
        return createJsonResponse({});
      });

      const residency = new OllamaResidencyManager({ fetchFn: mockFetch });
      const lease = await residency.acquireLease('qwen2.5:1.5b');

      // Attempt unload while lease is held
      await residency.unload('qwen2.5:1.5b');
      expect(unloadCalls).toBe(0);
      expect(residency.getState()).toBe('in_use');

      // Releasing lease triggers deferred unload
      lease.release();
      await new Promise((r) => setTimeout(r, 10));

      expect(unloadCalls).toBe(1);
      expect(residency.getState()).toBe('unloaded');
    });

    it('handles load/unload race safely by awaiting in-flight transitions', async () => {
      let unloadCount = 0;
      let loadCount = 0;

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/api/generate')) {
          const body = JSON.parse((init?.body as string) || '{}');
          if (body.keep_alive === 0) {
            unloadCount++;
            await new Promise((r) => setTimeout(r, 20));
          } else {
            loadCount++;
            await new Promise((r) => setTimeout(r, 20));
          }
          return createJsonResponse({ done: true });
        }
        return createJsonResponse({});
      });

      const residency = new OllamaResidencyManager({ fetchFn: mockFetch });
      await residency.load('qwen2.5:1.5b');
      expect(residency.getState()).toBe('warm');

      // Initiate unload and immediately initiate load
      const unloadPromise = residency.unload('qwen2.5:1.5b');
      const loadPromise = residency.load('qwen2.5:1.5b');

      await Promise.all([unloadPromise, loadPromise]);

      expect(residency.getState()).toBe('warm');
      expect(unloadCount).toBe(1);
      expect(loadCount).toBe(2);
    });

    it('reconciles state conservatively after Ollama daemon restart', async () => {
      let daemonState: 'running_loaded' | 'restarted_empty' = 'running_loaded';

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/version')) {
          return createJsonResponse({ version: '0.40.4' });
        }
        if (url.endsWith('/api/ps')) {
          if (daemonState === 'running_loaded') {
            return createJsonResponse({
              models: [{ name: 'qwen2.5:1.5b', size_vram: 1169382440, expires_at: '2026-10-16T01:00:00Z' }]
            });
          }
          return createJsonResponse({ models: [] });
        }
        return createJsonResponse({});
      });

      const residency = new OllamaResidencyManager({ fetchFn: mockFetch });
      await residency.reconcile('qwen2.5:1.5b');
      expect(residency.getState()).toBe('warm');
      expect(residency.getStatus().residentVramBytes).toBe(1169382440);

      // Simulate Ollama daemon restart
      daemonState = 'restarted_empty';
      await residency.reconcile('qwen2.5:1.5b');
      expect(residency.getState()).toBe('unloaded');
      expect(residency.getStatus().residentVramBytes).toBe(0);
    });

    it('transitions to unavailable when Ollama daemon is unreachable', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'));
      const residency = new OllamaResidencyManager({ fetchFn: mockFetch });

      const status = await residency.reconcile('qwen2.5:1.5b');
      expect(status.state).toBe('unavailable');
    });

    it('prewarm is a lifecycle operation that produces ZERO brain attempts or text', async () => {
      let generateCalled = false;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/api/generate')) {
          generateCalled = true;
          const body = JSON.parse((init?.body as string) || '{}');
          expect(body.model).toBe('qwen2.5:1.5b');
          expect(body.prompt).toBeUndefined();
          return createJsonResponse({ done: true, done_reason: 'load' });
        }
        return createJsonResponse({});
      });

      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });
      await provider.prewarm('qwen2.5:1.5b');
      expect(generateCalled).toBe(true);
      expect(provider.getResidencyManager().getState()).toBe('warm');
    });

    it('chat execution acquires and releases lease cleanly over streaming lifecycle', async () => {
      const ndjson = [
        { model: 'qwen2.5:1.5b', message: { role: 'assistant', content: 'สวัสดีครับ' }, done: false },
        {
          model: 'qwen2.5:1.5b',
          message: { role: 'assistant', content: '' },
          done: true,
          prompt_eval_count: 5,
          eval_count: 8,
          total_duration: 100000000
        }
      ];

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/generate')) return createJsonResponse({ done: true });
        if (url.endsWith('/api/chat')) return createMockNdjsonResponse(ndjson);
        return createJsonResponse({});
      });

      const provider = new OllamaBrainProvider({ fetchFn: mockFetch });
      const residency = provider.getResidencyManager();

      const events: BrainEvent[] = [];
      const chatReq: BrainRequest = {
        requestId: 'req-residency-test-1',
        sessionId: 'sess-1',
        intent: 'conversation',
        messages: [{ role: 'user', content: 'hi' }]
      };

      for await (const ev of provider.chat(chatReq, { modelId: 'ollama-qwen2.5-1.5b' })) {
        events.push(ev);
        // During streaming, lease is active
        expect(residency.getState()).toBe('in_use');
        expect(residency.getActiveLeases()).toBe(1);
      }

      // After streaming completes, lease is released
      expect(residency.getState()).toBe('warm');
      expect(residency.getActiveLeases()).toBe(0);
      expect(events.find((e) => e.type === 'completed')).toBeDefined();
    });
  });
});
