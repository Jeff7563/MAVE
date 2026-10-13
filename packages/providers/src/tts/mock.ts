import type {
  AudioFormat,
  AudioFrame,
  ProviderHealth,
  ProviderHealthStatus,
  SpeechEvent,
  SpeechRequest,
  TTSCapabilities,
  TTSErrorCode,
  TTSProvider,
  TTSSynthesizeOptions
} from '@mave/contracts';
import {
  DEFAULT_AUDIO_FORMAT,
  DEFAULT_AUDIO_FRAME_BYTES,
  DEFAULT_AUDIO_FRAME_DURATION_MS,
  TTSCapabilitiesSchema
} from '@mave/contracts';

export interface MockTTSOptions {
  id?: string;
  capabilities?: Partial<TTSCapabilities>;
  healthStatus?: ProviderHealthStatus;
  healthMessage?: string;
  healthLatencyMs?: number;
  delayMs?: number;
  fixedFrameCount?: number;
  failureMode?: 'none' | 'error_event' | 'throw';
  errorCode?: TTSErrorCode;
  errorMessage?: string;
  errorRetryable?: boolean;
  format?: AudioFormat;
}

export class MockTTSProvider implements TTSProvider {
  readonly id: string;
  private readonly options: MockTTSOptions;
  private readonly capabilities: TTSCapabilities;
  private healthStatus: ProviderHealthStatus;
  private healthMessage?: string;
  private healthLatencyMs?: number;

  private activeControllers = new Map<string, AbortController>();
  private isDisposed = false;

  constructor(options: MockTTSOptions = {}) {
    this.options = { ...options };
    this.id = options.id ?? 'mock-tts';
    this.capabilities = TTSCapabilitiesSchema.parse({
      streaming: true,
      languages: ['en', 'th'],
      voiceSelection: true,
      speakingRate: true,
      wordTimings: false,
      local: true,
      ...options.capabilities
    });
    this.healthStatus = options.healthStatus ?? 'healthy';
    this.healthMessage = options.healthMessage;
    this.healthLatencyMs = options.healthLatencyMs;
  }

  getCapabilities(): TTSCapabilities {
    return { ...this.capabilities };
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

  async cancel(requestId: string): Promise<void> {
    const controller = this.activeControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(requestId);
    }
  }

  /**
   * Deterministic frame count formula:
   * 1 frame base + 1 frame per 10 characters of input text (clamped between 1 and 20).
   * Total simulated duration = frameCount * 80 ms.
   */
  calculateFrameCount(text: string): number {
    if (this.options.fixedFrameCount !== undefined) {
      return Math.max(1, this.options.fixedFrameCount);
    }
    return Math.max(1, Math.min(20, Math.ceil(text.length / 10)));
  }

  async *synthesize(
    request: SpeechRequest,
    options?: TTSSynthesizeOptions
  ): AsyncIterable<SpeechEvent> {
    if (this.isDisposed) {
      throw new Error(`Cannot synthesize using disposed MockTTSProvider (${this.id})`);
    }

    const requestId = request.requestId;
    const controller = new AbortController();
    this.activeControllers.set(requestId, controller);

    const onExternalAbort = () => {
      controller.abort();
    };
    if (options?.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener('abort', onExternalAbort);
      }
    }

    try {
      // 1. Check pre-aborted state
      if (controller.signal.aborted) {
        yield {
          type: 'cancelled',
          requestId,
          reason: 'aborted_before_start',
          timestamp: Date.now()
        };
        return;
      }

      // 2. Check failure mode
      if (this.options.failureMode === 'throw') {
        throw new Error(this.options.errorMessage ?? 'Simulated TTS throw failure');
      }

      if (this.options.failureMode === 'error_event') {
        yield {
          type: 'error',
          requestId,
          error: {
            code: this.options.errorCode ?? 'tts_unavailable',
            message: this.options.errorMessage ?? 'Simulated TTS error event',
            retryable: this.options.errorRetryable ?? false
          },
          timestamp: Date.now()
        };
        return;
      }

      // 3. Emit started event
      yield {
        type: 'started',
        requestId,
        timestamp: Date.now()
      };

      if (controller.signal.aborted) {
        yield {
          type: 'cancelled',
          requestId,
          reason: 'cancelled_after_start',
          timestamp: Date.now()
        };
        return;
      }

      // 4. Calculate frames and duration deterministically
      const frameCount = this.calculateFrameCount(request.text);
      const format = this.options.format ?? DEFAULT_AUDIO_FORMAT;
      const totalDurationMs = frameCount * DEFAULT_AUDIO_FRAME_DURATION_MS;

      // 5. Emit synthetic AudioFrames
      for (let i = 0; i < frameCount; i++) {
        if (controller.signal.aborted || this.isDisposed) {
          yield {
            type: 'cancelled',
            requestId,
            reason: 'cancelled_during_audio',
            timestamp: Date.now()
          };
          return;
        }

        if (this.options.delayMs && this.options.delayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, this.options.delayMs));
          if (controller.signal.aborted || this.isDisposed) {
            yield {
              type: 'cancelled',
              requestId,
              reason: 'cancelled_during_audio',
              timestamp: Date.now()
            };
            return;
          }
        }

        const isLast = i === frameCount - 1;
        const frame: AudioFrame = {
          sequence: i,
          timestampMs: i * DEFAULT_AUDIO_FRAME_DURATION_MS,
          format,
          data: new Uint8Array(DEFAULT_AUDIO_FRAME_BYTES),
          isFinalChunk: isLast
        };

        yield {
          type: 'audio',
          requestId,
          frame,
          timestamp: Date.now()
        };
      }

      if (controller.signal.aborted || this.isDisposed) {
        yield {
          type: 'cancelled',
          requestId,
          reason: 'cancelled_before_complete',
          timestamp: Date.now()
        };
        return;
      }

      // 6. Emit completed event (denoting synthesis completion, NOT playback completion)
      yield {
        type: 'completed',
        requestId,
        durationMs: totalDurationMs,
        timestamp: Date.now()
      };
    } finally {
      if (options?.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }
      this.activeControllers.delete(requestId);
    }
  }

  async dispose(): Promise<void> {
    this.isDisposed = true;
    for (const controller of this.activeControllers.values()) {
      controller.abort();
    }
    this.activeControllers.clear();
  }
}
