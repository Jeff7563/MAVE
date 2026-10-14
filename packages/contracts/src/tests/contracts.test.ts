import { describe, it, expect } from 'vitest';
import {
  BrainCapabilitiesSchema,
  BrainConfigSchema,
  BrainErrorCodeSchema,
  BrainErrorSchema,
  BrainEventSchema,
  BrainProfileIdSchema,
  BrainRequestSchema,
  BrainResponseSchema,
  BrainRouteOverridesSchema,
  BrainTelemetrySchema,
  BrainUsageSchema,
  CanonicalBrainErrorCodeSchema,
  CanonicalModelPrivacyClassSchema,
  CanonicalProviderHealthStatusSchema,
  ConversationRoleSchema,
  ConversationTurnSchema,
  ConversationTurnStatusSchema,
  DefaultMaveConfig,
  GenerationTimingSchema,
  GenerationUsageSchema,
  MaveConfigSchema,
  MaveMessageSchema,
  ModelAvailabilityStatusSchema,
  ModelCatalogSnapshotSchema,
  ModelContextClassSchema,
  ModelCostClassSchema,
  ModelDescriptorSchema,
  ModelIdSchema,
  ModelLatencyClassSchema,
  ModelPrivacyClassSchema,
  ModelQualityClassSchema,
  ProviderAccessPathSchema,
  ProviderDescriptorSchema,
  ProviderHealthSchema,
  ProviderHealthStatusSchema,
  ProviderIdSchema,
  ProviderKindSchema,
  RouteReasonSchema,
  RouteTelemetrySchema,
  SessionSchema,
  SessionStatusSchema,
  StreamingChunkSchema,
  isModelCatalogProvider,
  normalizeBrainErrorCode,
  normalizeModelPrivacyClass,
  normalizeProviderHealthStatus,
  resolveEffectiveLocalOnly,
  type BrainCapabilities,
  type BrainEvent,
  type BrainProvider,
  type BrainTelemetry,
  type ModelCatalogProvider,
  type ModelCatalogSnapshot,
  type ModelDescriptor,
  type ProviderDescriptor
} from '../index.js';

describe('Brain Capability & Config Contracts', () => {
  it('validates default brain capabilities correctly', () => {
    const caps = BrainCapabilitiesSchema.parse({});
    expect(caps.streaming).toBe(true);
    expect(caps.fastChat).toBe(false);
    expect(caps.reasoning).toBe(false);
    expect(caps.coding).toBe(false);
    expect(caps.toolUse).toBe(false);
    expect(caps.multimodal).toBe(false);
    expect(caps.vision).toBe(false);
    expect(caps.webResearch).toBe(false);
    expect(caps.longContext).toBe(false);
    expect(caps.local).toBe(false);
  });

  it('validates customized brain capabilities', () => {
    const custom: BrainCapabilities = {
      streaming: true,
      fastChat: true,
      reasoning: true,
      coding: true,
      toolUse: true,
      multimodal: false,
      vision: false,
      webResearch: false,
      longContext: true,
      local: false,
      structuredOutput: true,
      cancellation: true,
      supportsThai: true,
      supportsEnglish: true
    };
    const parsed = BrainCapabilitiesSchema.parse(custom);
    expect(parsed).toEqual(custom);
  });

  it('validates default BrainConfig', () => {
    const config = BrainConfigSchema.parse({});
    expect(config.defaultProvider).toBe('mock');
    expect(config.fallbackChain).toEqual([]);
    expect(config.timeoutMs).toBe(30000);
  });

  it('rejects invalid timeout values in BrainConfig', () => {
    expect(() => BrainConfigSchema.parse({ timeoutMs: -100 })).toThrow();
    expect(() => BrainConfigSchema.parse({ timeoutMs: 0 })).toThrow();
    expect(() => BrainConfigSchema.parse({ timeoutMs: 'invalid' })).toThrow();
  });

  it('validates fallback chain in BrainConfig', () => {
    const config = BrainConfigSchema.parse({
      defaultProvider: 'gemini',
      fallbackChain: ['claude', 'local-llm', 'mock'],
      timeoutMs: 15000
    });
    expect(config.defaultProvider).toBe('gemini');
    expect(config.fallbackChain).toEqual(['claude', 'local-llm', 'mock']);
    expect(config.timeoutMs).toBe(15000);
  });

  it('rejects empty defaultProvider string', () => {
    expect(() => BrainConfigSchema.parse({ defaultProvider: '' })).toThrow();
  });
});

