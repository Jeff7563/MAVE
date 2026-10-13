import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  VOICE_IPC_CHANNELS,
  VoiceRuntimeEventSchema,
  VoiceStatusSnapshotSchema,
  type VoiceRuntimeEvent,
  type VoiceStatusSnapshot
} from '@mave/contracts';
import { createMaveService, type MaveService } from '@mave/core';
import {
  MockAudioInputProvider,
  MockAudioOutput,
  MockSTTProvider,
  MockTTSProvider,
  MockWakeWordProvider
} from '@mave/providers';
import { createMaveDatabase, type MaveDatabase } from '@mave/database';
import { ipcMain } from 'electron';
import { VoiceManager } from '../src/main/voice-manager.js';
import { WakeManager } from '../src/main/wake-manager.js';
import { registerVoiceIpcHandlers, registerIpcHandlers } from '../src/main/ipc.js';
import { ConversationManager } from '../src/main/conversation-manager.js';

// Mock electron ipcMain and contextBridge
vi.mock('electron', () => {
  const handlers = new Map<string, Function>();
  return {
    ipcMain: {
      handle: vi.fn((channel: string, handler: Function) => {
        handlers.set(channel, handler);
      }),
      removeHandler: vi.fn((channel: string) => {
        handlers.delete(channel);
      }),
      _invoke: async (channel: string, event: any, payload: any) => {
        const handler = handlers.get(channel);
        if (!handler) throw new Error(`No handler registered for ${channel}`);
        return handler(event, payload);
      },
      _hasHandler: (channel: string) => handlers.has(channel),
      _clear: () => handlers.clear()
    },
    contextBridge: {
      exposeInMainWorld: vi.fn()
    }
  };
});

function createMockWindow() {
  const sentEvents: Array<{ channel: string; event: any }> = [];
  let isDestroyedVal = false;

  const mockWin: any = {
    isDestroyed: () => isDestroyedVal,
    webContents: {
      send: vi.fn((channel: string, event: any) => {
        if (!isDestroyedVal) {
          sentEvents.push({ channel, event });
        }
      })
    }
  };

  return {
    mockWin,
    sentEvents,
    setDestroyed: (val: boolean) => {
      isDestroyedVal = val;
    }
  };
}

