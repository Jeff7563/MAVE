import type {
  BrainCapabilities,
  BrainEvent,
  BrainRequest,
  BrainRequestOptions,
  ModelCatalogProvider,
  ModelCatalogSnapshot,
  ModelDescriptor,
  ProviderDescriptor,
  ProviderHealth
} from '@mave/contracts';
import {
  BrainCapabilitiesSchema,
  ModelCatalogSnapshotSchema,
  ModelDescriptorSchema,
  ProviderDescriptorSchema,
  ProviderHealthSchema
} from '@mave/contracts';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:provider:ollama' });

export const OLLAMA_PROVIDER_ID = 'ollama';

/**
 * Standard loopback hostnames and IP addresses for local-only security.
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/**
 * Validates that the provided endpoint URL is strictly loopback/localhost.
 * Guarantees that local access class remains strictly confined to this machine.
 */
export function assertLoopbackEndpoint(urlStr: string): void {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    if (!LOOPBACK_HOSTS.has(hostname)) {
      throw new Error(
        `OllamaBrainProvider endpoint must be a loopback/local address ('127.0.0.1', 'localhost', '::1'). Received non-local host: '${hostname}'`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('loopback/local')) {
      throw err;
    }
    throw new Error(`Invalid Ollama endpoint URL: '${urlStr}'`);
  }
}

/**
 * Normalizes an Ollama raw tag (e.g. 'qwen2.5:7b') into a canonical MAVE ModelId slug.
 * Example: 'qwen2.5:7b' -> 'ollama-qwen2.5-7b'
 */
export function normalizeOllamaModelId(rawTag: string): string {
  const trimmed = rawTag.trim().toLowerCase();
  const slug = trimmed.replace(/[:/]/g, '-');
  return slug.startsWith('ollama-') ? slug : `ollama-${slug}`;
}

/**
 * Sanitizes diagnostic and error messages to prevent leaking local filesystem paths.
 */
export function sanitizeOllamaErrorMessage(message?: string): string {
  if (!message) return 'Unknown Ollama error';
  return message
    .replace(/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n\s]+\\)*[^\\/:*?"<>|\r\n\s]*/g, '<path>')
    .replace(/(?:\/[a-zA-Z0-9_.-]+)+/g, '<path>');
}

export interface OllamaBrainProviderOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  models?: ModelDescriptor[];
  keepAlive?: string | number;
}

interface OllamaTagModel {
  name: string;
  model?: string;
  size?: number;
  modified_at?: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
    context_length?: number;
  };
  capabilities?: string[];
}

interface OllamaTagsResponse {
  models?: OllamaTagModel[];
}

interface OllamaVersionResponse {
  version?: string;
}

interface OllamaChatChunk {
  model?: string;
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
  done_reason?: string;
  total_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  error?: string;
}

/**
 * Production Local Fast Brain Provider: Ollama Direct ModelProvider.
 *
 * Implements MAVE's vendor-neutral ModelCatalogProvider interface over local
 * Ollama HTTP endpoints (POST /api/chat, GET /api/tags, GET /api/version).
 *
 * Core Invariants:
 * - Kind: model_provider, AccessPath: local_runtime, AccessClass: local
 * - Strictly local loopback endpoint (127.0.0.1 / localhost)
 * - Non-generation health check (GET /api/version) consumes ZERO generation tokens
 * - Catalog discovery (GET /api/tags) reflects models actually installed on this machine
 * - Direct execution requires options.modelId; maps normalized ModelId to raw model tag
 * - Clean progressive NDJSON streaming with first-token timing and usage telemetry
 * - Instant AbortSignal cancellation honoring M3 barge-in requirements
 * - Privacy: privacyClass: 'local_only', 100% on-device, zero cloud egress
 * - Zero external vendor SDK dependencies (uses native fetch)
 */
export class OllamaBrainProvider implements ModelCatalogProvider {
  readonly id = OLLAMA_PROVIDER_ID;

  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly customModels?: ModelDescriptor[];
  private readonly keepAlive?: string | number;
  private readonly rawTagByModelId = new Map<string, string>();

