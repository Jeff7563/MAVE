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

  it('validates and executes simulate-wake command', () => {
    const result = handleIpcCommand({ command: 'simulate-wake' }, mockService);

    expect(result.success).toBe(true);
    expect(mockService.send).toHaveBeenCalledWith({ type: 'WAKE_DETECTED' });
  });

  it('validates and executes return-to-sleep command', () => {
    const result = handleIpcCommand({ command: 'return-to-sleep' }, mockService);

    expect(result.success).toBe(true);
    expect(mockService.send).toHaveBeenCalledWith({ type: 'SLEEP_REQUESTED' });
  });

  it('validates and executes toggle-mute command', () => {
    const result = handleIpcCommand({ command: 'toggle-mute' }, mockService);

    expect(result.success).toBe(true);
    expect(mockService.send).toHaveBeenCalledWith({ type: 'TOGGLE_MUTE' });
  });

  it('rejects invalid command payloads', () => {
    const result = handleIpcCommand({ command: 'unknown-command' }, mockService);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Invalid command payload');
  });

  it('rejects null or non-object payloads', () => {
    const result = handleIpcCommand(null, mockService);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
