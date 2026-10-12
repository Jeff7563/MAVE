import { ipcMain, type BrowserWindow } from 'electron';
import { SendCommandPayloadSchema, type AssistantStateSnapshot } from '@mave/contracts';
import type { MaveService } from '@mave/core';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:ipc' });

export function handleIpcCommand(
  rawPayload: unknown,
  service: MaveService
): { success: boolean; error?: string } {
  const parseResult = SendCommandPayloadSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    const errorMsg = `Invalid command payload: ${parseResult.error.message}`;
    logger.warn({ error: errorMsg }, 'rejected IPC command');
    return { success: false, error: errorMsg };
  }

  const { command } = parseResult.data;
  logger.info({ command }, 'handling IPC command');

  switch (command) {
    case 'simulate-wake':
      service.send({ type: 'WAKE_DETECTED' });
      break;
    case 'return-to-sleep':
      service.send({ type: 'SLEEP_REQUESTED' });
      break;
    case 'toggle-mute':
      service.send({ type: 'TOGGLE_MUTE' });
      break;
    case 'simulate-error':
      service.send({ type: 'ERROR', error: 'Simulated developer error' });
      break;
    case 'quit':
      service.send({ type: 'SHUTDOWN' });
      break;
    default:
      logger.info({ command }, 'unhandled command action');
      break;
  }

  return { success: true };
}

export function registerIpcHandlers(
  service: MaveService,
  getMainWindow: () => BrowserWindow | null
): () => void {
  ipcMain.handle('mave:get-status', () => {
    return service.getSnapshot();
  });

  ipcMain.handle('mave:send-command', (_event, rawPayload: unknown) => {
    return handleIpcCommand(rawPayload, service);
  });

  const unsubscribe = service.subscribe((snapshot: AssistantStateSnapshot) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('mave:state-changed', snapshot);
    }
  });

  return () => {
    ipcMain.removeHandler('mave:get-status');
    ipcMain.removeHandler('mave:send-command');
    unsubscribe();
  };
}
