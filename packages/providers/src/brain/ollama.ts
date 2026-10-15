import type {
  BrainCapabilities,
  BrainEvent,
  BrainRequest,
  BrainRequestOptions,
  ModelCatalogProvider,
  ModelCatalogSnapshot,
  ModelDescriptor,
  ModelLatencyClass,
  ModelQualityClass,
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
import { CANONICAL_LOCAL_MODEL_QUALIFICATIONS } from './qualification-data.js';
import {
  OllamaResidencyManager,
  type ModelLease
} from './residency.js';

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

/**
 * Internal qualification descriptor for local models.
 * Decouples discovery/availability from verified production promotion.
 * Prepares the ground for C2 benchmarking without public contract changes.
 */
export interface LocalModelQualification {
  /**
   * Raw tag (e.g. 'qwen2.5:1.5b') or normalized model ID ('ollama-qwen2.5-1.5b').
   */
  readonly modelIdOrTag: string;
  /**
   * Whether this model has been empirically evaluated and approved for MAVE production routing.
   * Invariant: MUST be false in C2. C3 alone sets this to true upon production promotion.
   */
  readonly productionApproved: boolean;
  /**
   * Whether this model is verified suitable for fast conversational voice (TTFT <= 1-3s).
   */
  readonly fastChatSuitable?: boolean;
  /**
   * Whether this model has passed empirical Thai conversational quality evaluation.
   */
  readonly thaiQualified?: boolean;
  /**
   * Whether this model has passed empirical English conversational quality evaluation.
   */
  readonly englishQualified?: boolean;
  /**
   * Target role if approved: 'FAST' | 'BALANCED' | 'REASONING'.
   */
  readonly targetRole?: 'FAST' | 'BALANCED' | 'REASONING';
  /**
   * Empirical 100-point qualification score from C2 benchmark.
   */
  readonly qualificationScore?: number;
  /**
   * Recommended production role: 'FAST' | 'BALANCED' | 'REASONING'.
   */
  readonly recommendedRole?: 'FAST' | 'BALANCED' | 'REASONING';
  /**
   * Whether this model is the recommended candidate for production Fast Brain promotion in C3.
   */
  readonly recommendedCandidate?: boolean;
  /**
   * Empirical benchmark evidence collected during C2.
   */
  readonly benchmarkEvidence?: {
    readonly digest?: string;
    readonly parameterSize?: string;
    readonly quantization?: string;
    readonly ollamaVersion?: string;
    readonly benchmarkDate?: string;
    readonly contextLengthUsed?: number;
    readonly measuredColdTtftMs?: number;
    readonly measuredWarmTtftMs?: number;
    readonly measuredPromptEvalTokPerSec?: number;
    readonly measuredEvalTokPerSec?: number;
    readonly measuredE2eTokPerSec?: number;
    readonly measuredTotalLatencyMs?: number;
    readonly residentVramBytes?: number;
    readonly peakGpuMemoryBytes?: number;
    readonly totalScore?: number;
    readonly notes?: string;
  };
}

export interface OllamaBrainProviderOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  models?: ModelDescriptor[];
  keepAlive?: string | number;
  qualifications?: LocalModelQualification[];
  defaultNumCtx?: number;
  generationOptions?: Record<string, unknown>;
  residencyManager?: OllamaResidencyManager;
  idleTimeoutMs?: number;
}

export interface OllamaTagModel {
  name: string;
  model?: string;
  size?: number;
  digest?: string;
  modified_at?: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
    context_length?: number;
    embedding_length?: number;
  };
  capabilities?: string[];
}

/**
 * Detects whether an Ollama model is capable of generative text/chat completion.
 * Excludes embedding-only models (e.g. nomic-embed-text) from conversational catalogs.
 */
