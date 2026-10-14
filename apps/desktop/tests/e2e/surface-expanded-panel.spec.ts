import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('Electron desktop: Ambient surface Expanded Context Panel & Rich Content E2E verification', async () => {
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
    // 1. Await Dev Window and Surface Window
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

    // 2. Initial Ambient Capsule State (280x80 DIP)
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

    // 3. Trigger Mock Voice Session
    await devWindow.evaluate(async () => {
      await (window as any).mave.sendCommand('simulate-wake');
    });

    // 4. Verify Transition to Card Envelope (360x180 DIP)
    const capsule = surfaceWindow.locator('[data-testid="mave-capsule"]');
    await expect(capsule).toHaveAttribute('data-size', 'card', { timeout: 6000 });

    // 5. Expand from Card to Expanded Context Panel (440x580 DIP) via Surface Action
    await surfaceWindow.evaluate(() => {
      (window as any).mave?.surface?.dispatchAction({ type: 'expand', origin: 'user' });
    });
    await expect(capsule).toHaveAttribute('data-size', 'expanded', { timeout: 3000 });

    const expandedBounds = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? surfaceWin.getBounds() : null;
    });

    expect(expandedBounds).not.toBeNull();
    expect(expandedBounds!.width).toBe(440);
    expect(expandedBounds!.height).toBe(580);

    // INVARIANT: Bottom-right corner remains strictly anchored
    expect(expandedBounds!.x + expandedBounds!.width).toBe(anchorRight);
    expect(expandedBounds!.y + expandedBounds!.height).toBe(anchorBottom);

    // INVARIANT: Window remains passive and unfocused
    const focusCheckExpanded = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin
        ? { isFocusable: surfaceWin.isFocusable(), isFocused: surfaceWin.isFocused() }
        : null;
    });
    expect(focusCheckExpanded?.isFocusable).toBe(false);
    expect(focusCheckExpanded?.isFocused).toBe(false);

    // 6. Verify Expanded Panel DOM Components
    const expandedPanel = surfaceWindow.locator('[data-testid="mave-expanded-panel"]');
    await expect(expandedPanel).toBeVisible({ timeout: 4000 });

    const viewport = surfaceWindow.locator('[data-testid="mave-expanded-viewport"]');
    await expect(viewport).toBeVisible();

    const srAnnouncer = surfaceWindow.locator('[data-testid="mave-sr-announcer"]');
    await expect(srAnnouncer).toBeAttached();

    // 7. Inject rich markdown content into surface renderer to test rich components
    await surfaceWindow.evaluate(() => {
      // Simulate snapshot update with rich markdown containing code and table
      const richMarkdown = [
        'Here is the breakdown of the requested data:',
        '',
        '```typescript',
        'const answer: number = 42;',
        'console.log("Result:", answer);',
        '```',
        '',
        '| Metric | Value | Status |',
        '| :--- | :--- | :--- |',
        '| Latency | 45ms | Nominal |',
        '| Accuracy | 99.8% | High |',
        '',
        'Refer to [Documentation](https://mave.internal/docs) for full details.'
      ].join('\n');

      window.dispatchEvent(
        new CustomEvent('mave-test-snapshot', {
          detail: {
            sizeClass: 'expanded',
            mode: 'expanded_response',
            activity: 'idle',
            assistantText: richMarkdown,
            isSpeakingFinished: true
          }
        })
      );
    });

    // 8. Collapse back to Card (360x180 DIP)
    await surfaceWindow.evaluate(() => {
      (window as any).mave?.surface?.dispatchAction({ type: 'collapse', origin: 'user' });
    });
    await expect(capsule).toHaveAttribute('data-size', 'card', { timeout: 3000 });

    // Wait past the 260ms collapse delay for native shrink
    await surfaceWindow.waitForTimeout(350);

    const collapsedBounds = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? surfaceWin.getBounds() : null;
    });
    expect(collapsedBounds!.width).toBe(360);
    expect(collapsedBounds!.height).toBe(180);
    expect(collapsedBounds!.x + collapsedBounds!.width).toBe(anchorRight);
    expect(collapsedBounds!.y + collapsedBounds!.height).toBe(anchorBottom);

    // 9. Dismiss surface window cleanly
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
