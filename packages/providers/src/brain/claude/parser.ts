import type { BrainErrorCode, BrainUsage } from '@mave/contracts';

export interface ClaudeInitEvent {
  type: 'system';
  subtype: 'init';
  session_id?: string;
  model?: string;
  tools?: string[];
  apiKeySource?: string;
  claude_code_version?: string;
  permissionMode?: string;
}

export interface ClaudeStatusEvent {
  type: 'system';
  subtype: 'status';
  status?: string;
  session_id?: string;
}

export interface ClaudeStreamContentBlockDeltaEvent {
  type: 'stream_event';
  event: {
    type: 'content_block_delta';
    index?: number;
    delta?: {
      type: 'text_delta' | string;
      text?: string;
    };
  };
}

export interface ClaudeStreamMessageDeltaEvent {
  type: 'stream_event';
  event: {
    type: 'message_delta';
    delta?: {
      stop_reason?: string;
    };
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
}

export interface ClaudeStreamGenericEvent {
  type: 'stream_event';
  event: {
    type: string;
    [key: string]: unknown;
  };
}

export interface ClaudeRateLimitEvent {
  type: 'rate_limit_event';
  rate_limit_info?: {
    status?: 'allowed' | 'rejected' | string;
    resetsAt?: number;
    rateLimitType?: string;
    unifiedWindows?: {
      five_hour?: {
        utilization?: number;
        resetsAt?: number;
      };
      seven_day?: {
        utilization?: number;
        resetsAt?: number;
      };
    };
  };
}

export interface ClaudeAssistantMessageEvent {
  type: 'assistant';
  message?: {
    model?: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
  };
}

export interface ClaudeResultEvent {
  type: 'result';
  subtype?: 'success' | 'error' | string;
  is_error?: boolean;
  result?: string;
  error?: string;
  api_error_status?: number | null;
  ttft_ms?: number;
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

export type ClaudeCliEvent =
  | ClaudeInitEvent
  | ClaudeStatusEvent
  | ClaudeStreamContentBlockDeltaEvent
  | ClaudeStreamMessageDeltaEvent
  | ClaudeStreamGenericEvent
  | ClaudeRateLimitEvent
  | ClaudeAssistantMessageEvent
  | ClaudeResultEvent
  | { type: string; [key: string]: unknown };

/**
 * Maps raw Claude Code usage fields to canonical BrainUsage.
 */
export function mapClaudeCodeUsage(rawUsage?: {
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
export function classifyClaudeCodeError(errorMessage: string, _rawEvent?: unknown): BrainErrorCode {
  const lower = errorMessage.toLowerCase();

  // 1. Quota & rate limits (e.g. rate limit event status 'rejected', 429)
  if (
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('overage') ||
    lower.includes('resetsat') ||
    lower.includes('credit') ||
    lower.includes('capacity')
  ) {
    return 'quota_limited';
  }

  // 2. Unrecognized model
  if (
    lower.includes('unrecognized_model') ||
    lower.includes('model not found') ||
    lower.includes('invalid model') ||
    lower.includes('unknown model')
  ) {
    return 'model_unavailable';
  }

  // 3. Authentication & subscription failures
  if (
    lower.includes('auth') ||
    lower.includes('unauthenticated') ||
    lower.includes('login') ||
    lower.includes('unauthorized') ||
    lower.includes('subscription required') ||
    lower.includes('setup-token')
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
  if (lower.includes('tool') || lower.includes('permission')) {
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
