import { describe, it, expect } from 'vitest';
import type {
  BrainCapabilities,
  BrainProvider,
  ModelCatalogProvider,
  ModelCatalogSnapshot,
  ProviderDescriptor,
  ProviderHealth,
  ProviderHealthStatus
} from '@mave/contracts';
import { BrainCapabilitiesSchema } from '@mave/contracts';
import {
  BrainProviderRegistry,
  BrainRegistryError
} from '../brain/index.js';

interface TestProviderOptions {
  id: string;
  capabilities?: Partial<BrainCapabilities>;
  healthStatus?: ProviderHealthStatus;
  healthMessage?: string;
  healthLatencyMs?: number;
  healthDelayMs?: number;
  throwOnHealth?: boolean;
  throwMessage?: string;
}

function createTestProvider(options: TestProviderOptions): BrainProvider & {
  getChatCallCount: () => number;
  getHealthCallCount: () => number;
  setHealthStatus: (status: ProviderHealthStatus, message?: string) => void;
  setThrowOnHealth: (shouldThrow: boolean, message?: string) => void;
  setHealthDelay: (delayMs: number) => void;
} {
  let chatCallCount = 0;
  let healthCallCount = 0;
  let status = options.healthStatus ?? 'healthy';
  let message = options.healthMessage;
  let delayMs = options.healthDelayMs ?? 0;
  let shouldThrow = options.throwOnHealth ?? false;
  let throwMsg = options.throwMessage ?? 'Simulated health probe exception';

  return {
    id: options.id,
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
        local: false,
        ...options.capabilities
      });
    },
    async health(): Promise<ProviderHealth> {
      healthCallCount++;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (shouldThrow) {
        throw new Error(throwMsg);
      }
      return {
        status,
        message,
        latencyMs: options.healthLatencyMs ?? delayMs,
        checkedAt: Date.now()
      };
    },
    async *chat() {
      chatCallCount++;
      yield {
        type: 'started' as const,
        requestId: 'test-chat',
        providerId: options.id,
        timestamp: Date.now()
      };
    },
    getChatCallCount: () => chatCallCount,
    getHealthCallCount: () => healthCallCount,
    setHealthStatus: (s: ProviderHealthStatus, m?: string) => {
      status = s;
      message = m;
    },
    setThrowOnHealth: (t: boolean, m?: string) => {
      shouldThrow = t;
      if (m) throwMsg = m;
    },
    setHealthDelay: (d: number) => {
      delayMs = d;
    }
  };
}