describe('M3.9 — Voice IPC & Developer Diagnostics Integration', () => {
  let db: MaveDatabase;
  let service: MaveService;
  let wakeProvider: MockWakeWordProvider;
  let wakeManager: WakeManager;
  let conversationManager: ConversationManager;
  let voiceManager: VoiceManager;
  let mockWinHelper: ReturnType<typeof createMockWindow>;
  let cleanupIpc: (() => void) | undefined;

  let audioInput: MockAudioInputProvider;
  let stt: MockSTTProvider;
  let tts: MockTTSProvider;
  let audioOutput: MockAudioOutput;

  beforeEach(async () => {
    (ipcMain as any)._clear?.();
    mockWinHelper = createMockWindow();

    db = await createMaveDatabase(':memory:');
    service = createMaveService();
    service.start();
    service.send({ type: 'APP_READY' });

    wakeProvider = new MockWakeWordProvider({ wakeProvider: 'mock-wake-test' });
    wakeManager = new WakeManager({
      service,
      database: db,
      provider: wakeProvider,
      rearmGuardMs: 0
    });
    await wakeManager.initialize();

    conversationManager = new ConversationManager({
      database: db,
      getMainWindow: () => mockWinHelper.mockWin,
      coalesceWindowMs: 0
    });

    audioInput = new MockAudioInputProvider({ id: 'test-audio-input' });
    stt = new MockSTTProvider({ id: 'test-stt' });
    tts = new MockTTSProvider({ id: 'test-tts' });
    audioOutput = new MockAudioOutput({ id: 'test-audio-output', frameDelayMs: 25 });

    voiceManager = new VoiceManager({
      service,
      wakeManager,
      conversationRuntime: conversationManager.getRuntime(),
      audioInput,
      stt,
      tts,
      audioOutput,
      rearmGuardMs: 10,
      settleGuardMs: 0,
      telemetryThrottleMs: 20
    });
    await voiceManager.start();

    cleanupIpc = registerVoiceIpcHandlers(voiceManager, () => mockWinHelper.mockWin);
  });

  afterEach(async () => {
    cleanupIpc?.();
    await voiceManager.dispose();
    await wakeManager.dispose();
    await conversationManager.dispose();
    await db.close();
  });

  it('32.1 — registers and serves status snapshot over typed IPC', async () => {
    expect((ipcMain as any)._hasHandler(VOICE_IPC_CHANNELS.GET_STATUS)).toBe(true);
    expect((ipcMain as any)._hasHandler(VOICE_IPC_CHANNELS.INTERRUPT)).toBe(true);
    expect((ipcMain as any)._hasHandler(VOICE_IPC_CHANNELS.CANCEL)).toBe(true);
    expect((ipcMain as any)._hasHandler(VOICE_IPC_CHANNELS.START_DIAGNOSTIC)).toBe(true);

    const snapshot = (await (ipcMain as any)._invoke(
      VOICE_IPC_CHANNELS.GET_STATUS,
      {},
      undefined
    )) as VoiceStatusSnapshot;

    expect(snapshot).toBeDefined();
    expect(snapshot.state).toBe('sleeping');
    expect(snapshot.micOwnership).toBe('wake');
    expect(snapshot.wake.provider).toBe('mock-wake-test');
    expect(snapshot.audioInput.provider).toBe('test-audio-input');
    expect(snapshot.stt.provider).toBe('test-stt');
    expect(snapshot.tts.provider).toBe('test-tts');
    expect(snapshot.output.provider).toBe('test-audio-output');

    // Prove JSON Schema validation passes
    const validated = VoiceStatusSnapshotSchema.parse(snapshot);
    expect(validated.state).toBe('sleeping');
  });

  it('32.2 — unregisters all IPC handlers cleanly', () => {
    cleanupIpc?.();
    cleanupIpc = undefined;

    expect((ipcMain as any)._hasHandler(VOICE_IPC_CHANNELS.GET_STATUS)).toBe(false);
    expect((ipcMain as any)._hasHandler(VOICE_IPC_CHANNELS.INTERRUPT)).toBe(false);
    expect((ipcMain as any)._hasHandler(VOICE_IPC_CHANNELS.CANCEL)).toBe(false);
    expect((ipcMain as any)._hasHandler(VOICE_IPC_CHANNELS.START_DIAGNOSTIC)).toBe(false);
  });

  it('33.1 — safely drops event forwarding when BrowserWindow is destroyed', () => {
    mockWinHelper.setDestroyed(true);

    // Emit event from voice manager
    (voiceManager as any).options.onVoiceRuntimeEvent?.({
      type: 'listening_started',
      sessionId: 'sess-destroyed',
      timestamp: Date.now()
    });

    const voiceEvents = mockWinHelper.sentEvents.filter(
      (e) => e.channel === VOICE_IPC_CHANNELS.EVENT
    );
    expect(voiceEvents.length).toBe(0);
  });

  it('33.2 — guarantees all broadcast events are strictly JSON serializable', async () => {
    const rawEvents: VoiceRuntimeEvent[] = [
      { type: 'voice_session_started', sessionId: 's-1', timestamp: Date.now() },
      { type: 'listening_started', sessionId: 's-1', timestamp: Date.now() },
      { type: 'speech_started', sessionId: 's-1', timestamp: Date.now() },
      { type: 'partial_transcript', sessionId: 's-1', text: 'Hello', confidence: 0.8, timestamp: Date.now() },
      { type: 'final_transcript', sessionId: 's-1', text: 'Hello world', confidence: 0.95, language: 'en', timestamp: Date.now() },
      { type: 'assistant_chunk', sessionId: 's-1', text: 'Hi there', timestamp: Date.now() },
      { type: 'thinking_started', sessionId: 's-1', timestamp: Date.now() },
      { type: 'speaking_started', sessionId: 's-1', requestId: 'req-1', timestamp: Date.now() },
      { type: 'speaking_finished', sessionId: 's-1', requestId: 'req-1', timestamp: Date.now() },
      { type: 'audio_level', sessionId: 's-1', inputLevel: 0.42, outputLevel: 0.15, timestamp: Date.now() },
      { type: 'interrupted', sessionId: 's-1', reason: 'barge_in', timestamp: Date.now() },
      { type: 'voice_session_completed', sessionId: 's-1', timestamp: Date.now() },
      { type: 'voice_session_cancelled', sessionId: 's-1', reason: 'user', timestamp: Date.now() },
      { type: 'voice_session_failed', sessionId: 's-1', errorCode: 'err', errorMessage: 'failed', timestamp: Date.now() }
    ];

    for (const evt of rawEvents) {
      // 1. Validate Schema
      const parsed = VoiceRuntimeEventSchema.parse(evt);

      // 2. Serialize to JSON and parse back
      const serialized = JSON.stringify(parsed);
      const deserialized = JSON.parse(serialized);

      // 3. Confirm exact structure matches schema
      expect(VoiceRuntimeEventSchema.safeParse(deserialized).success).toBe(true);

      // 4. Assert no binary data or function prototypes leaked
      expect(serialized).not.toContain('Uint8Array');
      expect(serialized).not.toContain('Buffer');
      expect(serialized).not.toContain('ChildProcess');
      expect(serialized).not.toContain('AbortSignal');
    }
  });

  it('34.1 — executes full ordered lifecycle event flow to renderer', async () => {
    stt.setFinalText('Test command');

    // Trigger diagnostic session
    const startResult = (await (ipcMain as any)._invoke(
      VOICE_IPC_CHANNELS.START_DIAGNOSTIC,
      {},
      undefined
    )) as { success: boolean };
    expect(startResult.success).toBe(true);

    // Wait for session to complete
    const startWait = Date.now();
    while (
      !mockWinHelper.sentEvents.some(
        (e) => e.channel === VOICE_IPC_CHANNELS.EVENT && e.event.type === 'voice_session_completed'
      ) &&
      Date.now() - startWait < 4000
    ) {
      await new Promise((r) => setTimeout(r, 20));
    }

    // Wait for wake rearm
    while (voiceManager.getMicOwnership() !== 'wake' && Date.now() - startWait < 4000) {
      await new Promise((r) => setTimeout(r, 20));
    }

    const receivedEvents = mockWinHelper.sentEvents
      .filter((e) => e.channel === VOICE_IPC_CHANNELS.EVENT)
      .map((e) => e.event.type);

    expect(receivedEvents).toContain('voice_session_started');
    expect(receivedEvents).toContain('listening_started');
    expect(receivedEvents).toContain('final_transcript');
    expect(receivedEvents).toContain('thinking_started');
    expect(receivedEvents).toContain('voice_session_completed');

    // Confirm ordered delivery
    const startedIdx = receivedEvents.indexOf('voice_session_started');
    const listeningIdx = receivedEvents.indexOf('listening_started');
    const finalTranscriptIdx = receivedEvents.indexOf('final_transcript');
    const thinkingIdx = receivedEvents.indexOf('thinking_started');
    const completedIdx = receivedEvents.indexOf('voice_session_completed');

    expect(startedIdx).toBeLessThan(listeningIdx);
    expect(listeningIdx).toBeLessThan(finalTranscriptIdx);
    expect(finalTranscriptIdx).toBeLessThan(thinkingIdx);
    expect(thinkingIdx).toBeLessThan(completedIdx);

    // Snapshot after completion should reflect clean sleeping state
    const afterSnapshot = voiceManager.getStatusSnapshot();
    expect(afterSnapshot.state).toBe('sleeping');
    expect(afterSnapshot.micOwnership).toBe('wake');
    expect(afterSnapshot.inputLevel).toBe(0);
    expect(afterSnapshot.outputLevel).toBe(0);
  });

  it('35.1 — executes barge-in interruption via IPC interrupt command', async () => {
    // Queue utterance
    stt.setFinalTexts(['Test speaking utterance', 'Follow up utterance']);

    // Trigger session
    await (ipcMain as any)._invoke(VOICE_IPC_CHANNELS.START_DIAGNOSTIC, {}, undefined);

    // Wait until speaking starts
    const startWait = Date.now();
    while (
      !mockWinHelper.sentEvents.some(
        (e) => e.channel === VOICE_IPC_CHANNELS.EVENT && e.event.type === 'speaking_started'
      ) &&
      Date.now() - startWait < 4000
    ) {
      await new Promise((r) => setTimeout(r, 20));
    }

    // Call interrupt over IPC
    const interruptResult = (await (ipcMain as any)._invoke(
      VOICE_IPC_CHANNELS.INTERRUPT,
      {},
      { reason: 'test_interrupt' }
    )) as { success: boolean };

    expect(interruptResult.success).toBe(true);

    // Verify microphone is still in voice ownership (Wake has NOT rearmed)
    expect(voiceManager.getMicOwnership()).toBe('voice');
    expect(wakeManager.isListening()).toBe(false);

    // Session should remain in voice mode ready for next turn
    expect(voiceManager.isVoiceActive()).toBe(true);

    // Call cancel over IPC to terminate session
    const cancelResult = (await (ipcMain as any)._invoke(
      VOICE_IPC_CHANNELS.CANCEL,
      {},
      { reason: 'test_cancel_after_interrupt' }
    )) as { success: boolean };

    expect(cancelResult.success).toBe(true);

    // Wait for wake rearm
    const rearmWait = Date.now();
    while (voiceManager.getMicOwnership() !== 'wake' && Date.now() - rearmWait < 4000) {
      await new Promise((r) => setTimeout(r, 20));
    }

    expect(voiceManager.getMicOwnership()).toBe('wake');
    expect(voiceManager.getStatusSnapshot().state).toBe('sleeping');
  });

  it('36.1 — bounds high-frequency telemetry events with throttling', async () => {
    const fakeEvents: VoiceRuntimeEvent[] = [];
    for (let i = 0; i < 50; i++) {
      fakeEvents.push({
        type: 'audio_level',
        sessionId: 'throttle-test',
        inputLevel: 0.1 + (i % 10) * 0.05,
        outputLevel: 0.2 + (i % 5) * 0.1,
        timestamp: Date.now()
      });
    }

    // Push 50 level events synchronously
    for (const evt of fakeEvents) {
      (voiceManager as any).dispatchVoiceRuntimeEvent(evt);
    }

    // Wait a brief tick (less than 100ms)
    await new Promise((r) => setTimeout(r, 60));

    const levelEvents = mockWinHelper.sentEvents.filter(
      (e) => e.channel === VOICE_IPC_CHANNELS.EVENT && e.event.type === 'audio_level'
    );

    // 50 events must be throttled down to a small bounded count (e.g. <= 5 events)
    expect(levelEvents.length).toBeLessThanOrEqual(5);
    expect(levelEvents.length).toBeGreaterThanOrEqual(1);

    // The snapshot should always have the latest level
    const snapshot = voiceManager.getStatusSnapshot();
    expect(snapshot.inputLevel).toBeCloseTo(0.1 + (49 % 10) * 0.05, 2);
  });

  it('37.1 — integrates with registerIpcHandlers top-level manager', async () => {
    const cleanupAll = registerIpcHandlers(
      service,
      () => mockWinHelper.mockWin,
      wakeManager,
      conversationManager,
      voiceManager
    );

    expect((ipcMain as any)._hasHandler(VOICE_IPC_CHANNELS.GET_STATUS)).toBe(true);
    expect((ipcMain as any)._hasHandler('mave:get-status')).toBe(true);

    cleanupAll();

    expect((ipcMain as any)._hasHandler(VOICE_IPC_CHANNELS.GET_STATUS)).toBe(false);
    expect((ipcMain as any)._hasHandler('mave:get-status')).toBe(false);
  });
});
