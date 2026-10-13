import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUDIO_FORMAT,
  DEFAULT_AUDIO_FRAME_BYTES,
  DEFAULT_AUDIO_FRAME_DURATION_MS,
  DEFAULT_AUDIO_FRAME_SAMPLES,
  AudioFormatSchema,
  AudioFrameValidationError,
  expectedFrameBytes,
  frameDurationMs,
  validateAudioFrame,
  AudioInputDeviceSchema,
  AudioInputCapabilitiesSchema,
  AudioOutputDeviceSchema,
  AudioOutputCapabilitiesSchema,
  AudioOutputPlaybackStateSchema,
  AudioLevelSchema,
  type AudioFrame,
  type AudioInputProvider,
  type AudioOutput
} from '../audio.js';
import {
  STTCapabilitiesSchema,
  STTErrorCodeSchema,
  STTErrorSchema,
  STTRequestOptionsSchema,
  TranscriptEventSchema,
  TranscriptWordSchema,
  type STTProvider,
  type TranscriptEvent
} from '../stt.js';
import {
  TTSCapabilitiesSchema,
  TTSErrorCodeSchema,
  TTSErrorSchema,
  SpeechRequestSchema,
  TTSVoiceInfoSchema,
  type SpeechEvent,
  type TTSProvider
} from '../tts.js';
import {
  VoiceSessionSchema,
  VoiceSessionStatusSchema,
  VoiceRuntimeEventSchema,
  type VoiceRuntimeEvent
} from '../voice.js';

