import type {
  AudioCaptureOptions,
  AudioFrame,
  AudioInputDevice,
  AudioInputProvider,
  AudioLevel,
  ProviderHealth,
  ProviderHealthStatus
} from '@mave/contracts';
import { cloneAudioFrame, createPCMFixtureFrames } from './fixtures.js';

export interface MockAudioInputOptions {
  id?: string;
  devices?: AudioInputDevice[];
  frames?: AudioFrame[];
  frameDelayMs?: number;
  healthStatus?: ProviderHealthStatus;
  healthMessage?: string;
  healthLatencyMs?: number;
}

export class MockAudioInputProvider implements AudioInputProvider {
  readonly id: string;
  private readonly devices: AudioInputDevice[];
  private readonly frames: AudioFrame[];
  private readonly frameDelayMs: number;
  private readonly levelCallbacks = new Set<(level: AudioLevel) => void>();
  private healthStatus: ProviderHealthStatus;
  private healthMessage?: string;
  private healthLatencyMs?: number;
  private isDisposed = false;

  constructor(options: MockAudioInputOptions = {}) {
    this.id = options.id ?? 'mock-audio-input';
    this.devices = options.devices
      ? options.devices.map((d) => ({ ...d }))
      : [
          {
            id: 'mock-default-input',
            label: 'Mock Microphone',
            isDefault: true
          }
        ];
    this.frames = options.frames
      ? options.frames.map((f) => cloneAudioFrame(f))
      : createPCMFixtureFrames(3);
    this.frameDelayMs = options.frameDelayMs ?? 0;
    this.healthStatus = options.healthStatus ?? 'healthy';
    this.healthMessage = options.healthMessage;
    this.healthLatencyMs = options.healthLatencyMs;
  }

  async listDevices(): Promise<AudioInputDevice[]> {
    return this.devices.map((d) => ({ ...d }));
  }

  onLevel(callback: (level: AudioLevel) => void): () => void {
    this.levelCallbacks.add(callback);
    return () => {
      this.levelCallbacks.delete(callback);
    };
  }

  simulateLevel(rms: number): void {
    const level: AudioLevel = { timestampMs: Date.now(), rms: Math.min(1.0, Math.max(0.0, rms)) };
    for (const cb of this.levelCallbacks) {
      try {
        cb(level);
      } catch {}
    }
  }

  async *capture(options?: AudioCaptureOptions): AsyncIterable<AudioFrame> {
    if (this.isDisposed) {
      throw new Error(`Cannot capture from disposed MockAudioInputProvider (${this.id})`);
    }

    const signal = options?.signal;
    if (signal?.aborted) {
      return;
    }

    for (const frame of this.frames) {
      if (signal?.aborted || this.isDisposed) {
        return;
      }

      if (this.frameDelayMs > 0) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, this.frameDelayMs);
          if (signal) {
            const onAbort = () => {
              clearTimeout(timer);
              signal.removeEventListener('abort', onAbort);
              resolve();
            };
            signal.addEventListener('abort', onAbort);
          }
        });

        if (signal?.aborted || this.isDisposed) {
          return;
        }
      }

      // Clone each frame to guarantee immutability across consumer usages
      yield cloneAudioFrame(frame);
    }
  }

  async health(): Promise<ProviderHealth> {
    return {
      status: this.healthStatus,
      message: this.healthMessage ?? `${this.id} is ${this.healthStatus}`,
      latencyMs: this.healthLatencyMs,
      checkedAt: Date.now()
    };
  }

  setHealthStatus(status: ProviderHealthStatus, message?: string): void {
    this.healthStatus = status;
    this.healthMessage = message;
  }

  async dispose(): Promise<void> {
    this.isDisposed = true;
  }
}
