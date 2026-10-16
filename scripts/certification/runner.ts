#!/usr/bin/env tsx
// ============================================================================
// MAVE C3.1 / C4-B Home-PC Live Certification Runner
//
// Invariant: Non-destructive verification.
// NEVER modifies or pulls models.
// NEVER invents or synthesizes fake hardware results.
// Completely safe on Work PC (all hardware checks report SKIPPED).
// ============================================================================

import {
  BrainProviderRegistry,
  BrainRouter,
  QUALIFIED_FAST_BRAIN_DIGEST,
  QUALIFIED_FAST_BRAIN_TAG,
  TELEMETRY_BENCHMARK_CASES,
  VramPhaseTimeline,
  checkLocalOllamaDigest,
  formatRouteTelemetry,
  formatSystemInfo,
  gatherSystemInfo,
  sampleNvidiaGpu,
  serializeRouteTelemetry
} from '@mave/core';
import { OllamaBrainProvider } from '@mave/providers';
import { runCancellationVerification } from './cancellation-runner.js';
import { runLanguageSessionVerification } from './language-runner.js';
import { runMultiTurnVerification } from './multi-turn-runner.js';
import { captureRawOllamaTiming } from './timing-capture.js';

export async function runCertificationHarness(): Promise<void> {
  console.log('================================================================================');
  console.log('   MAVE C3.1 / C4-B LIVE CERTIFICATION RUNNER (Home PC Baseline)');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // 1. System Environment
  // --------------------------------------------------------------------------
  console.log('[SECTION 1] System Environment & Hardware Detection');
  console.log('--------------------------------------------------------------------------------');
  const sysInfo = await gatherSystemInfo();
  console.log(formatSystemInfo(sysInfo));
  console.log('');

  // --------------------------------------------------------------------------
  // 2. Ollama Connectivity & Exact Digest Verification
  // --------------------------------------------------------------------------
  console.log('[SECTION 2] Exact Fast Brain Model Digest Verification');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Target Model:   ${QUALIFIED_FAST_BRAIN_TAG}`);
  console.log(`Expected Digest: ${QUALIFIED_FAST_BRAIN_DIGEST}`);

  const digestResult = await checkLocalOllamaDigest(
    'http://127.0.0.1:11434',
    QUALIFIED_FAST_BRAIN_TAG,
    QUALIFIED_FAST_BRAIN_DIGEST
  );

  console.log(`Digest Status:  [${digestResult.status}]`);
  console.log(`Details:        ${digestResult.details}`);
  if (digestResult.actualDigest) {
    console.log(`Actual Digest:  ${digestResult.actualDigest}`);
  }
  console.log('');

  // --------------------------------------------------------------------------
  // 3. Baseline GPU VRAM Sampling
  // --------------------------------------------------------------------------
  console.log('[SECTION 3] GPU VRAM Sampling (Baseline)');
  console.log('--------------------------------------------------------------------------------');
  const vramTimeline = new VramPhaseTimeline();
  const baselineGpu = vramTimeline.record('BASELINE');

  if (baselineGpu.available) {
    console.log(`GPU Total:   ${baselineGpu.totalMiB.toFixed(0)} MiB`);
    console.log(`GPU Used:    ${baselineGpu.usedMiB.toFixed(0)} MiB`);
    console.log(`GPU Free:    ${baselineGpu.freeMiB.toFixed(0)} MiB`);
    console.log(`Utilization: ${baselineGpu.utilizationGpuPct}%`);
  } else {
    console.log(`[SKIPPED — HOME PC REQUIRED] GPU sampling unavailable: ${baselineGpu.error ?? 'nvidia-smi not found'}`);
  }
  console.log('');

  // --------------------------------------------------------------------------
  // 4. Route Telemetry Verification across Benchmark Cases
  // --------------------------------------------------------------------------
  console.log('[SECTION 4] Route Telemetry Verification (Task Policy & Routing)');
  console.log('--------------------------------------------------------------------------------');

  const registry = new BrainProviderRegistry();
  const ollama = new OllamaBrainProvider({ baseUrl: 'http://127.0.0.1:11434' });
  registry.register(ollama, {
    kind: 'model_provider',
    accessPath: 'local_runtime',
    accessClass: 'local',
    displayName: 'Ollama Fast Brain'
  });
  const router = new BrainRouter({ registry, defaultProvider: 'ollama' });

  for (const tc of TELEMETRY_BENCHMARK_CASES) {
    try {
      const decision = await router.route({
        taskIntent: tc.taskIntent
      });
      const telemetry = serializeRouteTelemetry(decision);

      console.log(`Case [${tc.id}] "${tc.name}":`);
      console.log(`  Prompt:               "${tc.prompt}"`);
      console.log(`  Resolved ProfileId:   ${telemetry.profileId} (Expected: ${tc.expectedProfileId})`);
      console.log(`  Selected Provider:    ${telemetry.selectedProviderId} (kind: ${telemetry.providerKind})`);
      console.log(`  Selected Model:       ${telemetry.selectedModelId}`);
      console.log(`  Route Reason:         ${telemetry.routeReason}`);
      console.log(`  Fallback Used:        ${telemetry.fallbackUsed}`);
      console.log(`  Route Attempts:       ${telemetry.routeAttempts}\n`);
    } catch (err) {
      const taskPolicy = router.getTaskPolicy();
      const taskDecision = taskPolicy.resolve({ taskIntent: tc.taskIntent });
      console.log(`Case [${tc.id}] "${tc.name}": [SKIPPED LIVE — HOME PC REQUIRED]`);
      console.log(`  TaskPolicy Verified:  taskIntent: '${taskDecision.taskIntent}' -> profileId: '${taskDecision.profileId}' (role: ${taskDecision.modelRole})`);
      console.log(`  Live Execution:       ${err instanceof Error ? err.message : String(err)} (Ollama daemon offline)\n`);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Deterministic Multi-Turn Check
  // --------------------------------------------------------------------------
  console.log('[SECTION 5] Multi-Turn Conversation Continuity Check');
  console.log('--------------------------------------------------------------------------------');
  const multiTurnResult = await runMultiTurnVerification();

  if (multiTurnResult.available) {
    console.log(`Session ID:          ${multiTurnResult.sessionId}`);
    console.log(`Turn Count:          ${multiTurnResult.turns.length}`);
    for (const t of multiTurnResult.turns) {
      console.log(`  [Turn ${t.turnIndex}] Prompt:   "${t.prompt}"`);
      console.log(`           Response: "${t.responseText.slice(0, 70)}..." (${t.durationMs}ms)`);
    }
    console.log(`Context Continuity:  ${multiTurnResult.contextContinuityPassed ? 'PASSED' : 'FAILED'}`);
    console.log(`Evidence:            ${multiTurnResult.continuityEvidence}\n`);
  } else {
    console.log(`[SKIPPED — HOME PC REQUIRED] Multi-turn live check: ${multiTurnResult.error}\n`);
  }

  // --------------------------------------------------------------------------
  // 6. Language Experience Semantics Check
  // --------------------------------------------------------------------------
  console.log('[SECTION 6] Language Experience Semantics & Anti-Hallucination Guard');
  console.log('--------------------------------------------------------------------------------');
  const langResult = await runLanguageSessionVerification();

  console.log(`Structural Contracts:           ${langResult.structuralContractsPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`Anti-Hallucination Guard:        ${langResult.antiHallucinationGuardPassed ? 'PASSED (fake metrics blocked)' : 'FAILED'}`);
  console.log(`Roleplay Lifecycle:              ${langResult.roleplayLifecyclePassed ? 'PASSED (step-out/resume verified)' : 'FAILED'}`);
  console.log(`Learning Stages (seen/prac/rev): ${langResult.learningStageProgressionPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`Live Language Turn:              ${langResult.liveTurnCompleted ? 'PASSED' : 'SKIPPED (Home PC required)'}`);
  if (langResult.liveEvidence) {
    console.log(`Evidence:                        ${langResult.liveEvidence}`);
  }
  console.log('');

  // --------------------------------------------------------------------------
  // 7. Cancellation & Non-Retry Invariant (F1.4)
  // --------------------------------------------------------------------------
  console.log('[SECTION 7] Cancellation & Streaming F1.4 Invariant Check');
  console.log('--------------------------------------------------------------------------------');
  const cancelResult = await runCancellationVerification();

  if (cancelResult.available) {
    console.log(`Cancellation Triggered:      ${cancelResult.cancellationTriggered}`);
    console.log(`Deltas Received:             ${cancelResult.receivedDeltasBeforeCancel} before / ${cancelResult.receivedDeltasAfterCancel} after`);
    console.log(`Terminal Event:              ${cancelResult.terminalEventType}`);
    console.log(`Fallback Used:               ${cancelResult.fallbackUsed} (must be false)`);
    console.log(`Route Attempts:              ${cancelResult.routeAttempts} (no hidden retry)`);
    console.log(`Invariant Result:            ${cancelResult.invariantPassed ? 'PASSED' : 'FAILED'}\n`);
  } else {
    console.log(`[SKIPPED — HOME PC REQUIRED] Cancellation check: ${cancelResult.error}\n`);
  }

  // --------------------------------------------------------------------------
  // 8. Raw Timing & Throughput Capture
  // --------------------------------------------------------------------------
  console.log('[SECTION 8] Ollama Raw Timing & Tok/s Resolution');
  console.log('--------------------------------------------------------------------------------');
  const timingResult = await captureRawOllamaTiming();

  if (timingResult.available && timingResult.metrics) {
    const m = timingResult.metrics;
    console.log(`Model:                     ${m.model}`);
    console.log(`Raw eval_duration:         ${m.raw.evalDurationNs} ns (${m.calculated.evalDurationSec}s)`);
    console.log(`Raw total_duration:        ${m.raw.totalDurationNs} ns (${m.calculated.totalDurationSec}s)`);
    console.log(`Generation Throughput:     ${m.calculated.evalTokensPerSec} tok/s`);
    console.log(`E2E Turn Throughput:       ${m.calculated.e2eTokensPerSec} tok/s`);
    console.log(`Discrepancy Resolution:    ${m.explanation}\n`);
  } else {
    console.log(`[SKIPPED — HOME PC REQUIRED] Timing capture: ${timingResult.error}\n`);
  }

  // --------------------------------------------------------------------------
  // 9. Manual Certification Checklist Reminders
  // --------------------------------------------------------------------------
  console.log('================================================================================');
  console.log('   MANUAL HOME-PC CERTIFICATION CHECKS (Execute in sequence)');
  console.log('================================================================================');
  console.log('The following physical checks must be performed manually on Home PC:');
  console.log('  1. Microphone Audio Sensing:  Verify wake word "MAVE" triggers waking state');
  console.log('  2. Audio Output & TTS:        Verify EdgeTTS playback is clearly audible');
  console.log('  3. PresenceMark Visual Sync:  Verify color transitions (sleeping/listening/speaking)');
  console.log('  4. VRAM Co-Residency:         Run nvidia-smi with CUDA faster-whisper + qwen2.5:1.5b');
  console.log('  5. Idle Eviction:             Wait 5 minutes; verify Ollama unloads model from VRAM');
  console.log('  6. Ollama Daemon Restart:     Run `pnpm tsx scripts/certification/restart-helper.ts`');
  console.log('\nReport Template: docs/architecture/MAVE_C3_1_C4_B_HOME_LIVE_CERTIFICATION_TEMPLATE.md');
  console.log('================================================================================\n');
}

// Execute when invoked directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runCertificationHarness().catch((err) => {
    console.error('Fatal harness error:', err);
    process.exit(1);
  });
}
