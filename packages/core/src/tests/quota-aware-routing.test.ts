import { describe, expect, it } from 'vitest';
import type {
  BrainCapabilities,
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ModelCatalogProvider,
  ModelCatalogSnapshot,
  ProviderDescriptor,
  ProviderHealth
} from '@mave/contracts';
import { BrainProviderRegistry } from '../brain/provider-registry.js';
import { BrainRouter } from '../brain/router.js';
import { BrainRoutingError } from '../brain/types.js';
import { RuntimeModelCatalog } from '../brain/runtime-models/catalog.js';
import { RuntimeQuotaStore } from '../brain/quota/index.js';

function createMockAgentRuntime(
  id: string,
  opts?: { healthStatus?: ProviderHealth['status'] }
): BrainProvider {
  const caps: BrainCapabilities = {
    streaming: true,
    fastChat: false,
    reasoning: true,
    coding: true,
    toolUse: true,
    multimodal: false,
    vision: false,
    webResearch: false,
    longContext: true,
    local: false
  };

  return {
    id,
    getCapabilities: () => caps,
    health: async () => ({ status: opts?.healthStatus ?? 'healthy', checkedAt: Date.now() }),
    async *chat(req: BrainRequest, chatOptions?: BrainRequestOptions): AsyncIterable<BrainEvent> {
      yield { type: 'started', requestId: req.requestId, providerId: id, modelId: chatOptions?.modelId };
      yield { type: 'delta', requestId: req.requestId, text: `Hello from ${id}` };
      yield { type: 'completed', requestId: req.requestId, text: `Hello from ${id}` };
    }
  };
}

function createMockDirectProvider(
  id: string,
  opts?: { healthStatus?: ProviderHealth['status']; accessClass?: 'local' | 'paid_api' }
): ModelCatalogProvider {
  const isLocal = opts?.accessClass === 'local';
  const caps: BrainCapabilities = {
    streaming: true,
    fastChat: true,
    reasoning: false,
    coding: true,
    toolUse: false,
    multimodal: false,
    vision: false,
    webResearch: false,
    longContext: false,
    local: isLocal
  };

  const catalog: ModelCatalogSnapshot = {
    providerId: id,
    models: [
      {
        id: `${id}-model`,
        providerId: id,
        displayName: `${id} Model`,
        status: 'available',
        latencyClass: 'interactive',
        qualityClass: 'fast',
        costClass: isLocal ? 'free' : 'low',
        contextClass: 'standard',
        privacyClass: isLocal ? 'local_only' : 'standard_cloud',
        capabilities: { ...caps }
      }
    ],
    refreshedAt: Date.now()
  };

  const descriptor: ProviderDescriptor = {
    id,
    kind: 'model_provider',
    displayName: `${id} Direct Provider`,
    accessPath: 'official_api',
    capabilities: caps,
    health: { status: opts?.healthStatus ?? 'healthy', checkedAt: Date.now() },
    defaultModelId: `${id}-model`
  };

  return {
    id,
    getCapabilities: () => caps,
    health: async () => ({ status: opts?.healthStatus ?? 'healthy', checkedAt: Date.now() }),
    getCatalog: async () => catalog,
    getDescriptor: () => descriptor,
    async *chat(req: BrainRequest, chatOptions?: BrainRequestOptions): AsyncIterable<BrainEvent> {
      yield { type: 'started', requestId: req.requestId, providerId: id, modelId: chatOptions?.modelId };
      yield { type: 'delta', requestId: req.requestId, text: `Hello from direct ${id}` };
      yield { type: 'completed', requestId: req.requestId, text: `Hello from direct ${id}` };
    }
  };
}

