import type {
  BrainCapabilities,
  BrainProvider,
  ProviderAccessPath,
  ProviderDescriptor,
  ProviderHealth,
  ProviderKind
} from '@mave/contracts';
import {
  isModelCatalogProvider,
  normalizeProviderHealthStatus,
  ProviderDescriptorSchema,
  ProviderHealthSchema
} from '@mave/contracts';
import { BrainRegistryError, type ProviderAccessClass, type ProviderBillingClass } from './types.js';

export interface BrainProviderRegistryOptions {
  /**
   * Maximum duration in milliseconds allowed for a provider health probe before timing out.
   * Default: 5000ms.
   */
  healthTimeoutMs?: number;
  /**
   * In-memory cache TTL in milliseconds for health probe results.
   * Default: 15000ms.
   */
  defaultHealthTtlMs?: number;
}

/**
 * Registration metadata hints for a provider.
 * Identity (id), dynamic health, and capabilities are authoritative runtime properties
 * and cannot be overridden by metadata.
 */
export interface ProviderRegistrationMetadata {
  readonly id?: string;
  readonly kind?: ProviderKind;
  readonly displayName?: string;
  readonly accessPath?: ProviderAccessPath;
  readonly accessClass?: ProviderAccessClass;
  readonly billingClass?: ProviderBillingClass;
  readonly defaultModelId?: string;
  readonly documentationUrl?: string;
}

/**
 * Static provider metadata decoupled from dynamic operational health.
 */
export interface ProviderMetadata {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly displayName: string;
  readonly accessPath: ProviderAccessPath;
  readonly accessClass: ProviderAccessClass;
  readonly capabilities: BrainCapabilities;
  readonly defaultModelId?: string;
  readonly documentationUrl?: string;
}

export interface ProviderRegistrySnapshot {
  readonly providers: readonly ProviderDescriptor[];
  readonly health: Record<string, ProviderHealth>;
  readonly generatedAt: number;
}

interface ProviderEntry {
  readonly id: string;
  provider: BrainProvider;
  metadata?: ProviderRegistrationMetadata;
  revision: number;
  registeredAt: number;
  registrationSequence: number;
}

interface CachedHealth {
  health: ProviderHealth;
  cachedAt: number;
  revision: number;
}

/**
 * Hardened registry for managing MAVE intelligence brain providers.
 *
 * Responsibilities:
 * - Deterministic provider registration, replacement, and unregistration with canonical ID enforcement
 * - Single source of truth for runtime identity (BrainProvider.id) and health (Registry)
 * - Safe provider lookup by normalized ProviderId
 * - Capability discovery and ProviderDescriptor synthesis with dynamic health hydration
 * - Non-quota health probing with single-flight concurrency
 * - Sanitized health error and timeout normalization
 * - In-memory TTL health caching with stale-result rejection
 * - Immutable, serializable registry snapshots free of sensitive internals
 */
export class BrainProviderRegistry {
  private readonly entries = new Map<string, ProviderEntry>();
  private readonly healthCache = new Map<string, CachedHealth>();
  private readonly inFlightProbes = new Map<string, Promise<ProviderHealth>>();
  private readonly healthTimeoutMs: number;
  private readonly defaultHealthTtlMs: number;
  private registrationSequence = 0;

  constructor(options?: BrainProviderRegistryOptions) {
    this.healthTimeoutMs = options?.healthTimeoutMs ?? 5000;
    this.defaultHealthTtlMs = options?.defaultHealthTtlMs ?? 15000;
  }

  /**
   * Validates that provider.id is already canonical without leading/trailing whitespace.
   * Does NOT silently mutate or trim registered provider identity.
   */
  private validateCanonicalProvider(provider: BrainProvider): string {
    if (!provider || typeof provider.id !== 'string') {
      throw new BrainRegistryError('invalid_provider_id', 'Provider must have a valid string id');
    }
    const id = provider.id;
    if (id.length === 0 || id !== id.trim()) {
      throw new BrainRegistryError(
        'invalid_provider_id',
        `Provider id must be canonical without leading or trailing whitespace: '${id}'`
      );
    }
    return id;
  }

