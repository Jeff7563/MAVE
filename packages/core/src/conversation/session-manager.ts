import { randomUUID } from 'node:crypto';
import type { ConversationTurn, ConversationTurnStatus, Session } from '@mave/contracts';
import { ConversationTurnSchema, SessionSchema } from '@mave/contracts';
import {
  SessionManagerError,
  type AppendTurnOptions,
  type CreateSessionOptions,
  type SessionManagerOptions
} from './types.js';

export class SessionManager {
  private readonly sessions = new Map<string, Session>();
  private readonly sessionTurns = new Map<string, ConversationTurn[]>();
  private readonly registeredTurnIds = new Set<string>();

  private readonly sessionIdFactory: () => string;
  private readonly turnIdFactory: () => string;
  private readonly clock: () => number;

  constructor(options?: SessionManagerOptions) {
    this.sessionIdFactory = options?.sessionIdFactory ?? (() => randomUUID());
    this.turnIdFactory = options?.turnIdFactory ?? (() => randomUUID());
    this.clock = options?.clock ?? (() => Date.now());
  }

  /**
   * Produces a defensive, detached copy of a session record.
   */
  private cloneSession(session: Session): Session {
    return {
      ...session,
      metadata: session.metadata ? { ...session.metadata } : undefined
    };
  }

  /**
   * Produces a defensive, detached copy of a conversation turn record.
   */
  private cloneTurn(turn: ConversationTurn): ConversationTurn {
    return {
      ...turn,
      metadata: turn.metadata ? { ...turn.metadata } : undefined
    };
  }

  /**
   * Creates a new conversation session.
   * Throws SessionManagerError if session id is already taken.
   */
  createSession(options?: CreateSessionOptions): Session {
    const rawId = options?.id?.trim();
    const id = rawId && rawId.length > 0 ? rawId : this.sessionIdFactory();

    if (!id || !id.trim()) {
      throw new SessionManagerError('invalid_session', 'Session ID cannot be empty');
    }

    const trimmedId = id.trim();
    if (this.sessions.has(trimmedId)) {
      throw new SessionManagerError(
        'session_already_exists',
        `Session with id '${trimmedId}' already exists`,
        { sessionId: trimmedId }
      );
    }

    const now = this.clock();
    const sessionData: Session = {
      id: trimmedId,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      mode: options?.mode ?? 'conversation',
      activeProviderId: options?.activeProviderId?.trim() || undefined,
      title: options?.title?.trim() || undefined,
      metadata: options?.metadata ? { ...options.metadata } : undefined
    };

    // Validate against canonical contract schema
    const session = SessionSchema.parse(sessionData);

    this.sessions.set(trimmedId, session);
    this.sessionTurns.set(trimmedId, []);

    return this.cloneSession(session);
  }

  /**
   * Retrieves a session by ID, or undefined if not found.
   */
  getSession(sessionId: string): Session | undefined {
    if (!sessionId || typeof sessionId !== 'string') {
      return undefined;
    }
    const session = this.sessions.get(sessionId.trim());
    return session ? this.cloneSession(session) : undefined;
  }

  /**
   * Retrieves a session by ID, throwing SessionManagerError if not found.
   */
  requireSession(sessionId: string): Session {
    const session = this.getSession(sessionId);
    if (!session) {
      const trimmed = sessionId ? sessionId.trim() : '';
      throw new SessionManagerError(
        'session_not_found',
        `Session '${trimmed}' not found`,
        { sessionId: trimmed }
      );
    }
    return session;
  }

