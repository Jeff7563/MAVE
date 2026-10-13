#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AntigravityBrainProvider } from '@mave/providers';

/**
 * Opt-in manual live verification script for Google Antigravity CLI integration.
 * This script is intentionally excluded from automated test suites.
 * It connects to the live local `agy` CLI using the user's active authentication.
 */
async function runLiveTest(): Promise<void> {
  console.log('====================================================');
  console.log(' MAVE — Google Antigravity CLI Live Verification    ');
  console.log('====================================================\n');

  const liveWorkspace = path.join(os.tmpdir(), 'mave-antigravity-live-test');
  fs.mkdirSync(liveWorkspace, { recursive: true });

  console.log(`Isolated Workspace: ${liveWorkspace}`);

  const provider = new AntigravityBrainProvider({
    cwd: liveWorkspace
  });

  // 1. Health check
  console.log('\n[1/2] Running Health Check (agy --version)...');
  const healthStart = Date.now();
  const health = await provider.health();
  const healthDuration = Date.now() - healthStart;

  console.log(`Status:    ${health.status}`);
  console.log(`Message:   ${health.message}`);
  console.log(`Latency:   ${healthDuration}ms`);

  if (health.status !== 'healthy') {
    console.error(`\nProvider is not healthy: ${health.message}`);
    console.error('Please ensure `agy` is installed on PATH and authenticated.');
    process.exit(1);
  }

  // 2. Live Conversation Prompt
  console.log('\n[2/2] Sending Test Conversation Prompt...');
  const prompt = 'Say hello in one short sentence.';
  console.log(`User Prompt: "${prompt}"\n`);
  process.stdout.write('Assistant: ');

  const streamStart = Date.now();
  let firstDeltaLatency: number | null = null;
  let fullResponse = '';

  try {
    const stream = provider.chat({
      requestId: `live-${Date.now()}`,
      sessionId: `live-session-${Date.now()}`,
      intent: 'conversation',
      messages: [{ role: 'user', content: prompt }]
    });

    for await (const event of stream) {
      if (event.type === 'delta') {
        if (firstDeltaLatency === null) {
          firstDeltaLatency = Date.now() - streamStart;
        }
        process.stdout.write(event.text);
        fullResponse += event.text;
      } else if (event.type === 'completed') {
        const totalDuration = Date.now() - streamStart;
        console.log('\n\n--- Result Summary ---');
        console.log(`Total Latency:        ${totalDuration}ms`);
        if (firstDeltaLatency !== null) {
          console.log(`Time-to-First-Token:  ${firstDeltaLatency}ms`);
        }
        console.log(`Finish Reason:        ${event.finishReason ?? 'stop'}`);
        if (event.usage) {
          console.log(`Prompt Tokens:        ${event.usage.promptTokens ?? 'n/a'}`);
          console.log(`Completion Tokens:    ${event.usage.completionTokens ?? 'n/a'}`);
          console.log(`Total Tokens:         ${event.usage.totalTokens ?? 'n/a'}`);
        }
        console.log('\nLive Antigravity Brain Provider verification SUCCEEDED.');
      } else if (event.type === 'error') {
        console.error(`\nProvider Error [${event.error.code}]: ${event.error.message}`);
        process.exit(1);
      } else if (event.type === 'cancelled') {
        console.warn(`\nRequest was cancelled: ${event.reason}`);
      }
    }
  } catch (err: any) {
    console.error(`\nUnexpected execution error: ${err?.message || err}`);
    process.exit(1);
  } finally {
    try {
      fs.rmSync(liveWorkspace, { recursive: true, force: true });
    } catch {
      // Safe cleanup
    }
  }
}

runLiveTest().catch((err) => {
  console.error('Fatal error running live test:', err);
  process.exit(1);
});

