import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import type {
  AudioFrame,
  AudioLevel,
  AudioOutput,
  AudioOutputDevice,
  AudioOutputPlaybackState,
  AudioPlaybackOptions
} from '@mave/contracts';
import {
  AudioLevelSchema,
  AudioOutputDeviceSchema
} from '@mave/contracts';
import { createLogger } from '@mave/shared';
import { findRepoRoot } from '../wake/openwakeword.js';
import { resolveTTSPythonExecutable } from '../tts/edge-tts.js';

export interface SounddeviceAudioOutputOptions {
  id?: string;
  pythonExecutable?: string;
  rootDir?: string;
  deviceId?: string;
  spawnFn?: (command: string, args: string[], options: any) => ChildProcess;
  fsExistsFn?: (filePath: string) => boolean;
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
}

export class SounddeviceAudioOutput implements AudioOutput {
  readonly id: string;
  private readonly options: SounddeviceAudioOutputOptions;
  private readonly logger = createLogger({ name: 'mave:providers:sounddevice-output' });

  private process: ChildProcess | null = null;
  private state: AudioOutputPlaybackState = 'idle';
  private volume = 1.0;
  private isDisposed = false;

  private readyEvent: any = null;
  private readyResolvers: Array<() => void> = [];
  private completionResolvers: Array<() => void> = [];
  private readonly levelCallbacks = new Set<(level: AudioLevel) => void>();

  constructor(options: SounddeviceAudioOutputOptions = {}) {
    this.options = { ...options };
    this.id = options.id ?? 'sounddevice-audio-output';
  }

  private resolveRootDir(): string {
    if (this.options.rootDir) {
      return this.options.rootDir;
    }
    return findRepoRoot(process.cwd(), this.options.fsExistsFn, this.options.platform);
  }