  /**
   * Normalizes lookup arguments from callers (trims leading/trailing whitespace).
   */
  private normalizeLookupId(id: string): string {
    if (!id || typeof id !== 'string') {
      throw new BrainRegistryError('invalid_provider_id', 'Provider id must be a non-empty string');
    }
    const trimmed = id.trim();
    if (!trimmed) {
      throw new BrainRegistryError('invalid_provider_id', 'Provider id cannot be empty');
    }
    return trimmed;
  }

  /**
   * Registers a brain provider instance.
   * Enforces canonical ID validation and rejects duplicate registrations.
   */
  register(provider: BrainProvider, metadata?: ProviderRegistrationMetadata): void {
    const canonicalId = this.validateCanonicalProvider(provider);

    if (metadata?.id !== undefined && metadata.id !== canonicalId) {
      throw new BrainRegistryError(
        'invalid_provider_id',
        `Registration metadata id '${metadata.id}' does not match provider id '${canonicalId}'`
      );
    }

    if (this.entries.has(canonicalId)) {
      throw new BrainRegistryError(
        'duplicate_provider',
        `Provider with id '${canonicalId}' is already registered`
      );
    }

    this.entries.set(canonicalId, {
      id: canonicalId,
      provider,
      metadata,
      revision: 1,
      registeredAt: Date.now(),
      registrationSequence: ++this.registrationSequence
    });
  }

  /**
   * Explicitly replaces an existing registered provider.
   * Enforces canonical ID validation, bumps the revision token, and invalidates stale health cache.
   */
  replace(provider: BrainProvider, metadata?: ProviderRegistrationMetadata): void {
    const canonicalId = this.validateCanonicalProvider(provider);

    if (metadata?.id !== undefined && metadata.id !== canonicalId) {
      throw new BrainRegistryError(
        'invalid_provider_id',
        `Registration metadata id '${metadata.id}' does not match provider id '${canonicalId}'`
      );
    }

    const existing = this.entries.get(canonicalId);
    if (!existing) {
      throw new BrainRegistryError(
        'provider_not_found',
        `Cannot replace unregistered provider '${canonicalId}'`
      );
    }

    existing.revision += 1;
    existing.provider = provider;
    if (metadata !== undefined) {
      existing.metadata = metadata;
    }

    // Invalidate cached health for replaced provider
    this.healthCache.delete(canonicalId);
  }

  /**
   * Unregisters a provider by id.
   * Cleans health state and invalidates any in-flight health probes.
   * Returns true if found and removed, false otherwise.
   */
  unregister(providerId: string): boolean {
    if (!providerId || typeof providerId !== 'string') {
      return false;
    }
    const trimmedId = providerId.trim();
    if (!this.entries.has(trimmedId)) {
      return false;
    }

    this.entries.delete(trimmedId);
    this.healthCache.delete(trimmedId);
    return true;
  }

  /**
   * Returns a provider by id, or undefined if not registered.
   */
  get(providerId: string): BrainProvider | undefined {
    if (!providerId || typeof providerId !== 'string') {
      return undefined;
    }
    return this.entries.get(providerId.trim())?.provider;
  }

  /**
   * Checks whether a provider with the given id is registered.
   */
  has(providerId: string): boolean {
    if (!providerId || typeof providerId !== 'string') {
      return false;
    }
    return this.entries.has(providerId.trim());
  }

  /**
   * Returns a deterministic lifecycle token for the provider's current registration.
   * Changes whenever the provider is replaced or re-registered.
   */
  getLifecycleToken(providerId: string): string | undefined {
    if (!providerId || typeof providerId !== 'string') {
      return undefined;
    }
    const entry = this.entries.get(providerId.trim());
    if (!entry) {
      return undefined;
    }
    return `${entry.id}:${entry.registrationSequence}:${entry.revision}`;
  }

