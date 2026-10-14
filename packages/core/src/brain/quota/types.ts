// ============================================================================
// Internal Subscription Runtime Quota Types (F1.5-S4)
//
// Invariant: Kept internal to @mave/core and @mave/providers.
// Zero changes to frozen @mave/contracts.
//
// Health != Quota:
// A provider may be healthy (installed, authenticated, responsive)
// while its subscription quota is temporarily exhausted.
// ============================================================================

export const RUNTIME_QUOTA_STATUSES = [
  'unknown',
  'available',
  'quota_limited',
  'rate_limited'
] as const;

export type RuntimeQuotaStatus = (typeof RUNTIME_QUOTA_STATUSES)[number];

export const RUNTIME_QUOTA_SOURCES = [
  'runtime_event',
  'runtime_error',
  'runtime_status',
  'successful_execution',
  'manual_invalidation',
  'unknown'
] as const;

export type RuntimeQuotaSource = (typeof RUNTIME_QUOTA_SOURCES)[number];

export const RUNTIME_QUOTA_SCOPES = ['runtime', 'model', 'unknown'] as const;
export type RuntimeQuotaScope = (typeof RUNTIME_QUOTA_SCOPES)[number];

export interface RuntimeQuotaState {
  readonly providerId: string;
  readonly status: RuntimeQuotaStatus;
  readonly observedAt: number;
  readonly resetAt?: number;
  readonly source: RuntimeQuotaSource;
  readonly reason?: string;
  readonly lifecycleToken?: string;
  readonly scope?: RuntimeQuotaScope;
  readonly modelId?: string;
}

export interface RuntimeQuotaObservation {
  readonly providerId: string;
  readonly status: RuntimeQuotaStatus;
  readonly observedAt?: number;
  readonly resetAt?: number;
  readonly source?: RuntimeQuotaSource;
  readonly reason?: string;
  readonly lifecycleToken?: string;
  readonly scope?: RuntimeQuotaScope;
  readonly modelId?: string;
}

export type QuotaRoutingPreference = 'priority_first' | 'available_first';

/**
 * Evaluates whether a quota state currently represents an active provider-level quota block.
 * An active block is 'quota_limited' or 'rate_limited' whose scope is 'runtime' (or default)
 * and whose resetAt (if set) is in the future.
 *
 * Invariant: Model-scoped or unknown-scoped states NEVER block the provider-wide runtime.
 */
export function isQuotaBlocked(state?: RuntimeQuotaState, now = Date.now()): boolean {
  if (!state || (state.status !== 'quota_limited' && state.status !== 'rate_limited')) {
    return false;
  }
  if (state.scope !== undefined && state.scope !== 'runtime') {
    return false;
  }
  if (state.resetAt !== undefined && now >= state.resetAt) {
    // Quota block has expired; expires to 'unknown', no longer actively blocked
    return false;
  }
  return true;
}

