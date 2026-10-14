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
  it('1. registers a canonical provider and retrieves by id', () => {
    const registry = new BrainProviderRegistry();
    const provider = createTestProvider({ id: 'provider-1' });

    registry.register(provider);

    expect(registry.get('provider-1')).toBe(provider);
    expect(registry.get(' provider-1 ')).toBe(provider);
    expect(registry.has('provider-1')).toBe(true);
    expect(registry.require('provider-1')).toBe(provider);
  });

  it('2. strictly enforces canonical provider ID and rejects leading/trailing whitespace', () => {
    const registry = new BrainProviderRegistry();

    // Canonical ID accepted
    registry.register(createTestProvider({ id: 'provider-a' }));
    expect(registry.has('provider-a')).toBe(true);

    // Whitespace IDs rejected
    expect(() => registry.register(createTestProvider({ id: ' provider-b' }))).toThrow(BrainRegistryError);
    expect(() => registry.register(createTestProvider({ id: 'provider-c ' }))).toThrow(BrainRegistryError);
    expect(() => registry.register(createTestProvider({ id: ' provider-d ' }))).toThrow(BrainRegistryError);
    expect(() => registry.register(createTestProvider({ id: '' }))).toThrow(BrainRegistryError);
    expect(() => registry.register(createTestProvider({ id: '   ' }))).toThrow(BrainRegistryError);
  });

  it('3. rejects duplicate provider ID with BrainRegistryError', () => {
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

  it('4. supports explicit replacement via replace() with canonical ID validation and cache invalidation', async () => {
    const registry = new BrainProviderRegistry();
    const p1 = createTestProvider({ id: 'prov-replace', healthStatus: 'healthy', healthMessage: 'v1' });
    const p2 = createTestProvider({ id: 'prov-replace', healthStatus: 'degraded', healthMessage: 'v2' });

    registry.register(p1);
    await registry.health('prov-replace');
    expect(registry.getHealth('prov-replace')?.message).toBe('v1');

    // Replace with whitespace ID rejected
    expect(() => registry.replace(createTestProvider({ id: ' prov-replace' }))).toThrow(BrainRegistryError);

    registry.replace(p2);
    expect(registry.get('prov-replace')).toBe(p2);
    // Replaced provider should have invalidated cached health
    expect(registry.getHealth('prov-replace')).toBeUndefined();

    // Next health check queries the replacement provider
    const newHealth = await registry.health('prov-replace');
    expect(newHealth.status).toBe('degraded');
    expect(newHealth.message).toBe('v2');
  });

  it('5. throws when replacing an unregistered provider', () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'unregistered' });

    expect(() => registry.replace(p)).toThrow(BrainRegistryError);
    try {
      registry.replace(p);
    } catch (err) {
      expect((err as BrainRegistryError).code).toBe('provider_not_found');
    }
  });

  it('6. deterministic unknown provider lookup', () => {
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

  it('7. safely unregisters provider and clears cached health', async () => {
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

  it('8. lists registered providers in deterministic insertion order', () => {
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

  it('9. unprobed provider is NOT reported as unconfigured (absence of health state)', () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'unprobed-test' });
    registry.register(p, { displayName: 'Unprobed Provider' });

    // getHealth is undefined (no fake status)
    expect(registry.getHealth('unprobed-test')).toBeUndefined();

    // getDescriptor is undefined before probe (cannot construct ProviderDescriptor without health)
    expect(registry.getDescriptor('unprobed-test')).toBeUndefined();

    // requireDescriptor throws provider_unprobed
    expect(() => registry.requireDescriptor('unprobed-test')).toThrow(BrainRegistryError);
    try {
      registry.requireDescriptor('unprobed-test');
    } catch (err) {
      expect((err as BrainRegistryError).code).toBe('provider_unprobed');
    }

    // Static metadata is accessible synchronously without health probe
    const meta = registry.getProviderMetadata('unprobed-test');
    expect(meta.id).toBe('unprobed-test');
    expect(meta.displayName).toBe('Unprobed Provider');

    // Snapshot does not include unprobed providers in descriptors or health
    const snap = registry.getSnapshot();
    expect(snap.providers.length).toBe(0);
    expect(snap.health['unprobed-test']).toBeUndefined();
  });

  it('10. resolveDescriptor and resolveSnapshot await real health before producing descriptors', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'resolve-test', healthStatus: 'healthy', healthMessage: 'OK' });
    registry.register(p);

    const desc = await registry.resolveDescriptor('resolve-test');
    expect(desc.id).toBe('resolve-test');
    expect(desc.health.status).toBe('healthy');
    expect(desc.health.message).toBe('OK');

    const snap = await registry.resolveSnapshot();
    expect(snap.providers.length).toBe(1);
    expect(snap.providers[0]?.id).toBe('resolve-test');
    expect(snap.health['resolve-test']?.status).toBe('healthy');
  });

  it('11. enforces descriptor ID consistency and rejects metadata ID conflicts', () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'prov-real' });

    // Registration metadata with conflicting ID is rejected
    expect(() => registry.register(p, { id: 'prov-fake' })).toThrow(BrainRegistryError);

    // Matching metadata ID is accepted
    registry.register(p, { id: 'prov-real', displayName: 'Real Prov' });
    expect(registry.getProviderMetadata('prov-real').displayName).toBe('Real Prov');
  });

  it('12. enforces ModelCatalogProvider descriptor ID consistency', async () => {
    const registry = new BrainProviderRegistry();

    const badCatalogProvider: ModelCatalogProvider = {
      id: 'prov-real',
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
      health: async () => ({ status: 'healthy', checkedAt: Date.now() }),
      async *chat() {},
      getCatalog: async (): Promise<ModelCatalogSnapshot> => ({ providerId: 'prov-real', models: [], refreshedAt: Date.now() }),
      getDescriptor: (): ProviderDescriptor => ({
        id: 'prov-imposter', // ID MISMATCH!
        kind: 'model_provider',
        displayName: 'Imposter Provider',
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
        health: { status: 'healthy', checkedAt: Date.now() }
      })
    };

    registry.register(badCatalogProvider);
    await registry.health('prov-real');

    // Descriptors with mismatched IDs are rejected
    expect(() => registry.getDescriptor('prov-real')).toThrow(BrainRegistryError);
    try {
      registry.getDescriptor('prov-real');
    } catch (err) {
      expect((err as BrainRegistryError).code).toBe('invalid_provider_id');
    }
  });

  it('13. prevents registration metadata from overriding runtime identity, health, or capabilities', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({
      id: 'authoritative-prov',
      capabilities: { coding: true, vision: false },
      healthStatus: 'healthy'
    });

    // Pass metadata attempting to override identity, health, and capabilities
    registry.register(p, {
      displayName: 'Authoritative Provider'
    });

    await registry.health('authoritative-prov');
    const desc = registry.getDescriptor('authoritative-prov')!;

    // Identity belongs to BrainProvider.id
    expect(desc.id).toBe('authoritative-prov');
    // Capabilities belong to BrainProvider.getCapabilities()
    expect(desc.capabilities.coding).toBe(true);
    expect(desc.capabilities.vision).toBe(false);
    // Health belongs to registry dynamic health state
    expect(desc.health.status).toBe('healthy');
  });

  it('14. sanitizes thrown health probe error and prevents secret/path leakage', async () => {
    const registry = new BrainProviderRegistry();
    const sensitiveError = 'API_KEY=sk-proj-secret12345 C:\\Users\\Administrator\\keys.json connect ECONNREFUSED 127.0.0.1:8080';
    const p = createTestProvider({
      id: 'leak-test',
      throwOnHealth: true,
      throwMessage: sensitiveError
    });

    registry.register(p);

    const health = await registry.health('leak-test');
    expect(health.status).toBe('unavailable');
    // Sanitized: must NOT leak raw exception text
    expect(health.message).toBe('Provider health check failed.');
    expect(health.message).not.toContain('API_KEY');
    expect(health.message).not.toContain('secret12345');
    expect(health.message).not.toContain('C:\\Users');

    const desc = registry.getDescriptor('leak-test')!;
    expect(desc.health.message).toBe('Provider health check failed.');

    const snap = registry.getSnapshot();
    const json = JSON.stringify(snap);
    expect(json).not.toContain('secret12345');
    expect(json).not.toContain('API_KEY');
  });

  it('15. sanitizes health timeout error message', async () => {
    const registry = new BrainProviderRegistry({ healthTimeoutMs: 50 });
    const p = createTestProvider({
      id: 'timeout-test',
      healthDelayMs: 150
    });

    registry.register(p);

    const health = await registry.health('timeout-test');
    expect(health.status).toBe('unavailable');
    expect(health.message).toBe('Provider health check timed out.');
    expect(health.latencyMs).toBeGreaterThanOrEqual(50);
  });

  it('16. snapshot immutability prevents caller mutation of registry internal state', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'immut-test', healthStatus: 'healthy', healthMessage: 'original' });
    registry.register(p);
    await registry.health('immut-test');

    const snap1 = registry.getSnapshot();

    // Attempt mutation of snapshot
    expect(() => {
      (snap1.providers as any).push({ id: 'fake' });
    }).toThrow();

    expect(() => {
      (snap1.health as any)['immut-test'] = { status: 'unhealthy' };
    }).toThrow();

    expect(() => {
      (snap1.providers[0] as any).displayName = 'Hacked';
    }).toThrow();

    // Verify registry internal state is completely untouched
    const snap2 = registry.getSnapshot();
    expect(snap2.providers.length).toBe(1);
    expect(snap2.providers[0]?.id).toBe('immut-test');
    expect(snap2.health['immut-test']?.status).toBe('healthy');
    expect(snap2.health['immut-test']?.message).toBe('original');
  });

  it('17. verifies all 8 canonical health statuses', async () => {
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
      const p = createTestProvider({ id: `p-${status}`, healthStatus: status, healthMessage: `Status: ${status}` });
      registry.register(p);

      const health = await registry.health(`p-${status}`);
      expect(health.status).toBe(status);
      expect(health.message).toBe(`Status: ${status}`);
    }
  });

  it('18. normalizes legacy health aliases ready -> healthy and error -> unhealthy', async () => {
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

  it('19. proves health probe NEVER invokes AI generation or chat()', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'p-no-chat' });
    registry.register(p);

    await registry.health('p-no-chat');
    await registry.refreshHealth('p-no-chat');
    await registry.refreshAllHealth();

    expect(p.getChatCallCount()).toBe(0);
    expect(p.getHealthCallCount()).toBe(3);
  });

  it('20. guarantees single-flight concurrency for duplicate simultaneous health probes', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'p-single-flight', healthDelayMs: 50 });
    registry.register(p);

    const [h1, h2, h3] = await Promise.all([
      registry.refreshHealth('p-single-flight'),
      registry.refreshHealth('p-single-flight'),
      registry.refreshHealth('p-single-flight')
    ]);

    expect(h1.status).toBe('healthy');
    expect(h2.status).toBe('healthy');
    expect(h3.status).toBe('healthy');
    expect(p.getHealthCallCount()).toBe(1);
  });

  it('21. rejects stale results and does not resurrect health if provider unregistered during probe', async () => {
    const registry = new BrainProviderRegistry();
    const p = createTestProvider({ id: 'p-unreg-race', healthDelayMs: 100 });
    registry.register(p);

    const refreshPromise = registry.refreshHealth('p-unreg-race');
    expect(registry.unregister('p-unreg-race')).toBe(true);
    expect(registry.getHealth('p-unreg-race')).toBeUndefined();

    await refreshPromise;
    expect(registry.getHealth('p-unreg-race')).toBeUndefined();
    expect(registry.has('p-unreg-race')).toBe(false);
  });

  it('22. rejects stale results if provider was replaced during health probe', async () => {
    const registry = new BrainProviderRegistry();
    const p1 = createTestProvider({ id: 'p-race', healthStatus: 'healthy', healthMessage: 'p1', healthDelayMs: 100 });
    const p2 = createTestProvider({ id: 'p-race', healthStatus: 'degraded', healthMessage: 'p2', healthDelayMs: 0 });

    registry.register(p1);
    const p1Promise = registry.refreshHealth('p-race');

    registry.replace(p2);
    await p1Promise;

    expect(registry.getHealth('p-race')).toBeUndefined();

    const p2Health = await registry.refreshHealth('p-race');
    expect(p2Health.status).toBe('degraded');
    expect(p2Health.message).toBe('p2');
  });

  it('23. clears health cache on demand', async () => {
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

  it('24. correctly derives and freezes default accessClass for canonical providers', () => {
    const registry = new BrainProviderRegistry();
    const pSub = createTestProvider({ id: 'antigravity' });
    const pLocal = createTestProvider({ id: 'mock', capabilities: { local: true } });
    const pPaid = createTestProvider({ id: 'openai' });
    const pApi = createTestProvider({ id: 'custom-cloud' });

    registry.register(pSub);
    registry.register(pLocal);
    registry.register(pPaid);
    registry.register(pApi, { accessPath: 'official_api' });

    const metaSub = registry.getProviderMetadata('antigravity');
    expect(metaSub.accessClass).toBe('subscription');
    expect(Object.isFrozen(metaSub)).toBe(true);

    const metaLocal = registry.getProviderMetadata('mock');
    expect(metaLocal.accessClass).toBe('local');

    const metaPaid = registry.getProviderMetadata('openai');
    expect(metaPaid.accessClass).toBe('paid_api');

    const metaApi = registry.getProviderMetadata('custom-cloud');
    expect(metaApi.accessClass).toBe('paid_api');
  });

  it('25. honors explicit registration accessClass and billingClass metadata', () => {
    const registry = new BrainProviderRegistry();
    const p1 = createTestProvider({ id: 'p-explicit-sub' });
    const p2 = createTestProvider({ id: 'p-explicit-paid' });
    const p3 = createTestProvider({ id: 'p-billing-alias' });

    registry.register(p1, { accessClass: 'subscription' });
    registry.register(p2, { accessClass: 'paid_api' });
    registry.register(p3, { billingClass: 'local' });

    expect(registry.getProviderMetadata('p-explicit-sub').accessClass).toBe('subscription');
    expect(registry.getProviderMetadata('p-explicit-paid').accessClass).toBe('paid_api');
    expect(registry.getProviderMetadata('p-billing-alias').accessClass).toBe('local');
  });
});
