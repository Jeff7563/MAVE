import { describe, it, expect } from 'vitest';
import {
  calculateSurfaceBounds,
  DisplayLockManager,
  SURFACE_ENVELOPES,
  DEFAULT_SURFACE_MARGIN_DIP,
  type SimpleDisplay,
  type SimplePoint
} from '../src/main/surface/bounds-calculator.js';

describe('BoundsCalculator & Multi-Monitor DisplayLockManager', () => {
  describe('calculateSurfaceBounds', () => {
    it('defines discrete native envelopes matching M4.0 specification', () => {
      expect(SURFACE_ENVELOPES.ambient).toEqual({ width: 280, height: 80 });
      expect(SURFACE_ENVELOPES.compact).toEqual({ width: 280, height: 80 });
      expect(SURFACE_ENVELOPES.card).toEqual({ width: 360, height: 180 });
      expect(SURFACE_ENVELOPES.expanded).toEqual({ width: 440, height: 580 });
    });

    it('anchors ambient capsule to bottom-right of standard 1080p workArea', () => {
      const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
      const bounds = calculateSurfaceBounds({
        workArea,
        sizeClass: 'ambient',
        margin: DEFAULT_SURFACE_MARGIN_DIP
      });

      // x = 1920 - 280 - 16 = 1624
      // y = 1080 - 80 - 16 = 984
      expect(bounds).toEqual({
        x: 1624,
        y: 984,
        width: 280,
        height: 80
      });
    });

    it('accounts for bottom Windows taskbar reduction safely', () => {
      // Taskbar on bottom of screen, 40 DIP height -> workArea height is 1040
      const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
      const bounds = calculateSurfaceBounds({
        workArea,
        sizeClass: 'compact',
        margin: 16
      });

      // y = 1040 - 80 - 16 = 944
      expect(bounds.x).toBe(1624);
      expect(bounds.y).toBe(944);
      expect(bounds.height).toBe(80);
    });

    it('accounts for left Windows taskbar reduction safely', () => {
      // Taskbar on left of screen, 60 DIP width -> workArea x=60, width=1860
      const workArea = { x: 60, y: 0, width: 1860, height: 1080 };
      const bounds = calculateSurfaceBounds({
        workArea,
        sizeClass: 'compact',
        margin: 16
      });

      // x = 60 + 1860 - 280 - 16 = 1624
      expect(bounds.x).toBe(1624);
      expect(bounds.y).toBe(984);
    });

    it('grows upward and leftward when promoting from compact to expanded panel', () => {
      const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
      const compactBounds = calculateSurfaceBounds({ workArea, sizeClass: 'compact', margin: 16 });
      const expandedBounds = calculateSurfaceBounds({ workArea, sizeClass: 'expanded', margin: 16 });

      // Bottom-right edge must remain invariant:
      // right edge = x + width = 1624 + 280 = 1904
      // bottom edge = y + height = 984 + 80 = 1064
      const compactRight = compactBounds.x + compactBounds.width;
      const compactBottom = compactBounds.y + compactBounds.height;

      const expandedRight = expandedBounds.x + expandedBounds.width;
      const expandedBottom = expandedBounds.y + expandedBounds.height;

      expect(compactRight).toBe(expandedRight);
      expect(compactBottom).toBe(expandedBottom);

      // Expansion grows leftward (x decreases) and upward (y decreases)
      expect(expandedBounds.x).toBeLessThan(compactBounds.x);
      expect(expandedBounds.y).toBeLessThan(compactBounds.y);
      expect(expandedBounds.width).toBe(440);
      expect(expandedBounds.height).toBe(580);
    });

    it('handles negative display coordinates on secondary monitors correctly', () => {
      // Secondary monitor located to the left: x=-1920, width=1920
      const secondaryWorkArea = { x: -1920, y: 0, width: 1920, height: 1080 };
      const bounds = calculateSurfaceBounds({
        workArea: secondaryWorkArea,
        sizeClass: 'ambient',
        margin: 16
      });

      // x = -1920 + 1920 - 280 - 16 = -296
      expect(bounds.x).toBe(-296);
      expect(bounds.y).toBe(984);
    });

    it('proves bottom-right anchor invariant across all 4 size classes in positive and negative coordinate spaces', () => {
      const coordinateSpaces = [
        { name: 'Primary 1080p', workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
        { name: '4K Display', workArea: { x: 0, y: 0, width: 3840, height: 2160 } },
        { name: 'Negative Left Display', workArea: { x: -1920, y: -200, width: 1920, height: 1080 } },
        { name: 'Negative Top Display', workArea: { x: 0, y: -1080, width: 1920, height: 1080 } }
      ];

      const sizeClasses = ['ambient', 'compact', 'card', 'expanded'] as const;

      for (const space of coordinateSpaces) {
        const expectedRight = space.workArea.x + space.workArea.width - DEFAULT_SURFACE_MARGIN_DIP;
        const expectedBottom = space.workArea.y + space.workArea.height - DEFAULT_SURFACE_MARGIN_DIP;

        for (const sizeClass of sizeClasses) {
          const bounds = calculateSurfaceBounds({
            workArea: space.workArea,
            sizeClass
          });

          // Absolute bottom-right corner must exactly match expected
          expect(bounds.x + bounds.width).toBe(expectedRight);
          expect(bounds.y + bounds.height).toBe(expectedBottom);
        }
      }
    });
  });

  describe('DisplayLockManager', () => {
    const primaryDisplay: SimpleDisplay = {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 }
    };

    const secondaryDisplay: SimpleDisplay = {
      id: 2,
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      workArea: { x: 1920, y: 0, width: 1920, height: 1040 }
    };

    const displays = [primaryDisplay, secondaryDisplay];

    it('resolves display containing cursor when unlocked', () => {
      const lockManager = new DisplayLockManager();
      expect(lockManager.isLocked()).toBe(false);

      // Cursor on primary monitor
      const cursorOnPrimary: SimplePoint = { x: 500, y: 500 };
      const d1 = lockManager.resolveTargetDisplay(displays, cursorOnPrimary, primaryDisplay);
      expect(d1.id).toBe(1);

      // Cursor moves to secondary monitor
      const cursorOnSecondary: SimplePoint = { x: 2500, y: 500 };
      const d2 = lockManager.resolveTargetDisplay(displays, cursorOnSecondary, primaryDisplay);
      expect(d2.id).toBe(2);
    });

    it('locks to display upon activation and does NOT jump monitors when cursor moves', () => {
      const lockManager = new DisplayLockManager();

      // Cursor on secondary monitor at activation
      const cursorOnSecondary: SimplePoint = { x: 2500, y: 500 };
      const target = lockManager.resolveTargetDisplay(displays, cursorOnSecondary, primaryDisplay);
      expect(target.id).toBe(2);

      // Lock display
      lockManager.lock(target.id);
      expect(lockManager.isLocked()).toBe(true);
      expect(lockManager.getLockedDisplayId()).toBe(2);

      // User moves mouse back to primary monitor while interaction is active
      const cursorBackOnPrimary: SimplePoint = { x: 100, y: 100 };
      const lockedTarget = lockManager.resolveTargetDisplay(displays, cursorBackOnPrimary, primaryDisplay);

      // STABILITY INVARIANT: Surface remains on locked secondary monitor!
      expect(lockedTarget.id).toBe(2);

      // Unlocking releases display lock
      lockManager.unlock();
      expect(lockManager.isLocked()).toBe(false);

      // Next query follows cursor again
      const followCursor = lockManager.resolveTargetDisplay(displays, cursorBackOnPrimary, primaryDisplay);
      expect(followCursor.id).toBe(1);
    });

    it('falls back safely if locked display is disconnected', () => {
      const lockManager = new DisplayLockManager();
      lockManager.lock(2);

      // Secondary display is removed -> only primary remains
      const remainingDisplays = [primaryDisplay];
      const cursor: SimplePoint = { x: 500, y: 500 };

      const resolved = lockManager.resolveTargetDisplay(remainingDisplays, cursor, primaryDisplay);
      expect(resolved.id).toBe(1);
      expect(lockManager.isLocked()).toBe(false); // Lock released safely
    });
  });
});

