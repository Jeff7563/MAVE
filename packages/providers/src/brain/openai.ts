import type {
  BrainCapabilities,
  BrainErrorCode,
  BrainEvent,
  BrainRequest,
  BrainRequestOptions,
  GenerationUsage,
  ModelCatalogProvider,
  ModelCatalogSnapshot,
  ModelDescriptor,
  ProviderDescriptor,
  ProviderHealth
} from '@mave/contracts';
import {
  BrainCapabilitiesSchema,
  ModelCatalogSnapshotSchema,
  ProviderDescriptorSchema,
  ProviderHealthSchema
} from '@mave/contracts';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:provider:openai' });

export const OPENAI_PROVIDER_ID = 'openai';

export const OPENAI_FAST_MODEL_ID = 'openai-fast-primary';
export const OPENAI_BALANCED_MODEL_ID = 'openai-balanced-primary';

/**
 * Adapter-private concrete model mapping.
 * STRICT INVARIANT: Concrete vendor model IDs remain encapsulated inside this adapter
 * and MUST NEVER leak into @mave/core or external caller contracts.
 */
const OPENAI_CONCRETE_MODEL_MAP: Record<string, string> = {
  [OPENAI_FAST_MODEL_ID]: 'gpt-4o-mini',
  [OPENAI_BALANCED_MODEL_ID]: 'gpt-4o'
};

export interface OpenAIBrainProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  models?: ModelDescriptor[];
}

/**
 * Redacts potential secrets, bearer tokens, and internal filesystem paths from error messages.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'Unknown error';
  return message
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9_\-]{20,}/gi, 'sk-[REDACTED]')
    .replace(/(?:[a-zA-Z]:[\\/]|(?:\/[a-zA-Z0-9_\-\.]+)+)[^\s"'>]*/g, '[PATH_REDACTED]');
}

/**
 * Production Fast Brain Candidate Provider: OpenAI Direct ModelProvider.
 *
 * Implements MAVE's vendor-neutral ModelCatalogProvider interface over the official
 * OpenAI REST and SSE streaming APIs.
 *
 * Core Guarantees:
 * - Kind: model_provider, AccessPath: official_api
 * - Non-generation health check (GET /models) consumes ZERO generation quota
 * - Direct execution consumes normalized options.modelId
 * - Clean progressive SSE streaming with first-token timing and usage telemetry
 * - Instant AbortSignal cancellation honoring M3 barge-in requirements
 * - M5 permission boundary: tool execution is strictly blocked
 * - Zero external vendor SDK dependencies (uses native fetch)
 */
export class OpenAIBrainProvider implements ModelCatalogProvider {
  readonly id = OPENAI_PROVIDER_ID;

  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly customModels?: ModelDescriptor[];