export function isGenerativeChatModel(raw: OllamaTagModel): boolean {
  const caps = (raw.capabilities ?? []).map((c) => c.toLowerCase());
  const name = raw.name.toLowerCase();
  const family = (raw.details?.family ?? '').toLowerCase();

  if (caps.length > 0) {
    // If Ollama explicitly lists capabilities, embedding-only models have ['embedding'] but lack ['completion']
    if (caps.includes('embedding') && !caps.includes('completion')) {
      return false;
    }
    if (!caps.includes('completion')) {
      return false;
    }
    return true;
  }

  // Fallback heuristic for older Ollama versions omitting capabilities array
  if (name.includes('embed') || family.includes('bert')) {
    return false;
  }

  return true;
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
  readonly residencyManager: OllamaResidencyManager;

  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly customModels?: ModelDescriptor[];
  private readonly keepAlive?: string | number;
  private readonly defaultNumCtx?: number;
  private readonly generationOptions?: Record<string, unknown>;
  private readonly rawTagByModelId = new Map<string, string>();
  private readonly qualifications = new Map<string, LocalModelQualification>();

  constructor(options?: OllamaBrainProviderOptions) {
    const rawUrl = (options?.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
    assertLoopbackEndpoint(rawUrl);
    this.baseUrl = rawUrl;
    this.timeoutMs = options?.timeoutMs ?? 30000;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.customModels = options?.models;
    this.keepAlive = options?.keepAlive;
    this.defaultNumCtx = options?.defaultNumCtx;
    this.generationOptions = options?.generationOptions;

    this.residencyManager =
      options?.residencyManager ??
      new OllamaResidencyManager({
        baseUrl: this.baseUrl,
        fetchFn: this.fetchFn,
        timeoutMs: this.timeoutMs,
        defaultKeepAlive: this.keepAlive ?? '5m',
        idleTimeoutMs: options?.idleTimeoutMs
      });

    const quals = options?.qualifications ?? CANONICAL_LOCAL_MODEL_QUALIFICATIONS;
    for (const qual of quals) {
      this.setQualification(qual);
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getResidencyManager(): OllamaResidencyManager {
    return this.residencyManager;
  }

  /**
   * Prewarms the local model into VRAM when a voice / conversation session is anticipated.
   * Lifecycle-only operation: does not mutate conversation or emit inference telemetry.
   */
  async prewarm(modelIdOrTag?: string): Promise<void> {
    const targetTag = modelIdOrTag
      ? this.resolveConcreteModelTag(modelIdOrTag) ?? modelIdOrTag
      : 'qwen2.5:1.5b';
    await this.residencyManager.prewarm(targetTag, { keepAlive: this.keepAlive });
  }

  getQualification(modelIdOrTag: string): LocalModelQualification | undefined {
    const direct = this.qualifications.get(modelIdOrTag.toLowerCase());
    if (direct) return direct;
    const normalized = normalizeOllamaModelId(modelIdOrTag);
    return this.qualifications.get(normalized);
  }

  setQualification(qualification: LocalModelQualification): void {
    const raw = qualification.modelIdOrTag.trim().toLowerCase();
    const normalized = normalizeOllamaModelId(raw);
    this.qualifications.set(raw, qualification);
    this.qualifications.set(normalized, qualification);
  }

  /**
   * Returns provider-level transport and runtime capabilities.
   * Semantic suitability (fastChat, reasoning, bilingual) belongs to model descriptors,
   * NOT global provider claims.
   */
  getCapabilities(): BrainCapabilities {
    let fastChat = false;
    let supportsThai = false;
    let supportsEnglish = false;
    let reasoning = false;

    for (const qual of this.qualifications.values()) {
      if (qual.productionApproved) {
        if (qual.fastChatSuitable) fastChat = true;
        if (qual.thaiQualified) supportsThai = true;
        if (qual.englishQualified) supportsEnglish = true;
        if (qual.targetRole === 'REASONING') reasoning = true;
      }
    }

    return BrainCapabilitiesSchema.parse({
      streaming: true,
      fastChat,
      reasoning,
      coding: false,
      toolUse: false, // Invariant: no tool execution authority in Pre-M5
      multimodal: false,
      vision: false,
      webResearch: false,
      longContext: false,
      local: true,
      structuredOutput: true,
      cancellation: true,
      supportsThai,
      supportsEnglish
    });
  }

  getDescriptor(): ProviderDescriptor {
    let defaultModelId: string | undefined;
    for (const qual of this.qualifications.values()) {
      if (qual.productionApproved && qual.targetRole === 'FAST') {
        defaultModelId = normalizeOllamaModelId(qual.modelIdOrTag);
        break;
      }
    }

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
      defaultModelId,
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

        // 1. Generative model filtering (exclude embedding-only models)
        if (!isGenerativeChatModel(raw)) {
          logger.debug({ rawTag }, 'Excluding non-generative/embedding-only model from conversational catalog');
          continue;
        }

        // 2. Collision-safe ModelId normalization and mapping
        const baseModelId = normalizeOllamaModelId(rawTag);
        let modelId = baseModelId;
        let collisionIndex = 1;
        while (this.rawTagByModelId.has(modelId) && this.rawTagByModelId.get(modelId) !== rawTag) {
          modelId = `${baseModelId}-c${collisionIndex++}`;
        }
        this.rawTagByModelId.set(modelId, rawTag);
        this.rawTagByModelId.set(rawTag, rawTag);

        const lowerName = rawTag.toLowerCase();
        const paramSizeStr = raw.details?.parameter_size ?? '';
        const paramNum = parseFloat(paramSizeStr.replace(/[^0-9.]/g, '')) || 0;
        const families = (raw.details?.families ?? []).map((f) => f.toLowerCase());
        const ollamaCaps = (raw.capabilities ?? []).map((c) => c.toLowerCase());

        // 3. Qualification resolution (C1.1 unbenchmarked default vs C2 qualification vs C3 exact digest promotion)
        const qual = this.qualifications.get(rawTag.toLowerCase()) ?? this.qualifications.get(modelId);
        const requiredDigest = qual?.benchmarkEvidence?.digest;
        const actualDigest = raw.digest;
        // Exact digest gate: qualification is valid ONLY for the exact qualified artifact
        const digestMatches = !actualDigest || !requiredDigest || (actualDigest === requiredDigest || actualDigest.startsWith(requiredDigest) || requiredDigest.startsWith(actualDigest));
        const isApproved = Boolean(qual?.productionApproved === true && digestMatches);

        const hasVision = ollamaCaps.includes('vision') || families.includes('clip') || lowerName.includes('llava');
        const hasThinking = ollamaCaps.includes('thinking');

        // Capability derivation:
        // In C1.1, unbenchmarked discovered models do NOT claim fastChat, reasoning, or language qualification.
        // Qualification must be established empirically in C2.
        const fastChat = isApproved ? Boolean(qual?.fastChatSuitable) : false;
        const supportsThai = isApproved ? Boolean(qual?.thaiQualified) : false;
        const supportsEnglish = isApproved ? Boolean(qual?.englishQualified) : false;
        const reasoning = isApproved && qual?.targetRole === 'REASONING';
        const coding = false; // Invariant: no tool authority in Pre-M5

        const contextLength = raw.details?.context_length ?? 32768;
        const contextClass = contextLength >= 65536 ? 'massive' : contextLength >= 32768 ? 'large' : 'standard';

        const latencyClass: ModelLatencyClass = paramNum <= 3 ? 'interactive' : paramNum <= 8 ? 'balanced' : 'heavy';
        const qualityClass: ModelQualityClass = isApproved
          ? qual?.targetRole === 'FAST'
            ? 'fast'
            : qual?.targetRole === 'REASONING'
              ? 'reasoning'
              : 'balanced'
          : hasThinking
            ? 'reasoning'
            : 'balanced';

        const displayName = isApproved
          ? `${rawTag} (Local Ollama - Qualified)`
          : `${rawTag} (Local Ollama - Candidate)`;

        const desc: ModelDescriptor = {
          id: modelId,
          providerId: this.id,
          displayName,
          status: 'available',
          latencyClass,
          qualityClass,
          costClass: 'free',
          contextClass,
          contextWindowTokens: contextLength,
          capabilities: {
            streaming: true,
            fastChat,
            reasoning,
            coding,
            toolUse: false,
            multimodal: hasVision,
            vision: hasVision,
            webResearch: false,
            longContext: contextLength >= 32768,
            local: true,
            structuredOutput: true,
            cancellation: true,
            supportsThai,
            supportsEnglish
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
    // 1. Direct hit in authoritative catalog map
    const direct = this.rawTagByModelId.get(modelIdOrTag);
    if (direct) return direct;

    const normalized = normalizeOllamaModelId(modelIdOrTag);
    const fromNorm = this.rawTagByModelId.get(normalized);
    if (fromNorm) return fromNorm;

    // 2. Direct Ollama tag syntax (contains colon or slash)
    if (modelIdOrTag.includes(':') || modelIdOrTag.includes('/')) {
      return modelIdOrTag;
    }

    // 3. Fallback: if tag has a stripped 'ollama-' prefix
    if (modelIdOrTag.startsWith('ollama-')) {
      const candidate = modelIdOrTag.slice('ollama-'.length);
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

    const signal = options?.signal;
    if (signal?.aborted) {
      yield {
        type: 'cancelled',
        requestId,
        reason: 'user_cancelled'
      };
      return;
    }

    // Acquire active lease from ResidencyManager
    let lease: ModelLease | null = null;
    try {
      lease = await this.residencyManager.acquireLease(concreteTag, { signal, keepAlive: this.keepAlive });
    } catch (leaseErr) {
      if (signal?.aborted) {
        yield {
          type: 'cancelled',
          requestId,
          reason: 'user_cancelled'
        };
        return;
      }
      const safeMessage = sanitizeOllamaErrorMessage(leaseErr instanceof Error ? leaseErr.message : String(leaseErr));
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'provider_unavailable',
          message: `Failed to acquire local model lease: ${safeMessage}`,
          retryable: false
        }
      };
      return;
    }

    try {
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

    const modelOptions: Record<string, unknown> = {
      temperature: options?.temperature ?? 0.7
    };
    if (this.defaultNumCtx !== undefined) {
      modelOptions.num_ctx = this.defaultNumCtx;
    }
    if (options?.maxTokens !== undefined) {
      modelOptions.num_predict = options.maxTokens;
    }
    if (this.generationOptions) {
      Object.assign(modelOptions, this.generationOptions);
    }

    const payload: Record<string, unknown> = {
      model: concreteTag,
      messages: ollamaMessages,
      stream: true,
      options: modelOptions
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
                promptDurationNs: chunk.prompt_eval_duration,
                generationDurationNs: chunk.eval_duration,
                estimatedCostUsd: 0 // Local execution has zero external API cost
              },
              timing: {
                timeToFirstTokenMs,
                totalDurationMs: Date.now() - startTime,
                promptDurationNs: chunk.prompt_eval_duration,
                generationDurationNs: chunk.eval_duration
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
  } finally {
    lease?.release();
  }
}
}