describe('BrainProviderRegistry Hardened Lifecycle & Health Suite', () => {
  it('1. registers a healthy provider and retrieves by id', () => {
    const registry = new BrainProviderRegistry();
    const provider = createTestProvider({ id: 'provider-1' });

    registry.register(provider);

    expect(registry.get('provider-1')).toBe(provider);
    expect(registry.get(' provider-1 ')).toBe(provider);
    expect(registry.has('provider-1')).toBe(true);
    expect(registry.require('provider-1')).toBe(provider);
  });

  it('2. rejects duplicate provider ID with BrainRegistryError', () => {
    const registry = new BrainProviderRegistry();
    const p1 = createTestProvider({ id: 'dup-id' });
    const p2 = createTestProvider({ id: 'dup-id' });

    registry.register(p1);

    expect(() => registry.register(p2)).toThrow(BrainRegistryError);
    try {
      registry.register(p2);
    } catch (err) {
      const regErr = err as BrainRegistryError;
      expect(regErr.code).toBe('duplicate_provider');
    }
    expect(registry.get('dup-id')).toBe(p1);
  });

  it('3. supports explicit replacement via replace() with revision bump and cache invalidation', async () => {
    const registry = new BrainProviderRegistry();
    const p1 = createTestProvider({ id: 'prov-replace', healthStatus: 'healthy', healthMessage: 'v1' });
    const p2 = createTestProvider({ id: 'prov-replace', healthStatus: 'degraded', healthMessage: 'v2' });

    registry.register(p1);
    await registry.health('prov-replace');
    expect(registry.getHealth('prov-replace')?.message).toBe('v1');

    registry.replace(p2);
    expect(registry.get('prov-replace')).toBe(p2);
    // Replaced provider should have invalidated cached health
    expect(registry.getHealth('prov-replace')).toBeUndefined();

    // Next health check queries the replacement provider
    const newHealth = await registry.health('prov-replace');
    expect(newHealth.status).toBe('degraded');
    expect(newHealth.message).toBe('v2');
  });

  it('4. throws when replacing an unregistered provider', () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'unregistered' });

    expect(() => registry.replace(p)).toThrow(BrainRegistryError);
    try {
      registry.replace(p);
    } catch (err) {
      expect((err as BrainRegistryError).code).toBe('provider_not_found');
    }
  });

  it('5. deterministic unknown provider lookup', () => {
    const registry = new BrainProviderRegistry();

    expect(registry.get('missing')).toBeUndefined();
    expect(registry.has('missing')).toBe(false);
    expect(() => registry.require('missing')).toThrow(BrainRegistryError);
    try {
      registry.require('missing');
    } catch (err) {
      expect((err as BrainRegistryError).code).toBe('provider_not_found');
    }
  });

  it('6. safely unregisters provider and clears cached health', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'to-remove' });

    registry.register(p);
    await registry.health('to-remove');
    expect(registry.getHealth('to-remove')).toBeDefined();

    expect(registry.unregister('to-remove')).toBe(true);
    expect(registry.get('to-remove')).toBeUndefined();
    expect(registry.has('to-remove')).toBe(false);
    expect(registry.getHealth('to-remove')).toBeUndefined();

    // Removing again returns false
    expect(registry.unregister('to-remove')).toBe(false);
  });

  it('7. lists registered providers in deterministic insertion order', () => {
    const registry = new BrainProviderRegistry();
    const pA = createTestProvider({ id: 'gamma' });
    const pB = createTestProvider({ id: 'alpha' });
    const pC = createTestProvider({ id: 'beta' });

    registry.register(pA);
    registry.register(pB);
    registry.register(pC);

    const list = registry.list();
    expect(list.map((p) => p.id)).toEqual(['gamma', 'alpha', 'beta']);
  });

  it('8. provides immutable registry snapshots', () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'snap-prov' });
    registry.register(p, { displayName: 'Snapshot Test' });

    const snapshot = registry.getSnapshot();
    expect(snapshot.providers.length).toBe(1);
    expect(snapshot.providers[0]?.id).toBe('snap-prov');
    expect(snapshot.providers[0]?.displayName).toBe('Snapshot Test');
    expect(Object.isFrozen(snapshot.providers)).toBe(true);
    expect(Object.isFrozen(snapshot.health)).toBe(true);
  });

  it('9. verifies all 8 canonical health statuses', async () => {
    const statuses: ProviderHealthStatus[] = [
      'healthy',
      'degraded',
      'unhealthy',
      'unconfigured',
      'quota_limited',
      'rate_limited',
      'auth_error',
      'unavailable'
    ];

    for (const status of statuses) {
      const registry = new BrainProviderRegistry();
      const p = createTestProvider({ id: `p-${status}`, healthStatus: status });
      registry.register(p);

      const health = await registry.health(`p-${status}`);
      expect(health.status).toBe(status);
    }
  });

  it('10. normalizes legacy health aliases ready -> healthy and error -> unhealthy', async () => {
    const registry = new BrainProviderRegistry();
    const pReady = createTestProvider({ id: 'p-ready', healthStatus: 'ready' as any });
    const pError = createTestProvider({ id: 'p-error', healthStatus: 'error' as any });

    registry.register(pReady);
    registry.register(pError);

    const hReady = await registry.health('p-ready');
    const hError = await registry.health('p-error');

    expect(hReady.status).toBe('healthy');
    expect(hError.status).toBe('unhealthy');
  });

  it('11. normalizes health probe throw to status unavailable without crashing caller', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({
      id: 'p-throw',
      throwOnHealth: true,
      throwMessage: 'Network socket closed unexpectedly'
    });

    registry.register(p);

    const health = await registry.health('p-throw');
    expect(health.status).toBe('unavailable');
    expect(health.message).toContain('Network socket closed unexpectedly');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('12. normalizes health probe timeout to status unavailable', async () => {
    const registry = new BrainProviderRegistry({ healthTimeoutMs: 50 });
    const p = createTestProvider({
      id: 'p-timeout',
      healthDelayMs: 200
    });

    registry.register(p);

    const health = await registry.health('p-timeout');
    expect(health.status).toBe('unavailable');
    expect(health.message).toContain('timed out after 50ms');
  });

  it('13. proves health probe NEVER invokes AI generation or chat()', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'p-no-chat' });
    registry.register(p);

    await registry.health('p-no-chat');
    await registry.refreshHealth('p-no-chat');
    await registry.refreshAllHealth();

    expect(p.getChatCallCount()).toBe(0);
    expect(p.getHealthCallCount()).toBe(3);
  });

  it('14. guarantees single-flight concurrency for duplicate simultaneous health probes', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'p-single-flight', healthDelayMs: 50 });
    registry.register(p);

    // Call refreshHealth 3 times concurrently
    const [h1, h2, h3] = await Promise.all([
      registry.refreshHealth('p-single-flight'),
      registry.refreshHealth('p-single-flight'),
      registry.refreshHealth('p-single-flight')
    ]);

    expect(h1.status).toBe('healthy');
    expect(h2.status).toBe('healthy');
    expect(h3.status).toBe('healthy');
    // Health probe must only be executed once due to in-flight deduplication
    expect(p.getHealthCallCount()).toBe(1);
  });

  it('15. rejects stale results and does not resurrect health if provider unregistered during probe', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'p-unreg-race', healthDelayMs: 100 });
    registry.register(p);

    // Start probe
    const refreshPromise = registry.refreshHealth('p-unreg-race');

    // Immediately unregister while probe is sleeping
    expect(registry.unregister('p-unreg-race')).toBe(true);
    expect(registry.getHealth('p-unreg-race')).toBeUndefined();

    // Await probe completion
    await refreshPromise;

    // Must NOT have resurrected health state for removed provider
    expect(registry.getHealth('p-unreg-race')).toBeUndefined();
    expect(registry.has('p-unreg-race')).toBe(false);
  });

  it('16. rejects stale results if provider was replaced during health probe', async () => {
    const registry = new BrainProviderRegistry();
    const p1 = createTestProvider({ id: 'p-race', healthStatus: 'healthy', healthMessage: 'p1', healthDelayMs: 100 });
    const p2 = createTestProvider({ id: 'p-race', healthStatus: 'degraded', healthMessage: 'p2', healthDelayMs: 0 });

    registry.register(p1);

    // Start probe on p1
    const p1Promise = registry.refreshHealth('p-race');

    // Replace p1 with p2 while p1 probe is in flight
    registry.replace(p2);

    // Wait for p1 probe to complete
    await p1Promise;

    // Cache should not contain p1's stale result
    expect(registry.getHealth('p-race')).toBeUndefined();

    // Fresh probe on p2 should return p2's state
    const p2Health = await registry.refreshHealth('p-race');
    expect(p2Health.status).toBe('degraded');
    expect(p2Health.message).toBe('p2');
  });

  it('17. synthesizes ProviderDescriptor for legacy provider with dynamic health hydration', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'antigravity', healthStatus: 'healthy' });
    registry.register(p);

    // Descriptor before probe has status unconfigured
    const descBefore = registry.getDescriptor('antigravity');
    expect(descBefore.id).toBe('antigravity');
    expect(descBefore.kind).toBe('agent_runtime_provider');
    expect(descBefore.accessPath).toBe('official_cli');
    expect(descBefore.displayName).toBe('Google Antigravity');
    expect(descBefore.health.status).toBe('unconfigured');

    // After probe, descriptor reflects dynamic health
    await registry.health('antigravity');
    const descAfter = registry.getDescriptor('antigravity');
    expect(descAfter.health.status).toBe('healthy');
  });

  it('18. handles ModelCatalogProvider getDescriptor() integration seamlessly', async () => {
    const registry = new BrainProviderRegistry();

    const catalogProvider: ModelCatalogProvider = {
      id: 'catalog-prov',
      getCapabilities: () => ({
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
      }),
      health: async () => ({
        status: 'healthy',
        checkedAt: Date.now()
      }),
      async *chat() {},
      getCatalog: async (): Promise<ModelCatalogSnapshot> => ({
        providerId: 'catalog-prov',
        models: [],
        refreshedAt: Date.now()
      }),
      getDescriptor: (): ProviderDescriptor => ({
        id: 'catalog-prov',
        kind: 'model_provider',
        displayName: 'Custom Catalog Provider',
        accessPath: 'official_api',
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
        health: {
          status: 'healthy',
          checkedAt: Date.now()
        }
      })
    };

    registry.register(catalogProvider);
    const desc = registry.getDescriptor('catalog-prov');
    expect(desc.id).toBe('catalog-prov');
    expect(desc.displayName).toBe('Custom Catalog Provider');
    expect(desc.accessPath).toBe('official_api');
  });

  it('19. clears health cache on demand', async () => {
    const registry = new BrainProviderRegistry();
    const p1 = createTestProvider({ id: 'p1' });
    const p2 = createTestProvider({ id: 'p2' });

    registry.register(p1);
    registry.register(p2);

    await registry.health('p1');
    await registry.health('p2');

    expect(registry.getHealth('p1')).toBeDefined();
    expect(registry.getHealth('p2')).toBeDefined();

    registry.clearHealthCache('p1');
    expect(registry.getHealth('p1')).toBeUndefined();
    expect(registry.getHealth('p2')).toBeDefined();

    registry.clearHealthCache();
    expect(registry.getHealth('p2')).toBeUndefined();
  });

  it('20. refreshAllHealth probes all registered providers in parallel', async () => {
    const registry = new BrainProviderRegistry();
    const p1 = createTestProvider({ id: 'all-1', healthStatus: 'healthy' });
    const p2 = createTestProvider({ id: 'all-2', healthStatus: 'degraded' });

    registry.register(p1);
    registry.register(p2);

    const snapshot = await registry.refreshAllHealth();
    expect(snapshot['all-1']?.status).toBe('healthy');
    expect(snapshot['all-2']?.status).toBe('degraded');
  });
});

