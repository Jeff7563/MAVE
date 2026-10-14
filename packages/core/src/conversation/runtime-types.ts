import type {
  BrainCapabilities,
  BrainProfileId,
  BrainRouteOverrides
} from '@mave/contracts';
import type { TaskContext, TaskIntent } from '../brain/task-policy.js';
import type { RuntimeSelectionMode } from '../brain/runtime-policy.js';
import type { ModelRole, RuntimeModelSelectionMode } from '../brain/runtime-models/types.js';

export interface ConversationRequest {
  requestId?: string;
  sessionId?: string;
  message: string;
  preferredProviderId?: string;
  preferredModelId?: string;
  profileId?: BrainProfileId;
  taskIntent?: TaskIntent | string;
  modelRole?: ModelRole;
  taskContext?: TaskContext;
  runtimeMode?: RuntimeSelectionMode;
  modelMode?: RuntimeModelSelectionMode;
  preferredRuntimeId?: string;
  lockedRuntimeId?: string;
  lockedModelId?: string;
  requiredCapabilities?: Partial<BrainCapabilities>;
  overrides?: BrainRouteOverrides;
  fallbackChain?: string[];
  localOnly?: boolean;
  context?: Record<string, unknown>;
  allowFallback?: boolean;
}

export interface ConversationRequestOptions {
  signal?: AbortSignal;
  /** Whether to throw a ConversationRuntimeError on stream failure in addition to yielding request_failed. Defaults to false. */
  throwOnError?: boolean;
  /** Request timeout in milliseconds. If specified, overrides defaultTimeoutMs. Must be > 0. */
  timeoutMs?: number;
}

export type {
  RequestStartedEvent,
  SessionReadyEvent,
  ProviderSelectedEvent,
  ResponseStartedEvent,
  ResponseDeltaEvent,
  ResponseCompletedEvent,
  RequestCancelledEvent,
  RequestFailedEvent,
  ConversationRuntimeEvent
} from '@mave/contracts';

export type ConversationRuntimeErrorCode =
  | 'invalid_request'
  | 'session_not_found'
  | 'session_ended'
  | 'session_busy'
  | 'duplicate_request'
  | 'routing_error'
  | 'provider_error'
  | 'provider_timeout'
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
