import React from 'react';
import type { SurfaceMode } from '@mave/contracts';

export interface PresenceMarkProps {
  /**
   * High-level surface presentation mode.
   */
  mode?: SurfaceMode;

  /**
   * Static visual intensity placeholder for future audio reactivity (M4.4).
   * Range: 0.0 - 1.0 (defaults to 0 in M4.3).
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
 */
export const PresenceMark: React.FC<PresenceMarkProps> = ({
  mode = 'ambient',
  className = ''
}) => {
  const modeModifier = `mave-presence-mark--${mode}`;

  return (
    <div
      className={`mave-presence-mark ${modeModifier} ${className}`.trim()}
      aria-hidden="true"
      data-testid="mave-presence-mark"
      data-mode={mode}
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
};
