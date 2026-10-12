import { contextBridge, ipcRenderer } from 'electron';
import type { AssistantStateSnapshot, MaveCommand } from '@mave/contracts';

export interface MaveApi {
  getStatus: () => Promise<AssistantStateSnapshot>;
  sendCommand: (
    command: MaveCommand,
    payload?: Record<string, unknown>
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  onStateChanged: (callback: (snapshot: AssistantStateSnapshot) => void) => () => void;
}

const api: MaveApi = {
  getStatus: async () => {
    return (await ipcRenderer.invoke('mave:get-status')) as AssistantStateSnapshot;
  },
  sendCommand: async (command, payload) => {
    return (await ipcRenderer.invoke('mave:send-command', {
      command,
      payload
    })) as { success: boolean; data?: unknown; error?: string };
  },
  onStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: AssistantStateSnapshot) => {
      callback(snapshot);
    };
    ipcRenderer.on('mave:state-changed', listener);
    return () => {
      ipcRenderer.removeListener('mave:state-changed', listener);
    };
  }
};

contextBridge.exposeInMainWorld('mave', api);
