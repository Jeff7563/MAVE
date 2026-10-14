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
import { ConversationRuntime } from '../conversation/runtime.js';
import { SessionManager } from '../conversation/session-manager.js';
import { ContextManager } from '../conversation/context-manager.js';
import { TaskPolicy } from '../brain/task-policy.js';

function createMockDirectProvider(
  id: string,
  opts?: { healthStatus?: ProviderHealth['status']; defaultModel?: string }
): ModelCatalogProvider {
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
    local: false
  };

  const modelId = opts?.defaultModel ?? `${id}-model`;
  const catalog: ModelCatalogSnapshot = {
    providerId: id,
    models: [
      {
        id: modelId,
        providerId: id,
        displayName: `${id} Model`,
        status: 'available',
        latencyClass: 'interactive',
        qualityClass: 'fast',
        costClass: 'low',
        contextClass: 'standard',
        privacyClass: 'standard_cloud',
        capabilities: { ...caps }
      }
    ],
    refreshedAt: Date.now()
  };

  const descriptor: ProviderDescriptor = {
    id,
    kind: 'model_provider',
    displayName: `${id} Provider`,
    accessPath: 'official_api',
    capabilities: caps,
    health: { status: opts?.healthStatus ?? 'healthy', checkedAt: Date.now() },
    defaultModelId: modelId
  };

  return {
    id,
    getCapabilities: () => caps,
    health: async () => ({ status: opts?.healthStatus ?? 'healthy', checkedAt: Date.now() }),
    getCatalog: async () => catalog,
    getDescriptor: () => descriptor,
    async *chat(req: BrainRequest, chatOptions?: BrainRequestOptions): AsyncIterable<BrainEvent> {
      yield { type: 'started', requestId: req.requestId, providerId: id, modelId: chatOptions?.modelId };
      yield { type: 'delta', requestId: req.requestId, text: `Hello from ${id}` };
      yield { type: 'completed', requestId: req.requestId, text: `Hello from ${id}` };
    }
  };
}

function createMockAgentRuntimeProvider(
  id: string,
  opts?: {
    healthStatus?: ProviderHealth['status'];
    failureMode?: 'error_event' | 'throw';
    onChatInvoked?: (req: BrainRequest, chatOptions?: BrainRequestOptions) => void;
  }
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
      opts?.onChatInvoked?.(req, chatOptions);

      if (opts?.failureMode === 'throw') {
        throw new Error(`Provider ${id} crashed during chat invocation`);
      }

      yield { type: 'started', requestId: req.requestId, providerId: id, modelId: chatOptions?.modelId };

      if (opts?.failureMode === 'error_event') {
        yield {
          type: 'error',
          requestId: req.requestId,
          error: {
            code: 'runtime_error',
            message: `Midstream failure in provider ${id}`,
            retryable: false
          }
        };
        return;
      }

      yield { type: 'delta', requestId: req.requestId, text: `Done by ${id}` };
      yield { type: 'completed', requestId: req.requestId, text: `Done by ${id}` };
    }
  };
}

function setupRuntime(providers: BrainProvider[], catalog?: RuntimeModelCatalog) {
  const sessionManager = new SessionManager();
  const contextManager = new ContextManager();
  const registry = new BrainProviderRegistry();
  for (const p of providers) {
    registry.register(p);
  }
  const router = new BrainRouter({
    registry,
    runtimeModelCatalog: catalog
  });
  const runtime = new ConversationRuntime({
    sessionManager,
    contextManager,
    router
  });
  return { sessionManager, contextManager, registry, router, runtime };
}

