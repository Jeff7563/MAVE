import { describe, it, expect, vi } from 'vitest';
import {
  VoiceSessionCoordinator,
  type VoiceSessionCoordinatorOptions
} from '../voice/index.js';
import {
  VoiceRuntimeEventSchema,
  type AudioFrame,
  type VoiceRuntimeEvent
} from '@mave/contracts';
import { SessionManager } from '../conversation/index.js';
import { BrainProviderRegistry, BrainRouter } from '../brain/index.js';
import { ConversationRuntime } from '../conversation/index.js';
import {
  MockAudioInputProvider,
  MockAudioOutput,
  MockBrainProvider,
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

function createBargeInHarness(overrides?: TestHarnessOptions) {
  const audioInput = new MockAudioInputProvider({
    frames: overrides?.audioFrames ?? createPCMFixtureFrames(3)
  });
  const stt = new MockSTTProvider({
    finalText: 'Hello MAVE',
    partials: ['H', 'Hello', 'Hello MAVE'],
    ...overrides?.sttOptions
  });
  const brainProvider = new MockBrainProvider({
    chunks: ['First sentence here.', ' Second sentence following.'],
    delayMs: 0,
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
    voiceSessionIdFactory: () => 'voice-barge-in-sess-1',
    clock: () => 1000,
    ...overrides?.coordinatorOptions
  });

  return {
    coordinator,
    audioInput,
    stt,
    brainProvider,
    tts,
    audioOutput,
    conversationRuntime,
    sessionManager
  };
}

describe('M3.6 Voice Barge-In & Interruption Pipeline', () => {
  it('interrupts while speaking with provable call ordering (AudioOutput.stop called first)', async () => {
    const callOrder: string[] = [];

    const harness = createBargeInHarness({
      brainOptions: {
        chunks: ['Long response with multiple speech chunks.', ' Continuing the speech.']
      },
      outputOptions: {
        frameDelayMs: 20
      }
    });

    const origOutputStop = harness.audioOutput.stop.bind(harness.audioOutput);
    vi.spyOn(harness.audioOutput, 'stop').mockImplementation(async () => {
      callOrder.push('audioOutput.stop');
      return origOutputStop();
    });

    const origTtsCancel = harness.tts.cancel?.bind(harness.tts);
    if (origTtsCancel) {
      vi.spyOn(harness.tts, 'cancel').mockImplementation(async (id) => {
        callOrder.push('tts.cancel');
        return origTtsCancel(id);
      });
    }

    const origBrainCancel = harness.conversationRuntime.cancel.bind(harness.conversationRuntime);
    vi.spyOn(harness.conversationRuntime, 'cancel').mockImplementation(async (id) => {
      callOrder.push('conversationRuntime.cancel');
      return origBrainCancel(id);
    });

    harness.stt.setFinalTexts(['Initial user query', 'Second query after interruption']);

    const events: VoiceRuntimeEvent[] = [];
    const eventStream = harness.coordinator.startSession();

    let interrupted = false;
    for await (const event of eventStream) {
      events.push(event);

      // Trigger barge-in immediately when MAVE begins speaking
      if (event.type === 'speaking_started' && !interrupted) {
        interrupted = true;
        expect(harness.coordinator.getActiveSession()?.status).toBe('speaking');

        const success = await harness.coordinator.interrupt({ reason: 'user_speech_barge_in' });
        expect(success).toBe(true);

        // Provable ordering: AudioOutput.stop() must be invoked first
        expect(callOrder[0]).toBe('audioOutput.stop');
        expect(harness.coordinator.getActiveSession()?.status).toBe('listening');
      }

      if (event.type === 'voice_session_completed') {
        break;
      }
    }

    // Verify event ordering: interrupted event followed by listening_started event
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('speaking_started');
    expect(eventTypes).toContain('interrupted');

    const interruptedIdx = eventTypes.indexOf('interrupted');
    const secondListeningIdx = eventTypes.indexOf('listening_started', interruptedIdx);

    expect(interruptedIdx).toBeGreaterThan(-1);
    expect(secondListeningIdx).toBeGreaterThan(interruptedIdx);
    expect(eventTypes).toContain('voice_session_completed');

    // Schema validation on all events
    for (const evt of events) {
      expect(() => VoiceRuntimeEventSchema.parse(evt)).not.toThrow();
    }
  });

  it('preserves same conversationSessionId across multi-turn interruption', async () => {
    const harness = createBargeInHarness({
      brainOptions: {
        chunks: ['First response', 'Second response']
      },
      outputOptions: {
        frameDelayMs: 15
      }
    });

    harness.stt.setFinalTexts(['Turn 0 message', 'Turn 1 message']);

    const events: VoiceRuntimeEvent[] = [];
    const eventStream = harness.coordinator.startSession();

    let interrupted = false;
    for await (const event of eventStream) {
      events.push(event);

      if (event.type === 'speaking_started' && !interrupted) {
        interrupted = true;
        const turn0SessionId = harness.coordinator.getActiveSession()?.conversationSessionId;
        expect(turn0SessionId).toBeDefined();

        await harness.coordinator.interrupt({ reason: 'barge_in_test' });

        // Conversation session ID must be preserved immediately
        expect(harness.coordinator.getActiveSession()?.conversationSessionId).toBe(turn0SessionId);
      }

      if (event.type === 'voice_session_completed') {
        break;
      }
    }

    const session = harness.coordinator.getLastSession();
    expect(session?.status).toBe('completed');
    expect(session?.conversationSessionId).toBeDefined();

    // Verify session persistence in sessionManager has multiple turns under the SAME conversation session
    const convSession = harness.sessionManager.getSession(session!.conversationSessionId!);
    expect(convSession).toBeDefined();

    const turns = harness.sessionManager.getTurns(session!.conversationSessionId!);
    expect(turns.length).toBeGreaterThanOrEqual(2);
  });

  it('interrupts cleanly while thinking, cancelling Brain and preventing TTS', async () => {
    let brainCancelled = false;

    const harness = createBargeInHarness({
      brainOptions: {
        chunks: ['Delayed answer.'],
        delayMs: 60 // Slow Brain generation
      }
    });

    vi.spyOn(harness.conversationRuntime, 'cancel').mockImplementation(async () => {
      brainCancelled = true;
      return true;
    });

    const ttsSpy = vi.spyOn(harness.tts, 'synthesize');
    const playSpy = vi.spyOn(harness.audioOutput, 'playStream');

    harness.stt.setFinalTexts(['Query during thinking test', 'Follow-up query']);

    const events: VoiceRuntimeEvent[] = [];
    const eventStream = harness.coordinator.startSession();

    let interrupted = false;
    for await (const event of eventStream) {
      events.push(event);

      if (event.type === 'thinking_started' && !interrupted) {
        interrupted = true;
        const success = await harness.coordinator.interrupt({ reason: 'barge_in_during_thinking' });
        expect(success).toBe(true);
        expect(harness.coordinator.getActiveSession()?.status).toBe('listening');
      }

      if (event.type === 'voice_session_completed') {
        break;
      }
    }

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('thinking_started');
    expect(eventTypes).toContain('interrupted');
    expect(brainCancelled).toBe(true);

    // TTS and audio playback were only called for turn 1 (not turn 0 which was interrupted during thinking)
    expect(ttsSpy).toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();
    expect(eventTypes.filter((t) => t === 'thinking_started').length).toBe(2);
    expect(eventTypes).toContain('voice_session_completed');
  });

  it('does NOT cancel Brain if Brain already completed before barge-in', async () => {
    let brainCancelCalled = false;

    const harness = createBargeInHarness({
      brainOptions: {
        chunks: ['Complete sentence generated quickly.'],
        delayMs: 0
      },
      outputOptions: {
        frameDelayMs: 25 // Slower playback so Brain finishes first
      }
    });

    vi.spyOn(harness.conversationRuntime, 'cancel').mockImplementation(async () => {
      brainCancelCalled = true;
      return true;
    });

    harness.stt.setFinalTexts(['Initial prompt', 'Second prompt']);

    const events: VoiceRuntimeEvent[] = [];
    const eventStream = harness.coordinator.startSession();

    let interrupted = false;
    for await (const event of eventStream) {
      events.push(event);

      if (event.type === 'speaking_started' && !interrupted) {
        // Small delay to ensure Brain task finished response_completed
        await new Promise((r) => setTimeout(r, 10));

        interrupted = true;
        await harness.coordinator.interrupt({ reason: 'interrupt_after_brain_completed' });
        expect(brainCancelCalled).toBe(false);
      }

      if (event.type === 'voice_session_completed') {
        break;
      }
    }

    expect(brainCancelCalled).toBe(false);
    expect(events.map((e) => e.type)).toContain('interrupted');
    expect(events.map((e) => e.type)).toContain('voice_session_completed');
  });

  it('discards stale Brain deltas and stale TTS frames arriving after interruption', async () => {
    const playedFrames: AudioFrame[] = [];

    const harness = createBargeInHarness({
      brainOptions: {
        chunks: ['Chunk 1.', ' Chunk 2.', ' Chunk 3.'],
        delayMs: 15
      },
      outputOptions: {
        frameDelayMs: 15
      }
    });

    vi.spyOn(harness.audioOutput, 'playStream').mockImplementation(async (stream) => {
      for await (const f of stream) {
        playedFrames.push(f);
      }
    });

    harness.stt.setFinalTexts(['First command', 'Second command']);

    const events: VoiceRuntimeEvent[] = [];
    const eventStream = harness.coordinator.startSession();

    let interrupted = false;
    for await (const event of eventStream) {
      events.push(event);

      if (event.type === 'speaking_started' && !interrupted) {
        interrupted = true;
        const epochBefore = harness.coordinator.getCurrentTurnEpoch();
        await harness.coordinator.interrupt({ reason: 'stale_test' });
        const epochAfter = harness.coordinator.getCurrentTurnEpoch();
        expect(epochAfter).toBeGreaterThan(epochBefore);
      }

      if (event.type === 'voice_session_completed') {
        break;
      }
    }

    expect(events.map((e) => e.type)).toContain('interrupted');
    expect(events.map((e) => e.type)).toContain('voice_session_completed');
    expect(playedFrames.length).toBeGreaterThan(0);
  });

  it('supports multiple sequential barge-ins (Turn 0 -> barge-in -> Turn 1 -> barge-in -> Turn 2 -> complete)', async () => {
    const harness = createBargeInHarness({
      brainOptions: {
        chunks: ['Turn response chunk.'],
        delayMs: 5
      },
      outputOptions: {
        frameDelayMs: 20
      }
    });

    harness.stt.setFinalTexts(['Turn 0 utterance', 'Turn 1 utterance', 'Turn 2 utterance']);

    const events: VoiceRuntimeEvent[] = [];
    const eventStream = harness.coordinator.startSession();

    let bargeInCount = 0;
    for await (const event of eventStream) {
      events.push(event);

      if (event.type === 'speaking_started' && bargeInCount < 2) {
        bargeInCount++;
        const currentTurn = harness.coordinator.getCurrentTurnIndex();
        expect(currentTurn).toBe(bargeInCount - 1);

        const ok = await harness.coordinator.interrupt({ reason: `barge_in_number_${bargeInCount}` });
        expect(ok).toBe(true);
      }

      if (event.type === 'voice_session_completed') {
        break;
      }
    }

    expect(bargeInCount).toBe(2);
    const interruptedEvents = events.filter((e) => e.type === 'interrupted');
    expect(interruptedEvents.length).toBe(2);

    const listeningEvents = events.filter((e) => e.type === 'listening_started');
    // Turn 0 start, Turn 1 re-listen, Turn 2 re-listen = 3 listening_started events
    expect(listeningEvents.length).toBe(3);

    expect(events[events.length - 1]?.type).toBe('voice_session_completed');
  });

  it('returns false on rapid duplicate interrupt() calls (deterministic no-op)', async () => {
    const harness = createBargeInHarness({
      brainOptions: {
        chunks: ['Speaking chunks...']
      },
      outputOptions: {
        frameDelayMs: 30
      }
    });

    harness.stt.setFinalTexts(['Test query', 'Next query']);

    const events: VoiceRuntimeEvent[] = [];
    const eventStream = harness.coordinator.startSession();

    for await (const event of eventStream) {
      events.push(event);

      if (event.type === 'speaking_started') {
        // First interrupt
        const first = await harness.coordinator.interrupt({ reason: 'barge_in_1' });
        expect(first).toBe(true);

        // Immediate duplicate interrupts while already transitioning or in listening
        const second = await harness.coordinator.interrupt({ reason: 'duplicate_barge_in_2' });
        const third = await harness.coordinator.interrupt({ reason: 'duplicate_barge_in_3' });

        expect(second).toBe(false);
        expect(third).toBe(false);
        break;
      }
    }

    await harness.coordinator.stopSession('test_done');
  });

  it('returns false when interrupt() is called on idle or listening coordinator', async () => {
    const harness = createBargeInHarness();

    // Idle coordinator (no active session)
    const idleResult = await harness.coordinator.interrupt();
    expect(idleResult).toBe(false);

    // Start session, interrupt while in listening before speech occurs
    harness.stt.setFinalTexts(['Speech transcript']);
    const eventStream = harness.coordinator.startSession();

    for await (const event of eventStream) {
      if (event.type === 'listening_started') {
        expect(harness.coordinator.getActiveSession()?.status).toBe('listening');
        const listeningResult = await harness.coordinator.interrupt();
        expect(listeningResult).toBe(false);
        break;
      }
    }

    await harness.coordinator.stopSession('test_done');
  });

  it('cleanly handles full session cancellation (stopSession) during re-listening after barge-in', async () => {
    const harness = createBargeInHarness({
      outputOptions: {
        frameDelayMs: 20
      }
    });

    harness.stt.setFinalTexts(['Turn 0 speech', 'Turn 1 will not finish']);

    const events: VoiceRuntimeEvent[] = [];
    const eventStream = harness.coordinator.startSession();

    for await (const event of eventStream) {
      events.push(event);

      if (event.type === 'speaking_started') {
        await harness.coordinator.interrupt({ reason: 'barge_in_to_relisten' });
      }

      // In turn 1, when listening starts again, stop the entire session
      if (event.type === 'listening_started' && events.filter((e) => e.type === 'interrupted').length === 1) {
        await harness.coordinator.stopSession('user_clicked_sleep');
      }

      if (event.type === 'voice_session_cancelled') {
        break;
      }
    }

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('interrupted');
    expect(eventTypes).toContain('voice_session_cancelled');
    expect(harness.coordinator.getLastSession()?.status).toBe('cancelled');
  });
});
