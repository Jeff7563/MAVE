// ============================================================================
// Internal Subscription Runtime Quota Store (F1.5-S4)
//
// Invariant: In-memory only. Zero DB persistence. Zero background polling.
// Concurrency-safe: pure synchronous state transitions.
// Expiration invariant: Expired blocks return status 'unknown' (NOT 'available').
// ============================================================================

import {
  type RuntimeQuotaObservation,
  type RuntimeQuotaState,
  type RuntimeQuotaStatus,
  isQuotaBlocked
} from './types.js';

export interface RuntimeQuotaStoreOptions {
  clock?: () => number;
}

const STATUS_PRIORITY: Record<RuntimeQuotaStatus, number> = {
  quota_limited: 3,
  rate_limited: 3,
  available: 2,
  unknown: 1
};

/**
 * Sanitizes reason text to prevent logging secrets or filesystem paths.
 */
function sanitizeReason(reason?: string): string | undefined {
  if (!reason) return undefined;
  return reason
    .replace(/Bearer\s+[A-Za-z0-9_\-.~]+/gi, 'Bearer [REDACTED]')
    .replace(/(?:key|token|secret|password)[=:\s]+[A-Za-z0-9_\-.~]+/gi, '<redacted_credential>')
    .replace(/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n\s]+\\)*[^\\/:*?"<>|\r\n\s]*/g, '<path>')
    .replace(/(?:\/[a-zA-Z0-9_.-]+)+/g, '<path>');
}

export class RuntimeQuotaStore {
  private readonly states = new Map<string, RuntimeQuotaState>();
  private readonly clock: () => number;

  constructor(options: RuntimeQuotaStoreOptions = {}) {
    this.clock = options.clock ?? (() => Date.now());
  }

  /**
   * Retrieves current quota state for a provider.
   *
   * Invariants:
   * 1. If no state recorded: returns status 'unknown'.
   * 2. If provider lifecycleToken has changed: returns status 'unknown'.
   * 3. If resetAt timestamp has elapsed: state expires to status 'unknown' (not 'available').
   */
  get(providerId: string, lifecycleToken?: string, now = this.clock()): RuntimeQuotaState {
    const normalizedId = providerId.trim();
    const existing = this.states.get(normalizedId);

    if (!existing) {
      return Object.freeze({
        providerId: normalizedId,
        status: 'unknown',
        observedAt: 0,
        source: 'unknown'
      });
    }

    // Lifecycle token mismatch -> previous provider instance unlinked
    if (lifecycleToken && existing.lifecycleToken && existing.lifecycleToken !== lifecycleToken) {
      this.states.delete(normalizedId);
      return Object.freeze({
        providerId: normalizedId,
        status: 'unknown',
        observedAt: 0,
        source: 'unknown'
      });
    }

    // Reset window expiration check
    if (existing.resetAt !== undefined && now >= existing.resetAt) {
      const expiredState: RuntimeQuotaState = Object.freeze({
        providerId: normalizedId,
        status: 'unknown',
        observedAt: now,
        source: 'unknown',
        reason: `Quota block expired past reset time (${new Date(existing.resetAt).toISOString()})`,
        lifecycleToken: existing.lifecycleToken
      });
      this.states.set(normalizedId, expiredState);
      return expiredState;
    }

    return existing;
  }

  /**
   * Records a new quota observation.
   *
   * Invariants:
   * 1. Stale older observations (observedAt < existing.observedAt) are rejected.
   * 2. For identical timestamps, blocked states (quota_limited / rate_limited) take priority.
   * 3. Never invents resetAt; stored strictly when supplied.
   */
  record(observation: RuntimeQuotaObservation): RuntimeQuotaState {
    if (!observation.providerId || !observation.providerId.trim()) {
      throw new Error('providerId must be a non-empty string');
    }

    const normalizedId = observation.providerId.trim();
    const observedAt = observation.observedAt ?? this.clock();
    const existing = this.states.get(normalizedId);

    if (existing) {
      // 1. Stale observation protection: older timestamp cannot override newer observation
      if (existing.observedAt > observedAt) {
        return existing;
      }

      // 2. Tie-break for equal timestamps: preserve higher-severity status
      if (existing.observedAt === observedAt) {
        const existingPrio = STATUS_PRIORITY[existing.status] ?? 0;
        const newPrio = STATUS_PRIORITY[observation.status] ?? 0;
        if (existingPrio > newPrio) {
          return existing;
        }
      }
    }

    const newState: RuntimeQuotaState = Object.freeze({
      providerId: normalizedId,
      status: observation.status,
      observedAt,
      resetAt: observation.resetAt,
      source: observation.source ?? 'unknown',
      reason: sanitizeReason(observation.reason),
      lifecycleToken: observation.lifecycleToken ?? existing?.lifecycleToken
    });

    this.states.set(normalizedId, newState);
    return newState;
  }

  /**
   * Invalidates any recorded quota state for a provider, resetting it back to 'unknown'.
   */
  invalidate(providerId: string, reason?: string): RuntimeQuotaState {
    const normalizedId = providerId.trim();
    const existing = this.states.get(normalizedId);
    const newState: RuntimeQuotaState = Object.freeze({
      providerId: normalizedId,
      status: 'unknown',
      observedAt: this.clock(),
      source: 'manual_invalidation',
      reason: reason ? sanitizeReason(reason) : undefined,
      lifecycleToken: existing?.lifecycleToken
    });
    this.states.set(normalizedId, newState);
    return newState;
  }

  /**
   * Cleans up expired quota blocks and returns count of updated entries.
   */
  clearExpired(now = this.clock()): number {
    let count = 0;
    for (const [id, state] of this.states.entries()) {
      if (state.resetAt !== undefined && now >= state.resetAt) {
        this.states.set(
          id,
          Object.freeze({
            providerId: id,
            status: 'unknown',
            observedAt: now,
            source: 'unknown',
            reason: `Quota block expired past reset time (${new Date(state.resetAt).toISOString()})`,
            lifecycleToken: state.lifecycleToken
          })
        );
        count++;
      }
    }
    return count;
  }

  /**
   * Returns a snapshot of all tracked provider quota states.
   */
  snapshot(now = this.clock()): Map<string, RuntimeQuotaState> {
    const map = new Map<string, RuntimeQuotaState>();
    for (const [id] of this.states.entries()) {
      map.set(id, this.get(id, undefined, now));
    }
    return map;
  }

  /**
   * Evaluates if a provider is currently known to be quota-blocked.
   */
  isBlocked(providerId: string, lifecycleToken?: string, now = this.clock()): boolean {
    const state = this.get(providerId, lifecycleToken);
    return isQuotaBlocked(state, now);
  }

  /**
   * Resets all quota tracking in the store.
   */
  reset(): void {
    this.states.clear();
  }
}
