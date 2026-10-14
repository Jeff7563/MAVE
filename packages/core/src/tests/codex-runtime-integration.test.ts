import { describe, expect, it } from 'vitest';
import type {
  BrainCapabilities,
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ProviderHealth
} from '@mave/contracts';
import { BrainProviderRegistry } from '../brain/provider-registry.js';
import { BrainRouter } from '../brain/router.js';
import { BrainRoutingError } from '../brain/types.js';
import { RuntimeModelCatalog } from '../brain/runtime-models/catalog.js';
import { ConversationRuntime } from '../conversation/runtime.js';
import { SessionManager } from '../conversation/session-manager.js';
import { ContextManager } from '../conversation/context-manager.js';

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
    toolUse: false,
    multimodal: false,
    vision: false,
    webResearch: false,
    longContext: true,
    local: false,
    cancellation: true
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

      yield { type: 'delta', requestId: req.requestId, text: `Output from ${id}` };
      yield { type: 'completed', requestId: req.requestId, text: `Output from ${id}` };
    }
  };
}

function seedRuntimeCatalog(catalog: RuntimeModelCatalog) {
  catalog.registerRuntimeModels('claude-code', [
    {
      modelId: 'claude-3-5-sonnet',
      runtimeProviderId: 'claude-code',
      displayName: 'Claude 3.5 Sonnet',
      supportedRoles: ['CODING', 'BALANCED', 'FAST', 'AGENT'],
      discoverySource: 'runtime_enumerated',
      availability: 'available',
      discoveredAt: Date.now()
    }
  ]);

  catalog.registerRuntimeModels('codex', [
    {
      modelId: 'gpt-5.6-sol',
      runtimeProviderId: 'codex',
      displayName: 'GPT-5.6-Sol (Codex)',
      supportedRoles: ['CODING', 'AGENT', 'BALANCED', 'REASONING'],
      discoverySource: 'runtime_cache',
      availability: 'available',
      discoveredAt: Date.now()
    },
    {
      modelId: 'gpt-6-luna',
      runtimeProviderId: 'codex',
      displayName: 'GPT-6-Luna (Codex)',
      supportedRoles: ['FAST', 'BALANCED'],
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
      supportedRoles: ['REASONING', 'CODING', 'AGENT'],
      discoverySource: 'runtime_enumerated',
      availability: 'available',
      discoveredAt: Date.now()
    }
  ]);
}

function setupTestEnvironment(providers: BrainProvider[], customCatalog?: RuntimeModelCatalog) {
  const registry = new BrainProviderRegistry();
  for (const p of providers) {
    registry.register(p);
  }
  const catalog = customCatalog ?? new RuntimeModelCatalog();
  if (!customCatalog) {
    seedRuntimeCatalog(catalog);
  }

  const router = new BrainRouter({
    registry,
    runtimeModelCatalog: catalog
  });

  const sessionManager = new SessionManager();
  const contextManager = new ContextManager();
  const runtime = new ConversationRuntime({
    sessionManager,
    contextManager,
    router
  });

  return { registry, catalog, router, runtime };
}

