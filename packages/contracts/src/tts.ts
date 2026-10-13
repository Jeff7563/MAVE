import { z } from 'zod';
import type { AudioFrame } from './audio.js';
import type { ProviderHealth } from './brain.js';

/**
 * Vendor-neutral TTS capabilities descriptor.
 */
export const TTSCapabilitiesSchema = z.object({
  streaming: z.boolean().default(true),
  languages: z.array(z.string()).default(['en', 'th']),
  voiceSelection: z.boolean().default(true),
  speakingRate: z.boolean().default(true),
  wordTimings: z.boolean().default(false),
  local: z.boolean().default(false)
});
export type TTSCapabilities = z.infer<typeof TTSCapabilitiesSchema>;

/**
 * Voice metadata descriptor for speech synthesis.
 */
export const TTSVoiceInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  language: z.string().min(2),
  gender: z.enum(['female', 'male', 'neutral']).optional()
});
export type TTSVoiceInfo = z.infer<typeof TTSVoiceInfoSchema>;

/**
 * Synthesis request submitted to TTSProvider.
 */
export const SpeechRequestSchema = z.object({
  requestId: z.string().min(1),
  text: z.string().trim().min(1, 'Speech text cannot be empty'),
  language: z.string().min(2).optional(), // BCP-47 compatible, e.g. 'th', 'en', 'th-TH', 'en-US'
  voiceId: z.string().min(1).optional(),
  rate: z.number().min(0.5).max(2.0).default(1.0),
  pitch: z.number().min(0.5).max(1.5).optional(),
  metadata: z.record(z.unknown()).optional()
});
export type SpeechRequest = z.infer<typeof SpeechRequestSchema>;

/**
 * Normalized TTS error codes.
 */
export const TTSErrorCodeSchema = z.enum([
  'tts_unavailable',
  'tts_unconfigured',
  'tts_auth',
  'tts_limit',
  'tts_timeout',
  'tts_invalid_request',
  'tts_runtime_error',
  'cancelled'
]);
export type TTSErrorCode = z.infer<typeof TTSErrorCodeSchema>;

/**
 * Normalized TTS error structure.
 */
export const TTSErrorSchema = z.object({
  code: TTSErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean().default(false),
  details: z.record(z.unknown()).optional()
});
export type TTSError = z.infer<typeof TTSErrorSchema>;

/**
 * Discriminated union of Speech Events emitted during synthesis.
 *
 * NOTE ON SYNTHESIS VS PLAYBACK BOUNDARY:
 * - SpeechEvent 'completed' denotes that the TTS synthesis engine has finished generating audio frames.
 * - It does NOT denote that the speaker has finished playing the audio.
 * - Speaker playback completion is tracked separately by AudioOutput.
 */
export interface SpeechStartedEvent {
  type: 'started';
  requestId: string;
  timestamp: number;
}

export interface SpeechAudioEvent {
  type: 'audio';
  requestId: string;
  frame: AudioFrame;
  timestamp: number;
}

export interface SpeechCompletedEvent {
  type: 'completed';
  requestId: string;
  durationMs?: number;
  timestamp: number;
}

export interface SpeechCancelledEvent {
  type: 'cancelled';
  requestId: string;
  reason: string;
  timestamp: number;
}

export interface SpeechErrorEvent {
  type: 'error';
  requestId: string;
  error: TTSError;
  timestamp: number;
}

export interface SpeechWordBoundaryEvent {
  type: 'word_boundary';
  requestId: string;
  word: string;
  startMs: number;
  endMs: number;
  timestamp: number;
}

export type SpeechEvent =
  | SpeechStartedEvent
  | SpeechAudioEvent
  | SpeechCompletedEvent
  | SpeechCancelledEvent
  | SpeechErrorEvent
  | SpeechWordBoundaryEvent;

/**
 * Options for TTS synthesis requests.
 */
export interface TTSSynthesizeOptions {
  signal?: AbortSignal;
}

/**
 * Vendor-neutral TTSProvider contract.
 * Synthesizes text into streaming AudioFrames.
 */
export interface TTSProvider {
  readonly id: string;
  getCapabilities(): TTSCapabilities;
  health(): Promise<ProviderHealth>;
  synthesize(
    request: SpeechRequest,
    options?: TTSSynthesizeOptions
  ): AsyncIterable<SpeechEvent>;
  cancel?(requestId: string): Promise<void>;
  dispose?(): Promise<void>;
}