  constructor(options?: OpenAIBrainProviderOptions) {
    this.apiKey = options?.apiKey ?? process.env['OPENAI_API_KEY'];
    this.baseUrl = (options?.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.timeoutMs = options?.timeoutMs ?? 30000;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.customModels = options?.models;
  }

  isConfigured(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.trim().length > 0;
  }

  getCapabilities(): BrainCapabilities {
    return BrainCapabilitiesSchema.parse({
      streaming: true,
      fastChat: true,
      reasoning: false,
      coding: true,
      toolUse: true, // Capability metadata only; execution is blocked by M5 boundary
      multimodal: true,
      vision: true,
      webResearch: false,
      longContext: true,
      local: false,
      structuredOutput: true,
      cancellation: true,
      supportsThai: true,
      supportsEnglish: true
    });
  }

  getDescriptor(): ProviderDescriptor {
    return ProviderDescriptorSchema.parse({
      id: this.id,
      kind: 'model_provider',
      displayName: 'OpenAI Direct Model Provider',
      accessPath: 'official_api',
      capabilities: this.getCapabilities(),
      health: {
        status: this.isConfigured() ? 'healthy' : 'unconfigured',
        checkedAt: Date.now()
      },
      defaultModelId: OPENAI_FAST_MODEL_ID,
      documentationUrl: 'https://platform.openai.com/docs/api-reference'
    });
  }

  async getCatalog(): Promise<ModelCatalogSnapshot> {
    const configured = this.isConfigured();

    if (this.customModels && this.customModels.length > 0) {
      return ModelCatalogSnapshotSchema.parse({
        providerId: this.id,
        models: this.customModels,
        refreshedAt: Date.now()
      });
    }

    const models: ModelDescriptor[] = [
      {
        id: OPENAI_FAST_MODEL_ID,
        providerId: this.id,
        displayName: 'OpenAI Fast Primary (gpt-4o-mini)',
        status: configured ? 'available' : 'unavailable',
        latencyClass: 'interactive',
        qualityClass: 'fast',
        costClass: 'low',
        contextClass: 'large',
        contextWindowTokens: 128000,
        capabilities: {
          streaming: true,
          fastChat: true,
          reasoning: false,
          coding: true,
          toolUse: true,
          multimodal: true,
          vision: true,
          webResearch: false,
          longContext: true,
          local: false,
          structuredOutput: true,
          cancellation: true,
          supportsThai: true,
          supportsEnglish: true
        },
        privacyClass: 'standard_cloud'
      },
      {
        id: OPENAI_BALANCED_MODEL_ID,
        providerId: this.id,
        displayName: 'OpenAI Balanced Primary (gpt-4o)',
        status: configured ? 'available' : 'unavailable',
        latencyClass: 'balanced',
        qualityClass: 'balanced',
        costClass: 'medium',
        contextClass: 'large',
        contextWindowTokens: 128000,
        capabilities: {
          streaming: true,
          fastChat: true,
          reasoning: true,
          coding: true,
          toolUse: true,
          multimodal: true,
          vision: true,
          webResearch: false,
          longContext: true,
          local: false,
          structuredOutput: true,
          cancellation: true,
          supportsThai: true,
          supportsEnglish: true
        },
        privacyClass: 'standard_cloud'
      }
    ];

    return ModelCatalogSnapshotSchema.parse({
      providerId: this.id,
      models,
      refreshedAt: Date.now()
    });
  }

  /**
   * Performs a lightweight presence and metadata health check WITHOUT consuming generation quota.
   * Dispatches GET /v1/models metadata endpoint. Never calls chat/completions.
   */
  async health(): Promise<ProviderHealth> {
    const checkedAt = Date.now();

    if (!this.isConfigured()) {
      return ProviderHealthSchema.parse({
        status: 'unconfigured',
        message: 'OpenAI API key is not configured',
        latencyMs: 0,
        checkedAt
      });
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 5000));

    try {
      const response = await this.fetchFn(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': 'MAVE-Desktop/1.0'
        },
        signal: controller.signal
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return ProviderHealthSchema.parse({
          status: 'healthy',
          message: 'OpenAI API operational',
          latencyMs,
          checkedAt
        });
      }

      if (response.status === 401 || response.status === 403) {
        return ProviderHealthSchema.parse({
          status: 'auth_error',
          message: 'OpenAI authentication failed: invalid or unauthorized API key',
          latencyMs,
          checkedAt
        });
      }

      if (response.status === 429) {
        let isQuota = false;
        try {
          const body = await response.json();
          const errCode = (body as { error?: { code?: string; type?: string } })?.error?.code;
          const errType = (body as { error?: { code?: string; type?: string } })?.error?.type;
          isQuota = errCode === 'insufficient_quota' || errType === 'insufficient_quota';
        } catch {
          // ignore json parse error
        }
        return ProviderHealthSchema.parse({
          status: isQuota ? 'quota_limited' : 'rate_limited',
          message: isQuota ? 'OpenAI quota limit reached' : 'OpenAI rate limit exceeded',
          latencyMs,
          checkedAt
        });
      }

      return ProviderHealthSchema.parse({
        status: 'unavailable',
        message: `OpenAI service returned HTTP ${response.status}`,
        latencyMs,
        checkedAt
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const safeMessage = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
      logger.warn({ err: safeMessage, latencyMs }, 'OpenAI health check failed');
      return ProviderHealthSchema.parse({
        status: 'unavailable',
        message: `OpenAI endpoint unreachable: ${safeMessage}`,
        latencyMs,
        checkedAt
      });
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Executes streaming chat completion against OpenAI using normalized execution options.
   *
   * Direct Model Invariant: Requires options.modelId; maps normalized ModelId to concrete vendor model.
   */
  async *chat(request: BrainRequest, options?: BrainRequestOptions): AsyncIterable<BrainEvent> {
    const requestId = request.requestId;

    // 1. Enforce Direct Model Invariant: modelId must be present
    const normalizedModelId = options?.modelId;
    if (!normalizedModelId) {
      logger.error({ requestId }, 'OpenAIBrainProvider invoked without required options.modelId');
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'model_unavailable',
          message: 'Direct model route requires a resolved modelId in BrainRequestOptions',
          retryable: false
        }
      };
      return;
    }

    // 2. Resolve adapter-private concrete vendor model
    const concreteModel = OPENAI_CONCRETE_MODEL_MAP[normalizedModelId];
    if (!concreteModel) {
      logger.error({ requestId, normalizedModelId }, 'Unknown normalized modelId for OpenAI provider');
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'model_unavailable',
          message: `Unknown or unmapped model '${normalizedModelId}' for provider 'openai'`,
          retryable: false
        }
      };
      return;
    }

