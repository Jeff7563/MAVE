import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { createLogger } from '@mave/shared';
import { createMaveService, type MaveService } from '@mave/core';
import { createMaveDatabase, type MaveDatabase } from '@mave/database';
import { registerIpcHandlers } from './ipc.js';
import { createSystemTray } from './tray.js';

const logger = createLogger({ name: 'mave:main' });

let mainWindow: BrowserWindow | null = null;
let maveService: MaveService | null = null;
let maveDatabase: MaveDatabase | null = null;
let tray: ReturnType<typeof createSystemTray> | null = null;

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.info('another instance is already running; quitting');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '../preload/index.js');

  const win = new BrowserWindow({
    width: 440,
    height: 580,
    minWidth: 380,
    minHeight: 500,
    title: 'MAVE',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Security: deny new-window popups and unauthorized navigations
  win.webContents.setWindowOpenHandler(() => {
    logger.warn('blocked pop-up window opening attempt');
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    // Only permit local development URL or file URL
    if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) {
      event.preventDefault();
      logger.warn({ url }, 'blocked external navigation attempt');
    }
  });

  win.once('ready-to-show', () => {
    win.show();
    logger.info('MAVE desktop window shown');
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  if (process.env['VITE_DEV_SERVER_URL']) {
    win.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    win.loadFile(indexPath);
  }

  return win;
}

app.whenReady().then(async () => {
  logger.info({ nodeEnv: process.env['NODE_ENV'] }, 'app startup: initializing MAVE');

  try {
    // 1. Initialize SQLite Database
    const dbPath = path.join(app.getPath('userData'), 'mave.db');
    maveDatabase = await createMaveDatabase(dbPath);
    logger.info({ dbPath }, 'database initialized');

    // 2. Initialize State Machine Core
    maveService = createMaveService();
    maveService.start();

    // 3. Register IPC
    registerIpcHandlers(maveService, () => mainWindow);

    // 4. Create Window & Tray
    mainWindow = createWindow();
    tray = createSystemTray(maveService, () => mainWindow);

    // 5. Send APP_READY
    maveService.send({ type: 'APP_READY' });
    logger.info('MAVE ready: state set to sleeping');
  } catch (err) {
    logger.error({ err }, 'fatal error during app initialization');
    if (maveService) {
      maveService.send({
        type: 'ERROR',
        error: err instanceof Error ? err.message : 'Startup error'
      });
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On Windows, keep running in system tray unless explicitly shut down
  logger.info('all windows closed, continuing in tray');
});

app.on('before-quit', () => {
  logger.info('graceful shutdown initiated');
  if (tray) {
    tray.destroy();
    tray = null;
  }
  if (maveService) {
    maveService.send({ type: 'SHUTDOWN' });
    maveService.stop();
  }
  if (maveDatabase) {
    maveDatabase.close();
  }
});

process.on('uncaughtException', (err) => {
  logger.error({ err: err.message, stack: err.stack }, 'uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
});
