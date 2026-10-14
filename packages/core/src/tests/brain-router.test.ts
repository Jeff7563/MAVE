import { describe, it, expect } from 'vitest';
import type {
  BrainCapabilities,
  BrainProvider,
  ModelCatalogProvider,
  ModelCatalogSnapshot,
  ModelDescriptor,
  ProviderDescriptor,
  ProviderHealth,
  ProviderHealthStatus
} from '@mave/contracts';
import {
  RouteTelemetrySchema
} from '@mave/contracts';
import {
  BrainProviderRegistry,
  BrainRouter,
  BrainRegistryError,
  BrainRoutingError
} from '../brain/index.js';

interface StubProviderOptions {
  id: string;
  capabilities?: Partial<BrainCapabilities>;
  healthStatus?: ProviderHealthStatus;
  healthMessage?: string;
  onChatCalled?: () => void;
  throwOnHealth?: boolean;
  omitCatalog?: boolean;
  models?: ModelDescriptor[];
}

function createCatalog(providerId: string, models: ModelDescriptor[]): ModelCatalogSnapshot {
  return {
    providerId,
    models: models.map((m) => ({ ...m, providerId })),
    refreshedAt: Date.now()
  };
}

function createModel(
  overrides: Omit<Partial<ModelDescriptor>, 'capabilities'> & {
    id: string;
    capabilities?: Partial<BrainCapabilities>;
  }
): ModelDescriptor {
  const caps: BrainCapabilities = {
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
    ...overrides.capabilities
  };

  return {
    providerId: overrides.providerId ?? 'test-provider',
    displayName: overrides.displayName ?? overrides.id,
    status: overrides.status ?? 'available',
    latencyClass: overrides.latencyClass ?? 'interactive',
    qualityClass: overrides.qualityClass ?? 'fast',
    costClass: overrides.costClass ?? 'low',
    contextClass: overrides.contextClass ?? 'standard',
    contextWindowTokens: overrides.contextWindowTokens ?? 8192,
    privacyClass: overrides.privacyClass ?? 'standard_cloud',
    ...overrides,
    id: overrides.id,
    capabilities: caps
  };
}

function createStubProvider(options: StubProviderOptions): BrainProvider & {
  getChatCallCount: () => number;
  getCatalog?: () => Promise<ModelCatalogSnapshot>;
  getDescriptor?: () => ProviderDescriptor;
} {
  let chatCallCount = 0;
  const initialCapabilities: BrainCapabilities = {
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
  };

  const base = {
    id: options.id,
    getCapabilities(): BrainCapabilities {
      return { ...initialCapabilities };
    },
    async health(): Promise<ProviderHealth> {
      if (options.throwOnHealth) {
        throw new Error(`Health check simulation error for ${options.id}`);
      }
      return {
        status: options.healthStatus ?? 'healthy',
        message: options.healthMessage,
        checkedAt: Date.now()
      };
    },
    async *chat() {
      chatCallCount++;
      options.onChatCalled?.();
      yield {
        type: 'started' as const,
        requestId: 'stub-request',
        providerId: options.id
      };
    },
    getChatCallCount(): number {
      return chatCallCount;
    }
  };

  if (options.omitCatalog) {
    return base;
  }

  const models = options.models ?? [
    createModel({
      id: `${options.id}-default`,
      providerId: options.id,
      capabilities: { ...initialCapabilities }
    })
  ];

  return {
    ...base,
    async getCatalog(): Promise<ModelCatalogSnapshot> {
      return createCatalog(options.id, models);
    },
    getDescriptor(): ProviderDescriptor {
      return {
        id: options.id,
        kind: 'model_provider',
        displayName: options.id,
        accessPath: 'official_api',
        capabilities: { ...initialCapabilities },
        health: { status: options.healthStatus ?? 'healthy', checkedAt: Date.now() }
      };
    }
  };
}

function createStubCatalogProvider(options: {
  id: string;
  models?: ModelDescriptor[];
  capabilities?: Partial<BrainCapabilities>;
  healthStatus?: ProviderHealthStatus;
  healthMessage?: string;
  throwOnCatalog?: boolean;
  throwOnHealth?: boolean;
  catalogDelayMs?: number;
  healthDelayMs?: number;
  metadata?: Partial<ProviderDescriptor>;
}): BrainProvider & ModelCatalogProvider & { getChatCallCount: () => number } {
  const stub = createStubProvider({
    ...options,
    capabilities: {
      streaming: true,
      fastChat: true,
      ...options.capabilities
    }
  });
  const models = options.models ?? [];
  return {
    ...stub,
    async health(): Promise<ProviderHealth> {
      if (options.healthDelayMs) {
        await new Promise((r) => setTimeout(r, options.healthDelayMs));
      }
      return stub.health();
    },
    async getCatalog(): Promise<ModelCatalogSnapshot> {
      if (options.catalogDelayMs) {
        await new Promise((r) => setTimeout(r, options.catalogDelayMs));
      }
      if (options.throwOnCatalog) {
        throw new Error(`Catalog simulation error for ${options.id}`);
      }
      return createCatalog(options.id, models);
    },
    getDescriptor(): ProviderDescriptor {
      return {
        id: options.id,
        kind: 'model_provider',
        displayName: options.id,
        accessPath: 'official_api',
        capabilities: stub.getCapabilities(),
        health: { status: options.healthStatus ?? 'healthy', checkedAt: Date.now() },
        ...options.metadata
      };
    }
  };
}

function createStubAgentProvider(options?: {
  id?: string;
  capabilities?: Partial<BrainCapabilities>;
  healthStatus?: ProviderHealthStatus;
}): BrainProvider & { getChatCallCount: () => number } {
  return createStubProvider({
    id: options?.id ?? 'antigravity',
    omitCatalog: true,
    capabilities: {
      streaming: true,
      coding: true,
      toolUse: true,
      reasoning: true,
      ...options?.capabilities
    },
    healthStatus: options?.healthStatus ?? 'healthy'
  });
}

