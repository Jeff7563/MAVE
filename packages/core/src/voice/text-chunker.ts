import { normalizeTextForSpeech } from './text-normalizer.js';
import type {
  SpeakableChunk,
  SpeakableChunkReason,
  StreamingTextChunkerOptions
} from './types.js';

const COMMON_ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'approx',
  'apt',
  'dept',
  'est',
  'min',
  'max',
  'no',
  'vol',
  'inc',
  'ltd',
  'corp',
  'co',
  'ave',
  'blvd',
  'gen',
  'gov',
  'rep',
  'sen'
]);

// Thai combining marks: vowels (\u0E31, \u0E34-\u0E3A) and tone marks (\u0E47-\u0E4E)
const THAI_COMBINING_REGEX = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;

interface BoundaryMatch {
  splitIndex: number;
  delimiterLength: number;
  reason: SpeakableChunkReason;
}

function extractWordBefore(str: string, dotIndex: number): string {
  let start = dotIndex - 1;
  while (start >= 0 && /[A-Za-z0-9.]/.test(str[start]!)) {
    start--;
  }
  return str.slice(start + 1, dotIndex);
}

function countFollowingWhitespace(str: string, startIndex: number): number {
  let count = 0;
  while (startIndex + count < str.length && /\s/.test(str[startIndex + count]!)) {
    count++;
  }
  return count;
}

/**
 * Pure, deterministic streaming text segmentation layer.
 * Ingests arbitrary token deltas from LLMs and progressively emits speakable text chunks
 * suitable for natural TTS synthesis before the full answer finishes generating.
 */
export class StreamingTextChunker {
  private buffer = '';
  private rawBuffer = '';
  private sequence = 0;
  private isCancelled = false;

  readonly minChunkChars: number;
  readonly preferredChunkChars: number;
  readonly maxChunkChars: number;
  readonly enableSpeechNormalization: boolean;

  constructor(options: StreamingTextChunkerOptions = {}) {
    this.minChunkChars = Math.max(1, options.minChunkChars ?? 12);
    this.preferredChunkChars = Math.max(this.minChunkChars, options.preferredChunkChars ?? 100);
    this.maxChunkChars = Math.max(this.preferredChunkChars, options.maxChunkChars ?? 260);
    this.enableSpeechNormalization = options.enableSpeechNormalization ?? true;
  }

  /**
   * Pushes a new string fragment from the Brain response_delta stream.
   * Returns an array of SpeakableChunks if safe linguistic or size boundaries were reached.
   */
  push(delta: string): SpeakableChunk[] {
    if (this.isCancelled || !delta || delta.length === 0) {
      return [];
    }

    this.buffer += delta;
    this.rawBuffer += delta;

    const emitted: SpeakableChunk[] = [];

    while (this.buffer.length > 0) {
      const match = this.findNextBoundary();
      if (!match) {
        break;
      }

      const { splitIndex, delimiterLength, reason } = match;

      // Extract raw slice including delimiter to ensure 100% lossless reconstruction
      const rawChunk = this.rawBuffer.slice(0, splitIndex + delimiterLength);
      this.buffer = this.buffer.slice(splitIndex + delimiterLength);
      this.rawBuffer = this.rawBuffer.slice(splitIndex + delimiterLength);

      // Clean speech text
      const candidateSpeechText = rawChunk.slice(0, splitIndex);
      const text = this.enableSpeechNormalization
        ? normalizeTextForSpeech(candidateSpeechText)
        : candidateSpeechText.trim();

      if (text.length > 0) {
        emitted.push({
          sequence: this.sequence++,
          text,
          isFinal: false,
          reason,
          rawText: rawChunk
        });
      }
    }

    return emitted;
  }

  /**
   * Flushes any remaining buffered text when the Brain completes (response_completed).
   * Emitted chunk is marked isFinal: true with reason 'flush'.
   */
  flush(): SpeakableChunk[] {
    if (this.isCancelled || this.buffer.length === 0) {
      this.buffer = '';
      this.rawBuffer = '';
      return [];
    }

    const rawText = this.rawBuffer;
    this.buffer = '';
    this.rawBuffer = '';

    const text = this.enableSpeechNormalization
      ? normalizeTextForSpeech(rawText)
      : rawText.trim();

    if (text.length === 0) {
      return [];
    }

    return [
      {
        sequence: this.sequence++,
        text,
        isFinal: true,
        reason: 'flush',
        rawText
      }
    ];
  }

  /**
   * Resets the chunker to initial clean state, clearing buffers and resetting sequence.
   */
  reset(): void {
    this.buffer = '';
    this.rawBuffer = '';
    this.sequence = 0;
    this.isCancelled = false;
  }

  /**
   * Cancels active chunking, discarding buffered text and preventing further emissions.
   */
  cancel(): void {
    this.buffer = '';
    this.rawBuffer = '';
    this.isCancelled = true;
  }

  getBuffer(): string {
    return this.buffer;
  }

  getRawBuffer(): string {
    return this.rawBuffer;
  }

  getSequence(): number {
    return this.sequence;
  }

