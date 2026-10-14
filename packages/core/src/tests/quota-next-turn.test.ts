import { describe, expect, it } from 'vitest';
import type {
  BrainCapabilities,
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions
} from '@mave/contracts';
import { BrainProviderRegistry } from '../brain/provider-registry.js';
import { BrainRouter } from '../brain/router.js';
import { RuntimeModelCatalog } from '../brain/runtime-models/catalog.js';
import { RuntimeQuotaStore } from '../brain/quota/index.js';
import { ConversationRuntime } from '../conversation/runtime.js';
import { SessionManager } from '../conversation/session-manager.js';
import { ContextManager } from '../conversation/context-manager.js';

interface MockRuntimeConfig {
  id: string;
  onChat?: (req: BrainRequest, options?: BrainRequestOptions) => void;
  behavior?: 'succeed' | 'quota_error' | 'rate_limit_error';
  resetAt?: number;
}

function createConfigurableMockRuntime(config: MockRuntimeConfig): BrainProvider {
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
    id: config.id,
    getCapabilities: () => caps,
    health: async () => ({ status: 'healthy', checkedAt: Date.now() }),
    async *chat(req: BrainRequest, chatOptions?: BrainRequestOptions): AsyncIterable<BrainEvent> {
      config.onChat?.(req, chatOptions);

      yield { type: 'started', requestId: req.requestId, providerId: config.id, modelId: chatOptions?.modelId };

      if (config.behavior === 'quota_error') {
        yield {
          type: 'error',
          requestId: req.requestId,
          error: {
            code: 'quota_limited',
            message: `Subscription quota limit reached for ${config.id}`,
            retryable: false,
            details: config.resetAt ? { resetAt: config.resetAt } : undefined
          }
        };
        return;
      }

      if (config.behavior === 'rate_limit_error') {
        yield {
          type: 'error',
          requestId: req.requestId,
          error: {
            code: 'rate_limited',
            message: `429 Rate limited on ${config.id}`,
            retryable: true,
            details: config.resetAt ? { resetAt: config.resetAt } : undefined
          }
        };
        return;
      }

      yield { type: 'delta', requestId: req.requestId, text: `Output from ${config.id}` };
      yield { type: 'completed', requestId: req.requestId, text: `Output from ${config.id}` };
    }
  };
}

