import React from 'react';
import type {
  SurfaceSnapshot,
  SurfaceAction,
  SurfaceVocabularyBlock,
  SurfaceStatusBlock
} from '@mave/contracts';

export interface MaveCompactResponseProps {
  snapshot: SurfaceSnapshot;
  onAction?: (action: SurfaceAction) => void;
  className?: string;
}

/**
 * MaveCompactResponse
 *
 * Production Quick Response presentation surface component.
 * Renders concise, glanceable assistant responses directly on the desktop
 * without opening a large application window.
 *
 * Supports:
 * - Plain streamed assistant text with safe word wrapping and line clamping
 * - Compact vocabulary cards (language learning)
 * - Concise status descriptors (short system feedback)
 * - Text selection without focus stealing
 * - Polite accessibility semantics without screen-reader spam
 */
export const MaveCompactResponse: React.FC<MaveCompactResponseProps> = React.memo(({
  snapshot,
  onAction,
  className = ''
}) => {
  const vocabularyBlock = snapshot.content?.find(
    (b): b is SurfaceVocabularyBlock => b.type === 'vocabulary'
  );

  const statusBlock = snapshot.content?.find(
    (b): b is SurfaceStatusBlock => b.type === 'status'
  );

  const rawText =
    snapshot.assistantText ||
    snapshot.content?.find((b) => b.type === 'text')?.text ||
    '';

  const isLongText = rawText.length > 160 || rawText.split('\n').length >= 4;

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.({ type: 'expand', origin: 'user' });
  };

  // 1. Vocabulary Card Variant (Language Learning / Translation)
  if (vocabularyBlock) {
    return (
      <div
        className={`mave-compact-response mave-vocabulary-card ${className}`.trim()}
        data-testid="mave-vocabulary-card"
        role="region"
        aria-label="Vocabulary Definition"
      >
        <div className="mave-vocab-header">
          <span className="mave-vocab-word">{vocabularyBlock.word}</span>
          {vocabularyBlock.phonetic && (
            <span className="mave-vocab-phonetic">/{vocabularyBlock.phonetic}/</span>
          )}
          {vocabularyBlock.partOfSpeech && (
            <span className="mave-vocab-pos">{vocabularyBlock.partOfSpeech}</span>
          )}
        </div>
        <div className="mave-vocab-translation" role="status">
          {vocabularyBlock.translation}
        </div>
        {vocabularyBlock.examples && vocabularyBlock.examples.length > 0 && (
          <div className="mave-vocab-example">
            &ldquo;{vocabularyBlock.examples[0]}&rdquo;
          </div>
        )}
      </div>
    );
  }

  // 2. Status Block Variant (Short system feedback / Timer set / Saved)
  if (statusBlock) {
    return (
      <div
        className={`mave-compact-response mave-status-card mave-status-card--${statusBlock.status} ${className}`.trim()}
        data-testid="mave-status-card"
        role="status"
        aria-label={statusBlock.label}
      >
        <div className="mave-status-indicator" aria-hidden="true" />
        <span className="mave-status-label">{statusBlock.label}</span>
      </div>
    );
  }

  // 3. Primary Response Text Variant
  if (!rawText.trim()) {
    return null;
  }

  return (
    <div
      className={`mave-compact-response ${className}`.trim()}
      data-testid="mave-compact-response"
    >
      <div
        className="mave-response-text"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="mave-response-text"
      >
        {rawText}
      </div>

      {isLongText && snapshot.sizeClass === 'card' && (
        <div className="mave-response-overflow-affordance">
          <div className="mave-response-fade-overlay" aria-hidden="true" />
          <button
            type="button"
            className="mave-response-expand-hint"
            onClick={handleExpand}
            title="Expand to read full answer"
            aria-label="Expand response"
            data-testid="mave-response-expand-hint"
          >
            <span>More</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
});

MaveCompactResponse.displayName = 'MaveCompactResponse';

