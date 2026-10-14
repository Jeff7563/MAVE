// ============================================================================
// Internal Runtime Model Types for Provider Adapters
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

