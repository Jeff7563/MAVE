import React from 'react';
import type { SurfaceSnapshot, SurfaceAction } from '@mave/contracts';
import { PresenceMark } from './PresenceMark';
import { MaveCompactResponse } from './MaveCompactResponse';
import { MaveExpandedPanel } from './MaveExpandedPanel';

export interface MaveCapsuleProps {
  snapshot: SurfaceSnapshot;
  onAction?: (action: SurfaceAction) => void;
  onHoverChange?: (isHovering: boolean) => void;
  className?: string;
}

/**
 * Maps runtime surface states to polite, calm product-facing descriptors.
 * Note: Never exposes technical runtime terms like "sleeping" or "transcribing".
 */
function getProductStatusText(mode: SurfaceSnapshot['mode']): string | null {
  switch (mode) {
    case 'ambient':
      return 'Ready';
    case 'listening':
      return 'Listening...';
    case 'thinking':
      return 'Thinking...';
    case 'speaking':
      return 'Speaking...';
    case 'error':
      return 'Something went wrong';
    case 'compact_response':
    case 'expanded_response':
      return null;
    default:
      return null;
  }
}

/**
 * MaveCapsule
 *
 * Production Adaptive Surface component representing MAVE's continuous visual identity.
 * Smoothly morphs across discrete native size envelopes (ambient/compact, card, expanded)
 * using CSS hardware-accelerated transitions while anchoring PresenceMark and brand controls.
 */
export const MaveCapsule: React.FC<MaveCapsuleProps> = ({
  snapshot,
  onAction,
  onHoverChange,
  className = ''
}) => {
  const statusText = getProductStatusText(snapshot.mode);
  const statusModifier = `mave-capsule-status--${snapshot.mode}`;

  const isCardOrExpanded =
    snapshot.sizeClass === 'card' ||
    snapshot.sizeClass === 'expanded' ||
    snapshot.mode === 'compact_response' ||
    snapshot.mode === 'expanded_response';

  const isResponseMode =
    snapshot.mode === 'compact_response' || snapshot.mode === 'expanded_response';

  const handleMouseEnter = () => {
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    onHoverChange?.(false);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.({ type: 'dismiss', origin: 'user' });
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.({ type: 'toggle_pin', origin: 'user' });
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.({ type: 'expand', origin: 'user' });
  };

  const handleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.({ type: 'collapse', origin: 'user' });
  };

  const handleRequestFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.({ type: 'request_focus', origin: 'user' });
  };

  return (
    <div
      className={`mave-surface-container mave-capsule ${isResponseMode ? 'mave-response-placeholder' : ''} ${className}`.trim()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="mave-capsule"
      data-mode={snapshot.mode}
      data-size={snapshot.sizeClass}
      role="region"
      aria-label="MAVE Assistant"
    >
      <div className="mave-capsule-header">
        {/* 1. Luminous Presence Mark (Informational / Decorative) */}
        <PresenceMark
          mode={snapshot.mode}
          inputLevel={snapshot.inputLevel}
          outputLevel={snapshot.outputLevel}
        />

        {/* 2. Primary Brand Label */}
        <span className="mave-capsule-brand" data-testid="mave-brand-label">
          MAVE
        </span>

        {/* 3. Divider & Status Descriptor */}
        {statusText && (
          <>
            <span className="mave-capsule-dot" aria-hidden="true" />
            <span
              className={`mave-capsule-status ${statusModifier}`}
              data-testid="mave-status-text"
            >
              {statusText}
            </span>
          </>
        )}

        {/* 4. Action Controls Slot (reveals on hover/focus or card/expanded) */}
        <div className="mave-capsule-actions" role="toolbar" aria-label="Surface actions">
          {/* Explicit Keyboard Navigation Affordance */}
          <button
            type="button"
            className="mave-capsule-action-btn"
            onClick={handleRequestFocus}
            aria-label="Focus MAVE keyboard navigation"
            title="Focus MAVE keyboard navigation"
            data-testid="mave-action-focus"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="6" y1="8" x2="6.01" y2="8" />
              <line x1="10" y1="8" x2="10.01" y2="8" />
              <line x1="14" y1="8" x2="14.01" y2="8" />
              <line x1="18" y1="8" x2="18.01" y2="8" />
              <line x1="6" y1="12" x2="6.01" y2="12" />
              <line x1="18" y1="12" x2="18.01" y2="12" />
              <line x1="9" y1="16" x2="15" y2="16" />
            </svg>
          </button>

          {/* Adaptive Expand / Collapse Action */}
          {snapshot.sizeClass === 'expanded' ? (
            <button
              type="button"
              className="mave-capsule-action-btn"
              onClick={handleCollapse}
              aria-label="Collapse MAVE"
              title="Collapse MAVE"
              data-testid="mave-action-collapse"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="10" y1="14" x2="3" y2="21" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="mave-capsule-action-btn"
              onClick={handleExpand}
              aria-label="Expand MAVE"
              title="Expand MAVE"
              data-testid="mave-action-expand"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          )}

          <button
            type="button"
            className="mave-capsule-action-btn"
            onClick={handleTogglePin}
            aria-label={snapshot.pinned ? 'Unpin MAVE' : 'Pin MAVE'}
            title={snapshot.pinned ? 'Unpin MAVE' : 'Pin MAVE'}
            data-testid="mave-action-pin"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={snapshot.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M12 17v5M5 12V7a5 5 0 0 1 10 0v5l2 3H3l2-3z" />
            </svg>
          </button>

          <button
            type="button"
            className="mave-capsule-action-btn"
            onClick={handleDismiss}
            aria-label="Dismiss MAVE"
            title="Dismiss MAVE"
            data-testid="mave-action-dismiss"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* 5. Adaptive Secondary Body Content Slot */}
      {isCardOrExpanded && (
        <div
          className="mave-surface-body"
          data-testid={snapshot.sizeClass === 'expanded' ? 'mave-expanded-card' : 'mave-response-card'}
        >
          {snapshot.sizeClass === 'expanded' ? (
            <MaveExpandedPanel
              snapshot={snapshot}
              onAction={onAction}
            />
          ) : (
            <MaveCompactResponse
              snapshot={snapshot}
              onAction={onAction}
            />
          )}
        </div>
      )}
    </div>
  );
};
