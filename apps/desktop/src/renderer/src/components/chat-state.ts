import type { ConversationRuntimeEvent } from '@mave/contracts';

export interface ChatMessage {
  id: string;
  requestId: string;
  turnId?: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'streaming' | 'completed' | 'cancelled' | 'failed';
  error?: string;
}

export type ChatStatus = 'idle' | 'sending' | 'streaming' | 'completed' | 'cancelled' | 'failed';

export interface ChatState {
  messages: ChatMessage[];
  draftInput: string;
  sessionId?: string;
  activeRequestId?: string;
  providerId?: string;
  status: ChatStatus;
  error?: string;
  isStreaming: boolean;
  loadSessionInput: string;
  loadSessionNotice?: string;
}

export const initialChatState: ChatState = {
  messages: [],
  draftInput: '',
  sessionId: undefined,
  activeRequestId: undefined,
  providerId: undefined,
  status: 'idle',
  error: undefined,
  isStreaming: false,
  loadSessionInput: '',
  loadSessionNotice: undefined
};

export type ChatAction =
  | { type: 'SET_DRAFT'; draft: string }
  | { type: 'SET_LOAD_INPUT'; input: string }
  | { type: 'SEND_INITIATED'; text: string; requestId?: string }
  | { type: 'SEND_ACCEPTED'; requestId: string }
  | { type: 'SEND_REJECTED'; error: string; requestId?: string }
  | { type: 'CANCEL_CLICKED' }
  | { type: 'LOAD_SESSION_SUCCESS'; sessionId: string }
  | { type: 'LOAD_SESSION_ERROR'; error: string }
  | { type: 'RUNTIME_EVENT'; event: ConversationRuntimeEvent };

export function validateSendInput(text: string): { valid: boolean; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { valid: false, error: 'Message cannot be empty or whitespace only' };
  }
  return { valid: true };
}

