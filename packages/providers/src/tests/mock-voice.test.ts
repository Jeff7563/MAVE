import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUDIO_FORMAT,
  DEFAULT_AUDIO_FRAME_BYTES,
  validateAudioFrame,
  type AudioFrame,
  type AudioLevel,
  type SpeechRequest,
  type STTRequestOptions
} from '@mave/contracts';
import {
  MockAudioInputProvider,
  MockAudioOutput,
  createSilentAudioFrame,
  createPCMFixtureFrames
} from '../audio/index.js';
import { MockSTTProvider } from '../stt/index.js';
import { MockTTSProvider } from '../tts/index.js';

describe('1. MockAudioInputProvider', () => {
  it('has stable provider ID and defaults', () => {
    const input = new MockAudioInputProvider();
    expect(input.id).toBe('mock-audio-input');
  });

  it('lists deterministic fake devices', async () => {
    const input = new MockAudioInputProvider();
    const devices = await input.listDevices();

    expect(devices).toHaveLength(1);
    expect(devices[0]?.id).toBe('mock-default-input');
    expect(devices[0]?.label).toBe('Mock Microphone');
    expect(devices[0]?.isDefault).toBe(true);
  });

  it('captures configured frames in exact sequence and format', async () => {
    const fixtureFrames = createPCMFixtureFrames(3);
    const input = new MockAudioInputProvider({ frames: fixtureFrames });

    const captured: AudioFrame[] = [];
    for await (const frame of input.capture()) {
      captured.push(frame);
    }

    expect(captured).toHaveLength(3);
    expect(captured[0]?.sequence).toBe(0);
    expect(captured[1]?.sequence).toBe(1);
    expect(captured[2]?.sequence).toBe(2);

    expect(captured[0]?.data.byteLength).toBe(DEFAULT_AUDIO_FRAME_BYTES);
    expect(captured[0]?.format).toEqual(DEFAULT_AUDIO_FORMAT);
    for (const frame of captured) {
      expect(() => validateAudioFrame(frame)).not.toThrow();
    }
  });

  it('respects configurable frame delay', async () => {
    const frames = createPCMFixtureFrames(2);
    const input = new MockAudioInputProvider({ frames, frameDelayMs: 20 });

    const start = Date.now();
    const captured: AudioFrame[] = [];
    for await (const frame of input.capture()) {
      captured.push(frame);
    }
    const elapsed = Date.now() - start;

    expect(captured).toHaveLength(2);
    expect(elapsed).toBeGreaterThanOrEqual(30);
  });

  it('stops capture promptly when AbortSignal fires with zero post-abort frames', async () => {
    const frames = createPCMFixtureFrames(5);
    const input = new MockAudioInputProvider({ frames, frameDelayMs: 15 });
    const controller = new AbortController();

    const captured: AudioFrame[] = [];
    const capturePromise = (async () => {
      for await (const frame of input.capture({ signal: controller.signal })) {
        captured.push(frame);
        if (captured.length === 2) {
          controller.abort();
        }
      }
    })();

    await capturePromise;
    expect(captured).toHaveLength(2);
  });

  it('handles pre-aborted signal with zero frames emitted', async () => {
    const input = new MockAudioInputProvider();
    const controller = new AbortController();
    controller.abort();

    const captured: AudioFrame[] = [];
    for await (const frame of input.capture({ signal: controller.signal })) {
      captured.push(frame);
    }
    expect(captured).toHaveLength(0);
  });

  it('supports final short frames', async () => {
    const frames = createPCMFixtureFrames(2, { finalShortSamples: 640 });
    const input = new MockAudioInputProvider({ frames });

    const captured: AudioFrame[] = [];
    for await (const frame of input.capture()) {
      captured.push(frame);
    }

    expect(captured).toHaveLength(2);
    expect(captured[1]?.data.byteLength).toBe(1280);
    expect(captured[1]?.isFinalChunk).toBe(true);
    expect(() => validateAudioFrame(captured[1])).not.toThrow();
  });

  it('preserves immutability when caller mutates fixture or yielded frames', async () => {
    const originalFrame = createSilentAudioFrame({ sequence: 0 });
    const input = new MockAudioInputProvider({ frames: [originalFrame] });

    // Mutate original source array
    originalFrame.data[0] = 99;

    const captured1: AudioFrame[] = [];
    for await (const frame of input.capture()) {
      captured1.push(frame);
      // Mutate yielded data
      frame.data[1] = 88;
    }

    expect(captured1[0]?.data[0]).toBe(0); // Protected from originalFrame mutation

    // Second capture session must remain pristine
    const captured2: AudioFrame[] = [];
    for await (const frame of input.capture()) {
      captured2.push(frame);
    }

    expect(captured2[0]?.data[1]).toBe(0); // Protected from captured1 mutation
  });

  it('reports health status and handles dispose', async () => {
    const input = new MockAudioInputProvider({ healthStatus: 'healthy' });
    const health = await input.health();
    expect(health.status).toBe('healthy');

    await input.dispose();
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of input.capture()) {
        // should throw
      }
    }).rejects.toThrow(/disposed/);
  });
});

