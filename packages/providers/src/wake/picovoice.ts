import path from 'node:path';
import fs from 'node:fs';
import { Porcupine } from '@picovoice/porcupine-node';
import { PvRecorder } from '@picovoice/pvrecorder-node';
import type {
  WakeWordProvider,
  WakeDiagnostics,
  WakeEngineStatus
} from '@mave/contracts';
import { createLogger } from '@mave/shared';

export interface PorcupineLike {
  frameLength: number;
  sampleRate: number;
  process: (pcm: Int16Array) => number;
  release: () => void;
}

export interface PvRecorderLike {
  isRecording: boolean;
  start: () => void;
  stop: () => void;
  read: () => Promise<Int16Array>;
  release: () => void;
  getSelectedDevice?: () => string;
}

export interface PicovoiceWakeWordProviderOptions {
  accessKey?: string;
  keywordModelPath?: string;
  sensitivity?: number;
  deviceIndex?: number;
  rootDir?: string;
  porcupineFactory?: (
    accessKey: string,
    keywordPaths: string[],
    sensitivities: number[]
  ) => PorcupineLike;
  recorderFactory?: (frameLength: number, deviceIndex: number) => PvRecorderLike;
  getAvailableDevices?: () => string[];
}

export class PicovoiceWakeWordProvider implements WakeWordProvider {
  private logger = createLogger({ name: 'mave:providers:picovoice' });
  private options: PicovoiceWakeWordProviderOptions;

  private isRunning = false;
  private isLoopRunning = false;
  private isDisposed = false;

  private status: WakeEngineStatus = 'not_configured';
  private microphoneName = 'Default Microphone';
  private microphoneIndex = -1;
  private availableDevices: string[] = [];
  private wakeWord = 'MAVE';
  private sensitivity = 0.5;
  private lastWakeAt?: number;
  private isConfigured = false;
  private errorMessage?: string;

  private porcupine: PorcupineLike | null = null;
  private recorder: PvRecorderLike | null = null;

  private wakeListeners = new Set<() => void>();
  private errorListeners = new Set<(err: Error) => void>();

  constructor(options?: PicovoiceWakeWordProviderOptions) {
    this.options = options ?? {};
    if (this.options.sensitivity !== undefined) {
      this.sensitivity = Math.max(0, Math.min(1, this.options.sensitivity));
    }
    if (this.options.deviceIndex !== undefined) {
      this.microphoneIndex = this.options.deviceIndex;
    }
  }

  async initialize(): Promise<boolean> {
    this.logger.info('wake.initializing');
    this.status = 'initializing';
    this.errorMessage = undefined;

    // 1. Validate AccessKey
    const accessKey = this.options.accessKey || process.env['PICOVOICE_ACCESS_KEY'] || '';
    if (!accessKey.trim()) {
      this.status = 'not_configured';
      this.errorMessage = 'Picovoice AccessKey is not configured (set PICOVOICE_ACCESS_KEY in .env)';
      this.isConfigured = false;
      this.logger.info('wake engine missing AccessKey; remaining in not_configured state');
      return false;
    }

    // 2. Validate Keyword Model Path
    const rootDir = this.options.rootDir || process.cwd();
    const rawModelPath = this.options.keywordModelPath || 'assets/wake/mave_windows.ppn';
    const resolvedModelPath = path.isAbsolute(rawModelPath)
      ? rawModelPath
      : path.resolve(rootDir, rawModelPath);

    if (!fs.existsSync(resolvedModelPath)) {
      this.status = 'not_configured';
      this.errorMessage = `Keyword model file missing: ${resolvedModelPath}`;
      this.isConfigured = false;
      this.logger.info({ path: resolvedModelPath }, 'keyword model file not found; remaining in not_configured state');
      return false;
    }

    // 3. Enumerate and validate audio devices
    try {
      const getDevices = this.options.getAvailableDevices || (() => PvRecorder.getAvailableDevices());
      this.availableDevices = getDevices();
    } catch (err) {
      this.logger.warn({ err }, 'failed to enumerate audio devices');
      this.availableDevices = [];
    }

    if (this.availableDevices.length === 0) {
      this.status = 'error';
      this.errorMessage = 'No audio input devices detected';
      this.isConfigured = false;
      this.logger.warn('audio.device_missing');
      return false;
    }

    // Resolve microphone selection
    if (this.microphoneIndex === -1) {
      this.microphoneName = this.availableDevices[0] || 'Default System Microphone';
    } else if (this.availableDevices[this.microphoneIndex]) {
      this.microphoneName = this.availableDevices[this.microphoneIndex] || 'Default System Microphone';
    } else {
      this.logger.warn(
        { requestedIndex: this.microphoneIndex },
        'audio.device_missing: configured index unavailable, falling back to default'
      );
      this.microphoneIndex = -1;
      this.microphoneName = this.availableDevices[0] || 'Default System Microphone';
    }

    this.logger.info(
      { device: this.microphoneName, index: this.microphoneIndex },
      'audio.device_selected'
    );

    // 4. Instantiate Porcupine and PvRecorder
    try {
      const porcupineFactory =
        this.options.porcupineFactory ||
        ((key, paths, sensitivities) => new Porcupine(key, paths, sensitivities) as unknown as PorcupineLike);

      this.porcupine = porcupineFactory(accessKey, [resolvedModelPath], [this.sensitivity]);

      const recorderFactory =
        this.options.recorderFactory ||
        ((frameLength, devIndex) => new PvRecorder(frameLength, devIndex) as unknown as PvRecorderLike);

      this.recorder = recorderFactory(this.porcupine.frameLength, this.microphoneIndex);

      this.status = 'ready';
      this.isConfigured = true;
      this.errorMessage = undefined;

      this.logger.info(
        {
          device: this.microphoneName,
          sensitivity: this.sensitivity,
          frameLength: this.porcupine.frameLength
        },
        'wake.ready'
      );
      return true;
    } catch (err) {
      // Secure logging: sanitize any potential secret leak in error message
      const rawError = err instanceof Error ? err.message : String(err);
      const sanitizedError = accessKey ? rawError.split(accessKey).join('[REDACTED]') : rawError;

      this.logger.error({ error: sanitizedError }, 'wake.error');
      this.status = 'error';
      this.errorMessage = sanitizedError;
      this.isConfigured = false;

      this.safeReleaseResources();
      return false;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('start() called while already running (idempotent)');
      return;
    }

    if (!this.porcupine || !this.recorder) {
      const initialized = await this.initialize();
      if (!initialized || !this.recorder || !this.porcupine) {
        this.logger.debug('start() skipped: wake engine not configured or unavailable');
        return;
      }
    }

    try {
      this.isRunning = true;
      this.recorder.start();
      this.status = 'listening';
      this.logger.info('wake.started');
      this.runCaptureLoop();
    } catch (err) {
      this.isRunning = false;
      this.status = 'error';
      const msg = err instanceof Error ? err.message : String(err);
      this.errorMessage = msg;
      this.logger.error({ error: msg }, 'wake.error');
      for (const listener of this.errorListeners) {
        try {
          listener(err instanceof Error ? err : new Error(msg));
        } catch {}
      }
    }
  }

