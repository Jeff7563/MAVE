import type { BrainCapabilities, BrainProvider } from '@mave/contracts';
import type { BrainProviderRegistry } from './provider-registry.js';
import { BrainProfilePolicy } from './profile-policy.js';
import {
  BrainRoutingError,
  type BrainRouteDecision,
  type BrainRouteRequest,
  type BrainRoutingErrorCode
} from './types.js';

export interface BrainRouterOptions {
  registry: BrainProviderRegistry;
  profilePolicy?: BrainProfilePolicy;
  defaultProvider?: string;
  fallbackChain?: string[];
  /** Accepted for configuration compatibility; not used during provider selection. */
  timeoutMs?: number;
}

function isRouterOptions(
  arg: BrainProviderRegistry | BrainRouterOptions
): arg is BrainRouterOptions {
  return typeof arg === 'object' && arg !== null && 'registry' in arg;
}

export class BrainRouter {
  private readonly registry: BrainProviderRegistry;
  private readonly profilePolicy: BrainProfilePolicy;
  private readonly defaultProvider?: string;
  private readonly fallbackChain: string[];

  constructor(
    registryOrOptions: BrainProviderRegistry | BrainRouterOptions,
    defaultOptions?: {
      defaultProvider?: string;
      fallbackChain?: string[];
      timeoutMs?: number;
      profilePolicy?: BrainProfilePolicy;
    }
  ) {
    if (isRouterOptions(registryOrOptions)) {
      this.registry = registryOrOptions.registry;
      this.profilePolicy = registryOrOptions.profilePolicy ?? new BrainProfilePolicy();
      this.defaultProvider = registryOrOptions.defaultProvider;
      this.fallbackChain = registryOrOptions.fallbackChain ?? [];
    } else {
      this.registry = registryOrOptions;
      this.profilePolicy = defaultOptions?.profilePolicy ?? new BrainProfilePolicy();
      this.defaultProvider = defaultOptions?.defaultProvider;
      this.fallbackChain = defaultOptions?.fallbackChain ?? [];
    }
  }

  getProfilePolicy(): BrainProfilePolicy {
    return this.profilePolicy;
  }

