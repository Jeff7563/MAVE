import React from 'react';
import type { PresenceState, QuickResponseData } from '../types';
import { AdaptivePresenceMark } from '../primitives/AdaptivePresenceMark';
import '../tokens.css';

export interface PresenceSurfaceProps {
  state?: PresenceState;
  audioLevel?: number;
  quickResponse?: QuickResponseData;
  onExpand?: () => void;
  onWakeToggle?: () => void;
  className?: string;
}

/**
 * PresenceSurface
 *
 * Level 1 Minimal Ambient Surface.
 * Sits quietly in the workspace or desktop corner, occupying minimal screen space.
 * Expands a temporary quick response bubble above it when a short answer is spoken/available.
 */
export const PresenceSurface: React.FC<PresenceSurfaceProps> = ({
  state = 'idle',
  audioLevel = 0,
  quickResponse,
  onExpand,
  onWakeToggle,
  className = ''
}) => {
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';
  const isError = state === 'error';

  const stateLabel =
    state === 'idle'
      ? 'MAVE'
      : state === 'waking'
      ? 'Waking…'
      : state === 'listening'
      ? 'Listening…'
      : state === 'thinking'
      ? 'Thinking…'
      : state === 'speaking'
      ? 'Speaking…'
      : 'Error';

  return (
    <div
      className={`mave-v2-presence-wrapper ${className}`.trim()}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
        position: 'relative',
        userSelect: 'none'
      }}
      data-testid="presence-surface"
      data-state={state}
    >
      {/* Quick Response Bubble (appears above capsule when available) */}
      {quickResponse && (
        <div
          style={{
            maxWidth: '320px',
            background: 'var(--mave-v2-surface-elevated)',
            border: '1px solid var(--mave-v2-border-subtle)',
            borderRadius: 'var(--mave-v2-radius-card)',
            padding: '10px 14px',
            boxShadow: 'var(--mave-v2-glow-active)',
            color: 'var(--mave-v2-text-primary)',
            fontSize: '13px',
            lineHeight: 1.4,
            animation: 'mave-v2-breathe 4s ease-in-out infinite'
          }}
          data-testid="presence-quick-response"
        >
          <div>{quickResponse.text}</div>
          {quickResponse.sourceLabel && (
            <div
              style={{
                fontSize: '10px',
                color: 'var(--mave-v2-text-dim)',
                marginTop: '4px',
                textAlign: 'right'
              }}
            >
              {quickResponse.sourceLabel}
            </div>
          )}
        </div>
      )}

      {/* Main Ambient Capsule */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--mave-v2-surface-resting)',
          backdropFilter: 'blur(var(--mave-v2-blur))',
          WebkitBackdropFilter: 'blur(var(--mave-v2-blur))',
          border: isError
            ? '1px solid var(--mave-v2-accent-error)'
            : isListening || isSpeaking
            ? '1px solid var(--mave-v2-accent-listening)'
            : isThinking
            ? '1px solid var(--mave-v2-accent-thinking)'
            : '1px solid var(--mave-v2-border-subtle)',
          borderRadius: 'var(--mave-v2-radius-pill)',
          padding: '6px 14px 6px 8px',
          boxShadow: isListening || isSpeaking
            ? 'var(--mave-v2-glow-active)'
            : isThinking
            ? 'var(--mave-v2-glow-thinking)'
            : '0 4px 16px rgba(0, 0, 0, 0.4)',
          transition: 'all var(--mave-v2-motion-normal)',
          height: '38px',
          boxSizing: 'border-box'
        }}
      >
        {/* Presence Mark / Orb */}
        <AdaptivePresenceMark
          state={state}
          size="compact"
          audioLevel={audioLevel}
          onClick={onWakeToggle}
        />

        {/* State Label */}
        <span
          style={{
            fontWeight: 600,
            fontSize: '13px',
            color: isError
              ? 'var(--mave-v2-accent-error)'
              : isThinking
              ? 'var(--mave-v2-accent-thinking)'
              : isListening
              ? 'var(--mave-v2-accent-listening)'
              : 'var(--mave-v2-text-primary)',
            letterSpacing: '0.2px'
          }}
        >
          {stateLabel}
        </span>

        {/* Expand to Conversation Button */}
        {onExpand && (
          <button
            onClick={onExpand}
            title="Expand to Conversation"
            aria-label="Expand to Conversation"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--mave-v2-text-muted)',
              cursor: 'pointer',
              padding: '2px 4px',
              marginLeft: '4px',
              fontSize: '13px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color var(--mave-v2-motion-fast)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mave-v2-text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mave-v2-text-muted)')}
          >
            ↗
          </button>
        )}
      </div>
    </div>
  );
};

