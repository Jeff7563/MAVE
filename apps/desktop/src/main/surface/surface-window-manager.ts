import { BrowserWindow, screen, type Display } from 'electron';
import {
  SURFACE_IPC_CHANNELS,
  type SurfaceSnapshot,
  type SurfaceEvent,
  type SurfaceAction
} from '@mave/contracts';
import type { SurfaceStateController } from '@mave/core';
import { createLogger, type Logger } from '@mave/shared';
import {
  calculateSurfaceBounds,
  DisplayLockManager,
  DEFAULT_SURFACE_MARGIN_DIP,
  type NativeSurfaceBounds,
  type SimpleDisplay,
  type SimplePoint
} from './bounds-calculator.js';
import {
  SurfaceTransitionCoordinator,
  type TransitionDiagnostics
} from './surface-transition-coordinator.js';

export interface ScreenAdapter {
  getCursorScreenPoint(): SimplePoint;
  getAllDisplays(): SimpleDisplay[];
  getPrimaryDisplay(): SimpleDisplay;
  on(event: string, listener: (...args: any[]) => void): void;
  removeListener(event: string, listener: (...args: any[]) => void): void;
}

export function createDefaultScreenAdapter(): ScreenAdapter {
  return {
    getCursorScreenPoint: () => screen.getCursorScreenPoint(),
    getAllDisplays: () => screen.getAllDisplays(),
    getPrimaryDisplay: () => screen.getPrimaryDisplay(),
    on: (evt, listener) => screen.on(evt as any, listener),
    removeListener: (evt, listener) => screen.removeListener(evt as any, listener)
  };
}

export interface SurfaceWindowDiagnostics {
  created: boolean;
  visible: boolean;
  bounds: NativeSurfaceBounds | null;
  displayId: number | null;
  isLocked: boolean;
  focusable: boolean;
  ignoreMouse: boolean;
  alwaysOnTop: boolean;
  mode: string;
  sizeClass: string;
  transition?: TransitionDiagnostics;
}

export interface SurfaceWindowManagerOptions {
  controller: SurfaceStateController;
  surfaceUrl: string;
  preloadPath: string;
  screenAdapter?: ScreenAdapter;
  margin?: number;
  logger?: Logger;
}

/**
 * SurfaceWindowManager
 *
 * Dedicated Main-process runtime owner for the native MAVE Ambient Surface BrowserWindow.
 *
 * INVARIANTS ENFORCED:
 * 1. ZERO FOCUS-STEALING: Passive surface events show the window via `win.showInactive()`
 *    with `focusable: false`. It NEVER steals OS keyboard focus from active applications.
 * 2. HYBRID ENVELOPE SIZING: Applies discrete native size envelopes; internal morphing is
 *    handled via CSS in the Renderer.
 * 3. BOTTOM-RIGHT ANCHORING: Anchors to usable display `workArea` margin, growing leftward and upward.
 * 4. MULTI-MONITOR STABILITY: Locks to the active display during active interactions and unlocks on idle.
 * 5. REUSABLE LIFECYCLE: Reuses a single native window instance across presentations; never recreates per turn.
 */
export class SurfaceWindowManager {
  private window: BrowserWindow | null = null;
  private readonly controller: SurfaceStateController;
  private readonly surfaceUrl: string;
  private readonly preloadPath: string;
  private readonly screenAdapter: ScreenAdapter;
  private readonly margin: number;
  private readonly logger: Logger;
  private readonly displayLockManager = new DisplayLockManager();
  private readonly transitionCoordinator: SurfaceTransitionCoordinator;

  private unsubscribeController: (() => void) | null = null;
  private isHovering = false;
  private isAlwaysOnTopActive = true;
  private isFocusableActive = false;
  private isIgnoringMouse = true;
  private isReadyToShow = false;
  private currentBounds: NativeSurfaceBounds | null = null;
  private activeDisplayId: number | null = null;

  private onDisplayMetricsChanged: (() => void) | null = null;
  private onDisplayRemoved: ((_event: any, display: Display) => void) | null = null;

