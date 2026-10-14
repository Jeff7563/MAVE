import { describe, it, expect, beforeEach } from 'vitest';
import {
  RuntimeModelCatalog,
  RuntimeModelSelectionError,
  type RuntimeModelDescriptor
} from '../brain/runtime-models/index.js';

describe('RuntimeModelCatalog & Selection Engine', () => {
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
      availability: 'available',
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
      availability: 'available',
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
      availability: 'available',
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

      // Attempted mutation should fail in strict mode
      expect(() => {
        (sonnet as any).availability = 'unavailable';
      }).toThrow();
    });

    it('updates runtime model availability (e.g. quota_limited)', () => {
      const updated = catalog.updateRuntimeModel('claude-code', 'opus', {
        availability: 'quota_limited'
      });
      expect(updated).toBe(true);

      const opus = catalog.getRuntimeModel('claude-code', 'opus');
      expect(opus?.availability).toBe('quota_limited');
    });

    it('clears specific runtime or all runtimes', () => {
      catalog.clear('claude-code');
      expect(catalog.getRuntimeModels('claude-code')).toHaveLength(0);
    });
  });

  describe('AUTO Selection Mode', () => {
    it('selects default model for BALANCED role (sonnet)', () => {
      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'BALANCED',
        mode: 'AUTO'
      });

      expect(result.selectedModelId).toBe('sonnet');
      expect(result.mode).toBe('AUTO');
      expect(result.fallbackOccurred).toBe(false);
    });

    it('selects default model for REASONING role (opus over sonnet)', () => {
      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'REASONING',
        mode: 'AUTO'
      });

      expect(result.selectedModelId).toBe('opus');
      expect(result.role).toBe('REASONING');
      expect(result.fallbackOccurred).toBe(false);
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

    it('skips quota_limited models and selects next available matching model', () => {
      // Mark opus as quota_limited
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

    it('throws no_available_model when all matching models are unavailable', () => {
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

  describe('PREFERRED Selection Mode', () => {
    it('selects preferred model when eligible and available', () => {
      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'CODING',
        mode: 'PREFERRED',
        preferredModelId: 'opus'
      });

      expect(result.selectedModelId).toBe('opus');
      expect(result.fallbackOccurred).toBe(false);
      expect(result.mode).toBe('PREFERRED');
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

    it('throws locked_model_unavailable when preferred model is quota_limited and allowFallback=false', () => {
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
    });

    it('falls back to auto selection when preferred model does not support role', () => {
      // haiku does not support REASONING
      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'REASONING',
        mode: 'PREFERRED',
        preferredModelId: 'haiku',
        allowFallback: true
      });

      expect(result.selectedModelId).toBe('opus');
      expect(result.fallbackOccurred).toBe(true);
    });
  });

  describe('LOCKED Selection Mode', () => {
    it('selects locked model when exact match, compatible, and available', () => {
      const result = catalog.selectModel({
        runtimeProviderId: 'claude-code',
        role: 'REASONING',
        mode: 'LOCKED',
        lockedModelId: 'opus'
      });

      expect(result.selectedModelId).toBe('opus');
      expect(result.fallbackOccurred).toBe(false);
      expect(result.mode).toBe('LOCKED');
    });

    it('throws locked_model_not_found if model does not exist in runtime', () => {
      expect(() =>
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'REASONING',
          mode: 'LOCKED',
          lockedModelId: 'gpt-4o'
        })
      ).toThrowError(RuntimeModelSelectionError);

      try {
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'REASONING',
          mode: 'LOCKED',
          lockedModelId: 'gpt-4o'
        });
      } catch (err: any) {
        expect(err.code).toBe('locked_model_not_found');
      }
    });

    it('throws locked_model_incompatible if locked model does not support requested role', () => {
      expect(() =>
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'AGENT',
          mode: 'LOCKED',
          lockedModelId: 'haiku'
        })
      ).toThrowError(RuntimeModelSelectionError);

      try {
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'AGENT',
          mode: 'LOCKED',
          lockedModelId: 'haiku'
        });
      } catch (err: any) {
        expect(err.code).toBe('locked_model_incompatible');
      }
    });

    it('throws locked_model_unavailable when locked model is quota_limited (silent switching forbidden)', () => {
      catalog.updateRuntimeModel('claude-code', 'opus', {
        availability: 'quota_limited'
      });

      expect(() =>
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'REASONING',
          mode: 'LOCKED',
          lockedModelId: 'opus'
        })
      ).toThrowError(RuntimeModelSelectionError);

      try {
        catalog.selectModel({
          runtimeProviderId: 'claude-code',
          role: 'REASONING',
          mode: 'LOCKED',
          lockedModelId: 'opus'
        });
      } catch (err: any) {
        expect(err.code).toBe('locked_model_unavailable');
      }
    });
  });
});
