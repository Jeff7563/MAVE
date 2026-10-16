import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BrainProviderRegistry,
  BrainRouter,
  SessionManager,
  ConversationRuntime,
  VoiceSessionCoordinator
} from '@mave/core';
import {
  type BrainProvider,
  type BrainEvent,
  type TTSProvider
} from '@mave/contracts';
import {
  MockAudioInputProvider,
  MockAudioOutput,
  MockModelCatalogProvider,
  MockSTTProvider,
  MockTTSProvider,
  OllamaBrainProvider,
  createPCMFixtureFrames
} from '@mave/providers';
import { createMaveDatabase, type MaveDatabase } from '@mave/database';
import { ConversationManager } from '../src/main/conversation-manager.js';

const QUALIFIED_1_5B_DIGEST = '65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b';

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function createMockNdjsonResponse(lines: unknown[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const item of lines) {
        const line = typeof item === 'string' ? item : JSON.stringify(item);
        controller.enqueue(encoder.encode(line + '\n'));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'application/x-ndjson' }
  });
}

describe('Real Voice Fast Brain Wiring & Truthful Audio Diagnostics', () => {
  let db: MaveDatabase;

  beforeEach(async () => {
    db = await createMaveDatabase(':memory:');
  });

  it('Test A: Normal production ConversationManager (useMockBrain: false) does NOT register MockBrainProvider', () => {
    const manager = new ConversationManager({
      database: db,
      useMockBrain: false
    });

    expect(manager.getProviderRegistry().has('mock')).toBe(false);
    expect(manager.getRouter().getDefaultProvider()).toBe('ollama');
  });

  it('Test B: Normal production ConversationManager routes fast_conversation to ollama (ollama-qwen2.5-1.5b)', async () => {
    const mockTags = {
      models: [
        {
          name: 'qwen2.5:1.5b',
          digest: QUALIFIED_1_5B_DIGEST,
          details: { parameter_size: '1.5B', context_length: 32768 },
          capabilities: ['completion']
        }
      ]
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/api/tags')) return createJsonResponse(mockTags);
      if (url.endsWith('/api/version')) return createJsonResponse({ version: '0.40.4' });
      return createJsonResponse({});
    });

    const ollamaProvider = new OllamaBrainProvider({ fetchFn: mockFetch });
    const registry = new BrainProviderRegistry();
    registry.register(ollamaProvider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Ollama Local Fast Brain'
    });

    const router = new BrainRouter({
      registry,
      defaultProvider: 'ollama',
      allowPaidApis: false
    });

    const manager = new ConversationManager({
      database: db,
      providerRegistry: registry,
      router,
      useMockBrain: false
    });

    const decision = await manager.getRouter().route({ profileId: 'fast_conversation' });
    expect(decision.providerId).toBe('ollama');
    expect(decision.modelId).toBe('ollama-qwen2.5-1.5b');
    expect(decision.fallbackUsed).toBe(false);
  });

  it('Test C: Mock is selectable in explicit test/mock mode (useMockBrain: true)', () => {
    const manager = new ConversationManager({
      database: db,
      useMockBrain: true
    });

    expect(manager.getProviderRegistry().has('mock')).toBe(true);
    expect(manager.getRouter().getDefaultProvider()).toBe('mock');
  });

  it('Test D: Ollama unavailable in production fails honestly without falling back to Mock', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      throw new Error('Connection refused to http://127.0.0.1:11434');
    });

    const ollamaProvider = new OllamaBrainProvider({ fetchFn: mockFetch });
    const registry = new BrainProviderRegistry();
    registry.register(ollamaProvider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Ollama Local Fast Brain'
    });

    const router = new BrainRouter({
      registry,
      defaultProvider: 'ollama',
      allowPaidApis: false
    });

    const manager = new ConversationManager({
      database: db,
      providerRegistry: registry,
      router,
      useMockBrain: false
    });

    // Mock provider was never registered
    expect(manager.getProviderRegistry().has('mock')).toBe(false);

    // Routing fast_conversation fails honestly because Ollama is down and no mock fallback exists
    await expect(manager.getRouter().route({ profileId: 'fast_conversation' })).rejects.toThrow(
      /Fast conversation brain is unavailable|no_healthy_provider|fast_brain_unavailable/i
    );
  });

  it('Test E: Paid APIs remain disabled by default (allowPaidApis: false)', () => {
    const manager = new ConversationManager({
      database: db,
      useMockBrain: false
    });

    expect(manager.getRouter().isPaidApisAllowed()).toBe(false);
  });

  it('Test F: Agent runtimes (agent_runtime_provider) never satisfy fast_conversation profile', async () => {
    const registry = new BrainProviderRegistry();

    // Register an agent runtime provider
    const agentProvider: BrainProvider = {
      id: 'agent-codex',
      getCapabilities: () => ({
        streaming: true,
        fastChat: false,
        reasoning: false,
        coding: true,
        toolUse: true,
        multimodal: false,
        vision: false,
        webResearch: false,
        longContext: true,
        local: true
      }),
      health: async () => ({ status: 'healthy', checkedAt: Date.now() }),
      chat: async function* (req): AsyncIterable<BrainEvent> {
        yield { type: 'delta', requestId: req.requestId, text: 'Agent response' };
      }
    };

    registry.register(agentProvider, {
      kind: 'agent_runtime_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Local Codex Agent'
    });

    const router = new BrainRouter({
      registry,
      defaultProvider: 'agent-codex',
      allowPaidApis: false
    });

    // Fast conversation requires model_provider, so agent_runtime_provider must never satisfy it
    await expect(router.route({ profileId: 'fast_conversation' })).rejects.toThrow(
      /Fast conversation brain is unavailable|no_healthy_provider|fast_brain_unavailable/i
    );
  });

  it('Test G: Voice Coordinator resolves fast_conversation to Ollama and records RouteTelemetry', async () => {
    const mockTags = {
      models: [
        {
          name: 'qwen2.5:1.5b',
          digest: QUALIFIED_1_5B_DIGEST,
          details: { parameter_size: '1.5B', context_length: 32768 },
          capabilities: ['completion']
        }
      ]
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/api/tags')) return createJsonResponse(mockTags);
      if (url.endsWith('/api/version')) return createJsonResponse({ version: '0.40.4' });
      if (url.endsWith('/api/chat') || url.endsWith('/api/generate')) {
        return createMockNdjsonResponse([
          { message: { role: 'assistant', content: 'Yes, I can ' }, done: false },
          { message: { role: 'assistant', content: 'hear you clearly.' }, done: true }
        ]);
      }
      return createJsonResponse({});
    });

    const ollamaProvider = new OllamaBrainProvider({ fetchFn: mockFetch });
    const registry = new BrainProviderRegistry();
    registry.register(ollamaProvider, {
      kind: 'model_provider',
      accessPath: 'local_runtime',
      accessClass: 'local',
      displayName: 'Ollama Local Fast Brain'
    });

    const router = new BrainRouter({
      registry,
      defaultProvider: 'ollama',
      allowPaidApis: false
    });

    const sessionManager = new SessionManager();
    const conversationRuntime = new ConversationRuntime({
      sessionManager,
      router
    });

    const audioInput = new MockAudioInputProvider({
      frames: createPCMFixtureFrames(2)
    });
    const stt = new MockSTTProvider({
      finalText: 'Can you hear me?'
    });
    const tts = new MockTTSProvider({
      fixedFrameCount: 3
    });
    const audioOutput = new MockAudioOutput();

    const coordinator = new VoiceSessionCoordinator({
      audioInput,
      stt,
      tts,
      audioOutput,
      conversationRuntime
    });

    const events = [];
    for await (const event of coordinator.startSession()) {
      events.push(event);
    }

    const routeTelemetry = coordinator.getRouteTelemetry();
    expect(routeTelemetry).toBeDefined();
    expect(routeTelemetry?.selectedProviderId).toBe('ollama');
    expect(routeTelemetry?.selectedModelId).toBe('ollama-qwen2.5-1.5b');
    expect(routeTelemetry?.fallbackUsed).toBe(false);
  });

  it('Test H1: Speaking state is not emitted on 0 frames', async () => {
    const sessionManager = new SessionManager();
    const brainProvider = new MockModelCatalogProvider({
      responseText: 'Silent response'
    });
    const registry = new BrainProviderRegistry();
    registry.register(brainProvider);
    const router = new BrainRouter({ registry, defaultProvider: brainProvider.id });
    const conversationRuntime = new ConversationRuntime({ sessionManager, router });

    const audioInput = new MockAudioInputProvider({
      frames: createPCMFixtureFrames(2)
    });
    const stt = new MockSTTProvider({
      finalText: 'Hello'
    });
    // Custom TTS that yields 0 audio frames
    const zeroFrameTts: TTSProvider = {
      id: 'zero-frame-tts',
      getCapabilities: () => ({
        streaming: true,
        languages: ['en'],
        voiceSelection: true,
        speakingRate: true,
        wordTimings: false,
        local: true
      }),
      health: async () => ({ status: 'healthy', checkedAt: Date.now() }),
      synthesize: async function* () {
        // Deliberately yields 0 audio frames
      }
    };
    const audioOutput = new MockAudioOutput();

    const coordinator = new VoiceSessionCoordinator({
      audioInput,
      stt,
      tts: zeroFrameTts,
      audioOutput,
      conversationRuntime
    });

    const events = [];
    for await (const event of coordinator.startSession()) {
      events.push(event);
    }

    // Speaking started must NEVER have been emitted
    const speakingStarted = events.find((e) => e.type === 'speaking_started');
    expect(speakingStarted).toBeUndefined();

    // Diagnostics must record 0 frames and the truthful failure reason
    const diagnostics = coordinator.getAudioDiagnostics();
    expect(diagnostics.frameCount).toBe(0);
    expect(diagnostics.framesEmitted).toBe(false);
    expect(diagnostics.audioOutputPlayInvoked).toBe(false);
    expect(diagnostics.playbackError).toBe('No audio frames emitted by TTS provider');
  });

  it('Test H2: Audio output errors surface honestly as audio_output_error', async () => {
    const sessionManager = new SessionManager();
    const brainProvider = new MockModelCatalogProvider({
      responseText: 'Error response'
    });
    const registry = new BrainProviderRegistry();
    registry.register(brainProvider);
    const router = new BrainRouter({ registry, defaultProvider: brainProvider.id });
    const conversationRuntime = new ConversationRuntime({ sessionManager, router });

    const audioInput = new MockAudioInputProvider({
      frames: createPCMFixtureFrames(2)
    });
    const stt = new MockSTTProvider({
      finalText: 'Hello'
    });
    const tts = new MockTTSProvider({
      fixedFrameCount: 2
    });
    // Audio output throws on playStream
    const audioOutput = new MockAudioOutput();
    audioOutput.playStream = async () => {
      throw new Error('Hardware audio device disconnected');
    };

    const coordinator = new VoiceSessionCoordinator({
      audioInput,
      stt,
      tts,
      audioOutput,
      conversationRuntime
    });

    const events = [];
    for await (const event of coordinator.startSession()) {
      events.push(event);
    }

    const failed = events.find((e) => e.type === 'voice_session_failed') as any;
    expect(failed).toBeDefined();
    expect(failed.errorCode).toBe('audio_output_error');

    const diagnostics = coordinator.getAudioDiagnostics();
    expect(diagnostics.audioOutputPlayInvoked).toBe(true);
    expect(diagnostics.playbackError).toContain('Hardware audio device disconnected');
  });

  it('Test H3: TTS failure degrades cleanly to text when configured without session failure', async () => {
    const sessionManager = new SessionManager();
    const brainProvider = new MockModelCatalogProvider({
      responseText: 'Text preserved response'
    });
    const registry = new BrainProviderRegistry();
    registry.register(brainProvider);
    const router = new BrainRouter({ registry, defaultProvider: brainProvider.id });
    const conversationRuntime = new ConversationRuntime({ sessionManager, router });

    const audioInput = new MockAudioInputProvider({
      frames: createPCMFixtureFrames(2)
    });
    const stt = new MockSTTProvider({
      finalText: 'Hello'
    });
    const tts = new MockTTSProvider({
      failureMode: 'error_event',
      errorMessage: 'Network error contacting EdgeTTS'
    });
    const audioOutput = new MockAudioOutput();

    const coordinator = new VoiceSessionCoordinator({
      audioInput,
      stt,
      tts,
      audioOutput,
      conversationRuntime,
      degradeToTextOnTtsFailure: true
    });

    const events = [];
    for await (const event of coordinator.startSession()) {
      events.push(event);
    }

    // Must not fail session
    const failed = events.find((e) => e.type === 'voice_session_failed');
    expect(failed).toBeUndefined();

    // Must not emit speaking started
    const speakingStarted = events.find((e) => e.type === 'speaking_started');
    expect(speakingStarted).toBeUndefined();

    // Session completes normally
    const completed = events.find((e) => e.type === 'voice_session_completed');
    expect(completed).toBeDefined();

    const diagnostics = coordinator.getAudioDiagnostics();
    expect(diagnostics.playbackError).toContain('Network error contacting EdgeTTS');
  });
});