  /**
   * Evaluates whether a provider satisfies all requested capabilities.
   * Only capabilities explicitly set to true in `required` must be supported.
   */
  private matchesRequiredCapabilities(
    providerCapabilities: BrainCapabilities,
    required?: Partial<BrainCapabilities>
  ): boolean {
    if (!required) {
      return true;
    }
    for (const [key, val] of Object.entries(required)) {
      if (val === true) {
        if ((providerCapabilities as Record<string, boolean | undefined>)[key] !== true) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Deterministically selects a brain provider based on configured candidates,
   * required capabilities, and provider health status.
   *
   * Degradation policy:
   * 1. Preferred healthy candidate is used immediately.
   * 2. Degraded candidate is remembered but bypassed if a subsequent healthy fallback exists.
   * 3. First healthy fallback in configured order wins.
   * 4. If no healthy fallback exists, the first eligible degraded candidate is used.
   * 5. Unhealthy or unconfigured providers are skipped.
   * 6. If no eligible candidate exists, a normalized BrainRoutingError is thrown.
   *
   * This method NEVER calls provider.chat().
   */
  async route(request: BrainRouteRequest = {}): Promise<BrainRouteDecision> {
    let preferred = request.preferredProviderId?.trim();
    let defaultId = request.defaultProviderId?.trim() || this.defaultProvider?.trim();
    let fallbacks = request.fallbackChain ?? this.fallbackChain;
    let requiredCapabilities = request.requiredCapabilities;

    if (request.profileId) {
      const resolution = this.profilePolicy.resolve(request.profileId, {
        preferredProviderId: preferred,
        fallbackChain: request.fallbackChain,
        requiredCapabilities: request.requiredCapabilities
      });

      requiredCapabilities = resolution.requiredCapabilities;
      if (resolution.preferredProviderId) {
        preferred = resolution.preferredProviderId;
      }
      if (!resolution.allowFallback) {
        fallbacks = [];
        defaultId = preferred || undefined;
      } else if (resolution.fallbackChain && resolution.fallbackChain.length > 0) {
        fallbacks = resolution.fallbackChain;
      }
    }

    const rawCandidates: string[] = [];

    if (preferred) {
      rawCandidates.push(preferred);
    }

    if (defaultId) {
      rawCandidates.push(defaultId);
    }

    if (fallbacks) {
      for (const fb of fallbacks) {
        if (typeof fb === 'string' && fb.trim()) {
          rawCandidates.push(fb.trim());
        }
      }
    }

    // Deduplicate candidate IDs while strictly preserving appearance order
    const candidateIds: string[] = [];
    const seen = new Set<string>();
    for (const id of rawCandidates) {
      if (!seen.has(id)) {
        seen.add(id);
        candidateIds.push(id);
      }
    }

    if (candidateIds.length === 0) {
      throw new BrainRoutingError(
        'provider_not_found',
        'No provider configured or requested for routing',
        []
      );
    }

    const primaryCandidateId = candidateIds[0]!;
    const isExplicitPreferred = Boolean(preferred && preferred === primaryCandidateId);
    const attemptedProviderIds: string[] = [];

    let firstDegradedCandidate: {
      provider: BrainProvider;
      providerId: string;
      reason: string;
      fallbackUsed: boolean;
    } | null = null;

    let anyCandidateRegistered = false;
    let allRegisteredFailedCapabilities = true;

    for (const id of candidateIds) {
      attemptedProviderIds.push(id);

      const provider = this.registry.get(id);
      if (!provider) {
        continue;
      }

      anyCandidateRegistered = true;
      const capabilities = provider.getCapabilities();
      if (!this.matchesRequiredCapabilities(capabilities, requiredCapabilities)) {
        continue;
      }

      allRegisteredFailedCapabilities = false;

      let health;
      try {
        health = await provider.health();
      } catch {
        // Health check failure -> treat as unusable
        continue;
      }

      if (health.status === 'unhealthy' || health.status === 'unconfigured') {
        continue;
      }

      const isPrimary = (id === primaryCandidateId);

      if (health.status === 'healthy') {
        if (isPrimary) {
          const reason = isExplicitPreferred
            ? `Selected preferred provider '${id}' (healthy)`
            : `Selected default provider '${id}' (healthy)`;

          return {
            provider,
            providerId: id,
            reason,
            fallbackUsed: false,
            attemptedProviderIds
          };
        }

        // Healthy fallback provider
        const reason = firstDegradedCandidate
          ? `Selected healthy fallback provider '${id}' over degraded primary '${firstDegradedCandidate.providerId}'`
          : `Selected healthy fallback provider '${id}' (earlier candidates unavailable)`;

        return {
          provider,
          providerId: id,
          reason,
          fallbackUsed: true,
          attemptedProviderIds
        };
      }

      if (health.status === 'degraded') {
        if (!firstDegradedCandidate) {
          const reason = isPrimary
            ? `Selected degraded primary provider '${id}' (no healthy fallback available)`
            : `Selected degraded fallback provider '${id}' (no healthy provider available)`;

          firstDegradedCandidate = {
            provider,
            providerId: id,
            reason,
            fallbackUsed: !isPrimary
          };
        }
        // Continue search in case a later candidate in fallbackChain is healthy
      }
    }

    // If no healthy candidate was found, but an eligible degraded candidate exists
    if (firstDegradedCandidate) {
      return {
        provider: firstDegradedCandidate.provider,
        providerId: firstDegradedCandidate.providerId,
        reason: firstDegradedCandidate.reason,
        fallbackUsed: firstDegradedCandidate.fallbackUsed,
        attemptedProviderIds
      };
    }

    // No usable provider found
    let errorCode: BrainRoutingErrorCode = 'no_usable_provider';
    let errorMessage = `No usable provider found among candidates: [${candidateIds.join(', ')}]`;

    if (!anyCandidateRegistered) {
      errorCode = 'provider_not_found';
      errorMessage = `None of the candidate providers [${candidateIds.join(', ')}] are registered`;
    } else if (allRegisteredFailedCapabilities) {
      errorCode = 'capability_not_supported';
      errorMessage = `None of the registered candidate providers meet the required capabilities`;
    } else {
      errorCode = 'no_healthy_provider';
      errorMessage = `All candidate providers [${candidateIds.join(', ')}] are unhealthy, unconfigured, or failing`;
    }

    throw new BrainRoutingError(errorCode, errorMessage, attemptedProviderIds);
  }
}