describe('Brain Error & Health Contracts', () => {
  it('validates standard BrainError codes', () => {
    const validCodes = [
      'provider_unavailable',
      'provider_timeout',
      'provider_auth',
      'provider_limit',
      'provider_invalid_response',
      'cancelled',
      'runtime_error'
    ];

    for (const code of validCodes) {
      expect(BrainErrorCodeSchema.parse(code)).toBe(code);
    }
    expect(() => BrainErrorCodeSchema.parse('unknown_code')).toThrow();
  });

  it('validates BrainError object schema', () => {
    const err = BrainErrorSchema.parse({
      code: 'provider_timeout',
      message: 'Provider did not respond within 30000ms',
      retryable: true,
      details: { attempt: 1 }
    });
    expect(err.code).toBe('provider_timeout');
    expect(err.retryable).toBe(true);
  });

  it('validates ProviderHealth schema', () => {
    const health = ProviderHealthSchema.parse({
      status: 'healthy',
      latencyMs: 120,
      checkedAt: 1791850000000
    });
    expect(health.status).toBe('healthy');
    expect(health.latencyMs).toBe(120);

    expect(() => ProviderHealthSchema.parse({ status: 'unknown_status' })).toThrow();
  });
});

describe('BrainEvent Discriminated Union Structure', () => {
  const reqId = 'req_123';

  it('validates "started" event', () => {
    const event: BrainEvent = {
      type: 'started',
      requestId: reqId,
      providerId: 'mock-provider',
      timestamp: Date.now()
    };
    const parsed = BrainEventSchema.parse(event);
    expect(parsed.type).toBe('started');
    if (parsed.type === 'started') {
      expect(parsed.providerId).toBe('mock-provider');
    }
  });

  it('validates "delta" event', () => {
    const event: BrainEvent = {
      type: 'delta',
      requestId: reqId,
      text: 'Hello, '
    };
    const parsed = BrainEventSchema.parse(event);
    expect(parsed.type).toBe('delta');
    if (parsed.type === 'delta') {
      expect(parsed.text).toBe('Hello, ');
    }
  });

  it('validates "completed" event with usage', () => {
    const event: BrainEvent = {
      type: 'completed',
      requestId: reqId,
      text: 'Hello, world!',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop'
    };
    const parsed = BrainEventSchema.parse(event);
    expect(parsed.type).toBe('completed');
    if (parsed.type === 'completed') {
      expect(parsed.usage?.totalTokens).toBe(15);
    }
  });

  it('validates "cancelled" event', () => {
    const event: BrainEvent = {
      type: 'cancelled',
      requestId: reqId,
      reason: 'User requested sleep'
    };
    const parsed = BrainEventSchema.parse(event);
    expect(parsed.type).toBe('cancelled');
    if (parsed.type === 'cancelled') {
      expect(parsed.reason).toBe('User requested sleep');
    }
  });

  it('validates "error" event', () => {
    const event: BrainEvent = {
      type: 'error',
      requestId: reqId,
      error: {
        code: 'provider_unavailable',
        message: 'Endpoint unreachable',
        retryable: true
      }
    };
    const parsed = BrainEventSchema.parse(event);
    expect(parsed.type).toBe('error');
    if (parsed.type === 'error') {
      expect(parsed.error.code).toBe('provider_unavailable');
    }
  });

  it('rejects unrecognized event type', () => {
    expect(() =>
      BrainEventSchema.parse({
        type: 'unrecognized_event',
        requestId: reqId
      })
    ).toThrow();
  });
});

