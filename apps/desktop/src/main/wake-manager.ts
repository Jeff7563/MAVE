import type { MaveService } from '@mave/core';
import type { MaveDatabase } from '@mave/database';
import type { WakeWordProvider, WakeDiagnostics } from '@mave/contracts';
import { PicovoiceWakeWordProvider, MockWakeWordProvider } from '@mave/providers';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:wake-manager' });

export interface WakeManagerOptions {
  service: MaveService;
  database: MaveDatabase;
  provider?: WakeWordProvider;
  useMockProvider?: boolean;
  rootDir?: string;
}

export class WakeManager {
  private service: MaveService;
  private database: MaveDatabase;
  private provider: WakeWordProvider;
  private unsubscribeService?: () => void;
  private unsubscribeWake?: () => void;
  private isDisposed = false;

  constructor(options: WakeManagerOptions) {
    this.service = options.service;
    this.database = options.database;

    if (options.provider) {
      this.provider = options.provider;
    } else if (options.useMockProvider || process.env['NODE_ENV'] === 'test') {
      this.provider = new MockWakeWordProvider();
    } else {
      const persistedDevice = this.getPersistedSetting('wake.microphoneDeviceIndex');
      const persistedSensitivity = this.getPersistedSetting('wake.sensitivity');

      this.provider = new PicovoiceWakeWordProvider({
        deviceIndex: persistedDevice !== null ? parseInt(persistedDevice, 10) : -1,
        sensitivity: persistedSensitivity !== null ? parseFloat(persistedSensitivity) : 0.5,
        rootDir: options.rootDir
      });
    }
  }

  async initialize(): Promise<void> {
    logger.info('initializing wake manager lifecycle coordinator');

    // 1. Hook wake detection -> state machine transition
    this.unsubscribeWake = this.provider.onWake(() => {
      logger.info('wake event received from provider -> dispatching WAKE_DETECTED');
      this.service.send({ type: 'WAKE_DETECTED' });
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

    // 2. Hook state machine transitions -> wake engine start/stop
    let lastState = this.service.getSnapshot().state;
    let lastMuted = this.service.getSnapshot().isMuted;

    this.unsubscribeService = this.service.subscribe(async (snapshot) => {
      if (this.isDisposed) return;

      const stateChanged = snapshot.state !== lastState;
      const muteChanged = snapshot.isMuted !== lastMuted;

      lastState = snapshot.state;
      lastMuted = snapshot.isMuted;

      if (stateChanged || muteChanged) {
        if (snapshot.state === 'sleeping' && !snapshot.isMuted) {
          logger.info('state is sleeping and unmuted: starting wake capture');
          try {
            await this.provider.start();
          } catch (err) {
            logger.error({ err }, 'failed to start wake provider');
          }
          this.syncDiagnostics();
        } else {
          logger.info(
            { state: snapshot.state, isMuted: snapshot.isMuted },
            'state is not sleeping or muted: stopping wake capture'
          );
          try {
            await this.provider.stop();
          } catch (err) {
            logger.error({ err }, 'failed to stop wake provider');
          }
          this.syncDiagnostics();
        }
      }
    });

    // Initial check: if already sleeping, start
    const initialSnapshot = this.service.getSnapshot();
    if (initialSnapshot.state === 'sleeping' && !initialSnapshot.isMuted) {
      try {
        await this.provider.start();
      } catch (err) {
        logger.warn({ err }, 'initial wake capture start attempt');
      }
    }

    this.syncDiagnostics();
  }

  syncDiagnostics(): void {
    if (this.isDisposed) return;
    if (this.provider.getDiagnostics) {
      const diag: WakeDiagnostics = this.provider.getDiagnostics();
      this.service.send({
        type: 'SET_WAKE_DIAGNOSTICS',
        diagnostics: {
          status: diag.status,
          microphoneName: diag.microphoneName,
          microphoneIndex: diag.microphoneIndex,
          availableDevices: diag.availableDevices,
          wakeWord: diag.wakeWord,
          sensitivity: diag.sensitivity,
          lastWakeAt: diag.lastWakeAt,
          isWakeConfigured: diag.isConfigured,
          errorMessage: diag.errorMessage
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

  async setSensitivity(sensitivity: number): Promise<void> {
    logger.info({ sensitivity }, 'setting sensitivity');
    this.persistSetting('wake.sensitivity', String(sensitivity));

    if ('setSensitivity' in this.provider && typeof (this.provider as any).setSensitivity === 'function') {
      await (this.provider as any).setSensitivity(sensitivity);
    }
    this.syncDiagnostics();
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
    this.unsubscribeService?.();

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
