import type {
  BrainCapabilities,
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ProviderHealth
} from '@mave/contracts';
import { BrainCapabilitiesSchema, ProviderHealthSchema } from '@mave/contracts';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:provider:openai-compatible' });

/**
 * One adapter for every service that speaks the OpenAI Chat Completions
 * streaming API: Groq, Cerebras, Gemini (OpenAI endpoint), OpenRouter, OpenAI,
 * and local runtimes (Ollama, LM Studio, llama.cpp server, vLLM).
 *
 * This is MAVE's Fast Brain path: low TTFT, streaming, clean cancel, text-only.
 * Official API keys only (no token reuse). Local presets need no key.
 */
export interface OpenAICompatiblePreset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  requiresApiKey: boolean;
  local: boolean;
  /** Env var commonly used for this service's key. */
  apiKeyEnv?: string;
}

export const OPENAI_COMPATIBLE_PRESETS: Record<string, OpenAICompatiblePreset> = {
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    requiresApiKey: true,
    local: false,
    apiKeyEnv: 'GROQ_API_KEY'
  },
  cerebras: {
    id: 'cerebras',
    label: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama-3.3-70b',
    requiresApiKey: true,
    local: false,
    apiKeyEnv: 'CEREBRAS_API_KEY'
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    requiresApiKey: true,
    local: false,
    apiKeyEnv: 'GEMINI_API_KEY'
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.5-flash',
    requiresApiKey: true,
    local: false,
    apiKeyEnv: 'OPENROUTER_API_KEY'
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
    local: false,
    apiKeyEnv: 'OPENAI_API_KEY'
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'qwen2.5:7b',
    requiresApiKey: false,
    local: true
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    baseUrl: 'http://127.0.0.1:1234/v1',
    defaultModel: 'local-model',
    requiresApiKey: false,
    local: true
  }
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface OpenAICompatibleBrainProviderOptions {
  /** Provider id inside MAVE's registry. Default: `fast`. */
  id?: string;
  /** Preset name (groq, gemini, ollama...). Values below override it. */
  preset?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  label?: string;
  temperature?: number;
  maxTokens?: number;
  /** Mark as local runtime (enables local_offline profile). */
  local?: boolean;
  capabilities?: Partial<BrainCapabilities>;
  fetchImpl?: FetchLike;
  /** Health check timeout. Default 3000ms. */
  healthTimeoutMs?: number;
}

export const MAVE_FAST_BRAIN_INSTRUCTION =
  'You are MAVE, a friendly personal AI assistant and English-learning companion. ' +
  'Reply in the language the user used (Thai or English). Keep spoken answers short and natural, ' +
  'one to three sentences unless the user asks for more. Do not use markdown in normal conversation.';

export class OpenAICompatibleBrainProvider implements BrainProvider {
  readonly id: string;
  readonly label: string;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly requiresApiKey: boolean;
  private readonly local: boolean;
  private readonly temperature?: number;
  private readonly maxTokens?: number;
  private readonly capabilityOverrides: Partial<BrainCapabilities>;
  private readonly fetchImpl: FetchLike;
  private readonly healthTimeoutMs: number;
  private readonly active = new Map<string, AbortController>();

