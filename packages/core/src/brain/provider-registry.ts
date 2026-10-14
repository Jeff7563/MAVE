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
import { BrainRegistryError } from './types.js';

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

export interface ProviderRegistrySnapshot {
  readonly providers: readonly ProviderDescriptor[];
  readonly health: Record<string, ProviderHealth>;
  readonly generatedAt: number;
}

interface ProviderEntry {
  readonly id: string;
  provider: BrainProvider;
  metadata?: Partial<ProviderDescriptor>;
  revision: number;
  registeredAt: number;
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
 * - Deterministic provider registration, replacement, and unregistration
 * - Safe provider lookup by normalized ProviderId
 * - Capability discovery and ProviderDescriptor synthesis
 * - Race-safe health probing with single-flight coordination
 * - Health error and timeout normalization
 * - In-memory TTL health caching with stale-result rejection
 * - Immutable registry and health snapshots
 */
export class BrainProviderRegistry {
  private readonly entries = new Map<string, ProviderEntry>();
  private readonly healthCache = new Map<string, CachedHealth>();
  private readonly inFlightProbes = new Map<string, Promise<ProviderHealth>>();
  private readonly healthTimeoutMs: number;
  private readonly defaultHealthTtlMs: number;

  constructor(options?: BrainProviderRegistryOptions) {
    this.healthTimeoutMs = options?.healthTimeoutMs ?? 5000;
    this.defaultHealthTtlMs = options?.defaultHealthTtlMs ?? 15000;
  }

  private normalizeId(id: string): string {
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
   * Rejects duplicate registrations with BrainRegistryError('duplicate_provider').
   */
  register(provider: BrainProvider, metadata?: Partial<ProviderDescriptor>): void {
    if (!provider || typeof provider.id !== 'string') {
      throw new BrainRegistryError('invalid_provider_id', 'Provider must have a valid string id');
    }

    const trimmedId = this.normalizeId(provider.id);

    if (this.entries.has(trimmedId)) {
      throw new BrainRegistryError(
        'duplicate_provider',
        `Provider with id '${trimmedId}' is already registered`
      );
    }

    this.entries.set(trimmedId, {
      id: trimmedId,
      provider,
      metadata,
      revision: 1,
      registeredAt: Date.now()
    });
  }

  /**
   * Explicitly replaces an existing registered provider.
   * Bumps the revision token and invalidates stale health cache entries.
   */
  replace(provider: BrainProvider, metadata?: Partial<ProviderDescriptor>): void {
    if (!provider || typeof provider.id !== 'string') {
      throw new BrainRegistryError('invalid_provider_id', 'Provider must have a valid string id');
    }

    const trimmedId = this.normalizeId(provider.id);
    const existing = this.entries.get(trimmedId);

    if (!existing) {
      throw new BrainRegistryError(
        'provider_not_found',
        `Cannot replace unregistered provider '${trimmedId}'`
      );
    }

    existing.revision += 1;
    existing.provider = provider;
    if (metadata !== undefined) {
      existing.metadata = metadata;
    }

    // Invalidate cached health for replaced provider
    this.healthCache.delete(trimmedId);
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
   * Discovers or synthesizes the ProviderDescriptor for a registered provider.
   * Hydrates dynamic health from the registry's health state.
   */
  getDescriptor(providerId: string): ProviderDescriptor {
    const trimmedId = this.normalizeId(providerId);
    const entry = this.entries.get(trimmedId);
    if (!entry) {
      throw new BrainRegistryError(
        'provider_not_found',
        `Provider '${providerId}' is not registered`
      );
    }

    const cached = this.healthCache.get(trimmedId);
    const currentHealth: ProviderHealth = cached
      ? { ...cached.health }
      : {
          status: 'unconfigured',
          message: 'Provider has not been probed yet',
          checkedAt: entry.registeredAt
        };

    let descriptor: ProviderDescriptor;
    if (isModelCatalogProvider(entry.provider)) {
      const raw = entry.provider.getDescriptor();
      descriptor = {
        ...raw,
        health: currentHealth,
        ...entry.metadata
      };
    } else {
      const kind: ProviderKind =
        entry.metadata?.kind ??
        (trimmedId === 'antigravity' ? 'agent_runtime_provider' : 'model_provider');
      const accessPath: ProviderAccessPath =
        entry.metadata?.accessPath ??
        (trimmedId === 'antigravity' ? 'official_cli' : 'local_runtime');
      const displayName: string =
        entry.metadata?.displayName ??
        (trimmedId === 'antigravity'
          ? 'Google Antigravity'
          : trimmedId === 'mock'
            ? 'Mock Brain Provider'
            : trimmedId);

      descriptor = {
        id: trimmedId,
        kind,
        displayName,
        accessPath,
        capabilities: entry.provider.getCapabilities(),
        health: currentHealth,
        defaultModelId: entry.metadata?.defaultModelId,
        documentationUrl: entry.metadata?.documentationUrl
      };
    }

    return ProviderDescriptorSchema.parse(descriptor);
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
    const trimmedId = this.normalizeId(providerId);
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
   * Guarantees single-flight concurrency, timeout enforcement, throw normalization,
   * and stale-result guard protection against concurrent unregister or replace.
   */
  async refreshHealth(providerId: string): Promise<ProviderHealth> {
    const trimmedId = this.normalizeId(providerId);
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
                `Health check timed out after ${this.healthTimeoutMs}ms`
              )
            );
          }, this.healthTimeoutMs);
        });

        rawHealth = await Promise.race([entry.provider.health(), timeoutPromise]);
      } catch (err) {
        const elapsed = Math.max(0, Date.now() - startTime);
        const msg = err instanceof Error ? err.message : String(err);
        rawHealth = {
          status: 'unavailable',
          message: msg,
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
   */
  getSnapshot(): ProviderRegistrySnapshot {
    const descriptors = Array.from(this.entries.keys()).map((id) =>
      this.getDescriptor(id)
    );
    const health: Record<string, ProviderHealth> = {};
    for (const [id, cacheEntry] of this.healthCache.entries()) {
      if (this.entries.has(id)) {
        health[id] = { ...cacheEntry.health };
      }
    }

    return {
      providers: Object.freeze(descriptors),
      health: Object.freeze(health),
      generatedAt: Date.now()
    };
  }
}
