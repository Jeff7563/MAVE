import React, { useState } from 'react';
import type { PresenceState, QuickResponseData } from '../types';
import { AdaptivePresenceMark } from '../primitives/AdaptivePresenceMark';
import { getPresenceButtonDescriptor, sanitizeQuickResponseSource } from './presence-rules';
import '../tokens.css';

export interface PresenceSurfaceProps {
  state?: PresenceState;
  audioLevel?: number;
  quickResponse?: QuickResponseData;
  liveTranscript?: string;
  backgroundTask?: {
    taskName: string;
    statusText: string;
    onActivate?: () => void;
  };
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
  liveTranscript,
  backgroundTask,
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
        alignItems: 'center',
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
      {/* Live speech transcription floating above capsule (Showcase v3) */}
      {liveTranscript && (
        <div
          style={{
            fontSize: '14px',
            color: '#f8fafc',
            fontStyle: 'normal',
            fontWeight: 400,
            textAlign: 'center',
            marginBottom: '4px',
            padding: '4px 12px',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            borderRadius: '9999px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            animation: 'mave-v3-materialize 250ms ease-out'
          }}
          data-testid="presence-live-transcript"
        >
          “{liveTranscript}”
        </div>
      )}

      {/* Quick Response Bubble (appears above capsule when short content is available) */}
      {quickResponse && (
        <div
          style={{
            maxWidth: '340px',
            background: 'rgba(16, 20, 34, 0.88)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '12px 16px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
            color: 'var(--mave-v2-text-primary)',
            fontSize: '13px',
            lineHeight: 1.5,
            animation: 'mave-v3-materialize 300ms ease-out',
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
              marginTop: '8px',
              fontSize: '11px',
              color: 'var(--mave-v2-text-dim)'
            }}
          >
            {sanitizedSource ? (
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  color: 'var(--mave-v2-accent-listening)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 500
                }}
                data-testid="quick-response-source"
              >
                {sanitizedSource}
              </span>
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

      {/* Main Ambient Capsule (Showcase v3 Centered Anchor) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(16, 20, 34, 0.88)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: `1px solid ${borderColor}`,
          borderRadius: '9999px',
          padding: isIdle ? '6px 16px 6px 12px' : '6px 14px 6px 10px',
          boxShadow: glowShadow,
          transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
          height: '40px',
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

        {/* Brand Wordmark (MAVE) — Showcase v3 wide tracking */}
        <span
          style={{
            fontWeight: 600,
            fontSize: '13px',
            color: '#f8fafc',
            letterSpacing: '0.16em',
            cursor: onManualActivate || onWakeToggle ? 'pointer' : 'default'
          }}
          onClick={handleActivation}
          title="Manual activation: start listening"
          aria-label="Manual activation"
          data-testid="presence-wordmark"
        >
          MAVE
        </span>

        {/* Subtle Vertical Divider Line (Showcase v3) */}
        <span
          style={{
            width: '1px',
            height: '14px',
            background: 'rgba(255, 255, 255, 0.12)',
            margin: '0 2px'
          }}
        />

        {/* Resting Breathing Dots Row (Showcase v3 idle state) */}
        {isIdle && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0 4px',
              color: 'rgba(148, 163, 184, 0.65)'
            }}
            data-testid="presence-dots"
          >
            {[...Array(11)].map((_, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: '2.5px',
                  height: '2.5px',
                  borderRadius: '50%',
                  background: 'rgba(148, 163, 184, 0.55)',
                  animation: 'mave-v3-dots-pulse 3s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Acoustic Waveform (Showcase v3 listening/speaking state) */}
        {(isListening || isSpeaking || isWaking) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              height: '16px',
              padding: '0 4px'
            }}
            data-testid="presence-waveform"
          >
            {[0.3, 0.6, 1.0, 0.7, 0.4, 0.8, 0.5, 0.9, 0.4].map((scale, i) => {
              const barHeight = Math.max(
                3,
                Math.round(14 * (audioLevel > 0 ? audioLevel * scale : scale * 0.4))
              );
              return (
                <span
                  key={i}
                  style={{
                    width: '2px',
                    height: `${barHeight}px`,
                    borderRadius: '1px',
                    background: isListening
                      ? 'var(--mave-v2-accent-listening)'
                      : 'var(--mave-v2-accent-thinking)',
                    transition: 'height 80ms ease'
                  }}
                />
              );
            })}
          </div>
        )}

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
              gap: '5px'
            }}
            data-testid="presence-state-label"
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: isError
                  ? 'var(--mave-v2-accent-error)'
                  : isThinking
                  ? 'var(--mave-v2-accent-thinking)'
                  : isListening
                  ? 'var(--mave-v2-accent-listening)'
                  : '#818cf8'
              }}
            />
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

      {/* Background Task Status Pill (Showcase v3 Task Morph) */}
      {backgroundTask && (
        <div
          onClick={backgroundTask.onActivate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(16, 20, 34, 0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            borderRadius: '9999px',
            padding: '5px 14px',
            height: '34px',
            boxSizing: 'border-box',
            cursor: backgroundTask.onActivate ? 'pointer' : 'default',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            animation: 'mave-v3-materialize 250ms ease-out',
            fontSize: '12px',
            color: '#f8fafc',
            marginTop: '4px'
          }}
          data-testid="presence-background-task"
        >
          <span style={{ color: 'var(--mave-v2-accent-listening)', fontSize: '12px' }}>◷</span>
          <span style={{ fontWeight: 500, color: '#f8fafc' }}>{backgroundTask.taskName}</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>
          <span style={{ color: 'rgba(148, 163, 184, 0.9)', fontSize: '11px' }}>
            {backgroundTask.statusText}
          </span>
        </div>
      )}
    </div>
  );
};
