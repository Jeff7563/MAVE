import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AudioCaptureOptions,
  AudioFrame,
  AudioInputDevice,
  AudioInputProvider,
  ProviderHealth
} from '@mave/contracts';
import {
  DEFAULT_AUDIO_FORMAT,
  DEFAULT_AUDIO_FRAME_SAMPLES,
  validateAudioFrame
} from '@mave/contracts';
import { createLogger } from '@mave/shared';
import {
  findRepoRoot,
  resolveWakePythonExecutable
} from '../wake/openwakeword.js';

export interface SounddeviceAudioInputOptions {
  id?: string;
  pythonExecutable?: string;
  rootDir?: string;
  deviceId?: string;
  sampleRate?: number;
  chunkSize?: number;
  spawnFn?: (command: string, args: string[], options: any) => ChildProcess;
  fsExistsFn?: (filePath: string) => boolean;
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
  maxQueueSize?: number;
}

export class SounddeviceAudioInputProvider implements AudioInputProvider {
  readonly id: string;
  private readonly options: SounddeviceAudioInputOptions;
  private readonly logger = createLogger({ name: 'mave:providers:sounddevice-input' });
  private readonly activeProcesses = new Set<ChildProcess>();
  private isDisposed = false;

  constructor(options: SounddeviceAudioInputOptions = {}) {
    this.options = { ...options };
    this.id = options.id ?? 'sounddevice-audio-input';
  }

  private resolveRootDir(): string {
    if (this.options.rootDir) {
      return this.options.rootDir;
    }
    return findRepoRoot(process.cwd(), this.options.fsExistsFn, this.options.platform);
  }

  private resolvePythonPath(): string {
    return resolveWakePythonExecutable({
      pythonExecutable: this.options.pythonExecutable,
      rootDir: this.options.rootDir,
      env: this.options.env,
      platform: this.options.platform,
      fsExistsFn: this.options.fsExistsFn
    });
  }

  public getResolvedPythonExecutable(): string {
    return this.resolvePythonPath();
  }

  async listDevices(): Promise<AudioInputDevice[]> {
    if (this.isDisposed) {
      throw new Error(`Cannot list devices on disposed provider (${this.id})`);
    }

    const pythonExe = this.resolvePythonPath();
    const rootDir = this.resolveRootDir();
    const wakeDir = path.resolve(rootDir, 'services/wake');

    return new Promise<AudioInputDevice[]>((resolve, reject) => {
      const args = ['-m', 'mave_wake.voice_capture', '--list-devices'];
      const spawnImpl = this.options.spawnFn ?? spawn;

      let child: ChildProcess;
      try {
        child = spawnImpl(pythonExe, args, {
          cwd: wakeDir,
          env: {
            ...process.env,
            ...this.options.env,
            PYTHONUNBUFFERED: '1'
          },
          stdio: ['ignore', 'pipe', 'pipe']
        });
      } catch (err: any) {
        reject(
          new Error(
            `Microphone capture device query failed to spawn: ${err.message ?? 'Unknown spawn error'}`
          )
        );
        return;
      }

      this.activeProcesses.add(child);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer | string) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer | string) => {
        stderr += data.toString();
      });

      child.on('error', (err: Error) => {
        this.activeProcesses.delete(child);
        reject(new Error(`Audio device enumeration process error: ${err.message}`));
      });

