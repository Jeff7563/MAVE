import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('Electron desktop: Ambient surface Compact Response and Quick Info card E2E verification', async () => {
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
    const devWindow = await electronApp.firstWindow();
    await devWindow.waitForLoadState('domcontentloaded');

    let surfaceWindow = (await electronApp.windows()).find((w) => w !== devWindow);
    if (!surfaceWindow) {
      surfaceWindow = await electronApp.waitForEvent('window');
    }
    await surfaceWindow.waitForLoadState('domcontentloaded');

    // 2. Initial Ambient Capsule State (280x80 envelope)
    const initialBounds = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? surfaceWin.getBounds() : null;
    });

    expect(initialBounds).not.toBeNull();
    expect(initialBounds!.width).toBe(280);
    expect(initialBounds!.height).toBe(80);

    const anchorRight = initialBounds!.x + initialBounds!.width;
    const anchorBottom = initialBounds!.y + initialBounds!.height;

    // Focus safety check: Passive surface must not steal focus
    const focusCheckInitial = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin
        ? { isFocusable: surfaceWin.isFocusable(), isFocused: surfaceWin.isFocused() }
        : null;
    });
    expect(focusCheckInitial?.isFocusable).toBe(false);
    expect(focusCheckInitial?.isFocused).toBe(false);

    // 3. Trigger Mock Voice Session via Developer Command
    await devWindow.evaluate(async () => {
      await (window as any).mave.sendCommand('simulate-wake');
    });

    // 4. Verify Smooth Transition to Card Envelope (360x180) during Voice Speaking & Response Hold
    const capsule = surfaceWindow.locator('[data-testid="mave-capsule"]');
    await expect(capsule).toHaveAttribute('data-size', 'card', { timeout: 6000 });

    const cardBounds = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? surfaceWin.getBounds() : null;
    });

    expect(cardBounds).not.toBeNull();
    expect(cardBounds!.width).toBe(360);
    expect(cardBounds!.height).toBe(180);

    // INVARIANT: Bottom-right corner remains strictly anchored
    expect(cardBounds!.x + cardBounds!.width).toBe(anchorRight);
    expect(cardBounds!.y + cardBounds!.height).toBe(anchorBottom);

    // 5. Verify Response Card Component and Content Presentation
    const responseCard = surfaceWindow.locator('[data-testid="mave-response-card"]');
    await expect(responseCard).toBeVisible({ timeout: 4000 });

    const responseText = surfaceWindow.locator('[data-testid="mave-response-text"]');
    await expect(responseText).toBeVisible({ timeout: 4000 });

    const brandLabel = surfaceWindow.locator('[data-testid="mave-brand-label"]');
    await expect(brandLabel).toHaveText('MAVE');

    // 6. Focus Safety Invariant: Still not focused
    const focusCheckCard = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin
        ? { isFocusable: surfaceWin.isFocusable(), isFocused: surfaceWin.isFocused() }
        : null;
    });
    expect(focusCheckCard?.isFocusable).toBe(false);
    expect(focusCheckCard?.isFocused).toBe(false);

    // 7. Expand from Card to Context Panel (440x580)
    await surfaceWindow.evaluate(() => {
      (window as any).mave?.surface?.dispatchAction({ type: 'expand', origin: 'user' });
    });
    await expect(capsule).toHaveAttribute('data-size', 'expanded', { timeout: 3000 });

    const expandedBounds = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? surfaceWin.getBounds() : null;
    });
    expect(expandedBounds!.width).toBe(440);
    expect(expandedBounds!.height).toBe(580);
    expect(expandedBounds!.x + expandedBounds!.width).toBe(anchorRight);
    expect(expandedBounds!.y + expandedBounds!.height).toBe(anchorBottom);

    // 8. Dismiss action hides surface window
    await surfaceWindow.evaluate(() => {
      (window as any).mave?.surface?.dispatchAction({ type: 'dismiss', origin: 'user' });
    });
    await surfaceWindow.waitForTimeout(200);

    const isVisibleAfterDismiss = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? surfaceWin.isVisible() : null;
    });
    expect(isVisibleAfterDismiss).toBe(false);
  } finally {
    await electronApp.close();
  }
});