describe('Canonical Audio Format & Frame Contracts', () => {
  it('defines canonical audio format constants correctly', () => {
    expect(DEFAULT_AUDIO_FORMAT.encoding).toBe('pcm_s16le');
    expect(DEFAULT_AUDIO_FORMAT.sampleRate).toBe(16000);
    expect(DEFAULT_AUDIO_FORMAT.channels).toBe(1);
    expect(DEFAULT_AUDIO_FORMAT.bytesPerSample).toBe(2);

    expect(DEFAULT_AUDIO_FRAME_SAMPLES).toBe(1280);
    expect(DEFAULT_AUDIO_FRAME_DURATION_MS).toBe(80);
    expect(DEFAULT_AUDIO_FRAME_BYTES).toBe(2560);
  });

  it('validates AudioFormatSchema parsing', () => {
    const parsed = AudioFormatSchema.parse({});
    expect(parsed).toEqual(DEFAULT_AUDIO_FORMAT);
  });

  it('calculates expectedFrameBytes and frameDurationMs deterministically', () => {
    expect(expectedFrameBytes(DEFAULT_AUDIO_FORMAT, 1280)).toBe(2560);
    expect(expectedFrameBytes(DEFAULT_AUDIO_FORMAT, 1600)).toBe(3200);
    expect(frameDurationMs(DEFAULT_AUDIO_FORMAT, 1280)).toBe(80);
    expect(frameDurationMs(DEFAULT_AUDIO_FORMAT, 16000)).toBe(1000);
  });

  it('validates a correct standard AudioFrame', () => {
    const frame: AudioFrame = {
      sequence: 0,
      timestampMs: 0,
      format: DEFAULT_AUDIO_FORMAT,
      data: new Uint8Array(2560)
    };

    expect(() => validateAudioFrame(frame)).not.toThrow();
  });

  it('rejects an invalid sequence number', () => {
    const frame = {
      sequence: -1,
      timestampMs: 0,
      format: DEFAULT_AUDIO_FORMAT,
      data: new Uint8Array(2560)
    };

    expect(() => validateAudioFrame(frame)).toThrow(AudioFrameValidationError);
    expect(() => validateAudioFrame(frame)).toThrow(/Sequence must be a non-negative integer/);
  });

  it('rejects a fractional or non-finite timestamp', () => {
    const frame = {
      sequence: 0,
      timestampMs: NaN,
      format: DEFAULT_AUDIO_FORMAT,
      data: new Uint8Array(2560)
    };

    expect(() => validateAudioFrame(frame)).toThrow(AudioFrameValidationError);
    expect(() => validateAudioFrame(frame)).toThrow(/Timestamp must be a finite non-negative number/);
  });

  it('rejects empty payload data', () => {
    const frame = {
      sequence: 0,
      timestampMs: 100,
      format: DEFAULT_AUDIO_FORMAT,
      data: new Uint8Array(0)
    };

    expect(() => validateAudioFrame(frame)).toThrow(AudioFrameValidationError);
    expect(() => validateAudioFrame(frame)).toThrow(/Payload data cannot be empty/);
  });

  it('rejects misaligned payload byte length not divisible by sample size', () => {
    const frame = {
      sequence: 0,
      timestampMs: 100,
      format: DEFAULT_AUDIO_FORMAT,
      data: new Uint8Array(2559) // 2559 is not divisible by 2
    };

    expect(() => validateAudioFrame(frame)).toThrow(AudioFrameValidationError);
    expect(() => validateAudioFrame(frame)).toThrow(/multiple of sample frame size/);
  });

  it('rejects incorrect standard frame byte length for non-final frames', () => {
    const frame = {
      sequence: 1,
      timestampMs: 80,
      format: DEFAULT_AUDIO_FORMAT,
      data: new Uint8Array(1280) // 1280 is valid sample alignment but wrong standard frame size
    };

    expect(() => validateAudioFrame(frame)).toThrow(AudioFrameValidationError);
    expect(() => validateAudioFrame(frame)).toThrow(/does not match expected frame length/);
  });

  it('accepts short final frames when isFinalChunk is true', () => {
    const frame: AudioFrame = {
      sequence: 42,
      timestampMs: 3360,
      format: DEFAULT_AUDIO_FORMAT,
      data: new Uint8Array(640), // 320 samples = 20ms
      isFinalChunk: true
    };

    expect(() => validateAudioFrame(frame)).not.toThrow();
  });

  it('accepts short final frames when allowShortFinalFrame option is true', () => {
    const frame: AudioFrame = {
      sequence: 42,
      timestampMs: 3360,
      format: DEFAULT_AUDIO_FORMAT,
      data: new Uint8Array(1000)
    };

    expect(() => validateAudioFrame(frame, { allowShortFinalFrame: true })).not.toThrow();
  });

  it('rejects short final frames that exceed standard frame size', () => {
    const frame: AudioFrame = {
      sequence: 42,
      timestampMs: 3360,
      format: DEFAULT_AUDIO_FORMAT,
      data: new Uint8Array(3000),
      isFinalChunk: true
    };

    expect(() => validateAudioFrame(frame)).toThrow(AudioFrameValidationError);
    expect(() => validateAudioFrame(frame)).toThrow(/cannot exceed standard frame length/);
  });
});