describe('F1.5-S4 Next-Turn Quota Routing (Multi-Turn Simulation)', () => {
  it('Turn 1 fails cleanly with quota error without mid-stream fallback; Turn 2 skips exhausted runtime and routes to next eligible candidate', async () => {
    let mockCurrentTime = 1000;
    const clock = () => mockCurrentTime;

    const registry = new BrainProviderRegistry();
    const catalog = new RuntimeModelCatalog();
    const quotaStore = new RuntimeQuotaStore({ clock });

    const claudeInvocations: string[] = [];
    const codexInvocations: string[] = [];

    // Claude Code initially encounters quota error
    const claude = createConfigurableMockRuntime({
      id: 'claude-code',
      behavior: 'quota_error',
      resetAt: 5000,
      onChat: (req) => claudeInvocations.push(req.requestId)
    });

    // Codex succeeds
    const codex = createConfigurableMockRuntime({
      id: 'codex',
      behavior: 'succeed',
      onChat: (req) => codexInvocations.push(req.requestId)
    });

    registry.register(claude, { kind: 'agent_runtime_provider', accessClass: 'subscription' });
    registry.register(codex, { kind: 'agent_runtime_provider', accessClass: 'subscription' });

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

    const router = new BrainRouter({
      registry,
      runtimeModelCatalog: catalog,
      quotaStore,
      runtimePriorities: {
        FAST: ['claude-code', 'codex'],
        BALANCED: ['claude-code', 'codex'],
        REASONING: ['claude-code'],
        CODING: ['claude-code', 'codex'],
        AGENT: ['claude-code', 'codex']
      }
    });

    const sessionManager = new SessionManager();
    const runtime = new ConversationRuntime({
      sessionManager,
      contextManager: new ContextManager(),
      router,
      quotaStore,
      clock
    });

    // ------------------------------------------------------------------------
    // TURN 1: Claude Code is primary, runs, and emits quota_limited error
    // ------------------------------------------------------------------------
    const session = sessionManager.createSession();
    const turn1Events = [];
    for await (const ev of runtime.send({
      sessionId: session.id,
      requestId: 'turn-1-req',
      message: 'Write a quicksort in TypeScript',
      taskIntent: 'coding'
    })) {
      turn1Events.push(ev);
    }

    // Turn 1 assertions
    expect(claudeInvocations).toHaveLength(1);
    expect(codexInvocations).toHaveLength(0); // Codex must NOT have been called mid-stream!

    const lastTurn1Event = turn1Events[turn1Events.length - 1];
    expect(lastTurn1Event?.type).toBe('request_failed');
    if (lastTurn1Event && lastTurn1Event.type === 'request_failed') {
      expect(lastTurn1Event.error.code).toBe('quota_limited');
      expect(lastTurn1Event.error.message).toContain('quota limit reached');
    }

    // Invariant: Turn 1 execution telemetry shows routeAttempts = 1
    const t1Telemetry = runtime.getExecutionTelemetry('turn-1-req');
    expect(t1Telemetry).toBeDefined();
    expect(t1Telemetry?.selectedProviderId).toBe('claude-code');
    expect(t1Telemetry?.routeAttempts).toBe(1);

    // Invariant: quotaStore now knows claude-code is quota_limited
    expect(quotaStore.isBlocked('claude-code')).toBe(true);
    const claudeQuotaState = quotaStore.get('claude-code');
    expect(claudeQuotaState.status).toBe('quota_limited');
    expect(claudeQuotaState.resetAt).toBe(5000);

    // ------------------------------------------------------------------------
    // TURN 2: User sends second request; router pre-execution skips claude-code
    // and cleanly routes to codex.
    // ------------------------------------------------------------------------
    mockCurrentTime = 2000; // Still before resetAt=5000
    const turn2Events = [];
    for await (const ev of runtime.send({
      sessionId: session.id,
      requestId: 'turn-2-req',
      message: 'Can you try again with another model?',
      taskIntent: 'coding'
    })) {
      turn2Events.push(ev);
    }

    // Turn 2 assertions
    // Claude was NOT invoked on Turn 2!
    expect(claudeInvocations).toHaveLength(1);
    // Codex was invoked on Turn 2
    expect(codexInvocations).toHaveLength(1);

    const providerSelectedEvent = turn2Events.find((e) => e.type === 'provider_selected');
    expect(providerSelectedEvent).toBeDefined();
    if (providerSelectedEvent && providerSelectedEvent.type === 'provider_selected') {
      expect(providerSelectedEvent.providerId).toBe('codex');
    }

    const completedEvent = turn2Events.find((e) => e.type === 'response_completed');
    expect(completedEvent).toBeDefined();
    if (completedEvent && completedEvent.type === 'response_completed') {
      expect(completedEvent.text).toBe('Output from codex');
    }

    // Invariant: Turn 2 execution telemetry shows codex, attemptedProviderIds only has codex
    const t2Telemetry = runtime.getExecutionTelemetry('turn-2-req');
    expect(t2Telemetry).toBeDefined();
    expect(t2Telemetry?.selectedProviderId).toBe('codex');
    expect(t2Telemetry?.attemptedProviderIds).toEqual(['codex']);
    expect(t2Telemetry?.routeAttempts).toBe(1);

    // Invariant: Successful Turn 2 records codex as 'available'
    expect(quotaStore.get('codex').status).toBe('available');
    expect(quotaStore.isBlocked('codex')).toBe(false);

    // ------------------------------------------------------------------------
    // TURN 3: Advance time past resetAt; claude-code unblocks (status expires to unknown)
    // and becomes candidate #1 again under priority_first.
    // ------------------------------------------------------------------------
    mockCurrentTime = 6000; // Past resetAt=5000
    expect(quotaStore.isBlocked('claude-code')).toBe(false);
    expect(quotaStore.get('claude-code').status).toBe('unknown');

    // Turn 3: Claude is evaluated again as primary
    const turn3Events = [];
    for await (const ev of runtime.send({
      sessionId: session.id,
      requestId: 'turn-3-req',
      message: 'Now try Claude again',
      taskIntent: 'coding'
    })) {
      turn3Events.push(ev);
    }

    // Claude was contacted for Turn 3
    expect(claudeInvocations).toHaveLength(2);
  });
});