describe('2. MockSTTProvider', () => {
  it('has stable provider ID, capabilities, and healthy status', async () => {
    const stt = new MockSTTProvider();
    expect(stt.id).toBe('mock-stt');
    expect(stt.getCapabilities().streaming).toBe(true);
    expect(stt.getCapabilities().partialTranscripts).toBe(true);

    const health = await stt.health();
    expect(health.status).toBe('healthy');
  });

  it('actively consumes audio frames and emits default transcript sequence', async () => {
    const stt = new MockSTTProvider();
    const frames = createPCMFixtureFrames(3);

    async function* audioStream() {
      for (const frame of frames) {
        yield frame;
      }
    }

    const options: STTRequestOptions = {
      requestId: 'stt-req-1',
      languageHint: 'en'
    };

    const events = [];
    for await (const event of stt.transcribe(audioStream(), options)) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events[0]?.type).toBe('started');
    expect(events[1]?.type).toBe('speech_started');
    expect(events[2]?.type).toBe('partial_transcript');
    expect(events[events.length - 2]?.type).toBe('final_transcript');
    expect(events[events.length - 1]?.type).toBe('speech_ended');

    const finalEvent = events[events.length - 2];
    if (finalEvent?.type === 'final_transcript') {
      expect(finalEvent.text).toBe('Hello MAVE');
      expect(finalEvent.confidence).toBe(0.95);
      expect(finalEvent.language).toBe('en');
    }

    // Diagnostics verify frames were actively ingested
    const diag = stt.getDiagnostics();
    expect(diag.totalFramesConsumed).toBe(3);
    expect(diag.totalBytesConsumed).toBe(3 * DEFAULT_AUDIO_FRAME_BYTES);
  });

  it('supports custom partials, final text, and language hints', async () => {
    const stt = new MockSTTProvider({
      partials: ['สวัสดี', 'สวัสดี MAVE'],
      finalText: 'สวัสดี MAVE สบายดีไหม',
      language: 'th',
      confidence: 0.99
    });

    const frames = createPCMFixtureFrames(2);
    async function* audioStream() {
      for (const f of frames) yield f;
    }

    const events = [];
    for await (const event of stt.transcribe(audioStream(), { requestId: 'th-1', languageHint: 'th-TH' })) {
      events.push(event);
    }

    const partials = events.filter((e) => e.type === 'partial_transcript');
    expect(partials).toHaveLength(2);
    if (partials[0]?.type === 'partial_transcript') expect(partials[0].text).toBe('สวัสดี');
    if (partials[1]?.type === 'partial_transcript') expect(partials[1].text).toBe('สวัสดี MAVE');

    const final = events.find((e) => e.type === 'final_transcript');
    if (final?.type === 'final_transcript') {
      expect(final.text).toBe('สวัสดี MAVE สบายดีไหม');
      expect(final.language).toBe('th');
      expect(final.confidence).toBe(0.99);
    }
  });

  it('handles simulated failure modes (error_event and throw)', async () => {
    const errorSTT = new MockSTTProvider({
      failureMode: 'error_event',
      errorCode: 'stt_unavailable',
      errorMessage: 'Local speech model crashed'
    });

    const frames = createPCMFixtureFrames(1);
    async function* audioStream() {
      for (const f of frames) yield f;
    }

    const events = [];
    for await (const event of errorSTT.transcribe(audioStream(), { requestId: 'err-1' })) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('error');
    if (events[0]?.type === 'error') {
      expect(events[0].error.code).toBe('stt_unavailable');
      expect(events[0].error.message).toBe('Local speech model crashed');
    }

    const throwSTT = new MockSTTProvider({
      failureMode: 'throw',
      errorMessage: 'Hard runtime exception'
    });

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of throwSTT.transcribe(audioStream(), { requestId: 'thr-1' })) {
        // should throw
      }
    }).rejects.toThrow(/Hard runtime exception/);
  });

  it('handles pre-aborted signal cleanly with cancelled event', async () => {
    const stt = new MockSTTProvider();
    const controller = new AbortController();
    controller.abort();

    const frames = createPCMFixtureFrames(2);
    async function* audioStream() {
      for (const f of frames) yield f;
    }

    const events = [];
    for await (const event of stt.transcribe(audioStream(), { requestId: 'pre-1', signal: controller.signal })) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('cancelled');
  });

  it('cancels mid-stream via cancel(requestId) with isolated request tracking', async () => {
    const stt = new MockSTTProvider({ delayMs: 20 });
    const frames = createPCMFixtureFrames(5);

    async function* audioStream() {
      for (const f of frames) yield f;
    }

    const reqAEvents: string[] = [];
    const promiseA = (async () => {
      for await (const event of stt.transcribe(audioStream(), { requestId: 'req-A' })) {
        reqAEvents.push(event.type);
        if (event.type === 'speech_started') {
          await stt.cancel('req-A');
        }
      }
    })();

    const reqBEvents: string[] = [];
    const promiseB = (async () => {
      for await (const event of stt.transcribe(audioStream(), { requestId: 'req-B' })) {
        reqBEvents.push(event.type);
      }
    })();

    await Promise.all([promiseA, promiseB]);

    // Request A was cancelled
    expect(reqAEvents).toContain('cancelled');
    expect(reqAEvents).not.toContain('final_transcript');

    // Request B finished uninterrupted
    expect(reqBEvents).toContain('final_transcript');
    expect(reqBEvents).toContain('speech_ended');
  });
});

