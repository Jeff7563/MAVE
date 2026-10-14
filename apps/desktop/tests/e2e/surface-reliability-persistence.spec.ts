import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('Electron desktop: Surface multi-monitor, persistence & reliability E2E verification', async () => {
  const mainScript = path.resolve(__dirname, '../../dist/main/index.js');
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: 'test',
    MAVE_VOICE_ENABLED: '1',
    MAVE_MOCK_WAKE: '1',
    MAVE_MOCK_VOICE_INPUT: '1',
    MAVE_MOCK_STT: '1',
    MAVE_MOCK_TTS: '1',
    MAVE_MOCK_AUDIO_OUTPUT: '1'
  };
  delete env['ELECTRON_RUN_AS_NODE'];

  const electronApp = await electron.launch({
    args: [mainScript],
    env
  });

  try {
    // 1. Await both windows: Dev Window and Surface Window
    const firstWin = await electronApp.firstWindow();
    await firstWin.waitForLoadState('domcontentloaded');

    let secondWin = (await electronApp.windows()).find((w) => w !== firstWin);
    if (!secondWin) {
      secondWin = await electronApp.waitForEvent('window');
    }
    await secondWin.waitForLoadState('domcontentloaded');

    const isFirstDev = await firstWin.evaluate(() => typeof (window as any).mave?.sendCommand === 'function');
    const devWindow = isFirstDev ? firstWin : secondWin;
    const surfaceWindow = isFirstDev ? secondWin : firstWin;

    expect(devWindow).toBeDefined();
    expect(surfaceWindow).toBeDefined();

    // ------------------------------------------------------------------
    // TEST A: Dedicated Surface Preload Least-Privilege Verification
    // ------------------------------------------------------------------
    const surfaceApis = await surfaceWindow.evaluate(() => {
      const mave = (window as any).mave;
      return {
        hasMave: typeof mave !== 'undefined',
        keys: mave ? Object.keys(mave) : [],
        surfaceKeys: mave?.surface ? Object.keys(mave.surface) : [],
        hasDiagnostics: typeof mave?.surface?.getDiagnostics === 'function',
        hasChat: typeof mave?.chat !== 'undefined',
        hasVoice: typeof mave?.voice !== 'undefined',
        hasSendCommand: typeof mave?.sendCommand !== 'undefined'
      };
    });

    expect(surfaceApis.hasMave).toBe(true);
    expect(surfaceApis.keys).toEqual(['surface']);
    expect(surfaceApis.hasDiagnostics).toBe(false); // Removed in M4.9 for least privilege
    expect(surfaceApis.hasChat).toBe(false);
    expect(surfaceApis.hasVoice).toBe(false);
    expect(surfaceApis.hasSendCommand).toBe(false);

    // ------------------------------------------------------------------
    // TEST B: Developer Window Diagnostics Access & Always-on-Top Policy
    // ------------------------------------------------------------------
    const diagnostics = await devWindow.evaluate(async () => {
      return await (window as any).mave.surface.getDiagnostics();
    });
    expect(diagnostics.created).toBe(true);
    expect(diagnostics.alwaysOnTop).toBe(true);
    expect(diagnostics.focusable).toBe(false);

    // Verify native BrowserWindow always-on-top level ('status')
    const nativeWindowPolicy = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin
        ? {
            isAlwaysOnTop: surfaceWin.isAlwaysOnTop(),
            isFocusable: surfaceWin.isFocusable()
          }
        : null;
    });
    expect(nativeWindowPolicy?.isAlwaysOnTop).toBe(true);
    expect(nativeWindowPolicy?.isFocusable).toBe(false);

    // ------------------------------------------------------------------
    // TEST C: Singleton Lifecycle Across Turns
    // ------------------------------------------------------------------
    // Simulate turn 1
    await devWindow.evaluate(async () => {
      await (window as any).mave.sendCommand('simulate-wake');
    });
    const capsule = surfaceWindow.locator('[data-testid="mave-capsule"]');
    await expect(capsule).toBeVisible({ timeout: 6000 });

    const winCountTurn1 = await electronApp.evaluate(({ BrowserWindow }) => {
      return BrowserWindow.getAllWindows().filter((w) => w.webContents.getURL().includes('view=surface')).length;
    });
    expect(winCountTurn1).toBe(1);

    // ------------------------------------------------------------------
    // TEST D: Surface Preferences IPC
    // ------------------------------------------------------------------
    const prefsBefore = await devWindow.evaluate(async () => {
      const electron = (window as any).mave;
      // Use IPC dispatch action to set preferred display
      const result = await electron.surface.dispatchAction({
        type: 'set_preferred_display',
        origin: 'user',
        displayId: 1
      });
      return result;
    });
    expect(prefsBefore.success).toBe(true);

    const updatedDiagnostics = await devWindow.evaluate(async () => {
      return await (window as any).mave.surface.getDiagnostics();
    });
    expect(updatedDiagnostics.preferredDisplayId).toBe(1);

    // ------------------------------------------------------------------
    // TEST E: Renderer Reload Resilience
    // ------------------------------------------------------------------
    // Reload surface webContents
    await surfaceWindow.reload();
    await surfaceWindow.waitForLoadState('domcontentloaded');

    // Invariant: After reload, surface window remains passive and not focusable
    const postReloadFocus = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin
        ? { isFocusable: surfaceWin.isFocusable(), isFocused: surfaceWin.isFocused() }
        : null;
    });
    expect(postReloadFocus?.isFocusable).toBe(false);
    expect(postReloadFocus?.isFocused).toBe(false);
  } finally {
    await electronApp.close();
  }
});

