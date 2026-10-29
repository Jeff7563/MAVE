import path from 'node:path';
import { BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import {
  SURFACE_IPC_CHANNELS,
  SURFACE_SIZES,
  SurfaceSetModeRequestSchema,
  type SurfaceMode
} from '@mave/contracts';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:surface' });

const MARGIN = 16;

export interface SurfaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bottom-right anchor inside a display work area (grows up and left). */
export function anchorBottomRight(
  workArea: { x: number; y: number; width: number; height: number },
  size: { width: number; height: number },
  margin = MARGIN
): SurfaceBounds {
  const width = Math.min(size.width, workArea.width - margin * 2);
  const height = Math.min(size.height, workArea.height - margin * 2);
  return {
    x: Math.round(workArea.x + workArea.width - width - margin),
    y: Math.round(workArea.y + workArea.height - height - margin),
    width: Math.round(width),
    height: Math.round(height)
  };
}

export interface SurfaceWindowOptions {
  preloadPath: string;
  rendererIndexPath: string;
  devServerUrl?: string;
  hotkey?: string;
  onOpenConsole?: () => void;
}

/**
 * MAVE Surface Manager (M4): one frameless, transparent, always-on-top window
 * anchored bottom-right. Mode changes come from the renderer's Surface Policy.
 * Passive modes never take focus; the panel becomes focusable only when the
 * user opens it (click, hotkey) — see "Focus Behavior" in the surface doc.
 */
export class SurfaceWindow {
  private win: BrowserWindow | null = null;
  private mode: SurfaceMode = 'orb';
  private interactive = false;
  private readonly hotkey: string;

  constructor(private readonly options: SurfaceWindowOptions) {
    this.hotkey = options.hotkey ?? 'Control+Alt+M';
  }

  getWindow(): BrowserWindow | null {
    return this.win && !this.win.isDestroyed() ? this.win : null;
  }

  create(): BrowserWindow {
    const bounds = this.boundsFor('orb');
    const win = new BrowserWindow({
      ...bounds,
      frame: false,
      transparent: true,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      hasShadow: false,
      show: false,
      title: 'MAVE Surface',
      backgroundColor: '#00000000',
      webPreferences: {
        preload: this.options.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });
    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());

    win.once('ready-to-show', () => win.showInactive());
    win.on('closed', () => {
      this.win = null;
    });

    if (this.options.devServerUrl) {
      void win.loadURL(`${this.options.devServerUrl}#surface`);
    } else {
      void win.loadFile(this.options.rendererIndexPath, { hash: 'surface' });
    }

    this.win = win;
    this.registerIpc();
    this.registerHotkey();
    screen.on('display-metrics-changed', this.reanchor);
    screen.on('display-removed', this.reanchor);
    return win;
  }

  setMode(mode: SurfaceMode, interactive: boolean): void {
    const win = this.getWindow();
    if (!win) return;
    const changed = mode !== this.mode || interactive !== this.interactive;
    this.mode = mode;
    this.interactive = interactive;
    if (!changed) return;
    win.setBounds(this.boundsFor(mode), false);
    win.setFocusable(interactive);
    if (interactive) {
      win.show();
      win.focus();
    } else if (!win.isVisible()) {
      win.showInactive();
    }
  }

  dispose(): void {
    ipcMain.removeHandler(SURFACE_IPC_CHANNELS.SET_MODE);
    ipcMain.removeHandler(SURFACE_IPC_CHANNELS.OPEN_CONSOLE);
    try {
      globalShortcut.unregister(this.hotkey);
    } catch {
      // app shutting down
    }
    screen.removeListener('display-metrics-changed', this.reanchor);
    screen.removeListener('display-removed', this.reanchor);
    const win = this.getWindow();
    if (win) win.destroy();
    this.win = null;
  }

  /** Ask the renderer to open (or close) the conversation panel. */
  toggle(): void {
    const win = this.getWindow();
    if (!win) return;
    win.webContents.send(SURFACE_IPC_CHANNELS.TOGGLE);
  }

  private boundsFor(mode: SurfaceMode): SurfaceBounds {
    const point = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    return anchorBottomRight(display.workArea, SURFACE_SIZES[mode]);
  }

  private readonly reanchor = () => {
    const win = this.getWindow();
    if (win) win.setBounds(this.boundsFor(this.mode), false);
  };

  private registerIpc(): void {
    ipcMain.handle(SURFACE_IPC_CHANNELS.SET_MODE, (event, raw: unknown) => {
      if (event.sender !== this.win?.webContents) return { ok: false };
      const parsed = SurfaceSetModeRequestSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, error: parsed.error.message };
      this.setMode(parsed.data.mode, parsed.data.interactive);
      return { ok: true };
    });
    ipcMain.handle(SURFACE_IPC_CHANNELS.OPEN_CONSOLE, () => {
      this.options.onOpenConsole?.();
      return { ok: true };
    });
  }

  private registerHotkey(): void {
    try {
      const ok = globalShortcut.register(this.hotkey, () => this.toggle());
      if (!ok) logger.warn({ hotkey: this.hotkey }, 'global hotkey is already in use');
      else logger.info({ hotkey: this.hotkey }, 'surface hotkey registered');
    } catch (err) {
      logger.warn({ err, hotkey: this.hotkey }, 'failed to register surface hotkey');
    }
  }
}

export function defaultRendererIndexPath(mainDir: string): string {
  return path.join(mainDir, '../renderer/index.html');
}
