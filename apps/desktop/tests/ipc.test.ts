import { describe, it, expect, vi } from 'vitest';
import { handleIpcCommand } from '../src/main/ipc.js';
import type { MaveService } from '@mave/core';

describe('Desktop IPC Command Handler', () => {
  const mockService: MaveService = {
    start: vi.fn(),
    stop: vi.fn(),
    send: vi.fn(),
    getSnapshot: vi.fn().mockReturnValue({
      state: 'sleeping',
      wakeEngineStatus: 'not_configured',
      aiStatus: 'offline',
      databaseStatus: 'ready',
      isMuted: false,
      mode: 'conversation',
      lastActiveAt: Date.now()
    }),
    subscribe: vi.fn().mockReturnValue(() => {})
  };

  it('validates and executes simulate-wake command', async () => {
    const result = await handleIpcCommand({ command: 'simulate-wake' }, mockService);

    expect(result.success).toBe(true);
    expect(mockService.send).toHaveBeenCalledWith({ type: 'WAKE_DETECTED' });
  });

  it('validates and executes return-to-sleep command', async () => {
    const result = await handleIpcCommand({ command: 'return-to-sleep' }, mockService);

    expect(result.success).toBe(true);
    expect(mockService.send).toHaveBeenCalledWith({ type: 'SLEEP_REQUESTED' });
  });

  it('validates and executes toggle-mute command', async () => {
    const result = await handleIpcCommand({ command: 'toggle-mute' }, mockService);

    expect(result.success).toBe(true);
    expect(mockService.send).toHaveBeenCalledWith({ type: 'TOGGLE_MUTE' });
  });

  it('rejects invalid command payloads', async () => {
    const result = await handleIpcCommand({ command: 'unknown-command' as any }, mockService);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Invalid command payload');
  });

  it('rejects null or non-object payloads', async () => {
    const result = await handleIpcCommand(null, mockService);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles wake-specific commands with wakeManager', async () => {
    const mockWakeManager: any = {
      restart: vi.fn().mockResolvedValue(undefined),
      setMicrophone: vi.fn().mockResolvedValue(undefined),
      setSensitivity: vi.fn().mockResolvedValue(undefined),
      setThreshold: vi.fn().mockResolvedValue(undefined),
      testAudioFile: vi.fn().mockResolvedValue({
        path: 'test.wav',
        maxScore: 0.9,
        wakeDetected: true,
        framesProcessed: 5
      }),
      getProvider: vi.fn().mockReturnValue({})
    };

    const restartRes = await handleIpcCommand(
      { command: 'restart-wake-engine' },
      mockService,
      mockWakeManager
    );
    expect(restartRes.success).toBe(true);
    expect(mockWakeManager.restart).toHaveBeenCalled();

    const setMicRes = await handleIpcCommand(
      { command: 'set-microphone', payload: { index: 2 } },
      mockService,
      mockWakeManager
    );
    expect(setMicRes.success).toBe(true);
    expect(mockWakeManager.setMicrophone).toHaveBeenCalledWith(2);

    const setSensRes = await handleIpcCommand(
      { command: 'set-sensitivity', payload: { sensitivity: 0.8 } },
      mockService,
      mockWakeManager
    );
    expect(setSensRes.success).toBe(true);
    expect(mockWakeManager.setThreshold).toHaveBeenCalledWith(0.8);

    const setThreshRes = await handleIpcCommand(
      { command: 'set-sensitivity', payload: { threshold: 0.6 } },
      mockService,
      mockWakeManager
    );
    expect(setThreshRes.success).toBe(true);
    expect(mockWakeManager.setThreshold).toHaveBeenCalledWith(0.6);

    const testAudioRes = await handleIpcCommand(
      { command: 'test-audio-file', payload: { path: 'test.wav' } },
      mockService,
      mockWakeManager
    );
    expect(testAudioRes.success).toBe(true);
    expect(mockWakeManager.testAudioFile).toHaveBeenCalledWith('test.wav');
    expect((testAudioRes.data as any).wakeDetected).toBe(true);
  });
});
