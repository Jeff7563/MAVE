import { describe, it, expect } from 'vitest';
import {
  StreamingTextChunker,
  normalizeTextForSpeech,
  createSpeechRequestFromChunk,
  ProgressiveSpeechQueue,
  type SpeakableChunk
} from '../voice/index.js';
import { MockTTSProvider } from '@mave/providers';

describe('StreamingTextChunker — Unit Tests (Criteria 1–25)', () => {
  it('1. empty push emits nothing', () => {
    const chunker = new StreamingTextChunker();
    expect(chunker.push('')).toEqual([]);
    expect(chunker.getBuffer()).toBe('');
  });

  it('2. arbitrary delta reconstruction preserves full source text', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const deltas = ['He', 'llo', ' there', '. How', ' are', ' you?'];
    const emitted: SpeakableChunk[] = [];

    for (const d of deltas) {
      emitted.push(...chunker.push(d));
    }
    emitted.push(...chunker.flush());

    const reconstructedRaw = emitted.map((c) => c.rawText).join('');
    expect(reconstructedRaw).toBe('Hello there. How are you?');
  });

  it('3. sentence boundary emission on period', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunks = chunker.push('The weather is nice today. More to follow.');
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.text).toBe('The weather is nice today.');
    expect(chunks[0]?.reason).toBe('sentence_boundary');
    expect(chunks[1]?.text).toBe('More to follow.');
    expect(chunks[1]?.reason).toBe('sentence_boundary');
  });

  it('4. question boundary emits sentence boundary chunk', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunks = chunker.push('What is the current system status?');
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.text).toBe('What is the current system status?');
    expect(chunks[0]?.reason).toBe('sentence_boundary');
  });

  it('5. exclamation boundary emits sentence boundary chunk', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunks = chunker.push('The operation completed successfully!');
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.text).toBe('The operation completed successfully!');
    expect(chunks[0]?.reason).toBe('sentence_boundary');
  });

  it('6. newline handling triggers sentence boundary', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunks = chunker.push('First line of instructions.\nSecond line starts here.');
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.text).toBe('First line of instructions.');
    expect(chunks[1]?.text).toBe('Second line starts here.');
  });

  it('7. Thai punctuation triggers sentence boundary', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunks = chunker.push('กรุงเทพมหานครฯ ยินดีต้อนรับครับ');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]?.text).toContain('กรุงเทพมหานครฯ');
    expect(chunks[0]?.reason).toBe('sentence_boundary');
  });

  it('8. decimal false split avoided across deltas', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    // Push 3. at end of delta, followed by 14
    const chunks1 = chunker.push('The value of pi is approximately 3.');
    expect(chunks1).toEqual([]); // Should NOT split at 3.

    const chunks2 = chunker.push('14159, which is a mathematical constant.');
    expect(chunks2.length).toBe(1);
    expect(chunks2[0]?.text).toContain('3.14159');
  });

  it('9. common abbreviation false split avoided (Dr., Mr., e.g., i.e.)', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunks1 = chunker.push('Dr. Smith arrived at the clinic early.');
    expect(chunks1.length).toBe(1);
    expect(chunks1[0]?.text).toBe('Dr. Smith arrived at the clinic early.');

    chunker.reset();
    const chunks2 = chunker.push('Please bring documents, e.g. passport or license.');
    expect(chunks2.length).toBe(1);
    expect(chunks2[0]?.text).toBe('Please bring documents, e.g. passport or license.');
  });

  it('10. preferred/max size fallback emits clause_boundary or size_limit', () => {
    const chunker = new StreamingTextChunker({
      minChunkChars: 10,
      preferredChunkChars: 50,
      maxChunkChars: 120
    });

    // Sentence with comma after preferredChunkChars (50 chars)
    const longClause = 'This is an extended introductory clause that exceeds the preferred threshold, and then continues on.';
    const chunks = chunker.push(longClause);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]?.reason).toBe('clause_boundary');
  });

  it('11. final flush emits remaining buffer', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    chunker.push('Incomplete remaining text');
    const flushed = chunker.flush();
    expect(flushed.length).toBe(1);
    expect(flushed[0]?.text).toBe('Incomplete remaining text');
    expect(flushed[0]?.isFinal).toBe(true);
    expect(flushed[0]?.reason).toBe('flush');
  });

  it('12. flush empty buffer returns empty array', () => {
    const chunker = new StreamingTextChunker();
    expect(chunker.flush()).toEqual([]);
  });

  it('13. reset clears buffer and resets sequence to zero', () => {
    const chunker = new StreamingTextChunker();
    chunker.push('Some buffered text that is not finished');
    expect(chunker.getBuffer()).not.toBe('');

    chunker.reset();
    expect(chunker.getBuffer()).toBe('');
    expect(chunker.getSequence()).toBe(0);

    const afterReset = chunker.push('First fresh sentence.');
    expect(afterReset[0]?.sequence).toBe(0);
  });

  it('14. sequence numbers are strictly monotonic', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const c1 = chunker.push('Sentence number one. Sentence number two. ');
    const c2 = chunker.push('Sentence number three.');
    const flushed = chunker.flush();

    const all = [...c1, ...c2, ...flushed];
    expect(all.length).toBe(3);
    expect(all[0]?.sequence).toBe(0);
    expect(all[1]?.sequence).toBe(1);
    expect(all[2]?.sequence).toBe(2);
  });

  it('15. final chunk marked final: true', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    chunker.push('This is the final thought.');
    const flushed = chunker.flush();
    if (flushed.length > 0) {
      expect(flushed[flushed.length - 1]?.isFinal).toBe(true);
    }
  });

  it('16. non-final chunks are marked final: false', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunks = chunker.push('First sentence here. Second sentence starts.');
    expect(chunks[0]?.isFinal).toBe(false);
  });

  it('17. whitespace preserved semantically without corruption', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const c1 = chunker.push('Hello there. ');
    const c2 = chunker.push('How are you doing today?');
    const flushed = chunker.flush();

    const combined = [...c1, ...c2, ...flushed];
    expect(combined[0]?.text).toBe('Hello there.');
    expect(combined[1]?.text).toBe('How are you doing today?');
    // Ensure no space before period ("Hello .") or joined words ("Howare")
    for (const c of combined) {
      expect(c.text).not.toMatch(/\s\./);
      expect(c.text).not.toMatch(/Howare/);
    }
  });

  it('18. no duplicated punctuation', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunks = chunker.push('System is ready. All diagnostics passed.');
    for (const c of chunks) {
      expect(c.text).not.toContain('..');
      expect(c.text).not.toContain('??');
    }
  });

  it('19. no text loss during arbitrary chunking', () => {
    const original = 'One morning, when Gregor Samsa woke from troubled dreams, he found himself transformed into a monstrous insect.';
    const chunker = new StreamingTextChunker({ minChunkChars: 10, preferredChunkChars: 50 });
    const chunks = chunker.push(original);
    chunks.push(...chunker.flush());

    const reconstructed = chunks.map((c) => c.rawText).join('');
    expect(reconstructed).toBe(original);
  });

  it('20. deterministic output for identical input streams', () => {
    const stream = ['The ', 'quick ', 'brown ', 'fox ', 'jumps ', 'over ', 'the ', 'lazy ', 'dog.'];
    const run = () => {
      const chunker = new StreamingTextChunker({ minChunkChars: 10 });
      const res: SpeakableChunk[] = [];
      for (const d of stream) res.push(...chunker.push(d));
      res.push(...chunker.flush());
      return res;
    };

    const run1 = run();
    const run2 = run();
    expect(run1).toEqual(run2);
  });

  it('21. progressive first chunk emitted before source completion', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunk1 = chunker.push('Hello there. ');
    expect(chunk1.length).toBe(1);
    expect(chunk1[0]?.text).toBe('Hello there.');
    // Source stream continues afterwards
    const chunk2 = chunker.push('How are you doing today?');
    const flushed = chunker.flush();
    expect(chunk2.length + flushed.length).toBe(1);
  });

  it('22. mock TTS accepts generated requests', async () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunks = chunker.push('Testing progressive speech pipeline.');
    expect(chunks.length).toBe(1);

    const tts = new MockTTSProvider();
    const speechRequest = createSpeechRequestFromChunk(chunks[0]!, {
      voiceTurnId: 'turn-test-1',
      language: 'en'
    });

    const events = [];
    for await (const event of tts.synthesize(speechRequest)) {
      events.push(event);
    }

    expect(events[0]?.type).toBe('started');
    expect(events.some((e) => e.type === 'audio')).toBe(true);
    expect(events[events.length - 1]?.type).toBe('completed');
  });

  it('23. TTS request IDs are deterministic', () => {
    const chunk: SpeakableChunk = {
      sequence: 3,
      text: 'Fourth chunk text.',
      isFinal: false,
      reason: 'sentence_boundary',
      rawText: 'Fourth chunk text.'
    };

    const req = createSpeechRequestFromChunk(chunk, { voiceTurnId: 'turn-xyz' });
    expect(req.requestId).toBe('turn-xyz:tts:3');
  });

  it('24. long input without punctuation is bounded by maxChunkChars', () => {
    const chunker = new StreamingTextChunker({
      minChunkChars: 20,
      preferredChunkChars: 50,
      maxChunkChars: 80
    });

    // 120 chars without sentence punctuation
    const longInput = 'This is a deliberately extended sequence of words intended to push the chunker beyond its hard max threshold easily.';
    const chunks = chunker.push(longInput);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]?.reason).toBe('size_limit');
    expect(chunks[0]?.text.length).toBeLessThanOrEqual(80);
  });

  it('25. Thai arbitrary delta splitting produces lossless text', () => {
    const thaiText = 'สวัสดีครับ วันนี้เป็นอย่างไรบ้าง สบายดีไหมครับ';
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const emitted: SpeakableChunk[] = [];

    // Split Thai string across 3-char deltas
    for (let i = 0; i < thaiText.length; i += 3) {
      emitted.push(...chunker.push(thaiText.slice(i, i + 3)));
    }
    emitted.push(...chunker.flush());

    const reconstructed = emitted.map((c) => c.rawText).join('');
    expect(reconstructed).toBe(thaiText);
  });
});

