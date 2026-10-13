import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type {
  AudioFrame,
  ProviderHealth,
  STTCapabilities,
  STTProvider,
  STTRequestOptions,
  TranscriptEvent
} from '@mave/contracts';
import {
  STTCapabilitiesSchema,
  TranscriptEventSchema
} from '@mave/contracts';
import { createLogger } from '@mave/shared';
import { findRepoRoot } from '../wake/openwakeword.js';

export interface ResolveSTTPythonOptions {
  pythonExecutable?: string;
  rootDir?: string;
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  fsExistsFn?: (filePath: string) => boolean;
}

export function resolveSTTPythonExecutable(options?: ResolveSTTPythonOptions): string {
  // 1. Explicit option
  if (options?.pythonExecutable && options.pythonExecutable.trim().length > 0) {
    return options.pythonExecutable.trim();
  }

  // 2. Environment override
  const env = options?.env ?? process.env;
  const envPython = env['MAVE_STT_PYTHON'];
  if (envPython && envPython.trim().length > 0) {
    return envPython.trim();
  }

  // 3. Repository-local STT virtual environment
  const platform = options?.platform ?? process.platform;
  const existsFn = options?.fsExistsFn ?? fs.existsSync;
  const pathLib = platform === 'win32' ? path.win32 : path.posix;

  const rawRootDir = options?.rootDir;
  const rootDir = rawRootDir
    ? pathLib.resolve(rawRootDir)
    : findRepoRoot(process.cwd(), existsFn, platform);

  const venvRelPath =
    platform === 'win32'
      ? pathLib.join('services', 'stt', '.venv', 'Scripts', 'python.exe')
      : pathLib.join('services', 'stt', '.venv', 'bin', 'python');

  const venvFullPath = pathLib.resolve(rootDir, venvRelPath);

  if (existsFn(venvFullPath)) {
    return venvFullPath;
  }

  // 4. Fallback to system Python
  return platform === 'win32' ? 'python' : 'python3';
}

export class AsyncEventQueue<T> {
  private readonly queue: T[] = [];
  private readonly resolvers: Array<(result: IteratorResult<T>) => void> = [];
  private isClosed = false;

  push(item: T): void {
    if (this.isClosed) {
      return;
    }
    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver({ value: item, done: false });
    } else {
      this.queue.push(item);
    }
  }

  close(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    while (this.resolvers.length > 0) {
      const resolver = this.resolvers.shift();
      resolver?.({ value: undefined as any, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
      } else if (this.isClosed) {
        return;
      } else {
        const result = await new Promise<IteratorResult<T>>((resolve) => {
          this.resolvers.push(resolve);
        });
        if (result.done) {
          return;
        }
        yield result.value;
      }
    }
  }
}

export interface FasterWhisperSTTOptions {
  id?: string;
  pythonExecutable?: string;
  rootDir?: string;
  model?: string;
  device?: string;
  computeType?: string;
  energyThreshold?: number;
  silenceDurationSec?: number;
  minSpeechDurationSec?: number;
  maxUtteranceSec?: number;
  beamSize?: number;
  preload?: boolean;
  spawnFn?: (command: string, args: string[], options: any) => ChildProcess;
  fsExistsFn?: (filePath: string) => boolean;
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
}

export class FasterWhisperSTTProvider implements STTProvider {
  readonly id: string;
  private readonly options: FasterWhisperSTTOptions;
  private readonly logger = createLogger({ name: 'mave:providers:faster-whisper' });

  private process: ChildProcess | null = null;
  private isDisposed = false;
  private readyEvent: any = null;
  private readyResolvers: Array<(val: any) => void> = [];

  private readonly activeRequests = new Map<
    string,
    {
      queue: AsyncEventQueue<TranscriptEvent>;
      options: STTRequestOptions;
    }
  >();

  constructor(options: FasterWhisperSTTOptions = {}) {
    this.options = { ...options };
    this.id = options.id ?? 'faster-whisper-local';

    if (this.options.preload) {
      this.ensureProcess().catch((err) => {
        this.logger.warn({ err }, 'Failed to preload faster-whisper process');
      });
    }
  }

  getCapabilities(): STTCapabilities {
    return STTCapabilitiesSchema.parse({
      streaming: true,
      partialTranscripts: false,
      languageDetection: true,
      wordTimestamps: true,
      confidence: true,
      local: true
    });
  }

  public getResolvedPythonExecutable(): string {
    return resolveSTTPythonExecutable({
      pythonExecutable: this.options.pythonExecutable,
      rootDir: this.options.rootDir,
      env: this.options.env,
      platform: this.options.platform,
      fsExistsFn: this.options.fsExistsFn
    });
  }

