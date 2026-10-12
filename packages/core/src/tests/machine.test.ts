import { describe, it, expect } from 'vitest';
import { createMaveService } from '../state-machine/service.js';

describe('MAVE State Machine', () => {
  it('initializes correctly in starting state', () => {
    const service = createMaveService();
    service.start();

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe('starting');
    expect(snapshot.isMuted).toBe(false);
    expect(snapshot.wakeEngineStatus).toBe('not_configured');
    expect(snapshot.databaseStatus).toBe('ready');

    service.stop();
  });

  it('transitions from starting to sleeping on APP_READY', () => {
    const service = createMaveService();
    service.start();

    service.send({ type: 'APP_READY' });
    expect(service.getSnapshot().state).toBe('sleeping');

    service.stop();
  });

  it('transitions from sleeping to waking on WAKE_DETECTED', () => {
    const service = createMaveService();
    service.start();
    service.send({ type: 'APP_READY' });
    expect(service.getSnapshot().state).toBe('sleeping');

    service.send({ type: 'WAKE_DETECTED' });
    expect(service.getSnapshot().state).toBe('waking');

    service.send({ type: 'WAKE_CANCELLED' });
    expect(service.getSnapshot().state).toBe('sleeping');

    service.stop();
  });

  it('handles mute and unmute transitions', () => {
    const service = createMaveService();
    service.start();
    service.send({ type: 'APP_READY' });

    service.send({ type: 'MUTE' });
    expect(service.getSnapshot().state).toBe('muted');
    expect(service.getSnapshot().isMuted).toBe(true);

    service.send({ type: 'UNMUTE' });
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(service.getSnapshot().isMuted).toBe(false);

    // Toggle mute
    service.send({ type: 'TOGGLE_MUTE' });
    expect(service.getSnapshot().state).toBe('muted');
    expect(service.getSnapshot().isMuted).toBe(true);

    service.send({ type: 'TOGGLE_MUTE' });
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(service.getSnapshot().isMuted).toBe(false);

    service.stop();
  });

  it('transitions to error state from any state and recovers', () => {
    const service = createMaveService();
    service.start();
    service.send({ type: 'APP_READY' });

    service.send({ type: 'ERROR', error: 'Simulated connection failure' });
    expect(service.getSnapshot().state).toBe('error');
    expect(service.getSnapshot().errorMessage).toBe('Simulated connection failure');

    service.send({ type: 'SLEEP_REQUESTED' });
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(service.getSnapshot().errorMessage).toBeUndefined();

    service.stop();
  });

  it('notifies subscribers on state transitions', () => {
    const service = createMaveService();
    service.start();

    const transitions: string[] = [];
    const unsubscribe = service.subscribe((snap) => {
      transitions.push(snap.state);
    });

    service.send({ type: 'APP_READY' });
    service.send({ type: 'WAKE_DETECTED' });
    service.send({ type: 'SLEEP_REQUESTED' });

    expect(transitions).toContain('sleeping');
    expect(transitions).toContain('waking');

    unsubscribe();
    service.stop();
  });
});
