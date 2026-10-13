import { contextBridge, ipcRenderer } from 'electron';
import {
  CHAT_IPC_CHANNELS,
  type AssistantStateSnapshot,
  type ChatCancelResponse,
  type ChatLoadSessionResponse,
  type ChatSendRequest,
  type ChatSendResponse,
  type ConversationRuntimeEvent,
  type MaveCommand
} from '@mave/contracts';

export interface MaveChatApi {
  send: (request: ChatSendRequest) => Promise<ChatSendResponse>;
  cancel: (requestId: string) => Promise<ChatCancelResponse>;
  onEvent: (callback: (event: ConversationRuntimeEvent) => void) => () => void;
  loadSession?: (sessionId: string) => Promise<ChatLoadSessionResponse>;
}

export interface MaveApi {
  getStatus: () => Promise<AssistantStateSnapshot>;
  sendCommand: (
    command: MaveCommand,
    payload?: Record<string, unknown>
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  onStateChanged: (callback: (snapshot: AssistantStateSnapshot) => void) => () => void;
  chat: MaveChatApi;
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
  },
  chat: {
    send: async (request: ChatSendRequest) => {
      return (await ipcRenderer.invoke(CHAT_IPC_CHANNELS.SEND, request)) as ChatSendResponse;
    },
    cancel: async (requestId: string) => {
      return (await ipcRenderer.invoke(CHAT_IPC_CHANNELS.CANCEL, { requestId })) as ChatCancelResponse;
    },
    onEvent: (callback: (event: ConversationRuntimeEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, runtimeEvent: ConversationRuntimeEvent) => {
        callback(runtimeEvent);
      };
      ipcRenderer.on(CHAT_IPC_CHANNELS.STREAM, listener);
      return () => {
        ipcRenderer.removeListener(CHAT_IPC_CHANNELS.STREAM, listener);
      };
    },
    loadSession: async (sessionId: string) => {
      return (await ipcRenderer.invoke(CHAT_IPC_CHANNELS.LOAD_SESSION, { sessionId })) as ChatLoadSessionResponse;
    }
  }
};

contextBridge.exposeInMainWorld('mave', api);
