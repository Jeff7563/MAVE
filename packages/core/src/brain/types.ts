import type {
  BrainCapabilities,
  BrainProfileDefinition,
  BrainProfileId,
  BrainProvider,
  BrainRouteOverrides,
  ModelCatalogSnapshot,
  ModelContextClass,
  ModelCostClass,
  ModelDescriptor,
  ModelLatencyClass,
  ProviderKind,
  RouteReason,
  RouteTelemetry
} from '@mave/contracts';

export type { RouteTelemetry };

export const CANONICAL_PROVIDER_ACCESS_CLASSES = [
  'subscription',
  'local',
  'paid_api'
] as const;

export type ProviderAccessClass = (typeof CANONICAL_PROVIDER_ACCESS_CLASSES)[number];
export type ProviderBillingClass = ProviderAccessClass;

import type { TaskContext, TaskIntent } from './task-policy.js';
import type { RuntimeSelectionMode } from './runtime-policy.js';
import type { ModelRole, RuntimeModelSelectionMode } from './runtime-models/types.js';

export interface BrainRoutingDiagnostics {
  routingTimeMs: number;
  providersEvaluated: number;
  modelsEvaluated: number;
  paidApisBlockedCount?: number;
  errorType?: string;
  sanitizedError?: string;
  taskIntent?: string;
  modelRole?: string;
  runtimeSelectionMode?: string;
  modelSelectionMode?: string;
  runtimeModelsEvaluated?: number;
  selectionReason?: string;
  evaluatedProviderIds?: string[];
  skippedRuntimes?: Array<{ runtimeId: string; reason: string }>;
  providerQuotaState?: Record<string, string>;
  quotaSkippedProviders?: Array<{ providerId: string; status: string; reason?: string; resetAt?: number }>;
  quotaPreference?: string;
  quotaSelectionReason?: string;
}

export interface BrainRouteRequest {
  profileId?: BrainProfileId;
  taskIntent?: TaskIntent | string;
  modelRole?: ModelRole;
  taskContext?: TaskContext;
  runtimeMode?: RuntimeSelectionMode;
  modelMode?: RuntimeModelSelectionMode;
  preferredRuntimeId?: string;
  lockedRuntimeId?: string;
  lockedModelId?: string;
  preferredProviderId?: string;
  preferredModelId?: string;
  defaultProviderId?: string;
  fallbackChain?: string[];
  requiredCapabilities?: Partial<BrainCapabilities>;
  localOnly?: boolean;
  overrides?: BrainRouteOverrides;
  maxCostClass?: ModelCostClass;
  maxLatencyClass?: ModelLatencyClass;
  requiredContextTokens?: number;
  requiredContextClass?: ModelContextClass;
  strictLanguageCheck?: boolean;
  allowFallback?: boolean;
  /**
   * Explicit opt-in permission to allow paid/metered API providers for this request.
   * Hard Invariant: Default is false (Subscription-first + local secondary; paid APIs disabled by default).
   * Credential presence != permission to incur API billing.
   */
  allowPaidApis?: boolean;
  maxProviderBudget?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface BrainProfileResolution {
  profileId: BrainProfileId;
  definition: BrainProfileDefinition;
  requiredCapabilities: Partial<BrainCapabilities>;
  preferredProviderId?: string;
  preferredModelId?: string;
  fallbackChain?: string[];
  allowFallback: boolean;
}

export type BrainProfilePolicyErrorCode =
  | 'unknown_profile'
  | 'invalid_profile_configuration';

export class BrainProfilePolicyError extends Error {
  readonly code: BrainProfilePolicyErrorCode;

