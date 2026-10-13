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

  // 3. REPORT_HOVER (for click-through hit-testing)
  ipcMain.handle('mave:surface:report-hover', (_event, hovering: unknown) => {
    surfaceWindowManager.reportInteractiveHover(Boolean(hovering));
    return { success: true };
  });

  // 4. GET_DIAGNOSTICS (for developer window inspection)
  ipcMain.handle('mave:surface:get-diagnostics', () => {
    return surfaceWindowManager.getDiagnostics();
  });

  return () => {
    ipcMain.removeHandler(SURFACE_IPC_CHANNELS.GET_SNAPSHOT);
    ipcMain.removeHandler(SURFACE_IPC_CHANNELS.DISPATCH_ACTION);
    ipcMain.removeHandler('mave:surface:report-hover');
    ipcMain.removeHandler('mave:surface:get-diagnostics');
  };
}

