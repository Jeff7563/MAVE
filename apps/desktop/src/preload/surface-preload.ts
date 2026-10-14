import { contextBridge, ipcRenderer } from 'electron';
import {
  SURFACE_IPC_CHANNELS,
  type SurfaceSnapshot,
  type SurfaceEvent,
  type SurfaceAction
} from '@mave/contracts';

export interface MaveSurfaceApi {
  getSnapshot: () => Promise<SurfaceSnapshot>;
  subscribe: (callback: (event: SurfaceEvent) => void) => () => void;
  dispatchAction: (action: SurfaceAction) => Promise<{ success: boolean; error?: string }>;
  reportInteractiveHover: (isHovering: boolean) => Promise<void>;
  getDiagnostics?: () => Promise<unknown>;
}

const surfaceApi: MaveSurfaceApi = {
  getSnapshot: async () => {
    return (await ipcRenderer.invoke(SURFACE_IPC_CHANNELS.GET_SNAPSHOT)) as SurfaceSnapshot;
  },
  subscribe: (callback: (event: SurfaceEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, surfaceEvent: SurfaceEvent) => {
      callback(surfaceEvent);
    };
    ipcRenderer.on(SURFACE_IPC_CHANNELS.EVENT, listener);
    return () => {
      ipcRenderer.removeListener(SURFACE_IPC_CHANNELS.EVENT, listener);
    };
  },
  dispatchAction: async (action: SurfaceAction) => {
    return (await ipcRenderer.invoke(SURFACE_IPC_CHANNELS.DISPATCH_ACTION, action)) as {
      success: boolean;
      error?: string;
    };
  },
  reportInteractiveHover: async (isHovering: boolean) => {
    await ipcRenderer.invoke('mave:surface:report-hover', isHovering);
  },
  getDiagnostics: async () => {
    return await ipcRenderer.invoke('mave:surface:get-diagnostics');
  }
};

/**
 * Dedicated Minimal Surface Preload.
 *
 * Enforces strict least privilege natively at the BrowserWindow boundary:
 * Exposes ONLY `window.mave.surface`.
 *
 * Strictly omits:
 * - window.mave.chat
 * - window.mave.voice
 * - window.mave.sendCommand
 * - window.mave.getStatus
 * - raw ipcRenderer
 * - Node process / filesystem APIs
 */
contextBridge.exposeInMainWorld('mave', {
  surface: surfaceApi
});

