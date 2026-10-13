import type {
  ConversationMode,
  ConversationRole,
  ConversationTurnStatus,
  MaveMessage
} from '@mave/contracts';

export type SessionErrorCode =
  | 'session_not_found'
  | 'session_already_exists'
  | 'session_ended'
  | 'duplicate_turn'
  | 'turn_not_found'
  | 'invalid_session'
  | 'invalid_turn';

export class SessionManagerError extends Error {
  readonly code: SessionErrorCode;
  readonly sessionId?: string;
  readonly turnId?: string;

  constructor(
    code: SessionErrorCode,
    message: string,
    details?: { sessionId?: string; turnId?: string }
  ) {
    super(message);
    this.name = 'SessionManagerError';
    this.code = code;
    this.sessionId = details?.sessionId;
    this.turnId = details?.turnId;
  }
}

export type ContextErrorCode = 'session_not_found' | 'invalid_context_input';

export class ContextManagerError extends Error {
  readonly code: ContextErrorCode;

  constructor(code: ContextErrorCode, message: string) {
    super(message);
    this.name = 'ContextManagerError';
    this.code = code;
  }
}

export interface CreateSessionOptions {
  id?: string;
  mode?: ConversationMode;
  activeProviderId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface AppendTurnOptions {
  id?: string;
  sessionId?: string;
  requestId: string;
  role: ConversationRole;
  content: string;
  providerId?: string;
  status?: ConversationTurnStatus;
  createdAt?: number;
  metadata?: Record<string, unknown>;
}

export interface SessionManagerOptions {
  sessionIdFactory?: () => string;
  turnIdFactory?: () => string;
  clock?: () => number;
}

export interface ContextManagerOptions {
  /** Maximum number of recent conversation turns to retain in context window. Defaults to 20. */
  maxTurns?: number;
}

export interface ContextBundle {
  sessionId: string;
  mode: ConversationMode;
  activeProviderId?: string;
  messages: MaveMessage[];
  context: Record<string, unknown>;
  turnCount: number;
}
