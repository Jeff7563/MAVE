import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { SURFACE_IPC_CHANNELS } from '@mave/contracts';

const exposedApis: Record<string, any> = {};
const mockIpcInvoke = vi.fn();
const mockIpcOn = vi.fn();
const mockIpcRemoveListener = vi.fn();

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn((key: string, api: any) => {
      exposedApis[key] = api;
    })
  },
  ipcRenderer: {
    invoke: (...args: any[]) => mockIpcInvoke(...args),
    on: (...args: any[]) => mockIpcOn(...args),
    removeListener: (...args: any[]) => mockIpcRemoveListener(...args)
  }
}));

describe('Dedicated Surface Preload Least-Privilege Verification', () => {
  beforeAll(async () => {
    // Import preload once to trigger exposeInMainWorld
    await import('../src/preload/surface-preload.js');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes strictly window.mave.surface with no developer window capabilities', () => {
    expect(exposedApis['mave']).toBeDefined();
    expect(Object.keys(exposedApis['mave'])).toEqual(['surface']);

    const surface = exposedApis['mave'].surface;
    expect(surface).toBeDefined();

    // Verify privileged APIs are strictly absent
    expect(exposedApis['mave'].chat).toBeUndefined();
    expect(exposedApis['mave'].voice).toBeUndefined();
    expect(exposedApis['mave'].sendCommand).toBeUndefined();
    expect(exposedApis['mave'].getStatus).toBeUndefined();
    expect(exposedApis['mave'].ipcRenderer).toBeUndefined();
    expect(exposedApis['mave'].process).toBeUndefined();
  });

  it('provides surface.getSnapshot via dedicated IPC channel', async () => {
    const mockSnapshot = {
      state: 'ambient',
      interactionMode: 'passive',
      focusIntent: 'preserve',
      displayMode: 'capsule'
    };
    mockIpcInvoke.mockResolvedValueOnce(mockSnapshot);

    const surface = exposedApis['mave'].surface;
    const snapshot = await surface.getSnapshot();

    expect(mockIpcInvoke).toHaveBeenCalledWith(SURFACE_IPC_CHANNELS.GET_SNAPSHOT);
    expect(snapshot).toEqual(mockSnapshot);
  });

  it('provides surface.dispatchAction via dedicated IPC channel', async () => {
    mockIpcInvoke.mockResolvedValueOnce({ success: true });

    const surface = exposedApis['mave'].surface;
    const result = await surface.dispatchAction({
      type: 'request_focus',
      origin: 'user'
    });

    expect(mockIpcInvoke).toHaveBeenCalledWith(SURFACE_IPC_CHANNELS.DISPATCH_ACTION, {
      type: 'request_focus',
      origin: 'user'
    });
    expect(result).toEqual({ success: true });
  });

  it('provides surface.reportInteractiveHover via dedicated IPC channel', async () => {
    mockIpcInvoke.mockResolvedValueOnce(undefined);

    const surface = exposedApis['mave'].surface;
    await surface.reportInteractiveHover(true);

    expect(mockIpcInvoke).toHaveBeenCalledWith('mave:surface:report-hover', true);
  });

  it('manages surface.subscribe and unsubscription cleanly', () => {
    const surface = exposedApis['mave'].surface;
    const listener = vi.fn();

    const unsubscribe = surface.subscribe(listener);
    expect(mockIpcOn).toHaveBeenCalledWith(SURFACE_IPC_CHANNELS.EVENT, expect.any(Function));

    const registeredHandler = mockIpcOn.mock.calls[0]![1];
    const dummyEvent = {
      type: 'SNAPSHOT_UPDATED',
      payload: { state: 'ambient' },
      timestamp: Date.now()
    };
    registeredHandler({}, dummyEvent);
    expect(listener).toHaveBeenCalledWith(dummyEvent);

    unsubscribe();
    expect(mockIpcRemoveListener).toHaveBeenCalledWith(SURFACE_IPC_CHANNELS.EVENT, registeredHandler);
  });

  it('strictly omits getDiagnostics for least privilege (belongs in developer window)', () => {
    const surface = exposedApis['mave'].surface;
    expect(surface.getDiagnostics).toBeUndefined();
  });
});

