import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMaveDatabase,
  settings,
  conversations,
  conversationTurns,
  vocabulary,
  type MaveDatabase
} from '../index.js';
import { eq } from 'drizzle-orm';

describe('MAVE Database', () => {
  let maveDb: MaveDatabase;

  beforeEach(async () => {
    maveDb = await createMaveDatabase(':memory:');
  });

  afterEach(() => {
    maveDb.close();
  });

  it('initializes all tables in memory successfully', () => {
    const res = maveDb.sqlite.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    const tableNames = res[0]?.values.map((row) => row[0] as string) ?? [];

    expect(tableNames).toContain('settings');
    expect(tableNames).toContain('conversations');
    expect(tableNames).toContain('conversation_turns');
    expect(tableNames).toContain('vocabulary');
    expect(tableNames).toContain('mistakes');
    expect(tableNames).toContain('learning_events');
    expect(tableNames).toContain('daily_stats');
  });

  it('can insert and retrieve settings', async () => {
    const now = new Date();
    await maveDb.db.insert(settings).values({
      key: 'wake.sensitivity',
      value: '0.6',
      updatedAt: now
    });

    const result = await maveDb.db
      .select()
      .from(settings)
      .where(eq(settings.key, 'wake.sensitivity'));

    expect(result.length).toBe(1);
    expect(result[0]?.value).toBe('0.6');
  });

  it('supports conversations and conversation turns with relational integrity', async () => {
    const now = new Date();
    const convId = 'conv-123';

    await maveDb.db.insert(conversations).values({
      id: convId,
      startedAt: now,
      mode: 'conversation',
      summary: 'Initial English chat'
    });

    await maveDb.db.insert(conversationTurns).values({
      id: 'turn-1',
      conversationId: convId,
      speaker: 'user',
      text: 'Hello MAVE',
      createdAt: now,
      interrupted: false
    });

    const turns = await maveDb.db
      .select()
      .from(conversationTurns)
      .where(eq(conversationTurns.conversationId, convId));

    expect(turns.length).toBe(1);
    expect(turns[0]?.text).toBe('Hello MAVE');
  });

  it('supports vocabulary tracking', async () => {
    const now = new Date();
    await maveDb.db.insert(vocabulary).values({
      id: 'vocab-1',
      word: 'Durability',
      normalizedWord: 'durability',
      meaningTh: 'ความทนทาน',
      example: 'The durability of this material is great.',
      lastSeenAt: now,
      createdAt: now
    });

    const words = await maveDb.db.select().from(vocabulary);
    expect(words.length).toBe(1);
    expect(words[0]?.word).toBe('Durability');
  });
});