describe('Progressive Start Proof (Section 24)', () => {
  it('emits first chunk BEFORE final Brain completion', () => {
    const chunker = new StreamingTextChunker();

    // Step 1: Brain emits first sentence
    const deltas1 = chunker.push('Hello there.');
    expect(deltas1.length).toBe(1);
    expect(deltas1[0]?.text).toBe('Hello there.');
    expect(deltas1[0]?.isFinal).toBe(false);

    // Step 2: Brain stream is NOT complete yet; next tokens arrive
    const deltas2 = chunker.push(' How are you?');
    // deltas2 may be held or emitted depending on sentence end
    const flushed = chunker.flush();

    const secondChunk = deltas2.length > 0 ? deltas2[0] : flushed[0];
    expect(secondChunk?.text).toBe('How are you?');
    expect(secondChunk?.sequence).toBe(1);
  });
});

describe('Delta Pathology Tests (Section 25)', () => {
  it('handles "H" + "ello."', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 5 });
    expect(chunker.push('H')).toEqual([]);
    const c = chunker.push('ello.');
    expect(c.length).toBe(1);
    expect(c[0]?.text).toBe('Hello.');
  });

  it('handles "Hello" + " world."', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 5 });
    expect(chunker.push('Hello')).toEqual([]);
    const c = chunker.push(' world.');
    expect(c.length).toBe(1);
    expect(c[0]?.text).toBe('Hello world.');
  });

  it('handles "What" + "?"', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 4 });
    expect(chunker.push('What')).toEqual([]);
    const c = chunker.push('?');
    expect(c.length).toBe(1);
    expect(c[0]?.text).toBe('What?');
  });

  it('handles "3." + "14"', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 5 });
    expect(chunker.push('Value is 3.')).toEqual([]);
    const c = chunker.push('14. Ready.');
    expect(c.length).toBeGreaterThanOrEqual(1);
    expect(c[0]?.text).toContain('3.14');
  });

  it('handles "Dr." + " Smith"', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 5 });
    expect(chunker.push('Dr.')).toEqual([]);
    const c = chunker.push(' Smith is here.');
    expect(c.length).toBe(1);
    expect(c[0]?.text).toBe('Dr. Smith is here.');
  });

  it('handles emoji without corrupting code units', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 5 });
    const c = chunker.push('Hello 🌟 world! Have a great day.');
    expect(c.length).toBe(2);
    expect(c[0]?.text).toBe('Hello 🌟 world!');
    expect(c[1]?.text).toBe('Have a great day.');
  });

  it('handles multiple consecutive spaces and newlines cleanly', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 5 });
    const c = chunker.push('First part.   \n\n\n   Second part.');
    expect(c.length).toBe(2);
    expect(c[0]?.text).toBe('First part.');
    expect(c[1]?.text).toBe('Second part.');
  });

  it('handles punctuation-only deltas safely', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 5 });
    chunker.push('Here is the end');
    const c = chunker.push('.');
    expect(c.length).toBe(1);
    expect(c[0]?.text).toBe('Here is the end.');
  });
});

