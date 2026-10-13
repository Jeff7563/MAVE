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

  // Quota / rate limits / context window limits
  if (
    lower.includes('quota') ||
    lower.includes('limit') ||
    lower.includes('resource_exhausted') ||
    lower.includes('capacity') ||
    lower.includes('credit') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
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

