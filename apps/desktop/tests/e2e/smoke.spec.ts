import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('Electron desktop smoke test: Milestone 1 local wake word, diagnostics, and lifecycle', async () => {
  // Launch Electron application with built main script
  const mainScript = path.resolve(__dirname, '../../dist/main/index.js');
  const env = {
    ...process.env,
    NODE_ENV: 'test'
  };
  delete env.ELECTRON_RUN_AS_NODE;

  const electronApp = await electron.launch({
    args: [mainScript],
    env
  });

  try {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // 1. Verify MAVE heading is visible
    const title = window.locator('[data-testid="app-title"]');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('MAVE');

    // 2. Verify initial status is displayed as Sleeping
    const status = window.locator('[data-testid="assistant-status"]');
    await expect(status).toBeVisible();
    await expect(status).toHaveText(/Sleeping/i);

    // 3. Verify wake diagnostics
    const wakeStatus = window.locator('[data-testid="wake-status"]');
    await expect(wakeStatus).toBeVisible();
    await expect(wakeStatus).toHaveText(/Listening/i);

    const micStatus = window.locator('[data-testid="mic-status"]');
    await expect(micStatus).toBeVisible();

    const wakeWord = window.locator('[data-testid="wake-word"]');
    await expect(wakeWord).toHaveText('MAVE');

    const sensitivity = window.locator('[data-testid="sensitivity-status"]');
    await expect(sensitivity).toHaveText('0.50');

    const lastWake = window.locator('[data-testid="last-wake-status"]');
    await expect(lastWake).toHaveText(/Never/i);

    const dbStatus = window.locator('[data-testid="db-status"]');
    await expect(dbStatus).toHaveText(/Ready/i);

    const aiStatus = window.locator('[data-testid="ai-status"]');
    await expect(aiStatus).toHaveText(/Offline/i);

    // 4. Verify controls exist
    const micSelect = window.locator('[data-testid="select-microphone"]');
    await expect(micSelect).toBeVisible();

    const sensSlider = window.locator('[data-testid="input-sensitivity"]');
    await expect(sensSlider).toBeVisible();

    const btnRestart = window.locator('[data-testid="btn-restart-wake"]');
    await expect(btnRestart).toBeVisible();

    // 5. Click Simulate Wake triggers WAKING and detection alert
    const btnWake = window.locator('[data-testid="btn-simulate-wake"]');
    await btnWake.click();

    await expect(status).toHaveText(/Waking/i);
    const wakeBadge = window.locator('[data-testid="wake-detected-badge"]');
    await expect(wakeBadge).toBeVisible();
    await expect(wakeBadge).toHaveText(/MAVE detected/i);

    // Last wake should now show a recorded time instead of 'Never'
    await expect(lastWake).not.toHaveText(/Never/i);

    // 6. Click Return to Sleep changes it back to Sleeping and resumes Listening
    const btnSleep = window.locator('[data-testid="btn-return-sleep"]');
    await btnSleep.click();

    await expect(status).toHaveText(/Sleeping/i);
    await expect(wakeStatus).toHaveText(/Listening/i);

    // 7. Restart Wake Engine operates cleanly
    await btnRestart.click();
    await expect(status).toHaveText(/Sleeping/i);
  } finally {
    await electronApp.close();
  }
});