function setupTestEnvironment() {
  const registry = new BrainProviderRegistry();
  const catalog = new RuntimeModelCatalog();
  const quotaStore = new RuntimeQuotaStore();

  const claude = createMockAgentRuntime('claude-code');
  const codex = createMockAgentRuntime('codex');
  const antigravity = createMockAgentRuntime('antigravity');

  registry.register(claude, { kind: 'agent_runtime_provider', accessClass: 'subscription' });
  registry.register(codex, { kind: 'agent_runtime_provider', accessClass: 'subscription' });
  registry.register(antigravity, { kind: 'agent_runtime_provider', accessClass: 'subscription' });

  // Register runtime models
  catalog.registerRuntimeModels('claude-code', [
    {
      runtimeProviderId: 'claude-code',
      modelId: 'claude-3-7-sonnet',
      displayName: 'Claude 3.7 Sonnet',
      supportedRoles: ['FAST', 'BALANCED', 'REASONING', 'CODING', 'AGENT'],
      availability: 'available',
      discoverySource: 'runtime_enumerated',
      discoveredAt: Date.now()
    }
  ]);

  catalog.registerRuntimeModels('codex', [
    {
      runtimeProviderId: 'codex',
      modelId: 'gpt-4o',
      displayName: 'GPT-4o (Codex)',
      supportedRoles: ['FAST', 'BALANCED', 'CODING', 'AGENT'],
      availability: 'available',
      discoverySource: 'runtime_enumerated',
      discoveredAt: Date.now()
    }
  ]);

  catalog.registerRuntimeModels('antigravity', [
    {
      runtimeProviderId: 'antigravity',
      modelId: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      supportedRoles: ['FAST', 'BALANCED', 'REASONING', 'CODING', 'AGENT'],
      availability: 'available',
      discoverySource: 'runtime_enumerated',
      discoveredAt: Date.now()
    }
  ]);

  const router = new BrainRouter({
    registry,
    runtimeModelCatalog: catalog,
    quotaStore,
    runtimePriorities: {
      FAST: ['claude-code', 'codex', 'antigravity'],
      BALANCED: ['claude-code', 'codex', 'antigravity'],
      REASONING: ['claude-code', 'antigravity'],
      CODING: ['claude-code', 'codex', 'antigravity'],
      AGENT: ['claude-code', 'codex', 'antigravity']
    }
  });

  return { registry, catalog, quotaStore, router };
}

