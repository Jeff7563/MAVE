import { describe, it, expect } from 'vitest';
import {
  VoiceSessionCoordinator,
  VoiceCoordinatorError,
  type VoiceSessionCoordinatorOptions
} from '../voice/index.js';
import {
  VoiceRuntimeEventSchema,
  type AudioFrame,
  type BrainProvider,
  type ModelCatalogProvider,
  type ModelCatalogSnapshot,
  type ProviderDescriptor
} from '@mave/contracts';
import { SessionManager } from '../conversation/index.js';
import { BrainProviderRegistry, BrainRouter } from '../brain/index.js';
import { ConversationRuntime } from '../conversation/index.js';
import {
  MockAudioInputProvider,
  MockAudioOutput,
  MockModelCatalogProvider,
  MockSTTProvider,
  MockTTSProvider,
  createPCMFixtureFrames,
  type MockBrainOptions,
  type MockSTTOptions,
  type MockTTSOptions,
  type MockAudioOutputOptions
} from '@mave/providers';

interface TestHarnessOptions {
  audioFrames?: AudioFrame[];
  sttOptions?: MockSTTOptions;
  brainOptions?: MockBrainOptions;
  ttsOptions?: MockTTSOptions;
  outputOptions?: MockAudioOutputOptions;
  coordinatorOptions?: Partial<VoiceSessionCoordinatorOptions>;
}

function createTestHarness(overrides?: TestHarnessOptions) {
  const audioInput = new MockAudioInputProvider({
    frames: overrides?.audioFrames ?? createPCMFixtureFrames(3)
  });
  const stt = new MockSTTProvider({
    finalText: 'Hello MAVE',
    partials: ['H', 'Hello', 'Hello MAVE'],
    ...overrides?.sttOptions
  });
  const brainProvider = new MockModelCatalogProvider({
    chunks: ['Hello.', ' How can I help you today?'],
    ...overrides?.brainOptions
  });
  const tts = new MockTTSProvider({
    fixedFrameCount: 2,
    ...overrides?.ttsOptions
  });
  const audioOutput = new MockAudioOutput({
    ...overrides?.outputOptions
  });

  const sessionManager = new SessionManager();
  const registry = new BrainProviderRegistry();
  registry.register(brainProvider);
  const router = new BrainRouter(registry, { defaultProvider: brainProvider.id });
  const conversationRuntime = new ConversationRuntime({
    sessionManager,
    router
  });

  const coordinator = new VoiceSessionCoordinator({
    audioInput,
    stt,
    tts,
    audioOutput,
    conversationRuntime,
    clock: () => 1000,
    voiceSessionIdFactory: () => 'voice-test-sess-1',
    ...overrides?.coordinatorOptions
  });

  return {
    audioInput,
    stt,
    brainProvider,
    tts,
    audioOutput,
    sessionManager,
    conversationRuntime,
    coordinator
  };
}

describe('VoiceSessionCoordinator — Happy Path & Integration (Section 40)', () => {
  it('orchestrates full mock loop end-to-end with deterministic event sequence', async () => {
    const { coordinator, audioOutput, sessionManager } = createTestHarness();

    const events = [];
    for await (const event of coordinator.startSession()) {
      events.push(event);
    }

    const types = events.map((e) => e.type);

    // Verify canonical event ordering
    expect(types).toContain('voice_session_started');
    expect(types).toContain('listening_started');
    expect(types).toContain('speech_started');
    expect(types).toContain('partial_transcript');
    expect(types).toContain('final_transcript');
    expect(types).toContain('thinking_started');
    expect(types).toContain('speaking_started');
    expect(types).toContain('speaking_finished');
    expect(types).toContain('voice_session_completed');

    // First and terminal events
    expect(events[0]?.type).toBe('voice_session_started');
    expect(events[events.length - 1]?.type).toBe('voice_session_completed');

    // Final transcript occurs exactly once
    const finalTranscripts = events.filter((e) => e.type === 'final_transcript');
    expect(finalTranscripts.length).toBe(1);
    expect((finalTranscripts[0] as any).text).toBe('Hello MAVE');

    // ConversationRuntime turns were persisted
    const sessions = sessionManager.listSessions();
    expect(sessions.length).toBe(1);
    const turns = sessionManager.getTurns(sessions[0]!.id);
    expect(turns.length).toBe(2); // 1 user turn, 1 assistant turn
    expect(turns[0]?.role).toBe('user');
    expect(turns[0]?.content).toBe('Hello MAVE');
    expect(turns[1]?.role).toBe('assistant');
    expect(turns[1]?.status).toBe('completed');

    // Audio was played on AudioOutput
    expect(audioOutput.getPlayedFrameCount()).toBeGreaterThan(0);

    // Coordinator cleaned up active session
    expect(coordinator.getActiveSession()).toBeUndefined();
    expect(coordinator.getLastSession()?.status).toBe('completed');
  });
});

