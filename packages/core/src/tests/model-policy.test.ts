import { describe, it, expect } from 'vitest';
import type {
  BrainCapabilities,
  ModelCatalogSnapshot,
  ModelDescriptor
} from '@mave/contracts';
import { ModelPolicy } from '../brain/model-policy.js';

function createCatalog(providerId: string, models: ModelDescriptor[]): ModelCatalogSnapshot {
  return {
    providerId,
    models,
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

describe('ModelPolicy', () => {
  describe('1. Availability & Deprecation Filtering', () => {
    it('selects only models with status === "available"', () => {
      const models = [
        createModel({ id: 'mod-avail', status: 'available' }),
        createModel({ id: 'mod-unavail', status: 'unavailable' }),
        createModel({ id: 'mod-deprec', status: 'deprecated' }),
        createModel({ id: 'mod-quota', status: 'quota_limited' }),
        createModel({ id: 'mod-rate', status: 'rate_limited' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-avail');
      expect(res.eligibleCount).toBe(1);
      expect(res.candidateCount).toBe(5);
    });

    it('returns success: false when all models in catalog are unavailable or deprecated', () => {
      const models = [
        createModel({ id: 'mod-deprec', status: 'deprecated' }),
        createModel({ id: 'mod-quota', status: 'quota_limited' }),
        createModel({ id: 'mod-rate', status: 'rate_limited' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog
      });

      expect(res.success).toBe(false);
      expect(res.eligibleCount).toBe(0);
      expect(res.reason).toContain('No eligible model satisfies selection constraints');
      expect(res.rejections?.['mod-deprec']?.[0]).toContain('model_unavailable');
    });
  });

  describe('2. Brain Profile Quality Precedence', () => {
    it('fast_conversation prefers fast + interactive over balanced and reasoning', () => {
      const models = [
        createModel({ id: 'mod-reasoning', qualityClass: 'reasoning', latencyClass: 'heavy' }),
        createModel({ id: 'mod-balanced', qualityClass: 'balanced', latencyClass: 'interactive' }),
        createModel({ id: 'mod-fast', qualityClass: 'fast', latencyClass: 'interactive' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        profileId: 'fast_conversation'
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-fast');
    });

    it('fast_conversation falls back to balanced if no fast model exists', () => {
      const models = [
        createModel({ id: 'mod-reasoning', qualityClass: 'reasoning', latencyClass: 'heavy' }),
        createModel({ id: 'mod-balanced', qualityClass: 'balanced', latencyClass: 'balanced' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        profileId: 'fast_conversation'
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-balanced');
    });

    it('deep_reasoning prefers reasoning over balanced and fast', () => {
      const models = [
        createModel({ id: 'mod-fast', qualityClass: 'fast', latencyClass: 'interactive' }),
        createModel({ id: 'mod-balanced', qualityClass: 'balanced', latencyClass: 'balanced' }),
        createModel({ id: 'mod-reasoning', qualityClass: 'reasoning', latencyClass: 'heavy' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        profileId: 'deep_reasoning'
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-reasoning');
    });

    it('research prefers balanced over reasoning and fast', () => {
      const models = [
        createModel({ id: 'mod-fast', qualityClass: 'fast' }),
        createModel({ id: 'mod-reasoning', qualityClass: 'reasoning' }),
        createModel({ id: 'mod-balanced', qualityClass: 'balanced' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        profileId: 'research'
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-balanced');
    });
  });

  describe('3. Privacy & Fail-Closed Enforcement', () => {
    it('selects only local_only models when effectiveLocalOnly is true', () => {
      const models = [
        createModel({ id: 'mod-cloud', privacyClass: 'standard_cloud' }),
        createModel({ id: 'mod-pcloud', privacyClass: 'private_cloud' }),
        createModel({
          id: 'mod-local',
          privacyClass: 'local_only',
          capabilities: { local: true }
        })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        effectiveLocalOnly: true
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-local');
      expect(res.rejections?.['mod-cloud']?.[0]).toContain('privacy_mismatch');
      expect(res.rejections?.['mod-pcloud']?.[0]).toContain('privacy_mismatch');
    });

    it('fails closed when localOnly is requested but no local_only model is available', () => {
      const models = [
        createModel({ id: 'mod-cloud-1', privacyClass: 'standard_cloud' }),
        createModel({ id: 'mod-cloud-2', privacyClass: 'private_cloud' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        effectiveLocalOnly: true
      });

      expect(res.success).toBe(false);
      expect(res.eligibleCount).toBe(0);
      expect(res.reason).toContain('fail closed');
    });

    it('request.overrides.localOnly cannot be weakened by preferredModelId', () => {
      const models = [
        createModel({ id: 'mod-cloud', privacyClass: 'standard_cloud' }),
        createModel({
          id: 'mod-local',
          privacyClass: 'local_only',
          capabilities: { local: true }
        })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        overrides: {
          localOnly: true,
          preferredModelId: 'mod-cloud'
        },
        profileResolution: {
          profileId: 'fast_conversation',
          definition: {
            id: 'fast_conversation',
            description: '',
            requiredCapabilities: {},
            latencyClass: 'interactive',
            allowFallback: false
          },
          requiredCapabilities: {},
          allowFallback: false
        }
      });

      expect(res.success).toBe(false);
      expect(res.rejections?.['mod-cloud']?.[0]).toContain('privacy_mismatch');
    });

    it('strictly enforces fail-closed privacy when contradictory privacy inputs are provided', () => {
      const models = [
        createModel({ id: 'mod-cloud', privacyClass: 'standard_cloud' }),
        createModel({
          id: 'mod-local',
          privacyClass: 'local_only',
          capabilities: { local: true }
        })
      ];

      const catalog = createCatalog('test-provider', models);

      // effectiveLocalOnly: false, but overrides.localOnly: true -> must enforce localOnly
      const res1 = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        effectiveLocalOnly: false,
        overrides: { localOnly: true }
      });
      expect(res1.success).toBe(true);
      expect(res1.modelId).toBe('mod-local');
      expect(res1.rejections?.['mod-cloud']?.[0]).toContain('privacy_mismatch');

      // effectiveLocalOnly: true, but overrides.localOnly: false -> cannot weaken effectiveLocalOnly!
      const res2 = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        effectiveLocalOnly: true,
        overrides: { localOnly: false }
      });
      expect(res2.success).toBe(true);
      expect(res2.modelId).toBe('mod-local');
      expect(res2.rejections?.['mod-cloud']?.[0]).toContain('privacy_mismatch');
    });

    it('fails closed when local privacy is requested and preferred model is cloud with allowFallback: false', () => {
      const models = [
        createModel({ id: 'mod-cloud', privacyClass: 'standard_cloud' }),
        createModel({
          id: 'mod-local',
          privacyClass: 'local_only',
          capabilities: { local: true }
        })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        overrides: {
          preferredModelId: 'mod-cloud',
          localOnly: true
        },
        allowFallback: false
      });

      expect(res.success).toBe(false);
      expect(res.reason).toContain("Preferred model 'mod-cloud' is ineligible");
    });

    it('falls back to eligible local model when local privacy is requested and preferred model is cloud with allowFallback: true', () => {
      const models = [
        createModel({ id: 'mod-cloud', privacyClass: 'standard_cloud' }),
        createModel({
          id: 'mod-local',
          privacyClass: 'local_only',
          capabilities: { local: true }
        })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        overrides: {
          preferredModelId: 'mod-cloud',
          localOnly: true
        },
        allowFallback: true
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-local');
    });
  });

  describe('4. Capability Filtering', () => {
    it('excludes models that lack required boolean capabilities', () => {
      const models = [
        createModel({ id: 'mod-no-vision', capabilities: { vision: false } }),
        createModel({ id: 'mod-with-vision', capabilities: { vision: true } })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        requiredCapabilities: { vision: true }
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-with-vision');
      expect(res.rejections?.['mod-no-vision']?.[0]).toContain('missing_capability: vision');
    });

    it('handles optional language capabilities with unknown semantics', () => {
      const models = [
        createModel({ id: 'mod-explicit-false', capabilities: { supportsThai: false } }),
        createModel({ id: 'mod-undefined', capabilities: { supportsThai: undefined } }),
        createModel({ id: 'mod-explicit-true', capabilities: { supportsThai: true } })
      ];

      const catalog = createCatalog('test-provider', models);

      // Permissive by default: undefined is treated as permissive
      const resPermissive = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        requiredCapabilities: { supportsThai: true },
        strictLanguageCheck: false
      });
      expect(resPermissive.success).toBe(true);
      expect(resPermissive.rejections?.['mod-explicit-false']?.[0]).toContain('missing_capability: supportsThai');

      // Strict mode: undefined is rejected
      const resStrict = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        requiredCapabilities: { supportsThai: true },
        strictLanguageCheck: true
      });
      expect(resStrict.success).toBe(true);
      expect(resStrict.modelId).toBe('mod-explicit-true');
      expect(resStrict.rejections?.['mod-undefined']?.[0]).toContain('unverified_language_capability');
    });
  });

  describe('5. Cost, Latency, and Context Constraints', () => {
    it('filters out models exceeding maxCostClass', () => {
      const models = [
        createModel({ id: 'mod-high', costClass: 'high' }),
        createModel({ id: 'mod-medium', costClass: 'medium' }),
        createModel({ id: 'mod-low', costClass: 'low' }),
        createModel({ id: 'mod-free', costClass: 'free' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        maxCostClass: 'low'
      });

      expect(res.success).toBe(true);
      // Low and Free are eligible; low is chosen based on standard quality ranking
      expect(['mod-low', 'mod-free']).toContain(res.modelId);
      expect(res.rejections?.['mod-high']?.[0]).toContain('cost_exceeded');
      expect(res.rejections?.['mod-medium']?.[0]).toContain('cost_exceeded');
    });

    it('filters out models exceeding maxLatencyClass', () => {
      const models = [
        createModel({ id: 'mod-heavy', latencyClass: 'heavy' }),
        createModel({ id: 'mod-balanced', latencyClass: 'balanced' }),
        createModel({ id: 'mod-interactive', latencyClass: 'interactive' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        maxLatencyClass: 'interactive'
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-interactive');
      expect(res.rejections?.['mod-heavy']?.[0]).toContain('latency_exceeded');
      expect(res.rejections?.['mod-balanced']?.[0]).toContain('latency_exceeded');
    });

    it('filters out models not meeting requiredContextClass or contextWindowTokens', () => {
      const models = [
        createModel({ id: 'mod-small', contextClass: 'standard', contextWindowTokens: 4096 }),
        createModel({ id: 'mod-large', contextClass: 'large', contextWindowTokens: 32768 })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        requiredContextClass: 'large',
        requiredContextTokens: 16000
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-large');
      expect(res.rejections?.['mod-small']?.[0]).toContain('context_insufficient');
    });

    it('rejects models with undefined contextWindowTokens when requiredContextTokens is specified (context_tokens_unknown)', () => {
      const models = [
        createModel({ id: 'mod-unknown-tokens', contextClass: 'large', contextWindowTokens: undefined }),
        createModel({ id: 'mod-known-tokens', contextClass: 'large', contextWindowTokens: 32768 })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        requiredContextTokens: 16000
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-known-tokens');
      expect(res.rejections?.['mod-unknown-tokens']?.[0]).toContain('context_tokens_unknown');
    });
  });

  describe('6. Explicit preferredModelId & allowFallback Semantics', () => {
    it('selects explicit preferredModelId immediately when valid and eligible', () => {
      const models = [
        createModel({ id: 'mod-a', qualityClass: 'fast' }),
        createModel({ id: 'mod-b', qualityClass: 'balanced' }),
        createModel({ id: 'mod-c', qualityClass: 'reasoning' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        profileId: 'fast_conversation',
        overrides: { preferredModelId: 'mod-c', localOnly: false }
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-c');
      expect(res.reason).toContain('Selected explicit preferred model');
    });

    it('returns failure when preferredModelId is missing and allowFallback is false', () => {
      const models = [createModel({ id: 'mod-a' })];
      const catalog = createCatalog('test-provider', models);

      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        overrides: { preferredModelId: 'mod-nonexistent', localOnly: false },
        profileResolution: {
          profileId: 'fast_conversation',
          definition: {
            id: 'fast_conversation',
            description: '',
            requiredCapabilities: {},
            latencyClass: 'interactive',
            allowFallback: false
          },
          requiredCapabilities: {},
          allowFallback: false
        }
      });

      expect(res.success).toBe(false);
      expect(res.reason).toContain('Preferred model \'mod-nonexistent\' not found');
    });

    it('falls through to general selection when preferredModelId is missing and allowFallback is true', () => {
      const models = [createModel({ id: 'mod-a', qualityClass: 'fast' })];
      const catalog = createCatalog('test-provider', models);

      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        overrides: { preferredModelId: 'mod-nonexistent', localOnly: false },
        profileResolution: {
          profileId: 'fast_conversation',
          definition: {
            id: 'fast_conversation',
            description: '',
            requiredCapabilities: {},
            latencyClass: 'interactive',
            allowFallback: true
          },
          requiredCapabilities: {},
          allowFallback: true
        }
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-a');
    });

    it('returns failure when preferredModelId is ineligible and allowFallback is false', () => {
      const models = [
        createModel({ id: 'mod-deprecated', status: 'deprecated' }),
        createModel({ id: 'mod-available', status: 'available' })
      ];
      const catalog = createCatalog('test-provider', models);

      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        overrides: { preferredModelId: 'mod-deprecated', localOnly: false },
        profileResolution: {
          profileId: 'fast_conversation',
          definition: {
            id: 'fast_conversation',
            description: '',
            requiredCapabilities: {},
            latencyClass: 'interactive',
            allowFallback: false
          },
          requiredCapabilities: {},
          allowFallback: false
        }
      });

      expect(res.success).toBe(false);
      expect(res.reason).toContain('Preferred model \'mod-deprecated\' is ineligible');
    });

    it('strictly defaults allowFallback to false when preferredModelId is specified and allowFallback is undefined', () => {
      const models = [
        createModel({ id: 'mod-avail-1', status: 'available' }),
        createModel({ id: 'mod-avail-2', status: 'available' }),
        createModel({ id: 'mod-dep', status: 'deprecated' })
      ];
      const catalog = createCatalog('test-provider', models);

      // 1. Missing model with allowFallback undefined -> fails closed
      const resMissing = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        overrides: { preferredModelId: 'mod-nonexistent', localOnly: false }
      });
      expect(resMissing.success).toBe(false);
      expect(resMissing.reason).toContain("Preferred model 'mod-nonexistent' not found");

      // 2. Deprecated model with allowFallback undefined -> fails closed
      const resIneligible = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        overrides: { preferredModelId: 'mod-dep', localOnly: false }
      });
      expect(resIneligible.success).toBe(false);
      expect(resIneligible.reason).toContain("Preferred model 'mod-dep' is ineligible");

      // 3. Valid model with allowFallback undefined -> succeeds with preferred model
      const resValid = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        overrides: { preferredModelId: 'mod-avail-2', localOnly: false }
      });
      expect(resValid.success).toBe(true);
      expect(resValid.modelId).toBe('mod-avail-2');
    });

    it('falls through to general selection when preferredModelId is missing and allowFallback is true at criteria level', () => {
      const models = [createModel({ id: 'mod-a', qualityClass: 'fast' })];
      const catalog = createCatalog('test-provider', models);

      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        overrides: { preferredModelId: 'mod-nonexistent', localOnly: false },
        allowFallback: true
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-a');
    });

    it('fails closed when preferredModelId is missing and allowFallback is false at criteria level', () => {
      const models = [createModel({ id: 'mod-a', qualityClass: 'fast' })];
      const catalog = createCatalog('test-provider', models);

      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        overrides: { preferredModelId: 'mod-nonexistent', localOnly: false },
        allowFallback: false
      });

      expect(res.success).toBe(false);
      expect(res.reason).toContain("Preferred model 'mod-nonexistent' not found");
    });
  });

  describe('7. Default Model Preference & Deterministic Tie-breaking', () => {
    it('prefers defaultModelId when eligible', () => {
      const models = [
        createModel({ id: 'mod-alpha', qualityClass: 'fast', latencyClass: 'interactive' }),
        createModel({ id: 'mod-beta', qualityClass: 'fast', latencyClass: 'interactive' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        profileId: 'fast_conversation',
        defaultModelId: 'mod-beta'
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-beta');
      expect(res.reason).toContain('provider default model');
    });

    it('does not crash or select invalid defaultModelId', () => {
      const models = [
        createModel({ id: 'mod-alpha', qualityClass: 'fast', latencyClass: 'interactive' })
      ];

      const catalog = createCatalog('test-provider', models);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog,
        defaultModelId: 'non-existent-default'
      });

      expect(res.success).toBe(true);
      expect(res.modelId).toBe('mod-alpha');
    });

    it('breaks ties deterministically using lexical ModelId ordering', () => {
      const modelZ = createModel({ id: 'mod-z', qualityClass: 'fast', latencyClass: 'interactive', costClass: 'low' });
      const modelA = createModel({ id: 'mod-a', qualityClass: 'fast', latencyClass: 'interactive', costClass: 'low' });

      // Run with catalog order [Z, A]
      const res1 = ModelPolicy.select({
        providerId: 'test-provider',
        catalog: createCatalog('test-provider', [modelZ, modelA]),
        profileId: 'fast_conversation'
      });

      // Run with catalog order [A, Z]
      const res2 = ModelPolicy.select({
        providerId: 'test-provider',
        catalog: createCatalog('test-provider', [modelA, modelZ]),
        profileId: 'fast_conversation'
      });

      expect(res1.modelId).toBe('mod-a');
      expect(res2.modelId).toBe('mod-a');
    });

    it('handles empty catalog with clean success: false without throwing', () => {
      const catalog = createCatalog('test-provider', []);
      const res = ModelPolicy.select({
        providerId: 'test-provider',
        catalog
      });

      expect(res.success).toBe(false);
      expect(res.reason).toContain('zero models');
      expect(res.candidateCount).toBe(0);
      expect(res.eligibleCount).toBe(0);
    });

    it('rejects criteria providerId mismatch cleanly', () => {
      const catalog = createCatalog('provider-x', [createModel({ id: 'mod-1', providerId: 'provider-x' })]);
      const res = ModelPolicy.select({
        providerId: 'provider-y',
        catalog
      });

      expect(res.success).toBe(false);
      expect(res.reason).toContain('does not match requested providerId');
    });
  });
});