  /**
   * Checks whether a session exists.
   */
  hasSession(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }
    return this.sessions.has(sessionId.trim());
  }

  /**
   * Lists all sessions in deterministic insertion order.
   */
  listSessions(): Session[] {
    return Array.from(this.sessions.values()).map(s => this.cloneSession(s));
  }

  /**
   * Ends a session by setting status to 'ended'.
   * Idempotent: ending an already ended session returns the session cleanly.
   */
  endSession(sessionId: string): Session {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new SessionManagerError('session_not_found', 'Invalid session ID');
    }
    const trimmedId = sessionId.trim();
    const session = this.sessions.get(trimmedId);
    if (!session) {
      throw new SessionManagerError(
        'session_not_found',
        `Session '${trimmedId}' not found`,
        { sessionId: trimmedId }
      );
    }

    if (session.status === 'ended') {
      return this.cloneSession(session);
    }

    session.status = 'ended';
    session.updatedAt = this.clock();

    return this.cloneSession(session);
  }

  /**
   * Updates the active provider ID for an active session.
   */
  updateActiveProviderId(sessionId: string, providerId: string | undefined): Session {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new SessionManagerError('session_not_found', 'Invalid session ID');
    }
    const trimmedId = sessionId.trim();
    const session = this.sessions.get(trimmedId);
    if (!session) {
      throw new SessionManagerError(
        'session_not_found',
        `Session '${trimmedId}' not found`,
        { sessionId: trimmedId }
      );
    }

    if (session.status === 'ended') {
      throw new SessionManagerError(
        'session_ended',
        `Cannot update provider on ended session '${trimmedId}'`,
        { sessionId: trimmedId }
      );
    }

    session.activeProviderId = providerId?.trim() || undefined;
    session.updatedAt = this.clock();

    return this.cloneSession(session);
  }

  /**
   * Merges metadata into an active session's metadata record.
   */
  updateSessionMetadata(sessionId: string, metadata: Record<string, unknown>): Session {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new SessionManagerError('session_not_found', 'Invalid session ID');
    }
    const trimmedId = sessionId.trim();
    const session = this.sessions.get(trimmedId);
    if (!session) {
      throw new SessionManagerError(
        'session_not_found',
        `Session '${trimmedId}' not found`,
        { sessionId: trimmedId }
      );
    }

    if (session.status === 'ended') {
      throw new SessionManagerError(
        'session_ended',
        `Cannot update metadata on ended session '${trimmedId}'`,
        { sessionId: trimmedId }
      );
    }

    session.metadata = {
      ...session.metadata,
      ...metadata
    };
    session.updatedAt = this.clock();

    return this.cloneSession(session);
  }

  /**
   * Appends a conversation turn to an active session.
   */
  appendTurn(
    sessionIdOrTurn: string | AppendTurnOptions,
    turnInput?: AppendTurnOptions
  ): ConversationTurn {
    let targetSessionId: string;
    let options: AppendTurnOptions;

    if (typeof sessionIdOrTurn === 'string') {
      targetSessionId = sessionIdOrTurn.trim();
      if (!turnInput) {
        throw new SessionManagerError('invalid_turn', 'Missing turn input options', {
          sessionId: targetSessionId
        });
      }
      options = turnInput;
    } else {
      if (!sessionIdOrTurn.sessionId) {
        throw new SessionManagerError('invalid_session', 'Missing sessionId in turn options');
      }
      targetSessionId = sessionIdOrTurn.sessionId.trim();
      options = sessionIdOrTurn;
    }

    if (!targetSessionId) {
      throw new SessionManagerError('invalid_session', 'Session ID cannot be empty');
    }

    const session = this.sessions.get(targetSessionId);
    if (!session) {
      throw new SessionManagerError(
        'session_not_found',
        `Session '${targetSessionId}' not found`,
        { sessionId: targetSessionId }
      );
    }

    if (session.status === 'ended') {
      throw new SessionManagerError(
        'session_ended',
        `Cannot append turn to ended session '${targetSessionId}'`,
        { sessionId: targetSessionId }
      );
    }

    if (options.sessionId && options.sessionId.trim() !== targetSessionId) {
      throw new SessionManagerError(
        'invalid_turn',
        `Session ID mismatch: options specified '${options.sessionId.trim()}', but target is '${targetSessionId}'`,
        { sessionId: targetSessionId }
      );
    }

    const rawTurnId = options.id?.trim();
    const turnId = rawTurnId && rawTurnId.length > 0 ? rawTurnId : this.turnIdFactory();

    if (!turnId || !turnId.trim()) {
      throw new SessionManagerError('invalid_turn', 'Turn ID cannot be empty', {
        sessionId: targetSessionId
      });
    }

    const trimmedTurnId = turnId.trim();
    if (this.registeredTurnIds.has(trimmedTurnId)) {
      throw new SessionManagerError(
        'duplicate_turn',
        `Turn with id '${trimmedTurnId}' already exists`,
        { sessionId: targetSessionId, turnId: trimmedTurnId }
      );
    }

    if (!options.requestId || !options.requestId.trim()) {
      throw new SessionManagerError('invalid_turn', 'Turn requestId cannot be empty', {
        sessionId: targetSessionId
      });
    }

    if (!options.role) {
      throw new SessionManagerError('invalid_turn', 'Turn role is required', {
        sessionId: targetSessionId
      });
    }

    if (typeof options.content !== 'string') {
      throw new SessionManagerError('invalid_turn', 'Turn content must be a string', {
        sessionId: targetSessionId
      });
    }

    const now = this.clock();
    const turnData: ConversationTurn = {
      id: trimmedTurnId,
      sessionId: targetSessionId,
      requestId: options.requestId.trim(),
      role: options.role,
      content: options.content,
      providerId: options.providerId?.trim() || session.activeProviderId,
      status: options.status ?? 'completed',
      createdAt: options.createdAt ?? now,
      updatedAt: now,
      metadata: options.metadata ? { ...options.metadata } : undefined
    };

    // Validate turn against canonical contract schema
    const turn = ConversationTurnSchema.parse(turnData);

    const turns = this.sessionTurns.get(targetSessionId) ?? [];
    turns.push(turn);
    this.sessionTurns.set(targetSessionId, turns);
    this.registeredTurnIds.add(trimmedTurnId);

    session.updatedAt = now;

    return this.cloneTurn(turn);
  }

  /**
   * Updates turn status and error message on an active session.
   */
  updateTurnStatus(
    sessionId: string,
    turnId: string,
    status: ConversationTurnStatus,
    error?: string
  ): ConversationTurn {
    if (!sessionId || !turnId) {
      throw new SessionManagerError('invalid_turn', 'Session ID and turn ID are required');
    }
    const trimmedSessionId = sessionId.trim();
    const trimmedTurnId = turnId.trim();

    const session = this.sessions.get(trimmedSessionId);
    if (!session) {
      throw new SessionManagerError(
        'session_not_found',
        `Session '${trimmedSessionId}' not found`,
        { sessionId: trimmedSessionId }
      );
    }

    const turns = this.sessionTurns.get(trimmedSessionId);
    const turn = turns?.find(t => t.id === trimmedTurnId);
    if (!turn) {
      throw new SessionManagerError(
        'turn_not_found',
        `Turn '${trimmedTurnId}' not found in session '${trimmedSessionId}'`,
        { sessionId: trimmedSessionId, turnId: trimmedTurnId }
      );
    }

    return this.updateTurn(sessionId, turnId, { status, error });
  }

  /**
   * Updates turn status, content, and/or error message on an active session.
   */
  updateTurn(
    sessionId: string,
    turnId: string,
    updates: {
      status?: ConversationTurnStatus;
      content?: string;
      error?: string;
    }
  ): ConversationTurn {
    if (!sessionId || !turnId) {
      throw new SessionManagerError('invalid_turn', 'Session ID and turn ID are required');
    }
    const trimmedSessionId = sessionId.trim();
    const trimmedTurnId = turnId.trim();

    const session = this.sessions.get(trimmedSessionId);
    if (!session) {
      throw new SessionManagerError(
        'session_not_found',
        `Session '${trimmedSessionId}' not found`,
        { sessionId: trimmedSessionId }
      );
    }

    const turns = this.sessionTurns.get(trimmedSessionId);
    const turn = turns?.find(t => t.id === trimmedTurnId);
    if (!turn) {
      throw new SessionManagerError(
        'turn_not_found',
        `Turn '${trimmedTurnId}' not found in session '${trimmedSessionId}'`,
        { sessionId: trimmedSessionId, turnId: trimmedTurnId }
      );
    }

    const now = this.clock();
    if (updates.status !== undefined) {
      turn.status = updates.status;
    }
    if (updates.content !== undefined) {
      turn.content = updates.content;
    }
    if (updates.error !== undefined) {
      turn.error = updates.error;
    }
    turn.updatedAt = now;

    session.updatedAt = now;

    return this.cloneTurn(turn);
  }

  /**
   * Retrieves all conversation turns for a session in chronological order.
   */
  getTurns(sessionId: string): ConversationTurn[] {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new SessionManagerError('session_not_found', 'Invalid session ID');
    }
    const trimmedId = sessionId.trim();
    if (!this.sessions.has(trimmedId)) {
      throw new SessionManagerError(
        'session_not_found',
        `Session '${trimmedId}' not found`,
        { sessionId: trimmedId }
      );
    }

    const turns = this.sessionTurns.get(trimmedId) ?? [];
    return turns.map(t => this.cloneTurn(t));
  }

  /**
   * Retrieves the most recent N conversation turns for a session in chronological order.
   */
  getRecentTurns(sessionId: string, count: number): ConversationTurn[] {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new SessionManagerError('session_not_found', 'Invalid session ID');
    }
    const trimmedId = sessionId.trim();
    if (!this.sessions.has(trimmedId)) {
      throw new SessionManagerError(
        'session_not_found',
        `Session '${trimmedId}' not found`,
        { sessionId: trimmedId }
      );
    }

    if (count <= 0) {
      return [];
    }

    const turns = this.sessionTurns.get(trimmedId) ?? [];
    return turns.slice(-count).map(t => this.cloneTurn(t));
  }

  /**
   * Hydrates an existing persisted session and its turns into the SessionManager.
   *
   * Enforces:
   * 1. Validates session against canonical SessionSchema.
   * 2. Rejects if session already exists in memory.
   * 3. Validates each turn against canonical ConversationTurnSchema and session ID linkage.
   * 4. Rejects duplicate turn IDs (either existing in memory or within the input array).
   * 5. Preserves canonical IDs (does not generate new ones).
   * 6. Preserves timestamps and input ordering.
   * 7. Non-terminal turn recovery: any assistant turn with status 'pending' or 'streaming'
   *    from a prior terminated process is normalized to 'failed' (interrupted).
   * 8. Does not expose internal collections.
   */
  hydrateSession(session: Session, turns: ConversationTurn[]): Session {
    if (!session || typeof session !== 'object') {
      throw new SessionManagerError('invalid_session', 'Invalid session provided for hydration');
    }

    const validatedSession = SessionSchema.parse(session);
    const trimmedSessionId = validatedSession.id.trim();

    if (this.sessions.has(trimmedSessionId)) {
      throw new SessionManagerError(
        'session_already_exists',
        `Session with id '${trimmedSessionId}' is already loaded in SessionManager`,
        { sessionId: trimmedSessionId }
      );
    }

    if (!Array.isArray(turns)) {
      throw new SessionManagerError('invalid_turn', 'Turns must be an array', {
        sessionId: trimmedSessionId
      });
    }

    // Pre-validate all turns before mutating any internal state
    const hydratedTurns: ConversationTurn[] = [];
    const localTurnIds = new Set<string>();

    for (const rawTurn of turns) {
      if (!rawTurn || typeof rawTurn !== 'object') {
        throw new SessionManagerError('invalid_turn', 'Invalid turn provided in hydration array', {
          sessionId: trimmedSessionId
        });
      }

      const turn = ConversationTurnSchema.parse(rawTurn);
      const trimmedTurnId = turn.id.trim();

      if (turn.sessionId.trim() !== trimmedSessionId) {
        throw new SessionManagerError(
          'invalid_turn',
          `Turn '${trimmedTurnId}' belongs to session '${turn.sessionId}', expected '${trimmedSessionId}'`,
          { sessionId: trimmedSessionId, turnId: trimmedTurnId }
        );
      }

      if (this.registeredTurnIds.has(trimmedTurnId) || localTurnIds.has(trimmedTurnId)) {
        throw new SessionManagerError(
          'duplicate_turn',
          `Turn with id '${trimmedTurnId}' already exists or is duplicated in hydration input`,
          { sessionId: trimmedSessionId, turnId: trimmedTurnId }
        );
      }

      localTurnIds.add(trimmedTurnId);

      // Recovery policy for non-terminal turns from prior crashed/terminated process:
      // Normalize 'pending' or 'streaming' assistant turns to 'failed' (interrupted)
      let finalStatus = turn.status;
      let finalError = turn.error;
      if (turn.role === 'assistant' && (turn.status === 'pending' || turn.status === 'streaming')) {
        finalStatus = 'failed';
        finalError = finalError ?? 'Turn interrupted before completion';
      }

      hydratedTurns.push({
        ...turn,
        status: finalStatus,
        error: finalError,
        metadata: turn.metadata ? { ...turn.metadata } : undefined
      });
    }

    // Commit hydrated state
    this.sessions.set(trimmedSessionId, this.cloneSession(validatedSession));
    this.sessionTurns.set(trimmedSessionId, hydratedTurns);
    for (const turnId of localTurnIds) {
      this.registeredTurnIds.add(turnId);
    }

    return this.cloneSession(validatedSession);
  }
}

