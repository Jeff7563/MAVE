import type { SurfaceSizeClass } from '@mave/contracts';

export interface SurfaceEnvelope {
  width: number;
  height: number;
}

/**
 * Canonical native window size envelopes (in Device-Independent Pixels, DIP).
 *
 * One source of truth for the native hybrid envelope sizing architecture.
 * Internal fluid CSS morphing occurs inside these bounds in the Renderer.
 */
export const SURFACE_ENVELOPES: Record<SurfaceSizeClass, SurfaceEnvelope> = {
  ambient: { width: 280, height: 80 },
  compact: { width: 280, height: 80 },
  card: { width: 360, height: 180 },
  expanded: { width: 440, height: 580 }
} as const;

export const DEFAULT_SURFACE_MARGIN_DIP = 16;

export interface WorkAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NativeSurfaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CalculateSurfaceBoundsOptions {
  workArea: WorkAreaRect;
  sizeClass: SurfaceSizeClass;
  margin?: number;
}

/**
 * Calculates bottom-right anchored native window bounds within the usable display work area.
 *
 * TASKBAR & MULTI-MONITOR SAFETY:
 * - Operates strictly on `display.workArea`, which subtracts taskbar geometry (bottom, top, left, right).
 * - Correctly handles negative display coordinates (e.g. secondary displays positioned left/above primary).
 * - Anchors to the bottom-right corner: size expansions grow upward and leftward so the corner remains fixed.
 */
export function calculateSurfaceBounds(
  options: CalculateSurfaceBoundsOptions
): NativeSurfaceBounds {
  const margin = options.margin ?? DEFAULT_SURFACE_MARGIN_DIP;
  const envelope = SURFACE_ENVELOPES[options.sizeClass];

  const targetWidth = Math.min(envelope.width, Math.max(100, options.workArea.width - margin * 2));
  const targetHeight = Math.min(envelope.height, Math.max(50, options.workArea.height - margin * 2));

  const x = Math.round(options.workArea.x + options.workArea.width - targetWidth - margin);
  const y = Math.round(options.workArea.y + options.workArea.height - targetHeight - margin);

  return {
    x,
    y,
    width: targetWidth,
    height: targetHeight
  };
}

export interface SimpleDisplay {
  id: number;
  bounds: WorkAreaRect;
  workArea: WorkAreaRect;
}

export interface SimplePoint {
  x: number;
  y: number;
}

/**
 * Deterministic display lock manager for multi-monitor stability.
 *
 * STABILITY INVARIANT:
 * - When Ambient Surface is passive/hidden, it targets whichever display currently contains the mouse cursor.
 * - When Ambient Surface activates (listening, thinking, speaking, card, expanded), it LOCKS to that display.
 * - While active, it does NOT jump between monitors if the user moves their mouse.
 * - When returning to idle ambient or hidden, the lock is released.
 */
export class DisplayLockManager {
  private lockedDisplayId: number | null = null;

  public isLocked(): boolean {
    return this.lockedDisplayId !== null;
  }

  public getLockedDisplayId(): number | null {
    return this.lockedDisplayId;
  }

  public lock(displayId: number): void {
    this.lockedDisplayId = displayId;
  }

  public unlock(): void {
    this.lockedDisplayId = null;
  }

  /**
   * Resolves the target display from available displays and cursor point.
   */
  public resolveTargetDisplay<T extends SimpleDisplay>(
    displays: T[],
    cursorPoint: SimplePoint,
    fallbackDisplay: T,
    preferredDisplayId?: number | null
  ): T {
    if (displays.length === 0) {
      return fallbackDisplay;
    }

    // 1. If currently locked, check if the locked display is still connected
    if (this.lockedDisplayId !== null) {
      const locked = displays.find((d) => d.id === this.lockedDisplayId);
      if (locked) {
        return locked;
      }
      // Locked display was disconnected -> release lock and fall through
      this.unlock();
    }

    // 2. If preferred display is configured and currently connected, prioritize it
    if (typeof preferredDisplayId === 'number') {
      const preferred = displays.find((d) => d.id === preferredDisplayId);
      if (preferred) {
        return preferred;
      }
    }

    // 3. Select display containing cursor point
    const cursorDisplay = displays.find((d) => {
      const b = d.bounds;
      return (
        cursorPoint.x >= b.x &&
        cursorPoint.x < b.x + b.width &&
        cursorPoint.y >= b.y &&
        cursorPoint.y < b.y + b.height
      );
    });

    if (cursorDisplay) {
      return cursorDisplay;
    }

    // 4. Fallback to primary fallback or first display
    return fallbackDisplay ?? displays[0];
  }
}

