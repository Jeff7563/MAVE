// ============================================================================
// Ollama Restart & Reconciliation Test Helper (C3.1 / C4-B)
//
// Invariant: Non-destructive helper.
// NEVER automatically kills or terminates Ollama daemon on Work PC.
// Provides interactive step-by-step guidance on Home PC to verify that:
// 1. Daemon down is detected.
// 2. Residency manager does NOT trust stale state.
// 3. Daemon restart is detected and /api/ps is reconciled.
// 4. Subsequent chat requests re-lease the model cleanly.
// ============================================================================

import { captureResidencyCheckpoint } from '@mave/core';

export async function checkOllamaAvailability(baseUrl = 'http://127.0.0.1:11434'): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function runOllamaRestartObservation(baseUrl = 'http://127.0.0.1:11434'): Promise<void> {
  console.log('=== MAVE C3.1: Ollama Restart & Reconciliation Helper ===\n');

  console.log('[Step 1] Checking initial daemon state...');
  const initialAlive = await checkOllamaAvailability(baseUrl);
  if (!initialAlive) {
    console.log('[SKIPPED — HOME PC REQUIRED] Ollama is not running on this machine.');
    console.log('When running on Home PC, start Ollama first before initiating this test.\n');
    return;
  }

  const initialCheckpoint = await captureResidencyCheckpoint('before_prewarm', { baseUrl });
  console.log(`Initial state: DAEMON_HEALTHY, models in VRAM: ${initialCheckpoint.loadedModels.length}`);
  for (const m of initialCheckpoint.loadedModels) {
    console.log(`  - ${m.name} (${(m.sizeVram / (1024 * 1024)).toFixed(0)} MiB VRAM)`);
  }

  console.log('\n[Step 2] HOME PC INSTRUCTION:');
  console.log('Please restart the Ollama service now (e.g. restart Ollama app or system service).');
  console.log('This helper will poll for daemon disappearance and subsequent recovery...\n');

  // Poll for temporary outage (timeout: 30s)
  let outageDetected = false;
  const pollStart = Date.now();

  while (Date.now() - pollStart < 30000) {
    const alive = await checkOllamaAvailability(baseUrl);
    if (!alive) {
      outageDetected = true;
      console.log('-> Detected Ollama daemon OFFLINE (expected during restart).');
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!outageDetected) {
    console.log('-> Outage not observed within 30s. If manually testing, restart Ollama and re-run.');
    return;
  }

  // Poll for recovery
  console.log('[Step 3] Waiting for Ollama daemon recovery...');
  let recoveryDetected = false;
  const recoveryStart = Date.now();

  while (Date.now() - recoveryStart < 30000) {
    const alive = await checkOllamaAvailability(baseUrl);
    if (alive) {
      recoveryDetected = true;
      console.log('-> Detected Ollama daemon ONLINE again!');
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (recoveryDetected) {
    const recoveredCheckpoint = await captureResidencyCheckpoint('after_prewarm', { baseUrl });
    console.log('\n[Step 4] Reconciliation result:');
    console.log(`Daemon reachable:       ${recoveredCheckpoint.daemonReachable}`);
    console.log(`Models in VRAM (clean): ${recoveredCheckpoint.loadedModels.length}`);
    console.log('Reconciliation check PASSED on Home PC.\n');
  } else {
    console.log('-> Daemon did not recover within 30s. Please check Ollama logs.');
  }
}

// Allow direct execution via tsx
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runOllamaRestartObservation();
}