describe('3. MockTTSProvider', () => {
  it('has stable provider ID, capabilities, and healthy status', async () => {
    const tts = new MockTTSProvider();
    expect(tts.id).toBe('mock-tts');
    expect(tts.getCapabilities().streaming).toBe(true);

    const health = await tts.health();
    expect(health.status).toBe('healthy');
  });

  it('synthesizes text deterministically with canonical AudioFrames', async () => {
    const tts = new MockTTSProvider();
    const req: SpeechRequest = {
      requestId: 'speech-1',
      text: 'Hello MAVE, how are you doing today?'
    };

    const events = [];
    for await (const event of tts.synthesize(req)) {
      events.push(event);
    }

    expect(events[0]?.type).toBe('started');
    expect(events[events.length - 1]?.type).toBe('completed');

    const audioEvents = events.filter((e) => e.type === 'audio');
    expect(audioEvents.length).toBeGreaterThanOrEqual(1);

    // Verify monotonic sequence and frame validity
    let seq = 0;
    for (const ae of audioEvents) {
      if (ae.type === 'audio') {
        expect(ae.frame.sequence).toBe(seq);
        expect(ae.frame.format).toEqual(DEFAULT_AUDIO_FORMAT);
        expect(ae.frame.data.byteLength).toBe(DEFAULT_AUDIO_FRAME_BYTES);
        expect(() => validateAudioFrame(ae.frame)).not.toThrow();
        seq++;
      }
    }

    const completed = events[events.length - 1];
    if (completed?.type === 'completed') {
      expect(completed.durationMs).toBe(audioEvents.length * 80);
    }
  });

  it('guarantees identical input produces identical frame counts and duration', async () => {
    const tts = new MockTTSProvider();
    const req: SpeechRequest = {
      requestId: 'r1',
      text: 'Deterministic voice synthesis verification'
    };

    const run1 = [];
    for await (const ev of tts.synthesize(req)) run1.push(ev);

    const run2 = [];
    for await (const ev of tts.synthesize({ ...req, requestId: 'r2' })) run2.push(ev);

    expect(run1.length).toBe(run2.length);
  });

  it('handles simulated failures (error_event and throw)', async () => {
    const errorTTS = new MockTTSProvider({
      failureMode: 'error_event',
      errorCode: 'tts_unavailable',
      errorMessage: 'Audio synthesizer engine down'
    });

    const events = [];
    for await (const ev of errorTTS.synthesize({ requestId: 'r-err', text: 'Hello' })) {
      events.push(ev);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('error');
    if (events[0]?.type === 'error') {
      expect(events[0].error.code).toBe('tts_unavailable');
    }

    const throwTTS = new MockTTSProvider({
      failureMode: 'throw',
      errorMessage: 'Fatal TTS exception'
    });

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of throwTTS.synthesize({ requestId: 'r-thr', text: 'Hello' })) {
        // should throw
      }
    }).rejects.toThrow(/Fatal TTS exception/);
  });

  it('cancels synthesis promptly via cancel(requestId) without leaking frames', async () => {
    const tts = new MockTTSProvider({ delayMs: 25, fixedFrameCount: 5 });

    const events: string[] = [];
    for await (const ev of tts.synthesize({ requestId: 'tts-cancel-1', text: 'Testing cancellation' })) {
      events.push(ev.type);
      if (ev.type === 'audio') {
        await tts.cancel('tts-cancel-1');
      }
    }

    expect(events).toContain('cancelled');
    expect(events).not.toContain('completed');
  });

  it('handles pre-aborted signal cleanly', async () => {
    const tts = new MockTTSProvider();
    const controller = new AbortController();
    controller.abort();

    const events = [];
    for await (const ev of tts.synthesize({ requestId: 'tts-pre', text: 'Hello' }, { signal: controller.signal })) {
      events.push(ev);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('cancelled');
  });
});

