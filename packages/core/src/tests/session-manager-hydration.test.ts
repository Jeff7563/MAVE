import { describe, it, expect, beforeEach } from 'vitest';
import type { ConversationTurn, Session } from '@mave/contracts';
import { SessionManager } from '../conversation/session-manager.js';
import { ContextManager } from '../conversation/context-manager.js';
import { SessionManagerError } from '../conversation/types.js';

describe('SessionManager Hydration & Turn Recovery', () => {
  let sessionManager: SessionManager;
  let contextManager: ContextManager;

  beforeEach(() => {
    sessionManager = new SessionManager({ clock: () => 1000 });
    contextManager = new ContextManager();
  });

  it('hydrates session and turns preserving canonical IDs, timestamps, and ordering', () => {
    const session: Session = {
      id: 'sess-hydrated-1',
      createdAt: 500,
      updatedAt: 800,
      status: 'active',
      mode: 'conversation',
      activeProviderId: 'mock-brain',
      title: 'Persisted Session'
    };

    const turns: ConversationTurn[] = [
      {
        id: 'turn-1',
        sessionId: 'sess-hydrated-1',
        requestId: 'req-1',
        role: 'user',
        content: 'Hello MAVE',
        status: 'completed',
        createdAt: 600,
        updatedAt: 600
      },
      {
        id: 'turn-2',
        sessionId: 'sess-hydrated-1',
        requestId: 'req-1',
        role: 'assistant',
        content: 'Hi! How can I help?',
        providerId: 'mock-brain',
        status: 'completed',
        createdAt: 700,
        updatedAt: 750
      }
    ];

    const hydrated = sessionManager.hydrateSession(session, turns);

    expect(hydrated.id).toBe('sess-hydrated-1');
    expect(hydrated.createdAt).toBe(500);
    expect(hydrated.updatedAt).toBe(800);

    const retrievedTurns = sessionManager.getTurns('sess-hydrated-1');
    expect(retrievedTurns).toHaveLength(2);
    expect(retrievedTurns[0]?.id).toBe('turn-1');
    expect(retrievedTurns[0]?.createdAt).toBe(600);
    expect(retrievedTurns[1]?.id).toBe('turn-2');
    expect(retrievedTurns[1]?.updatedAt).toBe(750);
  });

  it('rejects hydration if session already exists in memory', () => {
    sessionManager.createSession({ id: 'existing-sess' });

    const duplicateSession: Session = {
      id: 'existing-sess',
      createdAt: 500,
      updatedAt: 500,
      status: 'active',
      mode: 'conversation'
    };

    expect(() =>
      sessionManager.hydrateSession(duplicateSession, [])
    ).toThrow(SessionManagerError);
  });

  it('rejects hydration if a turn belongs to a different session', () => {
    const session: Session = {
      id: 'sess-correct',
      createdAt: 500,
      updatedAt: 500,
      status: 'active',
      mode: 'conversation'
    };

    const turns: ConversationTurn[] = [
      {
        id: 'turn-alien',
        sessionId: 'sess-different',
        requestId: 'req-1',
        role: 'user',
        content: 'Mismatch',
        status: 'completed',
        createdAt: 600
      }
    ];

    expect(() =>
      sessionManager.hydrateSession(session, turns)
    ).toThrow(SessionManagerError);
  });

  it('rejects duplicate turn IDs during hydration or across sessions', () => {
    const sessionA: Session = {
      id: 'sess-a',
      createdAt: 500,
      updatedAt: 500,
      status: 'active',
      mode: 'conversation'
    };

    const duplicateIdTurns: ConversationTurn[] = [
      {
        id: 'turn-dup',
        sessionId: 'sess-a',
        requestId: 'req-1',
        role: 'user',
        content: 'First',
        status: 'completed',
        createdAt: 600
      },
      {
        id: 'turn-dup',
        sessionId: 'sess-a',
        requestId: 'req-2',
        role: 'assistant',
        content: 'Second',
        status: 'completed',
        createdAt: 700
      }
    ];

    expect(() =>
      sessionManager.hydrateSession(sessionA, duplicateIdTurns)
    ).toThrow(SessionManagerError);
  });

  it('normalizes non-terminal assistant turns (pending or streaming) to failed', () => {
    const session: Session = {
      id: 'sess-crash',
      createdAt: 500,
      updatedAt: 500,
      status: 'active',
      mode: 'conversation'
    };

    const turns: ConversationTurn[] = [
      {
        id: 'turn-u',
        sessionId: 'sess-crash',
        requestId: 'req-1',
        role: 'user',
        content: 'What is 2+2?',
        status: 'completed',
        createdAt: 600
      },
      {
        id: 'turn-a-pending',
        sessionId: 'sess-crash',
        requestId: 'req-1',
        role: 'assistant',
        content: '',
        status: 'pending',
        createdAt: 650
      },
      {
        id: 'turn-a-streaming',
        sessionId: 'sess-crash',
        requestId: 'req-1',
        role: 'assistant',
        content: 'The answer',
        status: 'streaming',
        createdAt: 700
      }
    ];

    sessionManager.hydrateSession(session, turns);

    const hydratedTurns = sessionManager.getTurns('sess-crash');
    expect(hydratedTurns[0]?.status).toBe('completed');
    expect(hydratedTurns[1]?.status).toBe('failed');
    expect(hydratedTurns[1]?.error).toBe('Turn interrupted before completion');
    expect(hydratedTurns[2]?.status).toBe('failed');
    expect(hydratedTurns[2]?.error).toBe('Turn interrupted before completion');

    // ContextManager must exclude these interrupted turns from context
    const context = contextManager.buildForSession(sessionManager, 'sess-crash');
    expect(context.messages).toHaveLength(1);
    expect(context.messages[0]?.content).toBe('What is 2+2?');
  });

  it('does not expose internal maps or mutate caller state', () => {
    const session: Session = {
      id: 'sess-defensive',
      createdAt: 500,
      updatedAt: 500,
      status: 'active',
      mode: 'conversation',
      metadata: { original: true }
    };

    const turns: ConversationTurn[] = [
      {
        id: 'turn-def',
        sessionId: 'sess-defensive',
        requestId: 'req-1',
        role: 'user',
        content: 'Defensive copy test',
        status: 'completed',
        createdAt: 600
      }
    ];

    const hydrated = sessionManager.hydrateSession(session, turns);
    (session.metadata as Record<string, unknown>).original = false;

    const retrieved = sessionManager.getSession('sess-defensive')!;
    expect((retrieved.metadata as Record<string, unknown>).original).toBe(true);
    expect(hydrated).not.toBe(retrieved);
  });
});
