import React, { useReducer, useEffect, useRef } from 'react';
import {
  chatReducer,
  initialChatState,
  shouldSubmitOnKeyDown,
  validateSendInput
} from './chat-state';

export const DeveloperChat: React.FC = () => {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [selectedProvider, setSelectedProvider] = React.useState<string>('ollama');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  const ipcAvailable = typeof window !== 'undefined' && !!window.mave?.chat;

  // Subscribe to conversation runtime events
  useEffect(() => {
    if (!window.mave?.chat?.onEvent) {
      return undefined;
    }

    const unsubscribe = window.mave.chat.onEvent((event) => {
      // Ignore events for previous/unrelated requests if we have an active request tracked
      if (activeRequestIdRef.current && event.requestId !== activeRequestIdRef.current) {
        return;
      }

      // If this is a terminal event, clear activeRequestIdRef
      if (
        event.type === 'response_completed' ||
        event.type === 'request_cancelled' ||
        event.type === 'request_failed'
      ) {
        if (activeRequestIdRef.current === event.requestId) {
          activeRequestIdRef.current = null;
        }
      }

      dispatch({ type: 'RUNTIME_EVENT', event });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-scroll on new messages or deltas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const handleSend = async () => {
    const text = state.draftInput;
    const validation = validateSendInput(text);
    if (!validation.valid) {
      dispatch({ type: 'SEND_INITIATED', text });
      return;
    }

    if (!window.mave?.chat) {
      dispatch({ type: 'SEND_REJECTED', error: 'Conversation IPC unavailable' });
      return;
    }

    // Generate client-side requestId synchronously before invoking IPC to eliminate race conditions
    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    activeRequestIdRef.current = requestId;
    dispatch({ type: 'SEND_INITIATED', text, requestId });

    try {
      const response = await window.mave.chat.send({
        requestId,
        message: text.trim(),
        sessionId: state.sessionId,
        preferredProviderId: selectedProvider
      });

      if (response.accepted) {
        dispatch({ type: 'SEND_ACCEPTED', requestId: response.requestId });
      } else {
        activeRequestIdRef.current = null;
        dispatch({
          type: 'SEND_REJECTED',
          requestId,
          error: response.error?.message || 'Request was rejected by runtime'
        });
      }
    } catch (err: any) {
      activeRequestIdRef.current = null;
      dispatch({
        type: 'SEND_REJECTED',
        requestId,
        error: err?.message || 'Failed to send chat request'
      });
    }
  };

  const handleCancel = async () => {
    const targetRequestId = activeRequestIdRef.current || state.activeRequestId;
    if (!targetRequestId || !window.mave?.chat) return;

    dispatch({ type: 'CANCEL_CLICKED' });
    try {
      await window.mave.chat.cancel(targetRequestId);
    } catch (err: any) {
      console.error('Failed to cancel request:', err);
    }
  };

  const handleLoadSession = async () => {
    const sessionId = state.loadSessionInput.trim();
    if (!sessionId) return;

    if (!window.mave?.chat?.loadSession) {
      dispatch({
        type: 'LOAD_SESSION_ERROR',
        error: 'Session loading is unavailable in this environment'
      });
      return;
    }

    try {
      const result = await window.mave.chat.loadSession(sessionId);
      if (result.success && result.session) {
        dispatch({ type: 'LOAD_SESSION_SUCCESS', sessionId: result.session.id });
      } else {
        dispatch({
          type: 'LOAD_SESSION_ERROR',
          error: result.error || `Session '${sessionId}' not found`
        });
      }
    } catch (err: any) {
      dispatch({
        type: 'LOAD_SESSION_ERROR',
        error: err?.message || 'Failed to load session'
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldSubmitOnKeyDown(e)) {
      e.preventDefault();
      if (!state.isStreaming && state.draftInput.trim()) {
        handleSend();
      }
    }
  };

  return (
    <div className="card developer-chat" data-testid="developer-chat-card">
      <div className="developer-controls">
        <h2>Developer Text Chat (M2)</h2>
        <div className="provider-selector-row">
          <label htmlFor="provider-select" className="control-label">Provider:</label>
          <select
            id="provider-select"
            data-testid="chat-select-provider"
            className="chat-provider-select"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            disabled={state.isStreaming}
          >
            <option value="ollama">ollama (Local Fast Brain)</option>
            <option value="mock">mock (Deterministic)</option>
            <option value="antigravity">antigravity (Google Antigravity CLI)</option>
          </select>
        </div>
      </div>

      {!ipcAvailable && (
        <div className="error-banner" data-testid="chat-ipc-unavailable">
          Conversation IPC unavailable outside Electron
        </div>
      )}

      {/* Diagnostics Grid */}
      <div className="chat-diagnostics" data-testid="chat-diagnostics-panel">
        <div className="diagnostic-item">
          <span className="diagnostic-label">Session:</span>
          <span className="diagnostic-value" data-testid="chat-diagnostic-session">
            {state.sessionId || 'none'}
          </span>
        </div>
        <div className="diagnostic-item">
          <span className="diagnostic-label">Request:</span>
          <span className="diagnostic-value" data-testid="chat-diagnostic-request">
            {state.activeRequestId || 'none'}
          </span>
        </div>
        <div className="diagnostic-item">
          <span className="diagnostic-label">Provider:</span>
          <span className="diagnostic-value" data-testid="chat-diagnostic-provider">
            {state.providerId || 'none'}
          </span>
        </div>
        <div className="diagnostic-item">
          <span className="diagnostic-label">State:</span>
          <span className="diagnostic-value" data-testid="chat-diagnostic-status">
            {state.status}
          </span>
        </div>
      </div>

      {/* Messages List */}
      <div className="chat-messages-container" data-testid="chat-messages-list">
        {state.messages.length === 0 ? (
          <div className="chat-empty-state">No conversation turns yet. Type below to begin.</div>
        ) : (
          state.messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-bubble ${msg.role}`}
              data-testid={msg.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'}
            >
              <div className="chat-bubble-header">
                <span className="chat-bubble-role">
                  {msg.role === 'user' ? 'User' : `MAVE (${state.providerId || 'mock'})`}
                </span>
                {msg.status === 'streaming' && (
                  <span className="chat-bubble-badge streaming">streaming...</span>
                )}
                {msg.status === 'cancelled' && (
                  <span className="chat-bubble-badge cancelled">cancelled</span>
                )}
                {msg.status === 'failed' && (
                  <span className="chat-bubble-badge failed">failed</span>
                )}
              </div>
              <div className="chat-bubble-content">{msg.content || (msg.status === 'streaming' ? '...' : '')}</div>
              {msg.error && <div className="chat-bubble-error">{msg.error}</div>}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {state.error && (
        <div className="error-banner" data-testid="chat-error-banner">
          {state.error}
        </div>
      )}

      {/* Load Session Notice */}
      {state.loadSessionNotice && (
        <div className="chat-notice-banner" data-testid="chat-load-notice">
          {state.loadSessionNotice}
        </div>
      )}

      {/* Chat Input & Controls */}
      <div className="chat-input-section">
        <textarea
          data-testid="chat-input-message"
          className="chat-textarea"
          rows={2}
          placeholder="Type message (Enter to send, Shift+Enter for newline)..."
          value={state.draftInput}
          onChange={(e) => dispatch({ type: 'SET_DRAFT', draft: e.target.value })}
          onKeyDown={handleKeyDown}
          disabled={state.isStreaming || !ipcAvailable}
        />
        <div className="chat-action-row">
          <button
            data-testid="chat-btn-send"
            className="btn-send"
            onClick={handleSend}
            disabled={state.isStreaming || !state.draftInput.trim() || !ipcAvailable}
          >
            {state.isStreaming ? 'Streaming...' : 'Send'}
          </button>
          {state.isStreaming && (
            <button
              data-testid="chat-btn-cancel"
              className="btn-cancel"
              onClick={handleCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Load Session Developer Control */}
      <div className="chat-load-section">
        <span className="control-label">Resume / Load Session:</span>
        <div className="chat-load-row">
          <input
            data-testid="chat-input-load-session"
            type="text"
            className="chat-load-input"
            placeholder="Session ID..."
            value={state.loadSessionInput}
            onChange={(e) => dispatch({ type: 'SET_LOAD_INPUT', input: e.target.value })}
            disabled={state.isStreaming || !ipcAvailable}
          />
          <button
            data-testid="chat-btn-load-session"
            className="btn-load-session"
            onClick={handleLoadSession}
            disabled={state.isStreaming || !state.loadSessionInput.trim() || !ipcAvailable}
          >
            Load
          </button>
        </div>
      </div>
    </div>
  );
};

