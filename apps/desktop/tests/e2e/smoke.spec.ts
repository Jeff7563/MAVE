import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('Electron desktop smoke test: Milestone 1 local wake word, diagnostics, and lifecycle', async () => {
  // Launch Electron application with built main script
  const mainScript = path.resolve(__dirname, '../../dist/main/index.js');
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: 'test',
    MAVE_VOICE_ENABLED: '0'
  };
  delete env['ELECTRON_RUN_AS_NODE'];

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

    const wakeProvider = window.locator('[data-testid="wake-provider"]');
    await expect(wakeProvider).toBeVisible();
    await expect(wakeProvider).toHaveText(/openWakeWord/i);

    const micStatus = window.locator('[data-testid="mic-status"]');
    await expect(micStatus).toBeVisible();

    const wakeWord = window.locator('[data-testid="wake-word"]');
    await expect(wakeWord).toHaveText('MAVE');

    const sensitivity = window.locator('[data-testid="sensitivity-status"]');
    await expect(sensitivity).toHaveText('0.50');

    const threshold = window.locator('[data-testid="threshold-status"]');
    await expect(threshold).toBeVisible();

    const lastWake = window.locator('[data-testid="last-wake-status"]');
    await expect(lastWake).toHaveText(/Never/i);

    const lastWakeScore = window.locator('[data-testid="last-wake-score"]');
    await expect(lastWakeScore).toBeVisible();

    const peakScore = window.locator('[data-testid="peak-score"]');
    await expect(peakScore).toBeVisible();

    const latestScore = window.locator('[data-testid="latest-score"]');
    await expect(latestScore).toBeVisible();

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

    const inputWav = window.locator('[data-testid="input-wav-path"]');
    await expect(inputWav).toBeVisible();

    const btnTestWav = window.locator('[data-testid="btn-test-wav"]');
    await expect(btnTestWav).toBeVisible();

    // 5. Click Simulate Wake triggers WAKING and detection alert
    const btnWake = window.locator('[data-testid="btn-simulate-wake"]');
    await btnWake.click();

    await expect(status).toHaveText(/Waking/i);
    const wakeBadge = window.locator('[data-testid="wake-detected-badge"]');
    await expect(wakeBadge).toBeVisible();
    await expect(wakeBadge).toHaveText(/MAVE detected/i);

    // Last wake should now show a recorded time instead of 'Never'
    await expect(lastWake).not.toHaveText(/Never/i);
    await expect(lastWakeScore).toHaveText(/0\.88/);

    // 6. Click Return to Sleep with ONE click changes it back to Sleeping, clears badge, and resumes Listening
    const btnSleep = window.locator('[data-testid="btn-return-sleep"]');
    await btnSleep.click();

    await expect(status).toHaveText(/Sleeping/i);
    await expect(wakeStatus).toHaveText(/Listening/i);
    // Crucial: "MAVE detected" badge must be cleared immediately upon returning to Sleeping
    await expect(wakeBadge).not.toBeVisible();
    // Crucial: Last Wake timestamp is preserved separately
    await expect(lastWake).not.toHaveText(/Never/i);

    // 7. Restart Wake Engine operates cleanly
    await btnRestart.click();
    await expect(status).toHaveText(/Sleeping/i);
  } finally {
    await electronApp.close();
  }
});

test('Electron desktop smoke test: Milestone 2 developer text chat streaming and session continuity', async () => {
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
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // 1. Verify Developer Chat card and controls are visible
    const chatCard = window.locator('[data-testid="developer-chat-card"]');
    await expect(chatCard).toBeVisible();

    const chatInput = window.locator('[data-testid="chat-input-message"]');
    await expect(chatInput).toBeVisible();

    const btnSend = window.locator('[data-testid="chat-btn-send"]');
    await expect(btnSend).toBeVisible();

    // 2. Type "Hello MAVE" and Send
    await chatInput.fill('Hello MAVE');
    await btnSend.click();

    // 3. User message appears
    const userMsg = window.locator('[data-testid="chat-message-user"]').first();
    await expect(userMsg).toBeVisible();
    await expect(userMsg).toContainText('Hello MAVE');

    // 4. Assistant response appears and completes with deterministic mock response
    const assistantMsg = window.locator('[data-testid="chat-message-assistant"]').first();
    await expect(assistantMsg).toBeVisible();
    await expect(assistantMsg).toContainText('Mock response: Hello MAVE');

    // 5. Provider diagnostic shows 'mock'
    const providerDiag = window.locator('[data-testid="chat-diagnostic-provider"]');
    await expect(providerDiag).toHaveText('mock');

    // 6. Session ID becomes visible
    const sessionDiag = window.locator('[data-testid="chat-diagnostic-session"]');
    await expect(sessionDiag).not.toHaveText('none');
    const firstSessionId = await sessionDiag.innerText();
    expect(firstSessionId.length).toBeGreaterThan(0);

    // 7. Send second message
    await chatInput.fill('What did I just say?');
    await btnSend.click();

    // Verify second user message appears
    const userMsgs = window.locator('[data-testid="chat-message-user"]');
    await expect(userMsgs).toHaveCount(2);
    await expect(userMsgs.nth(1)).toContainText('What did I just say?');

    // Verify second assistant response appears
    const assistantMsgs = window.locator('[data-testid="chat-message-assistant"]');
    await expect(assistantMsgs).toHaveCount(2);
    await expect(assistantMsgs.nth(1)).toContainText('Mock response: What did I just say?');

    // 8. Confirm same Session ID remains active
    const secondSessionId = await sessionDiag.innerText();
    expect(secondSessionId).toBe(firstSessionId);
  } finally {
    await electronApp.close();
  }
});

test('Electron desktop smoke test: Milestone 3 wake to voice handoff end-to-end loop', async () => {
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
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const status = window.locator('[data-testid="assistant-status"]');
    const wakeStatus = window.locator('[data-testid="wake-status"]');

    await expect(status).toHaveText(/Sleeping/i);
    await expect(wakeStatus).toHaveText(/Listening/i);

    // Click Simulate Wake
    const btnWake = window.locator('[data-testid="btn-simulate-wake"]');
    await btnWake.click();

    // Handoff progresses through voice session and automatically returns to Sleeping
    await expect(status).toHaveText(/Sleeping/i, { timeout: 10000 });
    await expect(wakeStatus).toHaveText(/Listening/i, { timeout: 10000 });
  } finally {
    await electronApp.close();
  }
});
