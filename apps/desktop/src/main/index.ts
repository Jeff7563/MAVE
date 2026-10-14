import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { DefaultMaveConfig } from '@mave/contracts';
import { createLogger } from '@mave/shared';
import {
  createMaveService,
  type MaveService,
  SurfaceStateController,
  voiceEventToSurfaceIntent
} from '@mave/core';
import { createMaveDatabase, type MaveDatabase } from '@mave/database';
import { registerIpcHandlers } from './ipc.js';
import { createSystemTray } from './tray.js';
import { WakeManager } from './wake-manager.js';
import { ConversationManager } from './conversation-manager.js';
import { VoiceManager } from './voice-manager.js';
import { SurfaceWindowManager, registerSurfaceIpcHandlers } from './surface/index.js';
import {
  SounddeviceAudioInputProvider,
  MockAudioInputProvider,
  FasterWhisperSTTProvider,
  MockSTTProvider,
  EdgeTTSProvider,
  MockTTSProvider,
  SounddeviceAudioOutput,
  MockAudioOutput
} from '@mave/providers';

const logger = createLogger({ name: 'mave:main' });

let mainWindow: BrowserWindow | null = null;
let maveService: MaveService | null = null;
let maveDatabase: MaveDatabase | null = null;
let wakeManager: WakeManager | null = null;
let conversationManager: ConversationManager | null = null;
let voiceManager: VoiceManager | null = null;
let surfaceController: SurfaceStateController | null = null;
let surfaceWindowManager: SurfaceWindowManager | null = null;
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

function getPersistedSetting(database: MaveDatabase, key: string): string | null {
  try {
    const result = database.sqlite.exec(
      `SELECT value FROM settings WHERE key = '${key}' LIMIT 1;`
    );
    if (result.length > 0 && result[0]?.values.length && result[0].values[0]?.[0]) {
      return String(result[0].values[0][0]);
    }
  } catch (err) {
    logger.warn({ key, err }, 'failed to read setting from database');
  }
  return null;
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

    // 3. Initialize Wake Manager
    wakeManager = new WakeManager({
      service: maveService,
      database: maveDatabase,
      useMockProvider: process.env['NODE_ENV'] === 'test' || process.env['MAVE_MOCK_WAKE'] === '1',
      rootDir: path.resolve(__dirname, '../../../..'),
      pythonExecutable: process.env['MAVE_WAKE_PYTHON']
    });
    await wakeManager.initialize();

    // 4. Initialize Conversation Manager (M2 Phase 6)
    conversationManager = new ConversationManager({
      database: maveDatabase,
      getMainWindow: () => mainWindow,
      timeoutMs: DefaultMaveConfig.brain.timeoutMs
    });

    // 5. Initialize Voice Manager (M3.5 Wake <-> Voice Handoff)
    const voiceEnabled =
      process.env['MAVE_VOICE_ENABLED'] !== '0' &&
      getPersistedSetting(maveDatabase, 'voice.enabled') !== 'false';

    if (voiceEnabled) {
      const audioInput =
        process.env['NODE_ENV'] === 'test' || process.env['MAVE_MOCK_VOICE_INPUT'] === '1'
          ? new MockAudioInputProvider()
          : new SounddeviceAudioInputProvider({
              rootDir: path.resolve(__dirname, '../../../..'),
              pythonExecutable: process.env['MAVE_WAKE_PYTHON']
            });

      const stt =
        process.env['NODE_ENV'] === 'test' || process.env['MAVE_MOCK_STT'] === '1'
          ? new MockSTTProvider()
          : new FasterWhisperSTTProvider({
              rootDir: path.resolve(__dirname, '../../../..'),
              pythonExecutable: process.env['MAVE_STT_PYTHON'],
              model: process.env['MAVE_STT_MODEL'] ?? 'large-v3-turbo'
            });

      const tts =
        process.env['NODE_ENV'] === 'test' || process.env['MAVE_MOCK_TTS'] === '1'
          ? new MockTTSProvider()
          : new EdgeTTSProvider({
              rootDir: path.resolve(__dirname, '../../../..'),
              pythonExecutable: process.env['MAVE_TTS_PYTHON']
            });

      const audioOutput =
        process.env['NODE_ENV'] === 'test' || process.env['MAVE_MOCK_AUDIO_OUTPUT'] === '1'
          ? new MockAudioOutput()
          : new SounddeviceAudioOutput({
              rootDir: path.resolve(__dirname, '../../../..'),
              pythonExecutable: process.env['MAVE_TTS_PYTHON']
            });

      voiceManager = new VoiceManager({
        service: maveService,
        wakeManager,
        conversationRuntime: conversationManager.getRuntime(),
        audioInput,
        stt,
        tts,
        audioOutput
      });
      await voiceManager.start();
      logger.info('voice manager initialized and started');
    }

    // 6. Register IPC
    registerIpcHandlers(
      maveService,
      () => mainWindow,
      wakeManager,
      conversationManager,
      voiceManager ?? undefined
    );

    // 7. Create Developer Window & Tray
    mainWindow = createWindow();
    tray = createSystemTray(maveService, () => mainWindow);

    // 8. Initialize Ambient Surface Runtime (M4.2)
    surfaceController = new SurfaceStateController({ enableTimers: true });

    if (voiceManager) {
      voiceManager.onVoiceEvent((event) => {
        const intent = voiceEventToSurfaceIntent(event);
        surfaceController?.applyIntent(intent);
      });
    }

    const surfacePreloadPath = path.join(__dirname, '../preload/surface-preload.js');
    const surfaceUrl = process.env['VITE_DEV_SERVER_URL']
      ? `${process.env['VITE_DEV_SERVER_URL']}?view=surface`
      : path.join(__dirname, '../renderer/index.html');

    surfaceWindowManager = new SurfaceWindowManager({
      controller: surfaceController,
      surfaceUrl,
      preloadPath: surfacePreloadPath
    });
    await surfaceWindowManager.initialize();
    registerSurfaceIpcHandlers(surfaceController, surfaceWindowManager);
    logger.info('ambient surface window manager initialized');

    // 9. Send APP_READY
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

app.on('before-quit', async () => {
  logger.info('graceful shutdown initiated');
  if (tray) {
    tray.destroy();
    tray = null;
  }
  if (surfaceWindowManager) {
    surfaceWindowManager.dispose();
    surfaceWindowManager = null;
  }
  surfaceController = null;
  if (voiceManager) {
    await voiceManager.dispose();
    voiceManager = null;
  }
  if (wakeManager) {
    await wakeManager.dispose();
    wakeManager = null;
  }
  if (conversationManager) {
    await conversationManager.dispose();
    conversationManager = null;
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
