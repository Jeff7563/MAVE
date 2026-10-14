import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('Electron desktop: Surface interaction, focus acquisition, Escape release, click-through & security E2E verification', async () => {
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
    // TEST A: HARD INVARIANT - Passive surface NEVER steals keyboard focus
    // ------------------------------------------------------------------
    const initialFocus = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin
        ? { isFocusable: surfaceWin.isFocusable(), isFocused: surfaceWin.isFocused() }
        : null;
    });
    expect(initialFocus?.isFocusable).toBe(false);
    expect(initialFocus?.isFocused).toBe(false);

    // Simulate passive voice event: wake -> listening -> speaking -> card response
    await devWindow.evaluate(async () => {
      await (window as any).mave.sendCommand('simulate-wake');
    });

    const capsule = surfaceWindow.locator('[data-testid="mave-capsule"]');
    await expect(capsule).toHaveAttribute('data-size', 'card', { timeout: 6000 });

    // Invariant holds during rich voice/response transitions: still not focusable, still not focused
    const passiveVoiceFocus = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
      return surfaceWin
        ? { isFocusable: surfaceWin.isFocusable(), isFocused: surfaceWin.isFocused() }
        : null;
    });
    expect(passiveVoiceFocus?.isFocusable).toBe(false);
    expect(passiveVoiceFocus?.isFocused).toBe(false);

    // ------------------------------------------------------------------
    // TEST B & C: Intentional Native Focus Acquisition
    // ------------------------------------------------------------------
    // Surface user clicks the focus affordance button
    const focusButton = surfaceWindow.locator('[data-testid="mave-action-focus"]');
    await expect(focusButton).toBeVisible();
    await focusButton.click();

    // Verify dynamic native focusability transition
    await expect.poll(async () => {
      return await electronApp.evaluate(({ BrowserWindow }) => {
        const wins = BrowserWindow.getAllWindows();
        const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
        return surfaceWin
          ? { isFocusable: surfaceWin.isFocusable(), isFocused: surfaceWin.isFocused() }
          : null;
      });
    }, { timeout: 4000 }).toEqual({ isFocusable: true, isFocused: true });

    // ------------------------------------------------------------------
    // TEST D: Keyboard Navigation Foundation
    // ------------------------------------------------------------------
    // With focus in surface window, press Tab to navigate interactive controls
    await surfaceWindow.keyboard.press('Tab');
    const focusedTag = await surfaceWindow.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBe('BUTTON');

    // Verify presence mark is decorative and skipped
    const presenceMarkAriaHidden = await surfaceWindow
      .locator('[data-testid="mave-presence-mark"]')
      .getAttribute('aria-hidden');
    expect(presenceMarkAriaHidden).toBe('true');

    // ------------------------------------------------------------------
    // TEST E: Focus Release via Escape
    // ------------------------------------------------------------------
    // Press Escape to intentionally release keyboard focus
    await surfaceWindow.keyboard.press('Escape');

    // Verify native demotion: focusable is reverted to false
    await expect.poll(async () => {
      return await electronApp.evaluate(({ BrowserWindow }) => {
        const wins = BrowserWindow.getAllWindows();
        const surfaceWin = wins.find((w) => w.webContents.getURL().includes('view=surface'));
        return surfaceWin ? surfaceWin.isFocusable() : null;
      });
    }, { timeout: 4000 }).toBe(false);

    // Verify surface content remains visible and not dismissed prematurely
    await expect(capsule).toBeVisible();

    // ------------------------------------------------------------------
    // TEST F: Click-Through & Hit Region Reliability
    // ------------------------------------------------------------------
    // Report interactive hover (simulating cursor entering capsule)
    await surfaceWindow.evaluate(async () => {
      await (window as any).mave.surface.reportInteractiveHover(true);
    });

    // Verify dedicated surface preload omits getDiagnostics (least privilege)
    const surfaceHasDiagnostics = await surfaceWindow.evaluate(() => {
      return typeof (window as any).mave?.surface?.getDiagnostics === 'function';
    });
    expect(surfaceHasDiagnostics).toBe(false);

    let diagnostics = await devWindow.evaluate(async () => {
      return await (window as any).mave.surface.getDiagnostics();
    });
    expect(diagnostics.ignoreMouse).toBe(false);

    // Report unhover (simulating cursor returning to transparent pad)
    await surfaceWindow.evaluate(async () => {
      await (window as any).mave.surface.reportInteractiveHover(false);
    });

    diagnostics = await devWindow.evaluate(async () => {
      return await (window as any).mave.surface.getDiagnostics();
    });
    expect(diagnostics.ignoreMouse).toBe(true);

    // ------------------------------------------------------------------
    // TEST G: Link / Navigation Security
    // ------------------------------------------------------------------
    // Attempt to navigate via open_link action
    await surfaceWindow.evaluate(async () => {
      await (window as any).mave.surface.dispatchAction({
        type: 'open_link',
        origin: 'user',
        url: 'https://github.com'
      });
    });

    // Window must NOT have navigated away
    expect(surfaceWindow.url()).toContain('view=surface');

    // ------------------------------------------------------------------
    // TEST H: Developer Window Independence
    // ------------------------------------------------------------------
    const devTitle = await devWindow.title();
    expect(devTitle).toContain('MAVE');
  } finally {
    await electronApp.close();
  }
});
