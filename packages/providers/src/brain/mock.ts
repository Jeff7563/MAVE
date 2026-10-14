import type {
  BrainCapabilities,
  BrainErrorCode,
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ModelCatalogProvider,
  ModelCatalogSnapshot,
  ModelDescriptor,
  ProviderDescriptor,
  ProviderHealth,
  ProviderHealthStatus
} from '@mave/contracts';
import {
  BrainCapabilitiesSchema,
  ModelCatalogSnapshotSchema,
  ProviderDescriptorSchema,
  ProviderHealthSchema
} from '@mave/contracts';

export interface MockBrainOptions {
  /** Provider identifier. Defaults to 'mock'. */
  id?: string;
  /** Custom capabilities override. Defaults to fastChat=true, streaming=true. */
  capabilities?: Partial<BrainCapabilities>;
  /** Simulated provider health status. Defaults to 'healthy'. */
  healthStatus?: ProviderHealthStatus;
  /** Simulated health status message. */
  healthMessage?: string;
  /** Simulated health check latency in milliseconds. */
  healthLatencyMs?: number;
  /** Simulated health check delay in milliseconds. Defaults to 0. */
  healthDelayMs?: number;
  /** Whether the simulated health check should throw. Defaults to false. */
  healthThrow?: boolean;
  /** Static response text to return for every chat request. */
  responseText?: string;
  /** Dynamic response text builder given the request. */
  responseBuilder?: (request: BrainRequest) => string;
  /** Delay in milliseconds between emitted chunks. Defaults to 0. */
  delayMs?: number;
  /** Fixed chunk character size for splitting response text. */
  chunkSize?: number;
  /** Explicit sequence of chunks to stream. */
  chunks?: string[];
  /** Simulated failure mode. Defaults to 'none'. */
  failureMode?: 'error_event' | 'throw' | 'none';
  /** Normalized error code emitted when failureMode is active. */
  errorCode?: BrainErrorCode;
  /** Error message emitted when failureMode is active. */
  errorMessage?: string;
  /** Whether the simulated error is retryable. */
  errorRetryable?: boolean;
}

export class MockBrainProvider implements BrainProvider {
  readonly id: string;
  private options: MockBrainOptions;
  private activeControllers = new Map<string, AbortController>();

  constructor(options?: MockBrainOptions) {
    this.options = { ...options };
    this.id = this.options.id || 'mock';
  }

  getCapabilities(): BrainCapabilities {
    return BrainCapabilitiesSchema.parse({
      streaming: true,
      fastChat: true,
      reasoning: false,
      coding: false,
      toolUse: false,
      multimodal: false,
      vision: false,
      webResearch: false,
      longContext: false,
      local: false,
      ...this.options.capabilities
    });
  }