  private resolvePythonPath(): string {
    return resolveTTSPythonExecutable({
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

  async listDevices(): Promise<AudioOutputDevice[]> {
    if (this.isDisposed) {
      throw new Error(`Cannot list devices on disposed AudioOutput (${this.id})`);
    }

    const pythonExe = this.resolvePythonPath();
    const rootDir = this.resolveRootDir();
    const ttsDir = path.resolve(rootDir, 'services/tts');

    return new Promise<AudioOutputDevice[]>((resolve, reject) => {
      const args = ['-m', 'mave_tts.audio_output', '--list-devices'];
      const spawnImpl = this.options.spawnFn ?? spawn;

      let child: ChildProcess;
      try {
        child = spawnImpl(pythonExe, args, {
          cwd: ttsDir,
          env: {
            ...process.env,
            ...this.options.env,
            PYTHONUNBUFFERED: '1'
          },
          stdio: ['ignore', 'pipe', 'pipe']
        });
      } catch (err: any) {
        reject(new Error(`Failed to query output devices: ${err.message ?? 'Spawn error'}`));
        return;
      }

      let stdoutData = '';
      child.stdout?.on('data', (c: Buffer) => {
        stdoutData += c.toString('utf-8');
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Output device query failed with code ${code}`));
          return;
        }
        try {
          const raw = JSON.parse(stdoutData.trim());
          const devices: AudioOutputDevice[] = Array.isArray(raw)
            ? raw.map((d: any) => AudioOutputDeviceSchema.parse(d))
            : [];
          resolve(devices);
        } catch (err: any) {
          reject(new Error(`Failed to parse output devices: ${err.message}`));
        }
      });
    });
  }

  private async ensureProcess(deviceIndex?: string): Promise<ChildProcess> {
    if (this.isDisposed) {
      throw new Error(`Cannot play audio on disposed AudioOutput (${this.id})`);
    }

    if (this.process && !this.process.killed) {
      return this.process;
    }

    const pythonExe = this.resolvePythonPath();
    const rootDir = this.resolveRootDir();
    const ttsDir = path.resolve(rootDir, 'services/tts');

    const args = ['-u', '-m', 'mave_tts.audio_output'];
    const devId = deviceIndex ?? this.options.deviceId;
    if (devId !== undefined && devId !== '') {
      args.push('--device-index', devId);
    }

    const spawnImpl = this.options.spawnFn ?? spawn;
    this.logger.info({ pythonExe, ttsDir, args }, 'Spawning sounddevice audio output player');

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
      child.stderr.on('data', (c: Buffer) => {
        const text = c.toString('utf-8').trim();
        if (text) {
          this.logger.debug({ stderr: text }, 'AudioOutput stderr');
        }
      });
    }

    child.on('exit', (code, signal) => {
      this.logger.info({ code, signal }, 'AudioOutput player exited');
      this.process = null;
      this.readyEvent = null;
      this.state = 'idle';
      for (const res of this.completionResolvers) res();
      this.completionResolvers = [];
    });

    await new Promise<void>((resolve, reject) => {
      if (this.readyEvent) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        this.logger.warn('AudioOutput ready timeout; proceeding');
        resolve();
      }, 5000);

      this.readyResolvers.push(() => {
        clearTimeout(timer);
        resolve();
      });

      child.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`AudioOutput player exited with code ${code}`));
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
        for (const r of resolvers) r();
        return;
      }
      if (parsed.type === 'level') {
        const validLevel = AudioLevelSchema.parse({
          timestampMs: parsed.timestampMs ?? Date.now(),
          rms: parsed.rms ?? 0.0
        });
        for (const cb of this.levelCallbacks) {
          try {
            cb(validLevel);
          } catch {}
        }
        return;
      }
      if (parsed.type === 'state') {
        this.state = parsed.state ?? 'idle';
        return;
      }
      if (parsed.type === 'playback_completed') {
        this.state = 'idle';
        const resolvers = [...this.completionResolvers];
        this.completionResolvers = [];
        for (const r of resolvers) r();
        return;
      }
    } catch (err) {
      this.logger.debug({ err, line }, 'Failed to parse AudioOutput stdout line');
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
    } catch {
      return false;
    }
  }

  private writeAudioPacket(pcm: Uint8Array): boolean {
    if (!this.process || !this.process.stdin || !this.process.stdin.writable) {
      return false;
    }
    try {
      const buf = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      const header = Buffer.alloc(5);
      header.writeUInt8(0x02, 0);
      header.writeUInt32BE(buf.length, 1);
      this.process.stdin.write(header);
      return this.process.stdin.write(buf);
    } catch {
      return false;
    }
  }

  async playStream(stream: AsyncIterable<AudioFrame>, options?: AudioPlaybackOptions): Promise<void> {
    if (this.isDisposed) {
      throw new Error(`Cannot play on disposed AudioOutput (${this.id})`);
    }

    await this.ensureProcess(options?.deviceId);

    if (options?.volume !== undefined) {
      await this.setVolume(options.volume);
    }

    this.state = 'playing';

    const onAbort = () => {
      this.stop().catch(() => {});
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        await this.stop();
        return;
      }
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      for await (const frame of stream) {
        if (options?.signal?.aborted || this.isDisposed || this.getPlaybackState() === 'stopped') {
          break;
        }
        this.writeAudioPacket(frame.data);
      }

      if (!options?.signal?.aborted && !this.isDisposed && this.getPlaybackState() !== 'stopped') {
        // Send end command and wait for playback completion
        this.writeControlPacket({ action: 'end' });
        await new Promise<void>((resolve) => {
          this.completionResolvers.push(resolve);
          setTimeout(resolve, 2000); // Safety fallback timeout
        });
      }
    } finally {
      if (options?.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      if (this.state === 'playing') {
        this.state = 'idle';
      }
    }
  }

  async stop(): Promise<void> {
    this.state = 'stopped';
    this.writeControlPacket({ action: 'stop' });
    for (const r of this.completionResolvers) r();
    this.completionResolvers = [];
  }

  async pause(): Promise<void> {
    this.state = 'paused';
    this.writeControlPacket({ action: 'pause' });
  }

  async resume(): Promise<void> {
    this.state = 'playing';
    this.writeControlPacket({ action: 'resume' });
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(0.0, Math.min(1.0, volume));
    this.writeControlPacket({ action: 'volume', value: this.volume });
  }

  getPlaybackState(): AudioOutputPlaybackState {
    return this.state;
  }

  getResolvedDevice(): { deviceIndex?: number; deviceName?: string; isDefault?: boolean } {
    return {
      deviceIndex: this.readyEvent?.deviceIndex ?? (this.options.deviceId ? Number(this.options.deviceId) : undefined),
      deviceName: this.readyEvent?.deviceName,
      isDefault: this.readyEvent?.isDefault ?? true
    };
  }

  onLevel(callback: (level: AudioLevel) => void): () => void {
    this.levelCallbacks.add(callback);
    return () => {
      this.levelCallbacks.delete(callback);
    };
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.state = 'idle';

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

    for (const r of this.completionResolvers) r();
    this.completionResolvers = [];
    this.levelCallbacks.clear();
  }
}
