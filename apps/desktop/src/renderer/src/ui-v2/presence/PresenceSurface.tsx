import React, { useState } from 'react';
import type { PresenceState, QuickResponseData } from '../types';
import { AdaptivePresenceMark } from '../primitives/AdaptivePresenceMark';
import { ExpandIcon, CloseIcon, RetryIcon, ClockIcon } from '../primitives/Icons';
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
}> = ({ audioLevel, isSpeaking = false, width = 120, height = 20 }) => {
  const norm = normalizeAudioRms(audioLevel);
  // Listening: slightly calmer amplitude / cyan dominant
  // Speaking: slightly stronger energy / controlled violet fringe
  const amp = isSpeaking ? Math.max(0.24, norm * 1.1) : Math.max(0.18, norm * 0.85);
  // Compact bar count based on width with ~8px pitch
  const n = Math.max(9, Math.floor(width / 8));

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
        const barColor = isSpeaking
          ? `color-mix(in srgb, var(--mave-cyan, #5FD2FF) ${Math.round(colorRatio * 60 + 20)}%, var(--mave-violet, #9A72FF))`
          : `color-mix(in srgb, var(--mave-cyan, #5FD2FF) 85%, var(--mave-violet, #9A72FF) 15%)`;

        return (
          <span
            key={i}
            style={{
              width: '2.5px',
              height: `${barH}px`,
              borderRadius: '1.5px',
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
 * CognitiveWave
 *
 * Dedicated non-acoustic living wave for Thinking state (UI Kit authoritative spec).
 * Renders a compact series of vertical rounded bars undulating in an autonomous,
 * low-amplitude harmonious traveling wave with steady rhythm.
 * Zero RMS or audio coupling; communicates calm cognition ("MAVE is processing").
 */
const CognitiveWave: React.FC = () => {
  const barCount = 14;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        padding: '0 4px',
        height: '20px',
        width: '74px',
        boxSizing: 'border-box'
      }}
      data-testid="presence-thinking-indicator"
    >
      {[...Array(barCount)].map((_, i) => {
        const x = i / (barCount - 1);
        // Sinusoidal bell envelope for natural wave bounds (calm center, soft edges)
        const env = Math.pow(Math.sin(Math.PI * x), 1.2);
        // Low amplitude: base heights range between 3.5px (edges) and 8.5px (center)
        const baseHeight = Math.max(3, Math.round(3.5 + 5 * env));
        const colorRatio = 1 - Math.abs(x - 0.5) * 2;
        // Calm violet-cyan cognitive balance
        const barColor = `color-mix(in srgb, var(--mave-violet, #9A72FF) ${Math.round(65 - colorRatio * 25)}%, var(--mave-cyan, #5FD2FF))`;

        return (
          <span
            key={i}
            style={{
              width: '2.5px',
              height: `${baseHeight}px`,
              borderRadius: '1.5px',
              background: barColor,
              transformOrigin: 'center',
              animation: 'mave-v3-cognitive-wave 1.8s ease-in-out infinite',
              animationDelay: `-${((i / barCount) * 1.8).toFixed(2)}s`,
              boxShadow: '0 0 4px rgba(154, 114, 255, 0.3)'
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
  onStopListening: _onStopListening,
  onCancelThinking: _onCancelThinking,
  onStopSpeaking: _onStopSpeaking,
  onRetryError,
  onDismissError,
  onDismissQuickResponse,
  className = ''
}) => {
  const [, setIsHovered] = useState(false);

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
            maxWidth: 'min(420px, 28vw)',
            width: 'fit-content',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.065), rgba(255, 255, 255, 0.018)), rgba(12, 14, 30, 0.72)',
            backdropFilter: 'blur(22px) saturate(140%)',
            WebkitBackdropFilter: 'blur(22px) saturate(140%)',
            border: '1px solid var(--mave-edge, rgba(180, 190, 255, 0.14))',
            borderRadius: '20px',
            padding: '12px 18px',
            boxShadow: 'var(--mave-shadow-glass)',
            color: 'var(--mave-ink, #EEF0FB)',
            fontFamily: "var(--mave-font-sans, 'Manrope', sans-serif)",
            fontSize: '14px',
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'background var(--mave-dur-quick, 200ms) ease'
                  }}
                  title={expandDesc.tooltip}
                  aria-label={expandDesc.label}
                  data-testid="quick-response-expand"
                >
                  <span>Expand</span>
                  <ExpandIcon size={11} color="var(--mave-cyan, #5FD2FF)" />
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
                    padding: '2px 4px',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Dismiss quick response"
                  aria-label="Dismiss quick response"
                  data-testid="quick-response-dismiss"
                >
                  <CloseIcon size={12} color="var(--mave-faint, rgba(222, 226, 255, 0.38))" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          3. Main Presence Capsule (Restrained Morphing Geometry & Snug Gap)
          - Idle: 250 × 50, radius 25, centered Jost 300 wordmark
          - Active: min(460px, 30vw) × 50, radius 25, content-aware layout
          -------------------------------------------------------------------- */}
      <div
        style={{
          position: 'relative',
          width: isIdle
            ? '250px'
            : isThinking
            ? 'min(380px, 26vw)'
            : isError
            ? 'min(380px, 26vw)'
            : 'min(460px, 30vw)',
          maxWidth: 'min(480px, 92vw)',
          height: '50px',
          borderRadius: '25px',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.065), rgba(255, 255, 255, 0.018)), rgba(12, 14, 30, 0.60)',
          border: `1px solid ${borderColor}`,
          boxShadow: isIdle ? 'var(--mave-v2-presence-glow-resting)' : `${glowShadow}, var(--mave-shadow-pill)`,
          backdropFilter: 'blur(22px) saturate(140%)',
          WebkitBackdropFilter: 'blur(22px) saturate(140%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isIdle ? 'center' : 'flex-start',
          padding: '0 18px',
          boxSizing: 'border-box',
          gap: isIdle ? '12px' : '10px',
          overflow: 'hidden',
          transition: 'width 400ms cubic-bezier(0.16, 1, 0.3, 1), max-width 400ms cubic-bezier(0.16, 1, 0.3, 1), border-radius 350ms ease, opacity 350ms ease, transform 350ms ease, background-color 350ms ease, border-color 350ms ease, box-shadow 350ms ease',
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
            transition: 'left 400ms cubic-bezier(0.16, 1, 0.3, 1), width 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 350ms ease'
          }}
        />

        {/* ------------------------------------------------------------------
            IDLE LAYOUT: Resting Wordmark Only ([ M A V E ])
            Strictly no Orb, no status dot, no audio bars, no decorative dots,
            no stop/cancel, no expand icon, no state text.
            ------------------------------------------------------------------ */}
        {isIdle && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              cursor: onManualActivate || onWakeToggle ? 'pointer' : 'default'
            }}
            onClick={handleActivation}
            title="Manual activation: start listening"
            aria-label="Manual activation"
          >
            <span
              style={{
                fontFamily: "var(--mave-font-wordmark, 'Jost', sans-serif)",
                fontWeight: 300,
                fontSize: '18px',
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
              gap: '10px',
              minWidth: 0
            }}
          >
            {/* Identity Orb & Wordmark */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
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
                  fontSize: '16.5px',
                  letterSpacing: '0.36em',
                  paddingLeft: '0.36em',
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
                height: '20px',
                background: 'rgba(255, 255, 255, 0.12)',
                flexShrink: 0,
                margin: '0 2px'
              }}
            />

            {/* Waveform / Activity Region (Content-Aware, Zero Empty Gap) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
                overflow: 'hidden'
              }}
            >
              {/* Listening & Speaking: Compact Harmonic Waveform */}
              {(isListening || isSpeaking || isWaking) && (
                <HarmonicWaveform
                  audioLevel={audioLevel}
                  isSpeaking={isSpeaking}
                  width={120}
                  height={20}
                />
              )}

              {/* Thinking: Dedicated Non-Acoustic Living Wave (UI Kit Spec) */}
              {isThinking && <CognitiveWave />}

              {/* Error: Subdued Alert Notice */}
              {isError && (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--mave-err, #ff7a85)',
                    fontFamily: "var(--mave-font-sans, sans-serif)",
                    paddingLeft: '4px'
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
                gap: '6px',
                flexShrink: 0,
                marginLeft: 'auto'
              }}
              data-testid="presence-state-label"
            >
              <div
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: stateAccentColor,
                  boxShadow: `0 0 8px ${stateAccentColor}`
                }}
              />
              <span
                style={{
                  fontFamily: "var(--mave-font-sans, 'Manrope', sans-serif)",
                  fontSize: '13.5px',
                  fontWeight: 400,
                  color: 'var(--mave-dim, rgba(222, 226, 255, 0.60))',
                  whiteSpace: 'nowrap'
                }}
              >
                {stateLabel}
              </span>
            </div>

            {/* --------------------------------------------------------------
                Contextual Control Actions (Zero persistent stop/cancel in capsule)
                Only error retry appears contextually when truly needed.
                -------------------------------------------------------------- */}
            {isError && (onRetryError || onDismissError) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0
                }}
              >
                <button
                  onClick={onRetryError || onDismissError}
                  title={retryDesc.tooltip}
                  aria-label={retryDesc.label}
                  style={{
                    background: 'rgba(255, 122, 133, 0.1)',
                    border: '1px solid rgba(255, 122, 133, 0.35)',
                    color: 'var(--mave-err, #FF7A85)',
                    cursor: 'pointer',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition:
                      'background-color var(--mave-v2-motion-fast), border-color var(--mave-v2-motion-fast), color var(--mave-v2-motion-fast), transform var(--mave-v2-motion-fast), opacity var(--mave-v2-motion-fast)'
                  }}
                  data-testid="presence-action-retry-error"
                >
                  <RetryIcon size={12} color="var(--mave-err, #FF7A85)" />
                </button>
              </div>
            )}
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
          <ClockIcon size={13} color="var(--mave-cyan, #5FD2FF)" />
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

