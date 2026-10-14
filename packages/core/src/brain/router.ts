import type {
  BrainCapabilities,
  BrainProfileId,
  BrainProvider,
  ModelCatalogSnapshot,
  ModelDescriptor,
  ProviderHealth,
  ProviderKind,
  RouteReason
} from '@mave/contracts';
import {
  isModelCatalogProvider,
  resolveEffectiveLocalOnly
} from '@mave/contracts';
import type { BrainProviderRegistry } from './provider-registry.js';
import { BrainProfilePolicy } from './profile-policy.js';
import { ModelCatalogRuntime } from './model-catalog.js';
import { ModelPolicy } from './model-policy.js';
import {
  BrainRoutingError,
  ModelCatalogError,
  type BrainProfileResolution,
  type BrainRouteDecision,
  type BrainRouteRequest,
  type BrainRoutingDiagnostics,
  type BrainRoutingErrorCode,
  type RouteTelemetry
} from './types.js';

export interface BrainRouterOptions {
  registry: BrainProviderRegistry;
  profilePolicy?: BrainProfilePolicy;
  catalogRuntime?: ModelCatalogRuntime;
  defaultProvider?: string;
  fallbackChain?: string[];
  /** Accepted for configuration compatibility and routing timeout budget. Default: 4000ms. */
  timeoutMs?: number;
  /** Maximum distinct providers evaluated per turn. Default: 2. */
  maxProviderBudget?: number;
}

function isRouterOptions(
  arg: BrainProviderRegistry | BrainRouterOptions
): arg is BrainRouterOptions {
  return typeof arg === 'object' && arg !== null && 'registry' in arg;
}

interface EligibleCandidate {
  provider: BrainProvider;
  providerId: string;
  model?: ModelDescriptor;
  modelId?: string;
  health: ProviderHealth;
  isDegraded: boolean;
  reason: string;
  routeReason: RouteReason;
  fallbackUsed: boolean;
  initialLifecycleToken?: string;
}

async function raceWithDeadlineAndSignal<T>(
  promise: Promise<T>,
  remainingMs: number,
  signal: AbortSignal | undefined,
  onTimeout: () => BrainRoutingError,
  onAbort: () => BrainRoutingError
): Promise<T> {
  if (signal?.aborted) {
    throw onAbort();
  }
  if (remainingMs <= 0) {
    throw onTimeout();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), remainingMs);
      }),
      new Promise<never>((_, reject) => {
        if (signal) {
          abortListener = () => reject(onAbort());
          signal.addEventListener('abort', abortListener, { once: true });
        }
      })
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (signal && abortListener) {
      signal.removeEventListener('abort', abortListener);
    }
  }
}

export class BrainRouter {
  private readonly registry: BrainProviderRegistry;
  private readonly profilePolicy: BrainProfilePolicy;
  private readonly catalogRuntime: ModelCatalogRuntime;
  private readonly defaultProvider?: string;
  private readonly fallbackChain: string[];
  private readonly timeoutMs: number;
  private readonly maxProviderBudget?: number;

  constructor(
    registryOrOptions: BrainProviderRegistry | BrainRouterOptions,
    defaultOptions?: {
      defaultProvider?: string;
      fallbackChain?: string[];
      timeoutMs?: number;
      profilePolicy?: BrainProfilePolicy;
      catalogRuntime?: ModelCatalogRuntime;
      maxProviderBudget?: number;
    }
  ) {
    if (isRouterOptions(registryOrOptions)) {
      this.registry = registryOrOptions.registry;
      this.profilePolicy = registryOrOptions.profilePolicy ?? new BrainProfilePolicy();
      this.catalogRuntime =
        registryOrOptions.catalogRuntime ?? new ModelCatalogRuntime(this.registry);
      this.defaultProvider = registryOrOptions.defaultProvider;
      this.fallbackChain = registryOrOptions.fallbackChain ?? [];
      this.timeoutMs = registryOrOptions.timeoutMs ?? 4000;
      this.maxProviderBudget = registryOrOptions.maxProviderBudget;
    } else {
      this.registry = registryOrOptions;
      this.profilePolicy = defaultOptions?.profilePolicy ?? new BrainProfilePolicy();
      this.catalogRuntime =
        defaultOptions?.catalogRuntime ?? new ModelCatalogRuntime(this.registry);
      this.defaultProvider = defaultOptions?.defaultProvider;
      this.fallbackChain = defaultOptions?.fallbackChain ?? [];
      this.timeoutMs = defaultOptions?.timeoutMs ?? 4000;
      this.maxProviderBudget = defaultOptions?.maxProviderBudget;
    }
  }