export function shouldSubmitOnKeyDown(e: { key: string; shiftKey: boolean }): boolean {
  return e.key === 'Enter' && !e.shiftKey;
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_DRAFT':
      return { ...state, draftInput: action.draft };

    case 'SET_LOAD_INPUT':
      return { ...state, loadSessionInput: action.input };

    case 'SEND_INITIATED': {
      const validation = validateSendInput(action.text);
      if (!validation.valid) {
        return { ...state, error: validation.error };
      }

      const assignedRequestId = action.requestId || '';

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        requestId: assignedRequestId,
        role: 'user',
        content: action.text.trim(),
        status: 'completed'
      };

      return {
        ...state,
        messages: [...state.messages, userMessage],
        activeRequestId: assignedRequestId || state.activeRequestId,
        draftInput: '',
        status: 'sending',
        isStreaming: true,
        error: undefined
      };
    }

    case 'SEND_ACCEPTED': {
      // Associate activeRequestId with the last user message if empty
      const updatedMessages = [...state.messages];
      if (updatedMessages.length > 0) {
        const lastMsg = updatedMessages[updatedMessages.length - 1];
        if (lastMsg && lastMsg.role === 'user' && !lastMsg.requestId) {
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMsg,
            requestId: action.requestId
          };
        }
      }

      return {
        ...state,
        activeRequestId: action.requestId,
        messages: updatedMessages,
        status: 'sending'
      };
    }

    case 'SEND_REJECTED': {
      const updatedMessages = [...state.messages];
      if (action.requestId && updatedMessages.length > 0) {
        const lastMsg = updatedMessages[updatedMessages.length - 1];
        if (lastMsg && lastMsg.role === 'user' && lastMsg.requestId === action.requestId) {
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMsg,
            status: 'failed',
            error: action.error
          };
        }
      }

      return {
        ...state,
        activeRequestId: undefined,
        messages: updatedMessages,
        status: 'failed',
        isStreaming: false,
        error: action.error
      };
    }

    case 'CANCEL_CLICKED':
      return {
        ...state,
        status: 'cancelling' as ChatStatus // UI feedback while cancellation is processing
      };

    case 'LOAD_SESSION_SUCCESS':
      return {
        ...state,
        sessionId: action.sessionId,
        loadSessionInput: '',
        loadSessionNotice: `Session '${action.sessionId}' loaded. Note: prior conversation history browsing is not yet available in Phase 7.`,
        error: undefined
      };

    case 'LOAD_SESSION_ERROR':
      return {
        ...state,
        error: action.error,
        loadSessionNotice: undefined
      };

    case 'RUNTIME_EVENT': {
      const evt = action.event;

      // Ignore events for unrelated request IDs if we have an activeRequestId
      if (state.activeRequestId && evt.requestId !== state.activeRequestId) {
        return state;
      }

      switch (evt.type) {
        case 'request_started':
          return {
            ...state,
            activeRequestId: evt.requestId,
            status: 'sending'
          };

        case 'session_ready':
          return {
            ...state,
            sessionId: evt.sessionId
          };

        case 'provider_selected':
          return {
            ...state,
            providerId: evt.providerId
          };

        case 'response_started': {
          // Guard against duplicate response_started for the same request
          const existingPlaceholder = state.messages.find(
            (m) => m.requestId === evt.requestId && m.role === 'assistant'
          );
          if (existingPlaceholder) {
            return {
              ...state,
              status: 'streaming',
              isStreaming: true
            };
          }

          const placeholder: ChatMessage = {
            id: `assistant-${evt.turnId}`,
            requestId: evt.requestId,
            turnId: evt.turnId,
            role: 'assistant',
            content: '',
            status: 'streaming'
          };

          return {
            ...state,
            messages: [...state.messages, placeholder],
            status: 'streaming',
            isStreaming: true
          };
        }

        case 'response_delta': {
          const hasAssistant = state.messages.some(
            (m) => m.requestId === evt.requestId && m.role === 'assistant'
          );

          let updatedMessages = state.messages;
          if (!hasAssistant) {
            const placeholder: ChatMessage = {
              id: `assistant-${evt.turnId}`,
              requestId: evt.requestId,
              turnId: evt.turnId,
              role: 'assistant',
              content: evt.text,
              status: 'streaming'
            };
            updatedMessages = [...state.messages, placeholder];
          } else {
            updatedMessages = state.messages.map((m) => {
              if (m.requestId === evt.requestId && m.role === 'assistant') {
                return {
                  ...m,
                  content: m.content + evt.text,
                  status: 'streaming'
                };
              }
              return m;
            });
          }

          return {
            ...state,
            messages: updatedMessages,
            status: 'streaming',
            isStreaming: true
          };
        }

        case 'response_completed': {
          const hasAssistant = state.messages.some(
            (m) => m.requestId === evt.requestId && m.role === 'assistant'
          );

          let updatedMessages = state.messages;
          if (!hasAssistant) {
            const placeholder: ChatMessage = {
              id: `assistant-${evt.turnId}`,
              requestId: evt.requestId,
              turnId: evt.turnId,
              role: 'assistant',
              content: evt.text,
              status: 'completed'
            };
            updatedMessages = [...state.messages, placeholder];
          } else {
            updatedMessages = state.messages.map((m) => {
              if (m.requestId === evt.requestId && m.role === 'assistant') {
                return {
                  ...m,
                  content: evt.text || m.content,
                  status: 'completed'
                };
              }
              return m;
            });
          }

          return {
            ...state,
            messages: updatedMessages,
            status: 'completed',
            isStreaming: false,
            activeRequestId: undefined
          };
        }

        case 'request_cancelled': {
          const hasAssistant = state.messages.some(
            (m) => m.requestId === evt.requestId && m.role === 'assistant'
          );

          let updatedMessages = state.messages;
          if (!hasAssistant) {
            const placeholder: ChatMessage = {
              id: `assistant-${evt.turnId ?? 'cancelled'}`,
              requestId: evt.requestId,
              turnId: evt.turnId,
              role: 'assistant',
              content: '',
              status: 'cancelled'
            };
            updatedMessages = [...state.messages, placeholder];
          } else {
            updatedMessages = state.messages.map((m) => {
              if (m.requestId === evt.requestId && m.role === 'assistant') {
                return {
                  ...m,
                  status: 'cancelled'
                };
              }
              return m;
            });
          }

          return {
            ...state,
            messages: updatedMessages,
            status: 'cancelled',
            isStreaming: false,
            activeRequestId: undefined
          };
        }

        case 'request_failed': {
          const errorMsg = `${evt.error.code}: ${evt.error.message}`;
          const hasAssistant = state.messages.some(
            (m) => m.requestId === evt.requestId && m.role === 'assistant'
          );

          let updatedMessages = state.messages;
          if (!hasAssistant) {
            const placeholder: ChatMessage = {
              id: `assistant-${evt.turnId ?? 'failed'}`,
              requestId: evt.requestId,
              turnId: evt.turnId,
              role: 'assistant',
              content: '',
              status: 'failed',
              error: errorMsg
            };
            updatedMessages = [...state.messages, placeholder];
          } else {
            updatedMessages = state.messages.map((m) => {
              if (m.requestId === evt.requestId && m.role === 'assistant') {
                return {
                  ...m,
                  status: 'failed',
                  error: errorMsg
                };
              }
              return m;
            });
          }

          return {
            ...state,
            messages: updatedMessages,
            status: 'failed',
            isStreaming: false,
            error: errorMsg,
            activeRequestId: undefined
          };
        }

        default:
          return state;
      }
    }

    default:
      return state;
  }
}

