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
import { TaskPolicy, type TaskIntent } from './task-policy.js';
import {
  DEFAULT_RUNTIME_PRIORITIES,
  type RuntimeSelectionMode,
  normalizeRuntimeProviderId
} from './runtime-policy.js';
import { RuntimeModelCatalog } from './runtime-models/catalog.js';
import { selectRuntimeModel } from './runtime-models/selector.js';
import {
  type ModelRole,
  type RuntimeModelSelectionMode,
  RuntimeModelSelectionError
} from './runtime-models/types.js';
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
import {
  RuntimeQuotaStore,
  type QuotaRoutingPreference
} from './quota/index.js';

export interface BrainRouterOptions {
  registry: BrainProviderRegistry;
  profilePolicy?: BrainProfilePolicy;
  taskPolicy?: TaskPolicy;
  catalogRuntime?: ModelCatalogRuntime;
  runtimeModelCatalog?: RuntimeModelCatalog;
  runtimePriorities?: Record<ModelRole, readonly string[]>;
  quotaStore?: RuntimeQuotaStore;
  quotaPreference?: QuotaRoutingPreference;
  defaultProvider?: string;
  fallbackChain?: string[];
  /** Accepted for configuration compatibility and routing timeout budget. Default: 4000ms. */
  timeoutMs?: number;
  /** Maximum distinct providers evaluated per turn. Default: 2. */
  maxProviderBudget?: number;
  /**
   * Whether paid/metered API providers are allowed to be routed.
   * Default: false (Subscription-first + local secondary; paid APIs disabled by default).
   * Invariant: Credential presence != permission to incur API billing.
   */
  allowPaidApis?: boolean;
}

function isRouterOptions(
  arg: BrainProviderRegistry | BrainRouterOptions
): arg is BrainRouterOptions {
  return typeof arg === 'object' && arg !== null && 'registry' in arg;
}

interface EligibleCandidate {
  provider: BrainProvider;
  providerId: string;
  providerKind: ProviderKind;
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
  private readonly taskPolicy: TaskPolicy;
  private readonly catalogRuntime: ModelCatalogRuntime;
  private readonly runtimeModelCatalog: RuntimeModelCatalog;
  private readonly runtimePriorities: Record<ModelRole, readonly string[]>;
  private readonly quotaStore: RuntimeQuotaStore;
  private readonly quotaPreference: QuotaRoutingPreference;
  private readonly defaultProvider?: string;
  private readonly fallbackChain: string[];
  private readonly timeoutMs: number;
  private readonly maxProviderBudget?: number;
  private readonly allowPaidApis: boolean;

