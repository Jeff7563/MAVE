import type { SurfaceSizeClass, SurfaceSnapshot } from '@mave/contracts';
import { SURFACE_ENVELOPES } from './bounds-calculator.js';

export type SurfaceTransitionType = 'none' | 'expand' | 'collapse';
export type SurfaceTransitionPhase = 'idle' | 'expanding' | 'collapsing';

export interface TransitionClock {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const defaultClock: TransitionClock = {
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (id) => clearTimeout(id as NodeJS.Timeout)
};

export const DEFAULT_COLLAPSE_DELAY_MS = 260; // 250ms CSS normal motion + 10ms compositor buffer
export const DEFAULT_EXPAND_SETTLE_MS = 260;

export interface TransitionDiagnostics {
  currentSizeClass: SurfaceSizeClass;
  targetSizeClass: SurfaceSizeClass;
  state: SurfaceTransitionPhase;
  revision: number;
  hasPendingShrink: boolean;
}

export interface TransitionCallbacks {
  applyBounds(sizeClass: SurfaceSizeClass): void;
  broadcastSnapshot(snapshot: SurfaceSnapshot): void;
}

export interface SurfaceTransitionCoordinatorOptions {
  initialSizeClass?: SurfaceSizeClass;
  collapseDelayMs?: number;
  expandSettleMs?: number;
  clock?: TransitionClock;
}

/**
 * SurfaceTransitionCoordinator
 *
 * Deterministic Main-process coordinator managing the asymmetric lifecycle of native
 * BrowserWindow envelope resizing and renderer presentation morphing.
 *
 * CORE ARCHITECTURAL INVARIANTS:
 * 1. ASYMMETRIC SEQUENCING:
 *    - Expansion: Native window bounds expand FIRST -> Renderer morphs into the room.
 *    - Collapse:  Renderer morphs inward FIRST -> Native bounds shrink after 260ms.
 * 2. STALE REVISION PROTECTION:
 *    - Every transition increments a monotonic `transitionRevision`.
 *    - If an expansion or new intent arrives during a pending collapse, the old shrink
 *      timer is cancelled and discarded. Stale shrink callbacks are strictly no-ops.
 * 3. NO 60 FPS SETBOUNDS LOOP:
 *    - Exactly ONE native `setBounds` per semantic envelope change.
 */
export class SurfaceTransitionCoordinator {
  private currentNativeSizeClass: SurfaceSizeClass;
  private targetSizeClass: SurfaceSizeClass;
  private state: SurfaceTransitionPhase = 'idle';
  private revision = 0;
  private pendingTimerId: unknown = null;
  private readonly collapseDelayMs: number;
  private readonly expandSettleMs: number;
  private readonly clock: TransitionClock;

  constructor(options: SurfaceTransitionCoordinatorOptions = {}) {
    this.currentNativeSizeClass = options.initialSizeClass ?? 'ambient';
    this.targetSizeClass = this.currentNativeSizeClass;
    this.collapseDelayMs = options.collapseDelayMs ?? DEFAULT_COLLAPSE_DELAY_MS;
    this.expandSettleMs = options.expandSettleMs ?? DEFAULT_EXPAND_SETTLE_MS;
    this.clock = options.clock ?? defaultClock;
  }

  /**
   * Plans the transition type by comparing the native envelope areas.
   */
  public planTransition(
    fromClass: SurfaceSizeClass,
    toClass: SurfaceSizeClass
  ): SurfaceTransitionType {
    if (fromClass === toClass) return 'none';

    const fromEnv = SURFACE_ENVELOPES[fromClass];
    const toEnv = SURFACE_ENVELOPES[toClass];

    if (fromEnv.width === toEnv.width && fromEnv.height === toEnv.height) {
      return 'none';
    }

    if (toEnv.width > fromEnv.width || toEnv.height > fromEnv.height) {
      return 'expand';
    }

    return 'collapse';
  }

