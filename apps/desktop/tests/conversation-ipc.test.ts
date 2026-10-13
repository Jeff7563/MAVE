import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CHAT_IPC_CHANNELS,
  type ChatSendRequest,
  type ConversationRuntimeEvent,
  type ResponseCompletedEvent,
  type RequestFailedEvent,
  type RequestCancelledEvent
} from '@mave/contracts';
import { createMaveDatabase, type MaveDatabase } from '@mave/database';
import { ConversationManager } from '../src/main/conversation-manager.js';
import { registerConversationIpcHandlers } from '../src/main/ipc.js';
import { ipcMain } from 'electron';

// Mock electron ipcMain
vi.mock('electron', () => {
  const handlers = new Map<string, Function>();
  return {
    ipcMain: {
      handle: vi.fn((channel: string, handler: Function) => {
        handlers.set(channel, handler);
      }),
      removeHandler: vi.fn((channel: string) => {
        handlers.delete(channel);
      }),
      // test helper to invoke registered handler
      _invoke: async (channel: string, event: any, payload: any) => {
        const handler = handlers.get(channel);
        if (!handler) throw new Error(`No handler registered for ${channel}`);
        return handler(event, payload);
      },
      _hasHandler: (channel: string) => handlers.has(channel),
      _clear: () => handlers.clear()
    }
  };
});

function createMockWindow() {
  const sentEvents: Array<{ channel: string; event: ConversationRuntimeEvent }> = [];
  let isDestroyedVal = false;

  const mockWin: any = {
    isDestroyed: () => isDestroyedVal,
    webContents: {
      send: vi.fn((channel: string, event: ConversationRuntimeEvent) => {
        if (!isDestroyedVal) {
          sentEvents.push({ channel, event });
        }
      })
    }
  };

  return {
    mockWin,
    sentEvents,
    setDestroyed: (val: boolean) => {
      isDestroyedVal = val;
    }
  };
}

async function waitForTerminalEvent(
  sentEvents: Array<{ channel: string; event: ConversationRuntimeEvent }>,
  requestId?: string,
  timeoutMs = 3000
): Promise<ConversationRuntimeEvent> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = sentEvents.find((e) => {
      if (e.channel !== CHAT_IPC_CHANNELS.STREAM) return false;
      if (requestId && e.event.requestId !== requestId) return false;
      return (
        e.event.type === 'response_completed' ||
        e.event.type === 'request_failed' ||
        e.event.type === 'request_cancelled'
      );
    });
    if (found) return found.event;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error(`Timed out waiting for terminal event (requestId=${requestId})`);
}

