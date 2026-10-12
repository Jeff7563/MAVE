import { Tray, Menu, nativeImage, type BrowserWindow } from 'electron';
import type { MaveService } from '@mave/core';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:tray' });

// 16x16 blue dot PNG data URL for safe system tray icon fallback
const TRAY_ICON_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVQ4T2NkYPj/n4EAYAQp5sXHQxfkYqACnFpAegY2gJ+fP+nBwA5mZGT8/x8n5hmoBgyaAYNmAPU3QIQBxjZ0qMEYiA0GGBkZGRG6oQZSDCAWjI+fP2Pzgx6AEx5k3+N2DQC1+g/xC5rCtwAAAABJRU5ErkJggg==';

export function createSystemTray(
  service: MaveService,
  getMainWindow: () => BrowserWindow | null
): Tray {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_PNG_BASE64);
  const tray = new Tray(icon);
  tray.setToolTip('MAVE Voice Assistant');

  function updateMenu() {
    const snapshot = service.getSnapshot();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'MAVE',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Open MAVE',
        click: () => {
          logger.info('tray action: Open MAVE');
          const win = getMainWindow();
          if (win) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
          }
        }
      },
      {
        label: 'Wake (debug)',
        click: () => {
          logger.info('tray action: Wake (debug)');
          service.send({ type: 'WAKE_DETECTED' });
        }
      },
      {
        label: 'Sleep',
        click: () => {
          logger.info('tray action: Sleep');
          service.send({ type: 'SLEEP_REQUESTED' });
        }
      },
      {
        label: snapshot.isMuted ? 'Unmute' : 'Mute',
        click: () => {
          logger.info('tray action: Toggle Mute');
          service.send({ type: 'TOGGLE_MUTE' });
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          logger.info('tray action: Quit');
          service.send({ type: 'SHUTDOWN' });
          const win = getMainWindow();
          if (win) win.close();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  }

  updateMenu();

  service.subscribe(() => {
    updateMenu();
  });

  tray.on('double-click', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  logger.info('system tray initialized');
  return tray;
}
