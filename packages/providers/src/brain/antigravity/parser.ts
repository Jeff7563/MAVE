import type { BrainErrorCode, BrainUsage } from '@mave/contracts';

export interface AntigravityInitEvent {
  event: 'init';
  conversation_id?: string;
  init?: {
    cwd?: string;
    tools?: string[];
    permission_mode?: string;
  };
}

export interface AntigravityStepUpdateEvent {
  event: 'step_update';
  step_update: {
    conversation_id?: string;
    step_index?: number;
    state?: string;
    step_type: 'user_input' | 'agent_response' | 'tool' | string;
    text_delta?: string;
    duration_seconds?: number;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      thinking_tokens?: number;
      cache_read_tokens?: number;
      total_tokens?: number;
    };
  };
}

export interface AntigravityResultEvent {
  event: 'result';
  result: {
    conversation_id?: string;
    status: 'SUCCESS' | 'CANCELED' | 'INTERRUPTED' | 'ERROR' | 'INVALID' | string;
    response?: string;
    duration_seconds?: number;
    num_turns?: number;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      thinking_tokens?: number;
      cache_read_tokens?: number;
      total_tokens?: number;
    };
    error?:
      | {
          message?: string;
          code?: string;
        }
      | string;
  };
}

export type AntigravityCliEvent =
  | AntigravityInitEvent
  | AntigravityStepUpdateEvent
  | AntigravityResultEvent
  | { event: string; [key: string]: unknown };

/**
 * Maps raw Antigravity CLI usage fields to canonical BrainUsage.
 */
export function mapAntigravityUsage(rawUsage?: {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}): BrainUsage | undefined {
  if (!rawUsage) return undefined;
  if (
    rawUsage.input_tokens === undefined &&
    rawUsage.output_tokens === undefined &&
    rawUsage.total_tokens === undefined
  ) {
    return undefined;
  }

  const promptTokens = rawUsage.input_tokens;
  const completionTokens = rawUsage.output_tokens;
  const totalTokens =
    rawUsage.total_tokens ??
    (promptTokens !== undefined || completionTokens !== undefined
      ? (promptTokens ?? 0) + (completionTokens ?? 0)
      : undefined);

  return {
    promptTokens,
    completionTokens,
    totalTokens
  };
}

/**
 * Normalizes error messages or exit conditions into canonical BrainErrorCode.
 */
export function classifyAntigravityError(errorMessage: string): BrainErrorCode {
  const lower = errorMessage.toLowerCase();

  // 1. Quota & rate limits
  if (
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('too many requests') ||
    lower.includes('429')
  ) {
    return 'quota_limited';
  }

  // 2. Context window limits & token capacity
  if (
    lower.includes('context window') ||
    lower.includes('context length') ||
    lower.includes('maximum tokens') ||
    lower.includes('too large')
  ) {
    return 'provider_limit';
  }

  // Authentication & billing configurations
  if (
    lower.includes('auth') ||
    lower.includes('unauthenticated') ||
    lower.includes('permission_denied') ||
    lower.includes('login') ||
    lower.includes('sign in') ||
    lower.includes('credential') ||
    lower.includes('unauthorized') ||
    lower.includes('bearer') ||
    lower.includes('api_key') ||
    lower.includes('api key') ||
    lower.includes('gemini_api_key') ||
    lower.includes('access_token') ||
    lower.includes('session token')
  ) {
    return 'provider_auth';
  }

  // Timeout
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'provider_timeout';
  }

  // Tool usage / malformed response
  if (
    lower.includes('tool') ||
    lower.includes('invalid response') ||
    lower.includes('malformed') ||
    lower.includes('corrupted')
  ) {
    return 'provider_invalid_response';
  }

  return 'provider_unavailable';
}

/**
 * Redacts filesystem paths and potential credentials from diagnostic messages.
 */
export function redactDiagnosticText(text: string): string {
  if (!text) return '';
  return text
    // Redact Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9_\-.~]+/gi, 'Bearer [REDACTED]')
    // Redact potential API keys or tokens
    .replace(/(?:key|token|secret|password)[=:\s]+[A-Za-z0-9_\-.~]+/gi, '<redacted_credential>')
    // Redact Windows paths
    .replace(/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n\s]+\\)*[^\\/:*?"<>|\r\n\s]*/g, '<path>')
    // Redact Unix paths
    .replace(/(?:\/[a-zA-Z0-9_.-]+)+/g, '<path>');
}

export interface AntigravityQuotaSignal {
  isQuota: boolean;
  code: 'quota_limited' | 'rate_limited';
  scope: 'runtime' | 'model' | 'unknown';
  modelId?: string;
  resetAt?: number;
}

/**
 * Parses Google Antigravity rate limit / quota signals and identifies quota scope:
 * - 'runtime': Project, account, billing, daily plan quota limits.
 * - 'model': Limits mentioning specific models (e.g. gemini-1.5-pro, gemini-1.5-flash) or GenerateContentRequestsPerMinutePerModel.
 * - 'unknown': Generic RESOURCE_EXHAUSTED / 429 without model or account specificity.
 */
export function parseAntigravityQuotaSignal(rawText: string, _rawEvent?: unknown): AntigravityQuotaSignal {
  const lower = (rawText || '').toLowerCase();
  const isQuotaRelated =
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('too many requests') ||
    lower.includes('429');

  if (!isQuotaRelated) {
    return {
      isQuota: false,
      code: 'quota_limited',
      scope: 'unknown'
    };
  }

  let resetAt: number | undefined;
  try {
    const parsed = JSON.parse(rawText);
    const r = parsed.reset_at ?? parsed.resets_at ?? parsed.resetAt;
    if (typeof r === 'number' && Number.isFinite(r)) {
      resetAt = r;
    }
  } catch {}

  // Model scope: requests per model or specific gemini model name
  const isModelScope =
    lower.includes('generatecontentrequestsperminutepermodel') ||
    lower.includes('gemini-1.5-pro') ||
    lower.includes('gemini-1.5-flash') ||
    lower.includes('gemini-2.0') ||
    lower.includes('model quota');

  let modelId: string | undefined;
  if (lower.includes('gemini-1.5-pro')) modelId = 'gemini-1.5-pro';
  else if (lower.includes('gemini-1.5-flash')) modelId = 'gemini-1.5-flash';
  else if (lower.includes('gemini-2.0')) modelId = 'gemini-2.0-flash';

  // Runtime scope: project, account, billing, daily plan quota
  const isRuntimeScope =
    lower.includes('project quota') ||
    lower.includes('account quota') ||
    lower.includes('billing quota') ||
    lower.includes('daily quota') ||
    lower.includes('plan quota');

  let scope: 'runtime' | 'model' | 'unknown' = 'unknown';
  if (isRuntimeScope && !isModelScope) {
    scope = 'runtime';
  } else if (isModelScope) {
    scope = 'model';
  } else {
    scope = 'unknown';
  }

  return {
    isQuota: true,
    code: lower.includes('rate limit') || lower.includes('too many requests') ? 'rate_limited' : 'quota_limited',
    scope,
    modelId,
    resetAt
  };
}

