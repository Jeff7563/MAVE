import { describe, it, expect } from 'vitest';
import {
  BrainCapabilitiesSchema,
  BrainConfigSchema,
  BrainErrorCodeSchema,
  BrainErrorSchema,
  BrainEventSchema,
  BrainRequestSchema,
  BrainResponseSchema,
  BrainUsageSchema,
  ConversationRoleSchema,
  ConversationTurnSchema,
  ConversationTurnStatusSchema,
  DefaultMaveConfig,
  MaveConfigSchema,
  MaveMessageSchema,
  ProviderHealthSchema,
  SessionSchema,
  SessionStatusSchema,
  StreamingChunkSchema,
  type BrainCapabilities,
  type BrainEvent,
  type BrainProvider
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
      local: false
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
