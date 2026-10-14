import type {
  BrainProvider,
  ModelCatalogProvider,
  ModelCatalogSnapshot,
  ModelDescriptor
} from '@mave/contracts';
import {
  isModelCatalogProvider,
  ModelCatalogSnapshotSchema
} from '@mave/contracts';
import type { BrainProviderRegistry } from './provider-registry.js';
import {
  ModelCatalogError,
  type ModelCatalogRuntimeOptions
} from './types.js';

interface CachedCatalogEntry {
  readonly snapshot: ModelCatalogSnapshot;
  readonly cachedAt: number;
  readonly providerInstance: BrainProvider;
}

/**
 * Deep-clones and deeply freezes a ModelCatalogSnapshot to guarantee JSON-safety
 * and total mutation isolation from caller manipulation.
 */
function deepFreezeCatalogSnapshot(snapshot: ModelCatalogSnapshot): ModelCatalogSnapshot {
  const clonedModels: ModelDescriptor[] = snapshot.models.map((m) =>
    Object.freeze({
      ...m,
      capabilities: Object.freeze({ ...m.capabilities })
    })
  );

  return Object.freeze({
    providerId: snapshot.providerId,
    models: Object.freeze(clonedModels) as unknown as ModelDescriptor[],
    refreshedAt: snapshot.refreshedAt
  });
}

/**
 * ModelCatalogRuntime manages model catalog discovery, caching, validation,
 * and lifecycle isolation across registered brain providers.
 *
 * Responsibilities:
 * - Dynamic discovery via ModelCatalogProvider capability interface
 * - Single source of truth for model inventory snapshots per provider
 * - Schema validation and strict duplicate ModelId rejection
 * - Provider identity consistency (registry provider.id === snapshot.providerId === model.providerId)
 * - In-memory TTL caching with explicit invalidation
 * - Single-flight concurrent fetch deduplication
 * - Stale-result protection against concurrent provider unregister or replacement
 * - Sanitized timeout and error normalization (zero raw stack/credential leakage)
 * - Deep immutability and complete mutation isolation
 * - Metadata-only discovery: never invokes chat(), text generation, or quota consumption
 */
export class ModelCatalogRuntime {
  private readonly registry: BrainProviderRegistry;
  private readonly catalogCache = new Map<string, CachedCatalogEntry>();
  private readonly inFlightFetches = new Map<string, Promise<ModelCatalogSnapshot>>();
  private readonly catalogTimeoutMs: number;
  private readonly defaultCatalogTtlMs: number;

  constructor(
    registry: BrainProviderRegistry,
    options?: ModelCatalogRuntimeOptions
  ) {
    this.registry = registry;
    this.catalogTimeoutMs = options?.catalogTimeoutMs ?? 5000;
    this.defaultCatalogTtlMs = options?.defaultCatalogTtlMs ?? 60000;
  }

  /**
   * Normalizes lookup arguments from callers (trims leading/trailing whitespace).
   */
  private normalizeLookupId(id: string): string {
    if (!id || typeof id !== 'string') {
      throw new ModelCatalogError(
        'provider_not_found',
        'Provider id must be a non-empty string'
      );
    }
    const trimmed = id.trim();
    if (!trimmed) {
      throw new ModelCatalogError(
        'provider_not_found',
        'Provider id cannot be empty'
      );
    }
    return trimmed;
  }

