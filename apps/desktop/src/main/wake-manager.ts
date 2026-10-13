import type { MaveService } from '@mave/core';
import type { MaveDatabase } from '@mave/database';
import type { WakeWordProvider, WakeDiagnostics, OfflineWavTestResult } from '@mave/contracts';
import { OpenWakeWordProvider, MockWakeWordProvider } from '@mave/providers';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:wake-manager' });

export interface WakeManagerOptions {
  service: MaveService;
  database: MaveDatabase;
  provider?: WakeWordProvider;
  useMockProvider?: boolean;
  rootDir?: string;
  pythonExecutable?: string;
  rearmGuardMs?: number;
  onWakeDetected?: () => Promise<void> | void;
  autoManageCapture?: boolean;
}

export class WakeManager {
  private service: MaveService;
  private database: MaveDatabase;
  private provider: WakeWordProvider;
  private rearmGuardMs: number;
  private sleepingSince = 0;
  private unsubscribeService?: () => void;
  private unsubscribeWake?: () => void;
  private unsubscribeTelemetry?: () => void;
  private isDisposed = false;
  private onWakeDetectedHandler?: () => Promise<void> | void;
  private autoManageCapture: boolean;
  private activeStartPromise: Promise<void> | null = null;
  private activeStopPromise: Promise<void> | null = null;

  constructor(options: WakeManagerOptions) {
    this.service = options.service;
    this.database = options.database;
    this.rearmGuardMs = options.rearmGuardMs ?? 300;
    this.onWakeDetectedHandler = options.onWakeDetected;
    this.autoManageCapture = options.autoManageCapture ?? (options.onWakeDetected ? false : true);

    if (options.provider) {
      this.provider = options.provider;
    } else if (options.useMockProvider ?? (process.env['NODE_ENV'] === 'test')) {
      this.provider = new MockWakeWordProvider();
    } else {
      const persistedDevice = this.getPersistedSetting('wake.microphoneDeviceIndex');
      const persistedThreshold =
        this.getPersistedSetting('wake.threshold') ?? this.getPersistedSetting('wake.sensitivity');
      const persistedPython = this.getPersistedSetting('wake.pythonExecutable');

      this.provider = new OpenWakeWordProvider({
        deviceIndex: persistedDevice !== null ? parseInt(persistedDevice, 10) : -1,
        threshold: persistedThreshold !== null ? parseFloat(persistedThreshold) : 0.5,
        rootDir: options.rootDir,
        pythonExecutable: options.pythonExecutable ?? (persistedPython || undefined)
      });
    }
  }

  async initialize(): Promise<void> {
    logger.info('initializing wake manager lifecycle coordinator');

    if (
      'getResolvedPythonExecutable' in this.provider &&
      typeof (this.provider as any).getResolvedPythonExecutable === 'function'
    ) {
      const pythonExecutable = (this.provider as any).getResolvedPythonExecutable();
      logger.info({ pythonExecutable }, 'wake.python.resolved');
    }

    // 1. Hook wake detection -> state machine transition with guards
    this.unsubscribeWake = this.provider.onWake(async () => {
      const snapshot = this.service.getSnapshot();
      if (snapshot.state !== 'sleeping' || snapshot.isMuted) {
        logger.warn(
          { state: snapshot.state, isMuted: snapshot.isMuted },
          'ignoring wake event received while not in sleeping state or muted'
        );
        return;
      }

      const elapsed = Date.now() - this.sleepingSince;
      if (elapsed < this.rearmGuardMs) {
        logger.warn(
          { elapsed, rearmGuardMs: this.rearmGuardMs },
          'ignoring wake event within rearm guard window'
        );
        return;
      }

      logger.info('wake event received from provider -> dispatching wake event/handoff');
      if (this.onWakeDetectedHandler) {
        try {
          await this.onWakeDetectedHandler();
        } catch (err) {
          logger.error({ err }, 'error in custom wake detected handler');
        }
      } else {
        this.service.send({ type: 'WAKE_DETECTED' });
      }
      this.syncDiagnostics();
    });

    if (this.provider.onError) {
      this.provider.onError((err) => {
        logger.error({ error: err.message }, 'wake provider reported error');
        this.service.send({
          type: 'SET_WAKE_ENGINE_STATUS',
          status: 'error',
          error: err.message
        });
      });
    }

    if (this.provider.onTelemetry) {
      this.unsubscribeTelemetry = this.provider.onTelemetry(() => {
        this.syncDiagnostics();
      });
    }

    // 2. Hook state machine transitions -> wake engine start/stop
    let lastState = this.service.getSnapshot().state;
    let lastMuted = this.service.getSnapshot().isMuted;

    this.unsubscribeService = this.service.subscribe(async (snapshot) => {
      if (this.isDisposed) return;

      const stateChanged = snapshot.state !== lastState;
      const muteChanged = snapshot.isMuted !== lastMuted;

      lastState = snapshot.state;
      lastMuted = snapshot.isMuted;

      if (this.autoManageCapture) {
        if (stateChanged || muteChanged) {
          if (snapshot.state === 'sleeping' && !snapshot.isMuted) {
            try {
              await this.start();
            } catch {
              // Handled and logged inside start()
            }
          } else {
            try {
              await this.stop();
            } catch {
              // Handled and logged inside stop()
            }
          }
        }
      } else {
        if (muteChanged && snapshot.isMuted) {
          try {
            await this.stop();
          } catch {
            // Handled and logged inside stop()
          }
        }
      }
    });

    // Initial check: if already sleeping, start
    const initialSnapshot = this.service.getSnapshot();
    if (initialSnapshot.state === 'sleeping' && !initialSnapshot.isMuted) {
      try {
        await this.start(false);
      } catch (err) {
        logger.warn({ err }, 'initial wake capture start attempt');
      }
    }

    this.syncDiagnostics();
  }

