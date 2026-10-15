import React from 'react';
import type { CardIntent, CardDensity } from '../types';
import '../tokens.css';

export interface CardShellProps {
  id?: string;
  badge?: string;
  badgeColor?: string;
  title?: string;
  timestamp?: string;
  highlighted?: boolean;
  attention?: boolean;
  intent?: CardIntent;
  density?: CardDensity;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  detailsSlot?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * CardShell
 *
 * Unified card container for all MAVE UI V2 cards (Messages, Sources, Video, Tasks, Approvals, Diff, Comparison).
 * Features:
 * - Content-first structure without nested bounding box overload
 * - Intent-based semantic emphasis (default, elevated, attention, warning, destructive, quiet)
 * - Density scaling (compact, standard, expanded)
 * - Built-in progressive disclosure (expandable details)
 * - Safe text rendering
 */
export const CardShell: React.FC<CardShellProps> = ({
  id,
  badge,
  badgeColor = 'var(--mave-v2-text-muted)',
  title,
  timestamp,
  highlighted = false,
  attention = false,
  intent = 'default',
  density = 'standard',
  expandable = false,
  expanded = false,
  onToggleExpand,
  detailsSlot,
  actions,
  children,
  className = ''
}) => {
  // Resolve effective intent (backwards compatible with attention/highlighted props)
  const effectiveIntent: CardIntent = attention
    ? 'attention'
    : highlighted
    ? 'elevated'
    : intent;

  // Resolve styles by intent
  let borderColor = 'var(--mave-v2-border-subtle)';
  let bg = 'var(--mave-v2-surface-elevated)';
  let boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';

  if (effectiveIntent === 'elevated') {
    borderColor = 'var(--mave-v2-border-focused)';
    bg = 'var(--mave-v2-surface-elevated)';
    boxShadow = 'var(--mave-v2-glow-active)';
  } else if (effectiveIntent === 'attention') {
    borderColor = 'var(--mave-v2-accent-warning)';
    bg = 'rgba(245, 158, 11, 0.04)';
    boxShadow = 'var(--mave-v2-glow-attention)';
  } else if (effectiveIntent === 'warning') {
    borderColor = 'var(--mave-v2-accent-warning)';
    bg = 'rgba(245, 158, 11, 0.06)';
  } else if (effectiveIntent === 'destructive') {
    borderColor = 'rgba(239, 68, 68, 0.4)';
    bg = 'rgba(239, 68, 68, 0.04)';
  } else if (effectiveIntent === 'quiet') {
    borderColor = 'rgba(255, 255, 255, 0.04)';
    bg = 'rgba(255, 255, 255, 0.02)';
    boxShadow = 'none';
  }

  // Resolve density padding and gap
  let padding = '12px 14px';
  let gap = '8px';
  let bodyFontSize = '13px';

  if (density === 'compact') {
    padding = '8px 10px';
    gap = '6px';
    bodyFontSize = '12px';
  } else if (density === 'expanded') {
    padding = '16px 18px';
    gap = '12px';
    bodyFontSize = '14px';
  }

  return (
    <div
      id={id}
      className={`mave-v2-card-shell mave-v2-card-${effectiveIntent} mave-v2-card-density-${density} ${highlighted ? 'mave-v2-card-highlighted' : ''} ${attention ? 'mave-v2-card-attention' : ''} ${className}`.trim()}
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--mave-v2-radius-card)',
        padding,
        boxShadow,
        display: 'flex',
        flexDirection: 'column',
        gap,
        transition: 'all var(--mave-v2-motion-normal)',
        boxSizing: 'border-box',
        width: '100%',
        color: 'var(--mave-v2-text-primary)'
      }}
      data-testid="card-shell"
      data-intent={effectiveIntent}
      data-density={density}
    >
      {/* Header Metadata */}
      {(badge || title || timestamp || expandable) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: density === 'compact' ? '10px' : '11px',
            lineHeight: 1.2
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {badge && (
              <span
                style={{
                  color: badgeColor,
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: density === 'compact' ? '1px 5px' : '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px'
                }}
              >
                {badge}
              </span>
            )}
            {title && (
              <span
                style={{
                  color: 'var(--mave-v2-text-secondary)',
                  fontWeight: 500
                }}
              >
                {title}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {timestamp && (
              <span style={{ color: 'var(--mave-v2-text-dim)', fontSize: '10px' }}>
                {timestamp}
              </span>
            )}
            {expandable && (
              <button
                onClick={onToggleExpand}
                aria-label={expanded ? 'Collapse detail' : 'Expand detail'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--mave-v2-text-muted)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontSize: '11px',
                  borderRadius: '3px'
                }}
                data-testid="card-expand-toggle"
              >
                {expanded ? '▲ Less' : '▼ More'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Primary Content Body */}
      <div style={{ color: 'var(--mave-v2-text-primary)', fontSize: bodyFontSize, lineHeight: 1.5 }}>
        {children}
      </div>

      {/* Expandable Details Slot (Progressive Disclosure) */}
      {expandable && expanded && detailsSlot && (
        <div
          style={{
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            fontSize: density === 'compact' ? '11px' : '12px',
            color: 'var(--mave-v2-text-secondary)'
          }}
          data-testid="card-details-slot"
        >
          {detailsSlot}
        </div>
      )}

      {/* Action Footer */}
      {actions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '2px',
            paddingTop: '6px',
            borderTop: '1px solid var(--mave-v2-border-subtle)',
            justifyContent: 'flex-end',
            flexWrap: 'wrap'
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
};
