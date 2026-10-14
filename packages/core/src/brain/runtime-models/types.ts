// ============================================================================
// Internal Runtime Model Types & Selection Contracts for Subscription Runtimes
//
// Invariant: Kept internal to @mave/core and @mave/providers to avoid
// premature mutation or expansion of public frozen contracts (@mave/contracts).
// ============================================================================

export const MODEL_ROLES = [
  'FAST',
  'BALANCED',
  'REASONING',
  'CODING',
  'AGENT'
] as const;
export type ModelRole = (typeof MODEL_ROLES)[number];

export const RUNTIME_MODEL_DISCOVERY_SOURCES = [
  'runtime_enumerated',
  'runtime_observed',
  'runtime_alias',
  'runtime_cache',
  'configured',
  'unknown'
] as const;
export type RuntimeModelDiscoverySource = (typeof RUNTIME_MODEL_DISCOVERY_SOURCES)[number];

export const RUNTIME_MODEL_AVAILABILITIES = [
  'available',
  'quota_limited',
  'rate_limited',
  'unavailable',
  'unknown'
] as const;
export type RuntimeModelAvailability = (typeof RUNTIME_MODEL_AVAILABILITIES)[number];

export interface RuntimeModelDescriptor {
  readonly modelId: string;
  readonly runtimeProviderId: string;
  readonly displayName: string;
  readonly alias?: string;
  readonly canonicalName?: string;
  readonly supportedRoles: readonly ModelRole[];
  readonly discoverySource: RuntimeModelDiscoverySource;
  readonly availability: RuntimeModelAvailability;
  readonly discoveredAt: number;
  readonly selectionMechanism?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export const RUNTIME_MODEL_SELECTION_MODES = [
  'AUTO',
  'PREFERRED',
  'LOCKED'
] as const;
export type RuntimeModelSelectionMode = (typeof RUNTIME_MODEL_SELECTION_MODES)[number];

export interface RuntimeModelSelectionRequest {
  readonly runtimeProviderId: string;
  readonly role: ModelRole;
  readonly mode?: RuntimeModelSelectionMode;
  readonly preferredModelId?: string;
  readonly lockedModelId?: string;
  readonly allowFallback?: boolean;
}

export interface RuntimeModelSelectionResult {
  readonly selectedModelId: string;
  readonly descriptor: RuntimeModelDescriptor;
  readonly mode: RuntimeModelSelectionMode;
  readonly role: ModelRole;
  readonly fallbackOccurred: boolean;
  readonly reason: string;
}

export type RuntimeModelSelectionErrorCode =
  | 'runtime_not_found'
  | 'no_models_discovered'
  | 'role_not_supported'
  | 'locked_model_not_found'
  | 'locked_model_incompatible'
  | 'locked_model_unavailable'
  | 'preferred_model_not_found'
  | 'preferred_model_incompatible'
  | 'preferred_model_unavailable'
  | 'no_available_model';

export class RuntimeModelSelectionError extends Error {
  readonly code: RuntimeModelSelectionErrorCode;
  readonly runtimeProviderId: string;
  readonly role: ModelRole;
  readonly mode: RuntimeModelSelectionMode;

  constructor(
    code: RuntimeModelSelectionErrorCode,
    message: string,
    context: {
      runtimeProviderId: string;
      role: ModelRole;
      mode: RuntimeModelSelectionMode;
    }
  ) {
    super(message);
    this.name = 'RuntimeModelSelectionError';
    this.code = code;
    this.runtimeProviderId = context.runtimeProviderId;
    this.role = context.role;
    this.mode = context.mode;
  }
}

