import React from 'react';
import type { PresenceState, OrbSize } from '../types';
import { normalizeAudioRms } from '../presence/presence-rules';
import '../tokens.css';

export interface AdaptivePresenceMarkProps {
  state?: PresenceState;
  size?: OrbSize;
  audioLevel?: number;
  className?: string;
  onClick?: () => void;
}

const SIZE_MAP: Record<OrbSize, number> = {
  hero: 52,
  medium: 36,
  compact: 24,
  status: 14
};

/**
 * AdaptivePresenceMark
 *
 * MAVE's visual identity mark.
 * Derived from authentic UI Kit & Prototype source (mave-showcase.jsx / Orb).
 *
 * Vector / pure CSS implementation:
 * - Idle: calm, luminous focal core (radial cyan -> violet), zero outer glow
 * - Waking: fast intentional pulse ("I heard you")
 * - Listening: luminous presence with active vocal resonance & acoustic micro-bars
 * - Thinking: restrained cognitive orbit arc (low visual noise, no fake progress)
 * - Speaking: active voice resonance & acoustic micro-bars
 * - Error: calm restrained alert indicator
 */
export const AdaptivePresenceMark: React.FC<AdaptivePresenceMarkProps> = ({
  state = 'idle',
  size = 'compact',
  audioLevel = 0,
  className = '',
  onClick
}) => {
  const pixelSize = SIZE_MAP[size];
  const normalizedAudio = normalizeAudioRms(audioLevel);

  const isAudioActive = (state === 'listening' || state === 'speaking') && size !== 'status';
  const bar1Scale = isAudioActive ? 0.35 + normalizedAudio * 0.65 : 0.45;
  const bar2Scale = isAudioActive ? 0.45 + normalizedAudio * 0.75 : 0.60;
  const bar3Scale = isAudioActive ? 0.35 + normalizedAudio * 0.65 : 0.45;

  const stateColor =
    state === 'error'
      ? 'var(--mave-err, #ff7a85)'
      : state === 'thinking'
      ? 'var(--mave-violet, #9a72ff)'
      : state === 'listening' || state === 'waking'
      ? 'var(--mave-cyan, #5fd2ff)'
      : state === 'speaking'
      ? 'var(--mave-cyan, #5fd2ff)'
      : 'var(--mave-cyan, #5fd2ff)';

  const glowBoxShadow =
    state === 'idle'
      ? 'none'
      : state === 'error'
      ? '0 0 12px rgba(255, 122, 133, 0.45)'
      : state === 'thinking'
      ? '0 0 14px rgba(154, 114, 255, 0.5)'
      : state === 'listening'
      ? '0 0 14px rgba(95, 210, 255, 0.5)'
      : state === 'speaking'
      ? '0 0 14px rgba(95, 210, 255, 0.45)'
      : '0 0 12px rgba(154, 114, 255, 0.4)';

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
          <radialGradient id={`orbGrad-${size}-${state}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#5fd2ff" />
            <stop offset="70%" stopColor="#9a72ff" />
          </radialGradient>
          <radialGradient id={`orbAlert-${size}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ff7a85" />
            <stop offset="70%" stopColor="#dc2626" />
          </radialGradient>
        </defs>

        {/* Waking state intentional pulse ring */}
        {state === 'waking' && (
          <circle
            cx="20"
            cy="20"
            r="19"
            stroke="rgba(95, 210, 255, 0.6)"
            strokeWidth="1.5"
            fill="none"
            style={{ animation: 'mave-v2-wake-pulse 0.5s ease-out' }}
          />
        )}

        {/* Thinking state restrained cognitive orbit arc */}
        {state === 'thinking' && (
          <circle
            cx="20"
            cy="20"
            r="17"
            stroke="var(--mave-violet, #9a72ff)"
            strokeWidth="1.5"
            strokeDasharray="8 22"
            strokeLinecap="round"
            opacity="0.85"
            style={{ animation: 'mave-v2-orbit 3.5s linear infinite', transformOrigin: '20px 20px' }}
          />
        )}

        {/* Central Core Body */}
        <circle
          cx="20"
          cy="20"
          r={size === 'hero' ? 14 : size === 'medium' ? 12 : size === 'compact' ? 10 : 6}
          fill={state === 'error' ? `url(#orbAlert-${size})` : `url(#orbGrad-${size}-${state})`}
          style={{
            boxShadow: glowBoxShadow,
            filter: state !== 'idle' ? 'drop-shadow(0 0 6px rgba(154, 114, 255, 0.45))' : 'none',
            animation: state === 'idle' ? 'mave-v2-breathe 4.8s ease-in-out infinite' : undefined
          }}
        />

        {/* Specular Glint Highlight */}
        {size !== 'status' && !isAudioActive && (
          <circle
            cx={16.5}
            cy={16.5}
            r={size === 'hero' ? 2.5 : size === 'medium' ? 2.0 : 1.6}
            fill="#ffffff"
            opacity={0.8}
          />
        )}

        {/* Acoustic micro-bars exclusively during active audio (listening or speaking) */}
        {isAudioActive && (
          <g transform="translate(14, 12)">
            <rect
              x="1"
              y={8 - 8 * bar1Scale}
              width="2.2"
              height={16 * bar1Scale}
              rx="1.1"
              fill="#ffffff"
              opacity={0.9}
              style={{ transition: 'y 80ms ease-out, height 80ms ease-out, opacity 80ms ease-out' }}
            />
            <rect
              x="5"
              y={8 - 8 * bar2Scale}
              width="2.2"
              height={16 * bar2Scale}
              rx="1.1"
              fill="#ffffff"
              opacity={0.95}
              style={{ transition: 'y 80ms ease-out, height 80ms ease-out, opacity 80ms ease-out' }}
            />
            <rect
              x="9"
              y={8 - 8 * bar3Scale}
              width="2.2"
              height={16 * bar3Scale}
              rx="1.1"
              fill="#ffffff"
              opacity={0.9}
              style={{ transition: 'y 80ms ease-out, height 80ms ease-out, opacity 80ms ease-out' }}
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
