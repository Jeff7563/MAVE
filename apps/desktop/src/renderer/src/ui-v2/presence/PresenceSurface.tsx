import React, { useState } from 'react';
import type { PresenceState, QuickResponseData } from '../types';
import { AdaptivePresenceMark } from '../primitives/AdaptivePresenceMark';
import { getPresenceButtonDescriptor, sanitizeQuickResponseSource } from './presence-rules';
import '../tokens.css';

export interface PresenceSurfaceProps {
  state?: PresenceState;
  audioLevel?: number;
  quickResponse?: QuickResponseData;
  officeMode?: boolean;
  errorMessage?: string;
  onExpand?: () => void;
  onWakeToggle?: () => void;
  onManualActivate?: () => void;
  onStopListening?: () => void;
  onCancelThinking?: () => void;
  onStopSpeaking?: () => void;
  onRetryError?: () => void;
  onDismissError?: () => void;
  onDismissQuickResponse?: () => void;
  className?: string;
}

/**
 * PresenceSurface
 *
 * Level 1 Minimal Ambient Surface (U1 Interaction Foundation).
 * Sits quietly in the workspace or desktop corner, occupying minimal screen space.
 *
 * Canonical Interaction Hierarchy:
 * - Idle: [MAVE] (Quiet, minimal, recognizable wordmark, zero glow, no "IDLE" label)
 * - Waking: [• MAVE | Waking…] (Fast intentional ignition, "I heard you")
 * - Listening: [• MAVE | waveform | Listening… | (Stop)] (Acoustic reactivity to RMS)
 * - Thinking: [• MAVE | restrained arc | Thinking… | (Cancel)] (Low visual noise, no fake progress)
 * - Speaking: [• MAVE | voice wave | Speaking… | (Stop)] (Vocal playback wave, barge-in ready)
 * - Error: [• MAVE | error indicator | Offline | (Retry)] (Calm restrained alert)
 * - Quick Response: Temporary bubble above Presence for single compact confirmation/translation.
 */