  private async runCaptureLoop(): Promise<void> {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    try {
      while (this.isRunning && this.recorder && this.porcupine) {
        // Asynchronously await frame from recorder (non-blocking for Electron)
        const frame = await this.recorder.read();
        if (!this.isRunning || !this.porcupine) break;

        const keywordIndex = this.porcupine.process(frame);
        if (keywordIndex >= 0) {
          this.lastWakeAt = Date.now();
          this.logger.info(
            { keywordIndex, lastWakeAt: this.lastWakeAt, keyword: this.wakeWord },
            'wake.detected'
          );

          for (const listener of this.wakeListeners) {
            try {
              listener();
            } catch (err) {
              this.logger.error({ err }, 'error in wake listener callback');
            }
          }
        }
      }
    } catch (err) {
      if (this.isRunning) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error({ error: errorMsg }, 'wake.error');
        this.status = 'error';
        this.errorMessage = errorMsg;

        for (const listener of this.errorListeners) {
          try {
            listener(err instanceof Error ? err : new Error(errorMsg));
          } catch {}
        }
      }
    } finally {
      this.isLoopRunning = false;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.debug('stop() called while not running (idempotent)');
      return;
    }

    this.isRunning = false;

    if (this.recorder && this.recorder.isRecording) {
      try {
        this.recorder.stop();
      } catch (err) {
        this.logger.warn({ err }, 'error stopping recorder');
      }
    }

    if (this.status === 'listening') {
      this.status = 'ready';
    }

    this.logger.info('wake.stopped');
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) return;
    await this.stop();
    this.safeReleaseResources();
    this.status = 'not_configured';
    this.wakeListeners.clear();
    this.errorListeners.clear();
    this.isDisposed = true;
    this.logger.info('wake.disposed');
  }

  async restart(): Promise<void> {
    this.logger.info('wake.restarting');
    const wasRunning = this.isRunning;
    await this.stop();
    this.safeReleaseResources();
    this.isDisposed = false;
    const initialized = await this.initialize();
    if (wasRunning && initialized) {
      await this.start();
    }
  }

  private safeReleaseResources(): void {
    if (this.recorder) {
      try {
        this.recorder.release();
      } catch (err) {
        this.logger.warn({ err }, 'error releasing recorder');
      }
      this.recorder = null;
    }

    if (this.porcupine) {
      try {
        this.porcupine.release();
      } catch (err) {
        this.logger.warn({ err }, 'error releasing porcupine');
      }
      this.porcupine = null;
    }
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

  getStatus(): WakeEngineStatus {
    return this.status;
  }

  getDiagnostics(): WakeDiagnostics {
    return {
      status: this.status,
      microphoneName: this.microphoneName,
      microphoneIndex: this.microphoneIndex,
      availableDevices: this.availableDevices,
      wakeWord: this.wakeWord,
      sensitivity: this.sensitivity,
      lastWakeAt: this.lastWakeAt,
      isConfigured: this.isConfigured,
      errorMessage: this.errorMessage
    };
  }

  get running(): boolean {
    return this.isRunning;
  }

  async setMicrophone(deviceIndex: number): Promise<void> {
    this.microphoneIndex = deviceIndex;
    this.options.deviceIndex = deviceIndex;
    await this.restart();
  }

  async setSensitivity(sensitivity: number): Promise<void> {
    this.sensitivity = Math.max(0, Math.min(1, sensitivity));
    this.options.sensitivity = this.sensitivity;
    await this.restart();
  }
}
