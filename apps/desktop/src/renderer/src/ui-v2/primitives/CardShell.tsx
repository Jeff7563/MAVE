import React from 'react';
import '../tokens.css';

export interface CardShellProps {
  id?: string;
  badge?: string;
  badgeColor?: string;
  title?: string;
  timestamp?: string;
  highlighted?: boolean;
  attention?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * CardShell
 *
 * Unified card container for all MAVE UI V2 cards (Messages, Sources, Video, Tasks, Approvals).
 * Features:
 * - Subdued, resting background with elevation
 * - Subtle border with controlled semantic glow when active or requiring attention
 * - Distinct metadata header slot and actions footer slot
 */
export const CardShell: React.FC<CardShellProps> = ({
  id,
  badge,
  badgeColor = 'var(--mave-v2-text-muted)',
  title,
  timestamp,
  highlighted = false,
  attention = false,
  actions,
  children,
  className = ''
}) => {
  return (
    <div
      id={id}
      className={`mave-v2-card-shell ${highlighted ? 'mave-v2-card-highlighted' : ''} ${attention ? 'mave-v2-card-attention' : ''} ${className}`.trim()}
      style={{
        background: 'var(--mave-v2-surface-elevated)',
        border: attention
          ? '1px solid var(--mave-v2-accent-warning)'
          : highlighted
          ? '1px solid var(--mave-v2-border-focused)'
          : '1px solid var(--mave-v2-border-subtle)',
        borderRadius: 'var(--mave-v2-radius-card)',
        padding: '12px 14px',
        boxShadow: attention
          ? 'var(--mave-v2-glow-attention)'
          : highlighted
          ? 'var(--mave-v2-glow-active)'
          : '0 4px 12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'all var(--mave-v2-motion-normal)',
        boxSizing: 'border-box',
        width: '100%'
      }}
      data-testid="card-shell"
    >
      {/* Header Metadata */}
      {(badge || title || timestamp) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            lineHeight: 1.2
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {badge && (
              <span
                style={{
                  color: badgeColor,
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 6px',
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
          {timestamp && (
            <span style={{ color: 'var(--mave-v2-text-dim)', fontSize: '10px' }}>
              {timestamp}
            </span>
          )}
        </div>
      )}

      {/* Primary Content Body */}
      <div style={{ color: 'var(--mave-v2-text-primary)', fontSize: '13px', lineHeight: 1.5 }}>
        {children}
      </div>

      {/* Action Footer */}
      {actions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '4px',
            paddingTop: '6px',
            borderTop: '1px solid var(--mave-v2-border-subtle)',
            justifyContent: 'flex-end'
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
};