describe('4. MockAudioOutput', () => {
  it('has stable ID and initial idle state', () => {
    const output = new MockAudioOutput();
    expect(output.id).toBe('mock-audio-output');
    expect(output.getPlaybackState()).toBe('idle');
  });

  it('plays stream and tracks played frames and bytes', async () => {
    const output = new MockAudioOutput();
    const frames = createPCMFixtureFrames(4);

    async function* audioStream() {
      for (const f of frames) yield f;
    }

    await output.playStream(audioStream());

    expect(output.getPlaybackState()).toBe('idle');
    expect(output.getPlayedFrameCount()).toBe(4);
    expect(output.getPlayedBytes()).toBe(4 * DEFAULT_AUDIO_FRAME_BYTES);
    expect(output.getSimulatedDurationMs()).toBe(4 * 80);
  });

  it('supports volume configuration and boundary validation', async () => {
    const output = new MockAudioOutput();
    expect(output.getVolume()).toBe(1.0);

    await output.setVolume(0.5);
    expect(output.getVolume()).toBe(0.5);

    await expect(output.setVolume(-0.1)).rejects.toThrow(RangeError);
    await expect(output.setVolume(1.1)).rejects.toThrow(RangeError);
  });

  it('emits deterministic audio level telemetry and respects unsubscribe', async () => {
    const output = new MockAudioOutput({ mockLevels: [0.3, 0.7] });
    const frames = createPCMFixtureFrames(2);

    async function* audioStream() {
      for (const f of frames) yield f;
    }

    const levels: AudioLevel[] = [];
    const unsubscribe = output.onLevel((level) => {
      levels.push(level);
    });

    await output.playStream(audioStream());

    expect(levels).toHaveLength(2);
    expect(levels[0]?.rms).toBe(0.3);
    expect(levels[1]?.rms).toBe(0.7);

    // Unsubscribe verification
    unsubscribe();
    await output.playStream(audioStream());
    expect(levels).toHaveLength(2); // No new events after unsubscribe
  });

  it('supports stop() and transitions to stopped state immediately', async () => {
    const output = new MockAudioOutput({ frameDelayMs: 20 });
    const frames = createPCMFixtureFrames(10);

    async function* audioStream() {
      for (const f of frames) yield f;
    }

    const playPromise = output.playStream(audioStream());
    await new Promise((r) => setTimeout(r, 30));
    await output.stop();
    await playPromise;

    expect(output.getPlaybackState()).toBe('stopped');
    expect(output.getPlayedFrameCount()).toBeLessThan(10);
  });

  it('supports pause() and resume() lifecycle', async () => {
    const output = new MockAudioOutput({ frameDelayMs: 15 });
    const frames = createPCMFixtureFrames(4);

    async function* audioStream() {
      for (const f of frames) yield f;
    }

    const playPromise = output.playStream(audioStream());
    await new Promise((r) => setTimeout(r, 10));

    await output.pause();
    expect(output.getPlaybackState()).toBe('paused');

    await output.resume();
    expect(output.getPlaybackState()).toBe('playing');

    await playPromise;
    expect(output.getPlaybackState()).toBe('idle');
  });
});

