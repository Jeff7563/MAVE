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
  badgeColor = 'var(--mave-faint)',
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

  // Resolve authentic glass styling by intent
  let borderColor = 'var(--mave-edge)';
  let bg = 'var(--mave-glass-gradient)';
  let boxShadow = 'var(--mave-shadow-glass)';

  if (effectiveIntent === 'elevated') {
    borderColor = 'rgba(95, 210, 255, 0.35)';
    bg = 'linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025)), rgba(15, 18, 38, 0.75)';
    boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 24px -4px rgba(91, 132, 255, 0.25), 0 20px 50px -20px rgba(0, 0, 0, 0.7)';
  } else if (effectiveIntent === 'attention') {
    borderColor = 'rgba(255, 196, 107, 0.35)';
    bg = 'linear-gradient(180deg, rgba(255, 196, 107, 0.08), rgba(255, 196, 107, 0.02)), rgba(18, 16, 26, 0.7)';
    boxShadow = 'inset 0 1px 0 rgba(255, 196, 107, 0.12), 0 0 20px -4px rgba(255, 196, 107, 0.25), 0 20px 50px -20px rgba(0, 0, 0, 0.7)';
  } else if (effectiveIntent === 'warning') {
    borderColor = 'rgba(255, 196, 107, 0.35)';
    bg = 'linear-gradient(180deg, rgba(255, 196, 107, 0.06), rgba(255, 196, 107, 0.015)), rgba(18, 16, 26, 0.65)';
    boxShadow = 'inset 0 1px 0 rgba(255, 196, 107, 0.1), 0 16px 40px -16px rgba(0, 0, 0, 0.6)';
  } else if (effectiveIntent === 'destructive') {
    borderColor = 'rgba(255, 122, 133, 0.35)';
    bg = 'linear-gradient(180deg, rgba(255, 122, 133, 0.08), rgba(255, 122, 133, 0.02)), rgba(22, 12, 18, 0.7)';
    boxShadow = 'inset 0 1px 0 rgba(255, 122, 133, 0.1), 0 16px 40px -16px rgba(0, 0, 0, 0.6)';
  } else if (effectiveIntent === 'quiet') {
    borderColor = 'var(--mave-line)';
    bg = 'var(--mave-raised)';
    boxShadow = 'none';
  }

  // Resolve density padding and gap
  let padding = '18px 20px';
  let gap = '12px';
  let bodyFontSize = '14px';
  let borderRadius = '20px';

  if (density === 'compact') {
    padding = '12px 14px';
    gap = '8px';
    bodyFontSize = '13px';
    borderRadius = '16px';
  } else if (density === 'expanded') {
    padding = '24px 26px';
    gap = '16px';
    bodyFontSize = '15px';
    borderRadius = '24px';
  }

  return (
    <div
      id={id}
      className={`mave-v2-card-shell mave-v2-card-${effectiveIntent} mave-v2-card-density-${density} ${highlighted ? 'mave-v2-card-highlighted' : ''} ${attention ? 'mave-v2-card-attention' : ''} ${className}`.trim()}
      style={{
        background: bg,
        backdropFilter: 'var(--mave-backdrop-glass)',
        WebkitBackdropFilter: 'var(--mave-backdrop-glass)',
        border: `1px solid ${borderColor}`,
        borderRadius,
        padding,
        boxShadow,
        display: 'flex',
        flexDirection: 'column',
        gap,
        transition: 'border-color 200ms ease, box-shadow 200ms ease, background-color 200ms ease, opacity 200ms ease',
        animation: 'mave-card-enter 350ms cubic-bezier(0.25, 1, 0.5, 1)',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        color: 'var(--mave-ink)',
        fontFamily: 'var(--mave-font-sans)'
      }}
      data-testid="card-shell"
      data-intent={effectiveIntent}
      data-density={density}
    >
      {/* Header Metadata (Fixed, no horizontal scroll, shrink-safe) */}
      {(badge || title || timestamp || expandable) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: density === 'compact' ? '11px' : '12px',
            lineHeight: 1.2,
            minWidth: 0,
            width: '100%',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0, flex: '1 1 auto' }}>
            {badge && (
              <span
                style={{
                  color: badgeColor,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--mave-line)',
                  padding: density === 'compact' ? '2px 6px' : '3px 8px',
                  borderRadius: '6px',
                  fontFamily: 'var(--mave-font-mono)',
                  fontSize: density === 'compact' ? '10px' : '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  flexShrink: 0
                }}
              >
                {badge}
              </span>
            )}
            {title && (
              <span
                style={{
                  color: 'var(--mave-dim)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0
                }}
                title={title}
              >
                {title}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, minWidth: 0 }}>
            {timestamp && (
              <span style={{ color: 'var(--mave-faint)', fontSize: '11px', fontFamily: 'var(--mave-font-mono)', whiteSpace: 'nowrap' }}>
                {timestamp}
              </span>
            )}
            {expandable && (
              <button
                onClick={onToggleExpand}
                aria-label={expanded ? 'Collapse detail' : 'Expand detail'}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--mave-line)',
                  color: 'var(--mave-dim)',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  fontSize: '11px',
                  borderRadius: '6px',
                  fontFamily: 'var(--mave-font-mono)',
                  whiteSpace: 'nowrap',
                  transition: 'color 150ms ease, border-color 150ms ease'
                }}
                data-testid="card-expand-toggle"
              >
                {expanded ? '▲ Less' : '▼ More'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Primary Content Body (Constrained to card width) */}
      <div
        style={{
          color: 'var(--mave-ink)',
          fontSize: bodyFontSize,
          lineHeight: 1.5,
          minWidth: 0,
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {children}
      </div>

      {/* Expandable Details Slot (Progressive Disclosure) */}
      {expandable && expanded && detailsSlot && (
        <div
          style={{
            paddingTop: '10px',
            borderTop: '1px solid var(--mave-line)',
            fontSize: density === 'compact' ? '12px' : '13px',
            color: 'var(--mave-dim)',
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box'
          }}
          data-testid="card-details-slot"
        >
          {detailsSlot}
        </div>
      )}

      {/* Action Footer (Fixed, no horizontal scroll) */}
      {actions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '2px',
            paddingTop: '10px',
            borderTop: '1px solid var(--mave-line)',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
};
