import { describe, it, expect } from 'vitest';
import {
  voiceEventToSurfaceIntent,
  voiceStateToSurfaceIntent,
  voiceStatusSnapshotToSurfaceIntent
} from '../surface/voice-surface-adapter.js';
import type {
  VoiceRuntimeEvent,
  VoiceStatusSnapshot
} from '@mave/contracts';

describe('VoiceSurfaceAdapter', () => {
  describe('voiceStateToSurfaceIntent', () => {
    it('maps diagnostic state with levels and transcripts', () => {
      const intent = voiceStateToSurfaceIntent('speaking', {
        sessionId: 'sess-100',
        inputLevel: 0,
        outputLevel: 0.72,
        assistantText: 'I am speaking'
      });

      expect(intent).toEqual({
        type: 'voice_activity',
        voiceState: 'speaking',
        inputLevel: 0,
        outputLevel: 0.72,
        transcript: undefined,
        assistantText: 'I am speaking',
        error: undefined,
        sessionId: 'sess-100',
        timestamp: undefined
      });
    });
  });

  describe('voiceEventToSurfaceIntent', () => {
    it('maps voice_session_started to waking', () => {
      const event: VoiceRuntimeEvent = {
        type: 'voice_session_started',
        sessionId: 'sess-1',
        timestamp: 1000
      };
      const intent = voiceEventToSurfaceIntent(event);
      expect(intent).toEqual({
        type: 'voice_activity',
        voiceState: 'waking',
        sessionId: 'sess-1',
        timestamp: 1000
      });
    });

    it('maps listening_started and speech_started to listening', () => {
      const e1: VoiceRuntimeEvent = {
        type: 'listening_started',
        sessionId: 'sess-1',
        timestamp: 1001
      };
      expect(voiceEventToSurfaceIntent(e1)).toEqual({
        type: 'voice_activity',
        voiceState: 'listening',
        sessionId: 'sess-1',
        timestamp: 1001
      });

      const e2: VoiceRuntimeEvent = {
        type: 'speech_started',
        sessionId: 'sess-1',
        timestamp: 1002
      };
      expect(voiceEventToSurfaceIntent(e2)).toEqual({
        type: 'voice_activity',
        voiceState: 'listening',
        sessionId: 'sess-1',
        timestamp: 1002
      });
    });

    it('maps partial and final transcripts', () => {
      const partial: VoiceRuntimeEvent = {
        type: 'partial_transcript',
        sessionId: 'sess-1',
        text: 'Hello',
        confidence: 0.8,
        timestamp: 1003
      };
      expect(voiceEventToSurfaceIntent(partial)).toEqual({
        type: 'voice_activity',
        voiceState: 'listening',
        transcript: { text: 'Hello', isFinal: false, confidence: 0.8 },
        sessionId: 'sess-1',
        timestamp: 1003
      });

      const final: VoiceRuntimeEvent = {
        type: 'final_transcript',
        sessionId: 'sess-1',
        text: 'Hello world',
        confidence: 0.95,
        language: 'en',
        timestamp: 1004
      };
      expect(voiceEventToSurfaceIntent(final)).toEqual({
        type: 'voice_activity',
        voiceState: 'listening',
        transcript: { text: 'Hello world', isFinal: true, confidence: 0.95, language: 'en' },
        sessionId: 'sess-1',
        timestamp: 1004
      });
    });

    it('maps thinking_started and speaking_started', () => {
      const think: VoiceRuntimeEvent = {
        type: 'thinking_started',
        sessionId: 'sess-1',
        timestamp: 1005
      };
      expect(voiceEventToSurfaceIntent(think)).toEqual({
        type: 'voice_activity',
        voiceState: 'thinking',
        sessionId: 'sess-1',
        timestamp: 1005
      });

      const speak: VoiceRuntimeEvent = {
        type: 'speaking_started',
        sessionId: 'sess-1',
        timestamp: 1006
      };
      expect(voiceEventToSurfaceIntent(speak)).toEqual({
        type: 'voice_activity',
        voiceState: 'speaking',
        sessionId: 'sess-1',
        timestamp: 1006
      });
    });

    it('maps interrupted event directly to interrupted voiceState', () => {
      const interrupted: VoiceRuntimeEvent = {
        type: 'interrupted',
        sessionId: 'sess-1',
        reason: 'user_spoke_barge_in',
        timestamp: 1007
      };
      expect(voiceEventToSurfaceIntent(interrupted)).toEqual({
        type: 'voice_activity',
        voiceState: 'interrupted',
        sessionId: 'sess-1',
        timestamp: 1007
      });
    });

    it('maps audio_level with output > 0 to speaking and output 0 to listening', () => {
      const speakingLevel: VoiceRuntimeEvent = {
        type: 'audio_level',
        sessionId: 'sess-1',
        inputLevel: 0,
        outputLevel: 0.55,
        timestamp: 1008
      };
      expect(voiceEventToSurfaceIntent(speakingLevel)).toEqual({
        type: 'voice_activity',
        voiceState: 'speaking',
        inputLevel: 0,
        outputLevel: 0.55,
        sessionId: 'sess-1',
        timestamp: 1008
      });

      const listeningLevel: VoiceRuntimeEvent = {
        type: 'audio_level',
        sessionId: 'sess-1',
        inputLevel: 0.45,
        outputLevel: 0,
        timestamp: 1009
      };
      expect(voiceEventToSurfaceIntent(listeningLevel)).toEqual({
        type: 'voice_activity',
        voiceState: 'listening',
        inputLevel: 0.45,
        outputLevel: 0,
        sessionId: 'sess-1',
        timestamp: 1009
      });
    });

    it('maps failure to error with recoverable flag', () => {
      const fail: VoiceRuntimeEvent = {
        type: 'voice_session_failed',
        sessionId: 'sess-1',
        errorCode: 'STT_TIMEOUT',
        errorMessage: 'Transcription service timed out',
        timestamp: 1010
      };
      expect(voiceEventToSurfaceIntent(fail)).toEqual({
        type: 'voice_activity',
        voiceState: 'error',
        error: {
          code: 'STT_TIMEOUT',
          message: 'Transcription service timed out',
          severity: 'error',
          recoverable: true
        },
        sessionId: 'sess-1',
        timestamp: 1010
      });
    });
  });

  describe('voiceStatusSnapshotToSurfaceIntent', () => {
    it('maps full snapshot', () => {
      const snapshot: VoiceStatusSnapshot = {
        enabled: true,
        state: 'speaking',
        micOwnership: 'voice',
        sessionId: 'sess-xyz',
        inputLevel: 0,
        outputLevel: 0.88,
        wake: { provider: 'openwakeword', listening: false },
        audioInput: { provider: 'sounddevice' },
        stt: { provider: 'faster-whisper', status: 'idle' },
        tts: { provider: 'edge-tts', status: 'streaming' },
        output: { provider: 'sounddevice', state: 'playing' },
        assistantText: 'Currently speaking'
      };

      const intent = voiceStatusSnapshotToSurfaceIntent(snapshot);
      expect(intent).toEqual({
        type: 'voice_activity',
        voiceState: 'speaking',
        inputLevel: 0,
        outputLevel: 0.88,
        transcript: undefined,
        assistantText: 'Currently speaking',
        error: undefined,
        sessionId: 'sess-xyz'
      });
    });
  });
});