describe('Progressive Speech Integration Test (Section 41 — CRITICAL)', () => {
  it('begins TTS synthesis and audio playback BEFORE Brain completes', async () => {
    let releaseGate!: () => void;
    const gatePromise = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    let firstChunkPlayedBeforeBrainDone = false;
    let brainFinished = false;

    // Custom Brain provider that emits Delta 1, waits at gate, then emits Delta 2
    const gatedBrain: BrainProvider & ModelCatalogProvider = {
      id: 'gated-brain',
      getCapabilities: () => ({
        streaming: true,
        fastChat: true,
        reasoning: false,
        coding: false,
        toolUse: false,
        local: false,
        multimodal: false,
        vision: false,
        webResearch: false,
        longContext: false
      }),
      health: async () => ({ status: 'healthy', checkedAt: Date.now() }),
      async getCatalog(): Promise<ModelCatalogSnapshot> {
        return {
          providerId: 'gated-brain',
          models: [
            {
              id: 'gated-brain-default',
              providerId: 'gated-brain',
              displayName: 'gated-brain-default',
              status: 'available',
              latencyClass: 'interactive',
              qualityClass: 'fast',
              costClass: 'low',
              contextClass: 'standard',
              contextWindowTokens: 8192,
              privacyClass: 'standard_cloud',
              capabilities: {
                streaming: true,
                fastChat: true,
                reasoning: false,
                coding: false,
                toolUse: false,
                local: false,
                multimodal: false,
                vision: false,
                webResearch: false,
                longContext: false
              }
            }
          ],
          refreshedAt: Date.now()
        };
      },
      getDescriptor(): ProviderDescriptor {
        return {
          id: 'gated-brain',
          kind: 'model_provider',
          displayName: 'Gated Brain',
          accessPath: 'official_api',
          capabilities: {
            streaming: true,
            fastChat: true,
            reasoning: false,
            coding: false,
            toolUse: false,
            local: false,
            multimodal: false,
            vision: false,
            webResearch: false,
            longContext: false
          },
          health: { status: 'healthy', checkedAt: Date.now() }
        };
      },
      async *chat() {
        yield { type: 'started', requestId: 'g-req', providerId: 'gated-brain', timestamp: 1000 };
        // Delta 1: Complete sentence suitable for immediate chunking
        yield { type: 'delta', requestId: 'g-req', text: 'Hello there.' };

        // Hold Brain completion until gate is unlocked
        await gatePromise;

        // Delta 2
        yield { type: 'delta', requestId: 'g-req', text: ' How are you doing?' };
        brainFinished = true;
        yield { type: 'completed', requestId: 'g-req', text: 'Hello there. How are you doing?' };
      }
    };

    const sessionManager = new SessionManager();
    const registry = new BrainProviderRegistry();
    registry.register(gatedBrain);
    const router = new BrainRouter(registry, { defaultProvider: 'gated-brain' });
    const conversationRuntime = new ConversationRuntime({ sessionManager, router });

    const audioInput = new MockAudioInputProvider();
    const stt = new MockSTTProvider({ finalText: 'Start progressive test' });
    const tts = new MockTTSProvider({ fixedFrameCount: 2 });
    const audioOutput = new MockAudioOutput();

    const coordinator = new VoiceSessionCoordinator({
      audioInput,
      stt,
      tts,
      audioOutput,
      conversationRuntime,
      clock: () => 1000
    });

    const stream = coordinator.startSession();
    const eventsPromise = (async () => {
      const evs = [];
      for await (const ev of stream) {
        evs.push(ev);
        // Observe if speaking_started fired while Brain was still waiting at gate
        if (ev.type === 'speaking_started' && !brainFinished) {
          firstChunkPlayedBeforeBrainDone = true;
          // Now safely release gate so Brain finishes Delta 2
          releaseGate();
        }
      }
      return evs;
    })();

    const events = await eventsPromise;

    expect(firstChunkPlayedBeforeBrainDone).toBe(true);
    expect(events.some((e) => e.type === 'speaking_started')).toBe(true);
    expect(events.some((e) => e.type === 'speaking_finished')).toBe(true);
    expect(events[events.length - 1]?.type).toBe('voice_session_completed');
  });
});