  /**
   * Retrieves the model catalog snapshot for a provider.
   * Reuses unexpired cache entries unless forceRefresh is true.
   */
  async getCatalog(
    providerId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ModelCatalogSnapshot> {
    const trimmedId = this.normalizeLookupId(providerId);
    const provider = this.registry.get(trimmedId);
    if (!provider) {
      throw new ModelCatalogError(
        'provider_not_found',
        `Provider '${trimmedId}' is not registered`,
        trimmedId
      );
    }

    if (!isModelCatalogProvider(provider)) {
      throw new ModelCatalogError(
        'catalog_not_supported',
        `Provider '${trimmedId}' does not support model catalogs`,
        trimmedId
      );
    }

    if (!options?.forceRefresh && this.defaultCatalogTtlMs > 0) {
      const cached = this.catalogCache.get(trimmedId);
      if (cached && cached.providerInstance === provider) {
        const age = Date.now() - cached.cachedAt;
        if (age < this.defaultCatalogTtlMs) {
          return cached.snapshot;
        }
      }
    }

    return await this.refreshCatalog(trimmedId);
  }

  /**
   * Forces a live refresh of the provider's model catalog.
   * Guarantees single-flight concurrency, timeout enforcement, schema validation,
   * duplicate ModelId rejection, and stale-result protection against provider replacement/removal.
   */
  async refreshCatalog(providerId: string): Promise<ModelCatalogSnapshot> {
    const trimmedId = this.normalizeLookupId(providerId);
    const provider = this.registry.get(trimmedId);
    if (!provider) {
      throw new ModelCatalogError(
        'provider_not_found',
        `Provider '${trimmedId}' is not registered`,
        trimmedId
      );
    }

    if (!isModelCatalogProvider(provider)) {
      throw new ModelCatalogError(
        'catalog_not_supported',
        `Provider '${trimmedId}' does not support model catalogs`,
        trimmedId
      );
    }

    // Single-flight deduplication: reuse active in-flight fetch
    const existing = this.inFlightFetches.get(trimmedId);
    if (existing) {
      return existing;
    }

    const capturedProvider: ModelCatalogProvider = provider;
    const fetchPromise = (async (): Promise<ModelCatalogSnapshot> => {
      let rawSnapshot: ModelCatalogSnapshot;
      let timer: NodeJS.Timeout | undefined;

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new ModelCatalogError(
                'catalog_timeout',
                'Model catalog fetch timed out.',
                trimmedId
              )
            );
          }, this.catalogTimeoutMs);
        });

        rawSnapshot = await Promise.race([
          capturedProvider.getCatalog(),
          timeoutPromise
        ]);
      } catch (err) {
        if (err instanceof ModelCatalogError) {
          throw err;
        }
        const isTimeout =
          err instanceof Error && err.message.toLowerCase().includes('timed out');
        throw new ModelCatalogError(
          isTimeout ? 'catalog_timeout' : 'catalog_unavailable',
          isTimeout
            ? 'Model catalog fetch timed out.'
            : 'Model catalog fetch failed.',
          trimmedId
        );
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }

      // 1. Validate snapshot against canonical schema
      const parseResult = ModelCatalogSnapshotSchema.safeParse(rawSnapshot);
      if (!parseResult.success) {
        throw new ModelCatalogError(
          'catalog_invalid',
          `Model catalog for provider '${trimmedId}' returned malformed data: ${parseResult.error.message}`,
          trimmedId
        );
      }
      const validatedSnapshot = parseResult.data;

      // 2. Enforce registered ProviderId invariant
      if (validatedSnapshot.providerId !== trimmedId) {
        throw new ModelCatalogError(
          'catalog_invalid',
          `Model catalog providerId '${validatedSnapshot.providerId}' does not match registered provider '${trimmedId}'`,
          trimmedId
        );
      }

      // 3. Enforce unique ModelId constraint (reject duplicates internally)
      const seenIds = new Set<string>();
      for (const model of validatedSnapshot.models) {
        if (seenIds.has(model.id)) {
          throw new ModelCatalogError(
            'catalog_invalid',
            `Model catalog contains duplicate model id '${model.id}' for provider '${trimmedId}'`,
            trimmedId
          );
        }
        seenIds.add(model.id);
      }

      // 4. Stale-result guard: verify provider still registered and instance unchanged
      const currentProvider = this.registry.get(trimmedId);
      if (!currentProvider || currentProvider !== capturedProvider) {
        if (!currentProvider) {
          throw new ModelCatalogError(
            'provider_not_found',
            `Provider '${trimmedId}' was unregistered during catalog fetch`,
            trimmedId
          );
        }
        // Provider was replaced; return frozen snapshot without polluting cache
        return deepFreezeCatalogSnapshot(validatedSnapshot);
      }

      const frozenSnapshot = deepFreezeCatalogSnapshot(validatedSnapshot);
      this.catalogCache.set(trimmedId, {
        snapshot: frozenSnapshot,
        cachedAt: Date.now(),
        providerInstance: capturedProvider
      });

      return frozenSnapshot;
    })();

    this.inFlightFetches.set(trimmedId, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this.inFlightFetches.delete(trimmedId);
    }
  }

  /**
   * Returns cached snapshot if present and valid for the current registered provider instance,
   * or undefined if not cached or invalidated.
   */
  getCachedCatalog(providerId: string): ModelCatalogSnapshot | undefined {
    if (!providerId || typeof providerId !== 'string') return undefined;
    const trimmedId = providerId.trim();
    const currentProvider = this.registry.get(trimmedId);
    if (!currentProvider) return undefined;

    const cached = this.catalogCache.get(trimmedId);
    if (!cached || cached.providerInstance !== currentProvider) {
      return undefined;
    }

    return cached.snapshot;
  }

  /**
   * Checks whether a valid cached catalog snapshot exists for the given provider.
   */
  hasCatalog(providerId: string): boolean {
    return this.getCachedCatalog(providerId) !== undefined;
  }

  /**
   * Invalidates cached catalog state for one or all registered providers.
   */
  invalidateCatalog(providerId?: string): void {
    if (providerId) {
      this.catalogCache.delete(providerId.trim());
    } else {
      this.catalogCache.clear();
    }
  }

  /**
   * Alias for invalidateCatalog.
   */
  clearCatalogCache(providerId?: string): void {
    this.invalidateCatalog(providerId);
  }
}
