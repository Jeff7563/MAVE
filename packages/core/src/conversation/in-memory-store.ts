import type { ConversationStore, ConversationTurn, Session } from '@mave/contracts';
import { ConversationTurnSchema, SessionSchema } from '@mave/contracts';

/**
 * In-memory reference implementation of ConversationStore.
 * Used for fast isolated testing and pure in-memory durability mocking.
 * Distinct from SessionManager (which tracks live runtime state).
 */
export class InMemoryConversationStore implements ConversationStore {
  private readonly sessions = new Map<string, Session>();
  private readonly turns = new Map<string, ConversationTurn[]>();
  private readonly turnSeq = new Map<string, number>();
  private seqCounter = 0;
  public writeCount = 0;

  async createSession(session: Session): Promise<void> {
    const validated = SessionSchema.parse(session);
    if (this.sessions.has(validated.id)) {
      throw new Error(`Session with id '${validated.id}' already exists`);
    }
    this.sessions.set(validated.id, {
      ...validated,
      metadata: validated.metadata ? { ...validated.metadata } : undefined
    });
    this.turns.set(validated.id, []);
    this.writeCount++;
  }

  async updateSession(session: Session): Promise<void> {
    const validated = SessionSchema.parse(session);
    if (!this.sessions.has(validated.id)) {
      throw new Error(`Session with id '${validated.id}' not found`);
    }
    this.sessions.set(validated.id, {
      ...validated,
      metadata: validated.metadata ? { ...validated.metadata } : undefined
    });
    this.writeCount++;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    return session
      ? {
          ...session,
          metadata: session.metadata ? { ...session.metadata } : undefined
        }
      : undefined;
  }

  async listSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).map((s) => ({
      ...s,
      metadata: s.metadata ? { ...s.metadata } : undefined
    }));
  }

  async createTurn(turn: ConversationTurn): Promise<void> {
    const validated = ConversationTurnSchema.parse(turn);
    const sessionTurns = this.turns.get(validated.sessionId) ?? [];
    if (sessionTurns.some((t) => t.id === validated.id)) {
      throw new Error(`Turn with id '${validated.id}' already exists`);
    }
    this.turnSeq.set(validated.id, this.seqCounter++);
    sessionTurns.push({
      ...validated,
      metadata: validated.metadata ? { ...validated.metadata } : undefined
    });
    this.turns.set(validated.sessionId, sessionTurns);
    this.writeCount++;
  }

  async updateTurn(turn: ConversationTurn): Promise<void> {
    const validated = ConversationTurnSchema.parse(turn);
    const sessionTurns = this.turns.get(validated.sessionId);
    if (!sessionTurns) {
      throw new Error(`Turn with id '${validated.id}' not found`);
    }
    const index = sessionTurns.findIndex((t) => t.id === validated.id);
    if (index === -1) {
      throw new Error(`Turn with id '${validated.id}' not found`);
    }
    sessionTurns[index] = {
      ...validated,
      metadata: validated.metadata ? { ...validated.metadata } : undefined
    };
    this.writeCount++;
  }

  async getTurns(sessionId: string): Promise<ConversationTurn[]> {
    const sessionTurns = this.turns.get(sessionId) ?? [];
    return sessionTurns
      .slice()
      .sort((a, b) => {
        if (a.createdAt !== b.createdAt) {
          return a.createdAt - b.createdAt;
        }
        const seqA = this.turnSeq.get(a.id) ?? 0;
        const seqB = this.turnSeq.get(b.id) ?? 0;
        return seqA - seqB;
      })
      .map((t) => ({
        ...t,
        metadata: t.metadata ? { ...t.metadata } : undefined
      }));
  }

  reset(): void {
    this.sessions.clear();
    this.turns.clear();
    this.turnSeq.clear();
    this.seqCounter = 0;
    this.writeCount = 0;
  }
}