describe('Partial Transcript Handling (Section 42)', () => {
  it('emits partial transcript events without polluting ConversationRuntime store', async () => {
    const { coordinator, sessionManager } = createTestHarness({
      sttOptions: {
        partials: ['H', 'Hell', 'Hello', 'Hello MAVE'],
        finalText: 'Hello MAVE'
      }
    });

    const events = [];
    for await (const event of coordinator.startSession()) {
      events.push(event);
    }

    const partials = events.filter((e) => e.type === 'partial_transcript');
    expect(partials.length).toBe(4);

    const sessions = sessionManager.listSessions();
    const turns = sessionManager.getTurns(sessions[0]!.id);
    // User turn should strictly contain only the final transcript
    expect(turns[0]?.content).toBe('Hello MAVE');
  });
});

describe('Conversation Session Continuity (Section 9)', () => {
  it('reuses conversationSessionId across subsequent voice turns', async () => {
    const { coordinator } = createTestHarness();

    // Turn 1
    const events1 = [];
    for await (const ev of coordinator.startSession()) {
      events1.push(ev);
    }
    const last1 = coordinator.getLastSession();
    expect(last1?.conversationSessionId).toBeDefined();
    const capturedConvId = last1!.conversationSessionId;

    // Turn 2: Starts passing the captured conversationSessionId
    const events2 = [];
    for await (const ev of coordinator.startSession({ conversationSessionId: capturedConvId })) {
      events2.push(ev);
    }
    const last2 = coordinator.getLastSession();
    expect(last2?.conversationSessionId).toBe(capturedConvId);
  });
});

describe('Session Concurrency (Section 45)', () => {
  it('rejects starting a new session while another session is in progress', async () => {
    const { coordinator } = createTestHarness();

    const stream = coordinator.startSession();
    const iterator = stream[Symbol.asyncIterator]();

    // Consume first event to ensure session is actively running
    await iterator.next();

    expect(() => coordinator.startSession()).toThrow(VoiceCoordinatorError);
    expect(() => coordinator.startSession()).toThrow(/already active/);

    // Stop active session cleanly
    await coordinator.stopSession();
  });
});

describe('Cancellation Tests (Section 43)', () => {
  it('cancels active session cleanly via stopSession()', async () => {
    const { coordinator } = createTestHarness();

    const stream = coordinator.startSession();
    const iterator = stream[Symbol.asyncIterator]();

    // Consume initial events
    await iterator.next();

    // Stop session
    await coordinator.stopSession('user_interrupted');

    const remainingEvents = [];
    while (true) {
      const res = await iterator.next();
      if (res.done) break;
      remainingEvents.push(res.value);
    }

    expect(remainingEvents.some((e) => e.type === 'voice_session_cancelled')).toBe(true);
    expect(coordinator.getActiveSession()).toBeUndefined();
    expect(coordinator.getLastSession()?.status).toBe('cancelled');
  });

  it('guarantees exactly one terminal cancellation event', async () => {
    const { coordinator } = createTestHarness();

    const stream = coordinator.startSession();
    const iterator = stream[Symbol.asyncIterator]();
    await iterator.next();

    // Multiple rapid stops
    await Promise.all([
      coordinator.stopSession('stop_1'),
      coordinator.stopSession('stop_2'),
      coordinator.stopSession('stop_3')
    ]);

    const allEvents = [];
    while (true) {
      const res = await iterator.next();
      if (res.done) break;
      allEvents.push(res.value);
    }

    const cancelledEvents = allEvents.filter((e) => e.type === 'voice_session_cancelled');
    expect(cancelledEvents.length).toBe(1);
  });
});

