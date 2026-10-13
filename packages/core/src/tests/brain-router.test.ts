import { describe, it, expect } from 'vitest';
import type {
  BrainCapabilities,
  BrainProvider,
  ProviderHealth,
  ProviderHealthStatus
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
}

function createStubProvider(options: StubProviderOptions): BrainProvider & { getChatCallCount: () => number } {
  let chatCallCount = 0;
  const initialCapabilities: BrainCapabilities = {
    streaming: true,
    fastChat: false,
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

  return {
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
    const provider: BrainProvider = {
      id: 'mock-single',
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
      async health() {
        healthCallCount++;
        return { status: 'healthy', checkedAt: Date.now() };
      },
      async *chat() {}
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
});
