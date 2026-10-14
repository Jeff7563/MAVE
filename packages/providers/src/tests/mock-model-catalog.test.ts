import { describe, it, expect } from 'vitest';
import { isModelCatalogProvider, ModelCatalogSnapshotSchema } from '@mave/contracts';
import {
  MockBrainProvider,
  MockModelCatalogProvider,
  createDefaultMockModels
} from '../brain/mock.js';

describe('MockModelCatalogProvider', () => {
  it('correctly implements ModelCatalogProvider and passes isModelCatalogProvider guard', () => {
    const plainProvider = new MockBrainProvider({ id: 'plain-mock' });
    expect(isModelCatalogProvider(plainProvider)).toBe(false);

    const catalogProvider = new MockModelCatalogProvider({ id: 'mock-catalog' });
    expect(isModelCatalogProvider(catalogProvider)).toBe(true);
    expect(catalogProvider.id).toBe('mock-catalog');
  });

  it('returns default 4 neutral models matching snapshot schema', async () => {
    const provider = new MockModelCatalogProvider({ id: 'provider-test' });
    const catalog = await provider.getCatalog();

    expect(provider.getCatalogCallCount()).toBe(1);
    expect(catalog.providerId).toBe('provider-test');
    expect(catalog.models).toHaveLength(4);

    const ids = catalog.models.map((m) => m.id);
    expect(ids).toEqual([
      'mock-fast-v1',
      'mock-balanced-v1',
      'mock-reasoning-v1',
      'mock-local-v1'
    ]);

    expect(() => ModelCatalogSnapshotSchema.parse(catalog)).not.toThrow();
  });

  it('supports custom model arrays', async () => {
    const customModels = [
      {
        id: 'custom-fast',
        providerId: 'custom-prov',
        displayName: 'Custom Fast',
        status: 'available' as const,
        latencyClass: 'interactive' as const,
        qualityClass: 'fast' as const,
        costClass: 'low' as const,
        contextClass: 'standard' as const,
        capabilities: {
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
        },
        privacyClass: 'standard_cloud' as const
      }
    ];

    const provider = new MockModelCatalogProvider({
      id: 'custom-prov',
      models: customModels
    });

    const catalog = await provider.getCatalog();
    expect(catalog.models).toHaveLength(1);
    expect(catalog.models[0]?.id).toBe('custom-fast');
  });

  it('supports simulated delay and throwing in getCatalog()', async () => {
    const provider = new MockModelCatalogProvider({
      id: 'failing-mock',
      catalogThrow: true,
      catalogMessage: 'Network error fetching remote catalog'
    });

    await expect(provider.getCatalog()).rejects.toThrow(
      'Network error fetching remote catalog'
    );
  });

  it('returns a valid ProviderDescriptor with defaultModelId', () => {
    const provider = new MockModelCatalogProvider({ id: 'meta-test' });
    const desc = provider.getDescriptor();

    expect(desc.id).toBe('meta-test');
    expect(desc.kind).toBe('model_provider');
    expect(desc.defaultModelId).toBe('mock-fast-v1');
    expect(desc.health.status).toBe('healthy');
  });

  it('allows createDefaultMockModels to be used standalone', () => {
    const models = createDefaultMockModels('my-provider');
    expect(models).toHaveLength(4);
    for (const model of models) {
      expect(model.providerId).toBe('my-provider');
    }
  });
});

