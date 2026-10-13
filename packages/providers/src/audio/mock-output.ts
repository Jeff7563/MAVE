import type {
  AudioFrame,
  AudioLevel,
  AudioOutput,
  AudioOutputDevice,
  AudioOutputPlaybackState,
  AudioPlaybackOptions
} from '@mave/contracts';
import { frameDurationMs } from '@mave/contracts';

export interface MockAudioOutputOptions {
  id?: string;
  devices?: AudioOutputDevice[];
  volume?: number;
  mockLevels?: number[];
  frameDelayMs?: number;
}

export class MockAudioOutput implements AudioOutput {
  readonly id: string;
  private readonly devices: AudioOutputDevice[];
  private volume: number;
  private readonly mockLevels: number[];
  private readonly frameDelayMs: number;

  private state: AudioOutputPlaybackState = 'idle';
  private playedFrameCount = 0;
  private playedBytes = 0;
  private simulatedDurationMs = 0;

  private levelListeners = new Set<(level: AudioLevel) => void>();
  private pauseResolver: (() => void) | null = null;
  private isDisposed = false;

  constructor(options: MockAudioOutputOptions = {}) {
    this.id = options.id ?? 'mock-audio-output';
    this.devices = options.devices
      ? options.devices.map((d) => ({ ...d }))
      : [
          {
            id: 'mock-default-output',
            label: 'Mock Speakers',
            isDefault: true
          }
        ];
    this.volume = options.volume ?? 1.0;
    this.mockLevels = options.mockLevels ? [...options.mockLevels] : [0.0];
    this.frameDelayMs = options.frameDelayMs ?? 0;
  }

  async listDevices(): Promise<AudioOutputDevice[]> {
    return this.devices.map((d) => ({ ...d }));
  }

  getPlaybackState(): AudioOutputPlaybackState {
    return this.state;
  }

  getPlayedFrameCount(): number {
    return this.playedFrameCount;
  }

  getPlayedBytes(): number {
    return this.playedBytes;
  }

  getSimulatedDurationMs(): number {
    return this.simulatedDurationMs;
  }

  getVolume(): number {
    return this.volume;
  }

  async setVolume(volume: number): Promise<void> {
    if (typeof volume !== 'number' || Number.isNaN(volume) || volume < 0.0 || volume > 1.0) {
      throw new RangeError(`Volume must be between 0.0 and 1.0, got ${volume}`);
    }
    this.volume = volume;
  }

  onLevel(callback: (level: AudioLevel) => void): () => void {
    this.levelListeners.add(callback);
    return () => {
      this.levelListeners.delete(callback);
    };
  }

  async pause(): Promise<void> {
    if (this.state === 'playing') {
      this.state = 'paused';
    }
  }

  async resume(): Promise<void> {
    if (this.state === 'paused') {
      this.state = 'playing';
      if (this.pauseResolver) {
        this.pauseResolver();
        this.pauseResolver = null;
      }
    }
  }

  async stop(): Promise<void> {
    this.state = 'stopped';
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
  }

  async playStream(
    stream: AsyncIterable<AudioFrame>,
    options?: AudioPlaybackOptions
  ): Promise<void> {
    if (this.isDisposed) {
      throw new Error(`Cannot play through disposed MockAudioOutput (${this.id})`);
    }

    const signal = options?.signal;
    if (signal?.aborted) {
      this.state = 'stopped';
      return;
    }

    this.state = 'playing';

    const onAbort = () => {
      void this.stop();
    };
    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    try {
      let levelIdx = 0;
      for await (const frame of stream) {
        if (this.getPlaybackState() === 'stopped' || signal?.aborted || this.isDisposed) {
          break;
        }

        // Handle paused state
        while (this.getPlaybackState() === 'paused' && !signal?.aborted && !this.isDisposed) {
          await new Promise<void>((resolve) => {
            this.pauseResolver = resolve;
          });
        }

        if (this.getPlaybackState() === 'stopped' || signal?.aborted || this.isDisposed) {
          break;
        }

        // Track frame playback metrics
        this.playedFrameCount++;
        this.playedBytes += frame.data.byteLength;
        const duration = frameDurationMs(
          frame.format,
          frame.data.byteLength / (frame.format.channels * frame.format.bytesPerSample)
        );
        this.simulatedDurationMs += duration;

        // Emit telemetry if level listeners are registered
        if (this.levelListeners.size > 0) {
          const rms = this.mockLevels[levelIdx % this.mockLevels.length] ?? 0.0;
          levelIdx++;
          const level: AudioLevel = {
            timestampMs: Date.now(),
            rms: Math.max(0.0, Math.min(1.0, rms * this.volume))
          };
          for (const listener of this.levelListeners) {
            listener(level);
          }
        }

        if (this.frameDelayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, this.frameDelayMs));
        }
      }
    } finally {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      if (this.getPlaybackState() !== 'stopped') {
        this.state = 'idle';
      }
    }
  }

  async dispose(): Promise<void> {
    this.isDisposed = true;
    await this.stop();
    this.levelListeners.clear();
  }
}