describe('Audio Input & Output Device Contracts', () => {
  it('validates AudioInputDeviceSchema', () => {
    const dev = AudioInputDeviceSchema.parse({
      id: 'mic-front-01',
      label: 'USB Array Microphone',
      isDefault: true
    });
    expect(dev.id).toBe('mic-front-01');
    expect(dev.isDefault).toBe(true);
  });

  it('validates AudioInputCapabilitiesSchema', () => {
    const caps = AudioInputCapabilitiesSchema.parse({});
    expect(caps.supportedFormats).toHaveLength(1);
    expect(caps.supportedFormats[0]).toEqual(DEFAULT_AUDIO_FORMAT);
  });

  it('validates AudioOutputDeviceSchema, AudioOutputCapabilitiesSchema and playback states', () => {
    const dev = AudioOutputDeviceSchema.parse({
      id: 'speaker-01',
      label: 'Realtek Speakers'
    });
    expect(dev.isDefault).toBe(false);

    const outCaps = AudioOutputCapabilitiesSchema.parse({});
    expect(outCaps.supportedFormats[0]).toEqual(DEFAULT_AUDIO_FORMAT);

    expect(AudioOutputPlaybackStateSchema.parse('idle')).toBe('idle');
    expect(AudioOutputPlaybackStateSchema.parse('playing')).toBe('playing');
    expect(AudioOutputPlaybackStateSchema.parse('paused')).toBe('paused');
    expect(AudioOutputPlaybackStateSchema.parse('stopped')).toBe('stopped');
  });

  it('validates AudioLevelSchema normalized bounds [0.0, 1.0]', () => {
    expect(AudioLevelSchema.parse({ timestampMs: 1000, rms: 0.75 })).toEqual({
      timestampMs: 1000,
      rms: 0.75
    });

    expect(() => AudioLevelSchema.parse({ timestampMs: 1000, rms: -0.1 })).toThrow();
    expect(() => AudioLevelSchema.parse({ timestampMs: 1000, rms: 1.05 })).toThrow();
  });

  it('typechecks AudioInputProvider and AudioOutput interface contracts', () => {
    const dummyInput: AudioInputProvider = {
      id: 'mock-input',
      listDevices: async () => [],
      async *capture() {
        yield {
          sequence: 0,
          timestampMs: 0,
          format: DEFAULT_AUDIO_FORMAT,
          data: new Uint8Array(2560)
        };
      }
    };
    expect(dummyInput.id).toBe('mock-input');

    const dummyOutput: AudioOutput = {
      id: 'mock-output',
      listDevices: async () => [],
      playStream: async () => {},
      stop: async () => {},
      pause: async () => {},
      resume: async () => {},
      setVolume: async () => {},
      getPlaybackState: () => 'idle'
    };
    expect(dummyOutput.id).toBe('mock-output');
  });
});