  constructor(
    registryOrOptions: BrainProviderRegistry | BrainRouterOptions,
    defaultOptions?: {
      defaultProvider?: string;
      fallbackChain?: string[];
      timeoutMs?: number;
      profilePolicy?: BrainProfilePolicy;
      taskPolicy?: TaskPolicy;
      catalogRuntime?: ModelCatalogRuntime;
      runtimeModelCatalog?: RuntimeModelCatalog;
      runtimePriorities?: Record<ModelRole, readonly string[]>;
      quotaStore?: RuntimeQuotaStore;
      quotaPreference?: QuotaRoutingPreference;
      maxProviderBudget?: number;
      allowPaidApis?: boolean;
    }
  ) {
    if (isRouterOptions(registryOrOptions)) {
      this.registry = registryOrOptions.registry;
      this.profilePolicy = registryOrOptions.profilePolicy ?? new BrainProfilePolicy();
      this.taskPolicy = registryOrOptions.taskPolicy ?? new TaskPolicy();
      this.catalogRuntime =
        registryOrOptions.catalogRuntime ?? new ModelCatalogRuntime(this.registry);
      this.runtimeModelCatalog =
        registryOrOptions.runtimeModelCatalog ?? new RuntimeModelCatalog();
      this.runtimePriorities =
        registryOrOptions.runtimePriorities ?? DEFAULT_RUNTIME_PRIORITIES;
      this.quotaStore = registryOrOptions.quotaStore ?? new RuntimeQuotaStore();
      this.quotaPreference = registryOrOptions.quotaPreference ?? 'priority_first';
      this.defaultProvider = registryOrOptions.defaultProvider;
      this.fallbackChain = registryOrOptions.fallbackChain ?? [];
      this.timeoutMs = registryOrOptions.timeoutMs ?? 4000;
      this.maxProviderBudget = registryOrOptions.maxProviderBudget;
      this.allowPaidApis = registryOrOptions.allowPaidApis ?? false;
    } else {
      this.registry = registryOrOptions;
      this.profilePolicy = defaultOptions?.profilePolicy ?? new BrainProfilePolicy();
      this.taskPolicy = defaultOptions?.taskPolicy ?? new TaskPolicy();
      this.catalogRuntime =
        defaultOptions?.catalogRuntime ?? new ModelCatalogRuntime(this.registry);
      this.runtimeModelCatalog =
        defaultOptions?.runtimeModelCatalog ?? new RuntimeModelCatalog();
      this.runtimePriorities =
        defaultOptions?.runtimePriorities ?? DEFAULT_RUNTIME_PRIORITIES;
      this.quotaStore = defaultOptions?.quotaStore ?? new RuntimeQuotaStore();
      this.quotaPreference = defaultOptions?.quotaPreference ?? 'priority_first';
      this.defaultProvider = defaultOptions?.defaultProvider;
      this.fallbackChain = defaultOptions?.fallbackChain ?? [];
      this.timeoutMs = defaultOptions?.timeoutMs ?? 4000;
      this.maxProviderBudget = defaultOptions?.maxProviderBudget;
      this.allowPaidApis = defaultOptions?.allowPaidApis ?? false;
    }
  }

  getRegistry(): BrainProviderRegistry {
    return this.registry;
  }

  getProfilePolicy(): BrainProfilePolicy {
    return this.profilePolicy;
  }

  getTaskPolicy(): TaskPolicy {
    return this.taskPolicy;
  }

  getCatalogRuntime(): ModelCatalogRuntime {
    return this.catalogRuntime;
  }

  getRuntimeModelCatalog(): RuntimeModelCatalog {
    return this.runtimeModelCatalog;
  }

  getRuntimePriorities(): Record<ModelRole, readonly string[]> {
    return this.runtimePriorities;
  }

  getQuotaStore(): RuntimeQuotaStore {
    return this.quotaStore;
  }

  getQuotaPreference(): QuotaRoutingPreference {
    return this.quotaPreference;
  }

  isPaidApisAllowed(): boolean {
    return this.allowPaidApis;
  }

  getDefaultProvider(): string | undefined {
    return this.defaultProvider;
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
    const normalized = normalizeRuntimeProviderId(providerId);
    if (normalized === 'antigravity' || normalized === 'claude-code' || normalized === 'codex') {
      return 'agent_runtime_provider';
    }
    return 'model_provider';
  }

