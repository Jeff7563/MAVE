import { describe, it, expect } from 'vitest';
import type { ConversationTurn, Session } from '@mave/contracts';
import {
  SessionManager,
  ContextManager,
  SessionManagerError,
  ContextManagerError
} from '../conversation/index.js';

describe('SessionManager', () => {
  it('1. creates active session with default status and mode', () => {
    const manager = new SessionManager();
    const session = manager.createSession();

    expect(session.id).toBeDefined();
    expect(session.status).toBe('active');
    expect(session.mode).toBe('conversation');
    expect(session.createdAt).toBeGreaterThan(0);
    expect(session.updatedAt).toBe(session.createdAt);
  });

  it('2. generated session ID is stable through retrieval', () => {
    const manager = new SessionManager();
    const created = manager.createSession();
    const retrieved = manager.getSession(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
  });

  it('3. supports injected deterministic ID factory', () => {
    let sessionCounter = 0;
    let turnCounter = 0;
    const manager = new SessionManager({
      sessionIdFactory: () => `session-${++sessionCounter}`,
      turnIdFactory: () => `turn-${++turnCounter}`
    });

    const s1 = manager.createSession();
    const s2 = manager.createSession();

    expect(s1.id).toBe('session-1');
    expect(s2.id).toBe('session-2');

    const t1 = manager.appendTurn({
      sessionId: s1.id,
      requestId: 'req-1',
      role: 'user',
      content: 'hello'
    });

    expect(t1.id).toBe('turn-1');
  });

  it('4. gets existing session', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 'known-id', title: 'My Chat' });

    const fetched = manager.getSession('known-id');
    expect(fetched).toBeDefined();
    expect(fetched?.title).toBe('My Chat');
  });

  it('5. handles missing session behavior deterministically', () => {
    const manager = new SessionManager();

    expect(manager.getSession('missing-id')).toBeUndefined();
    expect(() => manager.requireSession('missing-id')).toThrow(SessionManagerError);

    try {
      manager.requireSession('missing-id');
    } catch (err) {
      const sErr = err as SessionManagerError;
      expect(sErr.code).toBe('session_not_found');
      expect(sErr.sessionId).toBe('missing-id');
    }
  });

  it('6. checks session existence with hasSession()', () => {
    const manager = new SessionManager();
    expect(manager.hasSession('test-s')).toBe(false);

    manager.createSession({ id: 'test-s' });
    expect(manager.hasSession('test-s')).toBe(true);
    expect(manager.hasSession('other')).toBe(false);
  });

  it('7. lists sessions deterministically in insertion order', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 's-alpha' });
    manager.createSession({ id: 's-beta' });
    manager.createSession({ id: 's-gamma' });

    const list = manager.listSessions();
    expect(list.length).toBe(3);
    expect(list[0]!.id).toBe('s-alpha');
    expect(list[1]!.id).toBe('s-beta');
    expect(list[2]!.id).toBe('s-gamma');
  });

  it('8. ends a session and updates status to ended', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 's-to-end' });

    const ended = manager.endSession('s-to-end');
    expect(ended.status).toBe('ended');
    expect(manager.getSession('s-to-end')?.status).toBe('ended');
  });

  it('9. ending session updates timestamp and behaves idempotently', () => {
    let currentTime = 1000;
    const manager = new SessionManager({ clock: () => currentTime });
    manager.createSession({ id: 's-time' });

    currentTime = 2000;
    const ended1 = manager.endSession('s-time');
    expect(ended1.status).toBe('ended');
    expect(ended1.updatedAt).toBe(2000);

    currentTime = 3000;
    // Second call to end an already ended session returns existing ended session
    const ended2 = manager.endSession('s-time');
    expect(ended2.status).toBe('ended');
    expect(ended2.updatedAt).toBe(2000);
  });

  it('10. cannot append turn to an ended session', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 'ended-session' });
    manager.endSession('ended-session');

    expect(() =>
      manager.appendTurn({
        sessionId: 'ended-session',
        requestId: 'req-1',
        role: 'user',
        content: 'message'
      })
    ).toThrow(SessionManagerError);

    try {
      manager.appendTurn({
        sessionId: 'ended-session',
        requestId: 'req-1',
        role: 'user',
        content: 'message'
      });
    } catch (err) {
      const sErr = err as SessionManagerError;
      expect(sErr.code).toBe('session_ended');
    }
  });

  it('11. updates activeProviderId and timestamp on active session', () => {
    let currentTime = 1000;
    const manager = new SessionManager({ clock: () => currentTime });
    manager.createSession({ id: 's-prov' });

    currentTime = 1500;
    const updated = manager.updateActiveProviderId('s-prov', 'mock-provider');
    expect(updated.activeProviderId).toBe('mock-provider');
    expect(updated.updatedAt).toBe(1500);

    // Fails on ended session
    manager.endSession('s-prov');
    expect(() => manager.updateActiveProviderId('s-prov', 'another')).toThrow(SessionManagerError);
  });

  it('12. appends user turn correctly', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 's-user' });

    const turn = manager.appendTurn({
      sessionId: 's-user',
      requestId: 'req-u1',
      role: 'user',
      content: 'Hello MAVE!'
    });

    expect(turn.id).toBeDefined();
    expect(turn.sessionId).toBe('s-user');
    expect(turn.requestId).toBe('req-u1');
    expect(turn.role).toBe('user');
    expect(turn.content).toBe('Hello MAVE!');
    expect(turn.status).toBe('completed');
  });

  it('13. appends assistant turn correctly', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 's-asst', activeProviderId: 'mock-brain' });

    const turn = manager.appendTurn({
      sessionId: 's-asst',
      requestId: 'req-a1',
      role: 'assistant',
      content: 'I am here to assist.',
      status: 'completed'
    });

    expect(turn.role).toBe('assistant');
    expect(turn.providerId).toBe('mock-brain');
    expect(turn.content).toBe('I am here to assist.');
  });

  it('14. preserves conversation turn insertion order', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 's-order' });

    manager.appendTurn('s-order', {
      requestId: 'r1',
      role: 'user',
      content: 'turn 1'
    });
    manager.appendTurn('s-order', {
      requestId: 'r2',
      role: 'assistant',
      content: 'turn 2'
    });
    manager.appendTurn('s-order', {
      requestId: 'r3',
      role: 'user',
      content: 'turn 3'
    });

    const turns = manager.getTurns('s-order');
    expect(turns.length).toBe(3);
    expect(turns[0]!.content).toBe('turn 1');
    expect(turns[1]!.content).toBe('turn 2');
    expect(turns[2]!.content).toBe('turn 3');
  });

  it('15. rejects duplicate turn ID', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 's-dup' });

    manager.appendTurn({
      id: 'fixed-turn-id',
      sessionId: 's-dup',
      requestId: 'r1',
      role: 'user',
      content: 'first'
    });

    expect(() =>
      manager.appendTurn({
        id: 'fixed-turn-id',
        sessionId: 's-dup',
        requestId: 'r2',
        role: 'user',
        content: 'second'
      })
    ).toThrow(SessionManagerError);

    try {
      manager.appendTurn({
        id: 'fixed-turn-id',
        sessionId: 's-dup',
        requestId: 'r2',
        role: 'user',
        content: 'second'
      });
    } catch (err) {
      const sErr = err as SessionManagerError;
      expect(sErr.code).toBe('duplicate_turn');
    }
  });

  it('16. rejects mismatched sessionId', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 'session-target' });

    expect(() =>
      manager.appendTurn('session-target', {
        sessionId: 'session-different',
        requestId: 'r1',
        role: 'user',
        content: 'mismatch'
      })
    ).toThrow(SessionManagerError);

    try {
      manager.appendTurn('session-target', {
        sessionId: 'session-different',
        requestId: 'r1',
        role: 'user',
        content: 'mismatch'
      });
    } catch (err) {
      const sErr = err as SessionManagerError;
      expect(sErr.code).toBe('invalid_turn');
    }
  });

  it('17. gets all turns for a session', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 's-all' });

    expect(manager.getTurns('s-all')).toEqual([]);

    manager.appendTurn({
      sessionId: 's-all',
      requestId: 'r1',
      role: 'user',
      content: 'c1'
    });
    manager.appendTurn({
      sessionId: 's-all',
      requestId: 'r2',
      role: 'assistant',
      content: 'c2'
    });

    expect(manager.getTurns('s-all').length).toBe(2);
  });

  it('18. gets recent N turns correctly', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 's-recent' });

    for (let i = 1; i <= 5; i++) {
      manager.appendTurn({
        sessionId: 's-recent',
        requestId: `r${i}`,
        role: 'user',
        content: `message ${i}`
      });
    }

    const recent3 = manager.getRecentTurns('s-recent', 3);
    expect(recent3.length).toBe(3);
    expect(recent3[0]!.content).toBe('message 3');
    expect(recent3[1]!.content).toBe('message 4');
    expect(recent3[2]!.content).toBe('message 5');

    // Count <= 0 returns empty
    expect(manager.getRecentTurns('s-recent', 0)).toEqual([]);
  });

  it('19. recent turn ordering remains chronological', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 's-chron' });

    manager.appendTurn({ sessionId: 's-chron', requestId: 'r1', role: 'user', content: 'first' });
    manager.appendTurn({ sessionId: 's-chron', requestId: 'r2', role: 'assistant', content: 'second' });
    manager.appendTurn({ sessionId: 's-chron', requestId: 'r3', role: 'user', content: 'third' });

    const recent = manager.getRecentTurns('s-chron', 2);
    expect(recent[0]!.content).toBe('second');
    expect(recent[1]!.content).toBe('third');
  });

  it('20. independent sessions never cross-talk', () => {
    const manager = new SessionManager();
    manager.createSession({ id: 's-1' });
    manager.createSession({ id: 's-2' });

    manager.appendTurn({ sessionId: 's-1', requestId: 'r1', role: 'user', content: 'msg for s1' });
    manager.appendTurn({ sessionId: 's-2', requestId: 'r2', role: 'user', content: 'msg for s2' });

    const s1Turns = manager.getTurns('s-1');
    const s2Turns = manager.getTurns('s-2');

    expect(s1Turns.length).toBe(1);
    expect(s1Turns[0]!.content).toBe('msg for s1');
    expect(s2Turns.length).toBe(1);
    expect(s2Turns[0]!.content).toBe('msg for s2');
  });

  it('21. external mutation cannot corrupt internal manager state', () => {
    const manager = new SessionManager();
    const session = manager.createSession({ id: 's-mutate', metadata: { key: 'original' } });

    // Mutate returned session
    session.status = 'ended';
    if (session.metadata) {
      session.metadata.key = 'hacked';
    }

    const internalSession = manager.requireSession('s-mutate');
    expect(internalSession.status).toBe('active');
    expect(internalSession.metadata?.key).toBe('original');

    // Mutate returned turns array
    manager.appendTurn({ sessionId: 's-mutate', requestId: 'r1', role: 'user', content: 'turn-1' });
    const turns = manager.getTurns('s-mutate');
    turns.push({
      id: 'rogue-turn',
      sessionId: 's-mutate',
      requestId: 'r99',
      role: 'user',
      content: 'rogue',
      status: 'completed',
      createdAt: 0
    });

    expect(manager.getTurns('s-mutate').length).toBe(1);
    expect(manager.getTurns('s-mutate')[0]!.id).not.toBe('rogue-turn');
  });

  it('22. deterministic clock works in tests', () => {
    let tick = 50000;
    const manager = new SessionManager({ clock: () => tick });

    const session = manager.createSession({ id: 's-clock' });
    expect(session.createdAt).toBe(50000);
    expect(session.updatedAt).toBe(50000);

    tick = 60000;
    const turn = manager.appendTurn({
      sessionId: 's-clock',
      requestId: 'r1',
      role: 'user',
      content: 'hello'
    });
    expect(turn.createdAt).toBe(60000);

    const updatedSession = manager.requireSession('s-clock');
    expect(updatedSession.updatedAt).toBe(60000);
  });

  it('23. updates turn status and error correctly', () => {
    let tick = 1000;
    const manager = new SessionManager({ clock: () => tick });
    manager.createSession({ id: 's-status' });

    manager.appendTurn({
      id: 'turn-stat',
      sessionId: 's-status',
      requestId: 'r1',
      role: 'assistant',
      content: 'initial',
      status: 'streaming'
    });

    tick = 2000;
    const updated = manager.updateTurnStatus('s-status', 'turn-stat', 'failed', 'Network error');
    expect(updated.status).toBe('failed');
    expect(updated.error).toBe('Network error');
    expect(updated.updatedAt).toBe(2000);

    const retrieved = manager.getTurns('s-status')[0]!;
    expect(retrieved.status).toBe('failed');
    expect(retrieved.error).toBe('Network error');
  });
});