  private resolveRootDir(): string {
    if (this.options.rootDir) {
      return this.options.rootDir;
    }
    return findRepoRoot(process.cwd(), this.options.fsExistsFn, this.options.platform);
  }

  private async ensureProcess(): Promise<ChildProcess> {
    if (this.isDisposed) {
      throw new Error(`Cannot spawn STT process on disposed provider (${this.id})`);
    }

    if (this.process && !this.process.killed) {
      return this.process;
    }

    const pythonExe = this.getResolvedPythonExecutable();
    const rootDir = this.resolveRootDir();
    const sttDir = path.resolve(rootDir, 'services/stt');

    const args = [
      '-u',
      '-m',
      'mave_stt.server',
      '--model',
      this.options.model ?? 'large-v3-turbo',
      '--device',
      this.options.device ?? 'auto',
      '--compute-type',
      this.options.computeType ?? 'auto',
      '--energy-threshold',
      String(this.options.energyThreshold ?? 600.0),
      '--silence-duration',
      String(this.options.silenceDurationSec ?? 0.8),
      '--min-speech-duration',
      String(this.options.minSpeechDurationSec ?? 0.3),
      '--max-utterance',
      String(this.options.maxUtteranceSec ?? 20.0),
      '--beam-size',
      String(this.options.beamSize ?? 5)
    ];

    const spawnImpl = this.options.spawnFn ?? spawn;

    this.logger.info({ pythonExe, sttDir, args }, 'Spawning faster-whisper STT process');

    const child = spawnImpl(pythonExe, args, {
      cwd: sttDir,
      env: {
        ...process.env,
        ...this.options.env,
        PYTHONUNBUFFERED: '1'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process = child;
    this.readyEvent = null;

    if (child.stdout) {
      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        this.handleStdoutLine(trimmed);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8').trim();
        if (text) {
          this.logger.debug({ stderr: text }, 'STT process stderr');
        }
      });
    }

    child.on('error', (err: Error) => {
      this.logger.error({ err }, 'STT child process error');
    });

    child.on('exit', (code, signal) => {
      this.logger.info({ code, signal }, 'STT process exited');
      this.process = null;
      this.readyEvent = null;

      // Fail any pending active requests
      for (const [reqId, active] of this.activeRequests.entries()) {
        active.queue.push({
          type: 'error',
          requestId: reqId,
          error: {
            code: 'stt_unavailable',
            message: `STT service process terminated unexpectedly (code=${code}, signal=${signal})`,
            retryable: true
          },
          timestamp: Date.now()
        });
        active.queue.close();
      }
      this.activeRequests.clear();
    });

    // Wait for "ready" event with timeout
    await new Promise<void>((resolve, reject) => {
      if (this.readyEvent) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        // Even if ready timed out, don't crash if process is still running
        this.logger.warn('STT process ready event timeout; proceeding with execution');
        resolve();
      }, 5000);

      this.readyResolvers.push(() => {
        clearTimeout(timeout);
        resolve();
      });

      child.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      child.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`STT process exited immediately with code ${code}`));
      });
    });

    return child;
  }

  private handleStdoutLine(line: string): void {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'ready') {
        this.readyEvent = parsed;
        const resolvers = [...this.readyResolvers];
        this.readyResolvers = [];
        for (const res of resolvers) {
          res(parsed);
        }
        return;
      }

      if (parsed.type === 'health') {
        return;
      }

      const requestId = parsed.requestId;
      if (!requestId) return;

      const active = this.activeRequests.get(requestId);
      if (!active) return;

      if (parsed.type === 'completed') {
        // Internal completion signal from STT server on end of request
        active.queue.close();
        return;
      }

      const event = TranscriptEventSchema.parse(parsed);
      active.queue.push(event);

      if (
        event.type === 'final_transcript' ||
        event.type === 'cancelled' ||
        event.type === 'error'
      ) {
        active.queue.close();
      }
    } catch (err) {
      this.logger.debug({ err, line }, 'Failed to parse STT stdout line');
    }
  }

  private writeControlPacket(data: Record<string, unknown>): boolean {
    if (!this.process || !this.process.stdin || !this.process.stdin.writable) {
      return false;
    }
    try {
      const jsonBuf = Buffer.from(JSON.stringify(data), 'utf-8');
      const header = Buffer.alloc(5);
      header.writeUInt8(0x01, 0);
      header.writeUInt32BE(jsonBuf.length, 1);
      this.process.stdin.write(header);
      return this.process.stdin.write(jsonBuf);
    } catch (err) {
      this.logger.error({ err }, 'Failed to write control packet to STT stdin');
      return false;
    }
  }

  private writeAudioPacket(pcm: Uint8Array): boolean {
    if (!this.process || !this.process.stdin || !this.process.stdin.writable) {
      return false;
    }
    try {
      const buf = Buffer.isBuffer(pcm)
        ? pcm
        : Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      const header = Buffer.alloc(5);
      header.writeUInt8(0x02, 0);
      header.writeUInt32BE(buf.length, 1);
      this.process.stdin.write(header);
      return this.process.stdin.write(buf);
    } catch (err) {
      this.logger.error({ err }, 'Failed to write audio packet to STT stdin');
      return false;
    }
  }

  async health(): Promise<ProviderHealth> {
    const now = Date.now();
    if (this.isDisposed) {
      return {
        status: 'unhealthy',
        checkedAt: now,
        message: 'STT provider is disposed'
      };
    }

    const startMs = Date.now();
    try {
      const proc = await this.ensureProcess();
      if (!proc || proc.killed) {
        return {
          status: 'unhealthy',
          checkedAt: now,
          message: 'STT process is not running'
        };
      }
      this.writeControlPacket({ action: 'health' });
      const latencyMs = Date.now() - startMs;
      return {
        status: 'healthy',
        checkedAt: now,
        latencyMs,
        message: `faster-whisper (${this.options.model ?? 'large-v3-turbo'}) ready`
      };
    } catch (err: any) {
      return {
        status: 'unhealthy',
        checkedAt: now,
        message: `STT health check failed: ${err.message ?? 'Unknown error'}`
      };
    }
  }

  async *transcribe(
    audio: AsyncIterable<AudioFrame>,
    options: STTRequestOptions
  ): AsyncIterable<TranscriptEvent> {
    const requestId = options.requestId;

    if (this.isDisposed) {
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'stt_unavailable',
          message: 'STT provider is disposed',
          retryable: false
        },
        timestamp: Date.now()
      };
      return;
    }

    try {
      await this.ensureProcess();
    } catch (err: any) {
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'stt_unavailable',
          message: `Failed to spawn STT process: ${err.message ?? 'Unknown error'}`,
          retryable: true
        },
        timestamp: Date.now()
      };
      return;
    }

    const queue = new AsyncEventQueue<TranscriptEvent>();
    this.activeRequests.set(requestId, { queue, options });

    const onAbort = () => {
      this.cancel(requestId).catch(() => {});
    };

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
      } else {
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    // Send start control packet
    this.writeControlPacket({
      action: 'start',
      requestId,
      language: options.languageHint
    });

    // Stream audio in background pump
    const pumpPromise = (async () => {
      try {
        for await (const frame of audio) {
          if (
            options.signal?.aborted ||
            this.isDisposed ||
            !this.activeRequests.has(requestId)
          ) {
            break;
          }
          this.writeAudioPacket(frame.data);
        }

        if (
          !options.signal?.aborted &&
          !this.isDisposed &&
          this.activeRequests.has(requestId)
        ) {
          this.writeControlPacket({ action: 'end', requestId });
        }
      } catch (err: any) {
        this.logger.warn({ requestId, err }, 'STT audio pump stream error');
        if (this.activeRequests.has(requestId)) {
          this.writeControlPacket({ action: 'end', requestId });
        }
      }
    })();

    try {
      for await (const event of queue) {
        yield event;
        if (
          event.type === 'final_transcript' ||
          event.type === 'cancelled' ||
          event.type === 'error'
        ) {
          break;
        }
      }
    } finally {
      if (options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      this.activeRequests.delete(requestId);
      queue.close();
      await pumpPromise.catch(() => {});
    }
  }

  async cancel(requestId: string): Promise<void> {
    const active = this.activeRequests.get(requestId);
    if (!active) {
      return;
    }

    if (this.process && !this.process.killed && this.process.stdin?.writable) {
      this.writeControlPacket({
        action: 'cancel',
        requestId,
        reason: 'caller_cancelled'
      });
    } else {
      active.queue.push({
        type: 'cancelled',
        requestId,
        reason: 'cancelled_process_inactive',
        timestamp: Date.now()
      });
      active.queue.close();
      this.activeRequests.delete(requestId);
    }
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;

    if (this.process) {
      try {
        this.writeControlPacket({ action: 'shutdown' });
      } catch {}

      const proc = this.process;
      this.process = null;

      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          try {
            proc.kill();
          } catch {}
          resolve();
        }, 1000);

        proc.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    for (const [reqId, active] of this.activeRequests.entries()) {
      active.queue.push({
        type: 'cancelled',
        requestId: reqId,
        reason: 'provider_disposed',
        timestamp: Date.now()
      });
      active.queue.close();
    }
    this.activeRequests.clear();
  }
}
