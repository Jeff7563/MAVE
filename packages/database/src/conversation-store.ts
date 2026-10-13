import { asc, eq } from 'drizzle-orm';
import type {
  ConversationStore,
  ConversationTurn,
  Session
} from '@mave/contracts';
import {
  ConversationTurnSchema,
  SessionSchema
} from '@mave/contracts';
import type { MaveDatabase } from './client.js';
import { conversations, conversationTurns } from './schema.js';

function parseJsonSafe(val: string | null | undefined): Record<string, unknown> | undefined {
  if (!val) return undefined;
  try {
    const parsed = JSON.parse(val);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export class SQLiteConversationStore implements ConversationStore {
  constructor(private readonly maveDb: MaveDatabase) {}

  async createSession(session: Session): Promise<void> {
    const validated = SessionSchema.parse(session);

    const existing = await this.getSession(validated.id);
    if (existing) {
      throw new Error(`Session with id '${validated.id}' already exists`);
    }

    await this.maveDb.db.insert(conversations).values({
      id: validated.id,
      startedAt: new Date(validated.createdAt),
      endedAt: validated.status === 'ended' ? new Date(validated.updatedAt) : null,
      mode: validated.mode,
      summary: validated.title ?? null,
      title: validated.title ?? null,
      status: validated.status,
      activeProviderId: validated.activeProviderId ?? null,
      metadata: validated.metadata ? JSON.stringify(validated.metadata) : null,
      updatedAt: new Date(validated.updatedAt)
    });

    this.maveDb.save();
  }

  async updateSession(session: Session): Promise<void> {
    const validated = SessionSchema.parse(session);

    const existing = await this.getSession(validated.id);
    if (!existing) {
      throw new Error(`Session with id '${validated.id}' not found`);
    }

    await this.maveDb.db
      .update(conversations)
      .set({
        endedAt: validated.status === 'ended' ? new Date(validated.updatedAt) : null,
        mode: validated.mode,
        summary: validated.title ?? null,
        title: validated.title ?? null,
        status: validated.status,
        activeProviderId: validated.activeProviderId ?? null,
        metadata: validated.metadata ? JSON.stringify(validated.metadata) : null,
        updatedAt: new Date(validated.updatedAt)
      })
      .where(eq(conversations.id, validated.id));

    this.maveDb.save();
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    if (!sessionId || !sessionId.trim()) {
      return undefined;
    }
    const [row] = await this.maveDb.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, sessionId.trim()));

    if (!row) {
      return undefined;
    }

    const sessionData: Session = {
      id: row.id,
      createdAt: row.startedAt.getTime(),
      updatedAt: row.updatedAt?.getTime() ?? (row.endedAt?.getTime() ?? row.startedAt.getTime()),
      status: (row.status as Session['status']) ?? (row.endedAt ? 'ended' : 'active'),
      mode: (row.mode as Session['mode']) ?? 'conversation',
      ...(row.activeProviderId ? { activeProviderId: row.activeProviderId } : {}),
      ...(row.title ? { title: row.title } : (row.summary ? { title: row.summary } : {})),
      ...(row.metadata ? { metadata: parseJsonSafe(row.metadata) } : {})
    };

    return SessionSchema.parse(sessionData);
  }

  async listSessions(): Promise<Session[]> {
    const rows = await this.maveDb.db
      .select()
      .from(conversations)
      .orderBy(asc(conversations.startedAt), asc(conversations.id));

    return rows.map((row) => {
      const sessionData: Session = {
        id: row.id,
        createdAt: row.startedAt.getTime(),
        updatedAt: row.updatedAt?.getTime() ?? (row.endedAt?.getTime() ?? row.startedAt.getTime()),
        status: (row.status as Session['status']) ?? (row.endedAt ? 'ended' : 'active'),
        mode: (row.mode as Session['mode']) ?? 'conversation',
        ...(row.activeProviderId ? { activeProviderId: row.activeProviderId } : {}),
        ...(row.title ? { title: row.title } : (row.summary ? { title: row.summary } : {})),
        ...(row.metadata ? { metadata: parseJsonSafe(row.metadata) } : {})
      };
      return SessionSchema.parse(sessionData);
    });
  }

  async createTurn(turn: ConversationTurn): Promise<void> {
    const validated = ConversationTurnSchema.parse(turn);

    const [existing] = await this.maveDb.db
      .select({ id: conversationTurns.id })
      .from(conversationTurns)
      .where(eq(conversationTurns.id, validated.id));

    if (existing) {
      throw new Error(`Turn with id '${validated.id}' already exists`);
    }

    await this.maveDb.db.insert(conversationTurns).values({
      id: validated.id,
      conversationId: validated.sessionId,
      speaker: validated.role,
      text: validated.content,
      createdAt: new Date(validated.createdAt),
      interrupted: validated.status === 'cancelled',
      requestId: validated.requestId,
      providerId: validated.providerId ?? null,
      status: validated.status,
      updatedAt: validated.updatedAt ? new Date(validated.updatedAt) : null,
      error: validated.error ?? null,
      metadata: validated.metadata ? JSON.stringify(validated.metadata) : null
    });

    this.maveDb.save();
  }

  async updateTurn(turn: ConversationTurn): Promise<void> {
    const validated = ConversationTurnSchema.parse(turn);

    const [existing] = await this.maveDb.db
      .select({ id: conversationTurns.id })
      .from(conversationTurns)
      .where(eq(conversationTurns.id, validated.id));

    if (!existing) {
      throw new Error(`Turn with id '${validated.id}' not found`);
    }

    await this.maveDb.db
      .update(conversationTurns)
      .set({
        speaker: validated.role,
        text: validated.content,
        interrupted: validated.status === 'cancelled',
        requestId: validated.requestId,
        providerId: validated.providerId ?? null,
        status: validated.status,
        updatedAt: validated.updatedAt ? new Date(validated.updatedAt) : null,
        error: validated.error ?? null,
        metadata: validated.metadata ? JSON.stringify(validated.metadata) : null
      })
      .where(eq(conversationTurns.id, validated.id));

    this.maveDb.save();
  }

  async getTurns(sessionId: string): Promise<ConversationTurn[]> {
    if (!sessionId || !sessionId.trim()) {
      return [];
    }

    const rows = await this.maveDb.db
      .select()
      .from(conversationTurns)
      .where(eq(conversationTurns.conversationId, sessionId.trim()))
      .orderBy(asc(conversationTurns.createdAt), asc(conversationTurns.id));

    return rows.map((row) => {
      const turnData: ConversationTurn = {
        id: row.id,
        sessionId: row.conversationId,
        requestId: row.requestId ?? '',
        role: row.speaker as ConversationTurn['role'],
        content: row.text,
        status: (row.status as ConversationTurn['status']) ?? (row.interrupted ? 'cancelled' : 'completed'),
        createdAt: row.createdAt.getTime(),
        ...(row.providerId ? { providerId: row.providerId } : {}),
        ...(row.updatedAt ? { updatedAt: row.updatedAt.getTime() } : {}),
        ...(row.error ? { error: row.error } : {}),
        ...(row.metadata ? { metadata: parseJsonSafe(row.metadata) } : {})
      };
      return ConversationTurnSchema.parse(turnData);
    });
  }
}