  async health(): Promise<ProviderHealth> {
    if (this.options.healthDelayMs && this.options.healthDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.options.healthDelayMs));
    }
    if (this.options.healthThrow) {
      throw new Error(this.options.healthMessage || `Simulated health check failure for ${this.id}`);
    }
    return ProviderHealthSchema.parse({
      status: this.options.healthStatus ?? 'healthy',
      message: this.options.healthMessage,
      latencyMs: this.options.healthLatencyMs ?? (this.options.healthDelayMs ?? 0),
      checkedAt: Date.now()
    });
  }

  setHealth(
    status: ProviderHealthStatus,
    message?: string,
    latencyMs?: number,
    options?: { delayMs?: number; throw?: boolean }
  ): void {
    this.options.healthStatus = status;
    this.options.healthMessage = message;
    this.options.healthLatencyMs = latencyMs;
    this.options.healthDelayMs = options?.delayMs;
    this.options.healthThrow = options?.throw;
  }

  setFailureMode(
    mode: 'error_event' | 'throw' | 'none',
    code: BrainErrorCode = 'provider_unavailable',
    message: string = 'Simulated mock brain failure',
    retryable = true
  ): void {
    this.options.failureMode = mode;
    this.options.errorCode = code;
    this.options.errorMessage = message;
    this.options.errorRetryable = retryable;
  }

  setDelay(delayMs: number): void {
    this.options.delayMs = delayMs;
  }

  setResponseText(text: string): void {
    this.options.responseText = text;
  }

  async cancel(requestId: string): Promise<void> {
    const controller = this.activeControllers.get(requestId);
    if (controller) {
      controller.abort('Cancelled via cancel()');
    }
  }

  async *chat(
    request: BrainRequest,
    options?: BrainRequestOptions
  ): AsyncIterable<BrainEvent> {
    const controller = new AbortController();
    const externalSignal = options?.signal;

    const onExternalAbort = () => {
      controller.abort(externalSignal?.reason || 'External AbortSignal triggered');
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason || 'External AbortSignal already aborted');
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    this.activeControllers.set(request.requestId, controller);

    try {
      // 1. Pre-flight cancellation check
      if (controller.signal.aborted) {
        yield {
          type: 'cancelled',
          requestId: request.requestId,
          reason: String(controller.signal.reason || 'Cancelled before generation')
        };
        return;
      }

      // 2. Failure simulation: throw
      if (this.options.failureMode === 'throw') {
        throw new Error(this.options.errorMessage || 'Simulated mock brain exception');
      }

      // 3. Emit started event
      yield {
        type: 'started',
        requestId: request.requestId,
        providerId: this.id,
        timestamp: Date.now()
      };

      // 4. Failure simulation: error event
      if (this.options.failureMode === 'error_event') {
        yield {
          type: 'error',
          requestId: request.requestId,
          error: {
            code: this.options.errorCode || 'provider_unavailable',
            message: this.options.errorMessage || 'Simulated mock brain failure',
            retryable: this.options.errorRetryable ?? true
          }
        };
        return;
      }

      // 5. Determine full response text
      const fullText = this.resolveResponseText(request);

      // 6. Split text into deterministic chunks
      const chunks = this.resolveChunks(fullText);

      // 7. Stream delta chunks with optional delay
      let accumulatedText = '';
      for (const chunk of chunks) {
        if (controller.signal.aborted) {
          yield {
            type: 'cancelled',
            requestId: request.requestId,
            reason: String(controller.signal.reason || 'Cancelled during streaming')
          };
          return;
        }

        const delayMs = this.options.delayMs ?? 0;
        if (delayMs > 0) {
          const aborted = await this.sleepAbortable(delayMs, controller.signal);
          if (aborted) {
            yield {
              type: 'cancelled',
              requestId: request.requestId,
              reason: String(controller.signal.reason || 'Cancelled during streaming delay')
            };
            return;
          }
        }

        if (controller.signal.aborted) {
          yield {
            type: 'cancelled',
            requestId: request.requestId,
            reason: String(controller.signal.reason || 'Cancelled during streaming')
          };
          return;
        }

        accumulatedText += chunk;
        yield {
          type: 'delta',
          requestId: request.requestId,
          text: chunk
        };
      }

      // 8. Post-stream cancellation check
      if (controller.signal.aborted) {
        yield {
          type: 'cancelled',
          requestId: request.requestId,
          reason: String(controller.signal.reason || 'Cancelled before completion')
        };
        return;
      }

      // 9. Emit completed event
      const promptTokens = Math.max(1, request.messages.reduce((acc, m) => acc + m.content.length, 0));
      const completionTokens = Math.max(1, accumulatedText.length);

      yield {
        type: 'completed',
        requestId: request.requestId,
        text: accumulatedText,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        },
        finishReason: 'stop'
      };
    } finally {
      this.activeControllers.delete(request.requestId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  private resolveResponseText(request: BrainRequest): string {
    if (this.options.responseText !== undefined) {
      return this.options.responseText;
    }
    if (this.options.responseBuilder) {
      return this.options.responseBuilder(request);
    }

    const lastMessage = request.messages[request.messages.length - 1];
    const userContent = lastMessage?.content?.trim();
    if (!userContent) {
      return 'Mock response: (empty)';
    }

    return `Mock response: ${userContent}`;
  }

  private resolveChunks(text: string): string[] {
    if (this.options.chunks && this.options.chunks.length > 0) {
      return this.options.chunks;
    }

    if (this.options.chunkSize && this.options.chunkSize > 0) {
      const size = this.options.chunkSize;
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += size) {
        chunks.push(text.slice(i, i + size));
      }
      return chunks;
    }

    // Default chunking strategy: split into words preserving trailing whitespace
    const words = text.match(/\S+\s*/g);
    if (!words || words.length === 0) {
      return [text];
    }
    return words;
  }

  private sleepAbortable(ms: number, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(true);
        return;
      }

      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve(false);
      }, ms);

      const onAbort = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve(true);
      };

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

/**
 * Creates canonical neutral mock models for deterministic testing.
 */
