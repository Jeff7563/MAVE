import type {
  VoiceDiagnosticState,
  VoiceRuntimeEvent,
  VoiceStatusSnapshot,
  SurfacePresentationIntent
} from '@mave/contracts';

/**
 * Maps a macro VoiceDiagnosticState into a SurfacePresentationIntent.
 */
export function voiceStateToSurfaceIntent(
  state: VoiceDiagnosticState,
  options: {
    sessionId?: string;
    inputLevel?: number;
    outputLevel?: number;
    transcript?: { text: string; isFinal: boolean; confidence?: number; language?: string };
    assistantText?: string;
    isSpeakingFinished?: boolean;
    errorCode?: string;
    errorMessage?: string;
    timestamp?: number;
  } = {}
): SurfacePresentationIntent {
  return {
    type: 'voice_activity',
    voiceState: state,
    inputLevel: options.inputLevel,
    outputLevel: options.outputLevel,
    transcript: options.transcript,
    assistantText: options.assistantText,
    isSpeakingFinished: options.isSpeakingFinished,
    error:
      options.errorCode && options.errorMessage
        ? {
            code: options.errorCode,
            message: options.errorMessage,
            severity: 'error',
            recoverable: true
          }
        : undefined,
    sessionId: options.sessionId,
    timestamp: options.timestamp
  };
}

/**
 * Maps a serializable VoiceRuntimeEvent into a SurfacePresentationIntent.
 */
export function voiceEventToSurfaceIntent(
  event: VoiceRuntimeEvent
): SurfacePresentationIntent {
  switch (event.type) {
    case 'voice_session_started':
      return {
        type: 'voice_activity',
        voiceState: 'waking',
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };

    case 'listening_started':
    case 'speech_started':
      return {
        type: 'voice_activity',
        voiceState: 'listening',
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };

    case 'partial_transcript':
      return {
        type: 'voice_activity',
        voiceState: 'listening',
        transcript: {
          text: event.text,
          isFinal: false,
          confidence: event.confidence
        },
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };

    case 'final_transcript':
      return {
        type: 'voice_activity',
        voiceState: 'listening',
        transcript: {
          text: event.text,
          isFinal: true,
          confidence: event.confidence,
          language: event.language
        },
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };

    case 'thinking_started':
      return {
        type: 'voice_activity',
        voiceState: 'thinking',
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };

    case 'speaking_started':
      return {
        type: 'voice_activity',
        voiceState: 'speaking',
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };

    case 'assistant_chunk':
      return {
        type: 'voice_activity',
        voiceState: 'speaking',
        assistantText: event.text,
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };

    case 'speaking_finished':
      return {
        type: 'voice_activity',
        voiceState: 'speaking',
        outputLevel: 0,
        isSpeakingFinished: true,
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };

    case 'interrupted':
      return {
        type: 'voice_activity',
        voiceState: 'interrupted',
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };

    case 'audio_level':
      return {
        type: 'voice_activity',
        inputLevel: event.inputLevel,
        outputLevel: event.outputLevel,
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };

    case 'voice_session_completed':
    case 'voice_session_cancelled':
      return {
        type: 'voice_activity',
        voiceState: 'sleeping',
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };

    case 'voice_session_failed':
      return {
        type: 'voice_activity',
        voiceState: 'error',
        error: {
          code: event.errorCode,
          message: event.errorMessage,
          severity: 'error',
          recoverable: true
        },
        sessionId: event.sessionId,
        timestamp: event.timestamp
      };
  }
}

/**
 * Maps a VoiceStatusSnapshot (IPC initial hydration or poll) into a SurfacePresentationIntent.
 */
export function voiceStatusSnapshotToSurfaceIntent(
  status: VoiceStatusSnapshot
): SurfacePresentationIntent {
  return {
    type: 'voice_activity',
    voiceState: status.state,
    inputLevel: status.inputLevel,
    outputLevel: status.outputLevel,
    transcript: status.lastTranscript,
    assistantText: status.assistantText,
    error: status.lastError
      ? {
          code: status.lastError.code,
          message: status.lastError.message,
          severity: 'error',
          recoverable: true
        }
      : undefined,
    sessionId: status.sessionId
  };
}

