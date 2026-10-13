import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SURFACE_IPC_CHANNELS } from '@mave/contracts';
import { SurfaceStateController } from '@mave/core';
import { registerSurfaceIpcHandlers } from '../src/main/surface/surface-ipc.js';
import type { SurfaceWindowManager } from '../src/main/surface/surface-window-manager.js';

// Mock electron ipcMain
const ipcHandlers = new Map<string, Function>();

vi.mock('electron', () => {
  return {
    ipcMain: {
      handle: vi.fn((channel: string, handler: Function) => {
        ipcHandlers.set(channel, handler);
      }),
      removeHandler: vi.fn((channel: string) => {
        ipcHandlers.delete(channel);
      }),
      _invoke: async (channel: string, event: any, payload: any) => {
        const handler = ipcHandlers.get(channel);
        if (!handler) throw new Error(`No handler registered for ${channel}`);
        return handler(event, payload);
      }
    }
  };
});

describe('Surface IPC Handlers', () => {
  let controller: SurfaceStateController;
  let mockManager: any;
  let unregister: () => void;

  beforeEach(() => {
    ipcHandlers.clear();
    controller = new SurfaceStateController();

    mockManager = {
      dispatchAction: vi.fn((action) => {
        controller.dispatchAction(action);
        return { success: true };
      }),
      reportInteractiveHover: vi.fn(),
      getDiagnostics: vi.fn().mockReturnValue({
        created: true,
        visible: false,
        bounds: { x: 1624, y: 944, width: 280, height: 80 }
      })
    };

    unregister = registerSurfaceIpcHandlers(controller, mockManager as unknown as SurfaceWindowManager);
  });

  afterEach(() => {
    unregister();
  });

  it('handles GET_SNAPSHOT and returns latest SurfaceSnapshot', async () => {
    const handler = ipcHandlers.get(SURFACE_IPC_CHANNELS.GET_SNAPSHOT);
    expect(handler).toBeDefined();

    const snapshot = await handler!({}, undefined);
    expect(snapshot.version).toBe(1);
    expect(snapshot.mode).toBe('ambient');
  });

  it('validates and dispatches valid SurfaceActions via DISPATCH_ACTION', async () => {
    const handler = ipcHandlers.get(SURFACE_IPC_CHANNELS.DISPATCH_ACTION);
    expect(handler).toBeDefined();

    const result = await handler!({}, { type: 'expand', origin: 'user' });
    expect(result.success).toBe(true);
    expect(mockManager.dispatchAction).toHaveBeenCalledWith({
      type: 'expand',
      origin: 'user'
    });
  });

  it('rejects invalid SurfaceAction payloads gracefully', async () => {
    const handler = ipcHandlers.get(SURFACE_IPC_CHANNELS.DISPATCH_ACTION);
    expect(handler).toBeDefined();

    const result = await handler!({}, { type: 'invalid_action_type' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid SurfaceAction');
    expect(mockManager.dispatchAction).not.toHaveBeenCalled();
  });

  it('handles report-hover for hit-region click-through coordination', async () => {
    const handler = ipcHandlers.get('mave:surface:report-hover');
    expect(handler).toBeDefined();

    const result = await handler!({}, true);
    expect(result.success).toBe(true);
    expect(mockManager.reportInteractiveHover).toHaveBeenCalledWith(true);
  });

  it('handles get-diagnostics telemetry', async () => {
    const handler = ipcHandlers.get('mave:surface:get-diagnostics');
    expect(handler).toBeDefined();

    const diag = await handler!({}, undefined);
    expect(diag.created).toBe(true);
    expect(diag.bounds.width).toBe(280);
  });

  it('unregisters all surface IPC handlers on cleanup', () => {
    unregister();
    expect(ipcHandlers.has(SURFACE_IPC_CHANNELS.GET_SNAPSHOT)).toBe(false);
    expect(ipcHandlers.has(SURFACE_IPC_CHANNELS.DISPATCH_ACTION)).toBe(false);
    expect(ipcHandlers.has('mave:surface:report-hover')).toBe(false);
    expect(ipcHandlers.has('mave:surface:get-diagnostics')).toBe(false);
  });
});
