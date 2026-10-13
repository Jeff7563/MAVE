import React from 'react';
import type { SurfaceSnapshot, SurfaceAction } from '@mave/contracts';
import { PresenceMark } from './PresenceMark';

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
 * Production Compact Capsule component representing MAVE's visual identity.
 * Operates cleanly within the 280x80 DIP native envelope with high-radius geometry,
 * frosted glass styling, and calm, non-distracting resting behavior.
 */
export const MaveCapsule: React.FC<MaveCapsuleProps> = ({
  snapshot,
  onAction,
  onHoverChange,
  className = ''
}) => {
  const statusText = getProductStatusText(snapshot.mode);
  const statusModifier = `mave-capsule-status--${snapshot.mode}`;

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

  return (
    <div
      className={`mave-capsule ${className}`.trim()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="mave-capsule"
      data-mode={snapshot.mode}
      role="region"
      aria-label="MAVE Assistant"
    >
      {/* 1. Luminous Presence Mark */}
      <PresenceMark mode={snapshot.mode} />

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

      {/* 4. Action Controls Slot (reveals on hover/focus) */}
      <div className="mave-capsule-actions" role="toolbar" aria-label="Surface actions">
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
  );
};
