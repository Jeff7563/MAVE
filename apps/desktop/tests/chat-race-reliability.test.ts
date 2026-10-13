import { describe, it, expect } from 'vitest';
import {
  chatReducer,
  initialChatState
} from '../src/renderer/src/components/chat-state.js';
import type {
  ResponseDeltaEvent,
  RequestFailedEvent,
  ResponseStartedEvent
} from '@mave/contracts';
import { ConversationManager } from '../src/main/conversation-manager.js';
import { createMaveDatabase } from '@mave/database';

describe('Developer Chat IPC Race Safety & Correlation (Phase 8)', () => {
  it('1. establishes requestId synchronously on SEND_INITIATED before IPC resolves', () => {
    const clientRequestId = 'client-uuid-12345';
    const s1 = chatReducer(initialChatState, {
      type: 'SEND_INITIATED',
      text: 'Race safety question',
      requestId: clientRequestId
    });

    expect(s1.activeRequestId).toBe(clientRequestId);
    expect(s1.messages.length).toBe(1);
    expect(s1.messages[0]?.requestId).toBe(clientRequestId);
    expect(s1.messages[0]?.role).toBe('user');
    expect(s1.status).toBe('sending');
    expect(s1.isStreaming).toBe(true);
  });

  it('2. seamlessly correlates early streaming events arriving before SEND_ACCEPTED', () => {
    const clientRequestId = 'client-uuid-race-1';

    // 1. Send initiated with synchronous client requestId
    let state = chatReducer(initialChatState, {
      type: 'SEND_INITIATED',
      text: 'Fast stream response',
      requestId: clientRequestId
    });

    // 2. Early event arrives over IPC BEFORE send() promise resolves
    const earlyStartedEvt: ResponseStartedEvent = {
      type: 'response_started',
      requestId: clientRequestId,
      sessionId: 'sess-fast',
      turnId: 'turn-early-1',
      providerId: 'mock',
      timestamp: Date.now()
    };
    state = chatReducer(state, { type: 'RUNTIME_EVENT', event: earlyStartedEvt });

    // Assistant placeholder exists immediately
    expect(state.messages.length).toBe(2);
    expect(state.messages[1]?.role).toBe('assistant');
    expect(state.messages[1]?.turnId).toBe('turn-early-1');
    expect(state.messages[1]?.status).toBe('streaming');

    // 3. Early delta arrives
    const earlyDeltaEvt: ResponseDeltaEvent = {
      type: 'response_delta',
      requestId: clientRequestId,
      sessionId: 'sess-fast',
      turnId: 'turn-early-1',
      text: 'First chunk',
      timestamp: Date.now()
    };
    state = chatReducer(state, { type: 'RUNTIME_EVENT', event: earlyDeltaEvt });
    expect(state.messages[1]?.content).toBe('First chunk');

    // 4. Now the send() promise finally resolves with SEND_ACCEPTED
    state = chatReducer(state, { type: 'SEND_ACCEPTED', requestId: clientRequestId });
    expect(state.activeRequestId).toBe(clientRequestId);
    // Message history must NOT be overwritten or corrupted
    expect(state.messages[1]?.content).toBe('First chunk');
  });

  it('3. rejects and drops events from alien or stale request IDs', () => {
    const activeReqId = 'our-current-req';
    let state = chatReducer(initialChatState, {
      type: 'SEND_INITIATED',
      text: 'Our query',
      requestId: activeReqId
    });

    const alienDelta: ResponseDeltaEvent = {
      type: 'response_delta',
      requestId: 'stale-or-alien-req',
      sessionId: 'other-session',
      turnId: 'other-turn',
      text: 'SHOULD BE DROPPED',
      timestamp: Date.now()
    };

    const newState = chatReducer(state, { type: 'RUNTIME_EVENT', event: alienDelta });
    expect(newState).toBe(state); // Unchanged
    expect(newState.messages.length).toBe(1); // Only our user message
  });

  it('4. cleans up active request and marks message failed on SEND_REJECTED', () => {
    const clientRequestId = 'req-rejected-1';
    let state = chatReducer(initialChatState, {
      type: 'SEND_INITIATED',
      text: 'Will be rejected',
      requestId: clientRequestId
    });

    state = chatReducer(state, {
      type: 'SEND_REJECTED',
      requestId: clientRequestId,
      error: 'Session busy'
    });

    expect(state.activeRequestId).toBeUndefined();
    expect(state.isStreaming).toBe(false);
    expect(state.status).toBe('failed');
    expect(state.error).toBe('Session busy');
    expect(state.messages[0]?.status).toBe('failed');
    expect(state.messages[0]?.error).toBe('Session busy');
  });

  it('5. handles provider_timeout in request_failed cleanly', () => {
    const clientRequestId = 'req-timeout-1';
    let state = chatReducer(initialChatState, {
      type: 'SEND_INITIATED',
      text: 'Times out',
      requestId: clientRequestId
    });

    const timeoutEvt: RequestFailedEvent = {
      type: 'request_failed',
      requestId: clientRequestId,
      sessionId: 'sess-1',
      turnId: 'turn-1',
      error: {
        code: 'provider_timeout',
        message: 'Request exceeded timeout of 30000ms',
        retryable: true
      },
      timestamp: Date.now()
    };

    state = chatReducer(state, { type: 'RUNTIME_EVENT', event: timeoutEvt });

    expect(state.activeRequestId).toBeUndefined();
    expect(state.isStreaming).toBe(false);
    expect(state.status).toBe('failed');
    expect(state.error).toBe('provider_timeout: Request exceeded timeout of 30000ms');

    const assistantMsg = state.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.status).toBe('failed');
    expect(assistantMsg?.error).toBe('provider_timeout: Request exceeded timeout of 30000ms');
  });

  it('6. safely creates placeholder if response_delta arrives before response_started', () => {
    const clientRequestId = 'req-out-of-order';
    let state = chatReducer(initialChatState, {
      type: 'SEND_INITIATED',
      text: 'Out of order test',
      requestId: clientRequestId
    });

    const deltaEvt: ResponseDeltaEvent = {
      type: 'response_delta',
      requestId: clientRequestId,
      sessionId: 'sess-1',
      turnId: 'turn-999',
      text: 'Direct delta',
      timestamp: Date.now()
    };

    state = chatReducer(state, { type: 'RUNTIME_EVENT', event: deltaEvt });

    expect(state.messages.length).toBe(2);
    expect(state.messages[1]?.role).toBe('assistant');
    expect(state.messages[1]?.content).toBe('Direct delta');
    expect(state.messages[1]?.status).toBe('streaming');
  });

  it('7. ConversationManager cancels all active requests cleanly on dispose()', async () => {
    const db = await createMaveDatabase(':memory:');
    const manager = new ConversationManager({
      database: db,
      timeoutMs: 1000
    });

    const sendRes = await manager.handleSend({ message: 'To be disposed' });
    expect(sendRes.accepted).toBe(true);

    // Call dispose
    await manager.dispose();

    // Verify manager clean up without errors
    db.close();
  });
});