describe('STT Provider & Transcript Event Contracts', () => {
  it('validates STTCapabilities defaults and custom capabilities', () => {
    const defaultCaps = STTCapabilitiesSchema.parse({});
    expect(defaultCaps.streaming).toBe(true);
    expect(defaultCaps.partialTranscripts).toBe(true);
    expect(defaultCaps.wordTimestamps).toBe(false);

    const custom = STTCapabilitiesSchema.parse({
      wordTimestamps: true,
      local: true
    });
    expect(custom.wordTimestamps).toBe(true);
    expect(custom.local).toBe(true);
  });

  it('validates STT request options with BCP-47 language hints', () => {
    const opt = STTRequestOptionsSchema.parse({
      requestId: 'stt-req-1',
      languageHint: 'th-TH',
      autoDetectLanguage: true
    });
    expect(opt.languageHint).toBe('th-TH');
    expect(opt.autoDetectLanguage).toBe(true);
  });

  it('validates TranscriptWordSchema for optional word timings', () => {
    const word = TranscriptWordSchema.parse({
      text: 'MAVE',
      startMs: 200,
      endMs: 500,
      confidence: 0.98
    });
    expect(word.text).toBe('MAVE');
    expect(word.startMs).toBe(200);
    expect(word.endMs).toBe(500);
  });

  it('validates all TranscriptEvent discriminated union variants', () => {
    const started: TranscriptEvent = TranscriptEventSchema.parse({
      type: 'started',
      requestId: 'req-1',
      timestamp: 100
    });
    expect(started.type).toBe('started');

    const speechStarted: TranscriptEvent = TranscriptEventSchema.parse({
      type: 'speech_started',
      requestId: 'req-1',
      timestamp: 250
    });
    expect(speechStarted.type).toBe('speech_started');

    const partial: TranscriptEvent = TranscriptEventSchema.parse({
      type: 'partial_transcript',
      requestId: 'req-1',
      text: 'Hello',
      confidence: 0.8,
      timestamp: 400
    });
    expect(partial.type).toBe('partial_transcript');

    const final: TranscriptEvent = TranscriptEventSchema.parse({
      type: 'final_transcript',
      requestId: 'req-1',
      text: 'Hello MAVE',
      confidence: 0.95,
      language: 'en',
      words: [{ text: 'Hello', startMs: 250, endMs: 500 }, { text: 'MAVE', startMs: 510, endMs: 800 }],
      timestamp: 850
    });
    expect(final.type).toBe('final_transcript');

    const speechEnded: TranscriptEvent = TranscriptEventSchema.parse({
      type: 'speech_ended',
      requestId: 'req-1',
      timestamp: 860
    });
    expect(speechEnded.type).toBe('speech_ended');

    const cancelled: TranscriptEvent = TranscriptEventSchema.parse({
      type: 'cancelled',
      requestId: 'req-1',
      reason: 'user_interrupt',
      timestamp: 900
    });
    expect(cancelled.type).toBe('cancelled');

    const errorEvent: TranscriptEvent = TranscriptEventSchema.parse({
      type: 'error',
      requestId: 'req-1',
      error: {
        code: 'stt_unavailable',
        message: 'Speech service connection refused',
        retryable: true
      },
      timestamp: 950
    });
    expect(errorEvent.type).toBe('error');
  });

  it('enforces partial vs final transcript policy distinctions', () => {
    // Partial transcript can have empty or partial text
    const partial = TranscriptEventSchema.parse({
      type: 'partial_transcript',
      requestId: 'r1',
      text: '',
      timestamp: 10
    });
    expect(partial.type).toBe('partial_transcript');

    // Final transcript text must not be empty
    expect(() =>
      TranscriptEventSchema.parse({
        type: 'final_transcript',
        requestId: 'r1',
        text: '',
        confidence: 0.9,
        timestamp: 20
      })
    ).toThrow();
  });

  it('validates normalized STT error codes', () => {
    expect(STTErrorCodeSchema.parse('stt_unavailable')).toBe('stt_unavailable');
    expect(STTErrorCodeSchema.parse('stt_unconfigured')).toBe('stt_unconfigured');
    expect(STTErrorCodeSchema.parse('stt_auth')).toBe('stt_auth');
    expect(STTErrorCodeSchema.parse('stt_limit')).toBe('stt_limit');
    expect(STTErrorCodeSchema.parse('stt_timeout')).toBe('stt_timeout');
    expect(STTErrorCodeSchema.parse('stt_invalid_audio')).toBe('stt_invalid_audio');
    expect(STTErrorCodeSchema.parse('stt_invalid_response')).toBe('stt_invalid_response');
    expect(STTErrorCodeSchema.parse('stt_runtime_error')).toBe('stt_runtime_error');
    expect(STTErrorCodeSchema.parse('cancelled')).toBe('cancelled');

    expect(() => STTErrorCodeSchema.parse('unknown_code')).toThrow();

    const err = STTErrorSchema.parse({
      code: 'stt_timeout',
      message: 'Recognition timed out',
      retryable: true
    });
    expect(err.code).toBe('stt_timeout');
  });

  it('typechecks STTProvider interface', () => {
    const dummySTT: STTProvider = {
      id: 'mock-stt',
      getCapabilities: () => STTCapabilitiesSchema.parse({}),
      health: async () => ({ status: 'healthy', checkedAt: Date.now() }),
      async *transcribe() {
        yield { type: 'started', requestId: 'r1', timestamp: 0 };
        yield { type: 'final_transcript', requestId: 'r1', text: 'ok', confidence: 1, timestamp: 10 };
      }
    };
    expect(dummySTT.id).toBe('mock-stt');
  });
});