  constructor(options: OpenAICompatibleBrainProviderOptions) {
    const preset = options.preset ? OPENAI_COMPATIBLE_PRESETS[options.preset] : undefined;
    if (options.preset && !preset) {
      throw new Error(
        `Unknown fast brain preset '${options.preset}'. Use one of: ${Object.keys(OPENAI_COMPATIBLE_PRESETS).join(', ')}`
      );
    }
    const baseUrl = options.baseUrl ?? preset?.baseUrl;
    if (!baseUrl) throw new Error('OpenAICompatibleBrainProvider needs a preset or baseUrl');
    const model = options.model ?? preset?.defaultModel;
    if (!model) throw new Error('OpenAICompatibleBrainProvider needs a model');

    this.id = options.id ?? 'fast';
    this.label = options.label ?? preset?.label ?? 'OpenAI-compatible';
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
    this.apiKey = options.apiKey?.trim() || undefined;
    this.local = options.local ?? preset?.local ?? /^https?:\/\/(127\.0\.0\.1|localhost)/.test(this.baseUrl);
    this.requiresApiKey = preset?.requiresApiKey ?? !this.local;
    this.temperature = options.temperature;
    this.maxTokens = options.maxTokens;
    this.capabilityOverrides = options.capabilities ?? {};
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.healthTimeoutMs = options.healthTimeoutMs ?? 3000;
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
      local: this.local,
      ...this.capabilityOverrides
    });
  }

  /** Lists models (free endpoint) to confirm the key and service work without using chat quota. */
  async health(): Promise<ProviderHealth> {
    const startedAt = Date.now();
    if (this.requiresApiKey && !this.apiKey) {
      return ProviderHealthSchema.parse({
        status: 'unconfigured',
        message: `${this.label}: no API key configured`,
        checkedAt: Date.now()
      });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.healthTimeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.headers(),
        signal: controller.signal
      });
      const latencyMs = Date.now() - startedAt;
      if (res.status === 401 || res.status === 403) {
        return ProviderHealthSchema.parse({ status: 'unhealthy', message: `${this.label}: API key rejected (${res.status})`, latencyMs });
      }
      if (!res.ok) {
        return ProviderHealthSchema.parse({ status: 'degraded', message: `${this.label}: models endpoint returned ${res.status}`, latencyMs });
      }
      return ProviderHealthSchema.parse({ status: 'healthy', message: `${this.label} ready (${this.model})`, latencyMs });
    } catch (err) {
      return ProviderHealthSchema.parse({
        status: this.local ? 'unconfigured' : 'unhealthy',
        message: `${this.label} unreachable: ${err instanceof Error ? err.message : String(err)}`,
        latencyMs: Date.now() - startedAt
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async cancel(requestId: string): Promise<void> {
    this.active.get(requestId)?.abort('cancelled');
    this.active.delete(requestId);
  }

  async *chat(request: BrainRequest, options?: BrainRequestOptions): AsyncIterable<BrainEvent> {
    const requestId = request.requestId;
    if (options?.signal?.aborted) {
      yield { type: 'cancelled', requestId, reason: 'Cancelled before execution' };
      return;
    }
    if (this.requiresApiKey && !this.apiKey) {
      yield {
        type: 'error',
        requestId,
        error: { code: 'provider_auth', message: `${this.label}: no API key configured`, retryable: false }
      };
      return;
    }

    const controller = new AbortController();
    const onAbort = () => controller.abort('cancelled');
    options?.signal?.addEventListener('abort', onAbort, { once: true });
    this.active.set(requestId, controller);

    const messages = [
      { role: 'system', content: [MAVE_FAST_BRAIN_INSTRUCTION, request.systemPrompt].filter(Boolean).join('\n\n') },
      ...request.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
        .map((m) => ({ role: m.role, content: m.content }))
    ];

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: true
    };
    const temperature = options?.temperature ?? this.temperature;
    const maxTokens = options?.maxTokens ?? this.maxTokens;
    if (temperature !== undefined) body['temperature'] = temperature;
    if (maxTokens !== undefined) body['max_tokens'] = maxTokens;

    let text = '';
    let started = false;
    let finishReason: string | undefined;
    let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;

    try {
      let res: Response;
      try {
        res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { ...this.headers(), 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } catch (err) {
        if (controller.signal.aborted) {
          yield { type: 'cancelled', requestId, reason: 'Cancelled' };
          return;
        }
        yield {
          type: 'error',
          requestId,
          error: { code: 'provider_unavailable', message: `${this.label} unreachable: ${errorMessage(err)}`, retryable: true }
        };
        return;
      }

      if (!res.ok || !res.body) {
        const detail = await safeText(res);
        yield { type: 'error', requestId, error: classifyHttpError(this.label, res.status, detail) };
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;

      while (!done) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (err) {
          if (controller.signal.aborted) {
            yield { type: 'cancelled', requestId, reason: 'Cancelled' };
            return;
          }
          throw err;
        }
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            done = true;
            break;
          }
          let parsed: StreamChunk;
          try {
            parsed = JSON.parse(payload) as StreamChunk;
          } catch {
            continue;
          }
          if (parsed.error) {
            yield {
              type: 'error',
              requestId,
              error: { code: 'provider_invalid_response', message: String(parsed.error.message ?? 'stream error'), retryable: false }
            };
            return;
          }
          const choice = parsed.choices?.[0];
          const delta = choice?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            if (!started) {
              started = true;
              yield { type: 'started', requestId, providerId: this.id, timestamp: Date.now() };
            }
            text += delta;
            yield { type: 'delta', requestId, text: delta };
          }
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          if (parsed.usage) {
            usage = {
              promptTokens: parsed.usage.prompt_tokens,
              completionTokens: parsed.usage.completion_tokens,
              totalTokens: parsed.usage.total_tokens
            };
          }
        }
      }
      try {
        await reader.cancel();
      } catch {
        // already closed
      }

      if (controller.signal.aborted) {
        yield { type: 'cancelled', requestId, reason: 'Cancelled' };
        return;
      }
      if (!started) {
        yield { type: 'started', requestId, providerId: this.id, timestamp: Date.now() };
      }
      yield { type: 'completed', requestId, text, usage, finishReason: finishReason ?? 'stop' };
    } catch (err) {
      logger.warn({ requestId, err: errorMessage(err) }, 'fast brain stream failed');
      yield {
        type: 'error',
        requestId,
        error: { code: 'runtime_error', message: errorMessage(err), retryable: true }
      };
    } finally {
      options?.signal?.removeEventListener('abort', onAbort);
      this.active.delete(requestId);
    }
  }

  private headers(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }
}