  /**
   * Retrieves a provider by id, throwing BrainRegistryError if not registered.
   */
  require(providerId: string): BrainProvider {
    const provider = this.get(providerId);
    if (!provider) {
      throw new BrainRegistryError(
        'provider_not_found',
        `Provider '${providerId}' is not registered`
      );
    }
    return provider;
  }

  /**
   * Returns all registered providers in deterministic insertion order.
   */
  list(): BrainProvider[] {
    return Array.from(this.entries.values()).map((e) => e.provider);
  }

  /**
   * Retrieves provider capabilities without re-computing expensive metadata.
   */
  getCapabilities(providerId: string): BrainCapabilities {
    const provider = this.require(providerId);
    return provider.getCapabilities();
  }

  /**
   * Returns static provider metadata without requiring an operational health probe.
   */
  getProviderMetadata(providerId: string): ProviderMetadata {
    const trimmedId = this.normalizeLookupId(providerId);
    const entry = this.entries.get(trimmedId);
    if (!entry) {
      throw new BrainRegistryError(
        'provider_not_found',
        `Provider '${providerId}' is not registered`
      );
    }

    const kind: ProviderKind =
      entry.metadata?.kind ??
      (trimmedId === 'antigravity' ? 'agent_runtime_provider' : 'model_provider');
    const accessPath: ProviderAccessPath =
      entry.metadata?.accessPath ??
      (trimmedId === 'antigravity' ? 'official_cli' : 'local_runtime');
    const isPaidCloudApi =
      trimmedId === 'openai' ||
      trimmedId === 'anthropic' ||
      trimmedId === 'gemini' ||
      trimmedId === 'groq' ||
      accessPath === 'official_api';

    const isSubscriptionRuntime =
      trimmedId === 'antigravity' ||
      trimmedId === 'codex' ||
      trimmedId === 'claude_code' ||
      accessPath === 'official_cli';

    const accessClass: ProviderAccessClass =
      entry.metadata?.accessClass ??
      entry.metadata?.billingClass ??
      (isSubscriptionRuntime
        ? 'subscription'
        : isPaidCloudApi
          ? 'paid_api'
          : 'local');
    const displayName: string =
      entry.metadata?.displayName ??
      (trimmedId === 'antigravity'
        ? 'Google Antigravity'
        : trimmedId === 'mock'
          ? 'Mock Brain Provider'
          : trimmedId === 'openai'
            ? 'OpenAI API Provider'
            : trimmedId);

    return Object.freeze({
      id: entry.id,
      kind,
      displayName,
      accessPath,
      accessClass,
      capabilities: Object.freeze({ ...entry.provider.getCapabilities() }),
      defaultModelId: entry.metadata?.defaultModelId,
      documentationUrl: entry.metadata?.documentationUrl
    });
  }

  /**
   * Discovers or synthesizes the ProviderDescriptor for a registered provider.
   * If the provider has not been probed yet, returns undefined (unknown = absence of health state).
   * Does NOT fabricate unconfigured or unavailable status for unprobed providers.
   */
  getDescriptor(providerId: string): ProviderDescriptor | undefined {
    const trimmedId = this.normalizeLookupId(providerId);
    const entry = this.entries.get(trimmedId);
    if (!entry) {
      throw new BrainRegistryError(
        'provider_not_found',
        `Provider '${providerId}' is not registered`
      );
    }

    const cached = this.healthCache.get(trimmedId);
    if (!cached) {
      // Unprobed: health is unknown (absence of health state).
      return undefined;
    }

    const currentHealth: ProviderHealth = { ...cached.health };
    let descriptor: ProviderDescriptor;

    if (isModelCatalogProvider(entry.provider)) {
      const raw = entry.provider.getDescriptor();
      if (raw.id !== entry.id) {
        throw new BrainRegistryError(
          'invalid_provider_id',
          `ModelCatalogProvider '${entry.id}' returned descriptor with mismatched id '${raw.id}'`
        );
      }
      descriptor = {
        ...raw,
        id: entry.id,
        capabilities: entry.provider.getCapabilities(),
        health: currentHealth,
        kind: entry.metadata?.kind ?? raw.kind,
        displayName: entry.metadata?.displayName ?? raw.displayName,
        accessPath: entry.metadata?.accessPath ?? raw.accessPath,
        defaultModelId: entry.metadata?.defaultModelId ?? raw.defaultModelId,
        documentationUrl: entry.metadata?.documentationUrl ?? raw.documentationUrl
      };
    } else {
      const meta = this.getProviderMetadata(trimmedId);
      descriptor = {
        id: entry.id,
        kind: meta.kind,
        displayName: meta.displayName,
        accessPath: meta.accessPath,
        capabilities: entry.provider.getCapabilities(),
        health: currentHealth,
        defaultModelId: meta.defaultModelId,
        documentationUrl: meta.documentationUrl
      };
    }

    return ProviderDescriptorSchema.parse(descriptor);
  }