describe('TTS Provider & Speech Event Contracts', () => {
  it('validates TTSCapabilities and VoiceInfo', () => {
    const caps = TTSCapabilitiesSchema.parse({
      languages: ['th', 'en'],
      speakingRate: true
    });
    expect(caps.languages).toContain('th');
    expect(caps.speakingRate).toBe(true);

    const voice = TTSVoiceInfoSchema.parse({
      id: 'th-female-1',
      name: 'Premwadee',
      language: 'th-TH',
      gender: 'female'
    });
    expect(voice.id).toBe('th-female-1');
  });

  it('validates SpeechRequest and rejects empty text', () => {
    const req = SpeechRequestSchema.parse({
      requestId: 'tts-1',
      text: 'Hello MAVE',
      rate: 1.1
    });
    expect(req.text).toBe('Hello MAVE');
    expect(req.rate).toBe(1.1);

    expect(() => SpeechRequestSchema.parse({ requestId: 'tts-1', text: '' })).toThrow();
    expect(() => SpeechRequestSchema.parse({ requestId: 'tts-1', text: '   ' })).toThrow();
    expect(() => SpeechRequestSchema.parse({ requestId: 'tts-1', text: 'ok', rate: 0.1 })).toThrow();
    expect(() => SpeechRequestSchema.parse({ requestId: 'tts-1', text: 'ok', rate: 3.0 })).toThrow();
  });

  it('validates normalized TTS error codes', () => {
    expect(TTSErrorCodeSchema.parse('tts_unavailable')).toBe('tts_unavailable');
    expect(TTSErrorCodeSchema.parse('tts_unconfigured')).toBe('tts_unconfigured');
    expect(TTSErrorCodeSchema.parse('tts_auth')).toBe('tts_auth');
    expect(TTSErrorCodeSchema.parse('tts_limit')).toBe('tts_limit');
    expect(TTSErrorCodeSchema.parse('tts_timeout')).toBe('tts_timeout');
    expect(TTSErrorCodeSchema.parse('tts_invalid_request')).toBe('tts_invalid_request');
    expect(TTSErrorCodeSchema.parse('tts_runtime_error')).toBe('tts_runtime_error');
    expect(TTSErrorCodeSchema.parse('cancelled')).toBe('cancelled');
    expect(() => TTSErrorCodeSchema.parse('unknown_code')).toThrow();

    const err = TTSErrorSchema.parse({
      code: 'tts_unavailable',
      message: 'Synthesis model not loaded',
      retryable: true
    });
    expect(err.code).toBe('tts_unavailable');
    expect(err.retryable).toBe(true);
  });

  it('typechecks SpeechEvents and distinguishes synthesis completed from playback', () => {
    const dummyFrame: AudioFrame = {
      sequence: 0,
      timestampMs: 0,
      format: DEFAULT_AUDIO_FORMAT,
      data: new Uint8Array(2560)
    };

    const events: SpeechEvent[] = [
      { type: 'started', requestId: 'r1', timestamp: 0 },
      { type: 'audio', requestId: 'r1', frame: dummyFrame, timestamp: 50 },
      { type: 'word_boundary', requestId: 'r1', word: 'Hello', startMs: 0, endMs: 50, timestamp: 50 },
      { type: 'completed', requestId: 'r1', durationMs: 50, timestamp: 55 }
    ];

    expect(events).toHaveLength(4);
    expect(events[1]?.type).toBe('audio');
    expect(events[3]?.type).toBe('completed');
  });

  it('typechecks TTSProvider interface', () => {
    const dummyTTS: TTSProvider = {
      id: 'mock-tts',
      getCapabilities: () => TTSCapabilitiesSchema.parse({}),
      health: async () => ({ status: 'healthy', checkedAt: Date.now() }),
      async *synthesize(request) {
        yield { type: 'started', requestId: request.requestId, timestamp: 0 };
        yield { type: 'completed', requestId: request.requestId, timestamp: 10 };
      }
    };
    expect(dummyTTS.id).toBe('mock-tts');
  });
});

