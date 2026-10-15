import React from 'react';
import type { PresenceState, OrbSize } from '../types';

export interface AdaptivePresenceMarkProps {
  state?: PresenceState;
  size?: OrbSize;
  audioLevel?: number;
  className?: string;
  onClick?: () => void;
}

const SIZE_MAP: Record<OrbSize, number> = {
  hero: 64,
  medium: 40,
  compact: 28,
  status: 18
};

/**
 * AdaptivePresenceMark
 *
 * MAVE's visual identity mark. Adapts in size and motion across:
 * - Idle: calm breathing core
 * - Waking: active pulse
 * - Listening: audio-reactive acoustic waveform
 * - Thinking: purple orbital intelligence loop
 * - Speaking: cyan/blue vocal output waveform
 * - Error: red restrained alert state
 */
export const AdaptivePresenceMark: React.FC<AdaptivePresenceMarkProps> = ({
  state = 'idle',
  size = 'compact',
  audioLevel = 0,
  className = '',
  onClick
}) => {
  const pixelSize = SIZE_MAP[size];
  const boundedLevel = Math.max(0, Math.min(1, audioLevel));

  // Compute dynamic heights for acoustic bars in listening & speaking modes
  const bar1Scale = state === 'listening' || state === 'speaking'
    ? 0.5 + boundedLevel * 0.5
    : 0.6;
  const bar2Scale = state === 'listening' || state === 'speaking'
    ? 0.7 + boundedLevel * 0.7
    : 0.9;
  const bar3Scale = state === 'listening' || state === 'speaking'
    ? 0.55 + boundedLevel * 0.55
    : 0.65;

  // Semantic color per state
  const stateColor =
    state === 'thinking'
      ? 'var(--mave-v2-accent-thinking)'
      : state === 'error'
      ? 'var(--mave-v2-accent-error)'
      : state === 'listening' || state === 'waking'
      ? 'var(--mave-v2-accent-listening)'
      : 'var(--mave-v2-accent-retrieval)';

  return (
    <div
      className={`mave-v2-orb-container mave-v2-orb-${size} mave-v2-orb-state-${state} ${className}`.trim()}
      style={{
        width: pixelSize,
        height: pixelSize,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={`MAVE Status: ${state}`}
      data-testid="adaptive-presence-mark"
      data-state={state}
      data-size={size}
    >
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient id={`orbGrad-${size}-${state}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={stateColor} stopOpacity="0.9" />
            <stop offset="70%" stopColor={stateColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stateColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer ambient glow halo (only active when live) */}
        {state !== 'idle' && (
          <circle
            cx="20"
            cy="20"
            r="19"
            fill={`url(#orbGrad-${size}-${state})`}
            style={{
              animation:
                state === 'thinking'
                  ? 'mave-v2-orbit 2s linear infinite'
                  : state === 'waking'
                  ? 'mave-v2-pulse-ring 1.5s ease-out infinite'
                  : undefined
            }}
          />
        )}

        {/* Orbit ring for thinking state */}
        {state === 'thinking' && (
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="var(--mave-v2-accent-thinking)"
            strokeWidth="1.5"
            strokeDasharray="14 12"
            strokeLinecap="round"
            style={{ animation: 'mave-v2-orbit 2.2s linear infinite', transformOrigin: '20px 20px' }}
          />
        )}

        {/* Central Core Body */}
        <circle
          cx="20"
          cy="20"
          r={size === 'hero' ? 14 : size === 'medium' ? 13 : 12}
          fill="rgba(14, 20, 30, 0.88)"
          stroke={stateColor}
          strokeWidth={size === 'status' ? '1.2' : '1.8'}
          style={{
            animation: state === 'idle' ? 'mave-v2-breathe 4s ease-in-out infinite' : undefined
          }}
        />

        {/* Acoustic Bars / State glyph inside core */}
        {size !== 'status' && (
          <g transform="translate(14, 12)">
            {/* Left Bar */}
            <rect
              x="1"
              y={8 - 8 * bar1Scale}
              width="2.2"
              height={16 * bar1Scale}
              rx="1.1"
              fill={stateColor}
              style={{ transition: 'all 80ms ease-out' }}
            />
            {/* Center Bar */}
            <rect
              x="5"
              y={8 - 8 * bar2Scale}
              width="2.2"
              height={16 * bar2Scale}
              rx="1.1"
              fill={stateColor}
              style={{ transition: 'all 80ms ease-out' }}
            />
            {/* Right Bar */}
            <rect
              x="9"
              y={8 - 8 * bar3Scale}
              width="2.2"
              height={16 * bar3Scale}
              rx="1.1"
              fill={stateColor}
              style={{ transition: 'all 80ms ease-out' }}
            />
          </g>
        )}

        {/* Status dot for icon-scale */}
        {size === 'status' && (
          <circle cx="20" cy="20" r="4" fill={stateColor} />
        )}
      </svg>
    </div>
  );
};

