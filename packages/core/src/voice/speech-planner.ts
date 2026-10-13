import type { SpeechRequest } from '@mave/contracts';
import type {
  PlanSpeechRequestOptions,
  ProgressiveSpeechQueueOptions,
  SpeakableChunk
} from './types.js';

/**
 * Pure helper converting a SpeakableChunk into a canonical vendor-neutral SpeechRequest
 * suitable for submission to any TTSProvider.
 *
 * Implements deterministic requestId correlation:
 *   `${voiceTurnId}:tts:${chunk.sequence}`
 */
export function createSpeechRequestFromChunk(
  chunk: SpeakableChunk,
  options: PlanSpeechRequestOptions
): SpeechRequest {
  return {
    requestId: `${options.voiceTurnId}:tts:${chunk.sequence}`,
    text: chunk.text,
    language: options.language,
    voiceId: options.voiceId,
    rate: options.rate ?? 1.0,
    pitch: options.pitch,
    metadata: {
      ...options.metadata,
      sequence: chunk.sequence,
      isFinal: chunk.isFinal,
      reason: chunk.reason
    }
  };
}

/**
 * Bounded FIFO queue managing progressive speech chunks and backpressure.
 * Ensures speech chunks are consumed in strict monotonic sequence without
 * unbounded memory accumulation if the Brain generates text faster than TTS can synthesize.
 */
export class ProgressiveSpeechQueue {
  private readonly maxPendingChunks: number;
  private readonly queue: SpeakableChunk[] = [];
  private nextExpectedSequence = 0;

  constructor(options: ProgressiveSpeechQueueOptions = {}) {
    this.maxPendingChunks = Math.max(1, options.maxPendingChunks ?? 8);
  }

  /**
   * Enqueues a SpeakableChunk.
   * Returns false if the queue is full (backpressure signal), true otherwise.
   */
  enqueue(chunk: SpeakableChunk): boolean {
    if (this.queue.length >= this.maxPendingChunks) {
      return false;
    }
    this.queue.push(chunk);
    return true;
  }

  /**
   * Dequeues the next chunk in FIFO order and advances nextExpectedSequence.
   */
  dequeue(): SpeakableChunk | undefined {
    const chunk = this.queue.shift();
    if (chunk) {
      this.nextExpectedSequence = chunk.sequence + 1;
    }
    return chunk;
  }

  peek(): SpeakableChunk | undefined {
    return this.queue[0];
  }

  size(): number {
    return this.queue.length;
  }

  isFull(): boolean {
    return this.queue.length >= this.maxPendingChunks;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  clear(): void {
    this.queue.length = 0;
  }

  getNextExpectedSequence(): number {
    return this.nextExpectedSequence;
  }
}