  constructor(options: SurfaceWindowManagerOptions) {
    this.controller = options.controller;
    this.surfaceUrl = options.surfaceUrl;
    this.preloadPath = options.preloadPath;
    this.screenAdapter = options.screenAdapter ?? createDefaultScreenAdapter();
    this.margin = options.margin ?? DEFAULT_SURFACE_MARGIN_DIP;
    this.logger = options.logger ?? createLogger({ name: 'mave:surface-window' });
    this.transitionCoordinator = new SurfaceTransitionCoordinator({
      initialSizeClass: this.controller.getSnapshot().sizeClass
    });
  }

  /**
   * Initializes the Ambient Surface window and attaches display listeners.
   */
  public async initialize(): Promise<void> {
    this.logger.info('initializing SurfaceWindowManager');
    this.createWindow();

    // Subscribe to state controller snapshot updates
    this.unsubscribeController = this.controller.subscribe((snapshot) => {
      this.applySnapshot(snapshot);
    });

    // Multi-monitor listeners
    this.onDisplayMetricsChanged = () => {
      this.logger.info('display metrics changed, recalculating surface bounds');
      this.recalculateBounds();
    };

    this.onDisplayRemoved = (_event, removedDisplay) => {
      this.logger.info({ displayId: removedDisplay?.id }, 'display removed');
      if (this.displayLockManager.getLockedDisplayId() === removedDisplay?.id) {
        this.displayLockManager.unlock();
      }
      this.recalculateBounds();
    };

    this.screenAdapter.on('display-metrics-changed', this.onDisplayMetricsChanged);
    this.screenAdapter.on('display-removed', this.onDisplayRemoved);

    // Apply initial snapshot
    const initialSnapshot = this.controller.getSnapshot();
    this.applySnapshot(initialSnapshot);
  }

  /**
   * Creates or recreates the native frameless transparent BrowserWindow.
   */
  public createWindow(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) {
      return this.window;
    }

    const targetDisplay = this.resolveTargetDisplay();
    this.activeDisplayId = targetDisplay.id;

    const initialSnapshot = this.controller.getSnapshot();
    const bounds = calculateSurfaceBounds({
      workArea: targetDisplay.workArea,
      sizeClass: initialSnapshot.sizeClass,
      margin: this.margin
    });
    this.currentBounds = bounds;

    const win = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      frame: false,
      transparent: true,
      hasShadow: false, // Windows frameless transparent windows render corrupted DWM shadows; CSS shadow used instead
      resizable: false,
      show: false, // Must start hidden: zero white flash
      skipTaskbar: true,
      fullscreenable: false,
      maximizable: false,
      minimizable: false,
      focusable: false, // Passive by default; prevents stealing focus
      alwaysOnTop: true,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    // Configure always-on-top level ('status' level on Windows keeps above apps without being modal)
    win.setAlwaysOnTop(true, 'status');
    this.isAlwaysOnTopActive = true;
    this.isFocusableActive = false;

    // Passive transparent window ignores mouse clicks by default, forwarding them to OS desktop
    win.setIgnoreMouseEvents(true, { forward: true });
    this.isIgnoringMouse = true;

    // Security: deny all popups and foreign navigations
    win.webContents.setWindowOpenHandler(() => {
      this.logger.warn('blocked pop-up window opening attempt from surface');
      return { action: 'deny' };
    });

