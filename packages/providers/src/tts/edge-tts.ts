import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type {
  AudioFrame,
  ProviderHealth,
  SpeechEvent,
  SpeechRequest,
  TTSCapabilities,
  TTSProvider,
  TTSSynthesizeOptions
} from '@mave/contracts';
import {
  DEFAULT_AUDIO_FORMAT,
  TTSCapabilitiesSchema,
  validateAudioFrame
} from '@mave/contracts';
import { createLogger } from '@mave/shared';
import { findRepoRoot } from '../wake/openwakeword.js';

export interface ResolveTTSPythonOptions {
  pythonExecutable?: string;
  rootDir?: string;
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  fsExistsFn?: (filePath: string) => boolean;
}

export function resolveTTSPythonExecutable(options?: ResolveTTSPythonOptions): string {
  if (options?.pythonExecutable && options.pythonExecutable.trim().length > 0) {
    return options.pythonExecutable.trim();
  }

  const env = options?.env ?? process.env;
  const envPython = env['MAVE_TTS_PYTHON'];
  if (envPython && envPython.trim().length > 0) {
    return envPython.trim();
  }

  const platform = options?.platform ?? process.platform;
  const existsFn = options?.fsExistsFn ?? fs.existsSync;
  const pathLib = platform === 'win32' ? path.win32 : path.posix;

  const rawRootDir = options?.rootDir;
  const rootDir = rawRootDir
    ? pathLib.resolve(rawRootDir)
    : findRepoRoot(process.cwd(), existsFn, platform);

  // 1. Try dedicated services/tts/.venv
  const ttsVenvRel =
    platform === 'win32'
      ? pathLib.join('services', 'tts', '.venv', 'Scripts', 'python.exe')
      : pathLib.join('services', 'tts', '.venv', 'bin', 'python');
  const ttsVenvFull = pathLib.resolve(rootDir, ttsVenvRel);
  if (existsFn(ttsVenvFull)) {
    return ttsVenvFull;
  }

  // 2. Try shared services/stt/.venv
  const sttVenvRel =
    platform === 'win32'
      ? pathLib.join('services', 'stt', '.venv', 'Scripts', 'python.exe')
      : pathLib.join('services', 'stt', '.venv', 'bin', 'python');
  const sttVenvFull = pathLib.resolve(rootDir, sttVenvRel);
  if (existsFn(sttVenvFull)) {
    return sttVenvFull;
  }

  // 3. System fallback
  return platform === 'win32' ? 'python' : 'python3';
}

class AsyncEventQueue<T> {
  private readonly queue: T[] = [];
  private readonly resolvers: Array<(result: IteratorResult<T>) => void> = [];
  private isClosed = false;

  push(item: T): void {
    if (this.isClosed) return;
    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver({ value: item, done: false });
    } else {
      this.queue.push(item);
    }
  }

  close(): void {
    if (this.isClosed) return;
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
        if (result.done) return;
        yield result.value;
      }
    }
  }
}

export interface EdgeTTSOptions {
  id?: string;
  pythonExecutable?: string;
  rootDir?: string;
  defaultVoice?: string;
  spawnFn?: (command: string, args: string[], options: any) => ChildProcess;
  fsExistsFn?: (filePath: string) => boolean;
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
}

export class EdgeTTSProvider implements TTSProvider {
  readonly id: string;
  private readonly options: EdgeTTSOptions;
  private readonly logger = createLogger({ name: 'mave:providers:edge-tts' });

  private process: ChildProcess | null = null;
  private isDisposed = false;
  private readyEvent: any = null;
  private readyResolvers: Array<(val: any) => void> = [];

  private readonly activeRequests = new Map<
    string,
    {
      queue: AsyncEventQueue<SpeechEvent>;
      request: SpeechRequest;
    }
  >();

  constructor(options: EdgeTTSOptions = {}) {
    this.options = { ...options };
    this.id = options.id ?? 'edge-tts-provider';
  }

  getCapabilities(): TTSCapabilities {
    return TTSCapabilitiesSchema.parse({
      streaming: true,
      languages: ['th', 'en'],
      voiceSelection: true,
      speakingRate: true,
      wordTimings: false,
      local: false
    });
  }

  public getResolvedPythonExecutable(): string {
    return resolveTTSPythonExecutable({
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
      throw new Error(`Cannot spawn TTS process on disposed provider (${this.id})`);
    }

    if (this.process && !this.process.killed) {
      return this.process;
    }

    const pythonExe = this.getResolvedPythonExecutable();
    const rootDir = this.resolveRootDir();
    const ttsDir = path.resolve(rootDir, 'services/tts');

    const args = ['-u', '-m', 'mave_tts.server'];
    const spawnImpl = this.options.spawnFn ?? spawn;

    this.logger.info({ pythonExe, ttsDir, args }, 'Spawning edge-tts TTS process');

    const child = spawnImpl(pythonExe, args, {
      cwd: ttsDir,
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
          this.logger.debug({ stderr: text }, 'TTS process stderr');
        }
      });
    }

