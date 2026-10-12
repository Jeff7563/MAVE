import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('Electron desktop smoke test: launches, displays status, and transitions wake/sleep', async () => {
  // Launch Electron application with built main script
  const mainScript = path.resolve(__dirname, '../../dist/main/index.js');
  const electronApp = await electron.launch({
    args: [mainScript],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
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

    // 3. Verify other statuses
    const wakeStatus = window.locator('[data-testid="wake-status"]');
    await expect(wakeStatus).toHaveText(/Not configured/i);

    const dbStatus = window.locator('[data-testid="db-status"]');
    await expect(dbStatus).toHaveText(/Ready/i);

    // 4. Click Simulate Wake changes visible state to Waking
    const btnWake = window.locator('[data-testid="btn-simulate-wake"]');
    await btnWake.click();
    await expect(status).toHaveText(/Waking/i);

    // 5. Click Return to Sleep changes it back to Sleeping
    const btnSleep = window.locator('[data-testid="btn-return-sleep"]');
    await btnSleep.click();
    await expect(status).toHaveText(/Sleeping/i);
  } finally {
    await electronApp.close();
  }
});