  getRegistry(): BrainProviderRegistry {
    return this.registry;
  }

  getProfilePolicy(): BrainProfilePolicy {
    return this.profilePolicy;
  }

  getCatalogRuntime(): ModelCatalogRuntime {
    return this.catalogRuntime;
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
   * Resolves the canonical ProviderKind for a given provider.
   */
  private getProviderKind(providerId: string): ProviderKind {
    try {
      const meta = this.registry.getProviderMetadata(providerId);
      if (meta?.kind) return meta.kind;
    } catch {
      // not probed or metadata missing
    }
    if (providerId === 'antigravity') return 'agent_runtime_provider';
    return 'model_provider';
  }

  private buildDecision(
    candidate: EligibleCandidate,
    attemptedProviderIds: string[],
    attemptedModelIds: string[],
    profileId: BrainProfileId | undefined,
    startTime: number,
    providersEvaluated: number,
    modelsEvaluated: number
  ): BrainRouteDecision {
    const telemetry: RouteTelemetry = {
      selectedProviderId: candidate.providerId,
      selectedModelId: candidate.modelId,
      profileId,
      routeReason: candidate.routeReason,
      fallbackUsed: candidate.fallbackUsed,
      attemptedProviderIds: [...attemptedProviderIds],
      attemptedModelIds: [...attemptedModelIds],
      routeAttempts: 0
    };

    const diagnostics: BrainRoutingDiagnostics = {
      routingTimeMs: Math.max(0, Date.now() - startTime),
      providersEvaluated,
      modelsEvaluated
    };

    return {
      provider: candidate.provider,
      providerId: candidate.providerId,
      model: candidate.model,
      modelId: candidate.modelId,
      profileId,
      reason: candidate.reason,
      routeReason: candidate.routeReason,
      fallbackUsed: candidate.fallbackUsed,
      attemptedProviderIds: [...attemptedProviderIds],
      attemptedModelIds: [...attemptedModelIds],
      routeAttempts: 0,
      telemetry,
      diagnostics
    };
  }

  private verifyLifecycle(
    providerId: string,
    initialInstance: BrainProvider,
    initialToken: string | undefined,
    attemptedProviderIds: string[],
    attemptedModelIds: string[]
  ): void {
    const current = this.registry.get(providerId);
    const currentToken =
      typeof this.registry.getLifecycleToken === 'function'
        ? this.registry.getLifecycleToken(providerId)
        : undefined;

    if (
      !current ||
      current !== initialInstance ||
      (initialToken !== undefined && currentToken !== initialToken)
    ) {
      throw new BrainRoutingError(
        'provider_unavailable',
        `Provider '${providerId}' was modified or unregistered during routing`,
        attemptedProviderIds,
        attemptedModelIds
      );
    }
  }

  /**
   * Deterministically selects a brain provider and model based on configured candidates,
   * required capabilities, provider health status, model catalog, and model policy.
   *
   * Two-stage intelligence routing:
   * Stage A: Provider Selection & Health Eligibility
   * Stage B: Model Catalog Retrieval & ModelPolicy Selection
   *
   * This method NEVER calls provider.chat().
   */
  async route(request: BrainRouteRequest = {}): Promise<BrainRouteDecision> {
    const startTime = Date.now();
    const routingTimeoutMs = request.timeoutMs ?? this.timeoutMs;
    const signal = request.signal;

    if (signal?.aborted) {
      throw new BrainRoutingError('cancelled', 'Routing was cancelled before execution', []);
    }

    // 1. Resolve Privacy Constraint (Fail-closed)
    const effectiveLocalOnly = resolveEffectiveLocalOnly(request);

    // 2. Resolve Profile & Intent
    const requestedProfileId = request.overrides?.profileId || request.profileId;
    let resolution: BrainProfileResolution | undefined;
    if (requestedProfileId || this.profilePolicy.getDefaultProfileId()) {
      resolution = this.profilePolicy.resolve(requestedProfileId, {
        preferredProviderId:
          request.overrides?.preferredProviderId?.trim() || request.preferredProviderId?.trim(),
        fallbackChain: request.fallbackChain,
        requiredCapabilities: request.requiredCapabilities
      });
    }

    const profileId = resolution?.profileId ?? requestedProfileId;

    // 3. Extract Overrides & Preferences
    const preferredProvider =
      request.overrides?.preferredProviderId?.trim() ||
      request.preferredProviderId?.trim() ||
      resolution?.preferredProviderId?.trim() ||
      undefined;

    const preferredModel =
      request.overrides?.preferredModelId?.trim() ||
      request.preferredModelId?.trim() ||
      resolution?.preferredModelId?.trim() ||
      undefined;

    const defaultId = request.defaultProviderId?.trim() || this.defaultProvider?.trim();

    // 4. Normalize allowFallback semantics (Section 58)
    const hasExplicitOverride = Boolean(preferredProvider || preferredModel);
    const allowFallback =
      request.allowFallback !== undefined
        ? request.allowFallback
        : hasExplicitOverride
          ? false // Strict by default for explicit overrides
          : resolution?.allowFallback !== undefined
            ? resolution.allowFallback
            : true;

    // 5. Required capabilities merge
    const requiredCapabilities: Partial<BrainCapabilities> = {
      ...resolution?.requiredCapabilities,
      ...request.requiredCapabilities
    };

    // 6. Build raw candidate pool in priority order
    const rawCandidateIds: string[] = [];
    if (preferredProvider) {
      rawCandidateIds.push(preferredProvider);
    }

    if (defaultId) {
      rawCandidateIds.push(defaultId);
    }

    const configuredFallbacks =
      request.fallbackChain ?? resolution?.fallbackChain ?? this.fallbackChain;

    if (allowFallback || rawCandidateIds.length === 0) {
      if (configuredFallbacks) {
        for (const fb of configuredFallbacks) {
          if (typeof fb === 'string' && fb.trim()) {
            rawCandidateIds.push(fb.trim());
          }
        }
      }

      // Also include all remaining registered providers in deterministic tie-break order
      const registeredIds = this.registry
        .list()
        .map((p) => p.id)
        .sort((a, b) => a.localeCompare(b));
      for (const regId of registeredIds) {
        rawCandidateIds.push(regId);
      }
    }

    // Deduplicate candidate IDs strictly preserving appearance order
    const candidateIds: string[] = [];
    const seen = new Set<string>();
    for (const c of rawCandidateIds) {
      const trimmed = c.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        candidateIds.push(trimmed);
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
    const isExplicitPreferred = Boolean(preferredProvider && preferredProvider === primaryCandidateId);
    const attemptedProviderIds: string[] = [];
    const attemptedModelIds: string[] = [];
    let providersContacted = 0;
    let totalModelsEvaluated = 0;
    const maxProviderBudget = request.maxProviderBudget ?? this.maxProviderBudget;

    let anyCandidateRegistered = false;
    let allRegisteredFailedCapabilities = true;
    let hasLocalOnlyMismatch = false;

    let firstDegradedCandidate: EligibleCandidate | null = null;

    const deadline = startTime + routingTimeoutMs;

    // 7. Iterate through candidate providers
    for (const id of candidateIds) {
      if (signal?.aborted) {
        throw new BrainRoutingError(
          'cancelled',
          'Routing was cancelled by user',
          attemptedProviderIds,
          attemptedModelIds
        );
      }

      if (Date.now() >= deadline) {
        throw new BrainRoutingError(
          'routing_timeout',
          `Routing budget exceeded (${routingTimeoutMs}ms)`,
          attemptedProviderIds,
          attemptedModelIds
        );
      }

      if (maxProviderBudget !== undefined && providersContacted >= maxProviderBudget) {
        break;
      }

      attemptedProviderIds.push(id);

      const provider = this.registry.get(id);
      if (!provider) {
        continue;
      }

      anyCandidateRegistered = true;
      const initialLifecycleToken =
        typeof this.registry.getLifecycleToken === 'function'
          ? this.registry.getLifecycleToken(id)
          : undefined;

      const capabilities = provider.getCapabilities();
      if (!this.matchesRequiredCapabilities(capabilities, requiredCapabilities)) {
        continue;
      }

      allRegisteredFailedCapabilities = false;

      const providerKind = this.getProviderKind(id);

      // Guard 1: Knowledge provider must never be final brain route
      if (providerKind === 'knowledge_provider') {
        continue;
      }

      // Guard 2: Provider-kind profile boundaries
      if (
        (profileId === 'fast_conversation' ||
          profileId === 'deep_reasoning' ||
          profileId === 'local_offline' ||
          profileId === 'research') &&
        providerKind !== 'model_provider'
      ) {
        continue;
      }

      if (profileId === 'agent_work' && providerKind !== 'agent_runtime_provider') {
        // Direct model provider (even with coding: true) cannot satisfy agent_work
        continue;
      }

      // If no profile requested, agent runtime can only be routed if explicitly preferred or default
      if (
        !profileId &&
        providerKind === 'agent_runtime_provider' &&
        !isExplicitPreferred &&
        id !== defaultId
      ) {
        continue;
      }

      // Guard 3: Direct model provider must implement ModelCatalogProvider
      const isCatalog = isModelCatalogProvider(provider);
      if (providerKind === 'model_provider' && !isCatalog) {
        // A model_provider without ModelCatalogProvider cannot be routed
        continue;
      }

      // Provider-level localOnly check
      if (effectiveLocalOnly && !capabilities.local && !isCatalog) {
        hasLocalOnlyMismatch = true;
        continue;
      }

      // Health resolution with deadline race
      let health = this.registry.getHealth(id);
      if (!health) {
        providersContacted++;
        const remainingMs = Math.max(0, deadline - Date.now());
        if (remainingMs <= 0) {
          throw new BrainRoutingError(
            'routing_timeout',
            `Routing budget exceeded (${routingTimeoutMs}ms)`,
            attemptedProviderIds,
            attemptedModelIds
          );
        }
        try {
          health = await raceWithDeadlineAndSignal(
            this.registry.health(id),
            remainingMs,
            signal,
            () =>
              new BrainRoutingError(
                'routing_timeout',
                `Routing budget exceeded (${routingTimeoutMs}ms)`,
                attemptedProviderIds,
                attemptedModelIds
              ),
            () =>
              new BrainRoutingError(
                'cancelled',
                'Routing was cancelled by user',
                attemptedProviderIds,
                attemptedModelIds
              )
          );
        } catch (err) {
          if (err instanceof BrainRoutingError) {
            throw err;
          }
          if (maxProviderBudget !== undefined && providersContacted >= maxProviderBudget) {
            break;
          }
          continue;
        }
      } else {
        providersContacted++;
      }

      if (
        health.status === 'unhealthy' ||
        health.status === 'unconfigured' ||
        health.status === 'quota_limited' ||
        health.status === 'rate_limited' ||
        health.status === 'auth_error' ||
        health.status === 'unavailable'
      ) {
        if (maxProviderBudget !== undefined && providersContacted >= maxProviderBudget) {
          break;
        }
        continue;
      }

      const isDegraded = health.status === 'degraded';
      const isHealthy = health.status === 'healthy';

      // Stage B: Model Selection (if catalog capable)
      let selectedModel: ModelDescriptor | undefined;
      let selectedModelId: string | undefined;

      if (isCatalog) {
        const remainingMs = Math.max(0, deadline - Date.now());
        if (remainingMs <= 0) {
          throw new BrainRoutingError(
            'routing_timeout',
            `Routing budget exceeded (${routingTimeoutMs}ms)`,
            attemptedProviderIds,
            attemptedModelIds
          );
        }

        let catalogSnapshot: ModelCatalogSnapshot;
        try {
          catalogSnapshot = await raceWithDeadlineAndSignal(
            this.catalogRuntime.getCatalog(id),
            remainingMs,
            signal,
            () =>
              new BrainRoutingError(
                'routing_timeout',
                `Routing budget exceeded (${routingTimeoutMs}ms)`,
                attemptedProviderIds,
                attemptedModelIds
              ),
            () =>
              new BrainRoutingError(
                'cancelled',
                'Routing was cancelled by user',
                attemptedProviderIds,
                attemptedModelIds
              )
          );
          totalModelsEvaluated += catalogSnapshot.models.length;
        } catch (err) {
          if (err instanceof BrainRoutingError) {
            throw err;
          }
          if (
            err instanceof ModelCatalogError &&
            (err.code === 'provider_not_found' || err.message.includes('unregistered'))
          ) {
            throw new BrainRoutingError(
              'provider_unavailable',
              `Provider '${id}' was modified or unregistered during routing`,
              attemptedProviderIds,
              attemptedModelIds
            );
          }
          // Catalog fetch timed out, malformed, or failed
          continue;
        }

        const modelSelection = ModelPolicy.select({
          providerId: id,
          catalog: catalogSnapshot,
          profileId,
          profileResolution: resolution,
          overrides: request.overrides
            ? {
                ...request.overrides,
                preferredModelId: preferredModel
              }
            : preferredModel
              ? { preferredModelId: preferredModel, localOnly: effectiveLocalOnly }
              : undefined,
          effectiveLocalOnly,
          defaultModelId: this.registry.getProviderMetadata(id)?.defaultModelId,
          requiredCapabilities,
          maxCostClass: request.maxCostClass,
          maxLatencyClass: request.maxLatencyClass,
          requiredContextTokens: request.requiredContextTokens,
          requiredContextClass: request.requiredContextClass,
          strictLanguageCheck: request.strictLanguageCheck,
          allowFallback
        });

        if (!modelSelection.success || !modelSelection.selectedModel || !modelSelection.modelId) {
          if (effectiveLocalOnly && modelSelection.reason?.includes('local_only')) {
            hasLocalOnlyMismatch = true;
          }
          continue;
        }

        selectedModel = modelSelection.selectedModel;
        selectedModelId = modelSelection.modelId;
        if (selectedModelId) {
          attemptedModelIds.push(selectedModelId);
        }
      } else {
        // Not a catalog provider.
        // Direct model provider must have been rejected earlier (if providerKind === 'model_provider' && !isCatalog).
        // Only agent_runtime_provider reaches here.
        if (providerKind !== 'agent_runtime_provider') {
          continue;
        }
        if (preferredModel) {
          // Preferred model was specified, but this candidate provider does not support model catalogs
          continue;
        }
      }

      const isPrimary = (id === primaryCandidateId);
      const fallbackUsed = !isPrimary;

      let routeReason: RouteReason;
      if (isExplicitPreferred || (preferredModel && selectedModelId === preferredModel)) {
        routeReason = 'explicit_override';
      } else if (effectiveLocalOnly) {
        routeReason = 'privacy_constraint';
      } else if (isPrimary && isHealthy) {
        routeReason = defaultId && id === defaultId ? 'primary_default' : 'primary_healthy';
      } else if (isHealthy) {
        routeReason = 'fallback_healthy';
      } else {
        routeReason = 'fallback_degraded';
      }

      let reasonText: string;
      if (isPrimary) {
        reasonText = isExplicitPreferred
          ? `Selected preferred provider '${id}' (${health.status})`
          : (isDegraded
              ? `Selected degraded primary provider '${id}' (no healthy fallback available)`
              : `Selected default provider '${id}' (${health.status})`);
      } else if (isHealthy) {
        reasonText = firstDegradedCandidate
          ? `Selected healthy fallback provider '${id}' over degraded primary '${firstDegradedCandidate.providerId}'`
          : `Selected healthy fallback provider '${id}' (earlier candidates unavailable)`;
      } else {
        reasonText = `Selected degraded fallback provider '${id}' (no healthy provider available)`;
      }

      const candidateResult: EligibleCandidate = {
        provider,
        providerId: id,
        model: selectedModel,
        modelId: selectedModelId,
        health,
        isDegraded,
        reason: reasonText,
        routeReason,
        fallbackUsed,
        initialLifecycleToken
      };

      if (Date.now() >= deadline) {
        throw new BrainRoutingError(
          'routing_timeout',
          `Routing budget exceeded (${routingTimeoutMs}ms)`,
          attemptedProviderIds,
          attemptedModelIds
        );
      }

      if (isHealthy) {
        this.verifyLifecycle(id, provider, initialLifecycleToken, attemptedProviderIds, attemptedModelIds);
        return this.buildDecision(
          candidateResult,
          attemptedProviderIds,
          attemptedModelIds,
          profileId,
          startTime,
          attemptedProviderIds.length,
          totalModelsEvaluated
        );
      }

      if (isDegraded) {
        if (!firstDegradedCandidate) {
          firstDegradedCandidate = candidateResult;
        }
        if (!allowFallback) {
          break;
        }
      }

      if (maxProviderBudget !== undefined && providersContacted >= maxProviderBudget) {
        break;
      }
    }

    if (Date.now() >= deadline) {
      throw new BrainRoutingError(
        'routing_timeout',
        `Routing budget exceeded (${routingTimeoutMs}ms)`,
        attemptedProviderIds,
        attemptedModelIds
      );
    }

    if (firstDegradedCandidate) {
      this.verifyLifecycle(
        firstDegradedCandidate.providerId,
        firstDegradedCandidate.provider,
        firstDegradedCandidate.initialLifecycleToken,
        attemptedProviderIds,
        attemptedModelIds
      );
      return this.buildDecision(
        firstDegradedCandidate,
        attemptedProviderIds,
        attemptedModelIds,
        profileId,
        startTime,
        attemptedProviderIds.length,
        totalModelsEvaluated
      );
    }

    // No usable route found -> Deterministic error classification
    let errorCode: BrainRoutingErrorCode = 'no_usable_provider';
    let errorMessage = `No usable provider found among candidates: [${candidateIds.join(', ')}]`;

    if (effectiveLocalOnly || hasLocalOnlyMismatch) {
      errorCode = 'local_provider_unavailable';
      errorMessage = 'No local provider or model available satisfying localOnly constraint';
    } else if (profileId === 'fast_conversation') {
      errorCode = 'fast_brain_unavailable';
      errorMessage = 'Fast conversation brain is unavailable';
    } else if (profileId === 'deep_reasoning') {
      errorCode = 'profile_unavailable';
      errorMessage = 'Deep reasoning brain is unavailable';
    } else if (profileId === 'agent_work') {
      errorCode = 'profile_unavailable';
      errorMessage = 'Agent work runtime is unavailable';
    } else if (preferredModel) {
      errorCode = 'model_unavailable';
      errorMessage = `Requested model '${preferredModel}' is unavailable`;
    } else if (preferredProvider) {
      errorCode = 'provider_unavailable';
      errorMessage = `Requested provider '${preferredProvider}' is unavailable`;
    } else if (!anyCandidateRegistered) {
      errorCode = 'provider_not_found';
      errorMessage = `None of the candidate providers [${candidateIds.join(', ')}] are registered`;
    } else if (allRegisteredFailedCapabilities) {
      errorCode = 'capability_not_supported';
      errorMessage = 'None of the registered candidate providers meet the required capabilities';
    } else {
      errorCode = 'no_healthy_provider';
      errorMessage = `All candidate providers [${candidateIds.join(', ')}] are unhealthy, unconfigured, or failing`;
    }

    throw new BrainRoutingError(errorCode, errorMessage, attemptedProviderIds, attemptedModelIds);
  }
}