  async start(isTransitionToSleep = true): Promise<void> {
    if (this.isDisposed) return;
    if (this.activeStartPromise) return this.activeStartPromise;

    this.activeStartPromise = (async () => {
      if (isTransitionToSleep) {
        this.sleepingSince = Date.now();
      }
      logger.info('starting wake capture');
      try {
        await this.provider.start();
      } catch (err) {
        logger.error({ err }, 'failed to start wake provider');
        throw err;
      } finally {
        this.syncDiagnostics();
        this.activeStartPromise = null;
      }
    })();

    return this.activeStartPromise;
  }

  async stop(): Promise<void> {
    if (this.isDisposed) return;
    if (this.activeStopPromise) return this.activeStopPromise;

    this.activeStopPromise = (async () => {
      logger.info('stopping wake capture');
      try {
        await this.provider.stop();
      } catch (err) {
        logger.error({ err }, 'failed to stop wake provider');
        throw err;
      } finally {
        this.syncDiagnostics();
        this.activeStopPromise = null;
      }
    })();

    return this.activeStopPromise;
  }

  isListening(): boolean {
    if (this.isDisposed) return false;
    if ('getStatus' in this.provider && typeof (this.provider as any).getStatus === 'function') {
      return (this.provider as any).getStatus() === 'listening';
    }
    return this.provider.getDiagnostics?.().status === 'listening';
  }

  setWakeHandler(handler?: () => Promise<void> | void): void {
    this.onWakeDetectedHandler = handler;
    if (handler) {
      this.autoManageCapture = false;
    }
  }

  syncDiagnostics(): void {
    if (this.isDisposed) return;
    if (this.provider.getDiagnostics) {
      const diag: WakeDiagnostics = this.provider.getDiagnostics();
      this.service.send({
        type: 'SET_WAKE_DIAGNOSTICS',
        diagnostics: {
          status: diag.status,
          wakeProvider: diag.wakeProvider || 'openWakeWord',
          microphoneName: diag.microphoneName,
          microphoneIndex: diag.microphoneIndex,
          availableDevices: diag.availableDevices,
          wakeWord: diag.wakeWord,
          sensitivity: diag.threshold ?? diag.sensitivity ?? 0.5,
          threshold: diag.threshold ?? diag.sensitivity ?? 0.5,
          lastWakeAt: diag.lastWakeAt,
          isWakeConfigured: diag.isConfigured,
          errorMessage: diag.errorMessage,
          latestScore: diag.latestScore,
          peakScore: diag.peakScore,
          lastWakeScore: diag.lastWakeScore
        }
      });
    }
  }

  async setMicrophone(deviceIndex: number): Promise<void> {
    logger.info({ deviceIndex }, 'setting microphone index');
    this.persistSetting('wake.microphoneDeviceIndex', String(deviceIndex));

    if ('setMicrophone' in this.provider && typeof (this.provider as any).setMicrophone === 'function') {
      await (this.provider as any).setMicrophone(deviceIndex);
    }
    this.syncDiagnostics();
  }

  async setThreshold(threshold: number): Promise<void> {
    logger.info({ threshold }, 'setting threshold');
    this.persistSetting('wake.threshold', String(threshold));
    this.persistSetting('wake.sensitivity', String(threshold));

    if ('setThreshold' in this.provider && typeof (this.provider as any).setThreshold === 'function') {
      await (this.provider as any).setThreshold(threshold);
    } else if ('setSensitivity' in this.provider && typeof (this.provider as any).setSensitivity === 'function') {
      await (this.provider as any).setSensitivity(threshold);
    }
    this.syncDiagnostics();
  }

  async setSensitivity(sensitivity: number): Promise<void> {
    return this.setThreshold(sensitivity);
  }

  async testAudioFile(wavPath: string): Promise<OfflineWavTestResult | null> {
    logger.info({ wavPath }, 'testing offline audio file');
    if (this.provider.testAudioFile) {
      return await this.provider.testAudioFile(wavPath);
    }
    return null;
  }

  async restart(): Promise<void> {
    logger.info('restarting wake engine');
    if ('restart' in this.provider && typeof (this.provider as any).restart === 'function') {
      await (this.provider as any).restart();
    } else {
      await this.provider.stop();
      await this.provider.start();
    }
    this.syncDiagnostics();
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) return;
    this.isDisposed = true;

    logger.info('disposing wake manager and releasing audio resources');
    this.unsubscribeWake?.();
    this.unsubscribeTelemetry?.();
    this.unsubscribeService?.();
    this.onWakeDetectedHandler = undefined;

    try {
      await this.provider.dispose();
    } catch (err) {
      logger.error({ err }, 'error during wake provider disposal');
    }
  }

  private getPersistedSetting(key: string): string | null {
    try {
      const result = this.database.sqlite.exec(
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

  private persistSetting(key: string, value: string): void {
    try {
      const now = Date.now();
      this.database.sqlite.run(
        `INSERT INTO settings (key, value, updated_at) VALUES ('${key}', '${value}', ${now})
         ON CONFLICT(key) DO UPDATE SET value = '${value}', updated_at = ${now};`
      );
      this.database.save();
    } catch (err) {
      logger.warn({ key, value, err }, 'failed to persist setting to database');
    }
  }

  getProvider(): WakeWordProvider {
    return this.provider;
  }
}