    child.on('error', (err: Error) => {
      this.logger.error({ err }, 'TTS child process error');
    });

    child.on('exit', (code, signal) => {
      this.logger.info({ code, signal }, 'TTS process exited');
      this.process = null;
      this.readyEvent = null;

      for (const [reqId, active] of this.activeRequests.entries()) {
        active.queue.push({
          type: 'error',
          requestId: reqId,
          error: {
            code: 'tts_unavailable',
            message: `TTS service process terminated unexpectedly (code=${code}, signal=${signal})`,
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
        this.logger.warn('TTS process ready event timeout; proceeding');
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
        reject(new Error(`TTS process exited immediately with code ${code}`));
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

      if (parsed.type === 'started') {
        active.queue.push({
          type: 'started',
          requestId,
          timestamp: parsed.timestamp ?? Date.now()
        });
      } else if (parsed.type === 'audio') {
        const rawBuf = Buffer.from(parsed.data, 'base64');
        const frame: AudioFrame = {
          sequence: parsed.sequence ?? 0,
          timestampMs: parsed.timestampMs ?? 0,
          format: DEFAULT_AUDIO_FORMAT,
          data: new Uint8Array(rawBuf)
        };
        validateAudioFrame(frame, { allowShortFinalFrame: true });
        active.queue.push({
          type: 'audio',
          requestId,
          frame,
          timestamp: parsed.timestamp ?? Date.now()
        });
      } else if (parsed.type === 'completed') {
        active.queue.push({
          type: 'completed',
          requestId,
          durationMs: parsed.durationMs,
          timestamp: parsed.timestamp ?? Date.now()
        });
        active.queue.close();
      } else if (parsed.type === 'cancelled') {
        active.queue.push({
          type: 'cancelled',
          requestId,
          reason: parsed.reason ?? 'cancelled',
          timestamp: parsed.timestamp ?? Date.now()
        });
        active.queue.close();
      } else if (parsed.type === 'error') {
        active.queue.push({
          type: 'error',
          requestId,
          error: {
            code: parsed.error?.code ?? 'tts_runtime_error',
            message: parsed.error?.message ?? 'TTS synthesis error',
            retryable: parsed.error?.retryable ?? false
          },
          timestamp: parsed.timestamp ?? Date.now()
        });
        active.queue.close();
      }
    } catch (err) {
      this.logger.debug({ err, line }, 'Failed to parse TTS stdout line');
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
      this.logger.error({ err }, 'Failed to write control packet to TTS stdin');
      return false;
    }
  }

  async health(): Promise<ProviderHealth> {
    const now = Date.now();
    if (this.isDisposed) {
      return {
        status: 'unhealthy',
        checkedAt: now,
        message: 'TTS provider is disposed'
      };
    }

    const startMs = Date.now();
    try {
      const proc = await this.ensureProcess();
      if (!proc || proc.killed) {
        return {
          status: 'unhealthy',
          checkedAt: now,
          message: 'TTS process is not running'
        };
      }
      this.writeControlPacket({ action: 'health' });
      const latencyMs = Date.now() - startMs;
      return {
        status: 'healthy',
        checkedAt: now,
        latencyMs,
        message: 'edge-tts neural provider ready'
      };
    } catch (err: any) {
      return {
        status: 'unhealthy',
        checkedAt: now,
        message: `TTS health check failed: ${err.message ?? 'Unknown error'}`
      };
    }
  }

  async *synthesize(
    request: SpeechRequest,
    options?: TTSSynthesizeOptions
  ): AsyncIterable<SpeechEvent> {
    const requestId = request.requestId;

    if (this.isDisposed) {
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'tts_unavailable',
          message: 'TTS provider is disposed',
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
          code: 'tts_unavailable',
          message: `Failed to spawn TTS process: ${err.message ?? 'Unknown error'}`,
          retryable: true
        },
        timestamp: Date.now()
      };
      return;
    }

    const queue = new AsyncEventQueue<SpeechEvent>();
    this.activeRequests.set(requestId, { queue, request });

    const onAbort = () => {
      this.cancel(requestId).catch(() => {});
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        onAbort();
      } else {
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    // Send synthesis request
    this.writeControlPacket({
      action: 'synthesize',
      requestId,
      text: request.text,
      language: request.language,
      voice: request.voiceId,
      rate: request.rate ?? 1.0,
      pitch: request.pitch ?? 1.0
    });

    try {
      for await (const event of queue) {
        yield event;
        if (
          event.type === 'completed' ||
          event.type === 'cancelled' ||
          event.type === 'error'
        ) {
          break;
        }
      }
    } finally {
      if (options?.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      this.activeRequests.delete(requestId);
      queue.close();
    }
  }

  async cancel(requestId: string): Promise<void> {
    const active = this.activeRequests.get(requestId);
    if (!active) return;

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
        reason: 'process_inactive',
        timestamp: Date.now()
      });
      active.queue.close();
      this.activeRequests.delete(requestId);
    }
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) return;
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