interface StreamChunk {
  choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
}

function classifyHttpError(label: string, status: number, detail: string) {
  const suffix = detail ? `: ${detail.slice(0, 300)}` : '';
  if (status === 401 || status === 403) {
    return { code: 'provider_auth' as const, message: `${label} rejected the API key (${status})${suffix}`, retryable: false };
  }
  if (status === 429) {
    return { code: 'provider_limit' as const, message: `${label} rate limit reached${suffix}`, retryable: true };
  }
  if (status >= 500) {
    return { code: 'provider_unavailable' as const, message: `${label} server error ${status}${suffix}`, retryable: true };
  }
  return { code: 'provider_invalid_response' as const, message: `${label} returned ${status}${suffix}`, retryable: false };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Build a fast brain from environment variables, or return undefined when not configured.
 *   MAVE_FAST_BRAIN=groq|cerebras|gemini|openrouter|openai|ollama|lmstudio|custom
 *   MAVE_FAST_BRAIN_API_KEY (or the preset's usual env var, e.g. GROQ_API_KEY)
 *   MAVE_FAST_BRAIN_MODEL, MAVE_FAST_BRAIN_BASE_URL (required for custom)
 */
export function createFastBrainFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<OpenAICompatibleBrainProviderOptions> = {}
): OpenAICompatibleBrainProvider | undefined {
  const choice = env['MAVE_FAST_BRAIN']?.trim().toLowerCase();
  if (!choice || choice === 'off' || choice === 'none') return undefined;
  const preset = choice === 'custom' ? undefined : OPENAI_COMPATIBLE_PRESETS[choice];
  if (choice !== 'custom' && !preset) {
    logger.warn({ choice }, 'unknown MAVE_FAST_BRAIN preset; fast brain disabled');
    return undefined;
  }
  const apiKey = env['MAVE_FAST_BRAIN_API_KEY'] || (preset?.apiKeyEnv ? env[preset.apiKeyEnv] : undefined);
  try {
    return new OpenAICompatibleBrainProvider({
      preset: preset?.id,
      baseUrl: env['MAVE_FAST_BRAIN_BASE_URL'] || undefined,
      model: env['MAVE_FAST_BRAIN_MODEL'] || undefined,
      apiKey,
      ...overrides
    });
  } catch (err) {
    logger.warn({ err: errorMessage(err) }, 'invalid fast brain configuration; fast brain disabled');
    return undefined;
  }
}
