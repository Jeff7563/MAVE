import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SurfaceStateController } from '@mave/core';
import {
  SurfaceWindowManager,
  type ScreenAdapter
} from '../src/main/surface/surface-window-manager.js';
import {
  calculateSurfaceBounds,
  type SimpleDisplay,
  type SimplePoint
} from '../src/main/surface/bounds-calculator.js';
import {
  SurfacePreferencesStore,
  InMemoryPersistenceAdapter
} from '../src/main/surface/surface-preferences.js';

// Mock electron BrowserWindow
const mockWindowInstances: any[] = [];

vi.mock('electron', () => {
  class MockBrowserWindow {
    private bounds: any;
    private visible = false;
    private destroyed = false;
    private focusable = false;
    public webContents: any;
    public options: any;
    private eventHandlers: Map<string, Function[]> = new Map();

    constructor(options: any) {
      this.options = options;
      this.bounds = {
        x: options.x,
        y: options.y,
        width: options.width,
        height: options.height
      };
      this.focusable = options.focusable ?? false;
      this.webContents = {
        send: vi.fn(),
        on: vi.fn((evt: string, fn: Function) => {
          if (!this.eventHandlers.has(evt)) this.eventHandlers.set(evt, []);
          this.eventHandlers.get(evt)!.push(fn);
        }),
        emit: (evt: string, ...args: any[]) => {
          this.emit(evt, ...args);
        },
        setWindowOpenHandler: vi.fn(),
        loadURL: vi.fn(),
        loadFile: vi.fn()
      };
      mockWindowInstances.push(this);
    }

    on(evt: string, fn: Function) {
      if (!this.eventHandlers.has(evt)) this.eventHandlers.set(evt, []);
      this.eventHandlers.get(evt)!.push(fn);
    }

    once(evt: string, fn: Function) {
      const wrapper = (...args: any[]) => {
        this.removeListener(evt, wrapper);
        fn(...args);
      };
      this.on(evt, wrapper);
    }

    removeListener(evt: string, fn: Function) {
      const list = this.eventHandlers.get(evt);
      if (list) {
        const idx = list.indexOf(fn);
        if (idx >= 0) list.splice(idx, 1);
      }
    }

    emit(evt: string, ...args: any[]) {
      const handlers = [...(this.eventHandlers.get(evt) ?? [])];
      for (const handler of handlers) {
        handler(...args);
      }
    }

    setBounds(b: any) {
      this.bounds = { ...b };
    }

    getBounds() {
      return { ...this.bounds };
    }

    show() {
      this.visible = true;
    }

    showInactive = vi.fn(() => {
      this.visible = true;
    });

    hide = vi.fn(() => {
      this.visible = false;
    });

    isVisible() {
      return this.visible;
    }

    focus = vi.fn();

    blur = vi.fn();

    setFocusable = vi.fn((val: boolean) => {
      this.focusable = val;
    });

    isFocusable() {
      return this.focusable;
    }

    setAlwaysOnTop = vi.fn();

    setIgnoreMouseEvents = vi.fn();

    isDestroyed() {
      return this.destroyed;
    }

    destroy = vi.fn(() => {
      this.destroyed = true;
      this.visible = false;
      const closedHandlers = this.eventHandlers.get('closed') ?? [];
      for (const handler of closedHandlers) {
        handler();
      }
    });

    loadURL = vi.fn((_url?: string) => {
      this.emit('ready-to-show');
    });

    loadFile = vi.fn((_file?: string) => {
      this.emit('ready-to-show');
    });
  }

  return {
    BrowserWindow: MockBrowserWindow,
    shell: {
      openExternal: vi.fn()
    },
    clipboard: {
      writeText: vi.fn()
    },
    screen: {
      getCursorScreenPoint: vi.fn(),
      getAllDisplays: vi.fn(),
      getPrimaryDisplay: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn()
    }
  };
});

