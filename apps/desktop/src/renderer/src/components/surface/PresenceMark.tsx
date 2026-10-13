import React from 'react';
import type { SurfaceMode } from '@mave/contracts';

export const VISUAL_NOISE_FLOOR = 0.03;

/**
 * Maps raw normalized RMS audio level [0.0, 1.0] to a perceptual visual intensity [0.0, 1.0].
 * - Suppresses ambient room noise (< 0.03).
 * - Applies a smooth non-linear vocal curve (exponent 0.6) for lively syllabic response.
 * - Clamps strictly between 0.0 and 1.0. Guarantees no NaN, negative, or infinite values.
 */
export function computeVisualIntensity(level: number, noiseGate: number = VISUAL_NOISE_FLOOR): number {
  if (!Number.isFinite(level) || level <= noiseGate) {
    return 0;
  }
  const clamped = Math.min(Math.max(level, 0), 1);
  const normalized = (clamped - noiseGate) / (1 - noiseGate);
  const curved = Math.pow(normalized, 0.6);
  return Math.min(Math.max(curved, 0), 1);
}

export interface BarScales {
  left: number;
  center: number;
  right: number;
}

/**
 * Computes deterministic coordinated vertical scaling factors for the 3 acoustic bars.
 * Center bar provides the primary vocal excursion (strongest response, up to 1.50x).
 * Left bar provides medium excursion (up to 1.15x).
 * Right bar provides alternate excursion (up to 1.25x).
 */
export function computeBarScales(mode: SurfaceMode, intensity: number): BarScales {
  const boundedIntensity = Math.min(Math.max(intensity, 0), 1);

  if (mode === 'listening') {
    // Gentle active baseline at silence (0.65 / 0.85 / 0.70)
    // Dynamic speech excursion during user utterances
    return {
      left: Number((0.65 + boundedIntensity * 0.50).toFixed(3)),
      center: Number((0.85 + boundedIntensity * 0.65).toFixed(3)),
      right: Number((0.70 + boundedIntensity * 0.55).toFixed(3))
    };
  }

  if (mode === 'speaking') {
    // Relaxed baseline during natural pauses (0.55 / 0.75 / 0.60)
    // Full syllabic excursion during assistant speech output
    return {
      left: Number((0.55 + boundedIntensity * 0.55).toFixed(3)),
      center: Number((0.75 + boundedIntensity * 0.75).toFixed(3)),
      right: Number((0.60 + boundedIntensity * 0.65).toFixed(3))
    };
  }

  // Ambient, thinking, error, or other modes: standard baseline (scale 1.0)
  return {
    left: 1,
    center: 1,
    right: 1
  };
}

export interface PresenceMarkProps {
  /**
   * High-level surface presentation mode.
   */
  mode?: SurfaceMode;

  /**
   * Normalized input audio level (0.0 - 1.0) from microphone capture.
   * Drives visual dynamics when mode is 'listening'.
   */
  inputLevel?: number;

  /**
   * Normalized output audio level (0.0 - 1.0) from TTS/speaker playback.
   * Drives visual dynamics when mode is 'speaking'.
   */
  outputLevel?: number;

  /**
   * Optional visual intensity override (0.0 - 1.0).
   */
  intensity?: number;

  /**
   * Optional custom class name.
   */
  className?: string;
}

/**
 * MAVE Presence Mark
 *
 * Lightweight, hardware-composited SVG visual identity primitive.
 * Pure DOM/CSS implementation with zero WebGL/3D overhead.
 * Voice-reactive in listening and speaking modes via CSS custom properties.
 */
export const PresenceMark: React.FC<PresenceMarkProps> = React.memo(({
  mode = 'ambient',
  inputLevel,
  outputLevel,
  intensity,
  className = ''
}) => {
  // Mode source resolution
  let effectiveLevel = 0;
  if (typeof intensity === 'number') {
    effectiveLevel = intensity;
  } else if (mode === 'listening') {
    effectiveLevel = inputLevel ?? 0;
  } else if (mode === 'speaking') {
    effectiveLevel = outputLevel ?? 0;
  }
  // Ambient, thinking, error, etc. retain effectiveLevel = 0

  const visualIntensity = typeof intensity === 'number'
    ? Math.min(Math.max(intensity, 0), 1)
    : computeVisualIntensity(effectiveLevel);

  const barScales = computeBarScales(mode, visualIntensity);

  const modeModifier = `mave-presence-mark--${mode}`;
  const cssVariables = {
    '--mave-energy': visualIntensity.toFixed(3),
    '--mave-bar-left-scale': barScales.left.toString(),
    '--mave-bar-center-scale': barScales.center.toString(),
    '--mave-bar-right-scale': barScales.right.toString()
  } as React.CSSProperties;

  return (
    <div
      className={`mave-presence-mark ${modeModifier} ${className}`.trim()}
      style={cssVariables}
      aria-hidden="true"
      data-testid="mave-presence-mark"
      data-mode={mode}
      data-intensity={visualIntensity.toFixed(3)}
    >
      <svg
        className="mave-presence-svg"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left acoustic bar */}
        <rect
          className="mave-presence-bar"
          x="4"
          y="7"
          width="3.2"
          height="10"
          rx="1.6"
        />
        {/* Central kinetic core bar */}
        <rect
          className="mave-presence-bar"
          x="10.4"
          y="4"
          width="3.2"
          height="16"
          rx="1.6"
        />
        {/* Right acoustic bar */}
        <rect
          className="mave-presence-bar"
          x="16.8"
          y="7"
          width="3.2"
          height="10"
          rx="1.6"
        />
      </svg>
    </div>
  );
});

PresenceMark.displayName = 'PresenceMark';
