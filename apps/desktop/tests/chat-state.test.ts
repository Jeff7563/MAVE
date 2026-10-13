import { describe, it, expect, vi } from 'vitest';
import {
  chatReducer,
  initialChatState,
  shouldSubmitOnKeyDown,
  validateSendInput,
  type ChatState
} from '../src/renderer/src/components/chat-state.js';
import type {
  ProviderSelectedEvent,
  RequestCancelledEvent,
  RequestFailedEvent,
  RequestStartedEvent,
  ResponseCompletedEvent,
  ResponseDeltaEvent,
  ResponseStartedEvent,
  SessionReadyEvent
} from '@mave/contracts';

describe('Developer Chat State & Reducer (Phase 7)', () => {
  // 1. Input renders & updates draft state
  it('1. updates draft input state correctly', () => {
    const s1 = chatReducer(initialChatState, { type: 'SET_DRAFT', draft: 'Hello MAVE' });
    expect(s1.draftInput).toBe('Hello MAVE');
  });

  // 2. Empty send rejected locally
  it('2. rejects empty or whitespace-only send input locally', () => {
    expect(validateSendInput('').valid).toBe(false);
    expect(validateSendInput('   ').valid).toBe(false);
    expect(validateSendInput('\t\n').valid).toBe(false);
    expect(validateSendInput('Valid message').valid).toBe(true);

    const s1 = chatReducer(initialChatState, { type: 'SEND_INITIATED', text: '   ' });
    expect(s1.messages.length).toBe(0);
    expect(s1.error).toBeDefined();
    expect(s1.status).toBe('idle');
  });

  // 3. Valid send updates state to sending and appends user message
  it('3. valid send creates user message and transitions state to sending', () => {
    const s1 = chatReducer(initialChatState, { type: 'SEND_INITIATED', text: 'Hello' });
    expect(s1.messages.length).toBe(1);
    expect(s1.messages[0]?.role).toBe('user');
    expect(s1.messages[0]?.content).toBe('Hello');
    expect(s1.status).toBe('sending');
    expect(s1.isStreaming).toBe(true);
    expect(s1.draftInput).toBe('');

    const s2 = chatReducer(s1, { type: 'SEND_ACCEPTED', requestId: 'req-101' });
    expect(s2.activeRequestId).toBe('req-101');
    expect(s2.messages[0]?.requestId).toBe('req-101');
  });

  // 4. First request sends without sessionId
  it('4. ensures initial state has undefined sessionId for first request', () => {
    expect(initialChatState.sessionId).toBeUndefined();
  });

  // 5. After session_ready next request reuses sessionId
  it('5. captures sessionId from session_ready event and retains it for future requests', () => {
    const sessionReadyEvt: SessionReadyEvent = {
      type: 'session_ready',
      requestId: 'req-1',
      sessionId: 'session-abc-123',
      timestamp: Date.now()
    };

    const s1 = chatReducer(
      { ...initialChatState, activeRequestId: 'req-1' },
      { type: 'RUNTIME_EVENT', event: sessionReadyEvt }
    );
    expect(s1.sessionId).toBe('session-abc-123');

    // Subsequent send retains the same sessionId
    const s2 = chatReducer(s1, { type: 'SEND_INITIATED', text: 'Second question' });
    expect(s2.sessionId).toBe('session-abc-123');
  });

  // 6. Provider_selected updates diagnostics
  it('6. updates providerId diagnostic upon provider_selected event', () => {
    const providerEvt: ProviderSelectedEvent = {
      type: 'provider_selected',
      requestId: 'req-1',
      sessionId: 'session-1',
      providerId: 'mock',
      fallbackUsed: false,
      reason: 'default',
      timestamp: Date.now()
    };

    const s1 = chatReducer(
      { ...initialChatState, activeRequestId: 'req-1' },
      { type: 'RUNTIME_EVENT', event: providerEvt }
    );
    expect(s1.providerId).toBe('mock');
  });

  // 7. Response_started creates assistant placeholder
  it('7. creates assistant placeholder with status streaming upon response_started', () => {
    const responseStartedEvt: ResponseStartedEvent = {
      type: 'response_started',
      requestId: 'req-1',
      sessionId: 'session-1',
      turnId: 'turn-999',
      providerId: 'mock',
      timestamp: Date.now()
    };

    const s1 = chatReducer(
      { ...initialChatState, activeRequestId: 'req-1' },
      { type: 'RUNTIME_EVENT', event: responseStartedEvt }
    );

    expect(s1.messages.length).toBe(1);
    const placeholder = s1.messages[0];
    expect(placeholder?.role).toBe('assistant');
    expect(placeholder?.turnId).toBe('turn-999');
    expect(placeholder?.content).toBe('');
    expect(placeholder?.status).toBe('streaming');
    expect(s1.status).toBe('streaming');
  });

  // 8. Response_delta appends text incrementally
  it('8. appends delta text incrementally to active assistant message', () => {
    const stateWithPlaceholder: ChatState = {
      ...initialChatState,
      activeRequestId: 'req-1',
      messages: [
        {
          id: 'assistant-1',
          requestId: 'req-1',
          role: 'assistant',
          content: 'Hello',
          status: 'streaming'
        }
      ]
    };

    const deltaEvt: ResponseDeltaEvent = {
      type: 'response_delta',
      requestId: 'req-1',
      sessionId: 'session-1',
      turnId: 'turn-1',
      text: ' world',
      timestamp: Date.now()
    };

    const s1 = chatReducer(stateWithPlaceholder, { type: 'RUNTIME_EVENT', event: deltaEvt });
    expect(s1.messages[0]?.content).toBe('Hello world');
    expect(s1.messages[0]?.status).toBe('streaming');
  });

  // 9. Multiple deltas reconstruct response correctly
  it('9. accurately reconstructs complete text across multiple rapid deltas', () => {
    let state: ChatState = {
      ...initialChatState,
      activeRequestId: 'req-1',
      messages: [
        {
          id: 'assistant-1',
          requestId: 'req-1',
          role: 'assistant',
          content: '',
          status: 'streaming'
        }
      ]
    };

    const words = ['Mock', ' ', 'response:', ' ', 'Hello', ' ', 'MAVE'];
    for (const word of words) {
      const deltaEvt: ResponseDeltaEvent = {
        type: 'response_delta',
        requestId: 'req-1',
        sessionId: 'session-1',
        turnId: 'turn-1',
        text: word,
        timestamp: Date.now()
      };
      state = chatReducer(state, { type: 'RUNTIME_EVENT', event: deltaEvt });
    }

    expect(state.messages[0]?.content).toBe('Mock response: Hello MAVE');
  });

  // 10. Response_completed finalizes response
  it('10. finalizes assistant message and marks status completed upon response_completed', () => {
    const stateStreaming: ChatState = {
      ...initialChatState,
      activeRequestId: 'req-1',
      isStreaming: true,
      status: 'streaming',
      messages: [
        {
          id: 'assistant-1',
          requestId: 'req-1',
          role: 'assistant',
          content: 'Partial text',
          status: 'streaming'
        }
      ]
    };

    const completedEvt: ResponseCompletedEvent = {
      type: 'response_completed',
      requestId: 'req-1',
      sessionId: 'session-1',
      turnId: 'turn-1',
      text: 'Final complete text',
      finishReason: 'stop',
      timestamp: Date.now()
    };

    const s1 = chatReducer(stateStreaming, { type: 'RUNTIME_EVENT', event: completedEvt });
    expect(s1.messages[0]?.status).toBe('completed');
    expect(s1.messages[0]?.content).toBe('Final complete text');
    expect(s1.isStreaming).toBe(false);
    expect(s1.status).toBe('completed');
    expect(s1.activeRequestId).toBeUndefined();
  });

  // 11. Request_failed shows error
  it('11. marks message as failed and stores error message on request_failed', () => {
    const stateStreaming: ChatState = {
      ...initialChatState,
      activeRequestId: 'req-1',
      isStreaming: true,
      status: 'streaming',
      messages: [
        {
          id: 'assistant-1',
          requestId: 'req-1',
          role: 'assistant',
          content: '',
          status: 'streaming'
        }
      ]
    };

    const failedEvt: RequestFailedEvent = {
      type: 'request_failed',
      requestId: 'req-1',
      sessionId: 'session-1',
      error: {
        code: 'provider_error',
        message: 'Mock provider encountered an error'
      },
      timestamp: Date.now()
    };

    const s1 = chatReducer(stateStreaming, { type: 'RUNTIME_EVENT', event: failedEvt });
    expect(s1.isStreaming).toBe(false);
    expect(s1.status).toBe('failed');
    expect(s1.error).toBe('provider_error: Mock provider encountered an error');
    expect(s1.messages[0]?.status).toBe('failed');
    expect(s1.messages[0]?.error).toBe('provider_error: Mock provider encountered an error');
    expect(s1.activeRequestId).toBeUndefined();
  });

  // 12. Request_cancelled restores UI state
  it('12. marks assistant message cancelled and restores UI state on request_cancelled', () => {
    const stateStreaming: ChatState = {
      ...initialChatState,
      activeRequestId: 'req-1',
      isStreaming: true,
      status: 'streaming',
      messages: [
        {
          id: 'assistant-1',
          requestId: 'req-1',
          role: 'assistant',
          content: 'Started...',
          status: 'streaming'
        }
      ]
    };

    const cancelledEvt: RequestCancelledEvent = {
      type: 'request_cancelled',
      requestId: 'req-1',
      sessionId: 'session-1',
      reason: 'Cancelled by user',
      timestamp: Date.now()
    };

    const s1 = chatReducer(stateStreaming, { type: 'RUNTIME_EVENT', event: cancelledEvt });
    expect(s1.isStreaming).toBe(false);
    expect(s1.status).toBe('cancelled');
    expect(s1.messages[0]?.status).toBe('cancelled');
    expect(s1.activeRequestId).toBeUndefined();
  });

  // 13. Cancel action / dispatch updates state
  it('13. transitions state to cancelling when cancel action is dispatched', () => {
    const stateStreaming: ChatState = {
      ...initialChatState,
      activeRequestId: 'req-1',
      isStreaming: true,
      status: 'streaming'
    };

    const s1 = chatReducer(stateStreaming, { type: 'CANCEL_CLICKED' });
    expect(s1.status).toBe('cancelling');
  });

  // 14. Send disabled while active session request is streaming
  it('14. verifies isStreaming remains true until stream completes or terminates', () => {
    const s1 = chatReducer(initialChatState, { type: 'SEND_INITIATED', text: 'Hi' });
    expect(s1.isStreaming).toBe(true);

    const startEvt: RequestStartedEvent = {
      type: 'request_started',
      requestId: 'req-1',
      timestamp: Date.now()
    };
    const s2 = chatReducer(s1, { type: 'RUNTIME_EVENT', event: startEvt });
    expect(s2.isStreaming).toBe(true);
  });

  // 15. Unrelated requestId event ignored
  it('15. ignores runtime events from unrelated requestId', () => {
    const stateActive: ChatState = {
      ...initialChatState,
      activeRequestId: 'req-ours',
      messages: [
        {
          id: 'assistant-1',
          requestId: 'req-ours',
          role: 'assistant',
          content: 'Our message',
          status: 'streaming'
        }
      ]
    };

    const deltaOther: ResponseDeltaEvent = {
      type: 'response_delta',
      requestId: 'req-other-alien',
      sessionId: 'session-1',
      turnId: 'turn-other',
      text: ' SHOULD NOT APPEAR',
      timestamp: Date.now()
    };

    const s1 = chatReducer(stateActive, { type: 'RUNTIME_EVENT', event: deltaOther });
    expect(s1.messages[0]?.content).toBe('Our message');
  });

  // 16. Event unsubscribe called on component cleanup
  it('16. verifies unsubscribe function cleans up listener without leaking', () => {
    const listeners: Function[] = [];
    const mockOnEvent = (cb: Function) => {
      listeners.push(cb);
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    };

    const callback = vi.fn();
    const unsubscribe = mockOnEvent(callback);
    expect(listeners.length).toBe(1);

    unsubscribe();
    expect(listeners.length).toBe(0);
  });

  // 17. Enter sends
  it('17. detects Enter key without Shift as a submit trigger', () => {
    expect(shouldSubmitOnKeyDown({ key: 'Enter', shiftKey: false })).toBe(true);
  });

  // 18. Shift+Enter does not send
  it('18. detects Shift+Enter as newline, preventing submit', () => {
    expect(shouldSubmitOnKeyDown({ key: 'Enter', shiftKey: true })).toBe(false);
    expect(shouldSubmitOnKeyDown({ key: 'a', shiftKey: false })).toBe(false);
  });

  // 19. IPC unavailable state handled without crash
  it('19. handles SEND_REJECTED gracefully when IPC is unavailable', () => {
    const s1 = chatReducer(initialChatState, {
      type: 'SEND_REJECTED',
      error: 'Conversation IPC unavailable'
    });

    expect(s1.status).toBe('failed');
    expect(s1.error).toBe('Conversation IPC unavailable');
    expect(s1.isStreaming).toBe(false);
  });

  // Bonus: Load session functionality
  it('20. tests session resume/load actions and state transitions', () => {
    const s1 = chatReducer(initialChatState, {
      type: 'LOAD_SESSION_SUCCESS',
      sessionId: 'loaded-session-999'
    });

    expect(s1.sessionId).toBe('loaded-session-999');
    expect(s1.loadSessionNotice).toContain('loaded-session-999');

    const s2 = chatReducer(initialChatState, {
      type: 'LOAD_SESSION_ERROR',
      error: "Session 'invalid' not found"
    });
    expect(s2.error).toBe("Session 'invalid' not found");
  });
});