describe('VoiceSession & Serializable Voice Runtime Events', () => {
  it('validates VoiceSession data model and statuses', () => {
    expect(VoiceSessionStatusSchema.parse('idle')).toBe('idle');
    expect(VoiceSessionStatusSchema.parse('listening')).toBe('listening');
    expect(VoiceSessionStatusSchema.parse('transcribing')).toBe('transcribing');
    expect(VoiceSessionStatusSchema.parse('thinking')).toBe('thinking');
    expect(VoiceSessionStatusSchema.parse('speaking')).toBe('speaking');
    expect(VoiceSessionStatusSchema.parse('interrupted')).toBe('interrupted');
    expect(VoiceSessionStatusSchema.parse('completed')).toBe('completed');
    expect(VoiceSessionStatusSchema.parse('cancelled')).toBe('cancelled');
    expect(VoiceSessionStatusSchema.parse('error')).toBe('error');
    expect(() => VoiceSessionStatusSchema.parse('unknown_status')).toThrow();

    const session = VoiceSessionSchema.parse({
      id: 'vs-1',
      conversationSessionId: 'cs-1',
      status: 'listening',
      createdAt: 1000,
      updatedAt: 1050,
      languageHint: 'th-TH',
      activeSTTProviderId: 'mock-stt',
      activeTTSProviderId: 'mock-tts'
    });
    expect(session.id).toBe('vs-1');
    expect(session.status).toBe('listening');
  });

  it('validates all 13 VoiceRuntimeEvent discriminated union variants', () => {
    const events: VoiceRuntimeEvent[] = [
      VoiceRuntimeEventSchema.parse({ type: 'voice_session_started', sessionId: 'vs-1', timestamp: 10 }),
      VoiceRuntimeEventSchema.parse({ type: 'listening_started', sessionId: 'vs-1', timestamp: 20 }),
      VoiceRuntimeEventSchema.parse({ type: 'speech_started', sessionId: 'vs-1', timestamp: 30 }),
      VoiceRuntimeEventSchema.parse({ type: 'partial_transcript', sessionId: 'vs-1', text: 'Hello', confidence: 0.9, timestamp: 40 }),
      VoiceRuntimeEventSchema.parse({ type: 'final_transcript', sessionId: 'vs-1', text: 'Hello MAVE', confidence: 0.95, language: 'en', timestamp: 50 }),
      VoiceRuntimeEventSchema.parse({ type: 'thinking_started', sessionId: 'vs-1', timestamp: 60 }),
      VoiceRuntimeEventSchema.parse({ type: 'speaking_started', sessionId: 'vs-1', requestId: 'r-1', timestamp: 70 }),
      VoiceRuntimeEventSchema.parse({ type: 'audio_level', sessionId: 'vs-1', inputLevel: 0.4, outputLevel: 0.8, timestamp: 80 }),
      VoiceRuntimeEventSchema.parse({ type: 'speaking_finished', sessionId: 'vs-1', requestId: 'r-1', timestamp: 90 }),
      VoiceRuntimeEventSchema.parse({ type: 'interrupted', sessionId: 'vs-1', reason: 'barge_in', timestamp: 95 }),
      VoiceRuntimeEventSchema.parse({ type: 'voice_session_completed', sessionId: 'vs-1', timestamp: 100 }),
      VoiceRuntimeEventSchema.parse({ type: 'voice_session_cancelled', sessionId: 'vs-1', reason: 'sleep', timestamp: 105 }),
      VoiceRuntimeEventSchema.parse({ type: 'voice_session_failed', sessionId: 'vs-1', errorCode: 'stt_error', errorMessage: 'Timeout', timestamp: 110 })
    ];

    expect(events).toHaveLength(13);
  });

  it('guarantees VoiceRuntimeEvents contain no binary data and are JSON serializable', () => {
    const event = VoiceRuntimeEventSchema.parse({
      type: 'audio_level',
      sessionId: 'vs-1',
      inputLevel: 0.35,
      outputLevel: 0.82,
      timestamp: Date.now()
    });

    const serialized = JSON.stringify(event);
    const parsed = JSON.parse(serialized);
    expect(parsed).toEqual(event);
    expect(parsed).not.toHaveProperty('data');
    expect(parsed).not.toHaveProperty('buffer');
  });

  it('validates that audio_level bounds [0.0, 1.0] are strictly enforced in runtime events', () => {
    expect(() =>
      VoiceRuntimeEventSchema.parse({
        type: 'audio_level',
        sessionId: 'vs-1',
        outputLevel: 1.5,
        timestamp: 100
      })
    ).toThrow();

    expect(() =>
      VoiceRuntimeEventSchema.parse({
        type: 'audio_level',
        sessionId: 'vs-1',
        inputLevel: -0.2,
        timestamp: 100
      })
    ).toThrow();
  });
});