describe('5. Mini Provider Integration Tests', () => {
  it('integrates MockAudioInput -> MockSTT deterministically', async () => {
    const fixtureFrames = createPCMFixtureFrames(3);
    const audioInput = new MockAudioInputProvider({ frames: fixtureFrames });
    const stt = new MockSTTProvider({
      partials: ['Testing', 'Testing voice'],
      finalText: 'Testing voice loop integration',
      language: 'en'
    });

    const transcriptEvents = [];
    for await (const event of stt.transcribe(audioInput.capture(), { requestId: 'integ-stt-1' })) {
      transcriptEvents.push(event);
    }

    expect(transcriptEvents[0]?.type).toBe('started');
    expect(transcriptEvents[1]?.type).toBe('speech_started');

    const finalEvent = transcriptEvents.find((e) => e.type === 'final_transcript');
    expect(finalEvent).toBeDefined();
    if (finalEvent?.type === 'final_transcript') {
      expect(finalEvent.text).toBe('Testing voice loop integration');
      expect(finalEvent.language).toBe('en');
    }

    const lastEvent = transcriptEvents[transcriptEvents.length - 1];
    expect(lastEvent?.type).toBe('speech_ended');

    expect(stt.getDiagnostics().totalFramesConsumed).toBe(3);
  });

  it('integrates MockTTS -> MockAudioOutput deterministically', async () => {
    const tts = new MockTTSProvider({ fixedFrameCount: 3 });
    const output = new MockAudioOutput();

    const speechRequest: SpeechRequest = {
      requestId: 'integ-tts-1',
      text: 'Hello MAVE, please speak this test phrase.'
    };

    // Filter audio frames from speech event stream and feed directly into audio output
    async function* ttsAudioStream() {
      for await (const ev of tts.synthesize(speechRequest)) {
        if (ev.type === 'audio') {
          yield ev.frame;
        }
      }
    }

    await output.playStream(ttsAudioStream());

    expect(output.getPlayedFrameCount()).toBe(3);
    expect(output.getPlayedBytes()).toBe(3 * DEFAULT_AUDIO_FRAME_BYTES);
    expect(output.getSimulatedDurationMs()).toBe(240);
    expect(output.getPlaybackState()).toBe('idle');
  });
});
