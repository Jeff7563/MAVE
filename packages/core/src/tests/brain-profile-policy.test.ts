import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_BRAIN_PROFILES,
  type BrainCapabilities,
  type BrainProvider,
  type ProviderHealth
} from '@mave/contracts';
import {
  BrainProfilePolicy,
  BrainProfilePolicyError,
  BrainProviderRegistry,
  BrainRouter,
  BrainRoutingError
} from '../brain/index.js';

class TestMockProvider implements BrainProvider {
  readonly id: string;
  private readonly capabilities: BrainCapabilities;
  private readonly healthStatus: ProviderHealth['status'];

  constructor(
    id: string,
    capabilities: Partial<BrainCapabilities> = {},
    healthStatus: ProviderHealth['status'] = 'healthy'
  ) {
    this.id = id;
    this.capabilities = {
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
      ...capabilities
    };
    this.healthStatus = healthStatus;
  }

  getCapabilities(): BrainCapabilities {
    return this.capabilities;
  }

  async health(): Promise<ProviderHealth> {
    return {
      status: this.healthStatus,
      message: `${this.id} is ${this.healthStatus}`,
      checkedAt: Date.now()
    };
  }

  async *chat() {
    yield { type: 'started' as const, requestId: 'r1', providerId: this.id };
    yield { type: 'completed' as const, requestId: 'r1', text: 'ok' };
  }
}

