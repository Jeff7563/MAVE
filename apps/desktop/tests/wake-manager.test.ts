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

  it('wake -> Waking -> Return to Sleep with ONE command deterministically', async () => {
    const mockProvider = new MockWakeWordProvider();
    const manager = new WakeManager({
      service,
      database: mockDb,
      provider: mockProvider,
      rearmGuardMs: 50
    });

    await manager.initialize();
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(mockProvider.getStatus()).toBe('listening');

    // Wake triggers Waking
    mockProvider.simulateWake(0.92);
    expect(service.getSnapshot().state).toBe('waking');
    expect(mockProvider.getStatus()).toBe('ready');

    // Exactly ONE command returns to sleep
    service.send({ type: 'SLEEP_REQUESTED' });
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(mockProvider.getStatus()).toBe('listening');

    await manager.dispose();
  });

  it('suppresses immediate duplicate WAKE_DETECTED within re-arm guard window', async () => {
    const mockProvider = new MockWakeWordProvider();
    const manager = new WakeManager({
      service,
      database: mockDb,
      provider: mockProvider,
      rearmGuardMs: 100
    });

    await manager.initialize();

    // 1. First wake
    mockProvider.simulateWake(0.85);
    expect(service.getSnapshot().state).toBe('waking');

    // 2. Return to sleep
    service.send({ type: 'SLEEP_REQUESTED' });
    expect(service.getSnapshot().state).toBe('sleeping');

    // 3. Immediately attempt duplicate wake within 100ms rearm window
    mockProvider.simulateWake(0.89);
    // State MUST remain sleeping (guard suppressed immediate re-trigger)
    expect(service.getSnapshot().state).toBe('sleeping');

    // 4. Wait past rearm window
    await new Promise((r) => setTimeout(r, 120));

    // 5. Subsequent intentional wake succeeds
    mockProvider.simulateWake(0.89);
    expect(service.getSnapshot().state).toBe('waking');

    await manager.dispose();
  });

  it('runs repeated 20-cycle mock lifecycle cleanly and deterministically', async () => {
    const mockProvider = new MockWakeWordProvider();
    const manager = new WakeManager({
      service,
      database: mockDb,
      provider: mockProvider,
      rearmGuardMs: 5
    });

    await manager.initialize();

    for (let cycle = 1; cycle <= 20; cycle++) {
      expect(service.getSnapshot().state).toBe('sleeping');
      expect(mockProvider.getStatus()).toBe('listening');

      // Wait 10ms past re-arm guard
      await new Promise((r) => setTimeout(r, 10));

      // Wake
      mockProvider.simulateWake(0.80 + (cycle % 10) * 0.01);
      expect(service.getSnapshot().state).toBe('waking');
      expect(mockProvider.getStatus()).toBe('ready');

      // Return to sleep with ONE command
      service.send({ type: 'SLEEP_REQUESTED' });
      expect(service.getSnapshot().state).toBe('sleeping');
      expect(mockProvider.getStatus()).toBe('listening');
    }

    const finalSnapshot = service.getSnapshot();
    expect(finalSnapshot.state).toBe('sleeping');
    expect(finalSnapshot.lastWakeAt).toBeDefined();

    await manager.dispose();
  });

  it('ensures start and stop remain idempotent across multiple calls', async () => {
    const mockProvider = new MockWakeWordProvider();
    const manager = new WakeManager({
      service,
      database: mockDb,
      provider: mockProvider
    });

    await manager.initialize();
    expect(mockProvider.getStatus()).toBe('listening');

    // Repeated start calls on provider while already listening
    await mockProvider.start();
    await mockProvider.start();
    expect(mockProvider.getStatus()).toBe('listening');

    // Repeated stop calls on provider
    await mockProvider.stop();
    await mockProvider.stop();
    expect(mockProvider.getStatus()).toBe('ready');

    await manager.dispose();
  });

  it('synchronizes live inference telemetry scores into state snapshot', async () => {
    const mockProvider = new MockWakeWordProvider();
    const manager = new WakeManager({
      service,
      database: mockDb,
      provider: mockProvider
    });

    await manager.initialize();

    mockProvider.setTelemetry(0.42, 0.48, undefined);
    manager.syncDiagnostics();

    let snap = service.getSnapshot();
    expect(snap.latestScore).toBe(0.42);
    expect(snap.peakScore).toBe(0.48);

    // Simulate wake with score 0.88
    mockProvider.simulateWake(0.88);
    snap = service.getSnapshot();
    expect(snap.lastWakeScore).toBe(0.88);
    expect(snap.peakScore).toBe(0.88);

    await manager.dispose();
  });

  it('instantiates OpenWakeWordProvider with pythonExecutable when not using mock', async () => {
    const manager = new WakeManager({
      service,
      database: mockDb,
      useMockProvider: false,
      pythonExecutable: 'C:\\custom\\env\\python.exe',
      rootDir: 'C:\\fake\\dir'
    });

    const provider = manager.getProvider();
    expect(provider).toBeDefined();
    if ('getResolvedPythonExecutable' in provider) {
      expect((provider as any).getResolvedPythonExecutable()).toBe('C:\\custom\\env\\python.exe');
    }
    await manager.dispose();
  });
});
