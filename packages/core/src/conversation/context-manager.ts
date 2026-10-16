import type { ConversationTurn, MaveMessage, Session } from '@mave/contracts';
import type { SessionManager } from './session-manager.js';
import {
  ContextManagerError,
  type ContextBundle,
  type ContextManagerOptions
} from './types.js';

export class ContextManager {
  private readonly maxTurns: number;

  constructor(options?: ContextManagerOptions) {
    this.maxTurns = options?.maxTurns !== undefined && options.maxTurns > 0 ? options.maxTurns : 20;
  }

  /**
   * Deterministically evaluates whether a conversation turn is eligible for inclusion in context.
   *
   * Inclusion policy:
   * - Completed user turns are included.
   * - Completed assistant turns are included.
   * - Completed system turns are included.
   *
   * Exclusion policy:
   * - Incomplete streaming fragments (status: 'streaming') are excluded.
   * - Unsent / pending turns (status: 'pending') are excluded.
   * - Failed turns (status: 'failed') are excluded.
   * - Cancelled turns (status: 'cancelled') are excluded.
   */
  private isEligibleTurn(turn: ConversationTurn): boolean {
    if (!turn || typeof turn.content !== 'string') {
      return false;
    }
    // Only completed turns are included in the conversation context
    return turn.status === 'completed';
  }

  /**
   * Builds a structured context bundle from a session and its turns.
   *
   * Ensures:
   * 1. Chronological order is preserved.
   * 2. Window is capped to maxTurns (oldest turns dropped first).
   * 3. Failed, cancelled, and incomplete turns are excluded.
   * 4. Source data is never mutated.
   * 5. Wake/mic/hardware/telemetry/memory records never enter context.
   */
  build(session: Session, turns: ConversationTurn[]): ContextBundle {
    if (!session || typeof session.id !== 'string') {
      throw new ContextManagerError('invalid_context_input', 'Invalid session provided to ContextManager');
    }
    if (!Array.isArray(turns)) {
      throw new ContextManagerError('invalid_context_input', 'Turns must be an array');
    }

    // Filter to only eligible turns
    const eligibleTurns = turns.filter(turn => this.isEligibleTurn(turn));

    // Apply sliding window: retain the most recent N turns in chronological order
    const windowedTurns =
      eligibleTurns.length > this.maxTurns
        ? eligibleTurns.slice(-this.maxTurns)
        : eligibleTurns;

    // Map canonical ConversationTurn -> MaveMessage
    const messages: MaveMessage[] = windowedTurns.map(turn => ({
      role: turn.role,
      content: turn.content
    }));

    // Construct minimal safe context metadata
    const context: Record<string, unknown> = {
      sessionId: session.id,
      mode: session.mode,
      ...(session.metadata ? { sessionMetadata: { ...session.metadata } } : {})
    };

    if (session.activeProviderId) {
      context.activeProviderId = session.activeProviderId;
    }

    return {
      sessionId: session.id,
      mode: session.mode,
      activeProviderId: session.activeProviderId,
      messages,
      context,
      turnCount: messages.length
    };
  }

  /**
   * Convenience method to extract session and turns from SessionManager and build context.
   */
  buildForSession(sessionManager: SessionManager, sessionId: string): ContextBundle {
    if (!sessionManager || typeof sessionManager.requireSession !== 'function') {
      throw new ContextManagerError('invalid_context_input', 'Invalid SessionManager reference');
    }
    if (!sessionId || typeof sessionId !== 'string') {
      throw new ContextManagerError('session_not_found', 'Session ID is required');
    }

    const session = sessionManager.requireSession(sessionId);
    const turns = sessionManager.getTurns(sessionId);

    return this.build(session, turns);
  }
}
