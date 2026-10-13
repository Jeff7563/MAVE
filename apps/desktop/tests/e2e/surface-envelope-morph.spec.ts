import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('Electron desktop: Ambient surface adaptive envelope and morph system E2E verification', async () => {
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

    let surfaceWindow = (await electronApp.windows()).find(w => w !== devWindow);
    if (!surfaceWindow) {
      surfaceWindow = await electronApp.waitForEvent('window');
    }
    await surfaceWindow.waitForLoadState('domcontentloaded');

    // 2. Initial Ambient Bounds & Bottom-Right Anchor Baseline
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

    // Focus safety check
    const focusCheckInitial = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? { isFocusable: surfaceWin.isFocusable(), isFocused: surfaceWin.isFocused() } : null;
    });
    expect(focusCheckInitial?.isFocusable).toBe(false);
    expect(focusCheckInitial?.isFocused).toBe(false);

    // 3. Expand: Ambient -> Card (360x180)
    await surfaceWindow.evaluate(() => {
      window.mave?.surface?.dispatchAction({ type: 'expand', origin: 'user' });
    });

    // Wait for card size class on container
    const capsule = surfaceWindow.locator('[data-testid="mave-capsule"]');
    await expect(capsule).toHaveAttribute('data-size', 'card', { timeout: 3000 });

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

    // Focus safety preserved
    const focusCheckCard = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? { isFocusable: surfaceWin.isFocusable(), isFocused: surfaceWin.isFocused() } : null;
    });
    expect(focusCheckCard?.isFocusable).toBe(false);
    expect(focusCheckCard?.isFocused).toBe(false);

    // 4. Expand: Card -> Expanded (440x580)
    await surfaceWindow.evaluate(() => {
      window.mave?.surface?.dispatchAction({ type: 'expand', origin: 'user' });
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

    // INVARIANT: Bottom-right corner remains strictly anchored in expanded mode
    expect(expandedBounds!.x + expandedBounds!.width).toBe(anchorRight);
    expect(expandedBounds!.y + expandedBounds!.height).toBe(anchorBottom);

    // Focus safety preserved
    const focusCheckExpanded = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? { isFocusable: surfaceWin.isFocusable(), isFocused: surfaceWin.isFocused() } : null;
    });
    expect(focusCheckExpanded?.isFocusable).toBe(false);
    expect(focusCheckExpanded?.isFocused).toBe(false);

    // 5. Collapse: Expanded -> Card -> Compact
    await surfaceWindow.evaluate(() => {
      window.mave?.surface?.dispatchAction({ type: 'collapse', origin: 'user' });
    });
    await expect(capsule).toHaveAttribute('data-size', 'card', { timeout: 3000 });

    // Wait past the 260ms collapse delay for native shrink
    await surfaceWindow.waitForTimeout(350);

    const postCollapseCardBounds = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? surfaceWin.getBounds() : null;
    });
    expect(postCollapseCardBounds!.width).toBe(360);
    expect(postCollapseCardBounds!.height).toBe(180);
    expect(postCollapseCardBounds!.x + postCollapseCardBounds!.width).toBe(anchorRight);
    expect(postCollapseCardBounds!.y + postCollapseCardBounds!.height).toBe(anchorBottom);

    // Collapse to compact
    await surfaceWindow.evaluate(() => {
      window.mave?.surface?.dispatchAction({ type: 'collapse', origin: 'user' });
    });
    await expect(capsule).toHaveAttribute('data-size', 'compact', { timeout: 3000 });

    await surfaceWindow.waitForTimeout(350);

    const postCollapseCompactBounds = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin ? surfaceWin.getBounds() : null;
    });
    expect(postCollapseCompactBounds!.width).toBe(280);
    expect(postCollapseCompactBounds!.height).toBe(80);
    expect(postCollapseCompactBounds!.x + postCollapseCompactBounds!.width).toBe(anchorRight);
    expect(postCollapseCompactBounds!.y + postCollapseCompactBounds!.height).toBe(anchorBottom);

  } finally {
    await electronApp.close();
  }
});

