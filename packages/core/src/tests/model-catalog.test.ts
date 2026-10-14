import { describe, it, expect } from 'vitest';
import type {
  BrainCapabilities,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  BrainEvent,
  ModelCatalogProvider,
  ModelCatalogSnapshot,
  ModelDescriptor,
  ProviderDescriptor,
  ProviderHealth
} from '@mave/contracts';
import { BrainCapabilitiesSchema } from '@mave/contracts';
import {
  BrainProviderRegistry,
  ModelCatalogError,
  ModelCatalogRuntime
} from '../brain/index.js';

interface TestCatalogProviderOptions {
  id: string;
  models?: ModelDescriptor[];
  delayMs?: number;
  throwError?: boolean;
  errorMessage?: string;
  mismatchedProviderId?: string;
  duplicateModelId?: boolean;
  malformedData?: unknown;
}

function createCatalogProvider(options: TestCatalogProviderOptions): ModelCatalogProvider & {
  getCatalogCallCount: () => number;
  getChatCallCount: () => number;
  setDelay: (ms: number) => void;
  setThrow: (shouldThrow: boolean, msg?: string) => void;
} {
  let catalogCallCount = 0;
  let chatCallCount = 0;
  let delayMs = options.delayMs ?? 0;
  let shouldThrow = options.throwError ?? false;
  let errorMsg = options.errorMessage ?? 'Simulated raw vendor network failure';

  return {
    id: options.id,
    getCatalogCallCount: () => catalogCallCount,
    getChatCallCount: () => chatCallCount,
    setDelay: (ms: number) => {
      delayMs = ms;
    },
    setThrow: (val: boolean, msg?: string) => {
      shouldThrow = val;
      if (msg) errorMsg = msg;
    },
    getCapabilities(): BrainCapabilities {
      return BrainCapabilitiesSchema.parse({
        streaming: true,
        fastChat: true,
        reasoning: true,
        coding: false,
        toolUse: false,
        multimodal: false,
        vision: false,
        webResearch: false,
        longContext: false,
        local: false
      });
    },
    async health(): Promise<ProviderHealth> {
      return {
        status: 'healthy',
        checkedAt: Date.now()
      };
    },
    async getCatalog(): Promise<ModelCatalogSnapshot> {
      catalogCallCount++;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (shouldThrow) {
        throw new Error(errorMsg);
      }
      if (options.malformedData !== undefined) {
        return options.malformedData as unknown as ModelCatalogSnapshot;
      }

      let models: ModelDescriptor[] = options.models ?? [
        {
          id: `${options.id}-fast`,
          providerId: options.id,
          displayName: 'Fast Model',
          status: 'available',
          latencyClass: 'interactive',
          qualityClass: 'fast',
          costClass: 'low',
          contextClass: 'standard',
          capabilities: {
            streaming: true,
            fastChat: true,
            reasoning: false,
            coding: false,
            toolUse: false,
            multimodal: false,
            vision: false,
            webResearch: false,
            longContext: false,
            local: false
          },
          privacyClass: 'standard_cloud'
        },
        {
          id: `${options.id}-balanced`,
          providerId: options.id,
          displayName: 'Balanced Model',
          status: 'available',
          latencyClass: 'balanced',
          qualityClass: 'balanced',
          costClass: 'medium',
          contextClass: 'large',
          capabilities: {
            streaming: true,
            fastChat: true,
            reasoning: true,
            coding: false,
            toolUse: false,
            multimodal: false,
            vision: false,
            webResearch: false,
            longContext: false,
            local: false
          },
          privacyClass: 'standard_cloud'
        }
      ];

      if (options.duplicateModelId) {
        models = [models[0]!, { ...models[0]! }];
      }

      return {
        providerId: options.mismatchedProviderId ?? options.id,
        models,
        refreshedAt: Date.now()
      };
    },
    getDescriptor(): ProviderDescriptor {
      return {
        id: options.id,
        kind: 'model_provider',
        displayName: `Test Provider (${options.id})`,
        accessPath: 'local_runtime',
        capabilities: this.getCapabilities(),
        health: { status: 'healthy', checkedAt: Date.now() },
        defaultModelId: `${options.id}-fast`
      };
    },
    async *chat(_req: BrainRequest, _opts?: BrainRequestOptions): AsyncIterable<BrainEvent> {
      chatCallCount++;
      yield { type: 'delta', requestId: _req.requestId, text: 'noop' };
    }
  };
}

function createPlainProvider(id: string): BrainProvider {
  return {
    id,
    getCapabilities(): BrainCapabilities {
      return BrainCapabilitiesSchema.parse({
        streaming: true,
        fastChat: true,
        reasoning: false,
        coding: false,
        toolUse: false,
        multimodal: false,
        vision: false,
        webResearch: false,
        longContext: false,
        local: false
      });
    },
    async health(): Promise<ProviderHealth> {
      return { status: 'healthy', checkedAt: Date.now() };
    },
    async *chat(): AsyncIterable<BrainEvent> {}
  };
}

