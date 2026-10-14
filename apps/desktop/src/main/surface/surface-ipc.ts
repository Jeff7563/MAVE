import { ipcMain } from 'electron';
import {
  SURFACE_IPC_CHANNELS,
  SurfaceActionSchema,
  type SurfaceSnapshot,
  type SurfaceAction
} from '@mave/contracts';
import type { SurfaceStateController } from '@mave/core';
import { createLogger } from '@mave/shared';
import type { SurfaceWindowManager } from './surface-window-manager.js';
import { DEFAULT_SURFACE_PREFERENCES, type SurfacePreferences } from './surface-preferences.js';

const logger = createLogger({ name: 'mave:surface-ipc' });

export function registerSurfaceIpcHandlers(
  controller: SurfaceStateController,
  surfaceWindowManager: SurfaceWindowManager
): () => void {
  // 1. GET_SNAPSHOT
  ipcMain.handle(SURFACE_IPC_CHANNELS.GET_SNAPSHOT, (): SurfaceSnapshot => {
    return controller.getSnapshot();
  });

  // 2. DISPATCH_ACTION
  ipcMain.handle(
    SURFACE_IPC_CHANNELS.DISPATCH_ACTION,
    (_event, rawAction: unknown): { success: boolean; error?: string } => {
      const parseResult = SurfaceActionSchema.safeParse(rawAction);
      if (!parseResult.success) {
        const errorMsg = `Invalid SurfaceAction: ${parseResult.error.message}`;
        logger.warn({ error: errorMsg }, 'rejected surface action');
        return { success: false, error: errorMsg };
      }

      const action: SurfaceAction = parseResult.data;
      logger.info({ actionType: action.type }, 'handling surface action');
      return surfaceWindowManager.dispatchAction(action);
    }
  );

  // 3. REPORT_HOVER (for click-through hit-testing with sender validation)
  ipcMain.handle('mave:surface:report-hover', (event, hovering: unknown) => {
    const surfaceWin = surfaceWindowManager.getWindow();
    if (surfaceWin && !surfaceWin.isDestroyed() && event.sender.id !== surfaceWin.webContents.id) {
      logger.warn({ senderId: event.sender.id }, 'rejected report-hover from unauthorized webContents');
      return { success: false, error: 'Unauthorized sender' };
    }
    surfaceWindowManager.reportInteractiveHover(Boolean(hovering));
    return { success: true };
  });

  // 4. GET_DIAGNOSTICS (for developer window inspection)
  ipcMain.handle('mave:surface:get-diagnostics', () => {
    return surfaceWindowManager.getDiagnostics();
  });

  // 5. GET_PREFERENCES
  ipcMain.handle('mave:surface:get-preferences', (): SurfacePreferences => {
    return surfaceWindowManager.getPreferencesStore()?.getPreferences() ?? DEFAULT_SURFACE_PREFERENCES;
  });

  // 6. SET_PREFERENCES
  ipcMain.handle('mave:surface:set-preferences', (_event, partial: unknown): { success: boolean; error?: string } => {
    try {
      const store = surfaceWindowManager.getPreferencesStore();
      if (!store) {
        return { success: false, error: 'Preferences store not available' };
      }
      if (typeof partial !== 'object' || partial === null) {
        return { success: false, error: 'Invalid preferences payload' };
      }
      store.updatePreferences(partial as Partial<SurfacePreferences>);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  return () => {
    ipcMain.removeHandler(SURFACE_IPC_CHANNELS.GET_SNAPSHOT);
    ipcMain.removeHandler(SURFACE_IPC_CHANNELS.DISPATCH_ACTION);
    ipcMain.removeHandler('mave:surface:report-hover');
    ipcMain.removeHandler('mave:surface:get-diagnostics');
    ipcMain.removeHandler('mave:surface:get-preferences');
    ipcMain.removeHandler('mave:surface:set-preferences');
  };
}

