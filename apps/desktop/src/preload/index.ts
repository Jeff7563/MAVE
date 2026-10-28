import { contextBridge, ipcRenderer } from 'electron';
import {
  CHAT_IPC_CHANNELS,
  TOOL_IPC_CHANNELS,
  VOICE_IPC_CHANNELS,
  type ApprovalDecision,
  type AssistantStateSnapshot,
  type ToolApprovalRequest,
  type ToolAuditRecord,
  type ToolCallRequestInput,
  type ToolDescriptor,
  type ToolEvent,
  type ToolResult,
  type ToolRunCommandResponse,
  type ChatCancelResponse,
  type ChatLoadSessionResponse,
  type ChatSendRequest,
  type ChatSendResponse,
  type ConversationRuntimeEvent,
  type MaveCommand,
  type VoiceRuntimeEvent,
  type VoiceStatusSnapshot
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

export interface MaveToolsApi {
  list: () => Promise<{ tools: ToolDescriptor[]; roots: string[]; pendingApprovals: ToolApprovalRequest[] }>;
  call: (request: ToolCallRequestInput) => Promise<ToolResult>;
  runCommand: (text: string) => Promise<ToolRunCommandResponse>;
  respondApproval: (decision: ApprovalDecision) => Promise<{ ok: boolean; error?: string }>;
  cancel: (callId: string) => Promise<{ cancelled: boolean }>;
  getAudit: () => Promise<ToolAuditRecord[]>;
  onEvent: (callback: (event: ToolEvent) => void) => () => void;
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
  tools: MaveToolsApi;
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
  tools: {
    list: async () => ipcRenderer.invoke(TOOL_IPC_CHANNELS.LIST),
    call: async (request) => ipcRenderer.invoke(TOOL_IPC_CHANNELS.CALL, request),
    runCommand: async (text) => ipcRenderer.invoke(TOOL_IPC_CHANNELS.RUN_COMMAND, { text }),
    respondApproval: async (decision) => ipcRenderer.invoke(TOOL_IPC_CHANNELS.RESPOND_APPROVAL, decision),
    cancel: async (callId) => ipcRenderer.invoke(TOOL_IPC_CHANNELS.CANCEL, { callId }),
    getAudit: async () => ipcRenderer.invoke(TOOL_IPC_CHANNELS.GET_AUDIT),
    onEvent: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, toolEvent: ToolEvent) => callback(toolEvent);
      ipcRenderer.on(TOOL_IPC_CHANNELS.EVENT, listener);
      return () => {
        ipcRenderer.removeListener(TOOL_IPC_CHANNELS.EVENT, listener);
      };
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
  }
};

contextBridge.exposeInMainWorld('mave', api);
