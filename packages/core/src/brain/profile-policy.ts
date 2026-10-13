import type {
  BrainCapabilities,
  BrainProfileDefinition,
  BrainProfileId
} from '@mave/contracts';
import { DEFAULT_BRAIN_PROFILES } from '@mave/contracts';
import {
  BrainProfilePolicyError,
  type BrainProfileResolution
} from './types.js';

export interface BrainProfilePolicyMapping {
  preferredProviderId?: string;
  fallbackChain?: string[];
  allowFallback?: boolean;
  requiredCapabilities?: Partial<BrainCapabilities>;
}

export interface BrainProfilePolicyOptions {
  profiles?: Record<BrainProfileId, BrainProfileDefinition>;
  mappings?: Partial<Record<BrainProfileId, BrainProfilePolicyMapping>>;
  defaultProfileId?: BrainProfileId;
}

/**
 * Deterministic BrainProfilePolicy resolver.
 * Translates a requested BrainProfileId into required capabilities,
 * preferred provider candidate, and fallback chain.
 *
 * Maintains clean separation:
 * Intent / future mode -> Brain Profile -> BrainRouter -> Provider.
 *
 * User / caller explicit overrides take strict precedence.
 */
export class BrainProfilePolicy {
  private readonly profiles: Record<BrainProfileId, BrainProfileDefinition>;
  private readonly mappings: Partial<Record<BrainProfileId, BrainProfilePolicyMapping>>;
  private readonly defaultProfileId?: BrainProfileId;

  constructor(options?: BrainProfilePolicyOptions) {
    this.profiles = options?.profiles
      ? { ...options.profiles }
      : { ...DEFAULT_BRAIN_PROFILES };
    this.mappings = options?.mappings ? { ...options.mappings } : {};
    this.defaultProfileId = options?.defaultProfileId;
  }

  getProfiles(): BrainProfileDefinition[] {
    return Object.values(this.profiles);
  }

  getProfile(id: string): BrainProfileDefinition | undefined {
    return (this.profiles as Record<string, BrainProfileDefinition | undefined>)[id];
  }

  hasProfile(id: string): boolean {
    return id in this.profiles;
  }

  getDefaultProfileId(): BrainProfileId | undefined {
    return this.defaultProfileId;
  }

  /**
   * Deterministically resolves a profile into concrete routing requirements.
   * If caller supplies explicit overrides (e.g. preferredProviderId), they take precedence.
   */
  resolve(
    profileIdOrInput?: BrainProfileId | string,
    overrides?: {
      preferredProviderId?: string;
      fallbackChain?: string[];
      requiredCapabilities?: Partial<BrainCapabilities>;
    }
  ): BrainProfileResolution {
    const targetId = profileIdOrInput || this.defaultProfileId;
    if (!targetId) {
      throw new BrainProfilePolicyError(
        'unknown_profile',
        'No profile specified and no default profile configured'
      );
    }

    const profile = this.getProfile(targetId);
    if (!profile) {
      const valid = Object.keys(this.profiles).join(', ');
      throw new BrainProfilePolicyError(
        'unknown_profile',
        `Unknown brain profile '${targetId}'. Valid profiles are: ${valid}`
      );
    }

    const mapping = (this.mappings as Record<string, BrainProfilePolicyMapping | undefined>)[profile.id];

    // Priority:
    // 1. Explicit caller override
    // 2. Policy mapping (if configured)
    // 3. Profile default
    const preferredProviderId =
      overrides?.preferredProviderId?.trim() ||
      mapping?.preferredProviderId?.trim() ||
      undefined;

    const fallbackChain =
      overrides?.fallbackChain ??
      mapping?.fallbackChain ??
      undefined;

    const allowFallback =
      mapping?.allowFallback !== undefined
        ? mapping.allowFallback
        : profile.allowFallback;

    const requiredCapabilities: Partial<BrainCapabilities> = {
      ...profile.requiredCapabilities,
      ...mapping?.requiredCapabilities,
      ...overrides?.requiredCapabilities
    };

    return {
      profileId: profile.id,
      definition: profile,
      requiredCapabilities,
      preferredProviderId,
      fallbackChain,
      allowFallback
    };
  }
}