describe('F1.5-S4 Quota-Aware Subscription Routing', () => {
  it('AUTO mode: pre-execution skips quota-limited runtime and selects next eligible runtime', async () => {
    const { quotaStore, router } = setupTestEnvironment();

    // Mark primary candidate (claude-code) as quota limited
    quotaStore.record({
      providerId: 'claude-code',
      status: 'quota_limited',
      reason: 'Usage limit reached'
    });

    const decision = await router.route({
      taskIntent: 'coding' // maps to CODING role, profileId: 'agent_work'
    });

    expect(decision.providerId).toBe('codex');
    expect(decision.modelId).toBe('gpt-4o');
    expect(decision.taskIntent).toBe('coding');
    expect(decision.modelRole).toBe('CODING');

    // Invariant: Skipped quota-blocked candidate is NOT in attemptedProviderIds
    expect(decision.attemptedProviderIds).toEqual(['codex']);
    expect(decision.attemptedProviderIds).not.toContain('claude-code');

    // Diagnostics verify quota tracking
    expect(decision.diagnostics).toBeDefined();
    expect(decision.diagnostics!.quotaSkippedProviders).toBeDefined();
    expect(decision.diagnostics!.quotaSkippedProviders).toHaveLength(1);
    expect(decision.diagnostics!.quotaSkippedProviders![0]!.providerId).toBe('claude-code');
    expect(decision.diagnostics!.quotaSkippedProviders![0]!.status).toBe('quota_limited');
    expect(decision.diagnostics!.quotaSelectionReason).toContain('Selected runtime \'codex\' after skipping quota-limited candidates: [claude-code]');
  });

  it('PREFERRED mode with allowFallback=true: skips quota-limited preferred runtime and falls back', async () => {
    const { quotaStore, router } = setupTestEnvironment();

    quotaStore.record({
      providerId: 'claude-code',
      status: 'quota_limited',
      reason: 'Exhausted'
    });

    const decision = await router.route({
      profileId: 'agent_work',
      preferredRuntimeId: 'claude-code',
      allowFallback: true
    });

    expect(decision.providerId).toBe('codex');
    expect(decision.attemptedProviderIds).toEqual(['codex']);
    expect(decision.attemptedProviderIds).not.toContain('claude-code');
    expect(decision.diagnostics!.quotaSkippedProviders?.[0]?.providerId).toBe('claude-code');
  });

  it('PREFERRED mode with allowFallback=false: fails immediately when preferred runtime is quota limited', async () => {
    const { quotaStore, router } = setupTestEnvironment();

    quotaStore.record({
      providerId: 'claude-code',
      status: 'quota_limited',
      reason: 'Session quota reached'
    });

    await expect(
      router.route({
        profileId: 'agent_work',
        preferredRuntimeId: 'claude-code',
        allowFallback: false
      })
    ).rejects.toThrowError(BrainRoutingError);

    try {
      await router.route({
        profileId: 'agent_work',
        preferredRuntimeId: 'claude-code',
        allowFallback: false
      });
    } catch (err: unknown) {
      const routingErr = err as BrainRoutingError;
      expect(routingErr.code).toBe('quota_limited');
      expect(routingErr.message).toContain('Preferred runtime \'claude-code\' is quota limited and fallback is disabled');
      expect(routingErr.attemptedProviderIds).toEqual([]);
    }
  });

  it('LOCKED mode: fails immediately without fallback when locked runtime is quota limited', async () => {
    const { quotaStore, router } = setupTestEnvironment();

    quotaStore.record({
      providerId: 'codex',
      status: 'rate_limited',
      reason: '429 Rate limit exceeded'
    });

    try {
      await router.route({
        profileId: 'agent_work',
        lockedRuntimeId: 'codex'
      });
      expect.fail('Expected route() to throw');
    } catch (err: unknown) {
      const routingErr = err as BrainRoutingError;
      expect(routingErr.code).toBe('rate_limited');
      expect(routingErr.message).toContain('Locked runtime \'codex\' is quota limited');
      expect(routingErr.attemptedProviderIds).toEqual([]);
    }
  });

  it('fails closed with quota_limited when all candidate runtimes are quota limited', async () => {
    const { quotaStore, router } = setupTestEnvironment();

    quotaStore.record({ providerId: 'claude-code', status: 'quota_limited' });
    quotaStore.record({ providerId: 'codex', status: 'quota_limited' });
    quotaStore.record({ providerId: 'antigravity', status: 'quota_limited' });

    try {
      await router.route({
        profileId: 'agent_work'
      });
      expect.fail('Expected route() to throw');
    } catch (err: unknown) {
      const routingErr = err as BrainRoutingError;
      expect(routingErr.code).toBe('quota_limited');
      expect(routingErr.message).toContain('All candidate subscription runtimes');
      expect(routingErr.attemptedProviderIds).toEqual([]);
    }
  });

  it('respects quota routing preference: priority_first vs available_first', async () => {
    const { registry, catalog, quotaStore } = setupTestEnvironment();

    // Custom router allowing quotaPreference injection
    // Priority order: claude-code (1), codex (2), antigravity (3)
    // Mark codex as 'available', claude-code remains 'unknown'
    quotaStore.record({
      providerId: 'codex',
      status: 'available',
      source: 'successful_execution'
    });

    // 1. With default 'priority_first': claude-code (prio 1) is still selected first because unknown is not blocked
    const routerPriorityFirst = new BrainRouter({
      registry,
      runtimeModelCatalog: catalog,
      quotaStore,
      quotaPreference: 'priority_first',
      runtimePriorities: {
        FAST: ['claude-code', 'codex', 'antigravity'],
        BALANCED: ['claude-code', 'codex', 'antigravity'],
        REASONING: ['claude-code', 'antigravity'],
        CODING: ['claude-code', 'codex', 'antigravity'],
        AGENT: ['claude-code', 'codex', 'antigravity']
      }
    });

    const decisionPrio = await routerPriorityFirst.route({
      taskIntent: 'coding'
    });
    expect(decisionPrio.providerId).toBe('claude-code');

    // 2. With 'available_first': codex (verified available) is prioritized ahead of claude-code (unknown)
    const routerAvailableFirst = new BrainRouter({
      registry,
      runtimeModelCatalog: catalog,
      quotaStore,
      quotaPreference: 'available_first',
      runtimePriorities: {
        FAST: ['claude-code', 'codex', 'antigravity'],
        BALANCED: ['claude-code', 'codex', 'antigravity'],
        REASONING: ['claude-code', 'antigravity'],
        CODING: ['claude-code', 'codex', 'antigravity'],
        AGENT: ['claude-code', 'codex', 'antigravity']
      }
    });

    const decisionAvail = await routerAvailableFirst.route({
      taskIntent: 'coding'
    });
    expect(decisionAvail.providerId).toBe('codex');
    expect(decisionAvail.diagnostics!.quotaPreference).toBe('available_first');
  });

  it('preserves strict ProviderKind boundaries: agent_work never falls back to direct model_provider', async () => {
    const { registry, catalog, quotaStore } = setupTestEnvironment();

    // Register a direct model provider with coding capability
    const directProvider = createMockDirectProvider('mock-direct-gpt4', { accessClass: 'paid_api' });
    registry.register(directProvider, { kind: 'model_provider', accessClass: 'paid_api' });

    // Also register a local direct model provider
    const localProvider = createMockDirectProvider('mock-local-llama', { accessClass: 'local' });
    registry.register(localProvider, { kind: 'model_provider', accessClass: 'local' });

    // Exhaust all agent runtimes
    quotaStore.record({ providerId: 'claude-code', status: 'quota_limited' });
    quotaStore.record({ providerId: 'codex', status: 'quota_limited' });
    quotaStore.record({ providerId: 'antigravity', status: 'quota_limited' });

    const router = new BrainRouter({
      registry,
      runtimeModelCatalog: catalog,
      quotaStore,
      allowPaidApis: false
    });

    // agent_work MUST fail closed with quota_limited rather than falling back to model_provider
    try {
      await router.route({
        profileId: 'agent_work'
      });
      expect.fail('Expected route() to throw');
    } catch (err: unknown) {
      const routingErr = err as BrainRoutingError;
      expect(routingErr.code).toBe('quota_limited');
      expect(routingErr.attemptedProviderIds).toEqual([]);
    }
  });

  it('keeps paid APIs strictly blocked even when subscription runtimes are exhausted', async () => {
    const { registry, catalog, quotaStore } = setupTestEnvironment();

    const directPaid = createMockDirectProvider('paid-claude-api', { accessClass: 'paid_api' });
    registry.register(directPaid, { kind: 'model_provider', accessClass: 'paid_api' });

    quotaStore.record({ providerId: 'claude-code', status: 'quota_limited' });
    quotaStore.record({ providerId: 'codex', status: 'quota_limited' });
    quotaStore.record({ providerId: 'antigravity', status: 'quota_limited' });

    const router = new BrainRouter({
      registry,
      runtimeModelCatalog: catalog,
      quotaStore,
      allowPaidApis: false // policy default
    });

    await expect(
      router.route({
        profileId: 'agent_work'
      })
    ).rejects.toThrowError(BrainRoutingError);
  });

  it('skips quota-limited runtime models in AUTO mode', async () => {
    const { registry, catalog, quotaStore } = setupTestEnvironment();

    // In claude-code, register two models: sonnet is quota_limited, haiku is available
    catalog.registerRuntimeModels('claude-code', [
      {
        runtimeProviderId: 'claude-code',
        modelId: 'claude-3-7-sonnet',
        displayName: 'Claude 3.7 Sonnet',
        supportedRoles: ['FAST', 'BALANCED', 'REASONING', 'CODING', 'AGENT'],
        availability: 'quota_limited',
        discoverySource: 'runtime_enumerated',
        discoveredAt: Date.now()
      },
      {
        runtimeProviderId: 'claude-code',
        modelId: 'claude-3-5-haiku',
        displayName: 'Claude 3.5 Haiku',
        supportedRoles: ['FAST', 'CODING'],
        availability: 'available',
        discoverySource: 'runtime_enumerated',
        discoveredAt: Date.now()
      }
    ]);

    const router = new BrainRouter({
      registry,
      runtimeModelCatalog: catalog,
      quotaStore
    });

    const decision = await router.route({
      taskIntent: 'coding'
    });

    expect(decision.providerId).toBe('claude-code');
    // Sonnet was skipped due to quota_limited availability, haiku selected
    expect(decision.modelId).toBe('claude-3-5-haiku');
  });
});