describe('ModelCatalogRuntime', () => {
  it('rejects provider without catalog capability cleanly (catalog_not_supported)', async () => {
    const registry = new BrainProviderRegistry();
    const plain = createPlainProvider('plain-provider');
    registry.register(plain);

    const runtime = new ModelCatalogRuntime(registry);
    await expect(runtime.getCatalog('plain-provider')).rejects.toThrow(ModelCatalogError);

    try {
      await runtime.getCatalog('plain-provider');
    } catch (err) {
      expect((err as ModelCatalogError).code).toBe('catalog_not_supported');
    }
  });

  it('rejects unregistered provider cleanly (provider_not_found)', async () => {
    const registry = new BrainProviderRegistry();
    const runtime = new ModelCatalogRuntime(registry);

    await expect(runtime.getCatalog('missing-prov')).rejects.toThrow(ModelCatalogError);
    try {
      await runtime.getCatalog('missing-prov');
    } catch (err) {
      expect((err as ModelCatalogError).code).toBe('provider_not_found');
    }
  });

  it('loads valid catalog snapshot and verifies registered ProviderId invariant', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({ id: 'valid-prov' });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);
    const catalog = await runtime.getCatalog('valid-prov');

    expect(catalog.providerId).toBe('valid-prov');
    expect(catalog.models).toHaveLength(2);
    expect(catalog.models[0]?.id).toBe('valid-prov-fast');
    expect(prov.getCatalogCallCount()).toBe(1);
    expect(prov.getChatCallCount()).toBe(0);
  });

  it('rejects malformed catalog data cleanly (catalog_invalid)', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({
      id: 'malformed-prov',
      malformedData: { notAValidCatalog: true }
    });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);
    await expect(runtime.getCatalog('malformed-prov')).rejects.toThrow(ModelCatalogError);

    try {
      await runtime.getCatalog('malformed-prov');
    } catch (err) {
      expect((err as ModelCatalogError).code).toBe('catalog_invalid');
    }
  });

  it('rejects mismatched snapshot providerId (catalog_invalid)', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({
      id: 'intended-id',
      mismatchedProviderId: 'wrong-id'
    });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);
    await expect(runtime.getCatalog('intended-id')).rejects.toThrow(ModelCatalogError);

    try {
      await runtime.getCatalog('intended-id');
    } catch (err) {
      expect((err as ModelCatalogError).code).toBe('catalog_invalid');
    }
  });

  it('rejects duplicate ModelId in catalog (catalog_invalid)', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({
      id: 'dup-prov',
      duplicateModelId: true
    });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);
    await expect(runtime.getCatalog('dup-prov')).rejects.toThrow(ModelCatalogError);

    try {
      await runtime.getCatalog('dup-prov');
    } catch (err) {
      expect((err as ModelCatalogError).code).toBe('catalog_invalid');
      expect((err as ModelCatalogError).message).toContain('duplicate model id');
    }
  });

  it('reuses unexpired cached catalog snapshot without calling provider again', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({ id: 'cached-prov' });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry, { defaultCatalogTtlMs: 30000 });

    const snap1 = await runtime.getCatalog('cached-prov');
    const snap2 = await runtime.getCatalog('cached-prov');

    expect(prov.getCatalogCallCount()).toBe(1);
    expect(snap1).toBe(snap2);
    expect(runtime.hasCatalog('cached-prov')).toBe(true);
    expect(runtime.getCachedCatalog('cached-prov')).toBe(snap1);
  });

  it('supports explicit refresh via refreshCatalog and forceRefresh option', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({ id: 'refresh-prov' });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);

    await runtime.getCatalog('refresh-prov');
    expect(prov.getCatalogCallCount()).toBe(1);

    await runtime.refreshCatalog('refresh-prov');
    expect(prov.getCatalogCallCount()).toBe(2);

    await runtime.getCatalog('refresh-prov', { forceRefresh: true });
    expect(prov.getCatalogCallCount()).toBe(3);
  });

  it('supports explicit invalidation via invalidateCatalog and clearCatalogCache', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({ id: 'inval-prov' });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);

    await runtime.getCatalog('inval-prov');
    expect(runtime.hasCatalog('inval-prov')).toBe(true);

    runtime.invalidateCatalog('inval-prov');
    expect(runtime.hasCatalog('inval-prov')).toBe(false);
    expect(runtime.getCachedCatalog('inval-prov')).toBeUndefined();

    await runtime.getCatalog('inval-prov');
    expect(runtime.hasCatalog('inval-prov')).toBe(true);

    runtime.clearCatalogCache();
    expect(runtime.hasCatalog('inval-prov')).toBe(false);
  });

  it('single-flights concurrent catalog requests for the same provider', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({ id: 'concurrent-prov', delayMs: 40 });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);

    const [c1, c2, c3] = await Promise.all([
      runtime.refreshCatalog('concurrent-prov'),
      runtime.refreshCatalog('concurrent-prov'),
      runtime.refreshCatalog('concurrent-prov')
    ]);

    expect(prov.getCatalogCallCount()).toBe(1);
    expect(c1).toBe(c2);
    expect(c2).toBe(c3);
  });

  it('enforces catalog timeout and normalizes message cleanly (catalog_timeout)', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({ id: 'timeout-prov', delayMs: 200 });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry, { catalogTimeoutMs: 30 });

    await expect(runtime.getCatalog('timeout-prov')).rejects.toThrow(ModelCatalogError);

    try {
      await runtime.getCatalog('timeout-prov');
    } catch (err) {
      const error = err as ModelCatalogError;
      expect(error.code).toBe('catalog_timeout');
      expect(error.message).toBe('Model catalog fetch timed out.');
    }
  });

  it('sanitizes thrown provider errors without leaking sensitive stack traces (catalog_unavailable)', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({
      id: 'throw-prov',
      throwError: true,
      errorMessage: 'FATAL: /home/user/.secrets/api-key.json leaked in stack'
    });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);

    try {
      await runtime.getCatalog('throw-prov');
      expect.fail('Expected catalog fetch to throw');
    } catch (err) {
      const error = err as ModelCatalogError;
      expect(error.code).toBe('catalog_unavailable');
      expect(error.message).toBe('Model catalog fetch failed.');
      expect(error.message).not.toContain('/secrets');
    }
  });

  it('rejects stale catalog result if provider is replaced during in-flight fetch', async () => {
    const registry = new BrainProviderRegistry();
    const prov1 = createCatalogProvider({ id: 'race-prov', delayMs: 50 });
    registry.register(prov1);

    const runtime = new ModelCatalogRuntime(registry);

    // Launch catalog fetch for prov1
    const fetchPromise = runtime.refreshCatalog('race-prov');

    // Replace provider instance while fetch is in-flight
    const prov2 = createCatalogProvider({ id: 'race-prov', delayMs: 0 });
    registry.replace(prov2);

    const result = await fetchPromise;
    expect(result.providerId).toBe('race-prov');

    // Cached catalog must NOT belong to prov1; runtime detects instance mismatch
    expect(runtime.getCachedCatalog('race-prov')).toBeUndefined();

    // Next getCatalog fetches from prov2
    await runtime.getCatalog('race-prov');
    expect(prov2.getCatalogCallCount()).toBe(1);
    expect(runtime.hasCatalog('race-prov')).toBe(true);
  });

  it('rejects stale catalog result if provider is unregistered during in-flight fetch', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({ id: 'unreg-prov', delayMs: 50 });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);

    const fetchPromise = runtime.refreshCatalog('unreg-prov');

    // Unregister while in-flight
    registry.unregister('unreg-prov');

    await expect(fetchPromise).rejects.toThrow(ModelCatalogError);
    try {
      await fetchPromise;
    } catch (err) {
      expect((err as ModelCatalogError).code).toBe('provider_not_found');
    }

    expect(runtime.getCachedCatalog('unreg-prov')).toBeUndefined();
  });

  it('guarantees complete mutation isolation on returned catalog snapshot', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({ id: 'freeze-prov' });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);
    const catalog = await runtime.getCatalog('freeze-prov');

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.models)).toBe(true);
    expect(Object.isFrozen(catalog.models[0])).toBe(true);
    expect(Object.isFrozen(catalog.models[0]?.capabilities)).toBe(true);

    expect(() => {
      (catalog.models as unknown as ModelDescriptor[]).push({ id: 'rogue' } as ModelDescriptor);
    }).toThrow();

    expect(() => {
      (catalog.models[0] as unknown as { displayName: string }).displayName = 'Hacked';
    }).toThrow();
  });

  it('is completely JSON serialization safe', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({ id: 'json-prov' });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);
    const catalog = await runtime.getCatalog('json-prov');

    const json = JSON.stringify(catalog);
    expect(typeof json).toBe('string');

    const parsed = JSON.parse(json);
    expect(parsed.providerId).toBe('json-prov');
    expect(parsed.models).toHaveLength(2);
  });

  it('never invokes provider chat or text generation during catalog fetch', async () => {
    const registry = new BrainProviderRegistry();
    const prov = createCatalogProvider({ id: 'no-chat-prov' });
    registry.register(prov);

    const runtime = new ModelCatalogRuntime(registry);
    await runtime.getCatalog('no-chat-prov');

    expect(prov.getChatCallCount()).toBe(0);
  });
});
