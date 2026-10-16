// ============================================================================
// Ollama Raw Timing Capture Script (C3.1 / C4-B)
//
// Invariant: Captures raw nanoseconds without reinterpretation.
// Calculates throughput separately to resolve the historical tok/s discrepancy.
// Safe when Ollama is offline (reports error gracefully).
// ============================================================================

import {
  calculateOllamaTiming,
  type OllamaRawTimingResponse
} from '@mave/core';

export interface TimingCaptureOptions {
  readonly baseUrl?: string;
  readonly modelTag?: string;
  readonly prompt?: string;
}

export async function captureRawOllamaTiming(options?: TimingCaptureOptions): Promise<{
  readonly available: boolean;
  readonly raw?: OllamaRawTimingResponse;
  readonly metrics?: ReturnType<typeof calculateOllamaTiming>;
  readonly error?: string;
}> {
  const baseUrl = options?.baseUrl ?? 'http://127.0.0.1:11434';
  const modelTag = options?.modelTag ?? 'qwen2.5:1.5b';
  const prompt = options?.prompt ?? 'Explain what Array.prototype.flatMap does in 2 concise sentences.';

  try {
    const startTime = Date.now();
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelTag,
        prompt,
        stream: false
      })
    });

    if (!res.ok) {
      return {
        available: false,
        error: `Ollama returned HTTP ${res.status}: ${res.statusText}`
      };
    }

    const rawData = (await res.json()) as OllamaRawTimingResponse;
    const metrics = calculateOllamaTiming(rawData);

    return {
      available: true,
      raw: rawData,
      metrics
    };
  } catch (err) {
    return {
      available: false,
      error: `Failed to connect to Ollama daemon at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

// Allow direct execution via tsx
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('=== MAVE C3.1 / C4-B: Ollama Raw Timing Capture ===\n');
  captureRawOllamaTiming().then((result) => {
    if (!result.available) {
      console.log(`[SKIPPED — HOME PC REQUIRED] ${result.error}`);
      return;
    }

    const m = result.metrics!;
    console.log(`Model:                     ${m.model}`);
    console.log(`Done:                      ${m.done}`);
    console.log('\n--- RAW NANOSECONDS (Direct from Ollama) ---');
    console.log(`total_duration:            ${m.raw.totalDurationNs} ns`);
    console.log(`load_duration:             ${m.raw.loadDurationNs} ns`);
    console.log(`prompt_eval_count:         ${m.raw.promptEvalCount} tokens`);
    console.log(`prompt_eval_duration:      ${m.raw.promptEvalDurationNs} ns`);
    console.log(`eval_count:                ${m.raw.evalCount} tokens`);
    console.log(`eval_duration:             ${m.raw.evalDurationNs} ns`);
    console.log('\n--- CALCULATED SECONDS & THROUGHPUT ---');
    console.log(`total_duration:            ${m.calculated.totalDurationSec} s`);
    console.log(`load_duration:             ${m.calculated.loadDurationSec} s`);
    console.log(`prompt_eval_duration:      ${m.calculated.promptEvalDurationSec} s`);
    console.log(`eval_duration:             ${m.calculated.evalDurationSec} s`);
    console.log(`evalTokensPerSec (gen):    ${m.calculated.evalTokensPerSec} tok/s`);
    console.log(`promptEvalTokensPerSec:    ${m.calculated.promptEvalTokensPerSec} tok/s`);
    console.log(`e2eTokensPerSec (turn):    ${m.calculated.e2eTokensPerSec} tok/s`);
    console.log('\n--- EXPLANATION ---');
    console.log(m.explanation);
  });
}
