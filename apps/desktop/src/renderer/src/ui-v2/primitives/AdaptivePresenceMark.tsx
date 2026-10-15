import React from 'react';
import type { PresenceState, OrbSize } from '../types';
import { normalizeAudioRms } from '../presence/presence-rules';

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
 * - Idle: quiet, calm resting core (zero outer glow)
 * - Waking: fast intentional pulse ("I heard you")
 * - Listening: audio-reactive acoustic waveform reacting to normalized RMS
 * - Thinking: restrained subtle cognitive loop (low visual noise, no fake progress)
 * - Speaking: vocal playback wave
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

  // Compute dynamic heights for acoustic bars in listening & speaking modes
  const isAudioActive = state === 'listening' || state === 'speaking';
  const bar1Scale = isAudioActive ? 0.35 + normalizedAudio * 0.65 : 0.45;
  const bar2Scale = isAudioActive ? 0.45 + normalizedAudio * 0.75 : 0.60;
  const bar3Scale = isAudioActive ? 0.35 + normalizedAudio * 0.65 : 0.45;

  // Semantic color per state
  const stateColor =
    state === 'thinking'
      ? 'var(--mave-v2-accent-thinking)'
      : state === 'error'
      ? 'var(--mave-v2-accent-error)'
      : state === 'listening' || state === 'waking'
      ? 'var(--mave-v2-accent-listening)'
      : state === 'speaking'
      ? 'var(--mave-v2-accent-thinking)'
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
          <radialGradient id={`orbCoreGrad-${size}-${state}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(30, 41, 59, 0.95)" />
            <stop offset="50%" stopColor="rgba(15, 23, 42, 0.98)" />
            <stop offset="100%" stopColor="rgba(8, 11, 20, 1.0)" />
          </radialGradient>
          <radialGradient id={`orbLuminousCore-${size}`} cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#818cf8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer ambient glow halo (strictly active only when live/working, zero outer glow in resting idle) */}
        {state !== 'idle' && (
          <circle
            cx="20"
            cy="20"
            r="19"
            fill={`url(#orbGrad-${size}-${state})`}
            opacity={state === 'thinking' ? 0.35 : 0.75}
            style={{
              animation:
                state === 'waking'
                  ? 'mave-v2-wake-pulse 0.5s ease-out'
                  : state === 'thinking'
                  ? 'mave-v2-restrained-thinking 2.5s ease-in-out infinite'
                  : undefined
            }}
          />
        )}

        {/* Subtle Outer Concentric Ring in Resting Idle (Showcase v3 Spatial Presence) */}
        {state === 'idle' && size !== 'status' && (
          <circle
            cx="20"
            cy="20"
            r={size === 'hero' ? 18 : size === 'medium' ? 16 : 15}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="0.8"
            fill="none"
          />
        )}

        {/* Restrained cognitive arc for thinking state (low visual noise, no fake progress) */}
        {state === 'thinking' && (
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="var(--mave-v2-accent-thinking)"
            strokeWidth="1.2"
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
          r={size === 'hero' ? 14 : size === 'medium' ? 13 : 12}
          fill={`url(#orbCoreGrad-${size}-${state})`}
          stroke={state === 'idle' ? 'rgba(56, 189, 248, 0.45)' : stateColor}
          strokeWidth={size === 'status' ? '1.2' : '1.5'}
          style={{
            animation: state === 'idle' ? 'mave-v2-breathe 4s ease-in-out infinite' : undefined
          }}
        />

        {/* State-specific Content Inside Core */}
        {size !== 'status' && (
          <>
            {/* 1. Acoustic Bars exclusively during active audio (listening or speaking) */}
            {isAudioActive && (
              <g transform="translate(14, 12)">
                <rect
                  x="1"
                  y={8 - 8 * bar1Scale}
                  width="2.2"
                  height={16 * bar1Scale}
                  rx="1.1"
                  fill={stateColor}
                  style={{ transition: 'all 80ms ease-out' }}
                />
                <rect
                  x="5"
                  y={8 - 8 * bar2Scale}
                  width="2.2"
                  height={16 * bar2Scale}
                  rx="1.1"
                  fill={stateColor}
                  style={{ transition: 'all 80ms ease-out' }}
                />
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

            {/* 2. Luminous MAVE Focal Orb Core (Idle & Waking states — NOT pause bars) */}
            {(state === 'idle' || state === 'waking') && (
              <g>
                <circle
                  cx="20"
                  cy="20"
                  r={size === 'hero' ? 5.5 : size === 'medium' ? 4.5 : 3.8}
                  fill={`url(#orbLuminousCore-${size})`}
                  style={{
                    filter: 'drop-shadow(0 0 3px rgba(56, 189, 248, 0.65))'
                  }}
                />
                <circle
                  cx={size === 'hero' ? 18.6 : 18.8}
                  cy={size === 'hero' ? 18.6 : 18.8}
                  r={size === 'hero' ? 1.6 : 1.2}
                  fill="#ffffff"
                  opacity="0.9"
                />
              </g>
            )}

            {/* 3. Thinking Inner Core */}
            {state === 'thinking' && (
              <circle
                cx="20"
                cy="20"
                r={size === 'hero' ? 5 : size === 'medium' ? 4 : 3.5}
                fill="var(--mave-v2-accent-thinking)"
                opacity="0.85"
                style={{
                  filter: 'drop-shadow(0 0 4px rgba(168, 85, 247, 0.7))',
                  animation: 'mave-v2-restrained-thinking 2.5s ease-in-out infinite'
                }}
              />
            )}

            {/* 4. Error Alert Dot */}
            {state === 'error' && (
              <circle
                cx="20"
                cy="20"
                r={size === 'hero' ? 5 : size === 'medium' ? 4 : 3.5}
                fill="var(--mave-v2-accent-error)"
                style={{
                  filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.7))'
                }}
              />
            )}
          </>
        )}

        {/* Status dot for icon-scale */}
        {size === 'status' && (
          <circle cx="20" cy="20" r="4" fill={stateColor} />
        )}
      </svg>
    </div>
  );
};

