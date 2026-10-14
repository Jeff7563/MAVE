import { describe, expect, it } from 'vitest';
import type {
  BrainCapabilities,
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ProviderHealth
} from '@mave/contracts';
import {
  RuntimeQuotaStore
} from '../brain/quota/index.js';
import { RuntimeModelCatalog } from '../brain/runtime-models/catalog.js';
import type { RuntimeModelDescriptor } from '../brain/runtime-models/types.js';
import { BrainRouter } from '../brain/router.js';
import { BrainProviderRegistry } from '../brain/provider-registry.js';
import { ConversationRuntime } from '../conversation/runtime.js';
import { SessionManager } from '../conversation/session-manager.js';
import { ContextManager } from '../conversation/context-manager.js';

function createMockAgentRuntime(
  id: string,
  opts?: {
    failError?: any;
    healthStatus?: ProviderHealth['status'];
  }
): BrainProvider {
  const caps: BrainCapabilities = {
    streaming: true,
    fastChat: true,
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
      yield { type: 'started', requestId: req.requestId, providerId: id, modelId: chatOptions?.modelId, timestamp: Date.now() };
      if (opts?.failError) {
        yield {
          type: 'error',
          requestId: req.requestId,
          error: {
            ...opts.failError,
            providerId: id
          }
        };
        return;
      }
      yield { type: 'delta', requestId: req.requestId, text: `Hello from ${id}` };
      yield { type: 'completed', requestId: req.requestId, text: `Hello from ${id}`, finishReason: 'end_turn' };
    }
  };
}