  private findNextBoundary(): BoundaryMatch | null {
    const len = this.buffer.length;

    // Scan for the first sentence ender
    let sentenceBoundary: BoundaryMatch | null = null;
    for (let i = 0; i < len; i++) {
      const ch = this.buffer[i]!;

      if (ch === '.') {
        // False split check: Ellipsis (.. or ...)
        if ((i > 0 && this.buffer[i - 1] === '.') || (i + 1 < len && this.buffer[i + 1] === '.')) {
          continue;
        }

        // False split check: Common abbreviations and initials (e.g. Dr., Mr., e.g., J.)
        const wordBefore = extractWordBefore(this.buffer, i);
        if (COMMON_ABBREVIATIONS.has(wordBefore.toLowerCase())) {
          continue;
        }
        if (wordBefore.length === 1 && /[A-Za-z]/.test(wordBefore)) {
          continue;
        }

        // Advance past closing markdown, quotes, or brackets (e.g. .**, .", .', .), .])
        let endIdx = i + 1;
        while (endIdx < len && /[*_"`'\)\]\}]/.test(this.buffer[endIdx]!)) {
          endIdx++;
        }

        // False split check: Decimal numbers (e.g. 3.14) or decimal awaiting next token (3.)
        if (i > 0 && /\d/.test(this.buffer[i - 1]!)) {
          if (endIdx < len && /\d/.test(this.buffer[endIdx]!)) {
            continue; // 3.14
          }
          if (endIdx === len) {
            continue; // 3. at end of buffer awaiting next delta
          }
        }

        // False split check: Web domains or identifiers without space (e.g. example.com, v1.0)
        if (endIdx < len && !/\s/.test(this.buffer[endIdx]!)) {
          continue;
        }

        if (endIdx >= this.minChunkChars) {
          const delimiterLength = countFollowingWhitespace(this.buffer, endIdx);
          sentenceBoundary = {
            splitIndex: endIdx,
            delimiterLength,
            reason: 'sentence_boundary'
          };
          break;
        }
      } else if (ch === '?' || ch === '!' || ch === 'ฯ') {
        let endIdx = i + 1;
        while (endIdx < len && /[*_"`'\)\]\}]/.test(this.buffer[endIdx]!)) {
          endIdx++;
        }

        if (endIdx >= this.minChunkChars) {
          const delimiterLength = countFollowingWhitespace(this.buffer, endIdx);
          sentenceBoundary = {
            splitIndex: endIdx,
            delimiterLength,
            reason: 'sentence_boundary'
          };
          break;
        }
      } else if (ch === '\n') {
        if (i >= this.minChunkChars) {
          const delimiterLength = countFollowingWhitespace(this.buffer, i);
          sentenceBoundary = {
            splitIndex: i,
            delimiterLength,
            reason: 'sentence_boundary'
          };
          break;
        }
      }
    }

    // 1. If a sentence boundary exists within preferredChunkChars, emit it directly
    if (sentenceBoundary && sentenceBoundary.splitIndex <= this.preferredChunkChars) {
      return sentenceBoundary;
    }

    // 2. If a sentence boundary exists but exceeds preferredChunkChars, check for an earlier clause break
    if (sentenceBoundary && sentenceBoundary.splitIndex > this.preferredChunkChars) {
      const clause = this.findClauseBoundary(sentenceBoundary.splitIndex);
      if (clause) {
        return clause;
      }
      // If no clause boundary and still within maxChunkChars, emit whole sentence
      if (sentenceBoundary.splitIndex <= this.maxChunkChars) {
        return sentenceBoundary;
      }
      // If the sentence itself exceeds maxChunkChars, fall through to size limit fallback
    }

    // 3. If no sentence boundary yet but buffer has exceeded preferredChunkChars, look for clause boundary
    if (!sentenceBoundary && len >= this.preferredChunkChars) {
      const clause = this.findClauseBoundary(len);
      if (clause) {
        return clause;
      }
    }

    // 4. Fallback: Hard max buffer size limit reached (buffer >= maxChunkChars)
    if (len >= this.maxChunkChars) {
      // Find the last safe space between minChunkChars and maxChunkChars
      for (let k = this.maxChunkChars; k >= this.minChunkChars; k--) {
        if (/\s/.test(this.buffer[k]!)) {
          return {
            splitIndex: k,
            delimiterLength: 1,
            reason: 'size_limit'
          };
        }
      }

      // If no space exists (e.g. unbroken Thai or long token), split at maxChunkChars
      let splitIndex = this.maxChunkChars;
      while (splitIndex < len && THAI_COMBINING_REGEX.test(this.buffer.charAt(splitIndex))) {
        splitIndex++;
      }

      return {
        splitIndex,
        delimiterLength: 0,
        reason: 'size_limit'
      };
    }

    return null;
  }

  private findClauseBoundary(maxIndex: number): BoundaryMatch | null {
    for (let j = this.minChunkChars; j < maxIndex; j++) {
      const ch = this.buffer[j]!;

      if (ch === ';' || ch === ',' || ch === ':' || ch === '—' || ch === '–') {
        // Skip numbers with commas like 1,000
        if (ch === ',' && j > 0 && /\d/.test(this.buffer[j - 1]!) && j + 1 < maxIndex && /\d/.test(this.buffer[j + 1]!)) {
          continue;
        }

        if (j + 1 === maxIndex || /\s/.test(this.buffer[j + 1]!)) {
          const delimiterLength = countFollowingWhitespace(this.buffer, j + 1);
          return {
            splitIndex: j + 1,
            delimiterLength,
            reason: 'clause_boundary'
          };
        }
      } else if (ch === ' ' && j > 0 && j + 1 < maxIndex) {
        // Thai clause space (space surrounded by Thai characters)
        const isThaiBefore = /[\u0E00-\u0E7F]/.test(this.buffer[j - 1]!);
        const isThaiAfter = /[\u0E00-\u0E7F]/.test(this.buffer[j + 1]!);
        if (isThaiBefore && isThaiAfter) {
          return {
            splitIndex: j,
            delimiterLength: 1,
            reason: 'clause_boundary'
          };
        }
      }
    }
    return null;
  }
}
