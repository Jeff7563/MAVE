import { describe, it, expect } from 'vitest';
import {
  classifyResponseContent,
  parseContentBlocks,
  StreamingResponseClassifier,
  MAX_COMPACT_CHAR_COUNT
} from '../surface/response-classifier.js';
import type {
  SurfaceVocabularyBlock,
  SurfaceConfirmationBlock,
  SurfaceProgressBlock,
  SurfaceSourceBlock
} from '@mave/contracts';

describe('ResponseClassifier', () => {
  describe('parseContentBlocks', () => {
    it('returns empty array for empty string', () => {
      expect(parseContentBlocks('')).toEqual([]);
      expect(parseContentBlocks('   ')).toEqual([]);
    });

    it('returns single text block for plain text without code fences', () => {
      const blocks = parseContentBlocks('This is a simple answer.');
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        id: 'block-1',
        type: 'text',
        text: 'This is a simple answer.'
      });
    });

    it('extracts code blocks and surrounding markdown accurately', () => {
      const text = 'Here is the function:\n```typescript\nfunction add(a: number, b: number) {\n  return a + b;\n}\n```\nUse it like this.';
      const blocks = parseContentBlocks(text);

      expect(blocks).toHaveLength(3);
      expect(blocks[0]!.type).toBe('markdown');
      expect((blocks[0] as { markdown: string }).markdown).toBe('Here is the function:');

      expect(blocks[1]!.type).toBe('code');
      const codeBlock = blocks[1] as { language?: string; code: string };
      expect(codeBlock.language).toBe('typescript');
      expect(codeBlock.code).toContain('function add');

      expect(blocks[2]!.type).toBe('markdown');
      expect((blocks[2] as { markdown: string }).markdown).toBe('Use it like this.');
    });
  });

  describe('classifyResponseContent', () => {
    it('classifies short plain text as compact_response', () => {
      const result = classifyResponseContent({
        text: 'The capital of France is Paris.'
      });
      expect(result.mode).toBe('compact_response');
      expect(result.sizeClass).toBe('card');
      expect(result.isExpanded).toBe(false);
      expect(result.reason).toBe('compact_prose');
    });

    it('classifies text with code fence as expanded_response regardless of length', () => {
      const shortTextWithCode = 'Run:\n```bash\nnpm test\n```';
      const result = classifyResponseContent({ text: shortTextWithCode });

      expect(result.mode).toBe('expanded_response');
      expect(result.sizeClass).toBe('expanded');
      expect(result.isExpanded).toBe(true);
      expect(result.reason).toBe('contains_code_block');
    });

    it('classifies text with markdown table as expanded_response', () => {
      const tableText = 'Results:\n| Metric | Value |\n|---|---|\n| Latency | 200ms |\n';
      const result = classifyResponseContent({ text: tableText });

      expect(result.mode).toBe('expanded_response');
      expect(result.sizeClass).toBe('expanded');
      expect(result.isExpanded).toBe(true);
      expect(result.reason).toBe('contains_table');
    });

    it('classifies multiple source citations as expanded_response', () => {
      const blocks: SurfaceSourceBlock[] = [
        { id: 's1', type: 'source', title: 'Source 1', domain: 'example.com' },
        { id: 's2', type: 'source', title: 'Source 2', domain: 'docs.example.com' }
      ];
      const result = classifyResponseContent({ blocks });

      expect(result.mode).toBe('expanded_response');
      expect(result.sizeClass).toBe('expanded');
      expect(result.isExpanded).toBe(true);
      expect(result.reason).toBe('multiple_sources');
    });

    it('classifies long text exceeding MAX_COMPACT_CHAR_COUNT as expanded_response', () => {
      const longText = 'A'.repeat(MAX_COMPACT_CHAR_COUNT + 10);
      const result = classifyResponseContent({ text: longText });

      expect(result.mode).toBe('expanded_response');
      expect(result.sizeClass).toBe('expanded');
      expect(result.isExpanded).toBe(true);
      expect(result.reason).toContain('character_count_exceeded');
    });

    it('classifies 3 or more paragraphs as expanded_response', () => {
      const multiParagraph = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';
      const result = classifyResponseContent({ text: multiParagraph });

      expect(result.mode).toBe('expanded_response');
      expect(result.sizeClass).toBe('expanded');
      expect(result.isExpanded).toBe(true);
      expect(result.reason).toBe('multiple_paragraphs');
    });

    it('classifies vocabulary card block as compact_response', () => {
      const vocabBlock: SurfaceVocabularyBlock = {
        id: 'v1',
        type: 'vocabulary',
        word: 'ขอบคุณ',
        phonetic: 'khòop-khun',
        translation: 'thank you'
      };
      const result = classifyResponseContent({ blocks: [vocabBlock] });

      expect(result.mode).toBe('compact_response');
      expect(result.sizeClass).toBe('card');
      expect(result.isExpanded).toBe(false);
      expect(result.reason).toBe('contains_vocabulary_block');
    });

    it('classifies confirmation block as confirmation mode with high priority', () => {
      const confBlock: SurfaceConfirmationBlock = {
        id: 'c1',
        type: 'confirmation',
        actionId: 'action-exec',
        title: 'Run Terminal Command?',
        description: 'Command: rm -rf ./tmp',
        risk: 'high',
        confirmLabel: 'Run',
        rejectLabel: 'Cancel'
      };
      const result = classifyResponseContent({ blocks: [confBlock] });

      expect(result.mode).toBe('confirmation');
      expect(result.sizeClass).toBe('card');
      expect(result.priority).toBe('high');
      expect(result.reason).toBe('contains_confirmation_block');
    });

    it('classifies progress block as progress mode', () => {
      const progBlock: SurfaceProgressBlock = {
        id: 'p1',
        type: 'progress',
        taskId: 'build-task',
        label: 'Compiling assets...',
        percentage: 45,
        status: 'running'
      };
      const result = classifyResponseContent({ blocks: [progBlock] });

      expect(result.mode).toBe('progress');
      expect(result.sizeClass).toBe('compact');
      expect(result.reason).toBe('contains_progress_block');
    });
  });

  describe('StreamingResponseClassifier (Stable Promotion Invariant)', () => {
    it('maintains stable promotion: once expanded, stays expanded', () => {
      const classifier = new StreamingResponseClassifier();

      // Chunk 1: Short text -> compact
      let r = classifier.feedChunk('The weather in Bangkok ');
      expect(r.mode).toBe('compact_response');
      expect(r.isExpanded).toBe(false);

      // Chunk 2: More text -> still compact
      r = classifier.feedChunk('is sunny and 32°C. ');
      expect(r.mode).toBe('compact_response');
      expect(r.isExpanded).toBe(false);

      // Chunk 3: Code block starts -> promotes to expanded
      r = classifier.feedChunk('\n```python\nprint("hot")\n```');
      expect(r.mode).toBe('expanded_response');
      expect(r.sizeClass).toBe('expanded');
      expect(r.isExpanded).toBe(true);

      // Chunk 4: Plain short conclusion chunk arrives -> MUST NOT demote back to compact!
      r = classifier.feedChunk('\nStay hydrated!');
      expect(r.mode).toBe('expanded_response');
      expect(r.sizeClass).toBe('expanded');
      expect(r.isExpanded).toBe(true);
    });

    it('resets correctly between turns', () => {
      const classifier = new StreamingResponseClassifier();
      classifier.feedChunk('```typescript\nconst a = 1;\n```');
      expect(classifier.isExpanded()).toBe(true);

      classifier.reset();
      expect(classifier.isExpanded()).toBe(false);
      expect(classifier.getAccumulatedText()).toBe('');

      const fresh = classifier.feedChunk('Short reply.');
      expect(fresh.mode).toBe('compact_response');
      expect(fresh.isExpanded).toBe(false);
    });
  });
});
