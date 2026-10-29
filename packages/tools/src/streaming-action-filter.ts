import { stripActionBlocksForDisplay } from './action-protocol.js';

const FENCE = '```mave-action';

/**
 * Removes ```mave-action blocks from a stream of text deltas so they are never
 * shown or spoken, while keeping normal text flowing with minimal delay.
 */
export class StreamingActionFilter {
  private full = '';
  private emitted = '';

  /** Feed a raw delta, get the visible text to emit now ('' if nothing yet). */
  push(delta: string): string {
    this.full += delta;
    let visible = stripActionBlocksForDisplay(this.full);
    // Hold back a trailing partial fence like "`", "``" or "```mave-ac".
    const hold = partialFenceSuffix(this.full);
    if (hold > 0 && visible.length === this.full.trimEnd().length) {
      visible = this.full.slice(0, this.full.length - hold);
    }
    if (!visible.startsWith(this.emitted)) {
      return '';
    }
    const out = visible.slice(this.emitted.length);
    this.emitted = visible;
    return out;
  }

  get rawText(): string {
    return this.full;
  }
}

function partialFenceSuffix(text: string): number {
  const max = Math.min(FENCE.length - 1, text.length);
  for (let len = max; len > 0; len--) {
    if (FENCE.startsWith(text.slice(-len))) return len;
  }
  return 0;
}
