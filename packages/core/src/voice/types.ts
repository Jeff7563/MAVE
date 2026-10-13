/**
 * Reason/trigger for emitting a SpeakableChunk.
 */
export type SpeakableChunkReason =
  | 'sentence_boundary'
  | 'clause_boundary'
  | 'size_limit'
  | 'flush';

/**
 * A speakable segment of assistant response text generated progressively.
 */
export interface SpeakableChunk {
  /** Monotonic 0-indexed sequence within the turn/utterance */
  sequence: number;
  /** Normalized, speakable text ready for TTS synthesis */
  text: string;
  /** Whether this is the final chunk of the response stream */
  isFinal: boolean;
  /** The triggering reason for chunk emission */
  reason: SpeakableChunkReason;
  /** Exact slice of original source text prior to speech normalization and boundary trimming */
  rawText: string;
}

/**
 * Configuration options for StreamingTextChunker.
 */
export interface StreamingTextChunkerOptions {
  /**
   * Minimum character length required before a sentence or clause boundary can be emitted.
   * Prevents micro-chunks and preserves natural prosody.
   * Default: 12 (allows short sentences like "Hello there." [12 chars] to emit immediately).
   */
  minChunkChars?: number;

  /**
   * Preferred character target for clause boundaries.
   * Punctuation like commas or semicolons will only trigger a split if the accumulated
   * text exceeds this threshold.
   * Default: 100.
   */
  preferredChunkChars?: number;

  /**
   * Hard upper bound on buffered characters.
   * If reached without punctuation, forces a chunk split at the nearest safe space or boundary.
   * Default: 260.
   */
  maxChunkChars?: number;

  /**
   * Whether to apply speech normalization (stripping markdown bold/italic/backticks,
   * replacing code blocks with voice-friendly placeholders) to chunk.text.
   * Raw text is always preserved in chunk.rawText.
   * Default: true.
   */
  enableSpeechNormalization?: boolean;
}

/**
 * Options for converting a SpeakableChunk into a SpeechRequest.
 */
export interface PlanSpeechRequestOptions {
  /** Unique ID for the voice turn (e.g. 'voice-turn-123') */
  voiceTurnId: string;
  /** Language hint (e.g. 'en', 'th', 'en-US', 'th-TH') */
  language?: string;
  /** Voice selection ID */
  voiceId?: string;
  /** Speaking rate multiplier (0.5 to 2.0, default 1.0) */
  rate?: number;
  /** Pitch adjustment multiplier */
  pitch?: number;
  /** Additional metadata to forward */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration options for ProgressiveSpeechQueue.
 */
export interface ProgressiveSpeechQueueOptions {
  /** Maximum number of buffered chunks before indicating backpressure. Default: 8. */
  maxPendingChunks?: number;
}
