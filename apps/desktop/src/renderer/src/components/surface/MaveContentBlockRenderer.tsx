import React, { useState } from 'react';
import type {
  SurfaceContentBlock,
  SurfaceTextBlock,
  SurfaceMarkdownBlock,
  SurfaceCodeBlock,
  SurfaceVocabularyBlock,
  SurfaceStatusBlock,
  SurfaceSourceBlock,
  SurfaceProgressBlock,
  SurfaceConfirmationBlock,
  SurfaceAction
} from '@mave/contracts';
import { MaveMarkdownRenderer } from './MaveMarkdownRenderer';

export interface MaveContentBlockRendererProps {
  blocks: SurfaceContentBlock[];
  onAction?: (action: SurfaceAction) => void;
  className?: string;
}

/**
 * MaveCodeBlockComponent
 * Monospace code presenter with language label, selectable text, and copy affordance.
 */
export const MaveCodeBlockComponent: React.FC<{
  block: SurfaceCodeBlock;
  onAction?: (action: SurfaceAction) => void;
}> = ({ block, onAction }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.({ type: 'copy_text', origin: 'user', text: block.code });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mave-block-code" data-testid="mave-block-code">
      <div className="mave-block-code-header">
        <span className="mave-block-code-lang">
          {block.language || block.filename || 'Code'}
        </span>
        <button
          type="button"
          className="mave-block-code-copy-btn"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code to clipboard'}
          data-testid="mave-code-copy-btn"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <pre className="mave-block-code-pre">
        <code className="mave-block-code-content">{block.code}</code>
      </pre>
    </div>
  );
};

/**
 * MaveVocabularyCardComponent
 * Presentation-only language learning vocabulary card.
 */
