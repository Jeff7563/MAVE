import type {
  AudioFrame,
  ProviderHealth,
  ProviderHealthStatus,
  STTCapabilities,
  STTErrorCode,
  STTProvider,
  STTRequestOptions,
  TranscriptEvent,
  TranscriptWord
} from '@mave/contracts';
import { STTCapabilitiesSchema } from '@mave/contracts';

export interface MockSTTOptions {
  id?: string;
  capabilities?: Partial<STTCapabilities>;
  healthStatus?: ProviderHealthStatus;
  healthMessage?: string;
  healthLatencyMs?: number;
  partials?: string[];
  finalText?: string;
  language?: string;
  confidence?: number;
  words?: TranscriptWord[];
  delayMs?: number;
  failureMode?: 'none' | 'error_event' | 'throw';
  errorCode?: STTErrorCode;
  errorMessage?: string;
  errorRetryable?: boolean;
}

export class MockSTTProvider implements STTProvider {
  readonly id: string;
  private readonly options: MockSTTOptions;
  private readonly capabilities: STTCapabilities;
  private healthStatus: ProviderHealthStatus;
  private healthMessage?: string;
  private healthLatencyMs?: number;

  private activeControllers = new Map<string, AbortController>();
  private isDisposed = false;

  // Diagnostics counters for testing
  private totalFramesConsumed = 0;
  private totalBytesConsumed = 0;

  constructor(options: MockSTTOptions = {}) {
    this.options = { ...options };
    this.id = options.id ?? 'mock-stt';
    this.capabilities = STTCapabilitiesSchema.parse({
      streaming: true,
      partialTranscripts: true,
      languageDetection: false,
      wordTimestamps: options.words !== undefined,
      confidence: true,
      local: true,
      ...options.capabilities
    });
    this.healthStatus = options.healthStatus ?? 'healthy';
    this.healthMessage = options.healthMessage;
    this.healthLatencyMs = options.healthLatencyMs;
  }

  getCapabilities(): STTCapabilities {
    return { ...this.capabilities };
  }

  getDiagnostics(): { totalFramesConsumed: number; totalBytesConsumed: number } {
    return {
      totalFramesConsumed: this.totalFramesConsumed,
      totalBytesConsumed: this.totalBytesConsumed
    };
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

  async *transcribe(
    audio: AsyncIterable<AudioFrame>,
    options: STTRequestOptions
  ): AsyncIterable<TranscriptEvent> {
    if (this.isDisposed) {
      throw new Error(`Cannot transcribe using disposed MockSTTProvider (${this.id})`);
    }

    const requestId = options.requestId;
    const controller = new AbortController();
    this.activeControllers.set(requestId, controller);

    const onExternalAbort = () => {
      controller.abort();
    };
    if (options.signal) {
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
        throw new Error(this.options.errorMessage ?? 'Simulated STT throw failure');
      }

      if (this.options.failureMode === 'error_event') {
        yield {
          type: 'error',
          requestId,
          error: {
            code: this.options.errorCode ?? 'stt_unavailable',
            message: this.options.errorMessage ?? 'Simulated STT error event',
            retryable: this.options.errorRetryable ?? false
          },
          timestamp: Date.now()
        };
        return;
      }

      // 3. Emit started
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

      // 4. Emit speech_started
      yield {
        type: 'speech_started',
        requestId,
        timestamp: Date.now()
      };

      const partials = this.options.partials ?? ['Hello', 'Hello MAVE'];
      let partialIndex = 0;

      // 5. Actively consume audio frames from stream
      for await (const frame of audio) {
        if (controller.signal.aborted || this.isDisposed) {
          break;
        }

        this.totalFramesConsumed++;
        this.totalBytesConsumed += frame.data.byteLength;

        // Emit partial transcript if available
        if (partialIndex < partials.length) {
          const text = partials[partialIndex]!;
          partialIndex++;

          if (this.options.delayMs && this.options.delayMs > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, this.options.delayMs));
            if (controller.signal.aborted || this.isDisposed) {
              break;
            }
          }

          yield {
            type: 'partial_transcript',
            requestId,
            text,
            confidence: this.options.confidence ?? 0.85,
            timestamp: Date.now()
          };
        }
      }

      if (controller.signal.aborted || this.isDisposed) {
        yield {
          type: 'cancelled',
          requestId,
          reason: 'cancelled_during_audio',
          timestamp: Date.now()
        };
        return;
      }

      // 6. Emit any remaining partials if audio was shorter than partials count
      while (partialIndex < partials.length) {
        if (controller.signal.aborted || this.isDisposed) {
          yield {
            type: 'cancelled',
            requestId,
            reason: 'cancelled_during_partials',
            timestamp: Date.now()
          };
          return;
        }

        const text = partials[partialIndex]!;
        partialIndex++;

        yield {
          type: 'partial_transcript',
          requestId,
          text,
          confidence: this.options.confidence ?? 0.85,
          timestamp: Date.now()
        };
      }

      if (this.options.delayMs && this.options.delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, this.options.delayMs));
      }

      if (controller.signal.aborted || this.isDisposed) {
        yield {
          type: 'cancelled',
          requestId,
          reason: 'cancelled_before_final',
          timestamp: Date.now()
        };
        return;
      }

      // 7. Emit final_transcript
      const finalText = this.options.finalText ?? (partials[partials.length - 1] || 'Hello MAVE');
      yield {
        type: 'final_transcript',
        requestId,
        text: finalText,
        confidence: this.options.confidence ?? 0.95,
        language: this.options.language ?? options.languageHint ?? 'en',
        words: this.options.words,
        timestamp: Date.now()
      };

      // 8. Emit speech_ended
      yield {
        type: 'speech_ended',
        requestId,
        timestamp: Date.now()
      };
    } finally {
      if (options.signal) {
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
