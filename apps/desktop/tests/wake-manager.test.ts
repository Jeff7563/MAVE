import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMaveService, type MaveService } from '@mave/core';
import { MockWakeWordProvider } from '@mave/providers';
import { WakeManager } from '../src/main/wake-manager.js';

describe('WakeManager Lifecycle & State Machine Coordinator', () => {
  let mockDb: any;
  let service: MaveService;

  beforeEach(() => {
    mockDb = {
      sqlite: {
        exec: vi.fn().mockReturnValue([]),
        run: vi.fn()
      },
      save: vi.fn()
    };
    service = createMaveService();
    service.start();
    service.send({ type: 'APP_READY' });
  });

  it('coordinates wake_detected -> WAKE_DETECTED -> waking transition', async () => {
    const mockProvider = new MockWakeWordProvider({ status: 'listening' });
    const manager = new WakeManager({
      service,
      database: mockDb,
      provider: mockProvider
    });

    await manager.initialize();
    expect(service.getSnapshot().state).toBe('sleeping');

    // Simulate wake event from provider
    mockProvider.simulateWake();

    expect(service.getSnapshot().state).toBe('waking');
    expect(service.getSnapshot().lastWakeAt).toBeDefined();

    await manager.dispose();
  });

  it('stops wake provider capture when assistant is muted and restarts when unmuted', async () => {
    const mockProvider = new MockWakeWordProvider();
    const manager = new WakeManager({
      service,
      database: mockDb,
      provider: mockProvider
    });

    await manager.initialize();
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(mockProvider.getStatus()).toBe('listening');

    // Mute the assistant
    service.send({ type: 'TOGGLE_MUTE' });
    expect(service.getSnapshot().state).toBe('muted');
    expect(mockProvider.getStatus()).toBe('ready');

    // Unmute the assistant -> returns to sleeping -> wake provider starts
    service.send({ type: 'TOGGLE_MUTE' });
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(mockProvider.getStatus()).toBe('listening');

    await manager.dispose();
  });

  it('stops wake provider when waking and restarts when returning to sleeping', async () => {
    const mockProvider = new MockWakeWordProvider();
    const manager = new WakeManager({
      service,
      database: mockDb,
      provider: mockProvider
    });

    await manager.initialize();
    expect(mockProvider.getStatus()).toBe('listening');

    // Trigger wake
    service.send({ type: 'WAKE_DETECTED' });
    expect(service.getSnapshot().state).toBe('waking');
    expect(mockProvider.getStatus()).toBe('ready');

    // Return to sleep
    service.send({ type: 'SLEEP_REQUESTED' });
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(mockProvider.getStatus()).toBe('listening');

    await manager.dispose();
  });

  it('safely handles missing model in provider diagnostics', async () => {
    const mockProvider = new MockWakeWordProvider({
      status: 'not_configured',
      isConfigured: false
    });

    const manager = new WakeManager({
      service,
      database: mockDb,
      provider: mockProvider
    });

    await manager.initialize();

    const snapshot = service.getSnapshot();
    expect(snapshot.wakeEngineStatus).toBe('not_configured');
    expect(snapshot.wakeProvider).toBe('openWakeWord');

    await manager.dispose();
  });

  it('surfaces provider error to state machine', async () => {
    const mockProvider = new MockWakeWordProvider();
    const manager = new WakeManager({
      service,
      database: mockDb,
      provider: mockProvider
    });

    await manager.initialize();

    mockProvider.simulateError(new Error('Audio device failure'));

    expect(service.getSnapshot().wakeEngineStatus).toBe('error');

    await manager.dispose();
  });

  it('handles offline audio file test through wake manager', async () => {
    const mockProvider = new MockWakeWordProvider();
    const manager = new WakeManager({
      service,
      database: mockDb,
      provider: mockProvider
    });

    await manager.initialize();

    const result = await manager.testAudioFile('sample.wav');
    expect(result).not.toBeNull();
    expect(result?.wakeDetected).toBe(true);
    expect(result?.maxScore).toBe(0.85);

    await manager.dispose();
  });
});