describe('BrainRequest & BrainResponse Contracts', () => {
  it('validates BrainRequest with valid messages', () => {
    const userMsg = MaveMessageSchema.parse({ role: 'user', content: 'What is MAVE?' });
    const req = BrainRequestSchema.parse({
      requestId: 'req_001',
      sessionId: 'sess_001',
      intent: 'conversation',
      messages: [userMsg]
    });
    expect(req.requestId).toBe('req_001');
    expect(req.messages[0]?.role).toBe('user');
  });

  it('validates standalone BrainUsage schema', () => {
    const usage = BrainUsageSchema.parse({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(usage.totalTokens).toBe(15);
  });

  it('rejects BrainRequest with empty messages array', () => {
    expect(() =>
      BrainRequestSchema.parse({
        requestId: 'req_001',
        sessionId: 'sess_001',
        messages: []
      })
    ).toThrow();
  });

  it('validates BrainResponse schema', () => {
    const resp = BrainResponseSchema.parse({
      requestId: 'req_001',
      sessionId: 'sess_001',
      providerId: 'mock',
      text: 'MAVE is your personal assistant.',
      durationMs: 450
    });
    expect(resp.text).toBe('MAVE is your personal assistant.');
    expect(resp.durationMs).toBe(450);
  });

  it('verifies BrainProvider interface signature compatibility', () => {
    // Type-level assertion that a dummy class satisfies BrainProvider
    class TestMockProvider implements BrainProvider {
      readonly id = 'test-mock';
      getCapabilities(): BrainCapabilities {
        return BrainCapabilitiesSchema.parse({ fastChat: true });
      }
      async health() {
        return ProviderHealthSchema.parse({ status: 'healthy' as const });
      }
      async *chat() {
        yield { type: 'started' as const, requestId: 'r1', providerId: this.id };
        yield { type: 'delta' as const, requestId: 'r1', text: 'hi' };
        yield { type: 'completed' as const, requestId: 'r1' };
      }
      async cancel(_requestId: string) {}
    }

    const provider: BrainProvider = new TestMockProvider();
    expect(provider.id).toBe('test-mock');
    expect(provider.getCapabilities().fastChat).toBe(true);
  });
});

describe('Session & Message Contracts', () => {
  it('validates Session status enumeration', () => {
    expect(SessionStatusSchema.parse('active')).toBe('active');
    expect(SessionStatusSchema.parse('ended')).toBe('ended');
    expect(SessionStatusSchema.parse('error')).toBe('error');
    expect(() => SessionStatusSchema.parse('paused')).toThrow();
  });

  it('validates Session creation and defaults', () => {
    const session = SessionSchema.parse({
      id: 'sess_999',
      createdAt: 1791850000000,
      updatedAt: 1791850000000
    });
    expect(session.id).toBe('sess_999');
    expect(session.status).toBe('active');
    expect(session.mode).toBe('conversation');
  });

  it('validates ConversationTurn roles and statuses', () => {
    expect(ConversationRoleSchema.parse('user')).toBe('user');
    expect(ConversationRoleSchema.parse('assistant')).toBe('assistant');
    expect(ConversationRoleSchema.parse('system')).toBe('system');
    expect(() => ConversationRoleSchema.parse('bot')).toThrow();

    expect(ConversationTurnStatusSchema.parse('pending')).toBe('pending');
    expect(ConversationTurnStatusSchema.parse('streaming')).toBe('streaming');
    expect(ConversationTurnStatusSchema.parse('completed')).toBe('completed');
    expect(ConversationTurnStatusSchema.parse('cancelled')).toBe('cancelled');
    expect(ConversationTurnStatusSchema.parse('failed')).toBe('failed');
  });

  it('validates ConversationTurn creation schema', () => {
    const turn = ConversationTurnSchema.parse({
      id: 'turn_001',
      sessionId: 'sess_001',
      requestId: 'req_001',
      role: 'assistant',
      content: 'I am ready to help.',
      providerId: 'mock',
      createdAt: 1791850000000
    });
    expect(turn.role).toBe('assistant');
    expect(turn.status).toBe('completed');
    expect(turn.providerId).toBe('mock');
  });

  it('validates StreamingChunk contract', () => {
    const chunk = StreamingChunkSchema.parse({
      requestId: 'req_123',
      sessionId: 'sess_123',
      text: 'token ',
      isFinal: false
    });
    expect(chunk.isFinal).toBe(false);
    expect(chunk.text).toBe('token ');
  });
});

describe('Settings Schema & Backward Compatibility', () => {
  it('validates DefaultMaveConfig has both brain and legacy realtime configurations', () => {
    expect(DefaultMaveConfig.brain).toBeDefined();
    expect(DefaultMaveConfig.brain.defaultProvider).toBe('mock');
    expect(DefaultMaveConfig.brain.fallbackChain).toEqual([]);
    expect(DefaultMaveConfig.brain.timeoutMs).toBe(30000);

    expect(DefaultMaveConfig.realtime).toBeDefined();
    expect(DefaultMaveConfig.realtime?.model).toBe('gpt-4o-realtime-preview');
  });

  it('parses legacy settings without brain config by populating default brain config', () => {
    const legacySavedSettings = {
      wake: {
        enabled: true,
        wakeProvider: 'openwakeword',
        threshold: 0.5,
        keywordModelPath: 'assets/wake/mave.onnx',
        microphoneDeviceIndex: -1
      },
      conversation: {
        idleTimeoutMs: 75000,
        companionTimeoutMs: 1800000,
        defaultMode: 'conversation'
      },
      realtime: {
        model: 'gpt-4o-realtime-preview',
        vad: 'semantic_vad',
        vadEagerness: 'auto'
      },
      memory: {
        storeTranscripts: true,
        storeAudio: false
      }
    };

    const parsed = MaveConfigSchema.parse(legacySavedSettings);
    expect(parsed.brain).toBeDefined();
    expect(parsed.brain.defaultProvider).toBe('mock');
    expect(parsed.brain.timeoutMs).toBe(30000);
    expect(parsed.realtime?.model).toBe('gpt-4o-realtime-preview');
  });

  it('parses modern settings with brain config and no realtime block', () => {
    const modernSettings = {
      wake: {
        enabled: true,
        wakeProvider: 'openwakeword',
        threshold: 0.5,
        keywordModelPath: 'assets/wake/mave.onnx',
        microphoneDeviceIndex: -1
      },
      conversation: {
        idleTimeoutMs: 75000,
        companionTimeoutMs: 1800000,
        defaultMode: 'conversation'
      },
      brain: {
        defaultProvider: 'gemini',
        fallbackChain: ['mock'],
        timeoutMs: 20000
      },
      memory: {
        storeTranscripts: true,
        storeAudio: false
      }
    };

    const parsed = MaveConfigSchema.parse(modernSettings);
    expect(parsed.brain.defaultProvider).toBe('gemini');
    expect(parsed.brain.fallbackChain).toEqual(['mock']);
    expect(parsed.brain.timeoutMs).toBe(20000);
    expect(parsed.realtime).toBeUndefined();
  });
});

describe('Pre-M5 F1.1 Provider & Model Contracts', () => {
  describe('Provider & Model Identity Schemas', () => {
    it('validates canonical ProviderKind values', () => {
      const validKinds = ['model_provider', 'agent_runtime_provider', 'knowledge_provider'];
      for (const kind of validKinds) {
        expect(ProviderKindSchema.parse(kind)).toBe(kind);
      }
      expect(() => ProviderKindSchema.parse('invalid_kind')).toThrow();
      expect(() => ProviderKindSchema.parse('openai')).toThrow(); // No vendor names in kind
    });

    it('validates ProviderId and ModelId non-empty strings and trims whitespace', () => {
      expect(ProviderIdSchema.parse('mock-provider')).toBe('mock-provider');
      expect(ProviderIdSchema.parse('  gemini-provider  ')).toBe('gemini-provider');
      expect(() => ProviderIdSchema.parse('')).toThrow();
      expect(() => ProviderIdSchema.parse('   ')).toThrow();

      expect(ModelIdSchema.parse('mock-fast-model')).toBe('mock-fast-model');
      expect(ModelIdSchema.parse('  flash-model  ')).toBe('flash-model');
      expect(() => ModelIdSchema.parse('')).toThrow();
      expect(() => ModelIdSchema.parse('   ')).toThrow();
    });

    it('validates ProviderAccessPath values', () => {
      const validPaths = ['official_api', 'official_cli', 'official_client', 'local_runtime'];
      for (const p of validPaths) {
        expect(ProviderAccessPathSchema.parse(p)).toBe(p);
      }
      expect(() => ProviderAccessPathSchema.parse('unofficial_scraper')).toThrow();
    });
  });

  describe('Health & Availability Schemas', () => {
    it('validates canonical ProviderHealthStatus values and rejects unnormalized aliases in canonical schema', () => {
      const canonicalStatuses = [
        'healthy',
        'degraded',
        'unhealthy',
        'unconfigured',
        'quota_limited',
        'rate_limited',
        'auth_error',
        'unavailable'
      ];
      for (const s of canonicalStatuses) {
        expect(CanonicalProviderHealthStatusSchema.parse(s)).toBe(s);
        expect(ProviderHealthStatusSchema.parse(s)).toBe(s);
      }
      expect(() => CanonicalProviderHealthStatusSchema.parse('ready')).toThrow();
      expect(() => CanonicalProviderHealthStatusSchema.parse('error')).toThrow();
      expect(() => ProviderHealthStatusSchema.parse('dead')).toThrow();
    });

    it('normalizes legacy health statuses (ready -> healthy, error -> unhealthy)', () => {
      expect(ProviderHealthStatusSchema.parse('ready')).toBe('healthy');
      expect(ProviderHealthStatusSchema.parse('error')).toBe('unhealthy');
      expect(normalizeProviderHealthStatus('ready')).toBe('healthy');
      expect(normalizeProviderHealthStatus('error')).toBe('unhealthy');
      expect(normalizeProviderHealthStatus('healthy')).toBe('healthy');
      expect(normalizeProviderHealthStatus('degraded')).toBe('degraded');
    });

    it('validates ModelAvailabilityStatus values', () => {
      const validStatuses = ['available', 'quota_limited', 'rate_limited', 'deprecated', 'unavailable'];
      for (const s of validStatuses) {
        expect(ModelAvailabilityStatusSchema.parse(s)).toBe(s);
      }
      expect(() => ModelAvailabilityStatusSchema.parse('healthy')).toThrow(); // 'healthy' is for providers, not models
    });
  });

  describe('Brain Profile vs Capability Invariant', () => {
    it('enforces that BrainProfileId is never accepted as a BrainCapability key', () => {
      const profileId = 'fast_conversation';
      expect(BrainProfileIdSchema.parse(profileId)).toBe(profileId);

      // BrainCapabilities is a record of boolean feature flags, not profile names
      const caps = BrainCapabilitiesSchema.parse({
        streaming: true,
        fastChat: true,
        reasoning: false
      });
      expect(caps).not.toHaveProperty('fast_conversation');
      expect(caps.fastChat).toBe(true);
      expect(caps.streaming).toBe(true);
    });

    it('validates new optional capability flags', () => {
      const caps = BrainCapabilitiesSchema.parse({
        structuredOutput: true,
        cancellation: true,
        supportsThai: true,
        supportsEnglish: true
      });
      expect(caps.structuredOutput).toBe(true);
      expect(caps.cancellation).toBe(true);
      expect(caps.supportsThai).toBe(true);
      expect(caps.supportsEnglish).toBe(true);

      const defaultCaps = BrainCapabilitiesSchema.parse({});
      expect(defaultCaps.structuredOutput).toBeUndefined();
    });
  });

  describe('Model Qualitative Classes', () => {
    it('validates ModelLatencyClass, ModelQualityClass, ModelCostClass, ModelContextClass, ModelPrivacyClass', () => {
      expect(ModelLatencyClassSchema.parse('interactive')).toBe('interactive');
      expect(ModelLatencyClassSchema.parse('balanced')).toBe('balanced');
      expect(ModelLatencyClassSchema.parse('heavy')).toBe('heavy');
      expect(() => ModelLatencyClassSchema.parse('instant')).toThrow();

      // QualityClass semantic roles (fast, balanced, reasoning)
      expect(ModelQualityClassSchema.parse('fast')).toBe('fast');
      expect(ModelQualityClassSchema.parse('balanced')).toBe('balanced');
      expect(ModelQualityClassSchema.parse('reasoning')).toBe('reasoning');
      expect(() => ModelQualityClassSchema.parse('frontier')).toThrow(); // Marketing terms rejected
      expect(() => ModelQualityClassSchema.parse('economy')).toThrow();

      expect(ModelCostClassSchema.parse('free')).toBe('free');
      expect(ModelCostClassSchema.parse('low')).toBe('low');
      expect(ModelCostClassSchema.parse('medium')).toBe('medium');
      expect(ModelCostClassSchema.parse('high')).toBe('high');

      expect(ModelContextClassSchema.parse('standard')).toBe('standard');
      expect(ModelContextClassSchema.parse('large')).toBe('large');
      expect(ModelContextClassSchema.parse('massive')).toBe('massive');

      // Canonical PrivacyClass values
      expect(CanonicalModelPrivacyClassSchema.parse('local_only')).toBe('local_only');
      expect(CanonicalModelPrivacyClassSchema.parse('private_cloud')).toBe('private_cloud');
      expect(CanonicalModelPrivacyClassSchema.parse('standard_cloud')).toBe('standard_cloud');

      // Normalized privacy values (with backward compatibility)
      expect(ModelPrivacyClassSchema.parse('local_only')).toBe('local_only');
      expect(ModelPrivacyClassSchema.parse('private_cloud')).toBe('private_cloud');
      expect(ModelPrivacyClassSchema.parse('standard_cloud')).toBe('standard_cloud');
      expect(ModelPrivacyClassSchema.parse('local_airgapped')).toBe('local_only');
      expect(ModelPrivacyClassSchema.parse('public_cloud')).toBe('standard_cloud');
      expect(normalizeModelPrivacyClass('local_airgapped')).toBe('local_only');
      expect(normalizeModelPrivacyClass('public_cloud')).toBe('standard_cloud');
    });
  });

  describe('ModelDescriptor Schema & Validation', () => {
    const validModel: ModelDescriptor = {
      id: 'mock-interactive-model',
      providerId: 'mock-provider',
      displayName: 'Mock Interactive Model',
      status: 'available',
      latencyClass: 'interactive',
      qualityClass: 'fast',
      costClass: 'free',
      contextClass: 'standard',
      contextWindowTokens: 8192,
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
        local: false,
        structuredOutput: false,
        cancellation: true,
        supportsThai: true,
        supportsEnglish: true
      },
      privacyClass: 'local_only'
    };

    it('validates a well-formed ModelDescriptor', () => {
      const parsed = ModelDescriptorSchema.parse(validModel);
      expect(parsed.id).toBe('mock-interactive-model');
      expect(parsed.providerId).toBe('mock-provider');
      expect(parsed.privacyClass).toBe('local_only');
      expect(parsed.contextWindowTokens).toBe(8192);
    });

    it('rejects ModelDescriptor with invalid/empty providerId', () => {
      expect(() =>
        ModelDescriptorSchema.parse({
          ...validModel,
          providerId: '   '
        })
      ).toThrow();
    });

    it('rejects ModelDescriptor with invalid status', () => {
      expect(() =>
        ModelDescriptorSchema.parse({
          ...validModel,
          status: 'healthy' // invalid: 'healthy' is a provider health status, not model status
        })
      ).toThrow();
    });

    it('rejects ModelDescriptor with invalid capability values', () => {
      expect(() =>
        ModelDescriptorSchema.parse({
          ...validModel,
          capabilities: {
            ...validModel.capabilities,
            streaming: 'yes' // invalid type
          }
        })
      ).toThrow();
    });
  });

  describe('ProviderDescriptor Schema & Validation', () => {
    it('validates a well-formed ProviderDescriptor with provider-level metadata only', () => {
      const descriptor: ProviderDescriptor = {
        id: 'mock-provider',
        kind: 'model_provider',
        displayName: 'Mock Model Provider',
        accessPath: 'official_api',
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
          local: true,
          structuredOutput: false,
          cancellation: true,
          supportsThai: true,
          supportsEnglish: true
        },
        health: {
          status: 'healthy',
          latencyMs: 15,
          checkedAt: 1791850000000
        },
        defaultModelId: 'mock-interactive-model',
        documentationUrl: 'https://example.com/docs'
      };

      const parsed = ProviderDescriptorSchema.parse(descriptor);
      expect(parsed.id).toBe('mock-provider');
      expect(parsed.kind).toBe('model_provider');
      expect(parsed.health.status).toBe('healthy');
      expect(parsed.defaultModelId).toBe('mock-interactive-model');
      expect(parsed.documentationUrl).toBe('https://example.com/docs');
      // Single Source of Truth: Model list is NOT maintained in ProviderDescriptor
      expect(parsed).not.toHaveProperty('supportedModelIds');
    });

    it('rejects malformed ProviderDescriptor', () => {
      expect(() =>
        ProviderDescriptorSchema.parse({
          id: '',
          kind: 'unsupported_kind'
        })
      ).toThrow();
    });
  });

  describe('ModelCatalogSnapshot & Cross-Provider Validation', () => {
    const model1: ModelDescriptor = {
      id: 'mock-model-1',
      providerId: 'provider-alpha',
      displayName: 'Model Alpha 1',
      status: 'available',
      latencyClass: 'interactive',
      qualityClass: 'fast',
      costClass: 'low',
      contextClass: 'standard',
      capabilities: BrainCapabilitiesSchema.parse({ streaming: true, fastChat: true }),
      privacyClass: 'standard_cloud'
    };

    const model2: ModelDescriptor = {
      id: 'mock-model-2',
      providerId: 'provider-alpha',
      displayName: 'Model Alpha 2',
      status: 'available',
      latencyClass: 'balanced',
      qualityClass: 'reasoning',
      costClass: 'medium',
      contextClass: 'large',
      capabilities: BrainCapabilitiesSchema.parse({ streaming: true, reasoning: true }),
      privacyClass: 'standard_cloud'
    };

    it('validates a consistent ModelCatalogSnapshot', () => {
      const catalog: ModelCatalogSnapshot = {
        providerId: 'provider-alpha',
        models: [model1, model2],
        refreshedAt: 1791850000000
      };

      const parsed = ModelCatalogSnapshotSchema.parse(catalog);
      expect(parsed.providerId).toBe('provider-alpha');
      expect(parsed.models.length).toBe(2);
    });

    it('rejects ModelCatalogSnapshot when a model providerId does not match catalog providerId', () => {
      const mismatchedModel: ModelDescriptor = {
        ...model2,
        providerId: 'provider-beta' // mismatch with catalog's 'provider-alpha'
      };

      expect(() =>
        ModelCatalogSnapshotSchema.parse({
          providerId: 'provider-alpha',
          models: [model1, mismatchedModel]
        })
      ).toThrow(/does not match catalog providerId/);
    });
  });

  describe('Request Overrides & localOnly Constraint', () => {
    it('parses valid BrainRouteOverrides with localOnly=true', () => {
      const overrides = BrainRouteOverridesSchema.parse({
        profileId: 'fast_conversation',
        preferredProviderId: 'local-llm',
        preferredModelId: 'qwen-local',
        localOnly: true
      });
      expect(overrides.localOnly).toBe(true);
      expect(overrides.preferredProviderId).toBe('local-llm');
    });

    it('defaults localOnly to false when not provided', () => {
      const overrides = BrainRouteOverridesSchema.parse({});
      expect(overrides.localOnly).toBe(false);
    });

    it('parses BrainRequest with explicit localOnly flag', () => {
      const req = BrainRequestSchema.parse({
        requestId: 'req-priv-1',
        sessionId: 'sess-priv-1',
        intent: 'conversation',
        messages: [{ role: 'user', content: 'Private query' }],
        localOnly: true
      });
      expect(req.localOnly).toBe(true);
    });

    it('resolves effectiveLocalOnly with fail-closed security invariant (overrides can never cancel request.localOnly=true)', () => {
      // 1. request: true, overrides: false -> must remain TRUE (security override cannot weaken)
      expect(resolveEffectiveLocalOnly({ localOnly: true, overrides: { localOnly: false } })).toBe(true);

      // 2. request: false, overrides: true -> becomes TRUE (override strengthens privacy)
      expect(resolveEffectiveLocalOnly({ localOnly: false, overrides: { localOnly: true } })).toBe(true);

      // 3. request: true, overrides: undefined -> TRUE
      expect(resolveEffectiveLocalOnly({ localOnly: true })).toBe(true);

      // 4. request: undefined, overrides: true -> TRUE
      expect(resolveEffectiveLocalOnly({ overrides: { localOnly: true } })).toBe(true);

      // 5. request: false, overrides: false -> FALSE
      expect(resolveEffectiveLocalOnly({ localOnly: false, overrides: { localOnly: false } })).toBe(false);

      // 6. request: undefined, overrides: false -> FALSE
      expect(resolveEffectiveLocalOnly({ overrides: { localOnly: false } })).toBe(false);

      // 7. request: undefined, overrides: undefined -> FALSE
      expect(resolveEffectiveLocalOnly({})).toBe(false);
    });
  });

  describe('Telemetry & Metrics Contracts', () => {
    it('leaves unknown token counts and costs as undefined rather than coercing to 0', () => {
      const usage = GenerationUsageSchema.parse({});
      expect(usage.promptTokens).toBeUndefined();
      expect(usage.completionTokens).toBeUndefined();
      expect(usage.totalTokens).toBeUndefined();
      expect(usage.estimatedCostUsd).toBeUndefined();
    });

    it('validates timing and route telemetry contracts', () => {
      const validReasons = [
        'primary_default',
        'primary_healthy',
        'fallback_healthy',
        'fallback_degraded',
        'explicit_override',
        'capability_match',
        'privacy_constraint'
      ];
      for (const r of validReasons) {
        expect(RouteReasonSchema.parse(r)).toBe(r);
      }

      const timing = GenerationTimingSchema.parse({
        timeToFirstTokenMs: 850,
        totalDurationMs: 2400
      });
      expect(timing.timeToFirstTokenMs).toBe(850);

      const route = RouteTelemetrySchema.parse({
        selectedProviderId: 'fast-provider',
        selectedModelId: 'fast-model-v1',
        profileId: 'fast_conversation',
        routeReason: 'primary_healthy',
        fallbackUsed: false,
        attemptedProviderIds: ['fast-provider'],
        attemptedModelIds: ['fast-model-v1'],
        routeAttempts: 1
      });
      expect(route.routeAttempts).toBe(1);
      expect(route.fallbackUsed).toBe(false);

      const telemetry: BrainTelemetry = BrainTelemetrySchema.parse({
        requestId: 'req-tel-1',
        sessionId: 'sess-tel-1',
        route,
        timing,
        usage: { promptTokens: 120, completionTokens: 45, totalTokens: 165 },
        finishReason: 'stop'
      });
      expect(telemetry.requestId).toBe('req-tel-1');
      expect(telemetry.route.selectedProviderId).toBe('fast-provider');
    });
  });

  describe('Normalized Intelligence Error Codes', () => {
    it('validates canonical lowercase error codes and normalizes uppercase inputs', () => {
      const canonicalCodes = [
        'fast_brain_unavailable',
        'profile_unavailable',
        'model_unavailable',
        'provider_unconfigured',
        'quota_limited',
        'rate_limited',
        'auth_required',
        'local_provider_unavailable',
        'routing_timeout',
        'generation_cancelled'
      ];
      for (const code of canonicalCodes) {
        expect(CanonicalBrainErrorCodeSchema.parse(code)).toBe(code);
        expect(BrainErrorCodeSchema.parse(code)).toBe(code);
      }

      // Canonical schema strictly requires lowercase
      expect(() => CanonicalBrainErrorCodeSchema.parse('FAST_BRAIN_UNAVAILABLE')).toThrow();

      // BrainErrorCodeSchema and normalizeBrainErrorCode normalize uppercase to canonical lowercase
      expect(BrainErrorCodeSchema.parse('FAST_BRAIN_UNAVAILABLE')).toBe('fast_brain_unavailable');
      expect(BrainErrorCodeSchema.parse('MODEL_UNAVAILABLE')).toBe('model_unavailable');
      expect(BrainErrorCodeSchema.parse('QUOTA_LIMITED')).toBe('quota_limited');
      expect(normalizeBrainErrorCode('FAST_BRAIN_UNAVAILABLE')).toBe('fast_brain_unavailable');
      expect(normalizeBrainErrorCode('LOCAL_PROVIDER_UNAVAILABLE')).toBe('local_provider_unavailable');
    });

    it('validates BrainError emission always emits canonical lowercase error codes', () => {
      const err = BrainErrorSchema.parse({
        code: 'FAST_BRAIN_UNAVAILABLE',
        message: 'No healthy fast brain provider available',
        retryable: false,
        providerId: 'gemini-provider',
        modelId: 'flash-conversation'
      });
      // Emitted code is normalized canonical lowercase
      expect(err.code).toBe('fast_brain_unavailable');
      expect(err.providerId).toBe('gemini-provider');
      expect(err.modelId).toBe('flash-conversation');
    });
  });

  describe('ModelCatalogProvider Capability Boundary', () => {
    it('correctly identifies ModelCatalogProvider via isModelCatalogProvider type-guard', async () => {
      const basicProvider: BrainProvider = {
        id: 'basic-mock',
        getCapabilities: () => BrainCapabilitiesSchema.parse({ fastChat: true }),
        health: async () => ({ status: 'healthy', checkedAt: Date.now() }),
        chat: async function* () {}
      };

      expect(isModelCatalogProvider(basicProvider)).toBe(false);

      const catalogProvider: ModelCatalogProvider = {
        ...basicProvider,
        id: 'catalog-mock',
        getCatalog: async () => ({
          providerId: 'catalog-mock',
          models: [],
          refreshedAt: Date.now()
        }),
        getDescriptor: () => ({
          id: 'catalog-mock',
          kind: 'model_provider',
          displayName: 'Catalog Mock Provider',
          accessPath: 'official_api',
          capabilities: BrainCapabilitiesSchema.parse({ fastChat: true }),
          health: { status: 'healthy', checkedAt: Date.now() }
        })
      };

      expect(isModelCatalogProvider(catalogProvider)).toBe(true);
    });
  });

  describe('Normalized ModelId Semantics', () => {
    it('accepts MAVE-normalized stable model catalog identifiers decoupled from vendor specifics', () => {
      // MAVE normalized catalog identifiers
      const maveModelIds = [
        'openai-fast-primary',
        'anthropic-reasoning-primary',
        'local-llama-offline',
        'mock-fast-v1'
      ];

      for (const id of maveModelIds) {
        expect(ModelIdSchema.parse(id)).toBe(id);
      }

      // Concrete vendor marketing names (e.g. gpt-4o-2024-08-06) belong in provider adapter private config,
      // not hardcoded as core types. ModelIdSchema validates trimmed non-empty identifiers.
      expect(ModelIdSchema.parse('  openai-fast-primary  ')).toBe('openai-fast-primary');
      expect(() => ModelIdSchema.parse('')).toThrow();
      expect(() => ModelIdSchema.parse('   ')).toThrow();
    });
  });

  describe('JSON Serialization Round-Trip', () => {
    it('safely serializes and deserializes descriptors and catalogs across JSON boundaries', () => {
      const catalog: ModelCatalogSnapshot = {
        providerId: 'mock-provider',
        models: [
          {
            id: 'mock-model-json',
            providerId: 'mock-provider',
            displayName: 'JSON Safe Model',
            status: 'available',
            latencyClass: 'interactive',
            qualityClass: 'fast',
            costClass: 'free',
            contextClass: 'standard',
            capabilities: BrainCapabilitiesSchema.parse({ streaming: true }),
            privacyClass: 'local_only'
          }
        ],
        refreshedAt: 1791850000000
      };

      const jsonString = JSON.stringify(catalog);
      const parsedFromRaw = JSON.parse(jsonString);
      const validated = ModelCatalogSnapshotSchema.parse(parsedFromRaw);

      expect(validated.providerId).toBe('mock-provider');
      expect(validated.models[0]?.id).toBe('mock-model-json');
      expect(validated.models[0]?.privacyClass).toBe('local_only');
    });
  });
});