    win.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) {
        event.preventDefault();
        this.logger.warn({ url }, 'blocked external navigation attempt from surface');
      }
    });

    win.once('ready-to-show', () => {
      this.isReadyToShow = true;
      this.logger.info('surface window ready-to-show');
      const snapshot = this.controller.getSnapshot();
      if (snapshot.visibility === 'visible' && snapshot.mode !== 'hidden') {
        win.showInactive();
        this.logger.info('surface native window shown inactive on ready-to-show');
      }
    });

    win.on('closed', () => {
      this.logger.info('surface BrowserWindow closed');
      this.window = null;
      this.isReadyToShow = false;
    });

    win.webContents.on('did-finish-load', () => {
      this.logger.info('surface webContents finished loading, broadcasting active snapshot');
      this.broadcastSnapshot(this.controller.getSnapshot());
    });

    // Load Surface URL
    if (this.surfaceUrl.startsWith('http://') || this.surfaceUrl.startsWith('https://')) {
      win.loadURL(this.surfaceUrl);
    } else {
      win.loadFile(this.surfaceUrl, { query: { view: 'surface' } });
    }

    this.window = win;
    return win;
  }

  /**
   * Applies the canonical SurfaceSnapshot presentation policy to native window primitives.
   */
  public applySnapshot(snapshot: SurfaceSnapshot): void {
    if (!this.window || this.window.isDestroyed()) {
      if (snapshot.visibility === 'visible' && snapshot.mode !== 'hidden') {
        this.createWindow();
      } else {
        return;
      }
    }

    const win = this.window;
    if (!win || win.isDestroyed()) return;

    // 1. Update Display Lock Policy
    if (snapshot.mode !== 'ambient' && snapshot.mode !== 'hidden') {
      if (!this.displayLockManager.isLocked() && this.activeDisplayId !== null) {
        this.displayLockManager.lock(this.activeDisplayId);
        this.logger.debug({ displayId: this.activeDisplayId }, 'locked surface to active display');
      }
    } else {
      if (this.displayLockManager.isLocked()) {
        this.displayLockManager.unlock();
        this.logger.debug('unlocked surface display target');
      }
    }

    // 2. Visibility Policy
    const shouldBeVisible = snapshot.visibility === 'visible' && snapshot.mode !== 'hidden';
    if (!shouldBeVisible) {
      if (win.isVisible()) {
        win.hide();
        this.logger.debug('surface native window hidden');
      }
    } else {
      if (!win.isVisible() && this.isReadyToShow) {
        // FOCUS SECURITY INVARIANT:
        // Always show without stealing focus using showInactive()
        win.showInactive();
        this.logger.info('surface native window shown inactive (focus preserved)');
      }
    }

    // 3. Focus Policy
    if (snapshot.focusIntent === 'request') {
      if (!this.isFocusableActive) {
        win.setFocusable(true);
        this.isFocusableActive = true;
      }
      win.focus();
      this.logger.debug('surface granted native focus on explicit user intent');
    } else {
      if (this.isFocusableActive) {
        win.setFocusable(false);
        this.isFocusableActive = false;
        this.logger.debug('surface native focusable demoted to false');
      }
    }

    // 4. Interaction Mode / Hit-Testing Policy
    this.updateMouseBehavior(snapshot);

    // 5. Coordinated Asymmetric Envelope Transition & Snapshot Broadcast
    this.transitionCoordinator.handleSnapshot(snapshot, {
      applyBounds: (sizeClass) => {
        const targetDisplay = this.resolveTargetDisplay();
        this.activeDisplayId = targetDisplay.id;
        const newBounds = calculateSurfaceBounds({
          workArea: targetDisplay.workArea,
          sizeClass,
          margin: this.margin
        });
        if (
          !this.currentBounds ||
          this.currentBounds.x !== newBounds.x ||
          this.currentBounds.y !== newBounds.y ||
          this.currentBounds.width !== newBounds.width ||
          this.currentBounds.height !== newBounds.height
        ) {
          win.setBounds(newBounds);
          this.currentBounds = newBounds;
          this.logger.debug({ bounds: newBounds, sizeClass }, 'native surface bounds adjusted');
        }
      },
      broadcastSnapshot: (snap) => {
        this.broadcastSnapshot(snap);
      }
    });
  }

  /**
   * Reports pointer enter/leave over the visual container for click-through hit-testing.
   */
  public reportInteractiveHover(hovering: boolean): void {
    this.isHovering = hovering;
    this.controller.setUserHovering(hovering);
    this.updateMouseBehavior(this.controller.getSnapshot());
  }

  /**
   * Dispatches a user or system action through the state controller.
   */
  public dispatchAction(action: SurfaceAction): { success: boolean; error?: string } {
    try {
      this.controller.dispatchAction(action);
      return { success: true };
    } catch (err: any) {
      this.logger.error({ err, action }, 'failed to dispatch surface action');
      return { success: false, error: err.message };
    }
  }

  public getWindow(): BrowserWindow | null {
    return this.window;
  }

  public getDiagnostics(): SurfaceWindowDiagnostics {
    const isCreated = this.window !== null && !this.window.isDestroyed();
    const isVisible = isCreated && this.window!.isVisible();
    const snapshot = this.controller.getSnapshot();

    return {
      created: isCreated,
      visible: isVisible,
      bounds: this.currentBounds,
      displayId: this.activeDisplayId,
      isLocked: this.displayLockManager.isLocked(),
      focusable: this.isFocusableActive,
      ignoreMouse: this.isIgnoringMouse,
      alwaysOnTop: this.isAlwaysOnTopActive,
      mode: snapshot.mode,
      sizeClass: snapshot.sizeClass,
      transition: this.transitionCoordinator.getDiagnostics()
    };
  }

  /**
   * Disposes the window and event listeners.
   */
  public dispose(): void {
    this.logger.info('disposing SurfaceWindowManager');

    this.transitionCoordinator.dispose();

    if (this.unsubscribeController) {
      this.unsubscribeController();
      this.unsubscribeController = null;
    }

    if (this.onDisplayMetricsChanged) {
      this.screenAdapter.removeListener('display-metrics-changed', this.onDisplayMetricsChanged);
      this.onDisplayMetricsChanged = null;
    }

    if (this.onDisplayRemoved) {
      this.screenAdapter.removeListener('display-removed', this.onDisplayRemoved);
      this.onDisplayRemoved = null;
    }

    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
      this.window = null;
    }
  }

  /* ------------------------------------------------------------------
   * Private Helpers
   * ------------------------------------------------------------------ */

  private resolveTargetDisplay(): SimpleDisplay {
    const displays = this.screenAdapter.getAllDisplays();
    const primary = this.screenAdapter.getPrimaryDisplay();
    const cursor = this.screenAdapter.getCursorScreenPoint();

    return this.displayLockManager.resolveTargetDisplay(displays, cursor, primary);
  }

  private recalculateBounds(): void {
    if (!this.window || this.window.isDestroyed()) return;

    const targetDisplay = this.resolveTargetDisplay();
    this.activeDisplayId = targetDisplay.id;

    const snapshot = this.controller.getSnapshot();
    const newBounds = calculateSurfaceBounds({
      workArea: targetDisplay.workArea,
      sizeClass: snapshot.sizeClass,
      margin: this.margin
    });

    this.window.setBounds(newBounds);
    this.currentBounds = newBounds;
    this.transitionCoordinator.resetNativeSizeClass(snapshot.sizeClass);
  }

  private updateMouseBehavior(snapshot: SurfaceSnapshot): void {
    if (!this.window || this.window.isDestroyed()) return;

    // Explicit click-through mode: always ignore mouse
    if (snapshot.interactionMode === 'click_through') {
      if (!this.isIgnoringMouse) {
        this.window.setIgnoreMouseEvents(true, { forward: true });
        this.isIgnoringMouse = true;
      }
      return;
    }

    // In interactive mode (e.g. expanded response, confirmation modal): capture mouse events
    if (snapshot.interactionMode === 'interactive') {
      if (this.isIgnoringMouse) {
        this.window.setIgnoreMouseEvents(false);
        this.isIgnoringMouse = false;
      }
      return;
    }

    // Passive mode (ambient / voice capsule):
    // If user hovers over the visual container, capture mouse; otherwise pass through to desktop
    const shouldIgnore = !this.isHovering;
    if (this.isIgnoringMouse !== shouldIgnore) {
      if (shouldIgnore) {
        this.window.setIgnoreMouseEvents(true, { forward: true });
      } else {
        this.window.setIgnoreMouseEvents(false);
      }
      this.isIgnoringMouse = shouldIgnore;
    }
  }

  private broadcastSnapshot(snapshot: SurfaceSnapshot): void {
    if (!this.window || this.window.isDestroyed()) return;

    const event: SurfaceEvent = {
      type: 'snapshot_updated',
      snapshot,
      timestamp: Date.now()
    };

    try {
      this.window.webContents.send(SURFACE_IPC_CHANNELS.EVENT, event);
    } catch (err) {
      this.logger.warn({ err }, 'failed to send surface event to webContents');
    }
  }
}
