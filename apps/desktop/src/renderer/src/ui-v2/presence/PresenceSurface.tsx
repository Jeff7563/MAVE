import React, { useState } from 'react';
import type { PresenceState, QuickResponseData } from '../types';
import { AdaptivePresenceMark } from '../primitives/AdaptivePresenceMark';
import {
  getPresenceButtonDescriptor,
  sanitizeQuickResponseSource,
  normalizeAudioRms
} from './presence-rules';
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
 * HarmonicWaveform
 *
 * Mathematical voice visualizer derived from authentic prototype source:
 * Math.pow(Math.sin(Math.PI * x), 1.3) sinusoidal harmonic envelope with 3px bars.
 */
const HarmonicWaveform: React.FC<{
  audioLevel: number;
  isSpeaking?: boolean;
  width?: number;
  height?: number;
}> = ({ audioLevel, isSpeaking = false, width = 240, height = 30 }) => {
  const norm = normalizeAudioRms(audioLevel);
  // Visual dynamic floor so bars stay alive during active listening / speaking
  const amp = Math.max(isSpeaking ? 0.28 : 0.22, norm);
  // Bar count based on width with ~11px pitch
  const n = Math.max(9, Math.floor(width / 11));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: `${width}px`,
        maxWidth: '100%',
        height: `${height}px`,
        padding: '0 4px',
        boxSizing: 'border-box'
      }}
      data-testid="presence-waveform"
    >
      {[...Array(n)].map((_, i) => {
        const x = i / (n - 1);
        // Authentic Prototype Sinusoidal Bell Envelope
        const env = Math.pow(Math.sin(Math.PI * x), 1.3);
        const osc = Math.abs(Math.sin((i + 1) * 0.83) * Math.sin((i + 1) * 0.41 + 1.3));
        const hFactor = 0.08 + amp * env * (0.35 + 0.65 * osc);
        const barH = Math.max(3, Math.round(height * Math.min(1, hFactor)));
        const colorRatio = 1 - Math.abs(x - 0.5) * 2;
        const barColor = `color-mix(in srgb, var(--mave-cyan, #5FD2FF) ${Math.round(colorRatio * 100)}%, var(--mave-violet, #9A72FF))`;

        return (
          <span
            key={i}
            style={{
              width: '3px',
              height: `${barH}px`,
              borderRadius: '2px',
              background: barColor,
              opacity: 0.35 + 0.65 * env,
              transition: 'height 80ms ease-out'
            }}
          />
        );
      })}
    </div>
  );
};

