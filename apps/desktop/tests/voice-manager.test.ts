import { describe, it, expect, vi } from 'vitest';
import {
  createMaveService,
  BrainProviderRegistry,
  BrainRouter,
  SessionManager,
  ConversationRuntime,
  VoiceSessionCoordinator
} from '@mave/core';
import type { VoiceRuntimeEvent } from '@mave/contracts';
import {
  MockWakeWordProvider,
  MockAudioInputProvider,
  MockAudioOutput,
  MockBrainProvider,
  MockSTTProvider,
  MockTTSProvider
} from '@mave/providers';
import { WakeManager } from '../src/main/wake-manager.js';
import {
  VoiceManager,
  type MicOwnership
} from '../src/main/voice-manager.js';
import { handleIpcCommand } from '../src/main/ipc.js';

interface HarnessOptions {
  rearmGuardMs?: number;
  settleGuardMs?: number;
  sleep?: (ms: number) => Promise<void>;
  wakeProvider?: MockWakeWordProvider;
  audioInputProvider?: MockAudioInputProvider;
  sttProvider?: MockSTTProvider;
  voiceCoordinator?: VoiceSessionCoordinator;
  sessionTimeoutMs?: number;
  audioOutput?: MockAudioOutput;
  onOwnershipChange?: (ownership: MicOwnership) => void;
  onVoiceRuntimeEvent?: (event: VoiceRuntimeEvent) => void;
}

async function createHarness(options?: HarnessOptions) {
  const mockDb: any = {
    sqlite: {
      exec: vi.fn().mockReturnValue([]),
      run: vi.fn()
    },
    save: vi.fn()
  };

  const service = createMaveService();
  service.start();
  service.send({ type: 'APP_READY' });

  const wakeProvider =
    options?.wakeProvider ?? new MockWakeWordProvider({ status: 'listening' });
  const wakeManager = new WakeManager({
    service,
    database: mockDb,
    provider: wakeProvider
  });
  await wakeManager.initialize();

  const sessionManager = new SessionManager();
  const registry = new BrainProviderRegistry();
  const brainProvider = new MockBrainProvider({
    responseText: 'Hello, I am MAVE voice assistant.'
  });
  registry.register(brainProvider);
  const router = new BrainRouter(registry, { defaultProvider: brainProvider.id });
  const conversationRuntime = new ConversationRuntime({ sessionManager, router });

  const audioInput = options?.audioInputProvider ?? new MockAudioInputProvider();
  const stt = options?.sttProvider ?? new MockSTTProvider();
  const tts = new MockTTSProvider();
  const audioOutput = options?.audioOutput ?? new MockAudioOutput();

  const voiceCoordinator =
    options?.voiceCoordinator ??
    new VoiceSessionCoordinator({
      audioInput,
      stt,
      tts,
      audioOutput,
      conversationRuntime
    });

  const sleep = options?.sleep ?? (async () => {});

  const voiceManager = new VoiceManager({
    service,
    wakeManager,
    voiceCoordinator,
    rearmGuardMs: options?.rearmGuardMs ?? 300,
    settleGuardMs: options?.settleGuardMs ?? 0,
    sessionTimeoutMs: options?.sessionTimeoutMs,
    sleep,
    onOwnershipChange: options?.onOwnershipChange,
    onVoiceRuntimeEvent: options?.onVoiceRuntimeEvent
  });

  return {
    service,
    mockDb,
    wakeProvider,
    wakeManager,
    voiceCoordinator,
    voiceManager,
    audioInput,
    stt,
    tts,
    audioOutput,
    conversationRuntime
  };
}