  constructor(options?: OllamaBrainProviderOptions) {
    const rawUrl = (options?.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
    assertLoopbackEndpoint(rawUrl);
    this.baseUrl = rawUrl;
    this.timeoutMs = options?.timeoutMs ?? 30000;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.customModels = options?.models;
    this.keepAlive = options?.keepAlive;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getCapabilities(): BrainCapabilities {
    return BrainCapabilitiesSchema.parse({
      streaming: true,
      fastChat: true,
      reasoning: false,
      coding: false,
      toolUse: false, // Invariant: no tool execution authority in Pre-M5
      multimodal: false,
      vision: false,
      webResearch: false,
      longContext: true,
      local: true,
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
      displayName: 'Ollama Local Model Provider',
      accessPath: 'local_runtime',
      capabilities: this.getCapabilities(),
      health: {
        status: 'healthy',
        checkedAt: Date.now()
      },
      documentationUrl: 'https://github.com/ollama/ollama'
    });
  }

  /**
   * Performs a lightweight presence check WITHOUT consuming model generation quota.
   * Dispatches GET /api/version.
   */
  async health(): Promise<ProviderHealth> {
    const checkedAt = Date.now();
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 3000));

    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/version`, {
        method: 'GET',
        headers: {
          'User-Agent': 'MAVE-Desktop/1.0'
        },
        signal: controller.signal
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        let versionStr = '';
        try {
          const body = (await response.json()) as OllamaVersionResponse;
          if (body && typeof body.version === 'string') {
            versionStr = ` (v${body.version})`;
          }
        } catch {
          // ignore json parse error
        }

        return ProviderHealthSchema.parse({
          status: 'healthy',
          message: `Ollama local daemon operational${versionStr}`,
          latencyMs,
          checkedAt
        });
      }

      return ProviderHealthSchema.parse({
        status: response.status >= 500 ? 'degraded' : 'unavailable',
        message: `Ollama service returned HTTP ${response.status}`,
        latencyMs,
        checkedAt
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const safeMessage = sanitizeOllamaErrorMessage(err instanceof Error ? err.message : String(err));
      logger.debug({ err: safeMessage, latencyMs }, 'Ollama health check unavailable');
      return ProviderHealthSchema.parse({
        status: 'unavailable',
        message: `Ollama local daemon unreachable: ${safeMessage}`,
        latencyMs,
        checkedAt
      });
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Introspects installed models from local Ollama runtime (GET /api/tags).
   * Does NOT use static vendor entitlement lists.
   */
  async getCatalog(): Promise<ModelCatalogSnapshot> {
    if (this.customModels && this.customModels.length > 0) {
      for (const m of this.customModels) {
        this.rawTagByModelId.set(m.id, m.id);
      }
      return ModelCatalogSnapshotSchema.parse({
        providerId: this.id,
        models: this.customModels,
        refreshedAt: Date.now()
      });
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 4000));

    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'User-Agent': 'MAVE-Desktop/1.0'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Failed to fetch Ollama tags');
        return ModelCatalogSnapshotSchema.parse({
          providerId: this.id,
          models: [],
          refreshedAt: Date.now()
        });
      }

      const body = (await response.json()) as OllamaTagsResponse;
      const rawModels = body?.models ?? [];
      const descriptors: ModelDescriptor[] = [];

      for (const raw of rawModels) {
        if (!raw.name || !raw.name.trim()) continue;

        const rawTag = raw.name.trim();
        const modelId = normalizeOllamaModelId(rawTag);
        this.rawTagByModelId.set(modelId, rawTag);
        this.rawTagByModelId.set(rawTag, rawTag);

        const lowerName = rawTag.toLowerCase();
        const paramSizeStr = raw.details?.parameter_size ?? '';
        const paramNum = parseFloat(paramSizeStr.replace(/[^0-9.]/g, '')) || 0;
        const family = (raw.details?.family ?? '').toLowerCase();
        const families = (raw.details?.families ?? []).map((f) => f.toLowerCase());

        // Derived classifications
        const isFast = paramNum <= 8 || lowerName.includes('1.5b') || lowerName.includes('3b') || lowerName.includes('7b') || lowerName.includes('8b');
        const isReasoning = lowerName.includes('r1') || lowerName.includes('reasoning') || paramNum > 14;
        const isCoding = lowerName.includes('coder') || lowerName.includes('code');
        const isVision = families.includes('clip') || lowerName.includes('llava') || lowerName.includes('vision');
        const isThai = family === 'qwen2' || family === 'gemma2' || families.includes('qwen2') || families.includes('gemma2') || lowerName.includes('qwen') || lowerName.includes('gemma') || lowerName.includes('typhoon');

        const contextLength = raw.details?.context_length ?? 32768;
        const contextClass = contextLength >= 65536 ? 'massive' : contextLength >= 32768 ? 'large' : 'standard';

        const latencyClass = paramNum <= 3 ? 'interactive' : paramNum <= 8 ? 'balanced' : 'heavy';
        const qualityClass = isReasoning ? 'reasoning' : isFast ? 'fast' : 'balanced';

        const desc: ModelDescriptor = {
          id: modelId,
          providerId: this.id,
          displayName: `${rawTag} (Local Ollama)`,
          status: 'available',
          latencyClass,
          qualityClass,
          costClass: 'free',
          contextClass,
          contextWindowTokens: contextLength,
          capabilities: {
            streaming: true,
            fastChat: isFast,
            reasoning: isReasoning,
            coding: isCoding,
            toolUse: false,
            multimodal: isVision,
            vision: isVision,
            webResearch: false,
            longContext: contextLength >= 32768,
            local: true,
            structuredOutput: true,
            cancellation: true,
            supportsThai: isThai,
            supportsEnglish: true
          },
          privacyClass: 'local_only'
        };

        try {
          descriptors.push(ModelDescriptorSchema.parse(desc));
        } catch (schemaErr) {
          logger.warn({ schemaErr, rawTag }, 'Failed to parse Ollama model descriptor schema');
        }
      }

      return ModelCatalogSnapshotSchema.parse({
        providerId: this.id,
        models: descriptors,
        refreshedAt: Date.now()
      });
    } catch (err) {
      logger.warn({ err: sanitizeOllamaErrorMessage(err instanceof Error ? err.message : String(err)) }, 'Ollama getCatalog failed');
      return ModelCatalogSnapshotSchema.parse({
        providerId: this.id,
        models: [],
        refreshedAt: Date.now()
      });
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Resolves a normalized ModelId back to an Ollama concrete tag.
   */
  resolveConcreteModelTag(modelIdOrTag: string): string | undefined {
    const direct = this.rawTagByModelId.get(modelIdOrTag);
    if (direct) return direct;

    const normalized = normalizeOllamaModelId(modelIdOrTag);
    const fromNorm = this.rawTagByModelId.get(normalized);
    if (fromNorm) return fromNorm;

    // Fallback: if tag has a colon (e.g. 'qwen2.5:7b') or stripped 'ollama-' prefix
    if (modelIdOrTag.startsWith('ollama-')) {
      const candidate = modelIdOrTag.slice('ollama-'.length);
      // Try restoring the last hyphen to colon (e.g. 'qwen2.5-7b' -> 'qwen2.5:7b')
      const lastHyphen = candidate.lastIndexOf('-');
      if (lastHyphen !== -1) {
        return `${candidate.slice(0, lastHyphen)}:${candidate.slice(lastHyphen + 1)}`;
      }
      return candidate;
    }

    return modelIdOrTag;
  }

  /**
   * Executes direct streaming chat generation against local Ollama.
   *
   * Invariant: Requires options.modelId; maps normalized ModelId to Ollama model tag.
   */
  async *chat(request: BrainRequest, options?: BrainRequestOptions): AsyncIterable<BrainEvent> {
    const requestId = request.requestId;

    // 1. Enforce Direct Model Invariant: modelId must be present
    const normalizedModelId = options?.modelId;
    if (!normalizedModelId) {
      logger.error({ requestId }, 'OllamaBrainProvider invoked without required options.modelId');
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

    // 2. Resolve concrete Ollama tag
    const concreteTag = this.resolveConcreteModelTag(normalizedModelId);
    if (!concreteTag) {
      logger.error({ requestId, normalizedModelId }, 'Unknown normalized modelId for Ollama provider');
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'model_unavailable',
          message: `Unknown or unmapped model '${normalizedModelId}' for provider 'ollama'`,
          retryable: false
        }
      };
      return;
    }

    // 3. Message mapping: map BrainRequest messages cleanly to Ollama chat messages
    const ollamaMessages: Array<{ role: string; content: string }> = [];

    // Prepend system prompt if provided and not already first message
    if (request.systemPrompt && request.systemPrompt.trim()) {
      const firstIsSystem = request.messages[0]?.role === 'system';
      if (!firstIsSystem) {
        ollamaMessages.push({
          role: 'system',
          content: request.systemPrompt.trim()
        });
      }
    }

    for (const msg of request.messages) {
      ollamaMessages.push({
        role: msg.role,
        content: msg.content
      });
    }

    const payload: Record<string, unknown> = {
      model: concreteTag,
      messages: ollamaMessages,
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7
      }
    };

    if (this.keepAlive !== undefined) {
      payload.keep_alive = this.keepAlive;
    }

    const startTime = Date.now();
    let timeToFirstTokenMs: number | undefined;
    let accumulatedText = '';
    const signal = options?.signal;

    if (signal?.aborted) {
      yield {
        type: 'cancelled',
        requestId,
        reason: 'user_cancelled'
      };
      return;
    }

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MAVE-Desktop/1.0'
        },
        body: JSON.stringify(payload),
        signal
      });
    } catch (err) {
      if (signal?.aborted) {
        yield {
          type: 'cancelled',
          requestId,
          reason: 'user_cancelled'
        };
        return;
      }
      const safeMessage = sanitizeOllamaErrorMessage(err instanceof Error ? err.message : String(err));
      logger.error({ requestId, err: safeMessage }, 'Ollama chat fetch failed');
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'provider_unavailable',
          message: `Ollama local daemon unavailable: ${safeMessage}`,
          retryable: false
        }
      };
      return;
    }

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {}
      const safeMessage = sanitizeOllamaErrorMessage(errorBody || `HTTP ${response.status}`);
      yield {
        type: 'error',
        requestId,
        error: {
          code: response.status === 404 ? 'model_unavailable' : 'provider_unavailable',
          message: `Ollama returned HTTP ${response.status}: ${safeMessage}`,
          retryable: false
        }
      };
      return;
    }

    if (!response.body) {
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'provider_unavailable',
          message: 'Ollama response body is empty',
          retryable: false
        }
      };
      return;
    }

    // 4. Emit started event
    yield {
      type: 'started',
      requestId,
      providerId: this.id,
      modelId: normalizedModelId,
      timestamp: Date.now()
    };

    // 5. Stream parsing (NDJSON)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (signal?.aborted) {
          try {
            await reader.cancel();
          } catch {}
          yield {
            type: 'cancelled',
            requestId,
            reason: 'user_cancelled'
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
          if (!trimmed) continue;

          let chunk: OllamaChatChunk;
          try {
            chunk = JSON.parse(trimmed) as OllamaChatChunk;
          } catch {
            continue; // Skip malformed non-JSON lines
          }

          if (chunk.error) {
            yield {
              type: 'error',
              requestId,
              error: {
                code: 'provider_unavailable',
                message: sanitizeOllamaErrorMessage(chunk.error),
                retryable: false
              }
            };
            return;
          }

          const token = chunk.message?.content;
          if (token && token.length > 0) {
            if (timeToFirstTokenMs === undefined) {
              timeToFirstTokenMs = Date.now() - startTime;
            }
            accumulatedText += token;
            yield {
              type: 'delta',
              requestId,
              text: token
            };
          }

          if (chunk.done) {
            const promptTokens = chunk.prompt_eval_count ?? 0;
            const completionTokens = chunk.eval_count ?? 0;
            const totalTokens = promptTokens + completionTokens;

            yield {
              type: 'completed',
              requestId,
              text: accumulatedText,
              finishReason: chunk.done_reason === 'stop' ? 'end_turn' : (chunk.done_reason || 'end_turn'),
              usage: {
                promptTokens,
                completionTokens,
                totalTokens,
                estimatedCostUsd: 0 // Local execution has zero external API cost
              },
              timing: {
                timeToFirstTokenMs,
                totalDurationMs: Date.now() - startTime
              }
            };
            return;
          }
        }
      }

      // If stream ended without explicit chunk.done
      yield {
        type: 'completed',
        requestId,
        text: accumulatedText,
        finishReason: 'end_turn',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0
        },
        timing: {
          timeToFirstTokenMs,
          totalDurationMs: Date.now() - startTime
        }
      };
    } catch (err) {
      if (signal?.aborted) {
        yield {
          type: 'cancelled',
          requestId,
          reason: 'user_cancelled'
        };
        return;
      }
      const safeMessage = sanitizeOllamaErrorMessage(err instanceof Error ? err.message : String(err));
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'provider_unavailable',
          message: `Stream read error: ${safeMessage}`,
          retryable: false
        }
      };
    } finally {
      reader.releaseLock();
    }
  }
}
