import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ConversationTurn, Session } from '@mave/contracts';
import {
  createMaveDatabase,
  SQLiteConversationStore,
  type MaveDatabase
} from '../index.js';

describe('SQLiteConversationStore', () => {
  let tempDir: string;
  let dbFilePath: string;
  let maveDb: MaveDatabase;
  let store: SQLiteConversationStore;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mave-db-test-'));
    dbFilePath = path.join(tempDir, 'test.db');
    maveDb = await createMaveDatabase(dbFilePath);
    store = new SQLiteConversationStore(maveDb);
  });

  afterEach(() => {
    try {
      maveDb.close();
    } catch {
      // ignore
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 1. create session
  it('1. creates a new session in database', async () => {
    const session: Session = {
      id: 'sess-1',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation',
      title: 'Session One'
    };

    await store.createSession(session);
    const retrieved = await store.getSession('sess-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('sess-1');
  });

  // 2. retrieve session
  it('2. retrieves an existing session with all matching fields', async () => {
    const session: Session = {
      id: 'sess-2',
      createdAt: 2000,
      updatedAt: 2500,
      status: 'active',
      mode: 'teacher',
      title: 'Teacher Session',
      activeProviderId: 'mock-provider',
      metadata: { key: 'value' }
    };

    await store.createSession(session);
    const retrieved = await store.getSession('sess-2');
    expect(retrieved).toEqual(session);
  });

  // 3. missing session
  it('3. returns undefined for missing session', async () => {
    const retrieved = await store.getSession('non-existent-id');
    expect(retrieved).toBeUndefined();
  });

  // 4. update session
  it('4. updates an existing session', async () => {
    const session: Session = {
      id: 'sess-update',
      createdAt: 3000,
      updatedAt: 3000,
      status: 'active',
      mode: 'conversation'
    };
    await store.createSession(session);

    const updated: Session = {
      ...session,
      status: 'ended',
      updatedAt: 4000,
      title: 'Updated Title'
    };
    await store.updateSession(updated);

    const retrieved = await store.getSession('sess-update');
    expect(retrieved?.status).toBe('ended');
    expect(retrieved?.updatedAt).toBe(4000);
    expect(retrieved?.title).toBe('Updated Title');
  });

  // 5. activeProviderId round-trip
  it('5. activeProviderId round-trips correctly', async () => {
    const session: Session = {
      id: 'sess-provider',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation',
      activeProviderId: 'provider-alpha'
    };
    await store.createSession(session);

    let retrieved = await store.getSession('sess-provider');
    expect(retrieved?.activeProviderId).toBe('provider-alpha');

    // Update activeProviderId
    await store.updateSession({
      ...session,
      activeProviderId: 'provider-beta',
      updatedAt: 2000
    });
    retrieved = await store.getSession('sess-provider');
    expect(retrieved?.activeProviderId).toBe('provider-beta');
  });

  // 6. mode round-trip
  it('6. mode round-trips correctly across all valid modes', async () => {
    const modes: Session['mode'][] = ['conversation', 'teacher', 'immersion', 'quick'];
    for (const mode of modes) {
      const session: Session = {
        id: `sess-mode-${mode}`,
        createdAt: 1000,
        updatedAt: 1000,
        status: 'active',
        mode
      };
      await store.createSession(session);
      const retrieved = await store.getSession(session.id);
      expect(retrieved?.mode).toBe(mode);
    }
  });

  // 7. timestamps round-trip
  it('7. timestamps round-trip with exact millisecond precision', async () => {
    const createdAt = 1760000123456;
    const updatedAt = 1760000987654;
    const session: Session = {
      id: 'sess-time',
      createdAt,
      updatedAt,
      status: 'active',
      mode: 'conversation'
    };
    await store.createSession(session);
    const retrieved = await store.getSession('sess-time');
    expect(retrieved?.createdAt).toBe(createdAt);
    expect(retrieved?.updatedAt).toBe(updatedAt);
  });

  // 8. create user turn
  it('8. creates and persists a user turn', async () => {
    const session: Session = {
      id: 'sess-turns',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation'
    };
    await store.createSession(session);

    const userTurn: ConversationTurn = {
      id: 'turn-u1',
      sessionId: 'sess-turns',
      requestId: 'req-1',
      role: 'user',
      content: 'Hello MAVE',
      status: 'completed',
      createdAt: 1100
    };
    await store.createTurn(userTurn);

    const turns = await store.getTurns('sess-turns');
    expect(turns).toHaveLength(1);
    expect(turns[0]?.role).toBe('user');
    expect(turns[0]?.content).toBe('Hello MAVE');
  });

  // 9. create assistant turn
  it('9. creates and persists an assistant turn', async () => {
    const session: Session = {
      id: 'sess-turns-2',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation'
    };
    await store.createSession(session);

    const assistantTurn: ConversationTurn = {
      id: 'turn-a1',
      sessionId: 'sess-turns-2',
      requestId: 'req-2',
      role: 'assistant',
      content: 'Hello, how can I assist you?',
      providerId: 'mock-brain',
      status: 'completed',
      createdAt: 1200
    };
    await store.createTurn(assistantTurn);

    const turns = await store.getTurns('sess-turns-2');
    expect(turns).toHaveLength(1);
    expect(turns[0]?.role).toBe('assistant');
    expect(turns[0]?.content).toBe('Hello, how can I assist you?');
  });

  // 10. providerId round-trip
  it('10. providerId round-trips correctly on turn', async () => {
    const session: Session = {
      id: 'sess-turn-prov',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation'
    };
    await store.createSession(session);

    const turn: ConversationTurn = {
      id: 'turn-p',
      sessionId: 'sess-turn-prov',
      requestId: 'req-p',
      role: 'assistant',
      content: 'Provider test',
      providerId: 'provider-gemini',
      status: 'completed',
      createdAt: 1100
    };
    await store.createTurn(turn);

    const turns = await store.getTurns('sess-turn-prov');
    expect(turns[0]?.providerId).toBe('provider-gemini');
  });

  // 11. requestId round-trip
  it('11. requestId round-trips correctly on turn', async () => {
    const session: Session = {
      id: 'sess-turn-req',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation'
    };
    await store.createSession(session);

    const turn: ConversationTurn = {
      id: 'turn-req',
      sessionId: 'sess-turn-req',
      requestId: 'req-unique-999',
      role: 'user',
      content: 'Request test',
      status: 'completed',
      createdAt: 1100
    };
    await store.createTurn(turn);

    const turns = await store.getTurns('sess-turn-req');
    expect(turns[0]?.requestId).toBe('req-unique-999');
  });

  // 12. turn status round-trip
  it('12. turn status round-trips for all valid statuses', async () => {
    const session: Session = {
      id: 'sess-turn-status',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation'
    };
    await store.createSession(session);

    const statuses: ConversationTurn['status'][] = [
      'pending',
      'streaming',
      'completed',
      'cancelled',
      'failed'
    ];
    for (let i = 0; i < statuses.length; i++) {
      const status = statuses[i]!;
      const turn: ConversationTurn = {
        id: `turn-st-${i}`,
        sessionId: 'sess-turn-status',
        requestId: `req-st-${i}`,
        role: 'assistant',
        content: `Status ${status}`,
        status,
        createdAt: 1000 + i * 100
      };
      await store.createTurn(turn);
    }

    const turns = await store.getTurns('sess-turn-status');
    expect(turns).toHaveLength(statuses.length);
    for (let i = 0; i < statuses.length; i++) {
      expect(turns[i]?.status).toBe(statuses[i]);
    }
  });

  // 13. error round-trip if schema supports it
  it('13. error round-trips on failed turns', async () => {
    const session: Session = {
      id: 'sess-turn-err',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation'
    };
    await store.createSession(session);

    const turn: ConversationTurn = {
      id: 'turn-failed',
      sessionId: 'sess-turn-err',
      requestId: 'req-fail',
      role: 'assistant',
      content: 'Partial before error',
      status: 'failed',
      error: 'Provider connection refused',
      createdAt: 1100
    };
    await store.createTurn(turn);

    const turns = await store.getTurns('sess-turn-err');
    expect(turns[0]?.status).toBe('failed');
    expect(turns[0]?.error).toBe('Provider connection refused');
  });

  // 14. update turn
  it('14. updates an existing turn status, content, and error', async () => {
    const session: Session = {
      id: 'sess-turn-up',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation'
    };
    await store.createSession(session);

    const turn: ConversationTurn = {
      id: 'turn-initial',
      sessionId: 'sess-turn-up',
      requestId: 'req-up',
      role: 'assistant',
      content: '',
      status: 'pending',
      createdAt: 1100
    };
    await store.createTurn(turn);

    // Update to completed with accumulated text
    const updatedTurn: ConversationTurn = {
      ...turn,
      content: 'Final accumulated text',
      status: 'completed',
      updatedAt: 1200
    };
    await store.updateTurn(updatedTurn);

    const turns = await store.getTurns('sess-turn-up');
    expect(turns[0]?.content).toBe('Final accumulated text');
    expect(turns[0]?.status).toBe('completed');
    expect(turns[0]?.updatedAt).toBe(1200);
  });

  // 15. retrieve turns chronologically
  it('15. retrieves turns chronologically with stable secondary key', async () => {
    const session: Session = {
      id: 'sess-order',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation'
    };
    await store.createSession(session);

    // Same timestamp colliding, different IDs
    const collidingTime = 2000;
    const turn1: ConversationTurn = {
      id: 'turn-a-first',
      sessionId: 'sess-order',
      requestId: 'req-1',
      role: 'user',
      content: 'First',
      status: 'completed',
      createdAt: collidingTime
    };
    const turn2: ConversationTurn = {
      id: 'turn-b-second',
      sessionId: 'sess-order',
      requestId: 'req-2',
      role: 'assistant',
      content: 'Second',
      status: 'completed',
      createdAt: collidingTime
    };
    const turn3: ConversationTurn = {
      id: 'turn-c-third',
      sessionId: 'sess-order',
      requestId: 'req-3',
      role: 'user',
      content: 'Third',
      status: 'completed',
      createdAt: collidingTime + 100
    };

    // Insert out of id order
    await store.createTurn(turn2);
    await store.createTurn(turn1);
    await store.createTurn(turn3);

    const turns = await store.getTurns('sess-order');
    expect(turns).toHaveLength(3);
    // turn1 has lower id ('turn-a-first') than turn2 ('turn-b-second')
    expect(turns[0]?.id).toBe('turn-a-first');
    expect(turns[1]?.id).toBe('turn-b-second');
    expect(turns[2]?.id).toBe('turn-c-third');
  });

  // 16. sessions remain isolated
  it('16. sessions and turns remain completely isolated', async () => {
    const sessionA: Session = {
      id: 'sess-alpha',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation'
    };
    const sessionB: Session = {
      id: 'sess-beta',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'immersion'
    };
    await store.createSession(sessionA);
    await store.createSession(sessionB);

    await store.createTurn({
      id: 'turn-a1',
      sessionId: 'sess-alpha',
      requestId: 'req-a',
      role: 'user',
      content: 'Alpha msg',
      status: 'completed',
      createdAt: 1100
    });
    await store.createTurn({
      id: 'turn-b1',
      sessionId: 'sess-beta',
      requestId: 'req-b',
      role: 'user',
      content: 'Beta msg',
      status: 'completed',
      createdAt: 1100
    });

    const alphaTurns = await store.getTurns('sess-alpha');
    const betaTurns = await store.getTurns('sess-beta');

    expect(alphaTurns).toHaveLength(1);
    expect(alphaTurns[0]?.content).toBe('Alpha msg');
    expect(betaTurns).toHaveLength(1);
    expect(betaTurns[0]?.content).toBe('Beta msg');
  });

  // 17. duplicate IDs handled safely
  it('17. duplicate session and turn IDs are rejected safely', async () => {
    const session: Session = {
      id: 'sess-dup',
      createdAt: 1000,
      updatedAt: 1000,
      status: 'active',
      mode: 'conversation'
    };
    await store.createSession(session);

    await expect(store.createSession(session)).rejects.toThrow(
      /already exists/
    );

    const turn: ConversationTurn = {
      id: 'turn-dup',
      sessionId: 'sess-dup',
      requestId: 'req-dup',
      role: 'user',
      content: 'Dup test',
      status: 'completed',
      createdAt: 1100
    };
    await store.createTurn(turn);

    await expect(store.createTurn(turn)).rejects.toThrow(
      /already exists/
    );
  });

  // 18. database reopen preserves records
  it('18. reopening database from disk preserves all sessions and turns', async () => {
    const session: Session = {
      id: 'sess-persist',
      createdAt: 5000,
      updatedAt: 6000,
      status: 'active',
      mode: 'conversation',
      activeProviderId: 'mock-provider',
      title: 'Persistent Session'
    };
    await store.createSession(session);

    const turn: ConversationTurn = {
      id: 'turn-persist',
      sessionId: 'sess-persist',
      requestId: 'req-persist',
      role: 'user',
      content: 'This must survive reopening',
      status: 'completed',
      createdAt: 5500
    };
    await store.createTurn(turn);

    // Close database cleanly
    maveDb.close();

    // Reopen database from same file path
    const reopenedDb = await createMaveDatabase(dbFilePath);
    const reopenedStore = new SQLiteConversationStore(reopenedDb);

    try {
      const retrievedSession = await reopenedStore.getSession('sess-persist');
      expect(retrievedSession).toEqual(session);

      const retrievedTurns = await reopenedStore.getTurns('sess-persist');
      expect(retrievedTurns).toHaveLength(1);
      expect(retrievedTurns[0]).toEqual(turn);
    } finally {
      reopenedDb.close();
    }
  });
});