export function createDefaultMockModels(providerId: string): ModelDescriptor[] {
  return [
    {
      id: 'mock-fast-v1',
      providerId,
      displayName: 'Mock Fast v1',
      status: 'available',
      latencyClass: 'interactive',
      qualityClass: 'fast',
      costClass: 'low',
      contextClass: 'standard',
      contextWindowTokens: 8192,
      capabilities: {
        streaming: true,
        fastChat: true,
        reasoning: false,
        coding: false,
        toolUse: false,
        multimodal: false,
        vision: false,
        webResearch: false,
        longContext: false,
        local: false
      },
      privacyClass: 'standard_cloud'
    },
    {
      id: 'mock-balanced-v1',
      providerId,
      displayName: 'Mock Balanced v1',
      status: 'available',
      latencyClass: 'balanced',
      qualityClass: 'balanced',
      costClass: 'medium',
      contextClass: 'large',
      contextWindowTokens: 32768,
      capabilities: {
        streaming: true,
        fastChat: true,
        reasoning: true,
        coding: false,
        toolUse: false,
        multimodal: false,
        vision: false,
        webResearch: false,
        longContext: false,
        local: false
      },
      privacyClass: 'standard_cloud'
    },
    {
      id: 'mock-reasoning-v1',
      providerId,
      displayName: 'Mock Reasoning v1',
      status: 'available',
      latencyClass: 'heavy',
      qualityClass: 'reasoning',
      costClass: 'high',
      contextClass: 'massive',
      contextWindowTokens: 128000,
      capabilities: {
        streaming: true,
        fastChat: false,
        reasoning: true,
        coding: false,
        toolUse: false,
        multimodal: false,
        vision: false,
        webResearch: false,
        longContext: true,
        local: false
      },
      privacyClass: 'standard_cloud'
    },
    {
      id: 'mock-local-v1',
      providerId,
      displayName: 'Mock Local v1',
      status: 'available',
      latencyClass: 'interactive',
      qualityClass: 'fast',
      costClass: 'free',
      contextClass: 'standard',
      contextWindowTokens: 4096,
      capabilities: {
        streaming: true,
        fastChat: true,
        reasoning: false,
        coding: false,
        toolUse: false,
        multimodal: false,
        vision: false,
        webResearch: false,
        longContext: false,
        local: true
      },
      privacyClass: 'local_only'
    }
  ];
}

export interface MockModelCatalogOptions extends MockBrainOptions {
  models?: ModelDescriptor[];
  catalogDelayMs?: number;
  catalogThrow?: boolean;
  catalogMessage?: string;
  descriptor?: Partial<ProviderDescriptor>;
}

export class MockModelCatalogProvider
  extends MockBrainProvider
  implements ModelCatalogProvider
{
  private catalogOpts: MockModelCatalogOptions;
  private catalogCallCount = 0;

  constructor(options?: MockModelCatalogOptions) {
    super(options);
    this.catalogOpts = { ...options };
  }

  getCatalogCallCount(): number {
    return this.catalogCallCount;
  }

  setCatalogModels(models: ModelDescriptor[]): void {
    this.catalogOpts.models = models;
  }

  setCatalogThrow(shouldThrow: boolean, message?: string): void {
    this.catalogOpts.catalogThrow = shouldThrow;
    this.catalogOpts.catalogMessage = message;
  }

  setCatalogDelay(delayMs: number): void {
    this.catalogOpts.catalogDelayMs = delayMs;
  }

  async getCatalog(): Promise<ModelCatalogSnapshot> {
    this.catalogCallCount++;
    if (this.catalogOpts.catalogDelayMs && this.catalogOpts.catalogDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.catalogOpts.catalogDelayMs));
    }
    if (this.catalogOpts.catalogThrow) {
      throw new Error(
        this.catalogOpts.catalogMessage ||
          `Simulated catalog fetch failure for ${this.id}`
      );
    }
    const models = this.catalogOpts.models ?? createDefaultMockModels(this.id);
    return ModelCatalogSnapshotSchema.parse({
      providerId: this.id,
      models,
      refreshedAt: Date.now()
    });
  }

  getDescriptor(): ProviderDescriptor {
    return ProviderDescriptorSchema.parse({
      id: this.id,
      kind: 'model_provider',
      displayName:
        this.catalogOpts.descriptor?.displayName ??
        `Mock Model Provider (${this.id})`,
      accessPath: 'local_runtime',
      capabilities: this.getCapabilities(),
      health: {
        status: this.catalogOpts.healthStatus ?? 'healthy',
        message: this.catalogOpts.healthMessage,
        checkedAt: Date.now()
      },
      defaultModelId:
        this.catalogOpts.descriptor?.defaultModelId ?? 'mock-fast-v1',
      documentationUrl: this.catalogOpts.descriptor?.documentationUrl
    });
  }
}