describe('Codex Subscription Runtime Normalization (F1.5-S3.2)', () => {
  describe('Provider Registration & Metadata Invariants', () => {
    it('is recognized as runtime_not_executable before registration', async () => {
      // Register claude-code (unhealthy) and antigravity (healthy), but NOT codex
      const claude = createMockAgentRuntimeProvider('claude-code', { healthStatus: 'unhealthy' });
      const antigravity = createMockAgentRuntimeProvider('antigravity', { healthStatus: 'healthy' });
      const { router } = setupTestEnvironment([claude, antigravity]);

      const decision = await router.route({ taskIntent: 'coding' });

      // Claude was unhealthy, Codex was not registered (runtime_not_executable), so Antigravity was selected
      expect(decision.providerId).toBe('antigravity');
      expect(decision.diagnostics?.skippedRuntimes).toContainEqual({
        runtimeId: 'codex',
        reason: 'runtime_not_executable'
      });
      // Pre-execution attemptedProviderIds is empty per F1.5-S3.1
      expect(decision.telemetry?.attemptedProviderIds).toEqual([]);
    });

    it('registers Codex with canonical agent_runtime_provider, subscription, and official_cli metadata', () => {
      const codex = createMockAgentRuntimeProvider('codex');
      const { registry } = setupTestEnvironment([codex]);

      expect(registry.has('codex')).toBe(true);
      const metadata = registry.getProviderMetadata('codex');

      expect(metadata.id).toBe('codex');
      expect(metadata.displayName).toBe('OpenAI Codex');
      expect(metadata.kind).toBe('agent_runtime_provider');
      expect(metadata.accessClass).toBe('subscription');
      expect(metadata.accessPath).toBe('official_cli');
      expect(metadata.capabilities.fastChat).toBe(false);
      expect(metadata.capabilities.toolUse).toBe(false);
    });

    it('allows Codex subscription routing under default paidApiPolicy: "disabled"', async () => {
      const codex = createMockAgentRuntimeProvider('codex');
      const { router } = setupTestEnvironment([codex]);

      const decision = await router.route({
        taskIntent: 'coding',
        preferredRuntimeId: 'codex'
      });

      expect(decision.providerId).toBe('codex');
      expect(decision.modelRole).toBe('CODING');
      expect(decision.modelId).toBe('gpt-5.6-sol');
    });

    it('rejects Codex under localOnly: true because Codex is a subscription cloud runtime', async () => {
      const codex = createMockAgentRuntimeProvider('codex');
      const { router } = setupTestEnvironment([codex]);

      await expect(
        router.route({
          taskIntent: 'coding',
          preferredRuntimeId: 'codex',
          localOnly: true
        })
      ).rejects.toThrow(BrainRoutingError);
    });
  });

  describe('S3 Intelligence Routing & CODING Fallback Chain', () => {
    it('CODING AUTO: selects Claude Code first when both Claude Code and Codex are healthy', async () => {
      const claude = createMockAgentRuntimeProvider('claude-code', { healthStatus: 'healthy' });
      const codex = createMockAgentRuntimeProvider('codex', { healthStatus: 'healthy' });
      const antigravity = createMockAgentRuntimeProvider('antigravity', { healthStatus: 'healthy' });
      const { router } = setupTestEnvironment([claude, codex, antigravity]);

      const decision = await router.route({ taskIntent: 'coding' });

      // Under default CODING priorities: ['claude-code', 'codex', 'antigravity']
      expect(decision.providerId).toBe('claude-code');
      expect(decision.modelRole).toBe('CODING');
      expect(decision.telemetry?.attemptedProviderIds).toEqual([]);
    });

    it('CODING AUTO: falls back to Codex when Claude Code is unavailable or unhealthy', async () => {
      const claude = createMockAgentRuntimeProvider('claude-code', { healthStatus: 'unhealthy' });
      const codex = createMockAgentRuntimeProvider('codex', { healthStatus: 'healthy' });
      const antigravity = createMockAgentRuntimeProvider('antigravity', { healthStatus: 'healthy' });
      const { router } = setupTestEnvironment([claude, codex, antigravity]);

      const decision = await router.route({ taskIntent: 'coding' });

      // Claude is unhealthy -> Codex becomes the next eligible executable runtime
      expect(decision.providerId).toBe('codex');
      expect(decision.modelRole).toBe('CODING');
      expect(decision.modelId).toBe('gpt-5.6-sol');
    });

    it('CODING AUTO: falls back to Antigravity when both Claude Code and Codex are unavailable', async () => {
      const claude = createMockAgentRuntimeProvider('claude-code', { healthStatus: 'unhealthy' });
      const codex = createMockAgentRuntimeProvider('codex', { healthStatus: 'unhealthy' });
      const antigravity = createMockAgentRuntimeProvider('antigravity', { healthStatus: 'healthy' });
      const { router } = setupTestEnvironment([claude, codex, antigravity]);

      const decision = await router.route({ taskIntent: 'coding' });

      expect(decision.providerId).toBe('antigravity');
      expect(decision.modelRole).toBe('CODING');
    });

    it('LOCKED Codex: routes exclusively to Codex and fails closed without silent fallback if Codex is unavailable', async () => {
      const claude = createMockAgentRuntimeProvider('claude-code', { healthStatus: 'healthy' });
      const codex = createMockAgentRuntimeProvider('codex', { healthStatus: 'unhealthy' });
      const antigravity = createMockAgentRuntimeProvider('antigravity', { healthStatus: 'healthy' });
      const { router } = setupTestEnvironment([claude, codex, antigravity]);

      // Invariant: LOCKED mode must fail closed; silent fallback to claude-code or antigravity is forbidden
      await expect(
        router.route({
          taskIntent: 'coding',
          lockedRuntimeId: 'codex',
          runtimeMode: 'LOCKED'
        })
      ).rejects.toThrow(BrainRoutingError);
    });

    it('PREFERRED Codex: routes to Codex even if Claude Code is earlier in default priorities', async () => {
      const claude = createMockAgentRuntimeProvider('claude-code', { healthStatus: 'healthy' });
      const codex = createMockAgentRuntimeProvider('codex', { healthStatus: 'healthy' });
      const { router } = setupTestEnvironment([claude, codex]);

      const decision = await router.route({
        taskIntent: 'coding',
        preferredRuntimeId: 'codex',
        runtimeMode: 'PREFERRED'
      });

      expect(decision.providerId).toBe('codex');
      expect(decision.modelRole).toBe('CODING');
      expect(decision.modelId).toBe('gpt-5.6-sol');
    });
  });

  describe('Model Handoff, Telemetry & Execution Guarantee', () => {
    it('hands off resolved runtime model through options.modelId and tracks execution telemetry correctly', async () => {
      let capturedModelId: string | undefined;
      const codex = createMockAgentRuntimeProvider('codex', {
        onChatInvoked: (_req, opts) => {
          capturedModelId = opts?.modelId;
        }
      });
      const { runtime } = setupTestEnvironment([codex]);

      const requestId = 'req-codex-handoff-telemetry';
      for await (const _ of runtime.send({
        requestId,
        message: 'Implement quicksort',
        taskIntent: 'coding',
        preferredRuntimeId: 'codex'
      })) {}

      // Model handoff verification
      expect(capturedModelId).toBe('gpt-5.6-sol');

      // Canonical F1.5-S3.1 telemetry verification
      const telemetry = runtime.getExecutionTelemetry(requestId);
      expect(telemetry).toBeDefined();
      expect(telemetry?.selectedProviderId).toBe('codex');
      expect(telemetry?.selectedModelId).toBe('gpt-5.6-sol');
      expect(telemetry?.attemptedProviderIds).toEqual(['codex']);
      expect(telemetry?.attemptedModelIds).toEqual([]); // Agent runtime model remains internal
      expect(telemetry?.routeAttempts).toBe(1);
    });

    it('forbids cross-provider fallback once Codex invocation begins (midstream failure)', async () => {
      const failingCodex = createMockAgentRuntimeProvider('codex', {
        failureMode: 'error_event'
      });
      const antigravity = createMockAgentRuntimeProvider('antigravity', { healthStatus: 'healthy' });
      const { runtime } = setupTestEnvironment([failingCodex, antigravity]);

      const requestId = 'req-midstream-codex';
      const events: any[] = [];
      for await (const ev of runtime.send({
        requestId,
        message: 'Run task',
        taskIntent: 'coding',
        preferredRuntimeId: 'codex'
      })) {
        events.push(ev);
      }

      // Midstream failure yields request_failed event; no secondary provider is invoked
      const failedEvt = events.find((e) => e.type === 'request_failed');
      expect(failedEvt).toBeDefined();

      const telemetry = runtime.getExecutionTelemetry(requestId);
      expect(telemetry?.attemptedProviderIds).toEqual(['codex']);
      expect(telemetry?.selectedProviderId).toBe('codex');
    });
  });
});