describe('VoiceManager (M3.5 Wake ↔ Voice Handoff Integration)', () => {
  it('initializes cleanly: starts wake capture and sets ownership to wake', async () => {
    const { voiceManager, wakeProvider, service } = await createHarness();

    await voiceManager.start();

    expect(voiceManager.getState()).toBe('idle');
    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(wakeProvider.getStatus()).toBe('listening');
    expect(service.getSnapshot().state).toBe('sleeping');

    await voiceManager.dispose();
  });

  // Section 25: TEST — SUCCESS HANDOFF
  it('executes successful handoff sequence with strict timing barrier', async () => {
    const order: string[] = [];

    const { voiceManager, wakeManager, wakeProvider, service } = await createHarness({
      onOwnershipChange: (ownership) => {
        order.push(`ownership_${ownership}`);
      },
      onVoiceRuntimeEvent: (event) => {
        if (
          event.type === 'listening_started' ||
          event.type === 'voice_session_completed'
        ) {
          order.push(`voice_${event.type}`);
        }
      }
    });

    const origStop = wakeManager.stop.bind(wakeManager);
    vi.spyOn(wakeManager, 'stop').mockImplementation(async () => {
      order.push('wake_stop_requested');
      await origStop();
      order.push('wake_stop_resolved');
    });

    const origStart = wakeManager.start.bind(wakeManager);
    vi.spyOn(wakeManager, 'start').mockImplementation(async (arg) => {
      order.push('wake_start_requested');
      await origStart(arg);
      order.push('wake_start_resolved');
    });

    await voiceManager.start();
    order.push('wake_running');

    // Trigger wake handoff
    await voiceManager.handleWakeDetected();

    const stopResolvedIndex = order.indexOf('wake_stop_resolved');
    const voiceStartedIndex = order.indexOf('voice_listening_started');
    const voiceCompletedIndex = order.indexOf('voice_voice_session_completed');
    const wakeStartResolvedIndex = order.indexOf('wake_start_resolved');

    expect(stopResolvedIndex).toBeGreaterThan(-1);
    expect(voiceStartedIndex).toBeGreaterThan(stopResolvedIndex);
    expect(voiceCompletedIndex).toBeGreaterThan(voiceStartedIndex);
    expect(wakeStartResolvedIndex).toBeGreaterThan(voiceCompletedIndex);

    // Final state
    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(wakeProvider.getStatus()).toBe('listening');

    await voiceManager.dispose();
  });

  // Section 26: TEST — NO MICROPHONE OVERLAP
  it('strictly enforces no microphone overlap invariant at every millisecond', async () => {
    let wakeActive = false;
    let voiceActive = false;
    let overlapDetected = false;

    const { voiceManager } = await createHarness({
      onOwnershipChange: (ownership) => {
        if (ownership === 'wake') {
          wakeActive = true;
          if (voiceActive) overlapDetected = true;
        } else if (ownership === 'voice') {
          voiceActive = true;
          if (wakeActive) overlapDetected = true;
        } else if (ownership === 'none') {
          wakeActive = false;
          voiceActive = false;
        }
      }
    });

    await voiceManager.start();
    expect(overlapDetected).toBe(false);

    await voiceManager.handleWakeDetected();

    expect(overlapDetected).toBe(false);
    expect(wakeActive).toBe(true);
    expect(voiceActive).toBe(false);

    await voiceManager.dispose();
  });

  // Section 27: TEST — DUPLICATE WAKE
  it('suppresses rapid duplicate wake events deterministically', async () => {
    const sessionStartSpy = vi.fn();

    const { voiceManager } = await createHarness({
      onVoiceRuntimeEvent: (event) => {
        if (event.type === 'voice_session_started') {
          sessionStartSpy();
        }
      }
    });

    await voiceManager.start();

    // Emit 3 rapid wake events concurrently
    const p1 = voiceManager.handleWakeDetected();
    const p2 = voiceManager.handleWakeDetected();
    const p3 = voiceManager.handleWakeDetected();

    await Promise.all([p1, p2, p3]);

    expect(sessionStartSpy).toHaveBeenCalledTimes(1);
    expect(voiceManager.getDuplicateWakeCount()).toBe(2);

    await voiceManager.dispose();
  });

  // Section 28: TEST — VOICE COMPLETED
  it('rearms wake exactly once when voice session completes normally', async () => {
    const { voiceManager, wakeManager, service } = await createHarness();
    await voiceManager.start();

    const startSpy = vi.spyOn(wakeManager, 'start');

    await voiceManager.handleWakeDetected();

    // Exactly 1 rearm start call after voice finishes
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(service.getSnapshot().state).toBe('sleeping');

    await voiceManager.dispose();
  });

  // Section 29: TEST — VOICE CANCELLED
  it('safely rearms wake when voice session is cancelled mid-flight', async () => {
    const { voiceManager, service, wakeProvider } = await createHarness({
      audioInputProvider: new MockAudioInputProvider({ frameDelayMs: 30 })
    });
    await voiceManager.start();

    // Start wake handoff in background
    const handoffPromise = voiceManager.handleWakeDetected();

    // Cancel while active
    setTimeout(() => {
      void voiceManager.cancelActiveVoiceSession('user_pressed_sleep');
    }, 10);

    await handoffPromise;

    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(wakeProvider.getStatus()).toBe('listening');

    await voiceManager.dispose();
  });

  // Section 30: TEST — VOICE FAILED
  it('safely rearms wake without stranding microphone when voice session fails', async () => {
    const failingSTT = new MockSTTProvider({
      failureMode: 'error_event'
    });

    const { voiceManager, service, wakeProvider } = await createHarness({
      sttProvider: failingSTT
    });
    await voiceManager.start();

    await voiceManager.handleWakeDetected();

    // Microphone must not be stranded in 'voice' or disconnected
    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(wakeProvider.getStatus()).toBe('listening');

    await voiceManager.dispose();
  });

  // Section 31: TEST — WAKE STOP FAILURE
  it('never starts voice session if wake manager fails to stop capture', async () => {
    const { voiceManager, wakeManager, voiceCoordinator, service } = await createHarness();
    await voiceManager.start();

    // Mock wake stop to reject
    vi.spyOn(wakeManager, 'stop').mockRejectedValueOnce(
      new Error('Sounddevice stream close failure')
    );
    const voiceStartSpy = vi.spyOn(voiceCoordinator, 'startSession');

    await voiceManager.handleWakeDetected();

    // Voice coordinator was NEVER started!
    expect(voiceStartSpy).not.toHaveBeenCalled();
    expect(voiceManager.getMicOwnership()).not.toBe('voice');
    expect(service.getSnapshot().state).toBe('sleeping');

    await voiceManager.dispose();
  });

  // Section 32: TEST — VOICE START FAILURE
  it('recovers safely and rearms wake if voice coordinator startSession throws', async () => {
    const { voiceManager, voiceCoordinator, service, wakeProvider } = await createHarness();
    await voiceManager.start();

    vi.spyOn(voiceCoordinator, 'startSession').mockImplementationOnce(() => {
      throw new Error('Audio input provider device disconnected');
    });

    await voiceManager.handleWakeDetected();

    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(wakeProvider.getStatus()).toBe('listening');

    await voiceManager.dispose();
  });

  // Section 33: TEST — WAKE REARM FAILURE
  it('reports degraded error state if wake rearm fails after voice session', async () => {
    const { voiceManager, wakeManager, service } = await createHarness();
    await voiceManager.start();

    vi.spyOn(wakeManager, 'start').mockRejectedValueOnce(
      new Error('Microphone device unplugged')
    );

    await voiceManager.handleWakeDetected();

    expect(voiceManager.getMicOwnership()).toBe('none');
    expect(service.getSnapshot().wakeEngineStatus).toBe('error');
    expect(service.getSnapshot().errorMessage).toContain('Microphone device unplugged');

    await voiceManager.dispose();
  });

  // Section 34: TEST — SHUTDOWN
  it('cancels active voice session and does not rearm wake on dispose/shutdown', async () => {
    const { voiceManager, wakeManager, voiceCoordinator } = await createHarness({
      audioInputProvider: new MockAudioInputProvider({ frameDelayMs: 40 })
    });
    await voiceManager.start();

    const stopSessionSpy = vi.spyOn(voiceCoordinator, 'stopSession');
    const wakeStartSpy = vi.spyOn(wakeManager, 'start');

    // Start voice session
    const handoff = voiceManager.handleWakeDetected();

    // Dispose while active
    setTimeout(() => {
      void voiceManager.dispose();
    }, 10);

    await handoff;

    expect(stopSessionSpy).toHaveBeenCalled();
    // Wake must NOT be rearmed when shutting down
    expect(wakeStartSpy).not.toHaveBeenCalled();
    expect(voiceManager.getMicOwnership()).toBe('none');
  });

  // Section 35: TEST — REARM GUARD
  it('guarantees wake engine does not restart before configured rearm guard elapses', async () => {
    let resolveSleep: () => void = () => {};
    const sleepPromise = new Promise<void>((r) => {
      resolveSleep = r;
    });

    const sleepSpy = vi.fn().mockImplementation(() => sleepPromise);

    const { voiceManager, wakeProvider, service } = await createHarness({
      rearmGuardMs: 300,
      sleep: sleepSpy
    });

    await voiceManager.start();
    expect(wakeProvider.getStatus()).toBe('listening');

    // Run handoff
    const handoffPromise = voiceManager.handleWakeDetected();

    // Wait until sleep is called for rearm guard
    await new Promise((r) => setTimeout(r, 20));

    // While rearm guard sleep is pending:
    expect(sleepSpy).toHaveBeenCalledWith(300);
    // Wake must NOT have restarted yet
    expect(voiceManager.getMicOwnership()).toBe('none');
    expect(wakeProvider.getStatus()).toBe('ready');

    // Now resolve the rearm guard timer
    resolveSleep();
    await handoffPromise;

    // Wake restarted after rearm guard resolved
    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(wakeProvider.getStatus()).toBe('listening');
    expect(service.getSnapshot().state).toBe('sleeping');

    await voiceManager.dispose();
  });

  // Section 36: TEST — SIMULATED WAKE
  it('exercises exact same handoff path via mockProvider.simulateWake()', async () => {
    let completedPromiseResolve: () => void = () => {};
    const completedPromise = new Promise<void>((res) => {
      completedPromiseResolve = res;
    });

    const { voiceManager, wakeProvider, service } = await createHarness({
      onVoiceRuntimeEvent: (ev) => {
        if (ev.type === 'voice_session_completed') {
          completedPromiseResolve();
        }
      }
    });

    await voiceManager.start();

    // Simulate wake through provider callback
    wakeProvider.simulateWake(0.95);

    // Await completion
    await completedPromise;
    // Allow rearm to finish
    await new Promise((r) => setTimeout(r, 10));

    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(service.getSnapshot().state).toBe('sleeping');

    await voiceManager.dispose();
  });

  // Section 43: STRESS TEST — 10 CYCLES
  it('executes 10 sequential wake -> voice -> rearm cycles without leakage or corruption', async () => {
    const { voiceManager, service, wakeProvider } = await createHarness();
    await voiceManager.start();

    for (let cycle = 1; cycle <= 10; cycle++) {
      expect(voiceManager.getMicOwnership()).toBe('wake');
      expect(service.getSnapshot().state).toBe('sleeping');

      await voiceManager.handleWakeDetected();

      expect(voiceManager.getMicOwnership()).toBe('wake');
      expect(service.getSnapshot().state).toBe('sleeping');
      expect(wakeProvider.getStatus()).toBe('listening');
    }

    expect(voiceManager.getDuplicateWakeCount()).toBe(0);

    await voiceManager.dispose();
  });

  it('runs complete live-topology loop using ConversationManager runtime', async () => {
    const { createMaveDatabase } = await import('@mave/database');
    const { ConversationManager } = await import('../src/main/conversation-manager.js');

    const db = await createMaveDatabase(':memory:');
    const service = createMaveService();
    service.start();
    service.send({ type: 'APP_READY' });

    const wakeProvider = new MockWakeWordProvider({ status: 'listening' });
    const wakeManager = new WakeManager({
      service,
      database: db,
      provider: wakeProvider
    });
    await wakeManager.initialize();

    const conversationManager = new ConversationManager({
      database: db,
      timeoutMs: 5000
    });

    const voiceManager = new VoiceManager({
      service,
      wakeManager,
      conversationRuntime: conversationManager.getRuntime()
    });
    await voiceManager.start();

    expect(service.getSnapshot().state).toBe('sleeping');
    expect(voiceManager.getMicOwnership()).toBe('wake');

    const statesVisited: string[] = [];
    service.subscribe((snap) => {
      statesVisited.push(snap.state);
    });

    await voiceManager.handleWakeDetected();

    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(wakeProvider.getStatus()).toBe('listening');
    expect(statesVisited).toContain('waking');
    expect(statesVisited).toContain('listening');
    expect(statesVisited).toContain('thinking');
    expect(statesVisited).toContain('speaking');
    expect(statesVisited[statesVisited.length - 1]).toBe('sleeping');

    await voiceManager.dispose();
    await wakeManager.dispose();
    await conversationManager.dispose();
    db.close();
  });

  it('safely recovers and rearms wake when voice session exceeds sessionTimeoutMs', async () => {
    // Harness with high delay audio input to trigger session timeout
    const stalledAudio = new MockAudioInputProvider({
      frameDelayMs: 500
    });

    const { voiceManager, service, wakeProvider } = await createHarness({
      audioInputProvider: stalledAudio,
      sessionTimeoutMs: 50
    });

    await voiceManager.start();

    expect(service.getSnapshot().state).toBe('sleeping');
    expect(voiceManager.getMicOwnership()).toBe('wake');

    // Trigger wake handoff which will exceed 50ms timeout
    await voiceManager.handleWakeDetected();

    // Must safely abort session and return to sleeping + wake listening
    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(wakeProvider.getStatus()).toBe('listening');

    await voiceManager.dispose();
  });

  it('handles barge-in interruption while speaking: yields immediately, transitions to listening, does not rearm wake mid-session', async () => {
    const sttProvider = new MockSTTProvider({
      finalTexts: ['First query before barge-in', 'Second query after barge-in']
    });
    const audioOutput = new MockAudioOutput({
      frameDelayMs: 25
    });

    let interruptedTriggered = false;
    let ownershipDuringInterruption: MicOwnership | null = null;
    let wakeStatusDuringInterruption: string | null = null;
    let wakeListeningDuringInterruption: boolean | null = null;
    let macroStateDuringInterruption: string | null = null;

    const { voiceManager, service, wakeManager, wakeProvider } = await createHarness({
      sttProvider,
      audioOutput,
      onVoiceRuntimeEvent: (event) => {
        if (event.type === 'speaking_started' && !interruptedTriggered) {
          interruptedTriggered = true;
          setTimeout(async () => {
            const ok = await voiceManager.interrupt({ reason: 'user_spoke_during_playback' });
            expect(ok).toBe(true);

            ownershipDuringInterruption = voiceManager.getMicOwnership();
            wakeStatusDuringInterruption = wakeProvider.getStatus();
            wakeListeningDuringInterruption = wakeManager.isListening();
            macroStateDuringInterruption = service.getSnapshot().state;
          }, 5);
        }
      }
    });

    await voiceManager.start();
    expect(voiceManager.getMicOwnership()).toBe('wake');

    // Trigger wake handoff
    await voiceManager.handleWakeDetected();

    // Verify barge-in occurred
    expect(interruptedTriggered).toBe(true);

    // Verify invariant: during barge-in, mic ownership was still 'voice' and wake engine was NOT rearmed!
    expect(ownershipDuringInterruption).toBe('voice');
    expect(wakeStatusDuringInterruption).toBe('ready');
    expect(wakeListeningDuringInterruption).toBe(false);
    expect(macroStateDuringInterruption).toBe('listening');

    // After session finished normally, wake was safely rearmed and macro state returned to sleeping
    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(service.getSnapshot().state).toBe('sleeping');
    expect(wakeProvider.getStatus()).toBe('listening');

    await voiceManager.dispose();
  });

  it('triggers barge-in interruption via IPC interrupt command', async () => {
    const sttProvider = new MockSTTProvider({
      finalTexts: ['Command one', 'Command two']
    });
    const audioOutput = new MockAudioOutput({
      frameDelayMs: 25
    });

    let ipcTriggered = false;

    const { voiceManager, service, wakeManager, wakeProvider } = await createHarness({
      sttProvider,
      audioOutput,
      onVoiceRuntimeEvent: (event) => {
        if (event.type === 'speaking_started' && !ipcTriggered) {
          ipcTriggered = true;
          setTimeout(async () => {
            const res = await handleIpcCommand({ command: 'interrupt' }, service, wakeManager, voiceManager);
            expect(res.success).toBe(true);
            expect(service.getSnapshot().state).toBe('listening');
          }, 5);
        }
      }
    });

    await voiceManager.start();
    await voiceManager.handleWakeDetected();

    expect(ipcTriggered).toBe(true);
    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(service.getSnapshot().state).toBe('sleeping');

    await voiceManager.dispose();
  });
});