describe('Thai Language Tests (Section 27)', () => {
  it('handles Thai greeting split across deltas with exact preservation', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const deltas = ['สวัสดี', 'ครับ ', 'วันนี้เป็น', 'อย่างไรบ้าง?'];
    const emitted: SpeakableChunk[] = [];

    for (const d of deltas) {
      emitted.push(...chunker.push(d));
    }
    emitted.push(...chunker.flush());

    const reconstructed = emitted.map((c) => c.rawText).join('');
    expect(reconstructed).toBe('สวัสดีครับ วันนี้เป็นอย่างไรบ้าง?');
  });

  it('handles long punctuation-free Thai sentence with size fallback', () => {
    const longThai = 'วันนี้เหนื่อยมากแต่ยังไหวอยู่อยากให้งานเสร็จอย่างราบรื่นและมีประสิทธิภาพสูงสุดเพื่อทุกคนในทีม';
    const chunker = new StreamingTextChunker({
      minChunkChars: 15,
      preferredChunkChars: 30,
      maxChunkChars: 50
    });

    const emitted = chunker.push(longThai);
    emitted.push(...chunker.flush());

    expect(emitted.length).toBeGreaterThanOrEqual(2);
    const reconstructed = emitted.map((c) => c.rawText).join('');
    expect(reconstructed).toBe(longThai);
  });
});

