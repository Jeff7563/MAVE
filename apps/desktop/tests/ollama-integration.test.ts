import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BrainProviderRegistry,
  BrainRouter,
  ContextManager,
  ConversationRuntime,
  SessionManager
} from '@mave/core';
import { createMaveDatabase, SQLiteConversationStore, type MaveDatabase } from '@mave/database';
import { OllamaBrainProvider } from '@mave/providers';
import type { ConversationRuntimeEvent } from '@mave/contracts';
import { ConversationManager } from '../src/main/conversation-manager.js';

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

describe('Ollama Desktop Integration (F1.5-C1 Local Model Provider)', () => {
  let db: MaveDatabase;
  let manager: ConversationManager;

  beforeEach(async () => {
    db = await createMaveDatabase(':memory:');
  });

  afterEach(async () => {
    if (manager) {
      await manager.dispose();
    }
    db.close();
  });

  it('1. registers OllamaBrainProvider as model_provider with local_runtime and local accessClass', () => {
    manager = new ConversationManager({ database: db });
    const registry = manager.getProviderRegistry();

    expect(registry.has('ollama')).toBe(true);

    const meta = registry.getProviderMetadata('ollama');
    expect(meta.kind).toBe('model_provider');
    expect(meta.accessPath).toBe('local_runtime');
    expect(meta.accessClass).toBe('local');
    // C3 promotion: Promoted qwen2.5:1.5b reflects in provider capabilities
    expect(meta.capabilities.fastChat).toBe(true);
    expect(meta.capabilities.toolUse).toBe(false);

    const ollama = manager.getOllamaProvider();
    expect(ollama).toBeInstanceOf(OllamaBrainProvider);
    expect(ollama.id).toBe('ollama');
  });

  it('2. app startup is completely robust and never crashes when Ollama local daemon is offline', async () => {
    // Inject a fetchFn that simulates offline daemon / connection refused
    const offlineFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'));
    const offlineOllama = new OllamaBrainProvider({ fetchFn: offlineFetch });

    expect(() => {
      manager = new ConversationManager({
        database: db,
        ollamaProvider: offlineOllama
      });
    }).not.toThrow();

    // Verify health gracefully reports unavailable without throwing
    const health = await manager.getOllamaProvider().health();
    expect(health.status).toBe('unavailable');
    expect(health.message).toContain('unreachable');
  });

  it('3. executes end-to-end local streaming generation and persists turn to SQLite', async () => {
    const ndjsonChunks = [
      { model: 'qwen2.5:1.5b', message: { role: 'assistant', content: 'สวัสดี' }, done: false },
      { model: 'qwen2.5:1.5b', message: { role: 'assistant', content: 'ครับ MAVE' }, done: false },
      { model: 'qwen2.5:1.5b', message: { role: 'assistant', content: ' พร้อมช่วยเหลือครับ' }, done: false },
      {
        model: 'qwen2.5:1.5b',
        message: { role: 'assistant', content: '' },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 12,
        eval_count: 15,
        total_duration: 250000000
      }
    ];

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/api/version')) {
        return createJsonResponse({ version: '0.33.2' }, 200);
      }
      if (url.endsWith('/api/tags')) {
        return createJsonResponse({
          models: [
            {
              name: 'qwen2.5:1.5b',
              details: { parameter_size: '1.5B', context_length: 32768 }
            }
          ]
        }, 200);
      }
      if (url.endsWith('/api/chat')) {
        return createMockNdjsonResponse(ndjsonChunks, 200);
      }
      return new Response('Not found', { status: 404 });
    });

    const ollama = new OllamaBrainProvider({ fetchFn: mockFetch });
    const store = new SQLiteConversationStore(db);
    const registry = new BrainProviderRegistry();
    registry.register(ollama, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Ollama Local Model Provider'
    });

    const router = new BrainRouter({
      registry,
      defaultProvider: 'ollama'
    });

    const sessionManager = new SessionManager();
    const contextManager = new ContextManager();
    const runtime = new ConversationRuntime({
      sessionManager,
      contextManager,
      router,
      store
    });

    const events: ConversationRuntimeEvent[] = [];

    for await (const ev of runtime.send({
      requestId: 'req-ollama-test-1',
      message: 'สวัสดีครับ',
      preferredProviderId: 'ollama',
      preferredModelId: 'ollama-qwen2.5-1.5b'
    })) {
      events.push(ev);
    }

    // Verify event progression
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('response_started');
    expect(eventTypes).toContain('response_delta');
    expect(eventTypes).toContain('response_completed');

    const completed = events.find((e) => e.type === 'response_completed') as any;
    expect(completed).toBeDefined();
    expect(completed.text).toBe('สวัสดีครับ MAVE พร้อมช่วยเหลือครับ');
    expect(completed.usage?.totalTokens).toBe(27);

    // Verify persistence in SQLiteConversationStore
    const turns = await store.getTurns(completed.sessionId);
    expect(turns).toHaveLength(2); // user turn + assistant turn
    expect(turns[0]?.role).toBe('user');
    expect(turns[0]?.content).toBe('สวัสดีครับ');
    expect(turns[1]?.role).toBe('assistant');
    expect(turns[1]?.content).toBe('สวัสดีครับ MAVE พร้อมช่วยเหลือครับ');
  });
});