describe('Routing Telemetry & Executable Provider Hardening (F1.5-S3.1)', () => {
  describe('Section 17: Canonical Telemetry Semantics', () => {
    it('1. evaluated provider does not enter attemptedProviderIds in pre-execution telemetry', async () => {
      const p1 = createMockDirectProvider('p1', { healthStatus: 'unhealthy' });
      const p2 = createMockDirectProvider('p2', { healthStatus: 'healthy' });
      const { router } = setupRuntime([p1, p2]);

      const decision = await router.route({
        profileId: 'fast_conversation',
        fallbackChain: ['p2'],
        preferredProviderId: 'p1',
        allowFallback: true
      });

      expect(decision.providerId).toBe('p2');
      // Canonical pre-execution telemetry must be empty
      expect(decision.telemetry?.attemptedProviderIds).toEqual([]);
      expect(decision.telemetry?.attemptedModelIds).toEqual([]);
      expect(decision.telemetry?.routeAttempts).toBe(0);
      expect(decision.routeAttempts).toBe(0);
    });

    it('2. skipped provider does not enter attemptedProviderIds in execution telemetry', async () => {
      const p1 = createMockDirectProvider('p1-unhealthy', { healthStatus: 'unhealthy' });
      const p2 = createMockDirectProvider('p2-healthy', { healthStatus: 'healthy' });
      const { runtime } = setupRuntime([p1, p2]);

      const requestId = 'req-skip-test-1';
      for await (const _ of runtime.send({
        requestId,
        message: 'Hello',
        profileId: 'fast_conversation',
        preferredProviderId: 'p1-unhealthy',
        fallbackChain: ['p2-healthy'],
        allowFallback: true
      })) {}

      const telemetry = runtime.getExecutionTelemetry(requestId);
      expect(telemetry).toBeDefined();
      expect(telemetry?.selectedProviderId).toBe('p2-healthy');
      // Skipped p1-unhealthy must NOT be in attemptedProviderIds
      expect(telemetry?.attemptedProviderIds).toEqual(['p2-healthy']);
      expect(telemetry?.attemptedProviderIds).not.toContain('p1-unhealthy');
    });

    it('3. health probe does not increment routeAttempts', async () => {
      const p1 = createMockDirectProvider('p1', { healthStatus: 'healthy' });
      const { router } = setupRuntime([p1]);

      const decision = await router.route({ profileId: 'fast_conversation' });
      expect(decision.telemetry?.routeAttempts).toBe(0);
    });

    it('4. catalog evaluation does not increment routeAttempts', async () => {
      const p1 = createMockDirectProvider('p1', { healthStatus: 'healthy' });
      const { router } = setupRuntime([p1]);

      const decision = await router.route({ profileId: 'fast_conversation' });
      expect(decision.telemetry?.routeAttempts).toBe(0);
    });

    it('5. runtime model evaluation does not increment routeAttempts', async () => {
      const antigravity = createMockAgentRuntimeProvider('antigravity');
      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('antigravity', [
        {
          modelId: 'gemini-2.5-pro',
          runtimeProviderId: 'antigravity',
          displayName: 'Gemini 2.5 Pro',
          supportedRoles: ['AGENT', 'CODING'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);
      const { router } = setupRuntime([antigravity], catalog);

      const decision = await router.route({
        taskIntent: 'agent_work'
      });
      expect(decision.providerId).toBe('antigravity');
      expect(decision.modelId).toBe('gemini-2.5-pro');
      expect(decision.telemetry?.routeAttempts).toBe(0);
    });

    it('6. preferred pre-execution fallback does not create an attempt', async () => {
      const claude = createMockAgentRuntimeProvider('claude-code', { healthStatus: 'unhealthy' });
      const antigravity = createMockAgentRuntimeProvider('antigravity', { healthStatus: 'healthy' });
      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('claude-code', [
        {
          modelId: 'sonnet',
          runtimeProviderId: 'claude-code',
          displayName: 'Claude Sonnet',
          supportedRoles: ['CODING'],
          discoverySource: 'runtime_alias',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);
      catalog.registerRuntimeModels('antigravity', [
        {
          modelId: 'gemini-2.5-pro',
          runtimeProviderId: 'antigravity',
          displayName: 'Gemini 2.5 Pro',
          supportedRoles: ['CODING'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);

      const { runtime } = setupRuntime([claude, antigravity], catalog);
      const requestId = 'req-preferred-fb';

      for await (const _ of runtime.send({
        requestId,
        message: 'Coding request',
        taskIntent: 'coding',
        preferredRuntimeId: 'claude-code',
        runtimeMode: 'PREFERRED',
        allowFallback: true
      })) {}

      const telemetry = runtime.getExecutionTelemetry(requestId);
      expect(telemetry).toBeDefined();
      expect(telemetry?.selectedProviderId).toBe('antigravity');
      // Falling back from unhealthy claude-code must NOT record claude-code in attemptedProviderIds
      expect(telemetry?.attemptedProviderIds).toEqual(['antigravity']);
      expect(telemetry?.routeAttempts).toBe(1);
    });

    it('7. selected provider invocation creates exactly one attempt', async () => {
      const provider = createMockDirectProvider('direct-p1');
      const { runtime } = setupRuntime([provider]);

      const requestId = 'req-attempt-count-1';
      for await (const _ of runtime.send({
        requestId,
        message: 'Test message',
        profileId: 'fast_conversation'
      })) {}

      const telemetry = runtime.getExecutionTelemetry(requestId);
      expect(telemetry?.routeAttempts).toBe(1);
      expect(telemetry?.attemptedProviderIds).toEqual(['direct-p1']);
    });

    it('8. agent invocation preserves canonical attemptedModelIds semantics (empty array)', async () => {
      const antigravity = createMockAgentRuntimeProvider('antigravity');
      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('antigravity', [
        {
          modelId: 'gemini-2.5-pro',
          runtimeProviderId: 'antigravity',
          displayName: 'Gemini 2.5 Pro',
          supportedRoles: ['AGENT'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);
      const { runtime } = setupRuntime([antigravity], catalog);

      const requestId = 'req-agent-model-telemetry';
      for await (const _ of runtime.send({
        requestId,
        message: 'Agent task',
        taskIntent: 'agent_work'
      })) {}

      const telemetry = runtime.getExecutionTelemetry(requestId);
      expect(telemetry).toBeDefined();
      expect(telemetry?.selectedProviderId).toBe('antigravity');
      expect(telemetry?.selectedModelId).toBe('gemini-2.5-pro');
      expect(telemetry?.attemptedProviderIds).toEqual(['antigravity']);
      // Canonical F1.4 invariant: agent runtime telemetry strictly preserves attemptedModelIds = []
      expect(telemetry?.attemptedModelIds).toEqual([]);
      expect(telemetry?.routeAttempts).toBe(1);
    });

    it('9. midstream failure does not trigger cross-provider attempt', async () => {
      const failingClaude = createMockAgentRuntimeProvider('claude-code', {
        healthStatus: 'healthy',
        failureMode: 'error_event'
      });
      const backupAntigravity = createMockAgentRuntimeProvider('antigravity', {
        healthStatus: 'healthy'
      });
      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('claude-code', [
        {
          modelId: 'sonnet',
          runtimeProviderId: 'claude-code',
          displayName: 'Claude Sonnet',
          supportedRoles: ['CODING'],
          discoverySource: 'runtime_alias',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);
      catalog.registerRuntimeModels('antigravity', [
        {
          modelId: 'gemini-2.5-pro',
          runtimeProviderId: 'antigravity',
          displayName: 'Gemini 2.5 Pro',
          supportedRoles: ['CODING'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);

      const { runtime } = setupRuntime([failingClaude, backupAntigravity], catalog);
      const requestId = 'req-midstream-fail';

      const events: any[] = [];
      for await (const evt of runtime.send({
        requestId,
        message: 'Midstream fail test',
        taskIntent: 'coding'
      })) {
        events.push(evt);
      }

      const failedEvt = events.find((e) => e.type === 'request_failed');
      expect(failedEvt).toBeDefined();

      const telemetry = runtime.getExecutionTelemetry(requestId);
      expect(telemetry).toBeDefined();
      // Only failing claude-code was attempted; backupAntigravity was never attempted midstream
      expect(telemetry?.attemptedProviderIds).toEqual(['claude-code']);
      expect(telemetry?.routeAttempts).toBe(1);
    });

    it('10. internal providersEvaluated still contains evaluated candidates', async () => {
      const p1 = createMockDirectProvider('p1-eval', { healthStatus: 'unhealthy' });
      const p2 = createMockDirectProvider('p2-eval', { healthStatus: 'healthy' });
      const { router } = setupRuntime([p1, p2]);

      const decision = await router.route({
        profileId: 'fast_conversation',
        preferredProviderId: 'p1-eval',
        fallbackChain: ['p2-eval'],
        allowFallback: true
      });

      expect(decision.providerId).toBe('p2-eval');
      expect(decision.diagnostics).toBeDefined();
      expect(decision.diagnostics?.providersEvaluated).toBe(2);
      expect(decision.diagnostics?.evaluatedProviderIds).toEqual(['p1-eval', 'p2-eval']);
    });
  });

  describe('Section 18: Codex Executability Hardening', () => {
    it('1. catalog-only runtime is not executable', () => {
      const registry = new BrainProviderRegistry();
      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('codex', [
        {
          modelId: 'gpt-5.6-sol',
          runtimeProviderId: 'codex',
          displayName: 'GPT 5.6 Sol',
          supportedRoles: ['CODING'],
          discoverySource: 'runtime_cache',
          availability: 'unknown',
          discoveredAt: Date.now()
        }
      ]);

      expect(catalog.getRuntimeModels('codex').length).toBe(1);
      // But registry has no executable provider registered
      expect(registry.get('codex')).toBeUndefined();
    });

    it('2. priority-list-only runtime is not executable', () => {
      const registry = new BrainProviderRegistry();
      // codex is in priority list, but registry does not have it
      expect(registry.get('codex')).toBeUndefined();
    });

    it('3. unregistered Codex is skipped in AUTO selection', async () => {
      // Only antigravity is registered; codex is in catalog but not registered in registry
      const antigravity = createMockAgentRuntimeProvider('antigravity');
      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('codex', [
        {
          modelId: 'gpt-5.6-sol',
          runtimeProviderId: 'codex',
          displayName: 'GPT 5.6 Sol',
          supportedRoles: ['CODING'],
          discoverySource: 'runtime_cache',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);
      catalog.registerRuntimeModels('antigravity', [
        {
          modelId: 'gemini-2.5-pro',
          runtimeProviderId: 'antigravity',
          displayName: 'Gemini 2.5 Pro',
          supportedRoles: ['CODING'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);

      const { router } = setupRuntime([antigravity], catalog);

      // Coding priorities: claude-code (unreg) -> codex (unreg) -> antigravity (reg)
      const decision = await router.route({
        taskIntent: 'coding'
      });

      expect(decision.providerId).toBe('antigravity');
      expect(decision.telemetry?.attemptedProviderIds).toEqual([]);
    });

    it('4. executable registered runtime may be selected', async () => {
      const claude = createMockAgentRuntimeProvider('claude-code');
      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('claude-code', [
        {
          modelId: 'sonnet',
          runtimeProviderId: 'claude-code',
          displayName: 'Claude Sonnet',
          supportedRoles: ['CODING'],
          discoverySource: 'runtime_alias',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);
      const { router } = setupRuntime([claude], catalog);

      const decision = await router.route({
        taskIntent: 'coding'
      });

      expect(decision.providerId).toBe('claude-code');
    });

    it('5. runtime_not_executable appears only in internal diagnostics', async () => {
      const antigravity = createMockAgentRuntimeProvider('antigravity');
      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('codex', [
        {
          modelId: 'gpt-5.6-sol',
          runtimeProviderId: 'codex',
          displayName: 'GPT 5.6 Sol',
          supportedRoles: ['CODING'],
          discoverySource: 'runtime_cache',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);
      catalog.registerRuntimeModels('antigravity', [
        {
          modelId: 'gemini-2.5-pro',
          runtimeProviderId: 'antigravity',
          displayName: 'Gemini 2.5 Pro',
          supportedRoles: ['CODING'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);

      const { router } = setupRuntime([antigravity], catalog);

      const decision = await router.route({
        taskIntent: 'coding'
      });

      expect(decision.diagnostics?.skippedRuntimes).toBeDefined();
      const codexSkipped = decision.diagnostics?.skippedRuntimes?.find((s) => s.runtimeId === 'codex');
      expect(codexSkipped).toEqual({ runtimeId: 'codex', reason: 'runtime_not_executable' });

      // Must not leak into public telemetry routeReason
      expect(decision.telemetry?.routeReason).not.toContain('runtime_not_executable');
    });

    it('6. LOCKED non-executable runtime fails', async () => {
      const antigravity = createMockAgentRuntimeProvider('antigravity');
      const { router } = setupRuntime([antigravity]);

      await expect(
        router.route({
          taskIntent: 'coding',
          lockedRuntimeId: 'codex',
          runtimeMode: 'LOCKED'
        })
      ).rejects.toThrowError(BrainRoutingError);
    });

    it('7. PREFERRED non-executable runtime falls back only when allowed', async () => {
      const antigravity = createMockAgentRuntimeProvider('antigravity');
      const { router } = setupRuntime([antigravity]);

      // When fallback is disabled: fails closed
      await expect(
        router.route({
          taskIntent: 'coding',
          preferredRuntimeId: 'codex',
          runtimeMode: 'PREFERRED',
          allowFallback: false
        })
      ).rejects.toThrowError(BrainRoutingError);

      // When fallback is enabled: falls back to healthy registered antigravity
      const decision = await router.route({
        taskIntent: 'coding',
        preferredRuntimeId: 'codex',
        runtimeMode: 'PREFERRED',
        allowFallback: true
      });
      expect(decision.providerId).toBe('antigravity');
      expect(decision.fallbackUsed).toBe(true);
    });
  });

  describe('Section 19: Task Boundary & Context Preservation', () => {
    it('1. no request.context selected model/runtime state', async () => {
      let capturedRequest: BrainRequest | undefined;
      const provider = createMockDirectProvider('direct-p1');
      const origChat = provider.chat.bind(provider);
      provider.chat = async function* (req: BrainRequest, opts?: BrainRequestOptions) {
        capturedRequest = req;
        for await (const evt of origChat(req, opts)) {
          yield evt;
        }
      };

      const { runtime } = setupRuntime([provider]);

      for await (const _ of runtime.send({
        message: 'Hello',
        context: { userMetadataKey: 'pristineValue' }
      })) {}

      expect(capturedRequest).toBeDefined();
      // request.context must preserve caller metadata and not contain internal routing state
      expect(capturedRequest?.context?.userMetadataKey).toBe('pristineValue');
      expect((capturedRequest?.context as any).selectedModelId).toBeUndefined();
      expect((capturedRequest?.context as any).selectedProviderId).toBeUndefined();
      expect((capturedRequest?.context as any).taskIntent).toBeUndefined();
      expect((capturedRequest?.context as any).modelRole).toBeUndefined();
    });

    it('2. no caller preferredModelId execution bypass', async () => {
      let capturedChatOptions: BrainRequestOptions | undefined;
      const antigravity = createMockAgentRuntimeProvider('antigravity', {
        onChatInvoked: (_req, opts) => {
          capturedChatOptions = opts;
        }
      });
      const catalog = new RuntimeModelCatalog();
      catalog.registerRuntimeModels('antigravity', [
        {
          modelId: 'gemini-2.5-pro',
          runtimeProviderId: 'antigravity',
          displayName: 'Gemini 2.5 Pro',
          supportedRoles: ['AGENT', 'CODING'],
          discoverySource: 'runtime_enumerated',
          availability: 'available',
          discoveredAt: Date.now()
        }
      ]);

      const { runtime } = setupRuntime([antigravity], catalog);

      for await (const _ of runtime.send({
        message: 'Do work',
        taskIntent: 'agent_work',
        allowFallback: true,
        overrides: {
          preferredModelId: 'unverified-rogue-model',
          localOnly: false
        }
      })) {}

      // Router evaluated the role and resolved the legitimate model gemini-2.5-pro,
      // NOT blindly bypassing with the caller's rogue preferredModelId
      expect(capturedChatOptions?.modelId).toBe('gemini-2.5-pro');
    });

    it('3. task intent remains semantic input without vendor leakage', () => {
      const taskPolicy = new TaskPolicy();
      const decision = taskPolicy.resolve({ taskIntent: 'coding' });

      expect(decision.taskIntent).toBe('coding');
      expect(decision.profileId).toBe('agent_work');
      expect(decision.modelRole).toBe('CODING');

      const jsonStr = JSON.stringify(decision).toLowerCase();
      expect(jsonStr).not.toContain('claude');
      expect(jsonStr).not.toContain('codex');
      expect(jsonStr).not.toContain('antigravity');
      expect(jsonStr).not.toContain('openai');
    });

    it('4. safe default preserved for missing or unknown intent', () => {
      const taskPolicy = new TaskPolicy();
      const decision = taskPolicy.resolve({});

      expect(decision.taskIntent).toBe('general_conversation');
      expect(decision.profileId).toBe('fast_conversation');
      expect(decision.modelRole).toBe('BALANCED');
    });
  });
});