      child.on('close', (code: number | null) => {
        this.activeProcesses.delete(child);
        if (code !== 0) {
          reject(
            new Error(
              `Audio device enumeration exited with code ${code}: ${stderr.trim() || 'No error details'}`
            )
          );
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          if (!Array.isArray(parsed)) {
            throw new Error('Device list response is not a valid JSON array');
          }
          const devices: AudioInputDevice[] = parsed.map((d: any) => ({
            id: String(d.id),
            label: String(d.label || `Microphone ${d.id}`),
            isDefault: Boolean(d.isDefault)
          }));
          resolve(devices);
        } catch (err: any) {
          reject(new Error(`Failed to parse audio input device list: ${err.message}`));
        }
      });
    });
  }

  async *capture(options?: AudioCaptureOptions): AsyncIterable<AudioFrame> {
    if (this.isDisposed) {
      throw new Error(`Cannot capture from disposed SounddeviceAudioInputProvider (${this.id})`);
    }

    const signal = options?.signal;
    if (signal?.aborted) {
      return;
    }

    const deviceId = options?.deviceId ?? this.options.deviceId;
    const pythonExe = this.resolvePythonPath();
    const rootDir = this.resolveRootDir();
    const wakeDir = path.resolve(rootDir, 'services/wake');

    const sampleRate = this.options.sampleRate ?? DEFAULT_AUDIO_FORMAT.sampleRate;
    const chunkSize = this.options.chunkSize ?? DEFAULT_AUDIO_FRAME_SAMPLES;
    const expectedFrameBytes = chunkSize * 2; // 2560 bytes
    const maxPendingFrames = this.options.maxQueueSize ?? 100;

    const args = [
      '-m',
      'mave_wake.voice_capture',
      '--sample-rate',
      String(sampleRate),
      '--chunk-size',
      String(chunkSize)
    ];
    if (deviceId) {
      args.push('--device', deviceId);
    }

    const spawnImpl = this.options.spawnFn ?? spawn;
    let child: ChildProcess;
    try {
      child = spawnImpl(pythonExe, args, {
        cwd: wakeDir,
        env: {
          ...process.env,
          ...this.options.env,
          PYTHONUNBUFFERED: '1'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err: any) {
      throw new Error(
        `Microphone capture process failed to start: ${err.message ?? 'Unknown spawn error'}`
      );
    }

    this.activeProcesses.add(child);

    const frameQueue: AudioFrame[] = [];
    let queueResolver: (() => void) | null = null;
    let isStreamEnded = false;
    let streamError: Error | null = null;

    const notifyQueue = () => {
      if (queueResolver) {
        const resolve = queueResolver;
        queueResolver = null;
        resolve();
      }
    };

    let sequence = 0;
    let buffer = Buffer.alloc(0);
    let stderrOutput = '';

    child.stderr?.on('data', (data: Buffer | string) => {
      stderrOutput += data.toString();
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      if (signal?.aborted || isStreamEnded) {
        return;
      }

      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= expectedFrameBytes) {
        const frameData = new Uint8Array(buffer.subarray(0, expectedFrameBytes));
        buffer = buffer.subarray(expectedFrameBytes);

        const seq = sequence++;
        const frame: AudioFrame = {
          sequence: seq,
          timestampMs: Math.round(seq * ((chunkSize / sampleRate) * 1000)),
          format: DEFAULT_AUDIO_FORMAT,
          data: frameData
        };

        validateAudioFrame(frame);

        if (frameQueue.length >= maxPendingFrames) {
          // Bounded queue: drop oldest frame to maintain real-time low latency
          frameQueue.shift();
          this.logger.warn({ id: this.id }, 'audio frame queue overflow: dropped oldest frame');
        }

        frameQueue.push(frame);
        notifyQueue();
      }
    });

    const cleanupProcess = () => {
      this.activeProcesses.delete(child);
      if (!child.killed) {
        try {
          child.stdin?.end();
          child.kill('SIGINT');
          setTimeout(() => {
            if (!child.killed) {
              try {
                child.kill('SIGTERM');
              } catch {}
            }
          }, 300);
        } catch {
          // Process already ended
        }
      }
    };

    const onAbort = () => {
      isStreamEnded = true;
      cleanupProcess();
      notifyQueue();
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    child.on('error', (err: Error) => {
      streamError = new Error(`Audio capture process error: ${err.message}`);
      isStreamEnded = true;
      cleanupProcess();
      notifyQueue();
    });

    child.on('close', (code: number | null) => {
      // If there is leftover audio on normal completion, emit short final frame
      if (!signal?.aborted && buffer.length > 0 && buffer.length % 2 === 0) {
        const seq = sequence++;
        const finalFrame: AudioFrame = {
          sequence: seq,
          timestampMs: Math.round(seq * ((chunkSize / sampleRate) * 1000)),
          format: DEFAULT_AUDIO_FORMAT,
          data: new Uint8Array(buffer),
          isFinalChunk: true
        };
        try {
          validateAudioFrame(finalFrame, { allowShortFinalFrame: true });
          frameQueue.push(finalFrame);
        } catch {}
        buffer = Buffer.alloc(0);
      }

      if (code !== 0 && code !== null && !signal?.aborted && !this.isDisposed) {
        const rawErr = stderrOutput.trim();
        let normalized = `Audio capture process terminated with code ${code}`;
        if (rawErr.toLowerCase().includes('not found') || rawErr.toLowerCase().includes('invalid device')) {
          normalized = `Audio input device '${deviceId ?? 'default'}' not found or unavailable`;
        } else if (rawErr.toLowerCase().includes('busy') || rawErr.toLowerCase().includes('permission')) {
          normalized = `Audio input device '${deviceId ?? 'default'}' is busy or permission was denied`;
        } else if (rawErr.length > 0) {
          normalized = `Audio capture process failed: ${rawErr}`;
        }
        streamError = new Error(normalized);
      }

      isStreamEnded = true;
      cleanupProcess();
      notifyQueue();
    });

    try {
      while (true) {
        if (signal?.aborted) {
          return;
        }

        if (frameQueue.length > 0) {
          yield frameQueue.shift()!;
          continue;
        }

        if (isStreamEnded) {
          if (streamError) {
            throw streamError;
          }
          return;
        }

        await new Promise<void>((resolve) => {
          queueResolver = resolve;
        });
      }
    } finally {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      cleanupProcess();
    }
  }

  async health(): Promise<ProviderHealth> {
    if (this.isDisposed) {
      return {
        status: 'degraded',
        message: `${this.id} is disposed`,
        checkedAt: Date.now()
      };
    }

    try {
      const pythonExe = this.resolvePythonPath();
      const existsFn = this.options.fsExistsFn ?? fs.existsSync;
      const rootDir = this.resolveRootDir();
      const wakeDir = path.resolve(rootDir, 'services/wake');

      const isPythonReady = existsFn(pythonExe) || pythonExe === 'python' || pythonExe === 'python3';
      const isWakeServiceReady = existsFn(wakeDir);

      if (!isPythonReady || !isWakeServiceReady) {
        return {
          status: 'unhealthy',
          message: `Audio input environment missing: python=${isPythonReady}, wakeDir=${isWakeServiceReady}`,
          checkedAt: Date.now()
        };
      }

      return {
        status: 'healthy',
        message: `${this.id} is ready`,
        checkedAt: Date.now()
      };
    } catch (err: any) {
      return {
        status: 'unhealthy',
        message: err.message ?? 'Unknown health check error',
        checkedAt: Date.now()
      };
    }
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) return;
    this.isDisposed = true;

    for (const child of this.activeProcesses) {
      if (!child.killed) {
        try {
          child.stdin?.end();
          child.kill('SIGTERM');
        } catch {}
      }
    }
    this.activeProcesses.clear();
  }
}
