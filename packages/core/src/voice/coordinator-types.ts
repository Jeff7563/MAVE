import type {
  AudioInputProvider,
  AudioOutput,
  STTProvider,
  TTSProvider
} from '@mave/contracts';
import type { ConversationRuntime } from '../conversation/runtime.js';
import type { StreamingTextChunkerOptions } from './types.js';

export type VoiceCoordinatorErrorCode =
  | 'session_busy'
  | 'session_not_found'
  | 'audio_input_error'
  | 'stt_error'
  | 'no_speech_detected'
  | 'empty_transcript'
  | 'conversation_error'
  | 'tts_error'
  | 'audio_output_error'
  | 'voice_runtime_error'
  | 'cancelled';

export class VoiceCoordinatorError extends Error {
  readonly code: VoiceCoordinatorErrorCode;
  readonly sessionId?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: VoiceCoordinatorErrorCode,
    message: string,
    options?: { sessionId?: string; details?: Record<string, unknown>; cause?: unknown }
  ) {
    super(message);
    this.name = 'VoiceCoordinatorError';
    this.code = code;
    this.sessionId = options?.sessionId;
    this.details = options?.details;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

export interface VoiceSessionCoordinatorOptions {
  audioInput: AudioInputProvider;
  stt: STTProvider;
  tts: TTSProvider;
  audioOutput: AudioOutput;
  conversationRuntime: ConversationRuntime;
  voiceSessionIdFactory?: () => string;
  clock?: () => number;
  textChunkerOptions?: StreamingTextChunkerOptions;
}

export interface StartVoiceSessionOptions {
  conversationSessionId?: string;
  languageHint?: string;
  signal?: AbortSignal;
}

export interface VoiceInterruptOptions {
  reason?: string;
}
