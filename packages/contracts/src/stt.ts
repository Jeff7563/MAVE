import { z } from 'zod';
import type { AudioFrame } from './audio.js';
import type { ProviderHealth } from './brain.js';

/**
 * Vendor-neutral STT capabilities descriptor.
 */
export const STTCapabilitiesSchema = z.object({
  streaming: z.boolean().default(true),
  partialTranscripts: z.boolean().default(true),
  languageDetection: z.boolean().default(false),
  wordTimestamps: z.boolean().default(false),
  confidence: z.boolean().default(true),
  local: z.boolean().default(false)
});
export type STTCapabilities = z.infer<typeof STTCapabilitiesSchema>;

/**
 * Normalized STT error codes.
 */
export const STTErrorCodeSchema = z.enum([
  'stt_unavailable',
  'stt_unconfigured',
  'stt_auth',
  'stt_limit',
  'stt_timeout',
  'stt_invalid_audio',
  'stt_invalid_response',
  'stt_runtime_error',
  'cancelled'
]);
export type STTErrorCode = z.infer<typeof STTErrorCodeSchema>;

/**
 * Normalized STT error structure.
 */
export const STTErrorSchema = z.object({
  code: STTErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean().default(false),
  details: z.record(z.unknown()).optional()
});
export type STTError = z.infer<typeof STTErrorSchema>;

/**
 * Optional word-level timing marker for transcripts.
 * Useful for future language tutoring, subtitles, and pronunciation analysis.
 */
export const TranscriptWordSchema = z.object({
  text: z.string().min(1),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  confidence: z.number().min(0.0).max(1.0).optional()
});
export type TranscriptWord = z.infer<typeof TranscriptWordSchema>;

/**
 * Options for speech transcription requests.
 */
export const STTRequestOptionsSchema = z.object({
  requestId: z.string().min(1),
  languageHint: z.string().min(2).optional(), // BCP-47 compatible, e.g. 'th', 'en', 'th-TH', 'en-US'
  autoDetectLanguage: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional()
});
export interface STTRequestOptions extends z.infer<typeof STTRequestOptionsSchema> {
  signal?: AbortSignal;
}

/**
 * Discriminated union of STT transcript streaming events.
 *
 * CRITICAL POLICY:
 * - partial_transcript: Ephemeral, interim prediction. Used for real-time UI display.
 *   MUST NOT be committed to ConversationRuntime or SQLite persistence.
 * - final_transcript: Stable, verified speech turn. Eligible for ConversationRuntime and persistence.
 */
export const TranscriptStartedEventSchema = z.object({
  type: z.literal('started'),
  requestId: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const SpeechStartedEventSchema = z.object({
  type: z.literal('speech_started'),
  requestId: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const PartialTranscriptEventSchema = z.object({
  type: z.literal('partial_transcript'),
  requestId: z.string().min(1),
  text: z.string(),
  confidence: z.number().min(0.0).max(1.0).optional(),
  timestamp: z.number().nonnegative()
});

export const FinalTranscriptEventSchema = z.object({
  type: z.literal('final_transcript'),
  requestId: z.string().min(1),
  text: z.string().min(1),
  confidence: z.number().min(0.0).max(1.0),
  language: z.string().optional(),
  words: z.array(TranscriptWordSchema).optional(),
  timestamp: z.number().nonnegative()
});

export const SpeechEndedEventSchema = z.object({
  type: z.literal('speech_ended'),
  requestId: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const TranscriptCancelledEventSchema = z.object({
  type: z.literal('cancelled'),
  requestId: z.string().min(1),
  reason: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const TranscriptErrorEventSchema = z.object({
  type: z.literal('error'),
  requestId: z.string().min(1),
  error: STTErrorSchema,
  timestamp: z.number().nonnegative()
});

export const TranscriptEventSchema = z.discriminatedUnion('type', [
  TranscriptStartedEventSchema,
  SpeechStartedEventSchema,
  PartialTranscriptEventSchema,
  FinalTranscriptEventSchema,
  SpeechEndedEventSchema,
  TranscriptCancelledEventSchema,
  TranscriptErrorEventSchema
]);
export type TranscriptEvent = z.infer<typeof TranscriptEventSchema>;

/**
 * Vendor-neutral STTProvider contract.
 * Transcribes streaming AudioFrames into TranscriptEvents.
 */
export interface STTProvider {
  readonly id: string;
  getCapabilities(): STTCapabilities;
  health(): Promise<ProviderHealth>;
  transcribe(
    audio: AsyncIterable<AudioFrame>,
    options: STTRequestOptions
  ): AsyncIterable<TranscriptEvent>;
  cancel?(requestId: string): Promise<void>;
  dispose?(): Promise<void>;
}