describe('ContextManager', () => {
  const sampleSession: Session = {
    id: 'test-session',
    createdAt: 1000,
    updatedAt: 1000,
    status: 'active',
    mode: 'conversation',
    activeProviderId: 'mock-provider'
  };

  it('1. empty session produces valid empty context', () => {
    const cm = new ContextManager();
    const bundle = cm.build(sampleSession, []);

    expect(bundle.sessionId).toBe('test-session');
    expect(bundle.mode).toBe('conversation');
    expect(bundle.activeProviderId).toBe('mock-provider');
    expect(bundle.messages).toEqual([]);
    expect(bundle.turnCount).toBe(0);
    expect(bundle.context).toEqual({
      sessionId: 'test-session',
      mode: 'conversation',
      activeProviderId: 'mock-provider'
    });
  });

  it('2. maps recent completed turns correctly to MaveMessage', () => {
    const cm = new ContextManager();
    const turns: ConversationTurn[] = [
      {
        id: 't1',
        sessionId: 'test-session',
        requestId: 'r1',
        role: 'user',
        content: 'Hi',
        status: 'completed',
        createdAt: 100
      },
      {
        id: 't2',
        sessionId: 'test-session',
        requestId: 'r1',
        role: 'assistant',
        content: 'Hello there!',
        status: 'completed',
        createdAt: 101
      }
    ];

    const bundle = cm.build(sampleSession, turns);
    expect(bundle.messages).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello there!' }
    ]);
    expect(bundle.turnCount).toBe(2);
  });

  it('3. strictly preserves chronological order', () => {
    const cm = new ContextManager();
    const turns: ConversationTurn[] = [
      { id: '1', sessionId: 's', requestId: 'r', role: 'user', content: 'first', status: 'completed', createdAt: 1 },
      { id: '2', sessionId: 's', requestId: 'r', role: 'assistant', content: 'second', status: 'completed', createdAt: 2 },
      { id: '3', sessionId: 's', requestId: 'r', role: 'user', content: 'third', status: 'completed', createdAt: 3 }
    ];

    const bundle = cm.build(sampleSession, turns);
    expect(bundle.messages.map(m => m.content)).toEqual(['first', 'second', 'third']);
  });

  it('4. respects maxTurns limit and drops older turns first', () => {
    const cm = new ContextManager({ maxTurns: 3 });
    const turns: ConversationTurn[] = [
      { id: '1', sessionId: 's', requestId: 'r', role: 'user', content: 't1', status: 'completed', createdAt: 1 },
      { id: '2', sessionId: 's', requestId: 'r', role: 'assistant', content: 't2', status: 'completed', createdAt: 2 },
      { id: '3', sessionId: 's', requestId: 'r', role: 'user', content: 't3', status: 'completed', createdAt: 3 },
      { id: '4', sessionId: 's', requestId: 'r', role: 'assistant', content: 't4', status: 'completed', createdAt: 4 },
      { id: '5', sessionId: 's', requestId: 'r', role: 'user', content: 't5', status: 'completed', createdAt: 5 }
    ];

    const bundle = cm.build(sampleSession, turns);
    expect(bundle.messages.map(m => m.content)).toEqual(['t3', 't4', 't5']);
    expect(bundle.turnCount).toBe(3);
  });

  it('5. excludes failed assistant turns', () => {
    const cm = new ContextManager();
    const turns: ConversationTurn[] = [
      { id: '1', sessionId: 's', requestId: 'r1', role: 'user', content: 'question', status: 'completed', createdAt: 1 },
      { id: '2', sessionId: 's', requestId: 'r1', role: 'assistant', content: 'error details', status: 'failed', createdAt: 2 }
    ];

    const bundle = cm.build(sampleSession, turns);
    expect(bundle.messages).toEqual([{ role: 'user', content: 'question' }]);
  });

  it('6. excludes cancelled assistant turns', () => {
    const cm = new ContextManager();
    const turns: ConversationTurn[] = [
      { id: '1', sessionId: 's', requestId: 'r1', role: 'user', content: 'calculate', status: 'completed', createdAt: 1 },
      { id: '2', sessionId: 's', requestId: 'r1', role: 'assistant', content: 'interrupted...', status: 'cancelled', createdAt: 2 }
    ];

    const bundle = cm.build(sampleSession, turns);
    expect(bundle.messages).toEqual([{ role: 'user', content: 'calculate' }]);
  });

  it('7. excludes incomplete streaming or pending assistant output', () => {
    const cm = new ContextManager();
    const turns: ConversationTurn[] = [
      { id: '1', sessionId: 's', requestId: 'r1', role: 'user', content: 'msg', status: 'completed', createdAt: 1 },
      { id: '2', sessionId: 's', requestId: 'r1', role: 'assistant', content: 'partial text...', status: 'streaming', createdAt: 2 },
      { id: '3', sessionId: 's', requestId: 'r2', role: 'assistant', content: 'unanswered', status: 'pending', createdAt: 3 }
    ];

    const bundle = cm.build(sampleSession, turns);
    expect(bundle.messages).toEqual([{ role: 'user', content: 'msg' }]);
  });

  it('8. includes session mode and active provider metadata correctly', () => {
    const cm = new ContextManager();
    const teacherSession: Session = {
      id: 'teacher-session',
      createdAt: 100,
      updatedAt: 100,
      status: 'active',
      mode: 'teacher',
      activeProviderId: 'fast-brain'
    };

    const bundle = cm.build(teacherSession, []);
    expect(bundle.mode).toBe('teacher');
    expect(bundle.activeProviderId).toBe('fast-brain');
    expect(bundle.context).toEqual({
      sessionId: 'teacher-session',
      mode: 'teacher',
      activeProviderId: 'fast-brain'
    });
  });

  it('9. omits activeProviderId in context when not configured', () => {
    const cm = new ContextManager();
    const sessionNoProvider: Session = {
      id: 'no-prov',
      createdAt: 100,
      updatedAt: 100,
      status: 'active',
      mode: 'quick'
    };

    const bundle = cm.build(sessionNoProvider, []);
    expect(bundle.activeProviderId).toBeUndefined();
    expect(bundle.context).toEqual({
      sessionId: 'no-prov',
      mode: 'quick'
    });
  });

  it('10. context output does not mutate source turns array or objects', () => {
    const cm = new ContextManager();
    const turn: ConversationTurn = {
      id: 't-1',
      sessionId: 's-1',
      requestId: 'r-1',
      role: 'user',
      content: 'immutable content',
      status: 'completed',
      createdAt: 100
    };
    const turns = [turn];

    const bundle = cm.build(sampleSession, turns);
    bundle.messages[0]!.content = 'mutated';

    expect(turn.content).toBe('immutable content');
  });

  it('11. independent builds do not share state', () => {
    const cm = new ContextManager();
    const b1 = cm.build(sampleSession, [
      { id: '1', sessionId: 's', requestId: 'r', role: 'user', content: 'm1', status: 'completed', createdAt: 1 }
    ]);
    const b2 = cm.build(sampleSession, [
      { id: '2', sessionId: 's', requestId: 'r', role: 'user', content: 'm2', status: 'completed', createdAt: 2 }
    ]);

    expect(b1.messages.map(m => m.content)).toEqual(['m1']);
    expect(b2.messages.map(m => m.content)).toEqual(['m2']);
  });

  it('12. wake and microphone diagnostics NEVER appear in context', () => {
    const cm = new ContextManager();
    const turns: ConversationTurn[] = [
      {
        id: 't1',
        sessionId: 'test-session',
        requestId: 'r1',
        role: 'user',
        content: 'hello',
        status: 'completed',
        createdAt: 100,
        metadata: {
          wakeScore: 0.95,
          micDevice: 'USB Mic',
          telemetry: { peak: 0.5 }
        }
      }
    ];

    const bundle = cm.build(sampleSession, turns);
    const bundleJson = JSON.stringify(bundle);

    expect(bundleJson).not.toContain('wakeScore');
    expect(bundleJson).not.toContain('micDevice');
    expect(bundleJson).not.toContain('USB Mic');
    expect(bundleJson).not.toContain('telemetry');
  });

  it('13. buildForSession coordinates with SessionManager seamlessly', () => {
    const sm = new SessionManager();
    const session = sm.createSession({ id: 'coord-session', mode: 'conversation' });

    sm.appendTurn({
      sessionId: session.id,
      requestId: 'r1',
      role: 'user',
      content: 'hi from manager'
    });
    sm.appendTurn({
      sessionId: session.id,
      requestId: 'r1',
      role: 'assistant',
      content: 'hello from manager'
    });

    const cm = new ContextManager();
    const bundle = cm.buildForSession(sm, session.id);

    expect(bundle.sessionId).toBe(session.id);
    expect(bundle.turnCount).toBe(2);
    expect(bundle.messages).toEqual([
      { role: 'user', content: 'hi from manager' },
      { role: 'assistant', content: 'hello from manager' }
    ]);
  });

  it('14. buildForSession throws on missing session', () => {
    const sm = new SessionManager();
    const cm = new ContextManager();

    expect(() => cm.buildForSession(sm, 'non-existent')).toThrow(SessionManagerError);
  });

  it('15. rejects invalid inputs with ContextManagerError', () => {
    const cm = new ContextManager();

    expect(() => cm.build(null as unknown as Session, [])).toThrow(ContextManagerError);
    expect(() => cm.build(sampleSession, null as unknown as ConversationTurn[])).toThrow(
      ContextManagerError
    );
  });
});