describe('Markdown & Code Normalizer Tests (Section 28)', () => {
  it('strips bold and italic emphasis from speech text while preserving raw text', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunks = chunker.push('**Hello world.**');
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.text).toBe('Hello world.');
    expect(chunks[0]?.rawText).toBe('**Hello world.**');
  });

  it('strips inline code backticks', () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const chunks = chunker.push('Run `npm test` to verify.');
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.text).toBe('Run npm test to verify.');
  });

  it('replaces fenced code block with speech-friendly placeholder', () => {
    const text = 'Here is the setup:\n```bash\nnpm install\n```\nAll done.';
    const normalized = normalizeTextForSpeech(text);
    expect(normalized).toContain('I have provided a code example on screen.');
    expect(normalized).not.toContain('npm install');
  });

  it('leaves international text and numbers intact', () => {
    expect(normalizeTextForSpeech('สวัสดีครับ')).toBe('สวัสดีครับ');
    expect(normalizeTextForSpeech('pi is 3.14')).toBe('pi is 3.14');
  });
});

describe('ProgressiveSpeechQueue & Backpressure (Section 18)', () => {
  it('enforces FIFO ordering and tracks monotonic sequence', () => {
    const queue = new ProgressiveSpeechQueue({ maxPendingChunks: 3 });

    const c0: SpeakableChunk = { sequence: 0, text: 'Zero', isFinal: false, reason: 'sentence_boundary', rawText: 'Zero' };
    const c1: SpeakableChunk = { sequence: 1, text: 'One', isFinal: false, reason: 'sentence_boundary', rawText: 'One' };
    const c2: SpeakableChunk = { sequence: 2, text: 'Two', isFinal: true, reason: 'flush', rawText: 'Two' };

    expect(queue.enqueue(c0)).toBe(true);
    expect(queue.enqueue(c1)).toBe(true);
    expect(queue.enqueue(c2)).toBe(true);

    // Queue full (maxPendingChunks: 3)
    const c3: SpeakableChunk = { sequence: 3, text: 'Three', isFinal: false, reason: 'sentence_boundary', rawText: 'Three' };
    expect(queue.isFull()).toBe(true);
    expect(queue.enqueue(c3)).toBe(false); // Backpressure signal

    expect(queue.dequeue()).toBe(c0);
    expect(queue.getNextExpectedSequence()).toBe(1);
    expect(queue.dequeue()).toBe(c1);
    expect(queue.dequeue()).toBe(c2);
    expect(queue.isEmpty()).toBe(true);
  });
});