describe('F1.5-S4.1 Quota Scope & Blocked-State Hardening', () => {
  describe('RuntimeQuotaStore Scope Hardening', () => {
    it('blocks provider only for runtime scope; model and unknown scopes do not block provider', () => {
      const store = new RuntimeQuotaStore();

      // Model scope should not block provider
      store.record({
        providerId: 'codex',
        status: 'quota_limited',
        scope: 'model',
        modelId: 'gpt-4o'
      });
      expect(store.isBlocked('codex')).toBe(false);

      // Unknown scope should not block provider
      store.record({
        providerId: 'antigravity',
        status: 'rate_limited',
        scope: 'unknown'
      });
      expect(store.isBlocked('antigravity')).toBe(false);

      // Runtime scope should block provider
      store.record({
        providerId: 'claude-code',
        status: 'quota_limited',
        scope: 'runtime'
      });
      expect(store.isBlocked('claude-code')).toBe(true);
    });

    it('scope-aware overwrite protection: model success cannot clear active runtime block', () => {
      let now = 1000;
      const store = new RuntimeQuotaStore({ clock: () => now });

      // Active runtime block established at t=1000
      store.record({
        providerId: 'claude-code',
        status: 'quota_limited',
        scope: 'runtime',
        observedAt: 1000
      });
      expect(store.isBlocked('claude-code')).toBe(true);

      // Model-scoped success arrives at t=2000
      now = 2000;
      const res = store.record({
        providerId: 'claude-code',
        status: 'available',
        scope: 'model',
        modelId: 'claude-3-5-sonnet',
        observedAt: 2000
      });

      // Must NOT clear runtime block
      expect(res.status).toBe('quota_limited');
      expect(store.isBlocked('claude-code')).toBe(true);
      expect(store.get('claude-code').status).toBe('quota_limited');
    });

    it('scope-aware overwrite protection: model limit cannot downgrade active runtime block', () => {
      let now = 1000;
      const store = new RuntimeQuotaStore({ clock: () => now });

      store.record({
        providerId: 'codex',
        status: 'quota_limited',
        scope: 'runtime',
        observedAt: 1000
      });
      expect(store.isBlocked('codex')).toBe(true);

      now = 2000;
      store.record({
        providerId: 'codex',
        status: 'rate_limited',
        scope: 'model',
        modelId: 'o1',
        observedAt: 2000
      });

      // Provider remains blocked at runtime
      expect(store.isBlocked('codex')).toBe(true);
      expect(store.get('codex').status).toBe('quota_limited');
    });

    it('runtime-scoped available observation with newer timestamp clears runtime block', () => {
      let now = 1000;
      const store = new RuntimeQuotaStore({ clock: () => now });

      store.record({
        providerId: 'claude-code',
        status: 'quota_limited',
        scope: 'runtime',
        observedAt: 1000
      });
      expect(store.isBlocked('claude-code')).toBe(true);

      now = 2000;
      store.record({
        providerId: 'claude-code',
        status: 'available',
        scope: 'runtime',
        observedAt: 2000
      });

      expect(store.isBlocked('claude-code')).toBe(false);
      expect(store.get('claude-code').status).toBe('available');
    });

    it('cross-model coexistence: Opus quota_limited and Sonnet available coexist without collision (F1.5-S5)', () => {
      const catalog = new RuntimeModelCatalog();
      const quotaStore = new RuntimeQuotaStore();

      catalog.registerRuntimeModels('claude-code', [
        {
          modelId: 'claude-3-opus',
          runtimeProviderId: 'claude-code',
          displayName: 'Claude 3 Opus',
          supportedRoles: ['REASONING', 'CODING'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: 1000
        },
        {
          modelId: 'claude-3-5-sonnet',
          runtimeProviderId: 'claude-code',
          displayName: 'Claude 3.5 Sonnet',
          supportedRoles: ['BALANCED', 'CODING'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: 1000
        }
      ]);

      // 1. Mark Opus as quota_limited (model-scoped)
      catalog.updateRuntimeModel('claude-code', 'claude-3-opus', {
        availability: 'quota_limited',
        metadata: { scope: 'model', resetAt: Date.now() + 60000 }
      });
      quotaStore.record({
        providerId: 'claude-code',
        status: 'quota_limited',
        scope: 'model',
        modelId: 'claude-3-opus'
      });

      // Verification: Opus is quota_limited, Sonnet remains available
      const opus = catalog.getRuntimeModel('claude-code', 'claude-3-opus');
      const sonnet = catalog.getRuntimeModel('claude-code', 'claude-3-5-sonnet');
      expect(opus?.availability).toBe('quota_limited');
      expect(sonnet?.availability).toBe('available');

      // Verification: Opus quota_limited does NOT block the Claude runtime
      expect(quotaStore.isBlocked('claude-code')).toBe(false);

      // 2. Sonnet executes successfully (status: 'available')
      catalog.updateRuntimeModel('claude-code', 'claude-3-5-sonnet', {
        availability: 'available'
      });
      quotaStore.record({
        providerId: 'claude-code',
        status: 'available',
        source: 'successful_execution',
        scope: 'model',
        modelId: 'claude-3-5-sonnet'
      });

      // Verification: Sonnet success does NOT clear Opus quota_limited
      expect(catalog.getRuntimeModel('claude-code', 'claude-3-opus')?.availability).toBe('quota_limited');
      expect(catalog.getRuntimeModel('claude-code', 'claude-3-5-sonnet')?.availability).toBe('available');

      // Verification: Claude runtime remains unblocked
      expect(quotaStore.isBlocked('claude-code')).toBe(false);
    });
  });

  describe('RuntimeModelCatalog Reset Expiration Hardening', () => {
    it('expires resetAt strictly to "unknown", never automatically to "available"', () => {
      const catalog = new RuntimeModelCatalog();
      const descriptor: RuntimeModelDescriptor = {
        modelId: 'gpt-4o',
        runtimeProviderId: 'codex',
        displayName: 'GPT-4o',
        supportedRoles: ['CODING', 'BALANCED'],
        discoverySource: 'runtime_enumerated',
        availability: 'quota_limited',
        discoveredAt: 1000,
        metadata: {
          resetAt: 5000,
          scope: 'model'
        }
      };
      catalog.registerRuntimeModels('codex', [descriptor]);

      // Before reset: filtered out as quota_limited
      const modelsBefore = catalog.getRuntimeModels('codex', 4999);
      expect(modelsBefore[0]?.availability).toBe('quota_limited');

      // After reset: transitions strictly to 'unknown'
      const modelsAfter = catalog.getRuntimeModels('codex', 5001);
      expect(modelsAfter[0]?.availability).toBe('unknown');
      expect(modelsAfter[0]?.metadata?.resetAt).toBeUndefined();
      expect(modelsAfter[0]?.metadata?.expiredResetAt).toBe(5000);

      // Model in 'unknown' state is now optimistically selectable
      const selection = catalog.selectModel({
        runtimeProviderId: 'codex',
        role: 'CODING',
        mode: 'AUTO'
      }, 5001);
      expect(selection.selectedModelId).toBe('gpt-4o');
      expect(selection.descriptor.availability).toBe('unknown');
    });

    it('cleans up expired models across all runtimes with clearExpired()', () => {
      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('codex', [
        {
          modelId: 'm1',
          runtimeProviderId: 'codex',
          displayName: 'M1',
          supportedRoles: ['FAST'],
          discoverySource: 'runtime_enumerated',
          availability: 'quota_limited',
          discoveredAt: 1000,
          metadata: { resetAt: 3000 }
        }
      ]);
      catalog.registerRuntimeModels('claude-code', [
        {
          modelId: 'm2',
          runtimeProviderId: 'claude-code',
          displayName: 'M2',
          supportedRoles: ['FAST'],
          discoverySource: 'runtime_enumerated',
          availability: 'rate_limited',
          discoveredAt: 1000,
          metadata: { resetAt: 8000 }
        }
      ]);

      const expiredCount = catalog.clearExpired(5000);
      expect(expiredCount).toBe(1);

      expect(catalog.getRuntimeModel('codex', 'm1', 5000)?.availability).toBe('unknown');
      expect(catalog.getRuntimeModel('claude-code', 'm2', 5000)?.availability).toBe('rate_limited');
    });
  });

  describe('BrainRouter Deterministic Error Precision', () => {
    function setupRouterPrecisionEnv() {
      const registry = new BrainProviderRegistry();
      const catalog = new RuntimeModelCatalog();
      const quotaStore = new RuntimeQuotaStore();

      const claude = createMockAgentRuntime('claude-code');
      const codex = createMockAgentRuntime('codex');
      const antigravity = createMockAgentRuntime('antigravity');

      registry.register(claude, { kind: 'agent_runtime_provider', accessClass: 'subscription' });
      registry.register(codex, { kind: 'agent_runtime_provider', accessClass: 'subscription' });
      registry.register(antigravity, { kind: 'agent_runtime_provider', accessClass: 'subscription' });

      catalog.registerRuntimeModels('claude-code', [
        {
          runtimeProviderId: 'claude-code',
          modelId: 'claude-3-7-sonnet',
          displayName: 'Claude 3.7 Sonnet',
          supportedRoles: ['CODING', 'AGENT'],
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
          supportedRoles: ['CODING', 'AGENT'],
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
          supportedRoles: ['CODING', 'AGENT'],
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

      return { registry, catalog, quotaStore, router };
    }

    it('returns "quota_limited" when all candidates are quota_limited', async () => {
      const { quotaStore, router } = setupRouterPrecisionEnv();

      quotaStore.record({ providerId: 'claude-code', status: 'quota_limited', scope: 'runtime' });
      quotaStore.record({ providerId: 'codex', status: 'quota_limited', scope: 'runtime' });
      quotaStore.record({ providerId: 'antigravity', status: 'quota_limited', scope: 'runtime' });

      await expect(router.route({
        profileId: 'agent_work'
      })).rejects.toMatchObject({
        code: 'quota_limited',
        message: expect.stringContaining('currently quota limited')
      });
    });

    it('returns "rate_limited" when all candidates are rate_limited', async () => {
      const { quotaStore, router } = setupRouterPrecisionEnv();

      quotaStore.record({ providerId: 'claude-code', status: 'rate_limited', scope: 'runtime' });
      quotaStore.record({ providerId: 'codex', status: 'rate_limited', scope: 'runtime' });
      quotaStore.record({ providerId: 'antigravity', status: 'rate_limited', scope: 'runtime' });

      await expect(router.route({
        profileId: 'agent_work'
      })).rejects.toMatchObject({
        code: 'rate_limited',
        message: expect.stringContaining('currently rate limited')
      });
    });

    it('returns deterministic "quota_limited" with mixed explanatory message when candidates are mixed', async () => {
      const { quotaStore, router } = setupRouterPrecisionEnv();

      quotaStore.record({ providerId: 'claude-code', status: 'quota_limited', scope: 'runtime' });
      quotaStore.record({ providerId: 'codex', status: 'rate_limited', scope: 'runtime' });
      quotaStore.record({ providerId: 'antigravity', status: 'quota_limited', scope: 'runtime' });

      await expect(router.route({
        profileId: 'agent_work'
      })).rejects.toMatchObject({
        code: 'quota_limited',
        message: expect.stringContaining('currently quota or rate limited')
      });
    });
  });

  describe('ConversationRuntime Scope Integration', () => {
    it('model-scoped quota error limits the model in catalog without blocking the provider in quotaStore', async () => {
      const registry = new BrainProviderRegistry();
      const failingProvider = createMockAgentRuntime('codex', {
        failError: {
          code: 'quota_limited',
          message: 'Rate limit reached for gpt-4o model capacity',
          details: {
            scope: 'model',
            modelId: 'gpt-4o'
          }
        }
      });
      registry.register(failingProvider, { kind: 'agent_runtime_provider', accessClass: 'subscription' });

      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('codex', [
        {
          modelId: 'gpt-4o',
          runtimeProviderId: 'codex',
          displayName: 'GPT-4o',
          supportedRoles: ['CODING', 'AGENT'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: 1000
        },
        {
          modelId: 'o1-mini',
          runtimeProviderId: 'codex',
          displayName: 'o1-mini',
          supportedRoles: ['CODING', 'AGENT'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: 1000
        }
      ]);

      const quotaStore = new RuntimeQuotaStore();
      const router = new BrainRouter({
        registry,
        runtimeModelCatalog: catalog,
        quotaStore,
        defaultProvider: 'codex'
      });

      const conversationRuntime = new ConversationRuntime({
        sessionManager: new SessionManager(),
        contextManager: new ContextManager(),
        router,
        quotaStore,
        runtimeModelCatalog: catalog
      });

      // 1. First turn uses gpt-4o and fails with model-scoped quota limit
      const events: any[] = [];
      for await (const ev of conversationRuntime.send({
        message: 'Hello',
        profileId: 'agent_work',
        preferredRuntimeId: 'codex',
        preferredModelId: 'gpt-4o'
      })) {
        events.push(ev);
      }

      const failedEvent = events.find((e) => e.type === 'request_failed');
      expect(failedEvent).toBeDefined();

      // 2. Invariant verification: Provider is NOT blocked provider-wide
      expect(quotaStore.isBlocked('codex')).toBe(false);

      // 3. Invariant verification: Only gpt-4o is marked quota_limited in catalog
      expect(catalog.getRuntimeModel('codex', 'gpt-4o')?.availability).toBe('quota_limited');
      expect(catalog.getRuntimeModel('codex', 'o1-mini')?.availability).toBe('available');
    });

    it('unknown-scoped quota error fails request without falsely blocking the provider', async () => {
      const registry = new BrainProviderRegistry();
      const provider = createMockAgentRuntime('claude-code', {
        failError: {
          code: 'rate_limited',
          message: 'HTTP 429: Too Many Requests',
          details: {
            scope: 'unknown'
          }
        }
      });
      registry.register(provider, { kind: 'agent_runtime_provider', accessClass: 'subscription' });

      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('claude-code', [
        {
          modelId: 'claude-3-7-sonnet',
          runtimeProviderId: 'claude-code',
          displayName: 'Claude 3.7 Sonnet',
          supportedRoles: ['CODING', 'AGENT'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: 1000
        }
      ]);

      const quotaStore = new RuntimeQuotaStore();
      const router = new BrainRouter({
        registry,
        runtimeModelCatalog: catalog,
        quotaStore,
        defaultProvider: 'claude-code'
      });

      const conversationRuntime = new ConversationRuntime({
        sessionManager: new SessionManager(),
        contextManager: new ContextManager(),
        router,
        quotaStore,
        runtimeModelCatalog: catalog
      });

      const events: any[] = [];
      for await (const ev of conversationRuntime.send({
        message: 'Hello',
        profileId: 'agent_work',
        preferredRuntimeId: 'claude-code'
      })) {
        events.push(ev);
      }

      const failedEvent = events.find((e) => e.type === 'request_failed');
      expect(failedEvent?.error?.code).toBe('rate_limited');

      // Invariant: Provider is NOT blocked for subsequent requests
      expect(quotaStore.isBlocked('claude-code')).toBe(false);
    });

    it('runtime-scoped quota error blocks the provider for subsequent turns', async () => {
      const registry = new BrainProviderRegistry();
      const provider = createMockAgentRuntime('claude-code', {
        failError: {
          code: 'quota_limited',
          message: 'Subscription 5-hour quota exhausted',
          details: {
            scope: 'runtime',
            resetAt: Date.now() + 60000
          }
        }
      });
      registry.register(provider, { kind: 'agent_runtime_provider', accessClass: 'subscription' });

      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('claude-code', [
        {
          modelId: 'claude-3-7-sonnet',
          runtimeProviderId: 'claude-code',
          displayName: 'Claude 3.7 Sonnet',
          supportedRoles: ['CODING', 'AGENT'],
          availability: 'available',
          discoverySource: 'runtime_enumerated',
          discoveredAt: 1000
        }
      ]);

      const quotaStore = new RuntimeQuotaStore();
      const router = new BrainRouter({
        registry,
        runtimeModelCatalog: catalog,
        quotaStore,
        defaultProvider: 'claude-code'
      });

      const conversationRuntime = new ConversationRuntime({
        sessionManager: new SessionManager(),
        contextManager: new ContextManager(),
        router,
        quotaStore,
        runtimeModelCatalog: catalog
      });

      for await (const _ev of conversationRuntime.send({
        message: 'Hello',
        profileId: 'agent_work',
        preferredRuntimeId: 'claude-code'
      })) {
        // drain
      }

      // Invariant: Provider is blocked provider-wide
      expect(quotaStore.isBlocked('claude-code')).toBe(true);
      expect(quotaStore.get('claude-code').scope).toBe('runtime');
    });
  });
});