export const MaveVocabularyCardComponent: React.FC<{
  block: SurfaceVocabularyBlock;
}> = ({ block }) => {
  return (
    <div className="mave-vocabulary-card" data-testid="mave-vocabulary-card">
      <div className="mave-vocab-header">
        <span className="mave-vocab-word">{block.word}</span>
        {block.phonetic && (
          <span className="mave-vocab-phonetic">{block.phonetic}</span>
        )}
        {block.partOfSpeech && (
          <span className="mave-vocab-pos">{block.partOfSpeech}</span>
        )}
      </div>
      <div className="mave-vocab-translation">{block.translation}</div>
      {block.examples && block.examples.length > 0 && (
        <ul className="mave-vocab-examples">
          {block.examples.map((ex, i) => (
            <li key={i} className="mave-vocab-example-item">
              {ex}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * MaveStatusCardComponent
 * Presentation status block.
 */
export const MaveStatusCardComponent: React.FC<{
  block: SurfaceStatusBlock;
}> = ({ block }) => {
  return (
    <div
      className={`mave-status-card mave-status-card--${block.status}`}
      data-testid="mave-status-card"
    >
      <span className="mave-status-dot" aria-hidden="true" />
      <span className="mave-status-type">[{block.status.toUpperCase()}]</span>
      <span className="mave-status-label">{block.label}</span>
    </div>
  );
};

/**
 * MaveSourceCardComponent
 * Compact research source and citation reference item.
 */
export const MaveSourceCardComponent: React.FC<{
  block: SurfaceSourceBlock;
  onAction?: (action: SurfaceAction) => void;
}> = ({ block, onAction }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (block.url) {
      onAction?.({
        type: 'open_source',
        origin: 'user',
        sourceId: block.id,
        url: block.url
      });
    }
  };

  return (
    <div
      className="mave-source-card"
      onClick={block.url ? handleClick : undefined}
      data-testid="mave-source-card"
      role={block.url ? 'button' : undefined}
      tabIndex={block.url ? 0 : undefined}
    >
      <div className="mave-source-header">
        <span className="mave-source-domain">{block.domain || 'Source'}</span>
        <span className="mave-source-title">{block.title}</span>
      </div>
      {block.snippet && (
        <p className="mave-source-snippet">{block.snippet}</p>
      )}
    </div>
  );
};

/**
 * MaveProgressCardComponent
 * Presentation-only task progress visualization.
 */
export const MaveProgressCardComponent: React.FC<{
  block: SurfaceProgressBlock;
}> = ({ block }) => {
  const isDeterminate = typeof block.percentage === 'number';
  const percentage = isDeterminate
    ? Math.min(Math.max(block.percentage!, 0), 100)
    : undefined;

  return (
    <div className="mave-progress-card" data-testid="mave-progress-card">
      <div className="mave-progress-header">
        <span className="mave-progress-label">{block.label}</span>
        {isDeterminate && (
          <span className="mave-progress-percent">{percentage}%</span>
        )}
      </div>
      <div className="mave-progress-track" role="progressbar" aria-valuenow={percentage}>
        <div
          className={`mave-progress-bar ${!isDeterminate ? 'mave-progress-bar--indeterminate' : ''}`}
          style={isDeterminate ? { width: `${percentage}%` } : undefined}
        />
      </div>
    </div>
  );
};

/**
 * MaveConfirmationCardComponent
 * Presentation-only action confirmation prompt (Level 4 modal foundation).
 */
export const MaveConfirmationCardComponent: React.FC<{
  block: SurfaceConfirmationBlock;
  onAction?: (action: SurfaceAction) => void;
}> = ({ block, onAction }) => {
  const handleApprove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.({
      type: 'confirm_action',
      origin: 'user',
      actionId: block.actionId,
      approved: true
    });
  };

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.({
      type: 'confirm_action',
      origin: 'user',
      actionId: block.actionId,
      approved: false
    });
  };

  return (
    <div
      className={`mave-confirmation-card mave-confirmation--${block.risk}`}
      data-testid="mave-confirmation-card"
    >
      <div className="mave-confirmation-header">
        <span className="mave-confirmation-title">{block.title}</span>
        <span className={`mave-confirmation-risk mave-risk--${block.risk}`}>
          {block.risk.toUpperCase()}
        </span>
      </div>
      <p className="mave-confirmation-desc">{block.description}</p>
      <div className="mave-confirmation-actions">
        <button
          type="button"
          className="mave-confirm-btn mave-confirm-btn--reject"
          onClick={handleReject}
          data-testid="mave-confirm-reject"
        >
          {block.rejectLabel || 'Deny'}
        </button>
        <button
          type="button"
          className="mave-confirm-btn mave-confirm-btn--approve"
          onClick={handleApprove}
          data-testid="mave-confirm-approve"
        >
          {block.confirmLabel || 'Approve'}
        </button>
      </div>
    </div>
  );
};

/**
 * MaveContentBlockRenderer
 * Maps an array of semantic SurfaceContentBlocks into responsive, accessible UI blocks.
 */
export const MaveContentBlockRenderer: React.FC<MaveContentBlockRendererProps> = ({
  blocks,
  onAction,
  className = ''
}) => {
  const handleOpenLink = (url: string) => {
    onAction?.({ type: 'open_link', origin: 'user', url });
  };

  return (
    <div
      className={`mave-content-blocks ${className}`.trim()}
      data-testid="mave-content-blocks"
    >
      {blocks.map((block) => {
        switch (block.type) {
          case 'text':
            return (
              <div key={block.id} className="mave-block-text" data-testid="mave-block-text">
                <p>{(block as SurfaceTextBlock).text}</p>
              </div>
            );

          case 'markdown':
            return (
              <div key={block.id} className="mave-block-markdown" data-testid="mave-block-markdown">
                <MaveMarkdownRenderer
                  markdown={(block as SurfaceMarkdownBlock).markdown}
                  onOpenLink={handleOpenLink}
                />
              </div>
            );

          case 'code':
            return (
              <MaveCodeBlockComponent
                key={block.id}
                block={block as SurfaceCodeBlock}
                onAction={onAction}
              />
            );

          case 'vocabulary':
            return (
              <MaveVocabularyCardComponent
                key={block.id}
                block={block as SurfaceVocabularyBlock}
              />
            );

          case 'status':
            return (
              <MaveStatusCardComponent
                key={block.id}
                block={block as SurfaceStatusBlock}
              />
            );

          case 'source':
            return (
              <MaveSourceCardComponent
                key={block.id}
                block={block as SurfaceSourceBlock}
                onAction={onAction}
              />
            );

          case 'progress':
            return (
              <MaveProgressCardComponent
                key={block.id}
                block={block as SurfaceProgressBlock}
              />
            );

          case 'confirmation':
            return (
              <MaveConfirmationCardComponent
                key={block.id}
                block={block as SurfaceConfirmationBlock}
                onAction={onAction}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
};