describe('TTS Mock Integration Test (Section 23)', () => {
  it('orchestrates: simulated Brain deltas -> StreamingTextChunker -> SpeakableChunks -> MockTTSProvider -> SpeechEvents', async () => {
    const chunker = new StreamingTextChunker({ minChunkChars: 10 });
    const tts = new MockTTSProvider();
    const voiceTurnId = 'turn-voice-loop-42';

    const brainDeltas = [
      'Hello ',
      'there! ',
      'I am MAVE, ',
      'your ambient assistant. ',
      'How may I help you today?'
    ];

    const emittedChunks: SpeakableChunk[] = [];
    const synthesizedRequests = [];
    const allSpeechEvents = [];

    // Progressive streaming loop
    for (const delta of brainDeltas) {
      const chunks = chunker.push(delta);
      for (const chunk of chunks) {
        emittedChunks.push(chunk);

        const request = createSpeechRequestFromChunk(chunk, { voiceTurnId });
        synthesizedRequests.push(request);

        for await (const event of tts.synthesize(request)) {
          allSpeechEvents.push(event);
        }
      }
    }

    // Flushed remaining chunks
    for (const chunk of chunker.flush()) {
      emittedChunks.push(chunk);
      const request = createSpeechRequestFromChunk(chunk, { voiceTurnId });
      synthesizedRequests.push(request);

      for await (const event of tts.synthesize(request)) {
        allSpeechEvents.push(event);
      }
    }

    // Assertions
    expect(emittedChunks.length).toBeGreaterThanOrEqual(3);
    expect(synthesizedRequests[0]?.requestId).toBe('turn-voice-loop-42:tts:0');
    expect(synthesizedRequests[1]?.requestId).toBe('turn-voice-loop-42:tts:1');

    // Verify audio frames were generated for each chunk
    const audioEvents = allSpeechEvents.filter((e) => e.type === 'audio');
    expect(audioEvents.length).toBeGreaterThanOrEqual(3);

    const completedEvents = allSpeechEvents.filter((e) => e.type === 'completed');
    expect(completedEvents.length).toBe(synthesizedRequests.length);
  });
});
