import { describe, it, expect, vi } from 'vitest';
import type { SurfaceSnapshot } from '@mave/contracts';
import {
  SurfaceTransitionCoordinator,
  type TransitionClock
} from '../src/main/surface/surface-transition-coordinator.js';

class MockClock implements TransitionClock {
  private timers: { id: number; cb: () => void; time: number }[] = [];
  private nextId = 1;
  public currentTime = 0;

  setTimeout(callback: () => void, ms: number): number {
    const id = this.nextId++;
    this.timers.push({ id, cb: callback, time: this.currentTime + ms });
    return id;
  }

  clearTimeout(id: unknown): void {
    this.timers = this.timers.filter((t) => t.id !== id);
  }

  tick(ms: number): void {
    this.currentTime += ms;
    const due = this.timers.filter((t) => t.time <= this.currentTime);
    this.timers = this.timers.filter((t) => t.time > this.currentTime);
    for (const timer of due) {
      timer.cb();
    }
  }

  getTimerCount(): number {
    return this.timers.length;
  }
}

function createSnapshot(overrides: Partial<SurfaceSnapshot> = {}): SurfaceSnapshot {
  return {
    version: 1,
    mode: 'ambient',
    visibility: 'visible',
    sizeClass: 'ambient',
    interactionMode: 'passive',
    focusIntent: 'preserve',
    pinned: false,
    activity: 'idle',
    source: 'voice',
    priority: 'normal',
    inputLevel: 0,
    outputLevel: 0,
    updatedAt: Date.now(),
    ...overrides
  };
}

