import type {
  WakeWordProvider,
  WakeDiagnostics,
  WakeEngineStatus,
  OfflineWavTestResult
} from '@mave/contracts';
import { createLogger } from '@mave/shared';

export interface MockWakeWordProviderOptions {
  status?: WakeEngineStatus;
  wakeProvider?: string;
  microphoneName?: string;
  microphoneIndex?: number;
  availableDevices?: string[];
  sensitivity?: number;
  threshold?: number;
  isConfigured?: boolean;
}

export class MockWakeWordProvider implements WakeWordProvider {
  private logger = createLogger({ name: 'mave:providers:mock-wake' });
  private isRunning = false;
  private status: WakeEngineStatus = 'ready';
  private wakeProvider = 'openWakeWord';
  private microphoneName = 'Mock Microphone';
  private microphoneIndex = -1;
  private availableDevices: string[] = ['Default System Microphone', 'Mock Headset Mic'];
  private wakeWord = 'MAVE';
  private sensitivity = 0.5;
  private threshold = 0.5;
  private lastWakeAt?: number;
  private isConfigured = true;
  private errorMessage?: string;
  private latestScore = 0;
  private peakScore = 0;
  private lastWakeScore?: number;

  private wakeListeners = new Set<() => void>();
  private errorListeners = new Set<(err: Error) => void>();
  private telemetryListeners = new Set<(t: { latestScore: number; peakScore: number; lastWakeScore?: number; threshold: number }) => void>();

  constructor(options?: MockWakeWordProviderOptions) {
    if (options?.status) this.status = options.status;
    if (options?.wakeProvider) this.wakeProvider = options.wakeProvider;
    if (options?.microphoneName) this.microphoneName = options.microphoneName;
    if (options?.microphoneIndex !== undefined) this.microphoneIndex = options.microphoneIndex;
    if (options?.availableDevices) this.availableDevices = options.availableDevices;
    if (options?.sensitivity !== undefined) this.sensitivity = options.sensitivity;
    if (options?.threshold !== undefined) this.threshold = options.threshold;
    if (options?.isConfigured !== undefined) this.isConfigured = options.isConfigured;
  }

  async start(): Promise<void> {
    if (!this.isConfigured) {
      this.status = 'not_configured';
      return;
    }
    if (this.isRunning) {
      this.logger.debug('MockWakeWordProvider: start called while already running (idempotent)');
      return;
    }
    this.isRunning = true;
    this.status = 'listening';
    this.logger.info('wake.started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.debug('MockWakeWordProvider: stop called while not running (idempotent)');
      return;
    }
    this.isRunning = false;
    this.status = 'ready';
    this.logger.info('wake.stopped');
  }

  async dispose(): Promise<void> {
    await this.stop();
    this.status = 'not_configured';
    this.wakeListeners.clear();
    this.errorListeners.clear();
    this.telemetryListeners.clear();
    this.logger.info('wake.disposed');
  }

  onWake(callback: () => void): () => void {
    this.wakeListeners.add(callback);
    return () => {
      this.wakeListeners.delete(callback);
    };
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorListeners.add(callback);
    return () => {
      this.errorListeners.delete(callback);
    };
  }

  onTelemetry(
    callback: (telemetry: {
      latestScore: number;
      peakScore: number;
      lastWakeScore?: number;
      threshold: number;
    }) => void
  ): () => void {
    this.telemetryListeners.add(callback);
    return () => {
      this.telemetryListeners.delete(callback);
    };
  }

  getStatus(): WakeEngineStatus {
    return this.status;
  }

  getDiagnostics(): WakeDiagnostics {
    return {
      status: this.status,
      wakeProvider: this.wakeProvider,
      microphoneName: this.microphoneName,
      microphoneIndex: this.microphoneIndex,
      availableDevices: this.availableDevices,
      wakeWord: this.wakeWord,
      sensitivity: this.sensitivity,
      threshold: this.threshold,
      lastWakeAt: this.lastWakeAt,
      isConfigured: this.isConfigured,
      errorMessage: this.errorMessage,
      latestScore: this.latestScore,
      peakScore: this.peakScore,
      lastWakeScore: this.lastWakeScore
    };
  }

  get running(): boolean {
    return this.isRunning;
  }

  simulateWake(score: number = 0.88): void {
    this.lastWakeAt = Date.now();
    this.lastWakeScore = score;
    this.peakScore = Math.max(this.peakScore, score);
    this.latestScore = score;
    this.logger.info({ lastWakeAt: this.lastWakeAt, score }, 'wake.detected');
    for (const listener of this.wakeListeners) {
      try {
        listener();
      } catch (err) {
        this.logger.error({ err }, 'error in wake listener');
      }
    }
    for (const listener of this.telemetryListeners) {
      try {
        listener({
          latestScore: this.latestScore,
          peakScore: this.peakScore,
          lastWakeScore: this.lastWakeScore,
          threshold: this.threshold
        });
      } catch (err) {
        this.logger.error({ err }, 'error in telemetry listener');
      }
    }
  }

  setTelemetry(latest: number, peak: number, lastWake?: number): void {
    this.latestScore = latest;
    this.peakScore = peak;
    if (lastWake !== undefined) this.lastWakeScore = lastWake;
    for (const listener of this.telemetryListeners) {
      try {
        listener({
          latestScore: this.latestScore,
          peakScore: this.peakScore,
          lastWakeScore: this.lastWakeScore,
          threshold: this.threshold
        });
      } catch {}
    }
  }

  simulateError(err: Error): void {
    this.status = 'error';
    this.errorMessage = err.message;
    this.logger.error({ err: err.message }, 'wake.error');
    for (const listener of this.errorListeners) {
      try {
        listener(err);
      } catch {}
    }
  }

  setAvailableDevices(devices: string[]): void {
    this.availableDevices = devices;
  }

  setMicrophone(index: number, name?: string): void {
    this.microphoneIndex = index;
    if (name) {
      this.microphoneName = name;
    } else if (index === -1) {
      this.microphoneName = 'Default Microphone';
    } else if (this.availableDevices[index]) {
      this.microphoneName = this.availableDevices[index];
    }
    this.logger.info({ index, name: this.microphoneName }, 'audio.device_selected');
  }

  setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(0, Math.min(1, sensitivity));
    this.threshold = this.sensitivity;
  }

  setThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold));
    this.sensitivity = this.threshold;
  }

  async testAudioFile(wavPath: string): Promise<OfflineWavTestResult> {
    this.logger.info({ wavPath }, 'offline_test.completed');
    return {
      path: wavPath,
      maxScore: 0.85,
      wakeDetected: true,
      framesProcessed: 10,
      scores: [0.1, 0.2, 0.85]
    };
  }
}
