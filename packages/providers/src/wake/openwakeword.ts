import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import type {
  WakeWordProvider,
  WakeDiagnostics,
  WakeEngineStatus,
  OfflineWavTestResult
} from '@mave/contracts';
import { createLogger } from '@mave/shared';

export interface OpenWakeWordProviderOptions {
  modelPath?: string;
  threshold?: number;
  deviceIndex?: number;
  pythonExecutable?: string;
  rootDir?: string;
  spawnFn?: (command: string, args: string[], options: any) => ChildProcess;
}

export class OpenWakeWordProvider implements WakeWordProvider {
  private logger = createLogger({ name: 'mave:providers:openwakeword' });
  private options: OpenWakeWordProviderOptions;

  private process: ChildProcess | null = null;
  private isRunning = false;
  private isDisposed = false;
  private restartAttempts = 0;
  private maxRestarts = 3;

  private status: WakeEngineStatus = 'not_configured';
  private wakeProvider = 'openWakeWord';
  private microphoneName = 'Default Microphone';
  private microphoneIndex = -1;
  private availableDevices: string[] = [];
  private wakeWord = 'MAVE';
  private threshold = 0.5;
  private lastWakeAt?: number;
  private isConfigured = false;
  private errorMessage?: string;

  private wakeListeners = new Set<() => void>();
  private errorListeners = new Set<(err: Error) => void>();
  private pendingWavTests = new Map<string, (result: OfflineWavTestResult) => void>();

  constructor(options?: OpenWakeWordProviderOptions) {
    this.options = options ?? {};
    if (this.options.threshold !== undefined) {
      this.threshold = Math.max(0, Math.min(1, this.options.threshold));
    }
    if (this.options.deviceIndex !== undefined) {
      this.microphoneIndex = this.options.deviceIndex;
    }
  }

