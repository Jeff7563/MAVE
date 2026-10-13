import type {
  SurfaceContentBlock,
  SurfaceMode,
  SurfaceSizeClass,
  SurfacePriority
} from '@mave/contracts';

export interface ClassificationResult {
  mode: SurfaceMode;
  sizeClass: SurfaceSizeClass;
  priority: SurfacePriority;
  blocks: SurfaceContentBlock[];
  isExpanded: boolean;
  reason: string;
}

export const MAX_COMPACT_CHAR_COUNT = 280;

/**
 * Regex to detect markdown fenced code blocks (complete or incomplete during streaming).
 */
const CODE_BLOCK_REGEX = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)(?:```|$)/g;

/**
 * Regex to detect markdown tables (| header | header | \n | --- | --- |).
 */
const TABLE_REGEX = /(?:^|\n)\|[^\n]+\|\n\|(?:\s*[:-]+[-| :]*)\|\n/m;

/**
 * Parses raw text into semantic SurfaceContentBlocks (separating code blocks from prose).
 */
export function parseContentBlocks(rawText: string): SurfaceContentBlock[] {
  if (!rawText || rawText.trim().length === 0) {
    return [];
  }

  if (!rawText.includes('```')) {
    return [
      {
        id: 'block-1',
        type: 'text',
        text: rawText
      }
    ];
  }

  const blocks: SurfaceContentBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(CODE_BLOCK_REGEX.source, 'g');

  while ((match = regex.exec(rawText)) !== null) {
    const textBefore = rawText.slice(lastIndex, match.index).trim();
    if (textBefore.length > 0) {
      blocks.push({
        id: `block-${blocks.length + 1}`,
        type: 'markdown',
        markdown: textBefore
      });
    }

    const language = match[1]?.trim() || undefined;
    const code = match[2] || '';
    blocks.push({
      id: `block-${blocks.length + 1}`,
      type: 'code',
      language: language || undefined,
      code
    });

    lastIndex = match.index + match[0].length;
  }

  const trailingText = rawText.slice(lastIndex).trim();
  if (trailingText.length > 0) {
    blocks.push({
      id: `block-${blocks.length + 1}`,
      type: 'markdown',
      markdown: trailingText
    });
  }

  return blocks;
}

/**
 * Deterministically classifies response content by semantics over raw character count.
 */