describe('M4.9 Multi-Monitor, Persistence & Reliability Suite', () => {
  let controller: SurfaceStateController;
  let preferencesStore: SurfacePreferencesStore;
  let manager: SurfaceWindowManager;
  let mockCursor: SimplePoint;
  let mockDisplays: SimpleDisplay[];
  let primaryDisplay: SimpleDisplay;
  let leftDisplay: SimpleDisplay;
  let topDisplay: SimpleDisplay;
  let screenListeners: Map<string, Function[]>;
  let screenAdapter: ScreenAdapter;

  beforeEach(() => {
    mockWindowInstances.length = 0;
    screenListeners = new Map();

    primaryDisplay = {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 }
    };

    leftDisplay = {
      id: 2,
      bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
      workArea: { x: -1920, y: 0, width: 1920, height: 1040 }
    };

    topDisplay = {
      id: 3,
      bounds: { x: 0, y: -1080, width: 1920, height: 1080 },
      workArea: { x: 0, y: -1080, width: 1920, height: 1040 }
    };

    mockDisplays = [primaryDisplay, leftDisplay, topDisplay];
    mockCursor = { x: 500, y: 500 }; // Starts on primary

    screenAdapter = {
      getCursorScreenPoint: () => mockCursor,
      getAllDisplays: () => mockDisplays,
      getPrimaryDisplay: () => primaryDisplay,
      on: (evt: string, fn: Function) => {
        if (!screenListeners.has(evt)) screenListeners.set(evt, []);
        screenListeners.get(evt)!.push(fn);
      },
      removeListener: (evt: string, fn: Function) => {
        const list = screenListeners.get(evt);
        if (list) {
          const idx = list.indexOf(fn);
          if (idx >= 0) list.splice(idx, 1);
        }
      }
    };

    controller = new SurfaceStateController({ enableTimers: false });
    preferencesStore = new SurfacePreferencesStore({ adapter: new InMemoryPersistenceAdapter() });

    manager = new SurfaceWindowManager({
      controller,
      surfaceUrl: 'http://localhost:5173?view=surface',
      preloadPath: '/mock/surface-preload.js',
      screenAdapter,
      preferencesStore,
      margin: 16
    });
  });

  afterEach(() => {
    manager.dispose();
  });

  // ------------------------------------------------------------------
  // 1. TOPOLOGIES & NEGATIVE COORDINATES
  // ------------------------------------------------------------------
  describe('Multi-Monitor Topologies & Negative Coordinate Invariants', () => {
    it('correctly anchors to bottom-right in negative coordinate space (left monitor x < 0)', () => {
      // Primary: workArea (0,0, 1920,1040), envelope compact (280, 80) -> x = 1920 - 280 - 16 = 1624, y = 1040 - 80 - 16 = 944
      const primaryBounds = calculateSurfaceBounds({
        workArea: primaryDisplay.workArea,
        sizeClass: 'compact',
        margin: 16
      });
      expect(primaryBounds).toEqual({ x: 1624, y: 944, width: 280, height: 80 });

      // Left monitor: workArea (-1920, 0, 1920, 1040)
      // x = -1920 + 1920 - 280 - 16 = -296
      // y = 0 + 1040 - 80 - 16 = 944
      const leftBounds = calculateSurfaceBounds({
        workArea: leftDisplay.workArea,
        sizeClass: 'compact',
        margin: 16
      });
      expect(leftBounds).toEqual({ x: -296, y: 944, width: 280, height: 80 });
      expect(leftBounds.x).toBeLessThan(0);
    });

    it('correctly anchors to bottom-right in negative coordinate space (top monitor y < 0)', () => {
      // Top monitor: workArea (0, -1080, 1920, 1040)
      // x = 0 + 1920 - 280 - 16 = 1624
      // y = -1080 + 1040 - 80 - 16 = -56
      const topBounds = calculateSurfaceBounds({
        workArea: topDisplay.workArea,
        sizeClass: 'compact',
        margin: 16
      });
      expect(topBounds).toEqual({ x: 1624, y: -136, width: 280, height: 80 });
      expect(topBounds.y).toBeLessThan(0);
    });
  });

  // ------------------------------------------------------------------
  // 2. TASKBAR PLACEMENT VARIATIONS
  // ------------------------------------------------------------------
  describe('Taskbar Placement & WorkArea Invariance', () => {
    it('anchors cleanly above bottom taskbar', () => {
      const bounds = calculateSurfaceBounds({
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        sizeClass: 'compact',
        margin: 16
      });
      expect(bounds.y + bounds.height + 16).toBe(1040);
    });

    it('anchors cleanly on top taskbar layout', () => {
      // Taskbar on top (height 40): workArea starts at y=40, height=1040
      const bounds = calculateSurfaceBounds({
        workArea: { x: 0, y: 40, width: 1920, height: 1040 },
        sizeClass: 'compact',
        margin: 16
      });
      // Bottom of surface is 40 + 1040 - 16 = 1064
      expect(bounds.y + bounds.height + 16).toBe(1080);
      expect(bounds.y).toBe(40 + 1040 - 80 - 16);
    });

    it('anchors cleanly on left taskbar layout', () => {
      // Taskbar on left (width 60): workArea starts at x=60, width=1860
      const bounds = calculateSurfaceBounds({
        workArea: { x: 60, y: 0, width: 1860, height: 1080 },
        sizeClass: 'compact',
        margin: 16
      });
      // Right edge is 60 + 1860 - 16 = 1904
      expect(bounds.x + bounds.width + 16).toBe(1920);
    });

    it('anchors cleanly on right taskbar layout', () => {
      // Taskbar on right (width 60): workArea starts at x=0, width=1860
      const bounds = calculateSurfaceBounds({
        workArea: { x: 0, y: 0, width: 1860, height: 1080 },
        sizeClass: 'compact',
        margin: 16
      });
      // Right edge is 1860 - 16 = 1844
      expect(bounds.x + bounds.width + 16).toBe(1860);
    });
  });

  // ------------------------------------------------------------------
  // 3. TARGET DISPLAY RESOLUTION & LOCK LIFECYCLE
  // ------------------------------------------------------------------
  describe('Target Display Resolution & Display Lock Lifecycle', () => {
    it('follows cursor when unlocked, but does not chase cursor during active turns', async () => {
      await manager.initialize();
      const win = manager.getWindow()!;

      // 1. Initially on primary display
      expect(win.getBounds().x).toBe(1624);

      // 2. Start active voice turn (listening)
      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'listening'
      });
      expect(manager.getDiagnostics().isLocked).toBe(true);
      expect(manager.getDiagnostics().displayId).toBe(1);

      // 3. User moves cursor to left monitor while active
      mockCursor = { x: -1000, y: 500 };

      // Apply next state in turn (speaking)
      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking'
      });

      // INVARIANT: Surface stays locked to primary display (does NOT hop monitors!)
      expect(win.getBounds().x).toBe(1624);
      expect(manager.getDiagnostics().displayId).toBe(1);

      // 4. Return to ambient (unlocks target display)
      controller.applyIntent({
        type: 'reset_to_ambient',
        force: true
      });
      expect(manager.getDiagnostics().isLocked).toBe(false);

      // 5. Next activation occurs while cursor is still on left monitor
      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'listening'
      });
      // Surface now cleanly activates on left monitor
      expect(win.getBounds().x).toBe(-296);
      expect(manager.getDiagnostics().displayId).toBe(2);
    });

    it('keeps pinned surface locked to its display even across ambient resets and cursor moves', async () => {
      await manager.initialize();
      const win = manager.getWindow()!;

      // Start on primary, pin surface
      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'listening'
      });
      controller.dispatchAction({ type: 'toggle_pin', origin: 'user' });

      expect(controller.getSnapshot().pinned).toBe(true);
      expect(manager.getDiagnostics().isLocked).toBe(true);
      expect(manager.getDiagnostics().displayId).toBe(1);

      // Cursor moves to top monitor
      mockCursor = { x: 500, y: -500 };

      // Normal turn reset or auto-collapse (non-force) preserves pin
      controller.applyIntent({
        type: 'reset_to_ambient',
        force: false
      });

      // INVARIANT: Pinned presentation stays locked to primary monitor
      expect(manager.getDiagnostics().isLocked).toBe(true);
      expect(manager.getDiagnostics().displayId).toBe(1);
      expect(win.getBounds().x).toBe(1624);
    });

    it('honors preferredDisplayId preference over cursor location', async () => {
      preferencesStore.setPreferredDisplayId(2); // Prefer Left Monitor
      mockCursor = { x: 500, y: 500 }; // Cursor is on Primary Monitor

      await manager.initialize();
      const win = manager.getWindow()!;

      expect(manager.getDiagnostics().preferredDisplayId).toBe(2);
      expect(win.getBounds().x).toBe(-296); // On Left Monitor
      expect(manager.getDiagnostics().displayId).toBe(2);
    });

    it('falls back to cursor display if preferredDisplayId is invalid or disconnected', async () => {
      preferencesStore.setPreferredDisplayId(999); // Non-existent display
      mockCursor = { x: 500, y: 500 }; // Cursor on Primary Monitor

      await manager.initialize();
      const win = manager.getWindow()!;

      expect(win.getBounds().x).toBe(1624); // Primary Monitor
      expect(manager.getDiagnostics().displayId).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // 4. DISPLAY DISCONNECT & RECONNECT
  // ------------------------------------------------------------------
  describe('Display Disconnect & Reconnect Reliability', () => {
    it('gracefully falls back when locked display is disconnected', async () => {
      mockCursor = { x: -1000, y: 500 }; // On left monitor
      await manager.initialize();
      const win = manager.getWindow()!;

      // Lock to left display (id: 2)
      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'listening'
      });
      expect(manager.getDiagnostics().displayId).toBe(2);
      expect(win.getBounds().x).toBe(-296);

      // Simulate left display disconnect
      mockDisplays = [primaryDisplay, topDisplay];
      mockCursor = { x: 500, y: 500 };

      const onRemovedListeners = screenListeners.get('display-removed') ?? [];
      for (const listener of onRemovedListeners) {
        listener({}, leftDisplay as any);
      }

      // INVARIANT: Surface recovers safely onto remaining primary display without crash
      expect(manager.getDiagnostics().displayId).toBe(1);
      expect(win.getBounds().x).toBe(1624);
    });

    it('does not disturb locked or pinned turn when a new display is connected', async () => {
      await manager.initialize();
      const win = manager.getWindow()!;

      // Pin to primary
      controller.dispatchAction({ type: 'toggle_pin', origin: 'user' });
      expect(manager.getDiagnostics().displayId).toBe(1);

      // Simulate a 4th display being added
      const fourthDisplay: SimpleDisplay = {
        id: 4,
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
        workArea: { x: 1920, y: 0, width: 1920, height: 1040 }
      };
      mockDisplays.push(fourthDisplay);

      const onAddedListeners = screenListeners.get('display-added') ?? [];
      for (const listener of onAddedListeners) {
        listener({}, fourthDisplay as any);
      }

      // INVARIANT: Window remains stable on primary display
      expect(manager.getDiagnostics().displayId).toBe(1);
      expect(win.getBounds().x).toBe(1624);
    });
  });

  // ------------------------------------------------------------------
  // 5. FOCUS LIFECYCLE STRESS TEST (20 CYCLES)
  // ------------------------------------------------------------------
  describe('Focus Lifecycle Reliability (20-Cycle Stress)', () => {
    it('survives 20 consecutive acquire / release cycles without stuck focus or focus leakage', async () => {
      await manager.initialize();
      const win = manager.getWindow()!;

      for (let cycle = 1; cycle <= 20; cycle++) {
        // Step A: Explicit User Focus Acquisition
        const acquireResult = manager.dispatchAction({
          type: 'request_focus',
          origin: 'user'
        });
        expect(acquireResult.success).toBe(true);
        expect(win.isFocusable()).toBe(true);
        expect(manager.getDiagnostics().focusable).toBe(true);

        // Step B: User Focus Release
        const releaseResult = manager.dispatchAction({
          type: 'release_focus',
          origin: 'user'
        });
        expect(releaseResult.success).toBe(true);
        expect(win.isFocusable()).toBe(false);
        expect(manager.getDiagnostics().focusable).toBe(false);

        // Step C: Passive background event occurs (must NOT make window focusable)
        controller.applyIntent({
          type: 'voice_activity',
          voiceState: 'speaking'
        });
        expect(win.isFocusable()).toBe(false);
        expect(manager.getDiagnostics().focusable).toBe(false);
      }
    });
  });

  // ------------------------------------------------------------------
  // 6. RAPID HOVER STRESS TEST (50 CYCLES)
  // ------------------------------------------------------------------
  describe('Click-Through & Rapid Hover Hit-Testing Stress', () => {
    it('reliably updates ignoreMouse state across 50 rapid hover enter/leave transitions', async () => {
      await manager.initialize();
      const win = manager.getWindow()!;

      for (let i = 0; i < 50; i++) {
        manager.reportInteractiveHover(true);
        expect(win.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
        expect(manager.getDiagnostics().ignoreMouse).toBe(false);

        manager.reportInteractiveHover(false);
        expect(win.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true });
        expect(manager.getDiagnostics().ignoreMouse).toBe(true);
      }
    });
  });

  // ------------------------------------------------------------------
  // 7. SINGLETON LIFECYCLE & CRASH RECOVERY
  // ------------------------------------------------------------------
  describe('Singleton Lifecycle & Crash Recovery', () => {
    it('reuses a single BrowserWindow instance across multiple presentation turns', async () => {
      await manager.initialize();
      const firstInstance = manager.getWindow()!;

      // Cycle 1: Listening
      controller.applyIntent({ type: 'voice_activity', voiceState: 'listening' });
      // Cycle 2: Compact response
      controller.applyIntent({
        type: 'show_response',
        text: 'Turn 1 done'
      });
      // Cycle 3: Ambient
      controller.applyIntent({ type: 'reset_to_ambient', force: true });
      // Cycle 4: Second turn
      controller.applyIntent({ type: 'voice_activity', voiceState: 'listening' });

      // Invariant: Exactly one native BrowserWindow instance was constructed
      expect(mockWindowInstances.length).toBe(1);
      expect(manager.getWindow()).toBe(firstInstance);
    });

    it('recovers cleanly from render-process-gone crash when visible', async () => {
      await manager.initialize();
      const initialWin = manager.getWindow()!;

      // Make surface visible in listening mode
      controller.applyIntent({ type: 'voice_activity', voiceState: 'listening' });
      expect(initialWin.isVisible()).toBe(true);

      // Simulate renderer process crash
      initialWin.webContents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 });

      // Invariant: Previous window destroyed, fresh window created automatically
      expect(initialWin.isDestroyed()).toBe(true);
      const newWin = manager.getWindow()!;
      expect(newWin).toBeDefined();
      expect(newWin).not.toBe(initialWin);
      expect(mockWindowInstances.length).toBe(2);
    });
  });
});
