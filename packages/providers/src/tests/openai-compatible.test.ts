import { describe, expect, it } from 'vitest';
import type { BrainEvent, BrainRequest } from '@mave/contracts';
import {
  OpenAICompatibleBrainProvider,
  createFastBrainFromEnv,
  type FetchLike
} from '../brain/openai-compatible.js';

const request: BrainRequest = {
  requestId: 'r1',
  sessionId: 's1',
  intent: 'conversation',
  systemPrompt: 'Extra rules',
  messages: [{ role: 'user', content: 'Hi' }]
};

function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    }
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

async function collect(it: AsyncIterable<BrainEvent>): Promise<BrainEvent[]> {
  const out: BrainEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe('OpenAICompatibleBrainProvider', () => {
  it('streams deltas from SSE chunks split across reads', async () => {
    let sentBody: Record<string, unknown> = {};
    let sentHeaders: Record<string, string> = {};
    const fetchImpl: FetchLike = async (_url, init) => {
      sentBody = JSON.parse(String(init?.body));
      sentHeaders = init?.headers as Record<string, string>;
      return sseResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"de',
        'lta":{"content":"lo!"},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n'
      ]);
    };
    const provider = new OpenAICompatibleBrainProvider({ preset: 'groq', apiKey: 'k', fetchImpl });
    const events = await collect(provider.chat(request));
    expect(events.map((e) => e.type)).toEqual(['started', 'delta', 'delta', 'completed']);
    const completed = events.at(-1);
    expect(completed && completed.type === 'completed' ? completed.text : '').toBe('Hello!');
    expect(sentBody['model']).toBe('llama-3.3-70b-versatile');
    expect(sentBody['stream']).toBe(true);
    expect((sentBody['messages'] as Array<{ role: string; content: string }>)[0]?.content).toContain('Extra rules');
    expect(sentHeaders['Authorization']).toBe('Bearer k');
  });

  it('maps HTTP errors to brain error codes', async () => {
    const make = (status: number) =>
      new OpenAICompatibleBrainProvider({ preset: 'groq', apiKey: 'k', fetchImpl: async () => new Response('nope', { status }) });
    const codes = [];
    for (const status of [401, 429, 503, 400]) {
      const events = await collect(make(status).chat(request));
      const err = events[0];
      codes.push(err?.type === 'error' ? err.error.code : err?.type);
    }
    expect(codes).toEqual(['provider_auth', 'provider_limit', 'provider_unavailable', 'provider_invalid_response']);
  });

  it('refuses to call a cloud service without a key', async () => {
    const provider = new OpenAICompatibleBrainProvider({ preset: 'gemini', fetchImpl: async () => { throw new Error('should not call'); } });
    const events = await collect(provider.chat(request));
    expect(events[0]?.type === 'error' && events[0].error.code).toBe('provider_auth');
    expect((await provider.health()).status).toBe('unconfigured');
  });

  it('local presets need no key and advertise the local capability', () => {
    const provider = new OpenAICompatibleBrainProvider({ preset: 'ollama', fetchImpl: async () => new Response('{}') });
    expect(provider.getCapabilities()).toMatchObject({ local: true, fastChat: true, streaming: true });
  });

  it('cancels mid-stream', async () => {
    const controller = new AbortController();
    const fetchImpl: FetchLike = async (_url, init) => {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"a"}}]}\n\n'));
          init?.signal?.addEventListener('abort', () => c.error(new Error('aborted')));
        }
      });
      return new Response(body);
    };
    const provider = new OpenAICompatibleBrainProvider({ preset: 'ollama', fetchImpl });
    const events: BrainEvent[] = [];
    for await (const e of provider.chat(request, { signal: controller.signal })) {
      events.push(e);
      if (e.type === 'delta') controller.abort();
    }
    expect(events.at(-1)?.type).toBe('cancelled');
  });

  it('health uses the models endpoint', async () => {
    const urls: string[] = [];
    const provider = new OpenAICompatibleBrainProvider({
      preset: 'groq',
      apiKey: 'k',
      fetchImpl: async (url) => {
        urls.push(url);
        return new Response('{"data":[]}');
      }
    });
    expect((await provider.health()).status).toBe('healthy');
    expect(urls).toEqual(['https://api.groq.com/openai/v1/models']);
  });

  it('is configured from env vars', () => {
    expect(createFastBrainFromEnv({})).toBeUndefined();
    expect(createFastBrainFromEnv({ MAVE_FAST_BRAIN: 'nope' })).toBeUndefined();
    const groq = createFastBrainFromEnv({ MAVE_FAST_BRAIN: 'groq', GROQ_API_KEY: 'x', MAVE_FAST_BRAIN_MODEL: 'm' });
    expect(groq?.model).toBe('m');
    expect(groq?.id).toBe('fast');
    expect(createFastBrainFromEnv({ MAVE_FAST_BRAIN: 'custom' })).toBeUndefined();
    expect(createFastBrainFromEnv({ MAVE_FAST_BRAIN: 'custom', MAVE_FAST_BRAIN_BASE_URL: 'http://localhost:8080/v1', MAVE_FAST_BRAIN_MODEL: 'x' })?.getCapabilities().local).toBe(true);
  });
});