    // 3. Verify credential configuration
    if (!this.isConfigured()) {
      logger.warn({ requestId }, 'OpenAIBrainProvider invoked but API key is unconfigured');
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'provider_unconfigured',
          message: 'OpenAI API key is not configured',
          retryable: false
        }
      };
      return;
    }

    // 4. Early cancellation check
    if (options?.signal?.aborted) {
      yield {
        type: 'cancelled',
        requestId,
        reason: options.signal.reason ? String(options.signal.reason) : 'aborted'
      };
      return;
    }

    // 5. Build canonical request payload
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      if (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    const payload = {
      model: concreteModel,
      messages,
      stream: true,
      stream_options: { include_usage: true }
    };

    // 6. Emit canonical 'started' event
    yield {
      type: 'started',
      requestId,
      providerId: this.id,
      modelId: normalizedModelId,
      timestamp: Date.now()
    };

    // 7. Dispatch HTTP request with abort signal
    let response: Response;
    const dispatchStartTime = Date.now();

    try {
      response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'MAVE-Desktop/1.0'
        },
        body: JSON.stringify(payload),
        signal: options?.signal
      });
    } catch (err) {
      if (options?.signal?.aborted) {
        yield {
          type: 'cancelled',
          requestId,
          reason: 'aborted'
        };
        return;
      }

      const safeMessage = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
      logger.error({ requestId, err: safeMessage }, 'OpenAI chat dispatch failed');
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'provider_unavailable',
          message: `Failed to contact OpenAI: ${safeMessage}`,
          retryable: true
        }
      };
      return;
    }

    // 8. Handle non-200 HTTP responses
    if (!response.ok) {
      let errorCode: BrainErrorCode = 'provider_unavailable';
      let errorMessage = `OpenAI returned HTTP ${response.status}`;
      let retryable = false;

      try {
        const errorJson = (await response.json()) as { error?: { message?: string; type?: string; code?: string } };
        const rawMsg = errorJson?.error?.message ?? errorMessage;
        errorMessage = sanitizeErrorMessage(rawMsg);
        const errType = errorJson?.error?.type;
        const errCode = errorJson?.error?.code;

        if (response.status === 401 || response.status === 403) {
          errorCode = 'provider_auth';
          errorMessage = 'OpenAI authentication failed: invalid API key';
        } else if (response.status === 429) {
          if (errCode === 'insufficient_quota' || errType === 'insufficient_quota') {
            errorCode = 'quota_limited';
            errorMessage = 'OpenAI account quota exceeded';
          } else {
            errorCode = 'rate_limited';
            errorMessage = 'OpenAI rate limit exceeded';
            retryable = true;
          }
        } else if (response.status >= 500) {
          errorCode = 'provider_unavailable';
          retryable = true;
        } else {
          errorCode = 'provider_invalid_response';
        }
      } catch {
        // use default status code message
      }

      logger.warn({ requestId, status: response.status, errorCode }, 'OpenAI non-OK response');
      yield {
        type: 'error',
        requestId,
        error: {
          code: errorCode,
          message: errorMessage,
          retryable
        }
      };
      return;
    }

    if (!response.body) {
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'provider_invalid_response',
          message: 'OpenAI returned an empty response body for streaming',
          retryable: false
        }
      };
      return;
    }

    // 9. Stream and parse SSE chunks
    let accumulatedText = '';
    let timeToFirstTokenMs: number | undefined;
    let finalUsage: GenerationUsage | undefined;
    let finishReason: string | undefined;

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        if (options?.signal?.aborted) {
          await reader.cancel().catch(() => {});
          yield {
            type: 'cancelled',
            requestId,
            reason: 'aborted'
          };
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              continue;
            }

            try {
              const chunk = JSON.parse(dataStr) as {
                choices?: Array<{
                  delta?: { content?: string; role?: string; tool_calls?: unknown[] };
                  finish_reason?: string;
                }>;
                usage?: {
                  prompt_tokens?: number;
                  completion_tokens?: number;
                  total_tokens?: number;
                };
              };

              // Extract text delta
              const deltaContent = chunk.choices?.[0]?.delta?.content;
              if (typeof deltaContent === 'string' && deltaContent.length > 0) {
                if (timeToFirstTokenMs === undefined) {
                  timeToFirstTokenMs = Date.now() - dispatchStartTime;
                }
                accumulatedText += deltaContent;
                yield {
                  type: 'delta',
                  requestId,
                  text: deltaContent
                };
              }

              // Extract finish reason if present
              if (chunk.choices?.[0]?.finish_reason) {
                finishReason = chunk.choices[0].finish_reason;
              }

              // Extract usage telemetry if present
              if (chunk.usage) {
                finalUsage = {
                  promptTokens: chunk.usage.prompt_tokens,
                  completionTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens
                };
              }
            } catch {
              // Ignore malformed individual SSE lines
            }
          }
        }
      }

      // 10. Emit canonical 'completed' event
      const totalDurationMs = Date.now() - dispatchStartTime;
      yield {
        type: 'completed',
        requestId,
        text: accumulatedText,
        usage: finalUsage,
        timing: {
          timeToFirstTokenMs,
          totalDurationMs
        },
        finishReason: finishReason ?? 'stop'
      };
    } catch (err) {
      if (options?.signal?.aborted) {
        yield {
          type: 'cancelled',
          requestId,
          reason: 'aborted'
        };
        return;
      }

      const safeMessage = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
      logger.error({ requestId, err: safeMessage }, 'OpenAI stream reading error');
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'provider_invalid_response',
          message: `OpenAI stream error: ${safeMessage}`,
          retryable: false
        }
      };
    } finally {
      reader.releaseLock?.();
    }
  }
}