describe('SurfaceTransitionCoordinator (M4.5 Adaptive Envelope System)', () => {
  it('correctly plans transition types based on canonical envelope dimensions', () => {
    const coordinator = new SurfaceTransitionCoordinator();

    // Same envelope size
    expect(coordinator.planTransition('ambient', 'ambient')).toBe('none');
    expect(coordinator.planTransition('ambient', 'compact')).toBe('none');
    expect(coordinator.planTransition('compact', 'ambient')).toBe('none');

    // Expansion
    expect(coordinator.planTransition('compact', 'card')).toBe('expand');
    expect(coordinator.planTransition('card', 'expanded')).toBe('expand');
    expect(coordinator.planTransition('compact', 'expanded')).toBe('expand');
    expect(coordinator.planTransition('ambient', 'expanded')).toBe('expand');

    // Collapse
    expect(coordinator.planTransition('expanded', 'card')).toBe('collapse');
    expect(coordinator.planTransition('card', 'compact')).toBe('collapse');
    expect(coordinator.planTransition('expanded', 'compact')).toBe('collapse');
    expect(coordinator.planTransition('card', 'ambient')).toBe('collapse');
    expect(coordinator.planTransition('expanded', 'ambient')).toBe('collapse');
  });

  it('expansion applies native bounds immediately before broadcasting snapshot', () => {
    const clock = new MockClock();
    const coordinator = new SurfaceTransitionCoordinator({
      initialSizeClass: 'compact',
      clock
    });

    const calls: string[] = [];
    const applyBounds = vi.fn((sizeClass) => calls.push(`applyBounds:${sizeClass}`));
    const broadcastSnapshot = vi.fn((snap) => calls.push(`broadcastSnapshot:${snap.sizeClass}`));

    const snapshot = createSnapshot({ mode: 'compact_response', sizeClass: 'card' });
    coordinator.handleSnapshot(snapshot, { applyBounds, broadcastSnapshot });

    // Invariant: Native resize happens FIRST, then broadcast
    expect(calls).toEqual(['applyBounds:card', 'broadcastSnapshot:card']);
    expect(coordinator.getDiagnostics().state).toBe('expanding');
    expect(coordinator.getDiagnostics().currentSizeClass).toBe('card');

    // Settle after expansion duration
    clock.tick(300);
    expect(coordinator.getDiagnostics().state).toBe('idle');
  });

  it('collapse broadcasts snapshot first and delays native bounds shrink by collapse duration', () => {
    const clock = new MockClock();
    const coordinator = new SurfaceTransitionCoordinator({
      initialSizeClass: 'expanded',
      collapseDelayMs: 260,
      clock
    });

    const calls: string[] = [];
    const applyBounds = vi.fn((sizeClass) => calls.push(`applyBounds:${sizeClass}`));
    const broadcastSnapshot = vi.fn((snap) => calls.push(`broadcastSnapshot:${snap.sizeClass}`));

    const snapshot = createSnapshot({ mode: 'compact_response', sizeClass: 'card' });
    coordinator.handleSnapshot(snapshot, { applyBounds, broadcastSnapshot });

    // Invariant: Snapshot broadcasted immediately so renderer starts visual collapse
    expect(calls).toEqual(['broadcastSnapshot:card']);
    expect(coordinator.getDiagnostics().state).toBe('collapsing');
    expect(coordinator.getDiagnostics().currentSizeClass).toBe('expanded'); // Still expanded during animation!
    expect(coordinator.getDiagnostics().hasPendingShrink).toBe(true);

    // After 200ms (still morphing): native bounds have NOT shrunk
    clock.tick(200);
    expect(applyBounds).not.toHaveBeenCalled();

    // After remaining 70ms (total 270ms > 260ms): native bounds shrink safely
    clock.tick(70);
    expect(calls).toEqual(['broadcastSnapshot:card', 'applyBounds:card']);
    expect(coordinator.getDiagnostics().state).toBe('idle');
    expect(coordinator.getDiagnostics().currentSizeClass).toBe('card');
  });

  it('stale collapse protection: newer expansion cancels pending collapse shrink', () => {
    const clock = new MockClock();
    const coordinator = new SurfaceTransitionCoordinator({
      initialSizeClass: 'expanded',
      collapseDelayMs: 260,
      clock
    });

    const calls: string[] = [];
    const applyBounds = vi.fn((sizeClass) => calls.push(`applyBounds:${sizeClass}`));
    const broadcastSnapshot = vi.fn((snap) => calls.push(`broadcastSnapshot:${snap.sizeClass}`));

    // 1. Begin collapse from expanded -> card
    const snapCollapse = createSnapshot({ mode: 'compact_response', sizeClass: 'card' });
    coordinator.handleSnapshot(snapCollapse, { applyBounds, broadcastSnapshot });
    expect(coordinator.getDiagnostics().state).toBe('collapsing');
    expect(coordinator.getDiagnostics().revision).toBe(1);

    // 2. 100ms in, user explicitly expands back to expanded
    clock.tick(100);
    const snapExpand = createSnapshot({ mode: 'expanded_response', sizeClass: 'expanded' });
    coordinator.handleSnapshot(snapExpand, { applyBounds, broadcastSnapshot });

    // Since currentNativeSizeClass is still 'expanded', it cancels the shrink and settles
    expect(coordinator.getDiagnostics().hasPendingShrink).toBe(false);
    expect(coordinator.getDiagnostics().revision).toBe(1);

    // 3. Tick past original 260ms: verify card bounds are NEVER applied!
    clock.tick(300);
    expect(applyBounds).not.toHaveBeenCalled();
    expect(coordinator.getDiagnostics().currentSizeClass).toBe('expanded');
  });

  it('stale collapse protection: newer intent supersedes revision', () => {
    const clock = new MockClock();
    const coordinator = new SurfaceTransitionCoordinator({
      initialSizeClass: 'expanded',
      collapseDelayMs: 260,
      clock
    });

    const appliedBounds: string[] = [];
    const applyBounds = vi.fn((sizeClass) => appliedBounds.push(sizeClass));
    const broadcastSnapshot = vi.fn();

    // 1. Collapse to card
    coordinator.handleSnapshot(
      createSnapshot({ sizeClass: 'card' }),
      { applyBounds, broadcastSnapshot }
    );
    expect(coordinator.getDiagnostics().revision).toBe(1);

    // 2. Collapse further to compact before card shrink fires
    clock.tick(100);
    coordinator.handleSnapshot(
      createSnapshot({ sizeClass: 'compact' }),
      { applyBounds, broadcastSnapshot }
    );
    expect(coordinator.getDiagnostics().revision).toBe(2);

    // 3. Tick 170ms (total 270ms from start, but only 170ms from second collapse)
    clock.tick(170);
    // Card shrink should NOT have fired because revision 1 was cancelled/superseded
    expect(appliedBounds).toEqual([]);

    // 4. Tick another 100ms (total 270ms from second collapse)
    clock.tick(100);
    // Compact shrink fires directly!
    expect(appliedBounds).toEqual(['compact']);
  });

  it('hidden or dismissed snapshot cancels pending timers and applies immediately', () => {
    const clock = new MockClock();
    const coordinator = new SurfaceTransitionCoordinator({
      initialSizeClass: 'expanded',
      clock
    });

    const applyBounds = vi.fn();
    const broadcastSnapshot = vi.fn();

    // Start a collapse
    coordinator.handleSnapshot(
      createSnapshot({ sizeClass: 'card' }),
      { applyBounds, broadcastSnapshot }
    );
    expect(coordinator.getDiagnostics().hasPendingShrink).toBe(true);

    // Now dismiss surface
    coordinator.handleSnapshot(
      createSnapshot({ mode: 'hidden', visibility: 'hidden', sizeClass: 'ambient' }),
      { applyBounds, broadcastSnapshot }
    );

    // Timer was cancelled immediately and ambient bounds applied without delay
    expect(coordinator.getDiagnostics().hasPendingShrink).toBe(false);
    expect(coordinator.getDiagnostics().state).toBe('idle');
    expect(applyBounds).toHaveBeenCalledWith('ambient');
  });

  it('same envelope dimension transitions do not trigger native setBounds', () => {
    const coordinator = new SurfaceTransitionCoordinator({ initialSizeClass: 'ambient' });
    const applyBounds = vi.fn();
    const broadcastSnapshot = vi.fn();

    // Transition from ambient -> compact (both 280x80)
    coordinator.handleSnapshot(
      createSnapshot({ mode: 'listening', sizeClass: 'compact' }),
      { applyBounds, broadcastSnapshot }
    );

    expect(applyBounds).not.toHaveBeenCalled();
    expect(broadcastSnapshot).toHaveBeenCalledTimes(1);
    expect(coordinator.getDiagnostics().state).toBe('idle');
  });
});

