import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrainEvent, BrainRequest } from '@mave/contracts';
import { MockBrainProvider } from '../brain/mock.js';

describe('MockBrainProvider', () => {
  const createTestRequest = (text = 'Hello MAVE', reqId = 'req_1', sessId = 'sess_1'): BrainRequest => ({
    requestId: reqId,
    sessionId: sessId,
    intent: 'conversation',
    messages: [{ role: 'user', content: text }]
  });

  describe('1. Contract & Identity', () => {
    it('implements BrainProvider contract with default id "mock"', () => {
      const provider = new MockBrainProvider();
      expect(provider.id).toBe('mock');
      expect(typeof provider.getCapabilities).toBe('function');
      expect(typeof provider.health).toBe('function');
      expect(typeof provider.chat).toBe('function');
      expect(typeof provider.cancel).toBe('function');
    });

    it('allows configuring a custom stable provider id', () => {
      const provider = new MockBrainProvider({ id: 'mock-brain' });
      expect(provider.id).toBe('mock-brain');
    });
  });

  describe('2. Capabilities', () => {
    it('advertises streaming: true and fastChat: true with other capabilities false by default', () => {
      const provider = new MockBrainProvider();
      const caps = provider.getCapabilities();

      expect(caps.streaming).toBe(true);
      expect(caps.fastChat).toBe(true);
      expect(caps.reasoning).toBe(false);
      expect(caps.coding).toBe(false);
      expect(caps.toolUse).toBe(false);
      expect(caps.multimodal).toBe(false);
      expect(caps.vision).toBe(false);
      expect(caps.webResearch).toBe(false);
      expect(caps.longContext).toBe(false);
      expect(caps.local).toBe(false);
    });

    it('allows overriding specific capabilities for test scenarios', () => {
      const provider = new MockBrainProvider({
        capabilities: { reasoning: true, local: true }
      });
      const caps = provider.getCapabilities();
      expect(caps.reasoning).toBe(true);
      expect(caps.local).toBe(true);
      expect(caps.fastChat).toBe(true);
    });
  });

  describe('3. Health Check', () => {
    it('health() defaults to healthy with non-negative checkedAt', async () => {
      const provider = new MockBrainProvider();
      const health = await provider.health();

      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBe(0);
      expect(health.checkedAt).toBeGreaterThan(0);
    });

    it('health state can be configured via constructor and setter', async () => {
      const provider = new MockBrainProvider({
        healthStatus: 'degraded',
        healthMessage: 'High simulated latency',
        healthLatencyMs: 350
      });
      let health = await provider.health();
      expect(health.status).toBe('degraded');
      expect(health.message).toBe('High simulated latency');
      expect(health.latencyMs).toBe(350);

      provider.setHealth('unhealthy', 'Provider down');
      health = await provider.health();
      expect(health.status).toBe('unhealthy');
      expect(health.message).toBe('Provider down');
    });
  });

  describe('4. Deterministic Streaming Response', () => {
    it('emits started -> delta* -> completed in exact order', async () => {
      const provider = new MockBrainProvider();
      const request = createTestRequest('Hello MAVE');

      const events: BrainEvent[] = [];
      for await (const event of provider.chat(request)) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThanOrEqual(3);
      expect(events[0]?.type).toBe('started');
      if (events[0]?.type === 'started') {
        expect(events[0].requestId).toBe(request.requestId);
        expect(events[0].providerId).toBe('mock');
      }

      const middleEvents = events.slice(1, -1);
      for (const e of middleEvents) {
        expect(e.type).toBe('delta');
      }

      const lastEvent = events[events.length - 1];
      expect(lastEvent?.type).toBe('completed');
      if (lastEvent?.type === 'completed') {
        expect(lastEvent.requestId).toBe(request.requestId);
        expect(lastEvent.finishReason).toBe('stop');
      }
    });

    it('produces identical deterministic output for the same input', async () => {
      const provider = new MockBrainProvider();
      const request = createTestRequest('Tell me about MAVE');

      const run1Deltas: string[] = [];
      for await (const event of provider.chat(request)) {
        if (event.type === 'delta') run1Deltas.push(event.text);
      }

      const run2Deltas: string[] = [];
      for await (const event of provider.chat(request)) {
        if (event.type === 'delta') run2Deltas.push(event.text);
      }

      expect(run1Deltas).toEqual(run2Deltas);
      expect(run1Deltas.join('')).toBe('Mock response: Tell me about MAVE');
    });

    it('reconstructed deltas equal expected full response text and completed text', async () => {
      const provider = new MockBrainProvider();
      const request = createTestRequest('Testing chunk reconstruction');

      let accumulated = '';
      let completedText = '';

      for await (const event of provider.chat(request)) {
        if (event.type === 'delta') accumulated += event.text;
        if (event.type === 'completed') completedText = event.text || '';
      }

      expect(accumulated).toBe('Mock response: Testing chunk reconstruction');
      expect(completedText).toBe('Mock response: Testing chunk reconstruction');
    });

    it('supports custom static response text and custom response builder', async () => {
      const provider = new MockBrainProvider({ responseText: 'Custom static answer' });
      const deltas: string[] = [];
      for await (const event of provider.chat(createTestRequest())) {
        if (event.type === 'delta') deltas.push(event.text);
      }
      expect(deltas.join('')).toBe('Custom static answer');

      const builderProvider = new MockBrainProvider({
        responseBuilder: (req) => `Echo: ${req.messages[0]?.content?.toUpperCase()}`
      });
      const builderDeltas: string[] = [];
      for await (const event of builderProvider.chat(createTestRequest('lowercase'))) {
        if (event.type === 'delta') builderDeltas.push(event.text);
      }
      expect(builderDeltas.join('')).toBe('Echo: LOWERCASE');
    });

    it('supports custom fixed chunkSize and explicit chunks array', async () => {
      const customChunks = ['Chunk1-', 'Chunk2-', 'Chunk3'];
      const provider = new MockBrainProvider({ chunks: customChunks });

      const deltas: string[] = [];
      for await (const event of provider.chat(createTestRequest())) {
        if (event.type === 'delta') deltas.push(event.text);
      }
      expect(deltas).toEqual(customChunks);

      const fixedSizeProvider = new MockBrainProvider({
        responseText: '1234567890',
        chunkSize: 3
      });
      const fixedDeltas: string[] = [];
      for await (const event of fixedSizeProvider.chat(createTestRequest())) {
        if (event.type === 'delta') fixedDeltas.push(event.text);
      }
      expect(fixedDeltas).toEqual(['123', '456', '789', '0']);
    });
  });

  describe('5. Failure Simulation', () => {
    it('emits canonical error event when failureMode is "error_event"', async () => {
      const provider = new MockBrainProvider({
        failureMode: 'error_event',
        errorCode: 'provider_unavailable',
        errorMessage: 'Mock provider simulated outage',
        errorRetryable: true
      });

      const events: BrainEvent[] = [];
      for await (const event of provider.chat(createTestRequest())) {
        events.push(event);
      }

      expect(events.length).toBe(2);
      expect(events[0]?.type).toBe('started');
      expect(events[1]?.type).toBe('error');
      if (events[1]?.type === 'error') {
        expect(events[1].error.code).toBe('provider_unavailable');
        expect(events[1].error.message).toBe('Mock provider simulated outage');
        expect(events[1].error.retryable).toBe(true);
      }
    });

    it('throws when failureMode is "throw"', async () => {
      const provider = new MockBrainProvider({
        failureMode: 'throw',
        errorMessage: 'Immediate failure'
      });

      const chatGen = provider.chat(createTestRequest());
      await expect(async () => {
        for await (const _event of chatGen) {
          // should throw
        }
      }).rejects.toThrow('Immediate failure');
    });
  });

  describe('6. Delayed Streaming & Fake Timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('delays chunks according to delayMs without flakiness', async () => {
      const provider = new MockBrainProvider({
        delayMs: 50,
        chunks: ['A', 'B', 'C']
      });

      const iterator = provider.chat(createTestRequest())[Symbol.asyncIterator]();

      // 1. started event (synchronous before first chunk delay)
      const firstPromise = iterator.next();
      await vi.advanceTimersByTimeAsync(0);
      const first = await firstPromise;
      expect(first.value?.type).toBe('started');

      // 2. First delta after 50ms
      const chunk1Promise = iterator.next();
      await vi.advanceTimersByTimeAsync(50);
      const chunk1 = await chunk1Promise;
      expect(chunk1.value).toEqual({ type: 'delta', requestId: 'req_1', text: 'A' });

      // 3. Second delta after another 50ms
      const chunk2Promise = iterator.next();
      await vi.advanceTimersByTimeAsync(50);
      const chunk2 = await chunk2Promise;
      expect(chunk2.value).toEqual({ type: 'delta', requestId: 'req_1', text: 'B' });

      // 4. Third delta after another 50ms
      const chunk3Promise = iterator.next();
      await vi.advanceTimersByTimeAsync(50);
      const chunk3 = await chunk3Promise;
      expect(chunk3.value).toEqual({ type: 'delta', requestId: 'req_1', text: 'C' });

      // 5. completed event
      const finalPromise = iterator.next();
      await vi.advanceTimersByTimeAsync(0);
      const finalResult = await finalPromise;
      expect(finalResult.value?.type).toBe('completed');
    });
  });

  describe('7. Cancellation Handling', () => {
    it('cancels before generation starts if signal is already aborted', async () => {
      const provider = new MockBrainProvider();
      const abortController = new AbortController();
      abortController.abort('Pre-aborted');

      const events: BrainEvent[] = [];
      for await (const event of provider.chat(createTestRequest(), { signal: abortController.signal })) {
        events.push(event);
      }

      expect(events.length).toBe(1);
      expect(events[0]?.type).toBe('cancelled');
      if (events[0]?.type === 'cancelled') {
        expect(events[0].reason).toContain('Pre-aborted');
      }
    });

    it('cancels during streaming and emits no further deltas', async () => {
      vi.useFakeTimers();
      try {
        const provider = new MockBrainProvider({
          delayMs: 100,
          chunks: ['first', 'second', 'third']
        });
        const abortController = new AbortController();
        const request = createTestRequest();

        const events: BrainEvent[] = [];
        const iterator = provider.chat(request, { signal: abortController.signal })[Symbol.asyncIterator]();

        // started event
        const startedResult = await iterator.next();
        events.push(startedResult.value);

        // First chunk
        const chunk1Promise = iterator.next();
        await vi.advanceTimersByTimeAsync(100);
        const chunk1Result = await chunk1Promise;
        events.push(chunk1Result.value);
        expect(chunk1Result.value?.type).toBe('delta');

        // Abort while waiting for second chunk
        const chunk2Promise = iterator.next();
        abortController.abort('User clicked cancel');
        await vi.advanceTimersByTimeAsync(0);
        const chunk2Result = await chunk2Promise;
        events.push(chunk2Result.value);

        // Next read should terminate iterator
        const doneResult = await iterator.next();
        expect(doneResult.done).toBe(true);

        const types = events.map((e) => e.type);
        expect(types).toEqual(['started', 'delta', 'cancelled']);

        const cancelledEvent = events[2];
        if (cancelledEvent?.type === 'cancelled') {
          expect(cancelledEvent.reason).toContain('User clicked cancel');
        }

        // Verify no second or third delta was emitted
        const deltas = events.filter((e) => e.type === 'delta');
        expect(deltas.length).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('cancels via provider.cancel(requestId) method', async () => {
      vi.useFakeTimers();
      try {
        const provider = new MockBrainProvider({
          delayMs: 100,
          chunks: ['one', 'two', 'three']
        });
        const request = createTestRequest('test cancel method', 'req_cancel_1');

        const events: BrainEvent[] = [];
        const iterator = provider.chat(request)[Symbol.asyncIterator]();

        // started
        events.push((await iterator.next()).value);

        // chunk 1
        const chunk1Promise = iterator.next();
        await vi.advanceTimersByTimeAsync(100);
        events.push((await chunk1Promise).value);

        // Trigger cancel via provider method
        const chunk2Promise = iterator.next();
        await provider.cancel('req_cancel_1');
        await vi.advanceTimersByTimeAsync(0);
        events.push((await chunk2Promise).value);

        const doneResult = await iterator.next();
        expect(doneResult.done).toBe(true);

        expect(events.map((e) => e.type)).toEqual(['started', 'delta', 'cancelled']);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('8. Concurrent Requests Isolation', () => {
    it('concurrent independent chat calls do not cross-talk or corrupt each other', async () => {
      const provider = new MockBrainProvider();
      const req1 = createTestRequest('Message 1', 'req_A', 'sess_A');
      const req2 = createTestRequest('Message 2', 'req_B', 'sess_B');

      const [res1Events, res2Events] = await Promise.all([
        (async () => {
          const list: BrainEvent[] = [];
          for await (const e of provider.chat(req1)) list.push(e);
          return list;
        })(),
        (async () => {
          const list: BrainEvent[] = [];
          for await (const e of provider.chat(req2)) list.push(e);
          return list;
        })()
      ]);

      const req1Ids = res1Events.map((e) => e.requestId);
      const req2Ids = res2Events.map((e) => e.requestId);

      expect(new Set(req1Ids)).toEqual(new Set(['req_A']));
      expect(new Set(req2Ids)).toEqual(new Set(['req_B']));

      const res1Text = res1Events.filter((e) => e.type === 'delta').map((e: any) => e.text).join('');
      const res2Text = res2Events.filter((e) => e.type === 'delta').map((e: any) => e.text).join('');

      expect(res1Text).toBe('Mock response: Message 1');
      expect(res2Text).toBe('Mock response: Message 2');
    });

    it('cancelling one request does not affect concurrent requests', async () => {
      vi.useFakeTimers();
      try {
        const provider = new MockBrainProvider({ delayMs: 50, chunks: ['1', '2', '3'] });
        const abortA = new AbortController();

        const reqA = createTestRequest('Req A', 'req_A');
        const reqB = createTestRequest('Req B', 'req_B');

        const eventsA: BrainEvent[] = [];
        const eventsB: BrainEvent[] = [];

        const streamA = (async () => {
          for await (const e of provider.chat(reqA, { signal: abortA.signal })) {
            eventsA.push(e);
          }
        })();

        const streamB = (async () => {
          for await (const e of provider.chat(reqB)) {
            eventsB.push(e);
          }
        })();

        // Advance 50ms so both emit first chunk
        await vi.advanceTimersByTimeAsync(50);

        // Abort only A
        abortA.abort();

        // Advance enough for B to finish all 3 chunks
        await vi.advanceTimersByTimeAsync(150);

        await Promise.all([streamA, streamB]);

        expect(eventsA.some((e) => e.type === 'cancelled')).toBe(true);
        expect(eventsB.some((e) => e.type === 'cancelled')).toBe(false);
        expect(eventsB.some((e) => e.type === 'completed')).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
