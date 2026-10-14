import { describe, it, expect, beforeEach } from 'vitest';
import {
  RuntimeModelCatalog,
  RuntimeModelSelectionError,
  type RuntimeModelDescriptor
} from '../brain/runtime-models/index.js';

describe('RuntimeModelCatalog & Selection Engine (Hardened Availability Semantics)', () => {
  let catalog: RuntimeModelCatalog;

  const mockClaudeModels: RuntimeModelDescriptor[] = [
    {
      modelId: 'sonnet',
      runtimeProviderId: 'claude-code',
      displayName: 'Claude Sonnet',
      alias: 'sonnet',
      canonicalName: 'claude-sonnet-5',
      supportedRoles: ['BALANCED', 'CODING', 'AGENT', 'REASONING'],
      discoverySource: 'runtime_alias',
      availability: 'unknown', // Conservative: alias starts unknown until session init
      discoveredAt: 1000,
      metadata: {
        priority: 1,
        rolePriority: { BALANCED: 1, CODING: 1, AGENT: 1, REASONING: 2 },
        defaultFor: ['BALANCED', 'CODING', 'AGENT']
      }
    },
    {
      modelId: 'opus',
      runtimeProviderId: 'claude-code',
      displayName: 'Claude Opus',
      alias: 'opus',
      canonicalName: 'claude-opus-5',
      supportedRoles: ['REASONING', 'CODING'],
      discoverySource: 'runtime_alias',
      availability: 'unknown', // Conservative: alias starts unknown until session init
      discoveredAt: 1000,
      metadata: {
        priority: 1,
        rolePriority: { REASONING: 1, CODING: 2 },
        defaultFor: ['REASONING']
      }
    },
    {
      modelId: 'haiku',
      runtimeProviderId: 'claude-code',
      displayName: 'Claude Haiku',
      alias: 'haiku',
      canonicalName: 'claude-haiku-4-5-20251001',
      supportedRoles: ['FAST', 'BALANCED'],
      discoverySource: 'runtime_alias',
      availability: 'unknown',
      discoveredAt: 1000,
      metadata: {
        priority: 2,
        rolePriority: { FAST: 1, BALANCED: 2 },
        defaultFor: ['FAST']
      }
    }
  ];

  beforeEach(() => {
    catalog = new RuntimeModelCatalog();
    catalog.registerRuntimeModels('claude-code', mockClaudeModels);
  });

  describe('Catalog Registration & Immutability', () => {
    it('returns registered models for a runtime', () => {
      const models = catalog.getRuntimeModels('claude-code');
      expect(models).toHaveLength(3);
      expect(models.map((m) => m.modelId)).toEqual(['sonnet', 'opus', 'haiku']);
    });

    it('returns empty array for untracked runtime', () => {
      expect(catalog.getRuntimeModels('unknown-runtime')).toEqual([]);
    });

    it('freezes returned descriptors preventing external mutation', () => {
      const models = catalog.getRuntimeModels('claude-code');
      const sonnet = models[0];
      expect(sonnet).toBeDefined();
      expect(Object.isFrozen(sonnet!)).toBe(true);
      expect(Object.isFrozen(sonnet!.supportedRoles)).toBe(true);

      expect(() => {
        (sonnet as any).availability = 'unavailable';
      }).toThrow();
    });

    it('updates runtime model availability (e.g. quota_limited or verified available)', () => {
      const updated = catalog.updateRuntimeModel('claude-code', 'opus', {
        availability: 'available'
      });
      expect(updated).toBe(true);

      const opus = catalog.getRuntimeModel('claude-code', 'opus');
      expect(opus?.availability).toBe('available');
    });

    it('clears specific runtime or all runtimes', () => {
      catalog.clear('claude-code');
      expect(catalog.getRuntimeModels('claude-code')).toHaveLength(0);
    });
  });

  describe('AUTO Selection Mode (Available vs Unknown)', () => {
    it('selects optimistically when only UNKNOWN models are registered, recording unknown status in reason', () => {
      // All Claude models in beforeEach start with availability = 'unknown'
      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'BALANCED',
        mode: 'AUTO'
      });

      expect(result.selectedModelId).toBe('sonnet');
      expect(result.mode).toBe('AUTO');
      expect(result.fallbackOccurred).toBe(false);
      expect(result.reason).toContain('availability: unknown / optimistic selection');
    });

    it('strictly ranks verified AVAILABLE models ahead of UNKNOWN models', () => {
      // Mark opus as verified available, but leave sonnet as unknown
      catalog.updateRuntimeModel('claude-code', 'opus', {
        availability: 'available'
      });

      // For CODING: both sonnet and opus are eligible.
      // Sonnet has higher role priority (1 vs 2), but is UNKNOWN.
      // Opus is verified AVAILABLE. Therefore opus MUST win!
      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'CODING',
        mode: 'AUTO'
      });

      expect(result.selectedModelId).toBe('opus');
      expect(result.reason).toContain('verified model');
    });

    it('selects default model for FAST role (haiku)', () => {
      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'FAST',
        mode: 'AUTO'
      });

      expect(result.selectedModelId).toBe('haiku');
      expect(result.role).toBe('FAST');
    });

    it('throws role_not_supported when no models support the role', () => {
      const limitedCatalog = new RuntimeModelCatalog();
      limitedCatalog.registerRuntimeModels('limited', [
        {
          modelId: 'specialist',
          runtimeProviderId: 'limited',
          displayName: 'Specialist',
          supportedRoles: ['CODING'],
          discoverySource: 'configured',
          availability: 'available',
          discoveredAt: 1000
        }
      ]);

      expect(() =>
        limitedCatalog.selectModel({
          runtimeProviderId: 'limited',
          role: 'FAST',
          mode: 'AUTO'
        })
      ).toThrowError(RuntimeModelSelectionError);

      try {
        limitedCatalog.selectModel({
          runtimeProviderId: 'limited',
          role: 'FAST',
          mode: 'AUTO'
        });
      } catch (err: any) {
        expect(err.code).toBe('role_not_supported');
      }
    });

    it('skips quota_limited models and selects next eligible candidate', () => {
      catalog.updateRuntimeModel('claude-code', 'opus', {
        availability: 'quota_limited'
      });

      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'REASONING',
        mode: 'AUTO'
      });

      // Sonnet also supports REASONING, so it is selected
      expect(result.selectedModelId).toBe('sonnet');
    });

    it('throws no_available_model when all matching models are unavailable or quota_limited', () => {
      catalog.updateRuntimeModel('claude-code', 'haiku', {
        availability: 'quota_limited'
      });

      expect(() =>
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'FAST',
          mode: 'AUTO'
        })
      ).toThrowError(RuntimeModelSelectionError);

      try {
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'FAST',
          mode: 'AUTO'
        });
      } catch (err: any) {
        expect(err.code).toBe('no_available_model');
      }
    });
  });

  describe('PREFERRED Selection Mode (Accurate Error Semantics)', () => {
    it('selects preferred model with UNKNOWN availability without pretending it is verified available', () => {
      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'CODING',
        mode: 'PREFERRED',
        preferredModelId: 'opus'
      });

      expect(result.selectedModelId).toBe('opus');
      expect(result.fallbackOccurred).toBe(false);
      expect(result.mode).toBe('PREFERRED');
      expect(result.reason).toContain('unverified availability (unknown');
    });

    it('selects preferred model when verified available', () => {
      catalog.updateRuntimeModel('claude-code', 'opus', {
        availability: 'available'
      });

      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'CODING',
        mode: 'PREFERRED',
        preferredModelId: 'opus'
      });

      expect(result.selectedModelId).toBe('opus');
      expect(result.fallbackOccurred).toBe(false);
      expect(result.reason).toContain('verified available');
    });

    it('falls back to auto selection when preferred model is quota_limited and allowFallback=true', () => {
      catalog.updateRuntimeModel('claude-code', 'opus', {
        availability: 'quota_limited'
      });

      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'CODING',
        mode: 'PREFERRED',
        preferredModelId: 'opus',
        allowFallback: true
      });

      expect(result.selectedModelId).toBe('sonnet');
      expect(result.fallbackOccurred).toBe(true);
      expect(result.reason).toContain('fell back to auto-selected model');
    });

    it('throws preferred_model_unavailable when preferred model is quota_limited and allowFallback=false', () => {
      catalog.updateRuntimeModel('claude-code', 'opus', {
        availability: 'quota_limited'
      });

      expect(() =>
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'CODING',
          mode: 'PREFERRED',
          preferredModelId: 'opus',
          allowFallback: false
        })
      ).toThrowError(RuntimeModelSelectionError);

      try {
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'CODING',
          mode: 'PREFERRED',
          preferredModelId: 'opus',
          allowFallback: false
        });
      } catch (err: any) {
        expect(err.code).toBe('preferred_model_unavailable');
      }
    });

    it('throws preferred_model_not_found when preferred model does not exist and allowFallback=false', () => {
      try {
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'CODING',
          mode: 'PREFERRED',
          preferredModelId: 'non-existent-model',
          allowFallback: false
        });
        expect.fail('Should have thrown preferred_model_not_found');
      } catch (err: any) {
        expect(err.code).toBe('preferred_model_not_found');
      }
    });

    it('throws preferred_model_incompatible when preferred model does not support role and allowFallback=false', () => {
      // haiku does not support REASONING
      try {
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'REASONING',
          mode: 'PREFERRED',
          preferredModelId: 'haiku',
          allowFallback: false
        });
        expect.fail('Should have thrown preferred_model_incompatible');
      } catch (err: any) {
        expect(err.code).toBe('preferred_model_incompatible');
      }
    });
  });

  describe('LOCKED Selection Mode (Exact Match & Silent Switching Forbidden)', () => {
    it('selects locked model when exact match and available', () => {
      catalog.updateRuntimeModel('claude-code', 'opus', {
        availability: 'available'
      });

      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'REASONING',
        mode: 'LOCKED',
        lockedModelId: 'opus'
      });

      expect(result.selectedModelId).toBe('opus');
      expect(result.fallbackOccurred).toBe(false);
      expect(result.mode).toBe('LOCKED');
      expect(result.reason).toContain('verified available');
    });

    it('allows exact attempt when locked model has UNKNOWN availability without silent switching', () => {
      // opus starts unknown
      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'REASONING',
        mode: 'LOCKED',
        lockedModelId: 'opus'
      });

      expect(result.selectedModelId).toBe('opus');
      expect(result.fallbackOccurred).toBe(false);
      expect(result.reason).toContain('availability: unknown; exact model will be attempted without fallback');
    });

    it('throws locked_model_not_found if model does not exist in runtime', () => {
      try {
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'REASONING',
          mode: 'LOCKED',
          lockedModelId: 'gpt-4o'
        });
        expect.fail('Should have thrown locked_model_not_found');
      } catch (err: any) {
        expect(err.code).toBe('locked_model_not_found');
      }
    });

    it('throws locked_model_incompatible if locked model does not support requested role', () => {
      try {
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'AGENT',
          mode: 'LOCKED',
          lockedModelId: 'haiku'
        });
        expect.fail('Should have thrown locked_model_incompatible');
      } catch (err: any) {
        expect(err.code).toBe('locked_model_incompatible');
      }
    });

    it('throws locked_model_unavailable when locked model is quota_limited (silent switching forbidden)', () => {
      catalog.updateRuntimeModel('claude-code', 'opus', {
        availability: 'quota_limited'
      });

      try {
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'REASONING',
          mode: 'LOCKED',
          lockedModelId: 'opus'
        });
        expect.fail('Should have thrown locked_model_unavailable');
      } catch (err: any) {
        expect(err.code).toBe('locked_model_unavailable');
      }
    });
  });
});