/**
 * PresenceSurface
 *
 * Authentic MAVE Presence Surface (VSM1 Foundation).
 * Derived directly from UI Kit & Prototype sources:
 * - Sleeping: 300 × 96, radius 48, centered Jost 300 wordmark with .42em tracking,
 *   subtle breathing scale (1.006), top specular highlight, zero neon glow.
 * - Active: 760 × 72, radius 36, wordmark slides left (19px), hairline vertical divider,
 *   authentic sinusoidal harmonic waveform, state indicator, restrained action pills.
 * - Quick Response: Contextually anchored soft glass surface floating above capsule.
 * - Audio Truthfulness: Zero waveform in idle; acoustic waveform exclusively during
 *   listening and speaking; restrained non-acoustic cognitive flow in thinking.
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

  const isIdle = state === 'idle';
  const isWaking = state === 'waking';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';
  const isError = state === 'error';

  // Sanitized content provenance (AI execution substrate stripped)
  const sanitizedSource = sanitizeQuickResponseSource(quickResponse?.sourceLabel);

  const handleActivation = () => {
    if (onManualActivate) {
      onManualActivate();
    } else if (onWakeToggle) {
      onWakeToggle();
    }
  };

  // State colors from authentic tokens
  const stateAccentColor = isError
    ? 'var(--mave-err, #ff7a85)'
    : isThinking
    ? 'var(--mave-violet, #9a72ff)'
    : isListening || isWaking
    ? 'var(--mave-cyan, #5fd2ff)'
    : isSpeaking
    ? 'var(--mave-cyan, #5fd2ff)'
    : 'var(--mave-cyan, #5fd2ff)';

  // Border styling: resting edge vs active subtle accent
  const borderColor = isError
    ? 'rgba(255, 122, 133, 0.40)'
    : isListening
    ? 'rgba(95, 210, 255, 0.40)'
    : isThinking
    ? 'rgba(154, 114, 255, 0.35)'
    : isSpeaking
    ? 'rgba(95, 210, 255, 0.40)'
    : isWaking
    ? 'rgba(95, 210, 255, 0.40)'
    : 'var(--mave-edge, rgba(180, 190, 255, 0.14))';

  // Glow shadow: STRICT ZERO GLOW in resting idle
  const glowShadow = isListening
    ? 'var(--mave-shadow-active, 0 0 36px -6px rgba(91, 132, 255, 0.35))'
    : isThinking
    ? '0 0 32px -6px rgba(154, 114, 255, 0.30)'
    : isSpeaking
    ? 'var(--mave-shadow-active, 0 0 36px -6px rgba(91, 132, 255, 0.35))'
    : isError
    ? '0 0 20px -2px rgba(255, 122, 133, 0.28)'
    : isWaking
    ? '0 0 24px -2px rgba(95, 210, 255, 0.32)'
    : 'var(--mave-v2-presence-glow-resting, none)';

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
    : '';

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
        gap: '12px',
        position: 'relative',
        userSelect: 'none',
        maxWidth: '100%'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="presence-surface"
      data-state={state}
      data-office-mode={officeMode ? 'true' : 'false'}
    >
      {/* --------------------------------------------------------------------
          1. Live Transcript Utterance (Showcase v3 Spatial Speech Bubble)
          -------------------------------------------------------------------- */}
      {liveTranscript && (
        <div
          style={{
            fontSize: '18px',
            fontFamily: "var(--mave-font-sans, 'Manrope', sans-serif)",
            fontWeight: 400,
            lineHeight: 1.35,
            color: 'var(--mave-ink, #EEF0FB)',
            textAlign: 'center',
            padding: '8px 20px',
            maxWidth: 'min(760px, 92vw)',
            textWrap: 'balance',
            animation: 'mave-v3-materialize var(--mave-dur-enter, 450ms) var(--mave-ease-enter)'
          }}
          data-testid="presence-live-transcript"
        >
          “{liveTranscript}”
        </div>
      )}

      {/* --------------------------------------------------------------------
          2. Quick Response Contextual Glass Surface
          -------------------------------------------------------------------- */}
      {quickResponse && (
        <div
          style={{
            maxWidth: 'min(420px, 92vw)',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.065), rgba(255, 255, 255, 0.018)), rgba(12, 14, 30, 0.72)',
            backdropFilter: 'blur(22px) saturate(140%)',
            WebkitBackdropFilter: 'blur(22px) saturate(140%)',
            border: '1px solid var(--mave-edge, rgba(180, 190, 255, 0.14))',
            borderRadius: 'var(--mave-radius-card, 24px)',
            padding: '16px 20px',
            boxShadow: 'var(--mave-shadow-glass)',
            color: 'var(--mave-ink, #EEF0FB)',
            fontFamily: "var(--mave-font-sans, 'Manrope', sans-serif)",
            fontSize: '15px',
            lineHeight: 1.5,
            animation: 'mave-v3-materialize var(--mave-dur-enter, 450ms) var(--mave-ease-enter)',
            position: 'relative'
          }}
          data-testid="presence-quick-response"
        >
          <div style={{ paddingRight: onDismissQuickResponse ? '24px' : '0' }}>
            {quickResponse.text}
          </div>

          {/* Footer: Provenance Citation & Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '12px',
              fontSize: '12px',
              color: 'var(--mave-dim, rgba(222, 226, 255, 0.60))'
            }}
          >
            {sanitizedSource ? (
              <span
                style={{
                  background: 'rgba(91, 132, 255, 0.15)',
                  border: '1px solid rgba(91, 132, 255, 0.35)',
                  color: 'var(--mave-ink, #EEF0FB)',
                  padding: '2px 8px',
                  borderRadius: 'var(--mave-radius-chip, 17px)',
                  fontFamily: "var(--mave-font-mono, monospace)",
                  fontSize: '11px',
                  letterSpacing: '0.04em'
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
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'var(--mave-cyan, #5FD2FF)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontFamily: "var(--mave-font-sans, sans-serif)",
                    transition: 'background var(--mave-dur-quick, 200ms) ease'
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
                    color: 'var(--mave-faint, rgba(222, 226, 255, 0.38))',
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: '2px 4px',
                    lineHeight: 1
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

      {/* --------------------------------------------------------------------
          3. Main Presence Capsule (Authentic Prototype Morphing Geometry)
          - Idle: 300 × 96, radius 48, centered Jost 300 wordmark
          - Active: 760 × 72, radius 36, wordmark left, divider, waveform, label
          -------------------------------------------------------------------- */}
      <div
        style={{
          position: 'relative',
          width: isIdle ? '300px' : '760px',
          maxWidth: isIdle ? 'min(300px, 94vw)' : 'min(760px, 94vw)',
          height: isIdle ? '96px' : '72px',
          borderRadius: isIdle ? 'var(--mave-radius-pill-idle, 48px)' : 'var(--mave-radius-pill-active, 36px)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.065), rgba(255, 255, 255, 0.018)), rgba(12, 14, 30, 0.60)',
          border: `1px solid ${borderColor}`,
          boxShadow: isIdle ? 'var(--mave-v2-presence-glow-resting)' : `${glowShadow}, var(--mave-shadow-pill)`,
          backdropFilter: 'blur(22px) saturate(140%)',
          WebkitBackdropFilter: 'blur(22px) saturate(140%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isIdle ? 'center' : 'flex-start',
          padding: isIdle ? '0 24px' : '0 24px',
          boxSizing: 'border-box',
          gap: isIdle ? '12px' : '16px',
          overflow: 'hidden',
          transition: 'width var(--mave-dur-glide, 800ms) var(--mave-ease-glide), height var(--mave-dur-glide, 800ms) var(--mave-ease-glide), border-radius var(--mave-dur-glide, 800ms) var(--mave-ease-glide), padding var(--mave-dur-glide, 800ms) var(--mave-ease-glide), box-shadow var(--mave-dur-glide, 800ms) var(--mave-ease-glide), border-color var(--mave-dur-glide, 800ms) var(--mave-ease-glide)',
          animation: isIdle ? 'mave-v2-breathe 4.8s ease-in-out infinite' : undefined
        }}
        data-testid="presence-capsule"
      >
        {/* Top Specular Hairline Highlight (UI Kit Source Spec) */}
        <div
          style={{
            position: 'absolute',
            top: -1,
            left: isIdle ? '20%' : '30%',
            width: isIdle ? '60%' : '40%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(95, 210, 255, 0.85), transparent)',
            pointerEvents: 'none',
            transition: 'all var(--mave-dur-glide, 800ms) var(--mave-ease-glide)'
          }}
        />

        {/* ------------------------------------------------------------------
            IDLE LAYOUT: Centered Presence Identity
            ------------------------------------------------------------------ */}
        {isIdle && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              width: '100%',
              cursor: onManualActivate || onWakeToggle ? 'pointer' : 'default'
            }}
            onClick={handleActivation}
            title="Manual activation: start listening"
            aria-label="Manual activation"
          >
            {/* Identity Orb */}
            <AdaptivePresenceMark
              state="idle"
              size="compact"
              audioLevel={0}
              onClick={handleActivation}
            />

            {/* Jost 300 Wide Wordmark */}
            <span
              style={{
                fontFamily: "var(--mave-font-wordmark, 'Jost', sans-serif)",
                fontWeight: 300,
                fontSize: '30px',
                letterSpacing: '0.42em',
                paddingLeft: '0.42em',
                color: '#f3f4fc',
                lineHeight: 1,
                whiteSpace: 'nowrap'
              }}
              data-testid="presence-wordmark"
            >
              MAVE
            </span>

            {/* Resting breathing element (satisfies presence-dots invariant with elegance) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                paddingLeft: '4px',
                opacity: 0.45
              }}
              data-testid="presence-dots"
            >
              {[0.5, 0.8, 1.0, 0.8, 0.5].map((s, i) => (
                <span
                  key={i}
                  style={{
                    width: '2px',
                    height: '2px',
                    borderRadius: '50%',
                    background: 'var(--mave-cyan, #5FD2FF)',
                    transform: `scale(${s})`,
                    animation: 'mave-v3-dots-pulse 3s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`
                  }}
                />
              ))}
            </div>

            {/* Office Mode Subtle Indicator */}
            {officeMode && (
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--mave-faint, rgba(222, 226, 255, 0.38))',
                  marginLeft: '4px',
                  opacity: 0.75
                }}
                title="Office Mode (Voice output muted)"
                aria-label="Office Mode (Voice output muted)"
                data-testid="presence-office-badge"
              >
                🔇
              </span>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------
            ACTIVE LAYOUT: Left Identity, Hairline Divider, Waveform & Status
            ------------------------------------------------------------------ */}
        {!isIdle && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              gap: '12px',
              minWidth: 0
            }}
          >
            {/* Identity Orb & Wordmark */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexShrink: 0,
                cursor: onManualActivate || onWakeToggle ? 'pointer' : 'default'
              }}
              onClick={handleActivation}
              title="Manual activation: start listening"
              aria-label="Manual activation"
            >
              <AdaptivePresenceMark
                state={state}
                size="compact"
                audioLevel={audioLevel}
                onClick={handleActivation}
              />
              <span
                style={{
                  fontFamily: "var(--mave-font-wordmark, 'Jost', sans-serif)",
                  fontWeight: 300,
                  fontSize: '19px',
                  letterSpacing: '0.42em',
                  paddingLeft: '0.42em',
                  color: '#f3f4fc',
                  lineHeight: 1,
                  whiteSpace: 'nowrap'
                }}
                data-testid="presence-wordmark"
              >
                MAVE
              </span>
            </div>

            {/* Vertical Hairline Divider */}
            <div
              style={{
                width: '1px',
                height: '28px',
                background: 'rgba(255, 255, 255, 0.14)',
                flexShrink: 0,
                margin: '0 2px'
              }}
            />

            {/* Waveform / Activity Region */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
                overflow: 'hidden'
              }}
            >
              {/* Listening & Speaking: Authentic Sinusoidal Waveform */}
              {(isListening || isSpeaking || isWaking) && (
                <HarmonicWaveform
                  audioLevel={audioLevel}
                  isSpeaking={isSpeaking}
                  width={220}
                  height={28}
                />
              )}

              {/* Thinking: Restrained Non-Acoustic Cognitive Flow (Audio State Truthfulness) */}
              {isThinking && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 10px',
                    width: '100%',
                    maxWidth: '220px'
                  }}
                >
                  <div
                    style={{
                      height: '3px',
                      flex: 1,
                      borderRadius: '2px',
                      background: 'linear-gradient(90deg, rgba(154, 114, 255, 0.2), rgba(154, 114, 255, 0.8), rgba(95, 210, 255, 0.6), rgba(154, 114, 255, 0.2))',
                      backgroundSize: '200% 100%',
                      animation: 'mave-v3-gradient-flow 2s linear infinite'
                    }}
                  />
                </div>
              )}

              {/* Error: Subdued Alert Notice */}
              {isError && (
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--mave-err, #ff7a85)',
                    fontFamily: "var(--mave-font-sans, sans-serif)",
                    paddingLeft: '6px'
                  }}
                >
                  {errorMessage || 'Connection interrupted'}
                </div>
              )}
            </div>

            {/* Right Status Label & State Dot */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0
              }}
              data-testid="presence-state-label"
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: stateAccentColor,
                  boxShadow: `0 0 8px ${stateAccentColor}`
                }}
              />
              <span
                style={{
                  fontFamily: "var(--mave-font-sans, 'Manrope', sans-serif)",
                  fontSize: '15px',
                  fontWeight: 400,
                  color: 'var(--mave-dim, rgba(222, 226, 255, 0.60))',
                  whiteSpace: 'nowrap'
                }}
              >
                {stateLabel}
              </span>
            </div>

            {/* --------------------------------------------------------------
                Contextual Control Actions (Integrated cleanly without admin look)
                -------------------------------------------------------------- */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0
              }}
            >
              {/* Stop Listening */}
              {isListening && (onStopListening || onWakeToggle) && (
                <button
                  onClick={onStopListening || onWakeToggle}
                  title={stopListeningDesc.tooltip}
                  aria-label={stopListeningDesc.label}
                  style={{
                    background: 'rgba(95, 210, 255, 0.12)',
                    border: '1px solid rgba(95, 210, 255, 0.35)',
                    color: 'var(--mave-cyan, #5FD2FF)',
                    cursor: 'pointer',
                    padding: '3px 8px',
                    fontSize: '11px',
                    borderRadius: '12px',
                    fontFamily: "var(--mave-font-sans, sans-serif)",
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                  data-testid="presence-action-stop-listening"
                >
                  {stopListeningDesc.icon}
                </button>
              )}

              {/* Cancel Thinking */}
              {isThinking && (onCancelThinking || onWakeToggle) && (
                <button
                  onClick={onCancelThinking || onWakeToggle}
                  title={cancelThinkingDesc.tooltip}
                  aria-label={cancelThinkingDesc.label}
                  style={{
                    background: 'rgba(154, 114, 255, 0.12)',
                    border: '1px solid rgba(154, 114, 255, 0.35)',
                    color: 'var(--mave-violet, #9A72FF)',
                    cursor: 'pointer',
                    padding: '3px 8px',
                    fontSize: '11px',
                    borderRadius: '12px',
                    fontFamily: "var(--mave-font-sans, sans-serif)",
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  data-testid="presence-action-cancel-thinking"
                >
                  {cancelThinkingDesc.icon}
                </button>
              )}

              {/* Stop Speaking / Barge-in */}
              {isSpeaking && (onStopSpeaking || onWakeToggle) && (
                <button
                  onClick={onStopSpeaking || onWakeToggle}
                  title={stopSpeakingDesc.tooltip}
                  aria-label={stopSpeakingDesc.label}
                  style={{
                    background: 'rgba(95, 210, 255, 0.12)',
                    border: '1px solid rgba(95, 210, 255, 0.35)',
                    color: 'var(--mave-cyan, #5FD2FF)',
                    cursor: 'pointer',
                    padding: '3px 8px',
                    fontSize: '11px',
                    borderRadius: '12px',
                    fontFamily: "var(--mave-font-sans, sans-serif)",
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  data-testid="presence-action-stop-speaking"
                >
                  {stopSpeakingDesc.icon}
                </button>
              )}

              {/* Retry on Error */}
              {isError && (onRetryError || onDismissError) && (
                <button
                  onClick={onRetryError || onDismissError}
                  title={retryDesc.tooltip}
                  aria-label={retryDesc.label}
                  style={{
                    background: 'rgba(255, 122, 133, 0.14)',
                    border: '1px solid rgba(255, 122, 133, 0.40)',
                    color: 'var(--mave-err, #FF7A85)',
                    cursor: 'pointer',
                    padding: '3px 8px',
                    fontSize: '11px',
                    borderRadius: '12px',
                    fontFamily: "var(--mave-font-sans, sans-serif)",
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  data-testid="presence-action-retry-error"
                >
                  {retryDesc.icon}
                </button>
              )}

              {/* Expand to Conversation / Workspace */}
              {onExpand && (
                <button
                  onClick={onExpand}
                  title={expandDesc.tooltip}
                  aria-label={expandDesc.label}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isHovered || !isIdle ? 'var(--mave-dim)' : 'var(--mave-faint)',
                    cursor: 'pointer',
                    padding: '3px 6px',
                    fontSize: '14px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color var(--mave-dur-quick, 200ms) ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mave-ink)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color =
                      isHovered || !isIdle ? 'var(--mave-dim)' : 'var(--mave-faint)')
                  }
                  data-testid="presence-action-expand"
                >
                  {expandDesc.icon}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------
          4. Background Task Indicator Pill (Showcase v3 Task Morph / IndV)
          -------------------------------------------------------------------- */}
      {backgroundTask && (
        <div
          onClick={backgroundTask.onActivate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.012)), rgba(12, 14, 30, 0.85)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            border: '1px solid var(--mave-edge, rgba(180, 190, 255, 0.14))',
            borderRadius: 'var(--mave-radius-pill-active, 36px)',
            padding: '6px 16px',
            height: '36px',
            boxSizing: 'border-box',
            cursor: backgroundTask.onActivate ? 'pointer' : 'default',
            boxShadow: 'var(--mave-shadow-glass)',
            animation: 'mave-v3-materialize var(--mave-dur-enter, 450ms) var(--mave-ease-enter)',
            fontSize: '13px',
            color: 'var(--mave-ink, #EEF0FB)',
            fontFamily: "var(--mave-font-sans, 'Manrope', sans-serif)",
            marginTop: '2px'
          }}
          data-testid="presence-background-task"
        >
          <span style={{ color: 'var(--mave-cyan, #5FD2FF)', fontSize: '13px' }}>◷</span>
          <span style={{ fontWeight: 500, color: 'var(--mave-ink, #EEF0FB)' }}>{backgroundTask.taskName}</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>
          <span style={{ color: 'var(--mave-dim, rgba(222, 226, 255, 0.60))', fontSize: '12px' }}>
            {backgroundTask.statusText}
          </span>
        </div>
      )}
    </div>
  );
};