  /**
   * Retrieves ProviderDescriptor, throwing BrainRegistryError if provider is missing or unprobed.
   */
  requireDescriptor(providerId: string): ProviderDescriptor {
    const trimmedId = this.normalizeLookupId(providerId);
    if (!this.entries.has(trimmedId)) {
      throw new BrainRegistryError(
        'provider_not_found',
        `Provider '${providerId}' is not registered`
      );
    }

    const desc = this.getDescriptor(trimmedId);
    if (!desc) {
      throw new BrainRegistryError(
        'provider_unprobed',
        `Provider '${providerId}' has not been health-probed yet; health is unknown`
      );
    }
    return desc;
  }

  /**
   * Ensures the provider has been probed, then returns the fully hydrated ProviderDescriptor.
   */
  async resolveDescriptor(providerId: string): Promise<ProviderDescriptor> {
    const trimmedId = this.normalizeLookupId(providerId);
    await this.health(trimmedId);
    return this.requireDescriptor(trimmedId);
  }

  /**
   * Returns cached health for a registered provider, or undefined if not probed yet.
   */
  getHealth(providerId: string): ProviderHealth | undefined {
    if (!providerId || typeof providerId !== 'string') return undefined;
    const trimmedId = providerId.trim();
    const cached = this.healthCache.get(trimmedId);
    return cached ? { ...cached.health } : undefined;
  }

  /**
   * Returns a copy of all currently cached health records for registered providers.
   */
  getHealthSnapshot(): Record<string, ProviderHealth> {
    const snapshot: Record<string, ProviderHealth> = {};
    for (const [id, entry] of this.healthCache.entries()) {
      if (this.entries.has(id)) {
        snapshot[id] = { ...entry.health };
      }
    }
    return snapshot;
  }

