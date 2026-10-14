import type { BrainErrorCode, BrainUsage } from '@mave/contracts';

export interface CodexThreadStartedEvent {
  type: 'thread.started';
  thread_id?: string;
}

export interface CodexTurnStartedEvent {
  type: 'turn.started';
}

export interface CodexItem {
  id?: string;
  type?: string;
  text?: string;
  message?: string;
  name?: string;
  call?: unknown;
  input?: unknown;
  [key: string]: unknown;
}

export interface CodexItemCompletedEvent {
  type: 'item.completed';
  item?: CodexItem;
}

export interface CodexItemDeltaEvent {
  type: 'item.delta';
  delta?: {
    text?: string;
    [key: string]: unknown;
  };
}

export interface CodexRawUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  cache_write_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
}

export interface CodexTurnCompletedEvent {
  type: 'turn.completed';
  usage?: CodexRawUsage;
}

export interface CodexTurnFailedEvent {
  type: 'turn.failed';
  error?: {
    message?: string;
    [key: string]: unknown;
  };
}

export interface CodexErrorEvent {
  type: 'error';
  message?: string;
  status?: number;
  error?: {
    type?: string;
    message?: string;
    [key: string]: unknown;
  };
}

export type CodexCliEvent =
  | CodexThreadStartedEvent
  | CodexTurnStartedEvent
  | CodexItemCompletedEvent
  | CodexItemDeltaEvent
  | CodexTurnCompletedEvent
  | CodexTurnFailedEvent
  | CodexErrorEvent
  | { type: string; [key: string]: unknown };

/**
 * Maps raw Codex usage fields to canonical BrainUsage.
 */
export function mapCodexUsage(rawUsage?: CodexRawUsage): BrainUsage | undefined {
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
export function classifyCodexError(errorMessage: string, rawEvent?: unknown): BrainErrorCode {
  let combined = errorMessage || '';

  // Extract inner JSON error messages if present
  if (rawEvent && typeof rawEvent === 'object') {
    const raw = rawEvent as Record<string, any>;
    if (raw.error?.message) {
      combined += ' ' + raw.error.message;
    }
    if (raw.message) {
      combined += ' ' + raw.message;
    }
  }

  // Attempt to parse stringified JSON in message (e.g. {"type":"error","status":400,"error":{"message":"..."}})
  try {
    const parsed = JSON.parse(errorMessage);
    if (parsed.error?.message) {
      combined += ' ' + parsed.error.message;
    }
    if (parsed.message) {
      combined += ' ' + parsed.message;
    }
  } catch {}

  const lower = combined.toLowerCase();

  // 1. Quota & rate limits (status 429, usage limits, plan limits)
  if (
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('too many requests') ||
    lower.includes('429') ||
    lower.includes('usage limit') ||
    lower.includes('limit reached') ||
    lower.includes('capacity') ||
    lower.includes('plan limit')
  ) {
    return 'quota_limited';
  }

  // 2. Unrecognized or unsupported model
  if (
    lower.includes('not supported when using codex with a chatgpt account') ||
    lower.includes('model metadata for') ||
    lower.includes('unrecognized_model') ||
    lower.includes('model not found') ||
    lower.includes('invalid model') ||
    lower.includes('unknown model') ||
    lower.includes('invalid_model')
  ) {
    return 'model_unavailable';
  }

  // 3. Authentication & subscription failures
  if (
    lower.includes('auth') ||
    lower.includes('unauthenticated') ||
    lower.includes('login') ||
    lower.includes('unauthorized') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('subscription required') ||
    lower.includes('stored chatgpt tokens: false') ||
    lower.includes('token expired')
  ) {
    return 'auth_required';
  }

  // 4. Timeouts
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'provider_timeout';
  }

  // 5. Cancellations
  if (lower.includes('cancel') || lower.includes('abort') || lower.includes('sigterm')) {
    return 'generation_cancelled';
  }

  // 6. Security & tool blocks
  if (lower.includes('tool') || lower.includes('permission') || lower.includes('sandbox')) {
    return 'provider_unavailable';
  }

  return 'provider_unavailable';
}

/**
 * Redacts filesystem paths, tokens, and potential credentials from diagnostic text.
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