describe('Failure Normalization & Terminal Protection (Section 44)', () => {
  it('handles STT error event cleanly', async () => {
    const { coordinator } = createTestHarness({
      sttOptions: {
        failureMode: 'error_event',
        errorMessage: 'Microphone speech decoder failed'
      }
    });

    const events = [];
    for await (const ev of coordinator.startSession()) {
      events.push(ev);
    }

    const failedEvents = events.filter((e) => e.type === 'voice_session_failed');
    expect(failedEvents.length).toBe(1);
    expect((failedEvents[0] as any).errorCode).toBe('stt_error');
    expect(coordinator.getActiveSession()).toBeUndefined();
    expect(coordinator.getLastSession()?.status).toBe('error');
  });

  it('handles empty / whitespace final transcript as no_speech_detected', async () => {
    const { coordinator } = createTestHarness({
      sttOptions: {
        finalText: '    '
      }
    });

    const events = [];
    for await (const ev of coordinator.startSession()) {
      events.push(ev);
    }

    const failed = events.find((e) => e.type === 'voice_session_failed') as any;
    expect(failed).toBeDefined();
    expect(failed.errorCode).toBe('no_speech_detected');
  });

  it('handles Brain failure cleanly', async () => {
    const { coordinator } = createTestHarness({
      brainOptions: {
        failureMode: 'error_event',
        errorMessage: 'LLM service rate limited'
      }
    });

    const events = [];
    for await (const ev of coordinator.startSession()) {
      events.push(ev);
    }

    const failed = events.find((e) => e.type === 'voice_session_failed') as any;
    expect(failed).toBeDefined();
    expect(failed.errorCode).toBe('conversation_error');
  });

  it('handles TTS error cleanly', async () => {
    const { coordinator } = createTestHarness({
      ttsOptions: {
        failureMode: 'error_event',
        errorMessage: 'Speech synthesizer failed'
      }
    });

    const events = [];
    for await (const ev of coordinator.startSession()) {
      events.push(ev);
    }

    const failed = events.find((e) => e.type === 'voice_session_failed') as any;
    expect(failed).toBeDefined();
    expect(failed.errorCode).toBe('tts_error');
  });
});

describe('Dispose Tests (Section 46)', () => {
  it('dispose() terminates active session and rejects future sessions', async () => {
    const { coordinator } = createTestHarness();

    const stream = coordinator.startSession();
    const iterator = stream[Symbol.asyncIterator]();
    await iterator.next();

    await coordinator.dispose();

    expect(() => coordinator.startSession()).toThrow(VoiceCoordinatorError);
    expect(() => coordinator.startSession()).toThrow(/disposed/);

    // Calling dispose second time is safe and idempotent
    await expect(coordinator.dispose()).resolves.toBeUndefined();
  });
});

describe('Event Serialization (Section 47)', () => {
  it('ensures all emitted VoiceRuntimeEvents are serializable plain JSON objects', async () => {
    const { coordinator } = createTestHarness();

    for await (const event of coordinator.startSession()) {
      const json = JSON.stringify(event);
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);

      // Validate parsed JSON against canonical VoiceRuntimeEventSchema
      const validated = VoiceRuntimeEventSchema.parse(parsed);
      expect(validated.type).toBe(event.type);
      expect(validated.sessionId).toBe(event.sessionId);

      // Verify no binary or raw objects leaked
      expect(event).not.toHaveProperty('frame');
      expect(event).not.toHaveProperty('data');
      expect(event).not.toHaveProperty('signal');
    }
  });
});

describe('Immutability (Section 33)', () => {
  it('getActiveSession() and getLastSession() return immutable copies', () => {
    const { coordinator } = createTestHarness();

    void coordinator.startSession();
    const active = coordinator.getActiveSession();
    expect(active).toBeDefined();

    // Mutate returned object
    (active as any).status = 'error';

    // Coordinator internal status remains 'listening'
    expect(coordinator.getActiveSession()?.status).toBe('listening');
  });
});
