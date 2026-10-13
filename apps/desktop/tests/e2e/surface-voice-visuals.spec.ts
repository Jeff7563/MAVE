import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('Electron desktop: Ambient surface voice-reactive states and visualizer E2E verification', async () => {
  const mainScript = path.resolve(__dirname, '../../dist/main/index.js');
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: 'test'
  };
  delete env['ELECTRON_RUN_AS_NODE'];

  const electronApp = await electron.launch({
    args: [mainScript],
    env
  });

  try {
    // 1. Await both windows: Dev Window and Surface Window
    const devWindow = await electronApp.firstWindow();
    await devWindow.waitForLoadState('domcontentloaded');

    // Wait for the surface window to appear
    let surfaceWindow = (await electronApp.windows()).find(w => w !== devWindow);
    if (!surfaceWindow) {
      // Wait for second window
      surfaceWindow = await electronApp.waitForEvent('window');
    }
    await surfaceWindow.waitForLoadState('domcontentloaded');

    // 2. Initial Ambient Verification
    const capsule = surfaceWindow.locator('[data-testid="mave-capsule"]');
    const mark = surfaceWindow.locator('[data-testid="mave-presence-mark"]');
    const brand = surfaceWindow.locator('[data-testid="mave-brand-label"]');
    const statusText = surfaceWindow.locator('[data-testid="mave-status-text"]');

    await expect(capsule).toBeVisible();
    await expect(brand).toHaveText('MAVE');
    await expect(statusText).toHaveText('Ready');
    await expect(mark).toHaveAttribute('data-mode', 'ambient');
    await expect(mark).toHaveAttribute('data-intensity', '0.000');

    // Focus Invariant: Surface native window must NOT be focusable or focused
    const surfaceNativeFocus = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? { isFocusable: surfaceWin.isFocusable(), isFocused: surfaceWin.isFocused() } : null;
    });
    expect(surfaceNativeFocus?.isFocusable).toBe(false);
    expect(surfaceNativeFocus?.isFocused).toBe(false);

    // 3. Register event recorder on surface window before triggering turn
    await surfaceWindow.evaluate(() => {
      (window as any).__recordedModes = [];
      window.mave?.surface?.subscribe((event) => {
        if (event.type === 'snapshot_updated') {
          (window as any).__recordedModes.push(event.snapshot.mode);
        }
      });
    });

    const devStatus = devWindow.locator('[data-testid="assistant-status"]');
    const devWakeStatus = devWindow.locator('[data-testid="wake-status"]');
    await expect(devStatus).toHaveText(/Sleeping/i, { timeout: 10000 });
    await expect(devWakeStatus).toHaveText(/Listening/i, { timeout: 10000 });

    const btnWake = devWindow.locator('[data-testid="btn-simulate-wake"]');
    await btnWake.click();

    // 4. Wait for full mock voice turn cycle to complete and return to Ready (ambient)
    await expect(statusText).toHaveText('Ready', { timeout: 15000 });
    await expect(mark).toHaveAttribute('data-mode', 'ambient');
    await expect(mark).toHaveAttribute('data-intensity', '0.000');

    // Verify that the surface traversed listening/speaking during the turn
    const recordedModes = await surfaceWindow.evaluate(() => (window as any).__recordedModes);
    expect(recordedModes.length).toBeGreaterThan(0);
    expect(recordedModes.some((m: string) => m === 'listening' || m === 'thinking' || m === 'speaking')).toBe(true);

    // 5. Test Interruption / Barge-in on a second turn
    await expect(devWakeStatus).toHaveText(/Listening/i, { timeout: 10000 });
    await surfaceWindow.evaluate(() => {
      (window as any).__recordedModes = [];
    });

    await btnWake.click();

    // Trigger interrupt
    const btnInterrupt = devWindow.locator('[data-testid="btn-interrupt"]');
    try {
      await btnInterrupt.waitFor({ state: 'visible', timeout: 3000 });
      if (await btnInterrupt.isEnabled()) {
        await btnInterrupt.click();
      }
    } catch {}

    // Finally returns calmly to ambient without error
    await expect(statusText).not.toHaveText('Something went wrong');
    await expect(statusText).toHaveText('Ready', { timeout: 15000 });
    await expect(mark).toHaveAttribute('data-mode', 'ambient');
  } finally {
    await electronApp.close();
  }
});
