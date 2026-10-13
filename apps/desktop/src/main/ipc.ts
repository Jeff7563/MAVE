import { ipcMain, type BrowserWindow } from 'electron';
import { CHAT_IPC_CHANNELS, SendCommandPayloadSchema, type AssistantStateSnapshot } from '@mave/contracts';
import type { MaveService } from '@mave/core';
import { createLogger } from '@mave/shared';

import type { WakeManager } from './wake-manager.js';
import type { ConversationManager } from './conversation-manager.js';
import type { VoiceManager } from './voice-manager.js';

const logger = createLogger({ name: 'mave:ipc' });

export async function handleIpcCommand(
  rawPayload: unknown,
  service: MaveService,
  wakeManager?: WakeManager,
  voiceManager?: VoiceManager
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const parseResult = SendCommandPayloadSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    const errorMsg = `Invalid command payload: ${parseResult.error.message}`;
    logger.warn({ error: errorMsg }, 'rejected IPC command');
    return { success: false, error: errorMsg };
  }

  const { command, payload } = parseResult.data;
  logger.info({ command }, 'handling IPC command');

  switch (command) {
    case 'simulate-wake':
      if (voiceManager) {
        await voiceManager.handleWakeDetected();
      } else if (wakeManager && 'simulateWake' in wakeManager.getProvider()) {
        (wakeManager.getProvider() as any).simulateWake();
      } else {
        service.send({ type: 'WAKE_DETECTED' });
      }
      break;
    case 'return-to-sleep':
      if (voiceManager && voiceManager.isVoiceActive()) {
        await voiceManager.cancelActiveVoiceSession('user_sleep_requested');
      } else {
        service.send({ type: 'SLEEP_REQUESTED' });
      }
      break;
    case 'toggle-mute':
      service.send({ type: 'TOGGLE_MUTE' });
      break;
    case 'simulate-error':
      service.send({ type: 'ERROR', error: 'Simulated developer error' });
      break;
    case 'restart-wake-engine':
      if (wakeManager) {
        try {
          await wakeManager.restart();
        } catch (err: any) {
          logger.error({ err }, 'failed to restart wake engine via IPC');
          return { success: false, error: err.message };
        }
      }
      break;
    case 'set-microphone':
      if (wakeManager && payload && typeof payload['index'] === 'number') {
        try {
          await wakeManager.setMicrophone(payload['index']);
        } catch (err: any) {
          logger.error({ err }, 'failed to set microphone via IPC');
          return { success: false, error: err.message };
        }
      }
      break;
    case 'set-sensitivity':
      if (wakeManager && payload) {
        const thresholdVal =
          typeof payload['threshold'] === 'number'
            ? payload['threshold']
            : typeof payload['sensitivity'] === 'number'
              ? payload['sensitivity']
              : undefined;
        if (thresholdVal !== undefined) {
          try {
            await wakeManager.setThreshold(thresholdVal);
          } catch (err: any) {
            logger.error({ err }, 'failed to set threshold via IPC');
            return { success: false, error: err.message };
          }
        }
      }
      break;
    case 'test-audio-file':
      if (wakeManager && payload && typeof payload['path'] === 'string') {
        try {
          const testResult = await wakeManager.testAudioFile(payload['path']);
          return { success: true, data: testResult };
        } catch (err: any) {
          logger.error({ err }, 'failed to test audio file via IPC');
          return { success: false, error: err.message };
        }
      }
      return { success: false, error: 'Missing path or wakeManager not available' };
    case 'quit':
      service.send({ type: 'SHUTDOWN' });
      break;
    default:
      logger.info({ command }, 'unhandled command action');
      break;
  }

  return { success: true };
}

export function registerConversationIpcHandlers(
  conversationManager: ConversationManager
): () => void {
  ipcMain.handle(CHAT_IPC_CHANNELS.SEND, (_event, rawPayload: unknown) => {
    return conversationManager.handleSend(rawPayload);
  });

  ipcMain.handle(CHAT_IPC_CHANNELS.CANCEL, (_event, rawPayload: unknown) => {
    return conversationManager.handleCancel(rawPayload);
  });

  ipcMain.handle(CHAT_IPC_CHANNELS.LOAD_SESSION, (_event, rawPayload: unknown) => {
    return conversationManager.handleLoadSession(rawPayload);
  });

  return () => {
    ipcMain.removeHandler(CHAT_IPC_CHANNELS.SEND);
    ipcMain.removeHandler(CHAT_IPC_CHANNELS.CANCEL);
    ipcMain.removeHandler(CHAT_IPC_CHANNELS.LOAD_SESSION);
  };
}

export function registerIpcHandlers(
  service: MaveService,
  getMainWindow: () => BrowserWindow | null,
  wakeManager?: WakeManager,
  conversationManager?: ConversationManager,
  voiceManager?: VoiceManager
): () => void {
  ipcMain.handle('mave:get-status', () => {
    return service.getSnapshot();
  });

  ipcMain.handle('mave:send-command', (_event, rawPayload: unknown) => {
    return handleIpcCommand(rawPayload, service, wakeManager, voiceManager);
  });

  let cleanupConversation: (() => void) | undefined;
  if (conversationManager) {
    cleanupConversation = registerConversationIpcHandlers(conversationManager);
  }

  const unsubscribe = service.subscribe((snapshot: AssistantStateSnapshot) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('mave:state-changed', snapshot);
    }
  });

  return () => {
    ipcMain.removeHandler('mave:get-status');
    ipcMain.removeHandler('mave:send-command');
    if (cleanupConversation) {
      cleanupConversation();
    }
    unsubscribe();
  };
}