describe('BrainProfilePolicy & Profile Routing', () => {
  let policy: BrainProfilePolicy;
  let registry: BrainProviderRegistry;
  let mockProvider: TestMockProvider;
  let antigravityCandidate: TestMockProvider;

  beforeEach(() => {
    policy = new BrainProfilePolicy();
    registry = new BrainProviderRegistry();

    // mock has streaming: true, fastChat: true, coding: false, toolUse: false, reasoning: false
    mockProvider = new TestMockProvider('mock', { streaming: true, fastChat: true });
    // antigravity candidate has streaming: true, fastChat: true, coding: false, toolUse: false, reasoning: false
    antigravityCandidate = new TestMockProvider('antigravity', { streaming: true, fastChat: true });

    registry.register(mockProvider);
    registry.register(antigravityCandidate);
  });

  describe('1. Profile Definitions & Stability', () => {
    it('defines all canonical profile IDs', () => {
      const profiles = policy.getProfiles();
      const ids = profiles.map((p) => p.id);

      expect(ids).toContain('fast_conversation');
      expect(ids).toContain('deep_reasoning');
      expect(ids).toContain('agent_work');
      expect(ids).toContain('research');
      expect(ids).toContain('local_offline');
      expect(profiles).toHaveLength(5);
      expect(profiles).toEqual(Object.values(DEFAULT_BRAIN_PROFILES));
    });

    it('has stable profile IDs matching DEFAULT_BRAIN_PROFILES', () => {
      expect(policy.hasProfile('fast_conversation')).toBe(true);
      expect(policy.hasProfile('deep_reasoning')).toBe(true);
      expect(policy.hasProfile('agent_work')).toBe(true);
      expect(policy.hasProfile('research')).toBe(true);
      expect(policy.hasProfile('local_offline')).toBe(true);
      expect(policy.hasProfile('unknown_profile')).toBe(false);
    });

    it('requires streaming and fastChat for fast_conversation profile', () => {
      const res = policy.resolve('fast_conversation');
      expect(res.requiredCapabilities.streaming).toBe(true);
      expect(res.requiredCapabilities.fastChat).toBe(true);
      expect(res.definition.latencyClass).toBe('interactive');
      expect(res.allowFallback).toBe(true);
    });

    it('does not require M5 tool capability for agent_work profile in M2', () => {
      const res = policy.resolve('agent_work');
      expect(res.requiredCapabilities.coding).toBe(true);
      // In M2, toolUse MUST NOT be required by agent_work profile
      expect(res.requiredCapabilities.toolUse).toBeFalsy();
      expect(res.definition.latencyClass).toBe('long_running');
    });

    it('rejects unknown profiles cleanly with BrainProfilePolicyError', () => {
      expect(() => policy.resolve('quantum_superintelligence')).toThrow(BrainProfilePolicyError);
      try {
        policy.resolve('quantum_superintelligence');
      } catch (err) {
        expect(err).toBeInstanceOf(BrainProfilePolicyError);
        expect((err as BrainProfilePolicyError).code).toBe('unknown_profile');
        expect((err as BrainProfilePolicyError).message).toContain('quantum_superintelligence');
      }
    });

    it('is strictly deterministic (identical outputs for identical inputs)', () => {
      const r1 = policy.resolve('fast_conversation');
      const r2 = policy.resolve('fast_conversation');

      expect(r1).toEqual(r2);
      expect(r1.requiredCapabilities).toEqual(r2.requiredCapabilities);
      expect(r1.allowFallback).toBe(r2.allowFallback);
    });
  });

  describe('2. Explicit Overrides & Routing Integration', () => {
    it('preserves caller explicit preferredProviderId override', () => {
      const res = policy.resolve('fast_conversation', {
        preferredProviderId: 'antigravity'
      });

      expect(res.preferredProviderId).toBe('antigravity');
    });

    it('passes resolved profile capabilities into BrainRouter', async () => {
      const router = new BrainRouter({
        registry,
        profilePolicy: policy,
        defaultProvider: 'mock'
      });

      // Both mock and antigravity satisfy fast_conversation (streaming: true, fastChat: true)
      const decision = await router.route({
        profileId: 'fast_conversation'
      });

      expect(decision.providerId).toBe('mock');
      expect(decision.fallbackUsed).toBe(false);
    });

    it('routes to explicit preferredProviderId when both profileId and preferredProviderId are supplied', async () => {
      const router = new BrainRouter({
        registry,
        profilePolicy: policy,
        defaultProvider: 'mock'
      });

      const decision = await router.route({
        profileId: 'fast_conversation',
        preferredProviderId: 'antigravity'
      });

      expect(decision.providerId).toBe('antigravity');
      expect(decision.fallbackUsed).toBe(false);
    });

    it('fails cleanly when requested profile requires capabilities no registered provider supports', async () => {
      const router = new BrainRouter({
        registry,
        profilePolicy: policy,
        defaultProvider: 'mock'
      });

      // deep_reasoning requires reasoning: true, which neither mock nor antigravity supports
      await expect(
        router.route({
          profileId: 'deep_reasoning'
        })
      ).rejects.toThrow(BrainRoutingError);
    });

    it('enforces allowFallback = false for profiles that forbid fallback', async () => {
      // Create a coding provider for agent_work
      const codingProvider = new TestMockProvider(
        'coding-brain',
        { coding: true },
        'unhealthy' // Unhealthy!
      );
      registry.register(codingProvider);

      const router = new BrainRouter({
        registry,
        profilePolicy: policy,
        defaultProvider: 'mock',
        fallbackChain: ['mock']
      });

      // agent_work has allowFallback = false and requires coding: true
      // Since coding-brain is unhealthy and fallback is disallowed, it should throw
      await expect(
        router.route({
          profileId: 'agent_work',
          preferredProviderId: 'coding-brain'
        })
      ).rejects.toThrow(BrainRoutingError);
    });

    it('preserves existing mock routing path when no profileId is supplied', async () => {
      const router = new BrainRouter({
        registry,
        defaultProvider: 'mock'
      });

      const decision = await router.route();
      expect(decision.providerId).toBe('mock');
      expect(decision.fallbackUsed).toBe(false);
    });

    it('preserves existing antigravity routing path when no profileId is supplied', async () => {
      const router = new BrainRouter({
        registry,
        defaultProvider: 'mock'
      });

      const decision = await router.route({
        preferredProviderId: 'antigravity'
      });
      expect(decision.providerId).toBe('antigravity');
      expect(decision.fallbackUsed).toBe(false);
    });
  });
});