export function classifyResponseContent(input: {
  text?: string;
  blocks?: SurfaceContentBlock[];
  priority?: SurfacePriority;
}): ClassificationResult {
  const blocks = input.blocks && input.blocks.length > 0
    ? input.blocks
    : input.text
    ? parseContentBlocks(input.text)
    : [];

  const text = input.text || blocks.map((b) => {
    if (b.type === 'text') return b.text;
    if (b.type === 'markdown') return b.markdown;
    if (b.type === 'code') return b.code;
    return '';
  }).join('\n');

  // 1. Check for confirmation modal block (Level 4 / permission)
  const confirmationBlock = blocks.find((b) => b.type === 'confirmation');
  if (confirmationBlock) {
    return {
      mode: 'confirmation',
      sizeClass: 'card',
      priority: input.priority || 'high',
      blocks,
      isExpanded: false,
      reason: 'contains_confirmation_block'
    };
  }

  // 2. Check for progress block (M5 background task)
  const progressBlock = blocks.find((b) => b.type === 'progress');
  if (progressBlock) {
    return {
      mode: 'progress',
      sizeClass: 'compact',
      priority: input.priority || 'normal',
      blocks,
      isExpanded: false,
      reason: 'contains_progress_block'
    };
  }

  // 3. Check for vocabulary card block (Language learning)
  const vocabularyBlock = blocks.find((b) => b.type === 'vocabulary');
  if (vocabularyBlock) {
    return {
      mode: 'compact_response',
      sizeClass: 'card',
      priority: input.priority || 'normal',
      blocks,
      isExpanded: false,
      reason: 'contains_vocabulary_block'
    };
  }

  // 3b. Check for status block (Short acknowledgement / system status)
  const statusBlock = blocks.find((b) => b.type === 'status');
  if (statusBlock) {
    return {
      mode: 'compact_response',
      sizeClass: 'card',
      priority: input.priority || 'normal',
      blocks,
      isExpanded: false,
      reason: 'contains_status_block'
    };
  }

  // 4. Check for code blocks
  const hasCodeBlock = blocks.some((b) => b.type === 'code') || text.includes('```');
  if (hasCodeBlock) {
    return {
      mode: 'expanded_response',
      sizeClass: 'expanded',
      priority: input.priority || 'normal',
      blocks,
      isExpanded: true,
      reason: 'contains_code_block'
    };
  }

  // 5. Check for structured tables
  if (TABLE_REGEX.test(text)) {
    return {
      mode: 'expanded_response',
      sizeClass: 'expanded',
      priority: input.priority || 'normal',
      blocks,
      isExpanded: true,
      reason: 'contains_table'
    };
  }

  // 6. Check for multiple citations / sources
  const sourceCount = blocks.filter((b) => b.type === 'source').length;
  if (sourceCount >= 2) {
    return {
      mode: 'expanded_response',
      sizeClass: 'expanded',
      priority: input.priority || 'normal',
      blocks,
      isExpanded: true,
      reason: 'multiple_sources'
    };
  }

  // 7. Check length thresholds & paragraph density
  const trimmed = text.trim();
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  if (trimmed.length > MAX_COMPACT_CHAR_COUNT) {
    return {
      mode: 'expanded_response',
      sizeClass: 'expanded',
      priority: input.priority || 'normal',
      blocks,
      isExpanded: true,
      reason: `character_count_exceeded_${trimmed.length}`
    };
  }

  if (paragraphs.length >= 3) {
    return {
      mode: 'expanded_response',
      sizeClass: 'expanded',
      priority: input.priority || 'normal',
      blocks,
      isExpanded: true,
      reason: 'multiple_paragraphs'
    };
  }

  // 8. Default to compact response card (Level 2 Quick Info)
  return {
    mode: 'compact_response',
    sizeClass: 'card',
    priority: input.priority || 'normal',
    blocks,
    isExpanded: false,
    reason: 'compact_prose'
  };
}

/**
 * Stateful streaming classifier providing stable promotion invariants.
 *
 * STABLE PROMOTION INVARIANT:
 * Once a streaming response is classified as 'expanded_response' (due to code blocks,
 * length, or structure), it NEVER demotes back to 'compact_response' during the same turn.
 */
export class StreamingResponseClassifier {
  private accumulatedText = '';
  private isPromotedToExpanded = false;
  private currentBlocks: SurfaceContentBlock[] = [];
  private lastResult: ClassificationResult | null = null;

  public feedChunk(chunk: string): ClassificationResult {
    this.accumulatedText += chunk;
    const classified = classifyResponseContent({ text: this.accumulatedText });

    if (classified.isExpanded || this.isPromotedToExpanded) {
      this.isPromotedToExpanded = true;
      classified.mode = 'expanded_response';
      classified.sizeClass = 'expanded';
      classified.isExpanded = true;
      if (!classified.reason.startsWith('contains_code') && !classified.reason.startsWith('character_count')) {
        classified.reason = 'stable_streaming_promotion';
      }
    }

    this.currentBlocks = classified.blocks;
    this.lastResult = classified;
    return classified;
  }

  public getAccumulatedText(): string {
    return this.accumulatedText;
  }

  public getBlocks(): SurfaceContentBlock[] {
    return [...this.currentBlocks];
  }

  public isExpanded(): boolean {
    return this.isPromotedToExpanded;
  }

  public getCurrentResult(): ClassificationResult {
    if (this.lastResult) {
      return this.lastResult;
    }
    return classifyResponseContent({ text: this.accumulatedText });
  }

  public reset(): void {
    this.accumulatedText = '';
    this.isPromotedToExpanded = false;
    this.currentBlocks = [];
    this.lastResult = null;
  }
}
