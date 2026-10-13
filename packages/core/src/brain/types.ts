import type {
  BrainCapabilities,
  BrainProfileDefinition,
  BrainProfileId,
  BrainProvider
} from '@mave/contracts';

export interface BrainRouteRequest {
  profileId?: BrainProfileId;
  preferredProviderId?: string;
  defaultProviderId?: string;
  fallbackChain?: string[];
  requiredCapabilities?: Partial<BrainCapabilities>;
}

export interface BrainProfileResolution {
  profileId: BrainProfileId;
  definition: BrainProfileDefinition;
  requiredCapabilities: Partial<BrainCapabilities>;
  preferredProviderId?: string;
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
  reason: string;
  fallbackUsed: boolean;
  attemptedProviderIds: string[];
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
  | 'invalid_provider_id';

export class BrainRegistryError extends Error {
  readonly code: BrainRegistryErrorCode;

  constructor(code: BrainRegistryErrorCode, message: string) {
    super(message);
    this.name = 'BrainRegistryError';
    this.code = code;
  }
}
