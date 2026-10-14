import { contextBridge, ipcRenderer } from 'electron';
import {
  CHAT_IPC_CHANNELS,
  VOICE_IPC_CHANNELS,
  SURFACE_IPC_CHANNELS,
  type AssistantStateSnapshot,
  type ChatCancelResponse,
  type ChatLoadSessionResponse,
  type ChatSendRequest,
  type ChatSendResponse,
  type ConversationRuntimeEvent,
  type MaveCommand,
  type VoiceRuntimeEvent,
  type VoiceStatusSnapshot,
  type SurfaceSnapshot,
  type SurfaceEvent,
  type SurfaceAction
} from '@mave/contracts';

export interface MaveChatApi {
  send: (request: ChatSendRequest) => Promise<ChatSendResponse>;
  cancel: (requestId: string) => Promise<ChatCancelResponse>;
  onEvent: (callback: (event: ConversationRuntimeEvent) => void) => () => void;
  loadSession?: (sessionId: string) => Promise<ChatLoadSessionResponse>;
}

export interface MaveVoiceApi {
  getStatus: () => Promise<VoiceStatusSnapshot>;
  subscribe: (callback: (event: VoiceRuntimeEvent) => void) => () => void;
  interrupt: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  cancel: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  startDiagnosticSession: () => Promise<{ success: boolean; error?: string }>;
}

export interface MaveSurfaceApi {
  getSnapshot: () => Promise<SurfaceSnapshot>;
  subscribe: (callback: (event: SurfaceEvent) => void) => () => void;
  dispatchAction: (action: SurfaceAction) => Promise<{ success: boolean; error?: string }>;
  reportInteractiveHover: (isHovering: boolean) => Promise<void>;
  getDiagnostics?: () => Promise<unknown>;
}

export interface MaveApi {
  getStatus: () => Promise<AssistantStateSnapshot>;
  sendCommand: (
    command: MaveCommand,
    payload?: Record<string, unknown>
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  onStateChanged: (callback: (snapshot: AssistantStateSnapshot) => void) => () => void;
  chat: MaveChatApi;
  voice: MaveVoiceApi;
  surface: MaveSurfaceApi;
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
  },
  voice: {
    getStatus: async () => {
      return (await ipcRenderer.invoke(VOICE_IPC_CHANNELS.GET_STATUS)) as VoiceStatusSnapshot;
    },
    subscribe: (callback: (event: VoiceRuntimeEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, voiceEvent: VoiceRuntimeEvent) => {
        callback(voiceEvent);
      };
      ipcRenderer.on(VOICE_IPC_CHANNELS.EVENT, listener);
      return () => {
        ipcRenderer.removeListener(VOICE_IPC_CHANNELS.EVENT, listener);
      };
    },
    interrupt: async (reason?: string) => {
      return (await ipcRenderer.invoke(VOICE_IPC_CHANNELS.INTERRUPT, { reason })) as {
        success: boolean;
        error?: string;
      };
    },
    cancel: async (reason?: string) => {
      return (await ipcRenderer.invoke(VOICE_IPC_CHANNELS.CANCEL, { reason })) as {
        success: boolean;
        error?: string;
      };
    },
    startDiagnosticSession: async () => {
      return (await ipcRenderer.invoke(VOICE_IPC_CHANNELS.START_DIAGNOSTIC)) as {
        success: boolean;
        error?: string;
      };
    }
  },
  surface: {
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
  }
};

// Developer Diagnostics Window preload:
// Exposes full developer diagnostics and controls (chat, voice, status, sendCommand, surface).
contextBridge.exposeInMainWorld('mave', api);