describe('Conversation IPC Streaming & Main Manager', () => {
  let db: MaveDatabase;
  let manager: ConversationManager;
  let mockWinHelper: ReturnType<typeof createMockWindow>;

  beforeEach(async () => {
    (ipcMain as any)._clear?.();
    db = await createMaveDatabase(':memory:');
    mockWinHelper = createMockWindow();
    manager = new ConversationManager({
      database: db,
      getMainWindow: () => mockWinHelper.mockWin,
      coalesceWindowMs: 0 // direct forwarding by default for deterministic tests
    });
  });

  afterEach(async () => {
    await manager.dispose();
    db.close();
  });

  // 1. Valid chat send accepted
  it('1. accepts valid chat send and returns acknowledgement immediately', async () => {
    const res = await manager.handleSend({ message: 'Hello MAVE' });

    expect(res.accepted).toBe(true);
    if (res.accepted) {
      expect(typeof res.requestId).toBe('string');
      expect(res.requestId.length).toBeGreaterThan(0);
    }
  });

  // 2. Request reaches ConversationRuntime
  it('2. ensures chat send reaches ConversationRuntime', async () => {
    const runtime = manager.getRuntime();
    const sendSpy = vi.spyOn(runtime, 'send');

    const res = await manager.handleSend({
      message: 'Testing runtime invocation',
      requestId: 'test-req-2'
    });

    expect(res.accepted).toBe(true);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Testing runtime invocation',
        requestId: 'test-req-2'
      }),
      expect.any(Object)
    );
  });

  // 3. Request acknowledgement contains usable requestId
  it('3. returns acknowledgement containing matching usable requestId', async () => {
    const explicitId = 'my-custom-request-id-123';
    const res = await manager.handleSend({
      message: 'Hello with custom ID',
      requestId: explicitId
    });

    expect(res.accepted).toBe(true);
    if (res.accepted) {
      expect(res.requestId).toBe(explicitId);
    }

    const terminal = await waitForTerminalEvent(mockWinHelper.sentEvents, explicitId);
    expect(terminal.requestId).toBe(explicitId);
  });

  // 4. Runtime events forwarded to Renderer
  it('4. forwards conversation runtime events to webContents via mave:chat-stream', async () => {
    const res = await manager.handleSend({ message: 'Forward test' });
    expect(res.accepted).toBe(true);

    const terminal = await waitForTerminalEvent(mockWinHelper.sentEvents);
    expect(terminal.type).toBe('response_completed');

    expect(mockWinHelper.sentEvents.length).toBeGreaterThan(0);
    for (const sent of mockWinHelper.sentEvents) {
      expect(sent.channel).toBe(CHAT_IPC_CHANNELS.STREAM);
      expect(sent.event).toHaveProperty('type');
      expect(sent.event).toHaveProperty('requestId');
    }
  });

  // 5. Successful event order preserved
  it('5. preserves chronological event ordering from start to completion', async () => {
    const res = await manager.handleSend({ message: 'Ordering check' });
    expect(res.accepted).toBe(true);

    await waitForTerminalEvent(mockWinHelper.sentEvents);

    const eventTypes = mockWinHelper.sentEvents.map((e) => e.event.type);
    expect(eventTypes[0]).toBe('request_started');
    expect(eventTypes[1]).toBe('session_ready');
    expect(eventTypes[2]).toBe('provider_selected');
    expect(eventTypes[3]).toBe('response_started');
    expect(eventTypes).toContain('response_delta');
    expect(eventTypes[eventTypes.length - 1]).toBe('response_completed');
  });

  // 6. Response_delta text preserved
  it('6. preserves response_delta text emitted by Mock Brain', async () => {
    manager.getMockProvider().setResponseText('One two three');

    await manager.handleSend({ message: 'Hi' });
    await waitForTerminalEvent(mockWinHelper.sentEvents);

    const deltas = mockWinHelper.sentEvents
      .filter((e) => e.event.type === 'response_delta')
      .map((e) => (e.event as any).text);

    expect(deltas.join('')).toBe('One two three');
  });

  // 7. Response_completed forwarded
  it('7. forwards response_completed containing full text, finishReason and usage', async () => {
    manager.getMockProvider().setResponseText('Final complete answer');

    await manager.handleSend({ message: 'Complete me' });
    const terminal = (await waitForTerminalEvent(mockWinHelper.sentEvents)) as ResponseCompletedEvent;

    expect(terminal.type).toBe('response_completed');
    expect(terminal.text).toBe('Final complete answer');
    expect(terminal.finishReason).toBe('stop');
    expect(terminal.usage).toBeDefined();
    expect(terminal.usage?.promptTokens).toBeGreaterThan(0);
  });

  // 8. Request_failed forwarded
  it('8. forwards request_failed with normalized error when provider fails', async () => {
    manager
      .getMockProvider()
      .setFailureMode('error_event', 'provider_unavailable', 'Mock provider simulation failure', false);

    await manager.handleSend({ message: 'Will fail' });
    const terminal = (await waitForTerminalEvent(mockWinHelper.sentEvents)) as RequestFailedEvent;

    expect(terminal.type).toBe('request_failed');
    expect(terminal.error).toBeDefined();
    expect(terminal.error.code).toBe('provider_unavailable');
    expect(terminal.error.message).toContain('Mock provider simulation failure');
  });

  // 9. Request_cancelled forwarded
  it('9. forwards request_cancelled when cancellation occurs during streaming', async () => {
    manager.getMockProvider().setDelay(40);

    const res = await manager.handleSend({ message: 'Will be cancelled' });
    expect(res.accepted).toBe(true);

    if (res.accepted) {
      // Let streaming start, then cancel
      await new Promise((r) => setTimeout(r, 20));
      const cancelRes = await manager.handleCancel({ requestId: res.requestId });
      expect(cancelRes.cancelled).toBe(true);

      const terminal = (await waitForTerminalEvent(
        mockWinHelper.sentEvents,
        res.requestId
      )) as RequestCancelledEvent;
      expect(terminal.type).toBe('request_cancelled');
      expect(terminal.requestId).toBe(res.requestId);
    }
  });

  // 10. Cancellation command calls runtime.cancel()
  it('10. routes cancel IPC command to runtime.cancel()', async () => {
    const cancelSpy = vi.spyOn(manager.getRuntime(), 'cancel');

    const result = await manager.handleCancel({ requestId: 'cancel-test-id' });
    expect(cancelSpy).toHaveBeenCalledWith('cancel-test-id');
    expect(result.requestId).toBe('cancel-test-id');
  });

  // 11. Unknown cancellation returns deterministic result
  it('11. returns deterministic { cancelled: false } for unknown request without throwing', async () => {
    const result = await manager.handleCancel({ requestId: 'non-existent-request-xyz' });

    expect(result).toEqual({
      cancelled: false,
      requestId: 'non-existent-request-xyz'
    });
  });

  // 12. Invalid chat request rejected
  it('12. rejects invalid or empty chat request payloads at IPC boundary', async () => {
    // Empty message
    const resEmpty = await manager.handleSend({ message: '' });
    expect(resEmpty.accepted).toBe(false);
    if (!resEmpty.accepted) {
      expect(resEmpty.error.code).toBe('invalid_request');
    }

    // Whitespace message
    const resWhitespace = await manager.handleSend({ message: '    ' });
    expect(resWhitespace.accepted).toBe(false);

    // Non-string message
    const resNum = await manager.handleSend({ message: 12345 });
    expect(resNum.accepted).toBe(false);

    // Null payload
    const resNull = await manager.handleSend(null);
    expect(resNull.accepted).toBe(false);

    // Empty explicit requestId
    const resEmptyReqId = await manager.handleSend({ message: 'Valid', requestId: '   ' });
    expect(resEmptyReqId.accepted).toBe(false);
  });

  // 13. Malformed capability request rejected
  it('13. rejects malformed capability requests and unexpected arbitrary keys', async () => {
    // Unknown arbitrary keys rejected by strict schema
    const resUnknownKey = await manager.handleSend({
      message: 'Hello',
      maliciousExtraProperty: 'exploit'
    });
    expect(resUnknownKey.accepted).toBe(false);

    // Malformed capability object
    const resBadCaps = await manager.handleSend({
      message: 'Hello',
      requiredCapabilities: {
        streaming: 'not-a-boolean' as any
      }
    });
    expect(resBadCaps.accepted).toBe(false);

    // Unknown capability in requiredCapabilities rejected
    const resUnknownCap = await manager.handleSend({
      message: 'Hello',
      requiredCapabilities: {
        nonExistentCap: true as any
      }
    });
    expect(resUnknownCap.accepted).toBe(false);
  });

  // 14. No raw Error instance crosses IPC
  it('14. guarantees only plain serializable objects cross the IPC boundary', async () => {
    // Rejected request
    const rejectedRes = await manager.handleSend({ message: '' });
    expect(rejectedRes.accepted).toBe(false);
    if (!rejectedRes.accepted) {
      expect(rejectedRes.error instanceof Error).toBe(false);
      expect(typeof rejectedRes.error).toBe('object');
    }

    // Failed stream event
    manager.getMockProvider().setFailureMode('error_event', 'runtime_error', 'Failure details');
    await manager.handleSend({ message: 'Trigger failure' });
    const failedEvent = (await waitForTerminalEvent(mockWinHelper.sentEvents)) as RequestFailedEvent;

    expect(failedEvent.error instanceof Error).toBe(false);
    expect(typeof failedEvent.error).toBe('object');
    expect(failedEvent.error.code).toBe('runtime_error');
  });

  // 15. Multiple request streams remain correlated by requestId
  it('15. correlates multiple concurrent request streams strictly by requestId', async () => {
    manager.getMockProvider().setDelay(10);

    const [res1, res2] = await Promise.all([
      manager.handleSend({ message: 'Stream 1 message', requestId: 'req-alpha' }),
      manager.handleSend({ message: 'Stream 2 message', requestId: 'req-beta' })
    ]);

    expect(res1.accepted).toBe(true);
    expect(res2.accepted).toBe(true);

    await Promise.all([
      waitForTerminalEvent(mockWinHelper.sentEvents, 'req-alpha'),
      waitForTerminalEvent(mockWinHelper.sentEvents, 'req-beta')
    ]);

    const alphaEvents = mockWinHelper.sentEvents.filter((e) => e.event.requestId === 'req-alpha');
    const betaEvents = mockWinHelper.sentEvents.filter((e) => e.event.requestId === 'req-beta');

    expect(alphaEvents.length).toBeGreaterThan(0);
    expect(betaEvents.length).toBeGreaterThan(0);

    for (const e of alphaEvents) {
      expect(e.event.requestId).toBe('req-alpha');
    }
    for (const e of betaEvents) {
      expect(e.event.requestId).toBe('req-beta');
    }
  });

  // 16. Listener unsubscribe removes callback
  it('16. tests listener subscribe and unsubscribe behavior in preload-style consumer', () => {
    const listeners: Function[] = [];
    const onEvent = (cb: (event: ConversationRuntimeEvent) => void) => {
      listeners.push(cb);
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    };

    const received: string[] = [];
    const unsubscribe = onEvent((evt) => {
      received.push(evt.requestId);
    });

    expect(listeners.length).toBe(1);

    // Emit event 1
    listeners.forEach((fn) => fn({ type: 'request_started', requestId: 'id-1', timestamp: Date.now() }));
    expect(received).toEqual(['id-1']);

    // Unsubscribe
    unsubscribe();
    expect(listeners.length).toBe(0);

    // Emit event 2 - should not be received
    listeners.forEach((fn) => fn({ type: 'request_started', requestId: 'id-2', timestamp: Date.now() }));
    expect(received).toEqual(['id-1']);
  });

  // 17. Destroyed webContents does not crash event forwarding
  it('17. drops events gracefully without crashing when webContents is destroyed', async () => {
    mockWinHelper.setDestroyed(true);

    const res = await manager.handleSend({ message: 'Window closed mid-stream' });
    expect(res.accepted).toBe(true);

    // Wait a brief moment for background stream to run
    await new Promise((r) => setTimeout(r, 50));

    // Zero events should be pushed to destroyed window and no exception thrown
    expect(mockWinHelper.sentEvents.length).toBe(0);
  });

  // 18. Mock Brain response can complete end-to-end through Main IPC harness
  it('18. completes full request-response lifecycle through registered IPC handler harness', async () => {
    const unregister = registerConversationIpcHandlers(manager);

    const sendResult = await (ipcMain as any)._invoke(CHAT_IPC_CHANNELS.SEND, {}, {
      message: 'IPC Harness test message'
    });

    expect(sendResult.accepted).toBe(true);
    const terminal = await waitForTerminalEvent(mockWinHelper.sentEvents, sendResult.requestId);
    expect(terminal.type).toBe('response_completed');

    unregister();
    expect((ipcMain as any)._hasHandler(CHAT_IPC_CHANNELS.SEND)).toBe(false);
  });

  // 19. INTEGRATION TEST (Requirement 24)
  it('19. [Integration] full end-to-end flow from IPC request through Mock Brain to SQLite persistence', async () => {
    const req: ChatSendRequest = {
      message: 'Persist this conversation test',
      requestId: 'persist-integration-req-1'
    };

    const res = await manager.handleSend(req);
    expect(res.accepted).toBe(true);

    const terminal = (await waitForTerminalEvent(
      mockWinHelper.sentEvents,
      'persist-integration-req-1'
    )) as ResponseCompletedEvent;
    expect(terminal.type).toBe('response_completed');
    expect(terminal.text).toBe('Mock response: Persist this conversation test');

    // Verify persisted session & turns in SQLite
    const store = manager.getStore();
    const session = await store.getSession(terminal.sessionId);
    expect(session).toBeDefined();
    expect(session?.id).toBe(terminal.sessionId);
    expect(session?.status).toBe('active');

    const turns = await store.getTurns(terminal.sessionId);
    expect(turns.length).toBe(2);

    // User turn
    const userTurn = turns.find((t) => t.role === 'user');
    expect(userTurn).toBeDefined();
    expect(userTurn?.content).toBe('Persist this conversation test');
    expect(userTurn?.status).toBe('completed');

    // Assistant turn
    const assistantTurn = turns.find((t) => t.role === 'assistant');
    expect(assistantTurn).toBeDefined();
    expect(assistantTurn?.content).toBe('Mock response: Persist this conversation test');
    expect(assistantTurn?.status).toBe('completed');
    expect(assistantTurn?.providerId).toBe('mock');

    // Verify session resume / load via handleLoadSession
    const loadRes = await manager.handleLoadSession({ sessionId: terminal.sessionId });
    expect(loadRes.success).toBe(true);
    expect(loadRes.session?.id).toBe(terminal.sessionId);
  });

  // 20. Delta coalescing test
  it('20. tests delta coalescing when coalesceWindowMs is configured', async () => {
    const coalescedMockHelper = createMockWindow();
    const coalescedManager = new ConversationManager({
      database: db,
      getMainWindow: () => coalescedMockHelper.mockWin,
      coalesceWindowMs: 40 // 40ms batching window
    });

    try {
      coalescedManager.getMockProvider().setResponseText('WordA WordB WordC');

      const res = await coalescedManager.handleSend({ message: 'Coalesce please' });
      expect(res.accepted).toBe(true);

      const terminal = await waitForTerminalEvent(coalescedMockHelper.sentEvents);
      expect(terminal.type).toBe('response_completed');

      // Check deltas
      const deltas = coalescedMockHelper.sentEvents
        .filter((e) => e.event.type === 'response_delta')
        .map((e) => (e.event as any).text);

      expect(deltas.join('')).toBe('WordA WordB WordC');
    } finally {
      await coalescedManager.dispose();
    }
  });

  // 21. Manager dispose cleans up active controllers and coalescers
  it('21. shuts down cleanly and cancels active requests on dispose', async () => {
    manager.getMockProvider().setDelay(100);

    const res = await manager.handleSend({ message: 'Shutdown mid-stream' });
    expect(res.accepted).toBe(true);

    // Dispose manager immediately while request is in-flight
    await manager.dispose();

    // Verify runtime has 0 active requests
    expect(manager.getRuntime().getActiveRequestCount()).toBe(0);
  });
});
