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
  ModelLatencyClass
} from '@mave/contracts';

export interface BrainRouteRequest {
  profileId?: BrainProfileId;
  preferredProviderId?: string;
  preferredModelId?: string;
  defaultProviderId?: string;
  fallbackChain?: string[];
  requiredCapabilities?: Partial<BrainCapabilities>;
  localOnly?: boolean;
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
  modelId?: string;
  reason: string;
  fallbackUsed: boolean;
  attemptedProviderIds: string[];
  attemptedModelIds?: string[];
  routeAttempts?: number;
}

export type BrainRoutingErrorCode =
  | 'no_usable_provider'
  | 'provider_not_found'
  | 'no_healthy_provider'
  | 'capability_not_supported';

export class BrainRoutingError extends Error {
  readonly code: BrainRoutingErrorCode;
  readonly attemptedProviderIds: string[];

  constructor(
    code: BrainRoutingErrorCode,
    message: string,
    attemptedProviderIds: string[] = []
  ) {
    super(message);
    this.name = 'BrainRoutingError';
    this.code = code;
    this.attemptedProviderIds = attemptedProviderIds;
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