describe('BrainProviderRegistry', () => {
  it('1. registers a provider and retrieves it by id', () => {
    const registry = new BrainProviderRegistry();
    const provider = createStubProvider({ id: 'mock-1' });

    registry.register(provider);

    expect(registry.get('mock-1')).toBe(provider);
    expect(registry.get(' mock-1 ')).toBe(provider);
    expect(registry.get('non-existent')).toBeUndefined();
  });

  it('2. lists registered providers in deterministic insertion order', () => {
    const registry = new BrainProviderRegistry();
    const p1 = createStubProvider({ id: 'provider-alpha' });
    const p2 = createStubProvider({ id: 'provider-beta' });
    const p3 = createStubProvider({ id: 'provider-gamma' });

    registry.register(p1);
    registry.register(p2);
    registry.register(p3);

    const list = registry.list();
    expect(list.length).toBe(3);
    expect(list[0]!.id).toBe('provider-alpha');
    expect(list[1]!.id).toBe('provider-beta');
    expect(list[2]!.id).toBe('provider-gamma');
  });

  it('3. checks provider existence with has()', () => {
    const registry = new BrainProviderRegistry();
    const provider = createStubProvider({ id: 'test-p' });

    expect(registry.has('test-p')).toBe(false);
    registry.register(provider);
    expect(registry.has('test-p')).toBe(true);
    expect(registry.has('other')).toBe(false);
  });

  it('4. requires provider and throws BrainRegistryError if missing', () => {
    const registry = new BrainProviderRegistry();
    const provider = createStubProvider({ id: 'present' });
    registry.register(provider);

    expect(registry.require('present')).toBe(provider);

    expect(() => registry.require('missing')).toThrow(BrainRegistryError);
    try {
      registry.require('missing');
    } catch (err) {
      const regErr = err as BrainRegistryError;
      expect(regErr.code).toBe('provider_not_found');
    }
  });

  it('5. rejects duplicate provider registration without silent overwrite', () => {
    const registry = new BrainProviderRegistry();
    const p1 = createStubProvider({ id: 'duplicate-id' });
    const p2 = createStubProvider({ id: 'duplicate-id' });

    registry.register(p1);

    expect(() => registry.register(p2)).toThrow(BrainRegistryError);
    try {
      registry.register(p2);
    } catch (err) {
      const regErr = err as BrainRegistryError;
      expect(regErr.code).toBe('duplicate_provider');
    }

    expect(registry.get('duplicate-id')).toBe(p1);
  });

  it('6. unregisters a provider correctly', () => {
    const registry = new BrainProviderRegistry();
    const provider = createStubProvider({ id: 'to-remove' });
    registry.register(provider);

    expect(registry.has('to-remove')).toBe(true);
    expect(registry.unregister('to-remove')).toBe(true);
    expect(registry.has('to-remove')).toBe(false);
    expect(registry.unregister('to-remove')).toBe(false);
  });

  it('7. delegates health check to provider', async () => {
    const registry = new BrainProviderRegistry();
    const provider = createStubProvider({
      id: 'health-check',
      healthStatus: 'healthy',
      healthMessage: 'Service operational'
    });
    registry.register(provider);

    const health = await registry.health('health-check');
    expect(health.status).toBe('healthy');
    expect(health.message).toBe('Service operational');

    await expect(registry.health('not-registered')).rejects.toThrow(BrainRegistryError);
  });

  it('8. rejects empty or invalid provider ids', () => {
    const registry = new BrainProviderRegistry();

    expect(() => registry.register(createStubProvider({ id: '' }))).toThrow(BrainRegistryError);
    expect(() => registry.register(createStubProvider({ id: '   ' }))).toThrow(BrainRegistryError);

    try {
      registry.register(createStubProvider({ id: '  ' }));
    } catch (err) {
      const regErr = err as BrainRegistryError;
      expect(regErr.code).toBe('invalid_provider_id');
    }
  });

  it('9. exposes provider capabilities without mutating them', () => {
    const registry = new BrainProviderRegistry();
    const provider = createStubProvider({
      id: 'caps-test',
      capabilities: { fastChat: true, coding: true }
    });
    registry.register(provider);

    const caps1 = registry.getCapabilities('caps-test');
    expect(caps1.fastChat).toBe(true);
    expect(caps1.coding).toBe(true);
    expect(caps1.reasoning).toBe(false);

    // Verify mutating returned object does not affect provider
    caps1.reasoning = true;
    const caps2 = registry.getCapabilities('caps-test');
    expect(caps2.reasoning).toBe(false);
  });
});