  constructor(code: BrainProfilePolicyErrorCode, message: string) {
    super(message);
    this.name = 'BrainProfilePolicyError';
    this.code = code;
  }
}

export interface BrainRouteDecision {
  provider: BrainProvider;
  providerId: string;
  providerKind?: ProviderKind;
  model?: ModelDescriptor;
  modelId?: string;
  profileId?: BrainProfileId;
  taskIntent?: TaskIntent;
  modelRole?: ModelRole;
  runtimeSelectionMode?: RuntimeSelectionMode;
  modelSelectionMode?: RuntimeModelSelectionMode;
  reason: string;
  routeReason?: RouteReason;
  fallbackUsed: boolean;
  attemptedProviderIds: string[];
  attemptedModelIds?: string[];
  routeAttempts?: number;
  telemetry?: RouteTelemetry;
  diagnostics?: BrainRoutingDiagnostics;
}

export type BrainRoutingErrorCode =
  | 'no_usable_provider'
  | 'provider_not_found'
  | 'no_healthy_provider'
  | 'capability_not_supported'
  | 'fast_brain_unavailable'
  | 'profile_unavailable'
  | 'model_unavailable'
  | 'provider_unconfigured'
  | 'provider_unavailable'
  | 'quota_limited'
  | 'rate_limited'
  | 'auth_required'
  | 'local_provider_unavailable'
  | 'routing_timeout'
  | 'cancelled';

export class BrainRoutingError extends Error {
  readonly code: BrainRoutingErrorCode;
  readonly attemptedProviderIds: string[];
  readonly attemptedModelIds?: string[];

  constructor(
    code: BrainRoutingErrorCode,
    message: string,
    attemptedProviderIds: string[] = [],
    attemptedModelIds: string[] = []
  ) {
    super(message);
    this.name = 'BrainRoutingError';
    this.code = code;
    this.attemptedProviderIds = attemptedProviderIds;
    this.attemptedModelIds = attemptedModelIds;
  }
}

export type BrainRegistryErrorCode =
  | 'duplicate_provider'
  | 'provider_not_found'
  | 'invalid_provider_id'
  | 'health_timeout'
  | 'provider_unavailable'
  | 'provider_unprobed';

export class BrainRegistryError extends Error {
  readonly code: BrainRegistryErrorCode;

  constructor(code: BrainRegistryErrorCode, message: string) {
    super(message);
    this.name = 'BrainRegistryError';
    this.code = code;
  }
}

export type ModelCatalogErrorCode =
  | 'catalog_not_supported'
  | 'catalog_unavailable'
  | 'catalog_timeout'
  | 'catalog_invalid'
  | 'provider_not_found';

export class ModelCatalogError extends Error {
  readonly code: ModelCatalogErrorCode;
  readonly providerId?: string;

  constructor(code: ModelCatalogErrorCode, message: string, providerId?: string) {
    super(message);
    this.name = 'ModelCatalogError';
    this.code = code;
    this.providerId = providerId;
  }
}

export interface ModelCatalogRuntimeOptions {
  /**
   * Maximum duration in milliseconds allowed for a model catalog retrieval before timing out.
   * Default: 5000ms.
   */
  catalogTimeoutMs?: number;
  /**
   * In-memory cache TTL in milliseconds for model catalog snapshots.
   * Default: 60000ms (1 minute).
   */
  defaultCatalogTtlMs?: number;
}

export interface ModelSelectionCriteria {
  readonly providerId: string;
  readonly catalog: ModelCatalogSnapshot;
  readonly profileId?: BrainProfileId;
  readonly profileResolution?: BrainProfileResolution;
  readonly overrides?: BrainRouteOverrides;
  readonly effectiveLocalOnly?: boolean;
  readonly defaultModelId?: string;
  readonly requiredCapabilities?: Partial<BrainCapabilities>;
  readonly maxCostClass?: ModelCostClass;
  readonly maxLatencyClass?: ModelLatencyClass;
  readonly requiredContextTokens?: number;
  readonly requiredContextClass?: ModelContextClass;
  readonly strictLanguageCheck?: boolean;
  readonly allowFallback?: boolean;
}

export interface ModelSelectionResult {
  readonly success: boolean;
  readonly providerId: string;
  readonly selectedModel?: ModelDescriptor;
  readonly modelId?: string;
  readonly reason: string;
  readonly candidateCount: number;
  readonly eligibleCount: number;
  readonly rejections?: Record<string, string[]>;
}