export const PresenceSurface: React.FC<PresenceSurfaceProps> = ({
  state = 'idle',
  audioLevel = 0,
  quickResponse,
  officeMode = false,
  errorMessage,
  onExpand,
  onWakeToggle,
  onManualActivate,
  onStopListening,
  onCancelThinking,
  onStopSpeaking,
  onRetryError,
  onDismissError,
  onDismissQuickResponse,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Content provenance sanitized: provider/runtime execution substrate is stripped
  const sanitizedSource = sanitizeQuickResponseSource(quickResponse?.sourceLabel);

  const handleActivation = () => {
    if (onManualActivate) {
      onManualActivate();
    } else if (onWakeToggle) {
      onWakeToggle();
    }
  };

  const isIdle = state === 'idle';
  const isWaking = state === 'waking';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';
  const isError = state === 'error';

  // Dynamic borders per semantic state
  const borderColor = isError
    ? 'var(--mave-v2-presence-border-error)'
    : isListening
    ? 'var(--mave-v2-presence-border-listening)'
    : isThinking
    ? 'var(--mave-v2-presence-border-thinking)'
    : isSpeaking
    ? 'var(--mave-v2-presence-border-speaking)'
    : isWaking
    ? 'var(--mave-v2-presence-border-listening)'
    : 'var(--mave-v2-presence-border)';

  // Controlled glow: STRICT ZERO GLOW in resting idle
  const glowShadow = isListening
    ? 'var(--mave-v2-presence-glow-listening)'
    : isThinking
    ? 'var(--mave-v2-presence-glow-thinking)'
    : isSpeaking
    ? 'var(--mave-v2-presence-glow-speaking)'
    : isError
    ? 'var(--mave-v2-presence-glow-error)'
    : isWaking
    ? 'var(--mave-v2-presence-glow-listening)'
    : 'var(--mave-v2-presence-glow-resting)';

  // Semantic state label
  const stateLabel = isWaking
    ? 'Waking…'
    : isListening
    ? 'Listening…'
    : isThinking
    ? 'Thinking…'
    : isSpeaking
    ? officeMode
      ? 'Silent Output…'
      : 'Speaking…'
    : isError
    ? errorMessage || 'Offline'
    : 'MAVE';

  // Contextual action descriptors
  const stopListeningDesc = getPresenceButtonDescriptor('stop-listening');
  const cancelThinkingDesc = getPresenceButtonDescriptor('cancel-thinking');
  const stopSpeakingDesc = getPresenceButtonDescriptor('stop-speaking');
  const retryDesc = getPresenceButtonDescriptor('retry');
  const expandDesc = getPresenceButtonDescriptor('expand');

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="presence-surface"
      data-state={state}
      data-office-mode={officeMode ? 'true' : 'false'}
    >
      {/* Quick Response Bubble (appears above capsule when short content is available) */}
      {quickResponse && (
        <div
          style={{
            maxWidth: '320px',
            background: 'var(--mave-v2-surface-elevated)',
            border: '1px solid var(--mave-v2-border-subtle)',
            borderRadius: 'var(--mave-v2-radius-card)',
            padding: '10px 14px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            color: 'var(--mave-v2-text-primary)',
            fontSize: '13px',
            lineHeight: 1.4,
            animation: 'mave-v2-breathe 4s ease-in-out infinite',
            position: 'relative'
          }}
          data-testid="presence-quick-response"
        >
          <div style={{ paddingRight: onDismissQuickResponse ? '20px' : '0' }}>
            {quickResponse.text}
          </div>

          {/* Footer with source badge and expand shortcut */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '6px',
              fontSize: '11px',
              color: 'var(--mave-v2-text-dim)'
            }}
          >
            {sanitizedSource ? (
              <span data-testid="quick-response-source">{sanitizedSource}</span>
            ) : (
              <span />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {onExpand && (
                <button
                  onClick={onExpand}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--mave-v2-accent-listening)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '2px 4px',
                    borderRadius: '3px'
                  }}
                  title={expandDesc.tooltip}
                  aria-label={expandDesc.label}
                  data-testid="quick-response-expand"
                >
                  Expand ↗
                </button>
              )}
              {onDismissQuickResponse && (
                <button
                  onClick={onDismissQuickResponse}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--mave-v2-text-muted)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '0 2px'
                  }}
                  title="Dismiss quick response"
                  aria-label="Dismiss quick response"
                  data-testid="quick-response-dismiss"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Ambient Capsule */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--mave-v2-presence-bg)',
          backdropFilter: 'blur(var(--mave-v2-blur))',
          WebkitBackdropFilter: 'blur(var(--mave-v2-blur))',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--mave-v2-radius-pill)',
          padding: isIdle ? '5px 12px 5px 8px' : '5px 10px 5px 8px',
          boxShadow: glowShadow,
          transition: 'all var(--mave-v2-motion-normal)',
          height: '38px',
          boxSizing: 'border-box'
        }}
        data-testid="presence-capsule"
      >
        {/* Presence Mark / Orb (Manual activation when clicked) */}
        <AdaptivePresenceMark
          state={state}
          size="compact"
          audioLevel={audioLevel}
          onClick={handleActivation}
        />

        {/* Brand Wordmark (MAVE) — Manual activation when clicked */}
        <span
          style={{
            fontWeight: 700,
            fontSize: '13px',
            color: 'var(--mave-v2-text-primary)',
            letterSpacing: '0.6px',
            cursor: onManualActivate || onWakeToggle ? 'pointer' : 'default'
          }}
          onClick={handleActivation}
          title="Manual activation: start listening"
          aria-label="Manual activation"
          data-testid="presence-wordmark"
        >
          MAVE
        </span>

        {/* Office Mode Subtle Indicator (Ultra-quiet mute icon, non-distracting) */}
        {officeMode && isIdle && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--mave-v2-text-muted)',
              opacity: 0.65,
              display: 'inline-flex',
              alignItems: 'center'
            }}
            title="Office Mode (Voice output muted)"
            aria-label="Office Mode (Voice output muted)"
            data-testid="presence-office-badge"
          >
            🔇
          </span>
        )}

        {/* Active Semantic State Label (Only shown when not idle) */}
        {!isIdle && (
          <span
            style={{
              fontWeight: 500,
              fontSize: '12px',
              color: isError
                ? 'var(--mave-v2-accent-error)'
                : isThinking
                ? 'var(--mave-v2-accent-thinking)'
                : isListening || isWaking
                ? 'var(--mave-v2-accent-listening)'
                : 'var(--mave-v2-text-secondary)',
              letterSpacing: '0.1px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            data-testid="presence-state-label"
          >
            {stateLabel}
          </span>
        )}

        {/* Contextual Action: Stop Listening */}
        {isListening && (onStopListening || onWakeToggle) && (
          <button
            onClick={onStopListening || onWakeToggle}
            title={stopListeningDesc.tooltip}
            aria-label={stopListeningDesc.label}
            style={{
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: 'var(--mave-v2-accent-listening)',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: '10px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
            data-testid="presence-action-stop-listening"
          >
            {stopListeningDesc.icon}
          </button>
        )}

        {/* Contextual Action: Cancel Thinking */}
        {isThinking && (onCancelThinking || onWakeToggle) && (
          <button
            onClick={onCancelThinking || onWakeToggle}
            title={cancelThinkingDesc.tooltip}
            aria-label={cancelThinkingDesc.label}
            style={{
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: 'var(--mave-v2-accent-thinking)',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: '11px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            data-testid="presence-action-cancel-thinking"
          >
            {cancelThinkingDesc.icon}
          </button>
        )}

        {/* Contextual Action: Stop Speaking / Barge-in */}
        {isSpeaking && (onStopSpeaking || onWakeToggle) && (
          <button
            onClick={onStopSpeaking || onWakeToggle}
            title={stopSpeakingDesc.tooltip}
            aria-label={stopSpeakingDesc.label}
            style={{
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              color: 'var(--mave-v2-accent-thinking)',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: '10px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            data-testid="presence-action-stop-speaking"
          >
            {stopSpeakingDesc.icon}
          </button>
        )}

        {/* Contextual Action: Retry on Error */}
        {isError && (onRetryError || onDismissError) && (
          <button
            onClick={onRetryError || onDismissError}
            title={retryDesc.tooltip}
            aria-label={retryDesc.label}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--mave-v2-accent-error)',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: '11px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            data-testid="presence-action-retry-error"
          >
            {retryDesc.icon}
          </button>
        )}

        {/* Expand to Conversation Button (revealed on hover or when non-idle) */}
        {onExpand && (
          <button
            onClick={onExpand}
            title={expandDesc.tooltip}
            aria-label={expandDesc.label}
            style={{
              background: 'transparent',
              border: 'none',
              color: isHovered || !isIdle ? 'var(--mave-v2-text-secondary)' : 'var(--mave-v2-text-dim)',
              cursor: 'pointer',
              padding: '2px 4px',
              fontSize: '13px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color var(--mave-v2-motion-fast)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mave-v2-text-primary)')}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color =
                isHovered || !isIdle ? 'var(--mave-v2-text-secondary)' : 'var(--mave-v2-text-dim)')
            }
            data-testid="presence-action-expand"
          >
            {expandDesc.icon}
          </button>
        )}
      </div>
    </div>
  );
};