describe('BrainRouter', () => {
  it('1. selects default provider when healthy', async () => {
    const registry = new BrainProviderRegistry();
    const primary = createStubProvider({ id: 'mock-primary', healthStatus: 'healthy' });
    registry.register(primary);

    const router = new BrainRouter(registry, { defaultProvider: 'mock-primary' });
    const decision = await router.route();

    expect(decision.providerId).toBe('mock-primary');
    expect(decision.provider).toBe(primary);
    expect(decision.fallbackUsed).toBe(false);
    expect(decision.attemptedProviderIds).toEqual(['mock-primary']);
    expect(decision.reason).toContain("Selected default provider 'mock-primary' (healthy)");
  });

  it('2. overrides default provider when preferred provider is explicitly specified', async () => {
    const registry = new BrainProviderRegistry();
    const primary = createStubProvider({ id: 'mock-primary', healthStatus: 'healthy' });
    const preferred = createStubProvider({ id: 'mock-preferred', healthStatus: 'healthy' });
    registry.register(primary);
    registry.register(preferred);

    const router = new BrainRouter(registry, { defaultProvider: 'mock-primary' });
    const decision = await router.route({ preferredProviderId: 'mock-preferred' });

    expect(decision.providerId).toBe('mock-preferred');
    expect(decision.provider).toBe(preferred);
    expect(decision.fallbackUsed).toBe(false);
    expect(decision.attemptedProviderIds).toEqual(['mock-preferred']);
    expect(decision.reason).toContain("Selected preferred provider 'mock-preferred' (healthy)");
  });

  it('3. selects first configured fallback when default is unavailable (unhealthy)', async () => {
    const registry = new BrainProviderRegistry();
    const primary = createStubProvider({ id: 'mock-primary', healthStatus: 'unhealthy' });
    const secondary = createStubProvider({ id: 'mock-secondary', healthStatus: 'healthy' });
    registry.register(primary);
    registry.register(secondary);

    const router = new BrainRouter(registry, {
      defaultProvider: 'mock-primary',
      fallbackChain: ['mock-secondary']
    });
    const decision = await router.route();

    expect(decision.providerId).toBe('mock-secondary');
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.attemptedProviderIds).toEqual(['mock-primary', 'mock-secondary']);
  });

  it('4. strictly preserves fallback chain order', async () => {
    const registry = new BrainProviderRegistry();
    const primary = createStubProvider({ id: 'p1', healthStatus: 'unhealthy' });
    const fallback1 = createStubProvider({ id: 'fb-1', healthStatus: 'unhealthy' });
    const fallback2 = createStubProvider({ id: 'fb-2', healthStatus: 'healthy' });
    const fallback3 = createStubProvider({ id: 'fb-3', healthStatus: 'healthy' });
    registry.register(primary);
    registry.register(fallback1);
    registry.register(fallback2);
    registry.register(fallback3);

    const router = new BrainRouter(registry, {
      defaultProvider: 'p1',
      fallbackChain: ['fb-1', 'fb-2', 'fb-3']
    });
    const decision = await router.route();

    expect(decision.providerId).toBe('fb-2');
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.attemptedProviderIds).toEqual(['p1', 'fb-1', 'fb-2']);
  });

  it('5. skips unconfigured providers', async () => {
    const registry = new BrainProviderRegistry();
    const primary = createStubProvider({ id: 'primary', healthStatus: 'unconfigured' });
    const secondary = createStubProvider({ id: 'secondary', healthStatus: 'healthy' });
    registry.register(primary);
    registry.register(secondary);

    const router = new BrainRouter(registry, {
      defaultProvider: 'primary',
      fallbackChain: ['secondary']
    });
    const decision = await router.route();

    expect(decision.providerId).toBe('secondary');
    expect(decision.attemptedProviderIds).toEqual(['primary', 'secondary']);
  });

  it('6. degraded provider policy: selects healthy fallback over degraded primary', async () => {
    const registry = new BrainProviderRegistry();
    const primary = createStubProvider({ id: 'p-degraded', healthStatus: 'degraded' });
    const secondary = createStubProvider({ id: 'p-healthy', healthStatus: 'healthy' });
    registry.register(primary);
    registry.register(secondary);

    const router = new BrainRouter(registry, {
      defaultProvider: 'p-degraded',
      fallbackChain: ['p-healthy']
    });
    const decision = await router.route();

    expect(decision.providerId).toBe('p-healthy');
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.attemptedProviderIds).toEqual(['p-degraded', 'p-healthy']);
    expect(decision.reason).toContain("over degraded primary 'p-degraded'");
  });

  it('7. degraded provider policy: uses degraded primary when no healthy fallback exists', async () => {
    const registry = new BrainProviderRegistry();
    const primary = createStubProvider({ id: 'p-degraded', healthStatus: 'degraded' });
    const secondary = createStubProvider({ id: 'p-unhealthy', healthStatus: 'unhealthy' });
    const tertiary = createStubProvider({ id: 'p-degraded-2', healthStatus: 'degraded' });
    registry.register(primary);
    registry.register(secondary);
    registry.register(tertiary);

    const router = new BrainRouter(registry, {
      defaultProvider: 'p-degraded',
      fallbackChain: ['p-unhealthy', 'p-degraded-2']
    });
    const decision = await router.route();

    expect(decision.providerId).toBe('p-degraded');
    expect(decision.fallbackUsed).toBe(false);
    expect(decision.attemptedProviderIds).toEqual(['p-degraded', 'p-unhealthy', 'p-degraded-2']);
    expect(decision.reason).toContain('Selected degraded primary provider');
  });

  it('8. degraded provider policy: uses first eligible degraded fallback if primary is unhealthy and no healthy fallback exists', async () => {
    const registry = new BrainProviderRegistry();
    const primary = createStubProvider({ id: 'p-unhealthy', healthStatus: 'unhealthy' });
    const secondary = createStubProvider({ id: 'p-degraded', healthStatus: 'degraded' });
    const tertiary = createStubProvider({ id: 'p-degraded-2', healthStatus: 'degraded' });
    registry.register(primary);
    registry.register(secondary);
    registry.register(tertiary);

    const router = new BrainRouter(registry, {
      defaultProvider: 'p-unhealthy',
      fallbackChain: ['p-degraded', 'p-degraded-2']
    });
    const decision = await router.route();

    expect(decision.providerId).toBe('p-degraded');
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.attemptedProviderIds).toEqual(['p-unhealthy', 'p-degraded', 'p-degraded-2']);
  });

  it('9. honors required capabilities and skips providers missing them', async () => {
    const registry = new BrainProviderRegistry();
    const standardProvider = createStubProvider({
      id: 'standard',
      capabilities: { streaming: true, reasoning: false },
      healthStatus: 'healthy'
    });
    const reasoningProvider = createStubProvider({
      id: 'reasoner',
      capabilities: { streaming: true, reasoning: true },
      healthStatus: 'healthy'
    });
    registry.register(standardProvider);
    registry.register(reasoningProvider);

    const router = new BrainRouter(registry, {
      defaultProvider: 'standard',
      fallbackChain: ['reasoner']
    });

    const decision = await router.route({
      requiredCapabilities: { reasoning: true }
    });

    expect(decision.providerId).toBe('reasoner');
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.attemptedProviderIds).toEqual(['standard', 'reasoner']);
  });

  it('10. deduplicates candidate IDs and attempts each candidate only once', async () => {
    const registry = new BrainProviderRegistry();
    let healthCallCount = 0;
    const provider = createStubProvider({ id: 'mock-single' });
    const originalHealth = provider.health.bind(provider);
    provider.health = async () => {
      healthCallCount++;
      return originalHealth();
    };
    registry.register(provider);

    const router = new BrainRouter(registry, {
      defaultProvider: 'mock-single',
      fallbackChain: ['mock-single', 'mock-single']
    });

    const decision = await router.route({
      preferredProviderId: 'mock-single',
      fallbackChain: ['mock-single']
    });

    expect(decision.providerId).toBe('mock-single');
    expect(decision.attemptedProviderIds).toEqual(['mock-single']);
    expect(healthCallCount).toBe(1);
  });

  it('11. skips unregistered candidates in fallback chain safely', async () => {
    const registry = new BrainProviderRegistry();
    const fallbackProvider = createStubProvider({ id: 'available', healthStatus: 'healthy' });
    registry.register(fallbackProvider);

    const router = new BrainRouter(registry, {
      defaultProvider: 'unregistered-primary',
      fallbackChain: ['unregistered-secondary', 'available']
    });

    const decision = await router.route();
    expect(decision.providerId).toBe('available');
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.attemptedProviderIds).toEqual([
      'unregistered-primary',
      'unregistered-secondary',
      'available'
    ]);
  });

  it('12. throws deterministic BrainRoutingError when no candidate is registered', async () => {
    const registry = new BrainProviderRegistry();
    const router = new BrainRouter(registry, {
      defaultProvider: 'ghost-1',
      fallbackChain: ['ghost-2']
    });

    await expect(router.route()).rejects.toThrow(BrainRoutingError);
    try {
      await router.route();
    } catch (err) {
      const routingErr = err as BrainRoutingError;
      expect(routingErr.code).toBe('provider_not_found');
      expect(routingErr.attemptedProviderIds).toEqual(['ghost-1', 'ghost-2']);
    }
  });

  it('13. throws capability_not_supported when registered candidates lack required capabilities', async () => {
    const registry = new BrainProviderRegistry();
    const p1 = createStubProvider({
      id: 'p1',
      capabilities: { coding: false },
      healthStatus: 'healthy'
    });
    registry.register(p1);

    const router = new BrainRouter(registry, { defaultProvider: 'p1' });

    try {
      await router.route({ requiredCapabilities: { coding: true } });
      expect.fail('Should have thrown BrainRoutingError');
    } catch (err) {
      const routingErr = err as BrainRoutingError;
      expect(routingErr.code).toBe('capability_not_supported');
      expect(routingErr.attemptedProviderIds).toEqual(['p1']);
    }
  });

  it('14. throws no_healthy_provider when all candidates are unhealthy or unconfigured', async () => {
    const registry = new BrainProviderRegistry();
    const p1 = createStubProvider({ id: 'p1', healthStatus: 'unhealthy' });
    const p2 = createStubProvider({ id: 'p2', healthStatus: 'unconfigured' });
    registry.register(p1);
    registry.register(p2);

    const router = new BrainRouter(registry, {
      defaultProvider: 'p1',
      fallbackChain: ['p2']
    });

    try {
      await router.route();
      expect.fail('Should have thrown BrainRoutingError');
    } catch (err) {
      const routingErr = err as BrainRoutingError;
      expect(routingErr.code).toBe('no_healthy_provider');
      expect(routingErr.attemptedProviderIds).toEqual(['p1', 'p2']);
    }
  });

  it('15. throws provider_not_found if no candidate was configured or requested', async () => {
    const registry = new BrainProviderRegistry();
    const router = new BrainRouter(registry);

    await expect(router.route()).rejects.toThrow(BrainRoutingError);
    try {
      await router.route();
    } catch (err) {
      const routingErr = err as BrainRoutingError;
      expect(routingErr.code).toBe('provider_not_found');
      expect(routingErr.attemptedProviderIds).toEqual([]);
    }
  });

  it('16. router NEVER calls provider.chat()', async () => {
    const registry = new BrainProviderRegistry();
    const p1 = createStubProvider({ id: 'p1', healthStatus: 'healthy' });
    const p2 = createStubProvider({ id: 'p2', healthStatus: 'healthy' });
    registry.register(p1);
    registry.register(p2);

    const router = new BrainRouter(registry, {
      defaultProvider: 'p1',
      fallbackChain: ['p2']
    });

    const decision = await router.route();
    expect(decision.providerId).toBe('p1');

    // Confirm chat was never invoked on any provider
    expect(p1.getChatCallCount()).toBe(0);
    expect(p2.getChatCallCount()).toBe(0);
  });

  it('17. concurrent routing calls do not corrupt registry or router state', async () => {
    const registry = new BrainProviderRegistry();
    const primary = createStubProvider({ id: 'concurrent-1', healthStatus: 'healthy' });
    const secondary = createStubProvider({ id: 'concurrent-2', healthStatus: 'healthy' });
    registry.register(primary);
    registry.register(secondary);

    const router = new BrainRouter(registry, {
      defaultProvider: 'concurrent-1',
      fallbackChain: ['concurrent-2']
    });

    // Run 50 concurrent routing requests
    const promises = Array.from({ length: 50 }, (_, i) =>
      i % 2 === 0
        ? router.route()
        : router.route({ preferredProviderId: 'concurrent-2' })
    );

    const results = await Promise.all(promises);

    expect(results.length).toBe(50);
    for (let i = 0; i < 50; i++) {
      const res = results[i]!;
      if (i % 2 === 0) {
        expect(res.providerId).toBe('concurrent-1');
        expect(res.fallbackUsed).toBe(false);
      } else {
        expect(res.providerId).toBe('concurrent-2');
        expect(res.fallbackUsed).toBe(false);
      }
    }
  });

  it('18. accepts configuration options object and preserves timeoutMs compatibility', async () => {
    const registry = new BrainProviderRegistry();
    const provider = createStubProvider({ id: 'options-provider', healthStatus: 'healthy' });
    registry.register(provider);

    // Constructor via options object (matches BrainConfig shape)
    const router = new BrainRouter({
      registry,
      defaultProvider: 'options-provider',
      fallbackChain: [],
      timeoutMs: 30000
    });

    const decision = await router.route();
    expect(decision.providerId).toBe('options-provider');
    expect(decision.fallbackUsed).toBe(false);
  });

  it('19. handles unexpected provider health check exception as unusable candidate', async () => {
    const registry = new BrainProviderRegistry();
    const throwingProvider = createStubProvider({
      id: 'thrower',
      throwOnHealth: true
    });
    const backupProvider = createStubProvider({
      id: 'backup',
      healthStatus: 'healthy'
    });
    registry.register(throwingProvider);
    registry.register(backupProvider);

    const router = new BrainRouter(registry, {
      defaultProvider: 'thrower',
      fallbackChain: ['backup']
    });

    const decision = await router.route();
    expect(decision.providerId).toBe('backup');
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.attemptedProviderIds).toEqual(['thrower', 'backup']);
  });

  describe('F1.4 Two-Stage Intelligence Routing & Fallback', () => {
    it('1. healthy provider + eligible model (direct model route)', async () => {
      const registry = new BrainProviderRegistry();
      const model = createModel({
        id: 'fast-model',
        qualityClass: 'fast',
        latencyClass: 'interactive',
        capabilities: { streaming: true, fastChat: true }
      });
      const provider = createStubCatalogProvider({
        id: 'provider-a',
        models: [model],
        healthStatus: 'healthy',
        capabilities: { streaming: true, fastChat: true }
      });
      registry.register(provider);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-a'
      });

      const decision = await router.route({ profileId: 'fast_conversation' });
      expect(decision.providerId).toBe('provider-a');
      expect(decision.modelId).toBe('fast-model');
      expect(decision.model?.id).toBe('fast-model');
      expect(decision.fallbackUsed).toBe(false);
      expect(decision.routeReason).toBe('primary_default');
      expect(decision.telemetry?.routeAttempts).toBe(0);
      expect(decision.diagnostics?.providersEvaluated).toBe(1);
      expect(decision.diagnostics?.modelsEvaluated).toBe(1);
    });

    it('2. healthy provider + no eligible model in catalog falls back to next provider', async () => {
      const registry = new BrainProviderRegistry();
      const providerA = createStubCatalogProvider({
        id: 'provider-a',
        models: [],
        healthStatus: 'healthy',
        capabilities: { streaming: true, fastChat: true }
      });
      const modelB = createModel({
        id: 'model-b',
        qualityClass: 'fast',
        latencyClass: 'interactive',
        capabilities: { streaming: true, fastChat: true }
      });
      const providerB = createStubCatalogProvider({
        id: 'provider-b',
        models: [modelB],
        healthStatus: 'healthy',
        capabilities: { streaming: true, fastChat: true }
      });
      registry.register(providerA);
      registry.register(providerB);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-a',
        fallbackChain: ['provider-b']
      });

      const decision = await router.route({ profileId: 'fast_conversation' });
      expect(decision.providerId).toBe('provider-b');
      expect(decision.modelId).toBe('model-b');
      expect(decision.fallbackUsed).toBe(true);
      expect(decision.routeReason).toBe('fallback_healthy');
    });

    it('3. healthy provider throwing in getCatalog() falls back cleanly to next provider', async () => {
      const registry = new BrainProviderRegistry();
      const providerA = createStubCatalogProvider({
        id: 'provider-a',
        throwOnCatalog: true,
        healthStatus: 'healthy',
        capabilities: { streaming: true, fastChat: true }
      });
      const modelB = createModel({
        id: 'model-b',
        capabilities: { streaming: true, fastChat: true }
      });
      const providerB = createStubCatalogProvider({
        id: 'provider-b',
        models: [modelB],
        healthStatus: 'healthy',
        capabilities: { streaming: true, fastChat: true }
      });
      registry.register(providerA);
      registry.register(providerB);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-a',
        fallbackChain: ['provider-b']
      });

      const decision = await router.route({ profileId: 'fast_conversation' });
      expect(decision.providerId).toBe('provider-b');
      expect(decision.modelId).toBe('model-b');
      expect(decision.fallbackUsed).toBe(true);
    });

    it('4. degraded vs healthy provider ordering: healthy fallback beats degraded primary', async () => {
      const registry = new BrainProviderRegistry();
      const modelA = createModel({ id: 'mod-a' });
      const providerA = createStubCatalogProvider({
        id: 'provider-a',
        models: [modelA],
        healthStatus: 'degraded'
      });
      const modelB = createModel({ id: 'mod-b' });
      const providerB = createStubCatalogProvider({
        id: 'provider-b',
        models: [modelB],
        healthStatus: 'healthy'
      });
      registry.register(providerA);
      registry.register(providerB);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-a',
        fallbackChain: ['provider-b']
      });

      const decision = await router.route({ profileId: 'fast_conversation' });
      expect(decision.providerId).toBe('provider-b');
      expect(decision.fallbackUsed).toBe(true);
      expect(decision.routeReason).toBe('fallback_healthy');
    });

    it('5. all degraded candidates: selects first eligible degraded provider deterministically', async () => {
      const registry = new BrainProviderRegistry();
      const modelA = createModel({ id: 'mod-a' });
      const providerA = createStubCatalogProvider({
        id: 'provider-a',
        models: [modelA],
        healthStatus: 'degraded'
      });
      const modelB = createModel({ id: 'mod-b' });
      const providerB = createStubCatalogProvider({
        id: 'provider-b',
        models: [modelB],
        healthStatus: 'degraded'
      });
      registry.register(providerA);
      registry.register(providerB);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-a',
        fallbackChain: ['provider-b']
      });

      const decision = await router.route({ profileId: 'fast_conversation' });
      expect(decision.providerId).toBe('provider-a');
      expect(decision.modelId).toBe('mod-a');
      expect(decision.routeReason).toBe('fallback_degraded');
    });

    it('6. skips unhealthy, unconfigured, quota_limited, rate_limited, auth_error, unavailable providers', async () => {
      const registry = new BrainProviderRegistry();
      const statuses: ProviderHealthStatus[] = [
        'unhealthy',
        'unconfigured',
        'quota_limited',
        'rate_limited',
        'auth_error',
        'unavailable'
      ];
      for (const status of statuses) {
        const p = createStubCatalogProvider({
          id: `p-${status}`,
          models: [createModel({ id: `m-${status}` })],
          healthStatus: status
        });
        registry.register(p);
      }
      const healthyP = createStubCatalogProvider({
        id: 'p-healthy',
        models: [createModel({ id: 'm-healthy' })],
        healthStatus: 'healthy'
      });
      registry.register(healthyP);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'p-unhealthy',
        fallbackChain: [
          'p-unconfigured',
          'p-quota_limited',
          'p-rate_limited',
          'p-auth_error',
          'p-unavailable',
          'p-healthy'
        ]
      });

      const decision = await router.route({ profileId: 'fast_conversation' });
      expect(decision.providerId).toBe('p-healthy');
      expect(decision.modelId).toBe('m-healthy');
      expect(decision.fallbackUsed).toBe(true);
    });

    it('7. unprobed provider gets health resolved via registry.health()', async () => {
      const registry = new BrainProviderRegistry();
      const provider = createStubCatalogProvider({
        id: 'p-unprobed',
        models: [createModel({ id: 'm-unprobed' })],
        healthStatus: 'healthy'
      });
      registry.register(provider);
      expect(registry.getHealth('p-unprobed')).toBeUndefined();

      const router = new BrainRouter({
        registry,
        defaultProvider: 'p-unprobed'
      });

      const decision = await router.route({ profileId: 'fast_conversation' });
      expect(decision.providerId).toBe('p-unprobed');
      expect(decision.modelId).toBe('m-unprobed');
      expect(registry.getHealth('p-unprobed')?.status).toBe('healthy');
    });

    it('8. provider health probe failure does not crash routing if healthy fallback exists', async () => {
      const registry = new BrainProviderRegistry();
      const providerA = createStubCatalogProvider({
        id: 'p-throw',
        throwOnHealth: true
      });
      const providerB = createStubCatalogProvider({
        id: 'p-healthy',
        models: [createModel({ id: 'm-healthy' })],
        healthStatus: 'healthy'
      });
      registry.register(providerA);
      registry.register(providerB);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'p-throw',
        fallbackChain: ['p-healthy']
      });

      const decision = await router.route({ profileId: 'fast_conversation' });
      expect(decision.providerId).toBe('p-healthy');
      expect(decision.fallbackUsed).toBe(true);
    });

    it('9. direct model_provider without ModelCatalogProvider fails closed (no model-less route)', async () => {
      const registry = new BrainProviderRegistry();
      const legacyProvider = createStubProvider({
        id: 'legacy-p',
        omitCatalog: true,
        healthStatus: 'healthy',
        capabilities: { streaming: true, fastChat: true }
      });
      registry.register(legacyProvider, { kind: 'model_provider' });

      const router = new BrainRouter({
        registry,
        defaultProvider: 'legacy-p'
      });

      await expect(
        router.route({ profileId: 'fast_conversation' })
      ).rejects.toThrow(BrainRoutingError);
    });

    it('10. skips candidate when all models in catalog are unavailable or deprecated', async () => {
      const registry = new BrainProviderRegistry();
      const providerA = createStubCatalogProvider({
        id: 'p-all-unavail',
        models: [
          createModel({ id: 'm1', status: 'unavailable' }),
          createModel({ id: 'm2', status: 'deprecated' })
        ],
        healthStatus: 'healthy'
      });
      const providerB = createStubCatalogProvider({
        id: 'p-avail',
        models: [createModel({ id: 'm3', status: 'available' })],
        healthStatus: 'healthy'
      });
      registry.register(providerA);
      registry.register(providerB);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'p-all-unavail',
        fallbackChain: ['p-avail']
      });

      const decision = await router.route({ profileId: 'fast_conversation' });
      expect(decision.providerId).toBe('p-avail');
      expect(decision.modelId).toBe('m3');
      expect(decision.fallbackUsed).toBe(true);
    });

    it('11. automatic same-profile provider fallback preserves intent and selects compatible model', async () => {
      const registry = new BrainProviderRegistry();
      const providerA = createStubCatalogProvider({
        id: 'provider-a',
        models: [],
        healthStatus: 'healthy',
        capabilities: { reasoning: true }
      });
      const providerB = createStubCatalogProvider({
        id: 'provider-b',
        models: [createModel({ id: 'deep-mod', qualityClass: 'reasoning', capabilities: { reasoning: true } })],
        healthStatus: 'healthy',
        capabilities: { reasoning: true }
      });
      registry.register(providerA);
      registry.register(providerB);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-a',
        fallbackChain: ['provider-b']
      });

      const decision = await router.route({ profileId: 'deep_reasoning' });
      expect(decision.providerId).toBe('provider-b');
      expect(decision.modelId).toBe('deep-mod');
      expect(decision.fallbackUsed).toBe(true);
    });

    it('12. strict provider override fails closed without hopping to fallback provider', async () => {
      const registry = new BrainProviderRegistry();
      const providerA = createStubCatalogProvider({
        id: 'provider-a',
        models: [],
        healthStatus: 'healthy'
      });
      const providerB = createStubCatalogProvider({
        id: 'provider-b',
        models: [createModel({ id: 'mod-b' })],
        healthStatus: 'healthy'
      });
      registry.register(providerA);
      registry.register(providerB);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-a',
        fallbackChain: ['provider-b']
      });

      await expect(
        router.route({ preferredProviderId: 'provider-a', profileId: 'fast_conversation' })
      ).rejects.toThrow(BrainRoutingError);
    });

    it('13. permissive provider override (allowFallback: true) allows fallback to secondary provider', async () => {
      const registry = new BrainProviderRegistry();
      const providerA = createStubCatalogProvider({
        id: 'provider-a',
        models: [],
        healthStatus: 'healthy'
      });
      const providerB = createStubCatalogProvider({
        id: 'provider-b',
        models: [createModel({ id: 'mod-b' })],
        healthStatus: 'healthy'
      });
      registry.register(providerA);
      registry.register(providerB);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-a',
        fallbackChain: ['provider-b']
      });

      const decision = await router.route({
        preferredProviderId: 'provider-a',
        allowFallback: true,
        profileId: 'fast_conversation'
      });
      expect(decision.providerId).toBe('provider-b');
      expect(decision.fallbackUsed).toBe(true);
    });

    it('14. strict model override fails closed when model is missing', async () => {
      const registry = new BrainProviderRegistry();
      const providerA = createStubCatalogProvider({
        id: 'provider-a',
        models: [createModel({ id: 'mod-1' })],
        healthStatus: 'healthy'
      });
      registry.register(providerA);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-a'
      });

      await expect(
        router.route({ preferredModelId: 'missing-model' })
      ).rejects.toThrow(BrainRoutingError);
    });

    it('15. permissive model override (allowFallback: true) falls back to alternative model', async () => {
      const registry = new BrainProviderRegistry();
      const providerA = createStubCatalogProvider({
        id: 'provider-a',
        models: [createModel({ id: 'mod-alt' })],
        healthStatus: 'healthy'
      });
      registry.register(providerA);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-a'
      });

      const decision = await router.route({
        preferredModelId: 'missing-model',
        allowFallback: true,
        profileId: 'fast_conversation'
      });
      expect(decision.providerId).toBe('provider-a');
      expect(decision.modelId).toBe('mod-alt');
    });

    it('16. provider + model override mismatch fails closed', async () => {
      const registry = new BrainProviderRegistry();
      const providerA = createStubCatalogProvider({
        id: 'provider-a',
        models: [createModel({ id: 'mod-a' })],
        healthStatus: 'healthy'
      });
      const providerB = createStubCatalogProvider({
        id: 'provider-b',
        models: [createModel({ id: 'mod-b' })],
        healthStatus: 'healthy'
      });
      registry.register(providerA);
      registry.register(providerB);

      const router = new BrainRouter({ registry });

      await expect(
        router.route({
          preferredProviderId: 'provider-a',
          preferredModelId: 'mod-b'
        })
      ).rejects.toThrow(BrainRoutingError);
    });

    it('17. localOnly rejects cloud models and routes to local model', async () => {
      const registry = new BrainProviderRegistry();
      const providerCloud = createStubCatalogProvider({
        id: 'provider-cloud',
        models: [createModel({ id: 'cloud-mod', privacyClass: 'standard_cloud' })],
        healthStatus: 'healthy',
        capabilities: { local: false }
      });
      const providerLocal = createStubCatalogProvider({
        id: 'provider-local',
        models: [createModel({ id: 'local-mod', privacyClass: 'local_only', capabilities: { local: true } })],
        healthStatus: 'healthy',
        capabilities: { local: true }
      });
      registry.register(providerCloud);
      registry.register(providerLocal);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-cloud',
        fallbackChain: ['provider-local']
      });

      const decision = await router.route({ localOnly: true, profileId: 'fast_conversation' });
      expect(decision.providerId).toBe('provider-local');
      expect(decision.modelId).toBe('local-mod');
      expect(decision.routeReason).toBe('privacy_constraint');
    });

    it('18. localOnly fails closed with local_provider_unavailable if no local model exists', async () => {
      const registry = new BrainProviderRegistry();
      const providerCloud = createStubCatalogProvider({
        id: 'provider-cloud',
        models: [createModel({ id: 'cloud-mod', privacyClass: 'standard_cloud' })],
        healthStatus: 'healthy',
        capabilities: { local: false }
      });
      registry.register(providerCloud);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'provider-cloud'
      });

      try {
        await router.route({ localOnly: true });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).code).toBe('local_provider_unavailable');
      }
    });

    it('19. fast_conversation does NOT silently fall into agent runtime (throws fast_brain_unavailable)', async () => {
      const registry = new BrainProviderRegistry();
      const agent = createStubAgentProvider({ id: 'antigravity' });
      registry.register(agent, { kind: 'agent_runtime_provider' });

      const router = new BrainRouter({
        registry,
        defaultProvider: 'antigravity'
      });

      try {
        await router.route({ profileId: 'fast_conversation' });
        expect.unreachable('Should have thrown fast_brain_unavailable');
      } catch (err) {
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).code).toBe('fast_brain_unavailable');
      }
    });

    it('20. deep_reasoning does NOT silently fall into agent runtime (throws profile_unavailable)', async () => {
      const registry = new BrainProviderRegistry();
      const agent = createStubAgentProvider({ id: 'antigravity' });
      registry.register(agent, { kind: 'agent_runtime_provider' });

      const router = new BrainRouter({
        registry,
        defaultProvider: 'antigravity'
      });

      try {
        await router.route({ profileId: 'deep_reasoning' });
        expect.unreachable('Should have thrown profile_unavailable');
      } catch (err) {
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).code).toBe('profile_unavailable');
      }
    });

    it('21. agent_work can route Antigravity provider without fake modelId', async () => {
      const registry = new BrainProviderRegistry();
      const agent = createStubAgentProvider({
        id: 'antigravity',
        capabilities: { coding: true, toolUse: true }
      });
      registry.register(agent, { kind: 'agent_runtime_provider' });

      const router = new BrainRouter({
        registry,
        defaultProvider: 'antigravity'
      });

      const decision = await router.route({ profileId: 'agent_work' });
      expect(decision.providerId).toBe('antigravity');
      expect(decision.modelId).toBeUndefined();
      expect(decision.model).toBeUndefined();
      expect(decision.fallbackUsed).toBe(false);
    });

    it('22. maximum provider budget stops evaluation after budget is reached', async () => {
      const registry = new BrainProviderRegistry();
      const p1 = createStubCatalogProvider({ id: 'p1', healthStatus: 'unhealthy' });
      const p2 = createStubCatalogProvider({ id: 'p2', healthStatus: 'unhealthy' });
      const p3 = createStubCatalogProvider({
        id: 'p3',
        healthStatus: 'healthy',
        models: [createModel({ id: 'm3' })]
      });
      registry.register(p1);
      registry.register(p2);
      registry.register(p3);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'p1',
        fallbackChain: ['p2', 'p3'],
        maxProviderBudget: 2
      });

      try {
        await router.route();
        expect.unreachable('Should have failed due to maxProviderBudget');
      } catch (err) {
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).attemptedProviderIds).toEqual(['p1', 'p2']);
        expect((err as BrainRoutingError).attemptedProviderIds).not.toContain('p3');
      }
    });

    it('23. deterministic candidate ordering strictly follows chain priority', async () => {
      const registry = new BrainProviderRegistry();
      const p1 = createStubCatalogProvider({ id: 'p1', healthStatus: 'unhealthy' });
      const p2 = createStubCatalogProvider({ id: 'p2', healthStatus: 'unhealthy' });
      const p3 = createStubCatalogProvider({ id: 'p3', healthStatus: 'unhealthy' });
      registry.register(p1);
      registry.register(p2);
      registry.register(p3);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'p1',
        fallbackChain: ['p3', 'p2']
      });

      try {
        await router.route();
        expect.unreachable('Should have failed');
      } catch (err) {
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).attemptedProviderIds).toEqual(['p1', 'p3', 'p2']);
      }
    });

    it('24. routing timeout throws routing_timeout when elapsed time exceeds budget', async () => {
      const registry = new BrainProviderRegistry();
      const slowP = createStubCatalogProvider({
        id: 'slow-p',
        healthDelayMs: 60,
        models: [createModel({ id: 'm-slow' })]
      });
      registry.register(slowP);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'slow-p',
        timeoutMs: 20
      });

      try {
        await router.route();
        expect.unreachable('Should have timed out');
      } catch (err) {
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).code).toBe('routing_timeout');
      }
    });

    it('25. user cancellation abort signal throws cancelled immediately', async () => {
      const registry = new BrainProviderRegistry();
      const p = createStubCatalogProvider({
        id: 'p-1',
        models: [createModel({ id: 'm-1' })]
      });
      registry.register(p);

      const router = new BrainRouter({ registry, defaultProvider: 'p-1' });
      const controller = new AbortController();
      controller.abort('User stopped request');

      try {
        await router.route({ signal: controller.signal });
        expect.unreachable('Should have cancelled');
      } catch (err) {
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).code).toBe('cancelled');
      }
    });

    it('26. detects provider lifecycle modification / unregistration race', async () => {
      const registry = new BrainProviderRegistry();
      let unregisterCalled = false;
      const sneakyP = createStubCatalogProvider({
        id: 'sneaky-p',
        models: [createModel({ id: 'm-sneaky' })]
      });
      const originalGetCatalog = sneakyP.getCatalog.bind(sneakyP);
      sneakyP.getCatalog = async () => {
        registry.unregister('sneaky-p');
        unregisterCalled = true;
        return originalGetCatalog();
      };

      registry.register(sneakyP);

      const router = new BrainRouter({ registry, defaultProvider: 'sneaky-p' });

      try {
        await router.route();
        expect.unreachable('Should have detected lifecycle mutation');
      } catch (err) {
        expect(unregisterCalled).toBe(true);
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).code).toBe('provider_unavailable');
      }
    });

    it('27. route telemetry is populated with canonical fields and separate diagnostics', async () => {
      const registry = new BrainProviderRegistry();
      const p = createStubCatalogProvider({
        id: 'provider-telemetry',
        models: [
          createModel({ id: 'm1' }),
          createModel({ id: 'm2' })
        ]
      });
      registry.register(p);

      const router = new BrainRouter({ registry, defaultProvider: 'provider-telemetry' });
      const decision = await router.route({ profileId: 'fast_conversation' });

      // Canonical telemetry checks
      expect(decision.telemetry).toBeDefined();
      expect(decision.telemetry?.selectedProviderId).toBe('provider-telemetry');
      expect(decision.telemetry?.selectedModelId).toBe('m1');
      expect(decision.telemetry?.profileId).toBe('fast_conversation');
      expect(decision.telemetry?.fallbackUsed).toBe(false);
      expect(decision.telemetry?.attemptedProviderIds).toEqual(['provider-telemetry']);
      expect(decision.telemetry?.attemptedModelIds).toEqual(['m1']);
      // Pre-execution routing evaluation: 0 actual invocations
      expect(decision.telemetry?.routeAttempts).toBe(0);
      expect(decision.routeAttempts).toBe(0);

      // Validate that canonical telemetry strictly conforms to RouteTelemetrySchema (no extra properties)
      const parseResult = RouteTelemetrySchema.safeParse(decision.telemetry);
      expect(parseResult.success).toBe(true);

      // Separate internal diagnostics
      expect(decision.diagnostics).toBeDefined();
      expect(decision.diagnostics?.routingTimeMs).toBeGreaterThanOrEqual(0);
      expect(decision.diagnostics?.providersEvaluated).toBe(1);
      expect(decision.diagnostics?.modelsEvaluated).toBe(2);

      const jsonStr = JSON.stringify(decision);
      expect(jsonStr).not.toContain('api_key');
      expect(jsonStr).not.toContain('secret');
    });

    it('28. direct model provider without ModelCatalogProvider fails closed (no model-less direct route)', async () => {
      const registry = new BrainProviderRegistry();
      // Registered with kind: model_provider, but omitCatalog: true
      const rawP = createStubProvider({
        id: 'model-raw',
        omitCatalog: true,
        healthStatus: 'healthy'
      });
      registry.register(rawP, { kind: 'model_provider' });

      const router = new BrainRouter({ registry, defaultProvider: 'model-raw' });

      // Cannot be routed because model_provider MUST implement ModelCatalogProvider
      await expect(router.route()).rejects.toThrow(BrainRoutingError);
    });

    it('29. direct model route ALWAYS contains model and modelId', async () => {
      const registry = new BrainProviderRegistry();
      const p = createStubCatalogProvider({
        id: 'direct-p',
        models: [createModel({ id: 'model-exact' })]
      });
      registry.register(p);

      const router = new BrainRouter({ registry, defaultProvider: 'direct-p' });
      const decision = await router.route({ profileId: 'fast_conversation' });

      expect(decision.providerId).toBe('direct-p');
      expect(decision.model).toBeDefined();
      expect(decision.model?.id).toBe('model-exact');
      expect(decision.modelId).toBe('model-exact');
    });

    it('30. agent runtime provider is model-less (modelId = undefined, no fake descriptor)', async () => {
      const registry = new BrainProviderRegistry();
      const agent = createStubAgentProvider({ id: 'antigravity' });
      registry.register(agent, { kind: 'agent_runtime_provider' });

      const router = new BrainRouter({ registry, defaultProvider: 'antigravity' });
      const decision = await router.route({ profileId: 'agent_work' });

      expect(decision.providerId).toBe('antigravity');
      expect(decision.model).toBeUndefined();
      expect(decision.modelId).toBeUndefined();
    });

    it('31. knowledge provider is NEVER returned as final Brain provider', async () => {
      const registry = new BrainProviderRegistry();
      const kp = createStubProvider({
        id: 'knowledge-source',
        capabilities: { streaming: true, fastChat: true, webResearch: true }
      });
      // Register with kind: knowledge_provider
      registry.register(kp, { kind: 'knowledge_provider' });

      const router = new BrainRouter({ registry, defaultProvider: 'knowledge-source' });

      await expect(router.route()).rejects.toThrow(BrainRoutingError);
      try {
        await router.route();
      } catch (err) {
        expect(err).toBeInstanceOf(BrainRoutingError);
      }
    });

    it('32. agent_work selects agent_runtime_provider over model_provider with coding: true', async () => {
      const registry = new BrainProviderRegistry();
      // Model provider with coding: true
      const modelCoding = createStubCatalogProvider({
        id: 'model-coder',
        capabilities: { coding: true, streaming: true, fastChat: true },
        models: [createModel({ id: 'code-model', capabilities: { coding: true } })]
      });
      // Agent runtime provider with coding: true
      const agentProv = createStubAgentProvider({
        id: 'agent-coder',
        capabilities: { coding: true }
      });

      registry.register(modelCoding, { kind: 'model_provider' });
      registry.register(agentProv, { kind: 'agent_runtime_provider' });

      const router = new BrainRouter({
        registry,
        fallbackChain: ['model-coder', 'agent-coder']
      });

      const decision = await router.route({ profileId: 'agent_work' });
      // MUST select agent-coder, NOT model-coder
      expect(decision.providerId).toBe('agent-coder');
      expect(decision.modelId).toBeUndefined();
    });

    it('33. fast_conversation and deep_reasoning do NOT select agent_runtime_provider', async () => {
      const registry = new BrainProviderRegistry();
      const agent = createStubAgentProvider({ id: 'antigravity' });
      registry.register(agent, { kind: 'agent_runtime_provider' });

      const router = new BrainRouter({ registry, defaultProvider: 'antigravity' });

      await expect(router.route({ profileId: 'fast_conversation' })).rejects.toThrow(BrainRoutingError);
      await expect(router.route({ profileId: 'deep_reasoning' })).rejects.toThrow(BrainRoutingError);
    });

    it('34. global routing deadline races slow health probe without waiting for inner timeout', async () => {
      const registry = new BrainProviderRegistry();
      const slowHealthProvider = createStubCatalogProvider({
        id: 'slow-health',
        healthDelayMs: 200,
        models: [createModel({ id: 'm-slow' })]
      });
      registry.register(slowHealthProvider);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'slow-health',
        timeoutMs: 30
      });

      const start = Date.now();
      try {
        await router.route();
        expect.unreachable('Should have timed out');
      } catch (err) {
        const elapsed = Date.now() - start;
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).code).toBe('routing_timeout');
        // Must reject near the 30ms budget, well before the 200ms healthDelayMs
        expect(elapsed).toBeLessThan(150);
      }
    });

    it('35. global routing deadline races slow catalog fetch without waiting for inner timeout', async () => {
      const registry = new BrainProviderRegistry();
      const slowCatalogProvider = createStubCatalogProvider({
        id: 'slow-cat',
        catalogDelayMs: 200,
        models: [createModel({ id: 'm-slow-cat' })]
      });
      registry.register(slowCatalogProvider);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'slow-cat',
        timeoutMs: 30
      });

      const start = Date.now();
      try {
        await router.route();
        expect.unreachable('Should have timed out');
      } catch (err) {
        const elapsed = Date.now() - start;
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).code).toBe('routing_timeout');
        expect(elapsed).toBeLessThan(150);
      }
    });

    it('36. abort signal cancels pending health probe promptly and prevents fallback', async () => {
      const registry = new BrainProviderRegistry();
      let fallbackEvaluated = false;

      const slowHealthP = createStubCatalogProvider({
        id: 'p-hangs',
        healthDelayMs: 150,
        models: [createModel({ id: 'm-hangs' })]
      });
      const fallbackP = createStubCatalogProvider({
        id: 'p-fallback',
        models: [createModel({ id: 'm-fb' })]
      });
      const originalHealth = fallbackP.health.bind(fallbackP);
      fallbackP.health = async () => {
        fallbackEvaluated = true;
        return originalHealth();
      };

      registry.register(slowHealthP);
      registry.register(fallbackP);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'p-hangs',
        fallbackChain: ['p-fallback'],
        timeoutMs: 2000
      });

      const controller = new AbortController();
      setTimeout(() => controller.abort('User cancellation'), 20);

      try {
        await router.route({ signal: controller.signal });
        expect.unreachable('Should have been cancelled');
      } catch (err) {
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).code).toBe('cancelled');
        expect(fallbackEvaluated).toBe(false);
      }
    });

    it('37. abort signal cancels pending catalog fetch promptly and prevents fallback', async () => {
      const registry = new BrainProviderRegistry();
      let fallbackEvaluated = false;

      const slowCatP = createStubCatalogProvider({
        id: 'p-slow-cat',
        catalogDelayMs: 150,
        models: [createModel({ id: 'm-slow-cat' })]
      });
      const fallbackP = createStubCatalogProvider({
        id: 'p-fallback-cat',
        models: [createModel({ id: 'm-fb' })]
      });
      const originalHealth = fallbackP.health.bind(fallbackP);
      fallbackP.health = async () => {
        fallbackEvaluated = true;
        return originalHealth();
      };

      registry.register(slowCatP);
      registry.register(fallbackP);

      const router = new BrainRouter({
        registry,
        defaultProvider: 'p-slow-cat',
        fallbackChain: ['p-fallback-cat'],
        timeoutMs: 2000
      });

      const controller = new AbortController();
      setTimeout(() => controller.abort('User cancellation'), 20);

      try {
        await router.route({ signal: controller.signal });
        expect.unreachable('Should have been cancelled');
      } catch (err) {
        expect(err).toBeInstanceOf(BrainRoutingError);
        expect((err as BrainRoutingError).code).toBe('cancelled');
        expect(fallbackEvaluated).toBe(false);
      }
    });
  });
});

