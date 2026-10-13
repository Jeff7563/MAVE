import type { BrainCapabilities, BrainUsage } from '@mave/contracts';

export interface ConversationRequest {
  requestId?: string;
  sessionId?: string;
  message: string;
  preferredProviderId?: string;
  requiredCapabilities?: Partial<BrainCapabilities>;
}

export interface ConversationRequestOptions {
  signal?: AbortSignal;
  /** Whether to throw a ConversationRuntimeError on stream failure in addition to yielding request_failed. Defaults to false. */
  throwOnError?: boolean;
}

export interface RequestStartedEvent {
  type: 'request_started';
  requestId: string;
  sessionId?: string;
  timestamp: number;
}

export interface SessionReadyEvent {
  type: 'session_ready';
  requestId: string;
  sessionId: string;
  timestamp: number;
}

export interface ProviderSelectedEvent {
  type: 'provider_selected';
  requestId: string;
  sessionId: string;
  providerId: string;
  fallbackUsed: boolean;
  reason: string;
  timestamp: number;
}

export interface ResponseStartedEvent {
  type: 'response_started';
  requestId: string;
  sessionId: string;
  turnId: string;
  providerId: string;
  timestamp: number;
}

export interface ResponseDeltaEvent {
  type: 'response_delta';
  requestId: string;
  sessionId: string;
  turnId: string;
  text: string;
  timestamp: number;
}

export interface ResponseCompletedEvent {
  type: 'response_completed';
  requestId: string;
  sessionId: string;
  turnId: string;
  text: string;
  finishReason?: string;
  usage?: BrainUsage;
  timestamp: number;
}

export interface RequestCancelledEvent {
  type: 'request_cancelled';
  requestId: string;
  sessionId: string;
  turnId?: string;
  reason?: string;
  timestamp: number;
}

export interface RequestFailedEvent {
  type: 'request_failed';
  requestId: string;
  sessionId?: string;
  turnId?: string;
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: unknown;
  };
  timestamp: number;
}

export type ConversationRuntimeEvent =
  | RequestStartedEvent
  | SessionReadyEvent
  | ProviderSelectedEvent
  | ResponseStartedEvent
  | ResponseDeltaEvent
  | ResponseCompletedEvent
  | RequestCancelledEvent
  | RequestFailedEvent;

export type ConversationRuntimeErrorCode =
  | 'invalid_request'
  | 'session_not_found'
  | 'session_ended'
  | 'session_busy'
  | 'duplicate_request'
  | 'routing_error'
  | 'provider_error'
  | 'persistence_error';

export class ConversationRuntimeError extends Error {
  readonly code: ConversationRuntimeErrorCode;
  readonly requestId?: string;
  readonly sessionId?: string;

  constructor(
    code: ConversationRuntimeErrorCode,
    message: string,
    details?: { requestId?: string; sessionId?: string }
  ) {
    super(message);
    this.name = 'ConversationRuntimeError';
    this.code = code;
    this.requestId = details?.requestId;
    this.sessionId = details?.sessionId;
  }
}