  private buildDecision(
    candidate: EligibleCandidate,
    attemptedProviderIds: string[],
    attemptedModelIds: string[],
    profileId: BrainProfileId | undefined,
    startTime: number,
    providersEvaluated: number,
    modelsEvaluated: number,
    paidApisBlockedCount = 0,
    s3Context?: {
      taskIntent?: TaskIntent;
      modelRole?: ModelRole;
      runtimeSelectionMode?: RuntimeSelectionMode;
      modelSelectionMode?: RuntimeModelSelectionMode;
      runtimeModelsEvaluated?: number;
      selectionReason?: string;
      evaluatedProviderIds?: string[];
      skippedRuntimes?: Array<{ runtimeId: string; reason: string }>;
      providerQuotaState?: Record<string, string>;
      quotaSkippedProviders?: Array<{ providerId: string; status: string; reason?: string; resetAt?: number }>;
      quotaPreference?: string;
      quotaSelectionReason?: string;
    }
  ): BrainRouteDecision {
    const telemetry: RouteTelemetry = {
      selectedProviderId: candidate.providerId,
      selectedModelId: candidate.modelId,
      profileId,
      routeReason: candidate.routeReason,
      fallbackUsed: candidate.fallbackUsed,
      attemptedProviderIds: [],
      attemptedModelIds: [],
      routeAttempts: 0
    };

    const diagnostics: BrainRoutingDiagnostics = {
      routingTimeMs: Math.max(0, Date.now() - startTime),
      providersEvaluated,
      modelsEvaluated,
      ...(paidApisBlockedCount > 0 ? { paidApisBlockedCount } : {}),
      ...(s3Context?.taskIntent ? { taskIntent: s3Context.taskIntent } : {}),
      ...(s3Context?.modelRole ? { modelRole: s3Context.modelRole } : {}),
      ...(s3Context?.runtimeSelectionMode ? { runtimeSelectionMode: s3Context.runtimeSelectionMode } : {}),
      ...(s3Context?.modelSelectionMode ? { modelSelectionMode: s3Context.modelSelectionMode } : {}),
      ...(s3Context?.runtimeModelsEvaluated !== undefined ? { runtimeModelsEvaluated: s3Context.runtimeModelsEvaluated } : {}),
      ...(s3Context?.selectionReason ? { selectionReason: s3Context.selectionReason } : {}),
      ...(s3Context?.evaluatedProviderIds ? { evaluatedProviderIds: s3Context.evaluatedProviderIds } : {}),
      ...(s3Context?.skippedRuntimes && s3Context.skippedRuntimes.length > 0 ? { skippedRuntimes: s3Context.skippedRuntimes } : {}),
      ...(s3Context?.providerQuotaState ? { providerQuotaState: s3Context.providerQuotaState } : {}),
      ...(s3Context?.quotaSkippedProviders && s3Context.quotaSkippedProviders.length > 0
        ? { quotaSkippedProviders: s3Context.quotaSkippedProviders }
        : {}),
      ...(s3Context?.quotaPreference ? { quotaPreference: s3Context.quotaPreference } : {}),
      ...(s3Context?.quotaSelectionReason ? { quotaSelectionReason: s3Context.quotaSelectionReason } : {})
    };

    return {
      provider: candidate.provider,
      providerId: candidate.providerId,
      providerKind: this.getProviderKind(candidate.providerId),
      model: candidate.model,
      modelId: candidate.modelId,
      profileId,
      taskIntent: s3Context?.taskIntent,
      modelRole: s3Context?.modelRole,
      runtimeSelectionMode: s3Context?.runtimeSelectionMode,
      modelSelectionMode: s3Context?.modelSelectionMode,
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

    // 2. Resolve Task Policy & Intent (F1.5-S3)
    const taskDecision = this.taskPolicy.resolve({
      taskIntent: request.taskIntent,
      profileId: request.overrides?.profileId || request.profileId,
      modelRole: request.modelRole,
      taskContext: request.taskContext
    });
    const taskIntent = taskDecision.taskIntent;
    const modelRole = taskDecision.modelRole;
    const isExplicitProfile = Boolean(request.overrides?.profileId || request.profileId || request.taskIntent);
    const requestedProfileId = isExplicitProfile
      ? taskDecision.profileId
      : (request.overrides?.profileId || request.profileId);

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

    // 3. Extract Overrides & Selection Modes (F1.5-S3)
    const lockedRuntime = request.lockedRuntimeId?.trim() || undefined;
    const lockedModel = request.lockedModelId?.trim() || undefined;

    const rawPreferredProvider =
      lockedRuntime ||
      request.overrides?.preferredProviderId?.trim() ||
      request.preferredProviderId?.trim() ||
      request.preferredRuntimeId?.trim() ||
      resolution?.preferredProviderId?.trim() ||
      undefined;

    const rawPreferredModel =
      lockedModel ||
      request.overrides?.preferredModelId?.trim() ||
      request.preferredModelId?.trim() ||
      resolution?.preferredModelId?.trim() ||
      undefined;

    const runtimeMode: RuntimeSelectionMode =
      request.runtimeMode ?? (lockedRuntime ? 'LOCKED' : (rawPreferredProvider ? 'PREFERRED' : 'AUTO'));

    const modelMode: RuntimeModelSelectionMode =
      request.modelMode ?? (lockedModel ? 'LOCKED' : (rawPreferredModel ? 'PREFERRED' : 'AUTO'));

    const preferredProvider = rawPreferredProvider;
    const preferredModel = rawPreferredModel;

    const defaultId = request.defaultProviderId?.trim() || this.defaultProvider?.trim();

    // 4. Normalize allowFallback semantics
    const hasExplicitOverride = Boolean(preferredProvider || preferredModel);
    const allowFallback =
      request.allowFallback !== undefined
        ? request.allowFallback
        : (runtimeMode === 'LOCKED' || modelMode === 'LOCKED')
          ? false
          : hasExplicitOverride
            ? false
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
    if (profileId === 'agent_work') {
      if (runtimeMode === 'LOCKED') {
        if (!preferredProvider) {
          throw new BrainRoutingError(
            'provider_not_found',
            'LOCKED runtime selection mode requires a specified runtime ID',
            []
          );
        }
        rawCandidateIds.push(preferredProvider);
      } else if (runtimeMode === 'PREFERRED') {
        if (preferredProvider) {
          rawCandidateIds.push(preferredProvider);
        }
        if (allowFallback) {
          const rolePriorities = this.runtimePriorities[modelRole] ?? DEFAULT_RUNTIME_PRIORITIES[modelRole];
          for (const p of rolePriorities) {
            rawCandidateIds.push(p);
          }
          const registeredAgentIds = this.registry
            .list()
            .filter((p) => this.getProviderKind(p.id) === 'agent_runtime_provider')
            .map((p) => p.id)
            .sort((a, b) => a.localeCompare(b));
          for (const regId of registeredAgentIds) {
            rawCandidateIds.push(regId);
          }
        }
      } else {
        // AUTO runtime selection
        const rolePriorities = this.runtimePriorities[modelRole] ?? DEFAULT_RUNTIME_PRIORITIES[modelRole];
        for (const p of rolePriorities) {
          rawCandidateIds.push(p);
        }
        const registeredAgentIds = this.registry
          .list()
          .filter((p) => this.getProviderKind(p.id) === 'agent_runtime_provider')
          .map((p) => p.id)
          .sort((a, b) => a.localeCompare(b));
        for (const regId of registeredAgentIds) {
          rawCandidateIds.push(regId);
        }
      }
    } else {
      // Direct model provider profiles
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
        const registeredIds = this.registry
          .list()
          .map((p) => p.id)
          .sort((a, b) => a.localeCompare(b));
        for (const regId of registeredIds) {
          rawCandidateIds.push(regId);
        }
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

    // Pre-evaluate quota states
    const providerQuotaState: Record<string, string> = {};
    const quotaSkippedProviders: Array<{ providerId: string; status: string; reason?: string; resetAt?: number }> = [];

    for (const c of candidateIds) {
      const qState = this.quotaStore.get(c);
      providerQuotaState[c] = qState.status;
    }

    // 6a. LOCKED runtime quota enforcement: fail immediately without fallback
    if (runtimeMode === 'LOCKED' && preferredProvider) {
      if (this.quotaStore.isBlocked(preferredProvider)) {
        const qState = this.quotaStore.get(preferredProvider);
        throw new BrainRoutingError(
          qState.status === 'rate_limited' ? 'rate_limited' : 'quota_limited',
          `Locked runtime '${preferredProvider}' is quota limited: ${qState.reason || 'subscription quota exhausted'}`,
          [],
          []
        );
      }
    }

    // 6b. PREFERRED runtime quota enforcement without fallback
    if (runtimeMode === 'PREFERRED' && preferredProvider && !allowFallback) {
      if (this.quotaStore.isBlocked(preferredProvider)) {
        const qState = this.quotaStore.get(preferredProvider);
        throw new BrainRoutingError(
          qState.status === 'rate_limited' ? 'rate_limited' : 'quota_limited',
          `Preferred runtime '${preferredProvider}' is quota limited and fallback is disabled: ${qState.reason || 'subscription quota exhausted'}`,
          [],
          []
        );
      }
    }

    // 6c. Order candidates respecting quota availability
    let orderedCandidateIds = [...candidateIds];
    if (profileId === 'agent_work' && (runtimeMode === 'AUTO' || (runtimeMode === 'PREFERRED' && allowFallback))) {
      if (this.quotaPreference === 'available_first') {
        const available: string[] = [];
        const rest: string[] = [];
        for (const id of orderedCandidateIds) {
          if (!this.quotaStore.isBlocked(id) && this.quotaStore.get(id).status === 'available') {
            available.push(id);
          } else {
            rest.push(id);
          }
        }
        orderedCandidateIds = [...available, ...rest];
      }
    }

    const primaryCandidateId = orderedCandidateIds[0]!;
    const isExplicitPreferred = Boolean(preferredProvider && preferredProvider === primaryCandidateId);
    const attemptedProviderIds: string[] = [];
    const attemptedModelIds: string[] = [];
    const evaluatedCandidateIds: string[] = [];
    const skippedRuntimes: Array<{ runtimeId: string; reason: string }> = [];
    let providersContacted = 0;
    let totalModelsEvaluated = 0;
    const maxProviderBudget = request.maxProviderBudget ?? this.maxProviderBudget;
    const effectiveAllowPaidApis = request.allowPaidApis ?? this.allowPaidApis;
    let paidApisBlockedCount = 0;
    let hasPaidApiBlocked = false;

    let anyCandidateRegistered = false;
    let allRegisteredFailedCapabilities = true;
    let hasLocalOnlyMismatch = false;

    let firstDegradedCandidate: EligibleCandidate | null = null;

    const deadline = startTime + routingTimeoutMs;

    // 7. Iterate through candidate providers
    for (const id of orderedCandidateIds) {
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

      // Quota check: Skip known quota-blocked subscription runtime before execution
      if (this.quotaStore.isBlocked(id)) {
        const qState = this.quotaStore.get(id);
        quotaSkippedProviders.push({
          providerId: id,
          status: qState.status,
          reason: qState.reason,
          resetAt: qState.resetAt
        });
        skippedRuntimes.push({
          runtimeId: id,
          reason: qState.status
        });
        continue;
      }

      evaluatedCandidateIds.push(id);
      attemptedProviderIds.push(id);

      const provider = this.registry.get(id);
      if (!provider) {
        skippedRuntimes.push({ runtimeId: id, reason: 'runtime_not_executable' });
        if (runtimeMode === 'LOCKED' && (id === preferredProvider || id === lockedRuntime)) {
          throw new BrainRoutingError(
            'provider_not_found',
            `Locked runtime '${id}' is not registered in BrainProviderRegistry`,
            attemptedProviderIds,
            attemptedModelIds
          );
        }
        if (request.allowFallback === false && (id === preferredProvider || id === request.preferredRuntimeId)) {
          throw new BrainRoutingError(
            'provider_not_found',
            `Preferred runtime '${id}' is not registered and fallback is disabled`,
            attemptedProviderIds,
            attemptedModelIds
          );
        }
        continue;
      }

      anyCandidateRegistered = true;
      const initialLifecycleToken =
        typeof this.registry.getLifecycleToken === 'function'
          ? this.registry.getLifecycleToken(id)
          : undefined;

      const capabilities = provider.getCapabilities();
      if (!this.matchesRequiredCapabilities(capabilities, requiredCapabilities)) {
        if (runtimeMode === 'LOCKED' && (id === preferredProvider || id === lockedRuntime)) {
          throw new BrainRoutingError(
            'capability_not_supported',
            `Locked runtime '${id}' does not meet required capabilities`,
            attemptedProviderIds,
            attemptedModelIds
          );
        }
        continue;
      }

      allRegisteredFailedCapabilities = false;

      let providerMetadata;
      try {
        providerMetadata = this.registry.getProviderMetadata(id);
      } catch {
        // metadata unresolvable or missing
      }

      const providerKind = providerMetadata?.kind ?? this.getProviderKind(id);
      const accessClass =
        providerMetadata?.accessClass ??
        (id === 'antigravity' || id === 'codex' || id === 'claude_code' || id === 'claude-code'
          ? 'subscription'
          : capabilities.local
            ? 'local'
            : 'paid_api');

      // Guard 0: Billing / Access Policy
      // Hard Invariant: MAVE default intelligence strategy is Subscription-First + Local-Secondary.
      // Metered/Paid APIs are disabled by default.
      // Credential presence != permission to incur API billing.
      if (accessClass === 'paid_api' && !effectiveAllowPaidApis) {
        if (runtimeMode === 'LOCKED' && (id === preferredProvider || id === lockedRuntime)) {
          throw new BrainRoutingError(
            'provider_unavailable',
            `Locked provider '${id}' requires paid API billing which is disabled by default policy (allowPaidApis = false). Credential presence does not grant billing permission.`,
            attemptedProviderIds,
            attemptedModelIds
          );
        }
        paidApisBlockedCount++;
        hasPaidApiBlocked = true;
        continue;
      }

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
        if (runtimeMode === 'LOCKED' && (id === preferredProvider || id === lockedRuntime)) {
          throw new BrainRoutingError(
            'provider_unavailable',
            `Locked runtime '${id}' is currently '${health.status}'`,
            attemptedProviderIds,
            attemptedModelIds
          );
        }
        if (maxProviderBudget !== undefined && providersContacted >= maxProviderBudget) {
          break;
        }
        continue;
      }

      const isDegraded = health.status === 'degraded';
      const isHealthy = health.status === 'healthy';

      // Stage B: Model Selection
      let selectedModel: ModelDescriptor | undefined;
      let selectedModelId: string | undefined;
      let selectionReason: string | undefined;

      if (isCatalog && providerKind === 'model_provider') {
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
      } else if (providerKind === 'agent_runtime_provider') {
        const runtimeModels = this.runtimeModelCatalog.getRuntimeModels(id);
        totalModelsEvaluated += runtimeModels.length;

        if (runtimeModels.length === 0) {
          // If no models registered for this runtime
          if (preferredModel || lockedModel) {
            if (modelMode === 'LOCKED' || runtimeMode === 'LOCKED' || !allowFallback) {
              throw new BrainRoutingError(
                'model_unavailable',
                `No models discovered or registered for runtime '${id}'`,
                attemptedProviderIds,
                attemptedModelIds
              );
            }
            continue;
          }
          // Backwards compatibility for stub agent runtimes without runtime models
          selectedModelId = undefined;
        } else {
          try {
            const runtimeSelection = selectRuntimeModel(runtimeModels, {
              runtimeProviderId: id,
              role: modelRole,
              mode: modelMode,
              preferredModelId: preferredModel,
              lockedModelId: lockedModel,
              allowFallback
            });
            selectedModel = undefined;
            selectedModelId = runtimeSelection.selectedModelId;
            selectionReason = runtimeSelection.reason;
            if (selectedModelId) {
              attemptedModelIds.push(selectedModelId);
            }
          } catch (err) {
            if (err instanceof RuntimeModelSelectionError) {
              if (modelMode === 'LOCKED' || runtimeMode === 'LOCKED' || !allowFallback) {
                const code: BrainRoutingErrorCode =
                  err.code.includes('locked') || err.code.includes('unavailable') || err.code.includes('not_found')
                    ? 'model_unavailable'
                    : 'capability_not_supported';
                throw new BrainRoutingError(code, err.message, attemptedProviderIds, attemptedModelIds);
              }
            }
            continue;
          }
        }
      } else {
        // Not a catalog provider and not an agent runtime provider
        continue;
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
      if (selectionReason) {
        reasonText = selectionReason;
      } else if (isPrimary) {
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
        providerKind,
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
          profileId ?? (candidateResult.providerKind === 'model_provider' ? taskDecision.profileId : undefined),
          startTime,
          attemptedProviderIds.length,
          totalModelsEvaluated,
          paidApisBlockedCount,
          {
            taskIntent,
            modelRole,
            runtimeSelectionMode: runtimeMode,
            modelSelectionMode: modelMode,
            runtimeModelsEvaluated: totalModelsEvaluated,
            selectionReason: candidateResult.reason,
            evaluatedProviderIds: evaluatedCandidateIds,
            skippedRuntimes,
            providerQuotaState,
            quotaSkippedProviders,
            quotaPreference: this.quotaPreference,
            quotaSelectionReason:
              quotaSkippedProviders.length > 0
                ? `Selected runtime '${id}' after skipping quota-limited candidates: [${quotaSkippedProviders.map((p) => p.providerId).join(', ')}]`
                : undefined
          }
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
        profileId ?? (firstDegradedCandidate.providerKind === 'model_provider' ? taskDecision.profileId : undefined),
        startTime,
        attemptedProviderIds.length,
        totalModelsEvaluated,
        paidApisBlockedCount,
        {
          taskIntent,
          modelRole,
          runtimeSelectionMode: runtimeMode,
          modelSelectionMode: modelMode,
          runtimeModelsEvaluated: totalModelsEvaluated,
          selectionReason: firstDegradedCandidate.reason,
          evaluatedProviderIds: evaluatedCandidateIds,
          skippedRuntimes,
          providerQuotaState,
          quotaSkippedProviders,
          quotaPreference: this.quotaPreference,
          quotaSelectionReason:
            quotaSkippedProviders.length > 0
              ? `Selected degraded runtime '${firstDegradedCandidate.providerId}' after skipping quota-limited candidates: [${quotaSkippedProviders.map((p) => p.providerId).join(', ')}]`
              : undefined
        }
      );
    }

    // No usable route found -> Deterministic error classification
    let errorCode: BrainRoutingErrorCode = 'no_usable_provider';
    let errorMessage = `No usable provider found among candidates: [${candidateIds.join(', ')}]`;

    if (effectiveLocalOnly || hasLocalOnlyMismatch) {
      errorCode = 'local_provider_unavailable';
      errorMessage = 'No local provider or model available satisfying localOnly constraint';
    } else if (candidateIds.length > 0 && candidateIds.every((c) => this.quotaStore.isBlocked(c))) {
      const allQuotaLimited = candidateIds.every((c) => this.quotaStore.get(c).status === 'quota_limited');
      const allRateLimited = candidateIds.every((c) => this.quotaStore.get(c).status === 'rate_limited');
      if (allQuotaLimited) {
        errorCode = 'quota_limited';
        errorMessage = `All candidate subscription runtimes [${candidateIds.join(', ')}] are currently quota limited`;
      } else if (allRateLimited) {
        errorCode = 'rate_limited';
        errorMessage = `All candidate subscription runtimes [${candidateIds.join(', ')}] are currently rate limited`;
      } else {
        errorCode = 'quota_limited';
        errorMessage = `All candidate subscription runtimes [${candidateIds.join(', ')}] are currently quota or rate limited`;
      }
    } else if (
      hasPaidApiBlocked &&
      candidateIds.every((c) => {
        try {
          return this.registry.getProviderMetadata(c).accessClass === 'paid_api';
        } catch {
          return false;
        }
      })
    ) {
      errorCode = 'provider_unavailable';
      errorMessage = `Candidate provider(s) [${candidateIds.join(', ')}] require paid API billing which is disabled by default policy (allowPaidApis = false). Credential presence does not grant billing permission.`;
    } else if (runtimeMode === 'LOCKED' && preferredProvider) {
      errorCode = 'provider_unavailable';
      errorMessage = `Locked runtime '${preferredProvider}' is unavailable or incompatible`;
    } else if (modelMode === 'LOCKED' && preferredModel) {
      errorCode = 'model_unavailable';
      errorMessage = `Locked model '${preferredModel}' is unavailable or not found`;
    } else if (isExplicitProfile && profileId === 'fast_conversation') {
      errorCode = 'fast_brain_unavailable';
      errorMessage = 'Fast conversation brain is unavailable';
    } else if (isExplicitProfile && profileId === 'deep_reasoning') {
      errorCode = 'profile_unavailable';
      errorMessage = 'Deep reasoning brain is unavailable';
    } else if (isExplicitProfile && profileId === 'agent_work') {
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
