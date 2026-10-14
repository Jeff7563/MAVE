import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SurfaceStateController } from '@mave/core';
import { SurfaceWindowManager, type ScreenAdapter } from '../src/main/surface/surface-window-manager.js';
import type { SimpleDisplay, SimplePoint } from '../src/main/surface/bounds-calculator.js';

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

function createMockScreenAdapter(): ScreenAdapter {
  const displays: SimpleDisplay[] = [
    {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 } // 40 DIP taskbar on bottom
    }
  ];

  let cursor: SimplePoint = { x: 500, y: 500 };
  const listeners: Map<string, Function[]> = new Map();

  return {
    getCursorScreenPoint: () => cursor,
    getAllDisplays: () => displays,
    getPrimaryDisplay: () => displays[0]!,
    on: (evt: string, fn: Function) => {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt)!.push(fn);
    },
    removeListener: (evt: string, fn: Function) => {
      const list = listeners.get(evt);
      if (list) {
        const idx = list.indexOf(fn);
        if (idx >= 0) list.splice(idx, 1);
      }
    }
  };
}

describe('SurfaceWindowManager Native Window Runtime Foundation', () => {
  let controller: SurfaceStateController;
  let screenAdapter: ScreenAdapter;
  let manager: SurfaceWindowManager;

  beforeEach(async () => {
    mockWindowInstances.length = 0;
    controller = new SurfaceStateController();
    screenAdapter = createMockScreenAdapter();

    manager = new SurfaceWindowManager({
      controller,
      surfaceUrl: 'http://localhost:5173?view=surface',
      preloadPath: 'C:/fake/preload.js',
      screenAdapter,
      margin: 16
    });

    await manager.initialize();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('creates dedicated BrowserWindow starting hidden with zero focus stealing configuration', () => {
    const win = manager.getWindow() as any;
    expect(win).toBeDefined();
    expect(win.options.show).toBe(false); // Starts hidden: NO WHITE FLASH
    expect(win.options.frame).toBe(false);
    expect(win.options.transparent).toBe(true);
    expect(win.options.focusable).toBe(false);
    expect(win.options.skipTaskbar).toBe(true);
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'status');
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
  });

  it('preserves focus invariant: passive listening/speaking uses showInactive() and never focus()', () => {
    const win = manager.getWindow() as any;

    // Trigger voice waking -> listening transition
    controller.applyIntent({
      type: 'voice_activity',
      voiceState: 'listening',
      inputLevel: 0.5
    });

    // Window must be shown inactive to NEVER steal focus from user's active application
    expect(win.showInactive).toHaveBeenCalled();
    expect(win.focus).not.toHaveBeenCalled();
    expect(win.isFocusable()).toBe(false);

    // Speaking transition also must NOT call focus()
    controller.applyIntent({
      type: 'voice_activity',
      voiceState: 'speaking',
      outputLevel: 0.8
    });

    expect(win.focus).not.toHaveBeenCalled();
  });

  it('grants native focus ONLY on explicit user text interaction', () => {
    const win = manager.getWindow() as any;

    // User explicitly requests keyboard text entry
    controller.dispatchAction({
      type: 'submit_text',
      origin: 'user',
      text: 'search query'
    });

    expect(win.setFocusable).toHaveBeenCalledWith(true);
    expect(win.focus).toHaveBeenCalled();
  });

  it('hides native window when dismissed or hidden', () => {
    const win = manager.getWindow() as any;

    // Show window first
    controller.applyIntent({
      type: 'voice_activity',
      voiceState: 'listening'
    });
    expect(win.isVisible()).toBe(true);

    // Dismiss surface
    controller.dispatchAction({
      type: 'dismiss',
      origin: 'user'
    });

    expect(win.hide).toHaveBeenCalled();
    expect(win.isVisible()).toBe(false);
  });

  it('applies discrete native envelope resizing while preserving bottom-right corner', () => {
    const win = manager.getWindow() as any;

    // 1. In compact mode: bounds width 280, height 80
    controller.applyIntent({
      type: 'voice_activity',
      voiceState: 'listening'
    });

    const compactBounds = win.getBounds();
    expect(compactBounds.width).toBe(280);
    expect(compactBounds.height).toBe(80);
    // WorkArea is 1920x1040, margin is 16
    // x = 1920 - 280 - 16 = 1624
    // y = 1040 - 80 - 16 = 944
    expect(compactBounds.x).toBe(1624);
    expect(compactBounds.y).toBe(944);

    // 2. Expand to expanded response: bounds width 440, height 580
    controller.applyIntent({
      type: 'show_response',
      text: 'Long response with code:\n```typescript\nconst x = 1;\n```'
    });

    const expandedBounds = win.getBounds();
    expect(expandedBounds.width).toBe(440);
    expect(expandedBounds.height).toBe(580);
    // x = 1920 - 440 - 16 = 1464
    // y = 1040 - 580 - 16 = 444
    expect(expandedBounds.x).toBe(1464);
    expect(expandedBounds.y).toBe(444);

    // Fixed corner invariant:
    expect(expandedBounds.x + expandedBounds.width).toBe(compactBounds.x + compactBounds.width);
    expect(expandedBounds.y + expandedBounds.height).toBe(compactBounds.y + compactBounds.height);
  });

  it('handles click-through hit testing via interactive hover reporting', () => {
    const win = manager.getWindow() as any;

    // In ambient/passive mode, window ignores mouse events
    manager.applySnapshot(controller.getSnapshot());
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });

    // Pointer enters interactive visual capsule container in Renderer
    manager.reportInteractiveHover(true);
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(false);

    // Pointer leaves container
    manager.reportInteractiveHover(false);
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
  });

  it('recovers safely if BrowserWindow is unexpectedly destroyed', () => {
    const initialWin = manager.getWindow() as any;
    expect(initialWin).toBeDefined();

    // Simulate unexpected window destroy
    initialWin.destroy();
    expect(initialWin.isDestroyed()).toBe(true);

    // Next incoming visible snapshot recreates the window cleanly
    controller.applyIntent({
      type: 'voice_activity',
      voiceState: 'listening'
    });

    const newWin = manager.getWindow() as any;
    expect(newWin).toBeDefined();
    expect(newWin).not.toBe(initialWin);
    expect(newWin.isDestroyed()).toBe(false);
  });

  it('exposes safe diagnostic telemetry without mutating core contracts', () => {
    const diag = manager.getDiagnostics();
    expect(diag.created).toBe(true);
    expect(diag.displayId).toBe(1);
    expect(diag.focusable).toBe(false);
    expect(diag.alwaysOnTop).toBe(true);
    expect(diag.mode).toBe('ambient');
    expect(diag.sizeClass).toBe('ambient');
  });

  describe('M4.8 Window Manager Interaction, Focus & Click-Through Tests', () => {
    it('grants native focus on user-origin request_focus and releases on release_focus', () => {
      const win = manager.getWindow() as any;

      // User requests focus
      const reqResult = manager.dispatchAction({ type: 'request_focus', origin: 'user' });
      expect(reqResult.success).toBe(true);
      expect(win.setFocusable).toHaveBeenCalledWith(true);
      expect(win.focus).toHaveBeenCalled();
      expect(win.isFocusable()).toBe(true);

      // User releases focus
      const relResult = manager.dispatchAction({ type: 'release_focus', origin: 'user' });
      expect(relResult.success).toBe(true);
      expect(win.setFocusable).toHaveBeenCalledWith(false);
      expect(win.blur).toHaveBeenCalled();
      expect(win.isFocusable()).toBe(false);
    });

    it('rejects focus requests originating from non-user sources', () => {
      const win = manager.getWindow() as any;

      const result = manager.dispatchAction({
        type: 'request_focus',
        origin: 'system' as any
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Focus request must originate from user');
      expect(win.focus).not.toHaveBeenCalled();
      expect(win.isFocusable()).toBe(false);
    });

    it('releases focus and demotes focusable when native blur event fires', () => {
      const win = manager.getWindow() as any;

      // User gains focus
      manager.dispatchAction({ type: 'request_focus', origin: 'user' });
      expect(win.isFocusable()).toBe(true);

      // Native blur occurs (e.g. user clicks VS Code or another app)
      win.emit('blur');

      expect(win.setFocusable).toHaveBeenCalledWith(false);
      expect(win.isFocusable()).toBe(false);
      expect(controller.getSnapshot().focusIntent).toBe('release');
    });

    it('enforces passive default on renderer did-finish-load (reload recovery)', () => {
      const win = manager.getWindow() as any;

      // Gain focus before reload
      manager.dispatchAction({ type: 'request_focus', origin: 'user' });
      expect(win.isFocusable()).toBe(true);

      // Simulate renderer reload
      win.webContents.emit('did-finish-load');

      expect(win.setFocusable).toHaveBeenCalledWith(false);
      expect(win.isFocusable()).toBe(false);
      expect(controller.getSnapshot().focusIntent).toBe('release');
    });

    it('maintains click-through across ambient, card, and expanded sizes based on isHovering', () => {
      const win = manager.getWindow() as any;

      // 1. Ambient size (280x80)
      controller.applyIntent({ type: 'reset_to_ambient', force: true });
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });

      // Hover over capsule -> capture
      manager.reportInteractiveHover(true);
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
      // Unhover -> ignore
      manager.reportInteractiveHover(false);
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });

      // 2. Card size (360x180)
      controller.applyIntent({
        type: 'show_response',
        text: 'Short answer'
      });
      // Not hovering -> must ignore mouse so transparent pad clicks through
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });

      // Hover over card -> capture
      manager.reportInteractiveHover(true);
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
      // Leave card -> ignore
      manager.reportInteractiveHover(false);
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });

      // 3. Expanded size (440x580)
      controller.applyIntent({
        type: 'show_response',
        text: '```typescript\nconst code = 123;\n```'
      });
      // Not hovering -> must ignore mouse so transparent margins click through
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });

      // Hover over panel -> capture
      manager.reportInteractiveHover(true);
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
      // Leave panel -> ignore
      manager.reportInteractiveHover(false);
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
    });

    it('validates external URLs and rejects unsafe protocols', () => {
      // Safe URLs
      const safeHttp = manager.dispatchAction({
        type: 'open_link',
        origin: 'user',
        url: 'https://example.com/docs'
      });
      expect(safeHttp.success).toBe(true);

      // Unsafe javascript:
      const unsafeJs = manager.dispatchAction({
        type: 'open_link',
        origin: 'user',
        url: 'javascript:alert(1)'
      });
      expect(unsafeJs.success).toBe(false);
      expect(unsafeJs.error).toContain('Rejected non-http(s)');

      // Unsafe file:
      const unsafeFile = manager.dispatchAction({
        type: 'open_link',
        origin: 'user',
        url: 'file:///C:/Windows/System32/cmd.exe'
      });
      expect(unsafeFile.success).toBe(false);
      expect(unsafeFile.error).toContain('Rejected non-http(s)');

      // Unsafe data:
      const unsafeData = manager.dispatchAction({
        type: 'open_link',
        origin: 'user',
        url: 'data:text/html,<script>alert(1)</script>'
      });
      expect(unsafeData.success).toBe(false);
      expect(unsafeData.error).toContain('Rejected non-http(s)');
    });

    it('safely copies bounded text to clipboard and rejects oversized payloads', () => {
      const validCopy = manager.dispatchAction({
        type: 'copy_text',
        origin: 'user',
        text: 'const validCode = true;'
      });
      expect(validCopy.success).toBe(true);

      // Oversized string > 100,000 characters
      const oversizedCopy = manager.dispatchAction({
        type: 'copy_text',
        origin: 'user',
        text: 'a'.repeat(100001)
      });
      expect(oversizedCopy.success).toBe(false);
      expect(oversizedCopy.error).toContain('Payload exceeds maximum copy length');
    });
  });
});