  private resolvePythonPath(): string {
    if (this.options.pythonExecutable) {
      return this.options.pythonExecutable;
    }
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  private resolveRootDir(): string {
    if (this.options.rootDir) {
      return this.options.rootDir;
    }
    return path.resolve(process.cwd());
  }

  private ensureProcessStarted(): Promise<void> {
    if (this.process && !this.process.killed) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const rootDir = this.resolveRootDir();
      const pythonExe = this.resolvePythonPath();
      const wakeServiceDir = path.resolve(rootDir, 'services/wake');
      const wakeSrcDir = path.resolve(wakeServiceDir, 'src');

      const modelPath = this.options.modelPath || 'assets/wake/mave.onnx';

      const args = [
        '-u',
        '-m',
        'mave_wake.main',
        '--model',
        modelPath,
        '--threshold',
        String(this.threshold)
      ];

      if (this.microphoneIndex >= 0) {
        args.push('--device', String(this.microphoneIndex));
      }

      this.logger.info(
        { pythonExe, modelPath, threshold: this.threshold },
        'wake.supervisor.spawning_service'
      );

      const spawnProcess = this.options.spawnFn || spawn;
      const child = spawnProcess(pythonExe, args, {
        cwd: rootDir,
        env: {
          ...process.env,
          PYTHONPATH: wakeSrcDir
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process = child;
      let initialStatusReceived = false;

      if (child.stdout) {
        const rl = readline.createInterface({
          input: child.stdout,
          terminal: false
        });

        rl.on('line', (line) => {
          this.handleProtocolMessage(line);
          if (!initialStatusReceived) {
            initialStatusReceived = true;
            resolve();
          }
        });
      }

      if (child.stderr) {
        const errRl = readline.createInterface({
          input: child.stderr,
          terminal: false
        });

        errRl.on('line', (line) => {
          this.logger.debug({ log: line }, 'wake.python.stderr');
        });
      }

      child.on('error', (err) => {
        this.logger.error({ err: err.message }, 'wake.supervisor.process_error');
        this.status = 'error';
        this.errorMessage = `Python wake service error: ${err.message}`;
        this.notifyError(err);
        if (!initialStatusReceived) {
          initialStatusReceived = true;
          resolve();
        }
      });

      child.on('exit', (code, signal) => {
        this.logger.info({ code, signal }, 'wake.supervisor.process_exited');
        this.process = null;

        if (this.isRunning && !this.isDisposed) {
          if (this.restartAttempts < this.maxRestarts) {
            this.restartAttempts++;
            this.logger.warn(
              { attempt: this.restartAttempts, max: this.maxRestarts },
              'wake.supervisor.unexpected_exit: restarting'
            );
            setTimeout(() => {
              if (this.isRunning && !this.isDisposed) {
                this.ensureProcessStarted().then(() => {
                  this.sendCommand({ command: 'start' });
                });
              }
            }, 1000 * this.restartAttempts);
          } else {
            this.status = 'error';
            this.errorMessage = `Python wake service exited unexpectedly with code ${code}`;
            this.notifyError(new Error(this.errorMessage));
          }
        }
      });

      // Bounded fallback in case initial message is delayed
      setTimeout(() => {
        if (!initialStatusReceived) {
          initialStatusReceived = true;
          resolve();
        }
      }, 2000);
    });
  }

  private handleProtocolMessage(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const msg = JSON.parse(trimmed);
      if (!msg || typeof msg !== 'object') return;

      switch (msg.type) {
        case 'status': {
          this.status = (msg.status as WakeEngineStatus) || 'ready';
          this.microphoneName = msg.device || this.microphoneName;
          this.microphoneIndex = msg.device_index !== undefined ? msg.device_index : this.microphoneIndex;
          this.threshold = msg.threshold !== undefined ? msg.threshold : this.threshold;
          this.availableDevices = Array.isArray(msg.available_devices) ? msg.available_devices : this.availableDevices;
          this.isConfigured = Boolean(msg.model_loaded);
          this.errorMessage = msg.error_message || undefined;
          this.logger.info(
            { status: this.status, device: this.microphoneName, threshold: this.threshold },
            'wake.status_updated'
          );
          break;
        }

        case 'wake_detected': {
          this.lastWakeAt = msg.timestamp || Date.now();
          this.logger.info(
            { model: msg.model, score: msg.score, lastWakeAt: this.lastWakeAt },
            'wake.detected'
          );
          for (const listener of this.wakeListeners) {
            try {
              listener();
            } catch (err) {
              this.logger.error({ err }, 'error in wake listener callback');
            }
          }
          break;
        }

        case 'error': {
          const errMessage = msg.message || 'Unknown wake service error';
          this.status = 'error';
          this.errorMessage = errMessage;
          this.logger.error({ code: msg.code, error: errMessage }, 'wake.error');
          this.notifyError(new Error(errMessage));
          break;
        }

        case 'test_audio_result': {
          const pathKey = msg.path;
          const resolver = this.pendingWavTests.get(pathKey);
          if (resolver) {
            this.pendingWavTests.delete(pathKey);
            resolver({
              path: msg.path,
              maxScore: msg.max_score,
              wakeDetected: msg.wake_detected,
              framesProcessed: msg.frames_processed,
              scores: msg.scores,
              error: msg.error
            });
          }
          break;
        }

        default:
          this.logger.debug({ type: msg.type }, 'unhandled protocol event');
          break;
      }
    } catch (err) {
      this.logger.warn({ line: trimmed, err }, 'failed to parse protocol JSON line');
    }
  }

  private sendCommand(commandObj: Record<string, unknown>): void {
    if (!this.process || !this.process.stdin || this.process.killed) {
      return;
    }
    try {
      this.process.stdin.write(JSON.stringify(commandObj) + '\n');
    } catch (err) {
      this.logger.error({ err }, 'failed to send command to Python wake service');
    }
  }

  private notifyError(err: Error): void {
    for (const listener of this.errorListeners) {
      try {
        listener(err);
      } catch {}
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('start() called while already running (idempotent)');
      return;
    }

    this.isRunning = true;
    this.restartAttempts = 0;
    await this.ensureProcessStarted();

    if (this.status === 'not_configured') {
      this.logger.info('wake.service not configured (missing model)');
      return;
    }

    this.sendCommand({ command: 'start' });
    this.status = 'listening';
    this.logger.info('wake.started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.debug('stop() called while not running (idempotent)');
      return;
    }

    this.isRunning = false;
    this.sendCommand({ command: 'stop' });
    if (this.status === 'listening') {
      this.status = 'ready';
    }
    this.logger.info('wake.stopped');
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.isRunning = false;

    if (this.process && !this.process.killed) {
      try {
        this.sendCommand({ command: 'quit' });
      } catch {}

      // Force kill if process does not exit in 500ms
      const proc = this.process;
      setTimeout(() => {
        if (!proc.killed) {
          try {
            proc.kill();
          } catch {}
        }
      }, 500);

      this.process = null;
    }

    this.status = 'not_configured';
    this.wakeListeners.clear();
    this.errorListeners.clear();
    this.pendingWavTests.clear();
    this.logger.info('wake.disposed');
  }

  async restart(): Promise<void> {
    this.logger.info('wake.restarting');
    const wasRunning = this.isRunning;
    await this.dispose();
    this.isDisposed = false;
    await this.ensureProcessStarted();
    if (wasRunning) {
      await this.start();
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
      wakeProvider: this.wakeProvider,
      microphoneName: this.microphoneName,
      microphoneIndex: this.microphoneIndex,
      availableDevices: this.availableDevices,
      wakeWord: this.wakeWord,
      sensitivity: this.threshold,
      threshold: this.threshold,
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
    this.sendCommand({ command: 'set_device', index: deviceIndex });
  }

  async setSensitivity(threshold: number): Promise<void> {
    this.threshold = Math.max(0, Math.min(1, threshold));
    this.options.threshold = this.threshold;
    this.sendCommand({ command: 'set_threshold', threshold: this.threshold });
  }

  async setThreshold(threshold: number): Promise<void> {
    return this.setSensitivity(threshold);
  }

  async testAudioFile(wavPath: string): Promise<OfflineWavTestResult> {
    await this.ensureProcessStarted();
    return new Promise((resolve) => {
      this.pendingWavTests.set(wavPath, resolve);
      this.sendCommand({ command: 'test_audio_file', path: wavPath });

      // Fallback timeout in case file processing hangs
      setTimeout(() => {
        if (this.pendingWavTests.has(wavPath)) {
          this.pendingWavTests.delete(wavPath);
          resolve({
            path: wavPath,
            maxScore: 0.0,
            wakeDetected: false,
            framesProcessed: 0,
            error: 'Test audio processing timed out'
          });
        }
      }, 10000);
    });
  }
}