  /**
   * Primary entry point for checking provider health.
   * Returns cached health if fresh and forceRefresh is false; otherwise triggers refreshHealth.
   */
  async health(
    providerId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ProviderHealth> {
    const trimmedId = this.normalizeLookupId(providerId);
    this.require(trimmedId);

    if (!options?.forceRefresh && this.defaultHealthTtlMs > 0) {
      const cached = this.healthCache.get(trimmedId);
      if (cached) {
        const age = Date.now() - cached.cachedAt;
        if (age < this.defaultHealthTtlMs) {
          return cached.health;
        }
      }
    }

    return await this.refreshHealth(trimmedId);
  }

  /**
   * Refreshes health for a specific registered provider.
   * Guarantees single-flight concurrency, timeout enforcement, sanitized error normalization,
   * and stale-result guard protection against concurrent unregister or replace.
   */
  async refreshHealth(providerId: string): Promise<ProviderHealth> {
    const trimmedId = this.normalizeLookupId(providerId);
    const entry = this.entries.get(trimmedId);
    if (!entry) {
      throw new BrainRegistryError(
        'provider_not_found',
        `Provider '${providerId}' is not registered`
      );
    }

    // Single-flight deduplication: reuse active in-flight probe
    const existingInFlight = this.inFlightProbes.get(trimmedId);
    if (existingInFlight) {
      return existingInFlight;
    }

    const probeRevision = entry.revision;
    const probePromise = (async () => {
      const startTime = Date.now();
      let rawHealth: ProviderHealth;
      let timer: NodeJS.Timeout | undefined;

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new BrainRegistryError(
                'health_timeout',
                'Provider health check timed out.'
              )
            );
          }, this.healthTimeoutMs);
        });

        rawHealth = await Promise.race([entry.provider.health(), timeoutPromise]);
      } catch (err) {
        const elapsed = Math.max(0, Date.now() - startTime);
        const isTimeout =
          (err instanceof BrainRegistryError && err.code === 'health_timeout') ||
          (err instanceof Error && err.message.toLowerCase().includes('timed out'));

        rawHealth = {
          status: 'unavailable',
          message: isTimeout
            ? 'Provider health check timed out.'
            : 'Provider health check failed.',
          latencyMs: elapsed,
          checkedAt: Date.now()
        };
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }

      let canonicalStatus = 'unavailable';
      try {
        canonicalStatus = normalizeProviderHealthStatus(rawHealth.status);
      } catch {
        canonicalStatus = 'unavailable';
      }

      const normalizedHealth = ProviderHealthSchema.parse({
        status: canonicalStatus,
        message: rawHealth.message,
        latencyMs: rawHealth.latencyMs ?? Math.max(0, Date.now() - startTime),
        checkedAt: rawHealth.checkedAt ?? Date.now()
      });

      // Guard: discard result if provider was unregistered or replaced during probe
      const currentEntry = this.entries.get(trimmedId);
      if (!currentEntry || currentEntry.revision !== probeRevision) {
        return normalizedHealth;
      }

      this.healthCache.set(trimmedId, {
        health: normalizedHealth,
        cachedAt: Date.now(),
        revision: probeRevision
      });

      return normalizedHealth;
    })();

    this.inFlightProbes.set(trimmedId, probePromise);
    try {
      return await probePromise;
    } finally {
      this.inFlightProbes.delete(trimmedId);
    }
  }

  /**
   * Refreshes health for all registered providers in parallel.
   */
  async refreshAllHealth(): Promise<Record<string, ProviderHealth>> {
    const results: Record<string, ProviderHealth> = {};
    const ids = Array.from(this.entries.keys());

    await Promise.all(
      ids.map(async (id) => {
        try {
          results[id] = await this.refreshHealth(id);
        } catch {
          // Provider may have been unregistered concurrently
        }
      })
    );

    return results;
  }

  /**
   * Clears health cache for one or all registered providers.
   */
  clearHealthCache(providerId?: string): void {
    if (providerId) {
      this.healthCache.delete(providerId.trim());
    } else {
      this.healthCache.clear();
    }
  }

  /**
   * Produces an immutable, serializable registry snapshot suitable for developer diagnostics.
   * Only includes descriptors and health for providers with actual probed health.
   * Guarantees zero sensitive internal exception text, no raw class instances, and isolated clones.
   */
  getSnapshot(): ProviderRegistrySnapshot {
    const descriptors: ProviderDescriptor[] = [];
    for (const id of this.entries.keys()) {
      const desc = this.getDescriptor(id);
      if (desc) {
        descriptors.push(
          Object.freeze({
            ...desc,
            capabilities: Object.freeze({ ...desc.capabilities }),
            health: Object.freeze({ ...desc.health })
          })
        );
      }
    }

    const healthSnapshot: Record<string, ProviderHealth> = {};
    for (const [id, cacheEntry] of this.healthCache.entries()) {
      if (this.entries.has(id)) {
        healthSnapshot[id] = Object.freeze({ ...cacheEntry.health });
      }
    }

    return Object.freeze({
      providers: Object.freeze(descriptors),
      health: Object.freeze(healthSnapshot),
      generatedAt: Date.now()
    });
  }

  /**
   * Asynchronously probes all providers, then produces a full snapshot.
   */
  async resolveSnapshot(): Promise<ProviderRegistrySnapshot> {
    await this.refreshAllHealth();
    return this.getSnapshot();
  }
}