  /**
   * Processes a snapshot update through the transition state machine.
   */
  public handleSnapshot(
    snapshot: SurfaceSnapshot,
    callbacks: TransitionCallbacks
  ): void {
    const isHidden = snapshot.visibility === 'hidden' || snapshot.mode === 'hidden';
    const nextSizeClass = snapshot.sizeClass;
    this.targetSizeClass = nextSizeClass;

    // 1. Immediate Dismissal / Hidden Policy
    if (isHidden) {
      this.cancelPendingTimer();
      this.revision++;
      this.state = 'idle';
      if (this.currentNativeSizeClass !== nextSizeClass) {
        callbacks.applyBounds(nextSizeClass);
        this.currentNativeSizeClass = nextSizeClass;
      }
      callbacks.broadcastSnapshot(snapshot);
      return;
    }

    // 2. Determine Transition Type
    const transitionType = this.planTransition(this.currentNativeSizeClass, nextSizeClass);

    if (transitionType === 'none') {
      // If we landed on the target size (or same-dimension envelope), cancel any pending shrink
      if (this.currentNativeSizeClass === nextSizeClass) {
        this.cancelPendingTimer();
        this.state = 'idle';
      }
      callbacks.broadcastSnapshot(snapshot);
      return;
    }

    if (transitionType === 'expand') {
      // EXPANSION SEQUENCE:
      // 1. Cancel any pending collapse shrink timer immediately
      this.cancelPendingTimer();
      const currentRev = ++this.revision;
      this.state = 'expanding';

      // 2. Expand native window bounds FIRST so space is ready
      callbacks.applyBounds(nextSizeClass);
      this.currentNativeSizeClass = nextSizeClass;

      // 3. Broadcast snapshot so renderer morphs into the newly expanded envelope
      callbacks.broadcastSnapshot(snapshot);

      // 4. Settle transition state back to idle
      this.pendingTimerId = this.clock.setTimeout(() => {
        if (this.revision === currentRev) {
          this.state = 'idle';
          this.pendingTimerId = null;
        }
      }, this.expandSettleMs);
      return;
    }

    if (transitionType === 'collapse') {
      // COLLAPSE SEQUENCE:
      // 1. Cancel previous pending timer
      this.cancelPendingTimer();
      const currentRev = ++this.revision;
      this.state = 'collapsing';

      // 2. Broadcast snapshot FIRST so renderer begins animating inward
      callbacks.broadcastSnapshot(snapshot);

      // 3. Schedule native bounds shrink AFTER visual collapse finishes
      this.pendingTimerId = this.clock.setTimeout(() => {
        // Stale Revision Guard:
        // If a newer transition superseded this one, do NOT shrink native bounds!
        if (this.revision === currentRev) {
          callbacks.applyBounds(nextSizeClass);
          this.currentNativeSizeClass = nextSizeClass;
          this.state = 'idle';
          this.pendingTimerId = null;
        }
      }, this.collapseDelayMs);
    }
  }

  /**
   * Immediately resets current native size class tracker (e.g. after display change or manual setBounds).
   */
  public resetNativeSizeClass(sizeClass: SurfaceSizeClass): void {
    this.currentNativeSizeClass = sizeClass;
    this.targetSizeClass = sizeClass;
    this.cancelPendingTimer();
    this.state = 'idle';
  }

  public getDiagnostics(): TransitionDiagnostics {
    return {
      currentSizeClass: this.currentNativeSizeClass,
      targetSizeClass: this.targetSizeClass,
      state: this.state,
      revision: this.revision,
      hasPendingShrink: this.pendingTimerId !== null && this.state === 'collapsing'
    };
  }

  public dispose(): void {
    this.cancelPendingTimer();
    this.state = 'idle';
  }

  private cancelPendingTimer(): void {
    if (this.pendingTimerId !== null) {
      this.clock.clearTimeout(this.pendingTimerId);
      this.pendingTimerId = null;
    }
  }
}
