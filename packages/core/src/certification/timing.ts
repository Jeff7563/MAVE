// ============================================================================
// Ollama Raw Timing & Throughput Capture (F1.5-C2 / C3.1 / C4-B)
//
// Invariant: NEVER reinterpret raw daemon metrics before recording.
// Raw nanoseconds from Ollama must be captured as-is.
// Throughput calculations (tok/s) are derived explicitly and labelled separately.
//
// Historical Discrepancy Resolution:
// Canonical generation throughput is defined as: eval_count / (eval_duration_ns / 1e9).
// Canonical prompt eval throughput is defined as: prompt_eval_count / (prompt_eval_duration_ns / 1e9).
// Total turn duration is defined as: total_duration_ns / 1e9.
// The historical ~16.9 tok/s client observation was caused by client-side event loop throttling
// from synchronous child-process nvidia-smi sampling during streamed chunk consumption,
// NOT by server-side Ollama generation throughput.
// All metrics and raw nanoseconds are explicitly captured and separately labelled.
// ============================================================================

import type { OllamaRawTimingResponse, OllamaTimingMetrics } from './types.js';

const NS_PER_SEC = 1_000_000_000;

/**
 * Converts nanoseconds to seconds with precision preservation.
 */
export function formatNanosecondsToSeconds(nanoseconds: number | undefined): number {
  if (nanoseconds === undefined || nanoseconds === null || !Number.isFinite(nanoseconds) || nanoseconds <= 0) {
    return 0;
  }
  return nanoseconds / NS_PER_SEC;
}

/**
 * Calculates tokens per second given a token count and a duration in nanoseconds.
 * Returns 0 if duration or token count is non-positive or invalid.
 */
export function calculateTokensPerSecond(tokenCount: number | undefined, durationNs: number | undefined): number {
  if (
    tokenCount === undefined ||
    tokenCount === null ||
    tokenCount <= 0 ||
    durationNs === undefined ||
    durationNs === null ||
    durationNs <= 0
  ) {
    return 0;
  }
  const seconds = durationNs / NS_PER_SEC;
  if (seconds <= 0) return 0;
  const tps = tokenCount / seconds;
  return Number(tps.toFixed(2));
}

/**
 * Normalizes raw Ollama timing output into structured metrics.
 * Preserves raw fields directly and calculates derived rates separately.
 */
export function calculateOllamaTiming(raw: OllamaRawTimingResponse): OllamaTimingMetrics {
  const totalNs = raw.total_duration ?? 0;
  const loadNs = raw.load_duration ?? 0;
  const promptEvalNs = raw.prompt_eval_duration ?? 0;
  const promptEvalCount = raw.prompt_eval_count ?? 0;
  const evalNs = raw.eval_duration ?? 0;
  const evalCount = raw.eval_count ?? 0;

  const totalSec = formatNanosecondsToSeconds(totalNs);
  const loadSec = formatNanosecondsToSeconds(loadNs);
  const promptEvalSec = formatNanosecondsToSeconds(promptEvalNs);
  const evalSec = formatNanosecondsToSeconds(evalNs);

  const evalTokensPerSec = calculateTokensPerSecond(evalCount, evalNs);
  const promptEvalTokensPerSec = calculateTokensPerSecond(promptEvalCount, promptEvalNs);
  const e2eTokensPerSec = calculateTokensPerSecond(promptEvalCount + evalCount, totalNs);

  const explanation =
    `evalTokensPerSec (${evalTokensPerSec} tok/s) = eval_count (${evalCount}) / (eval_duration_ns (${evalNs}) / 1e9). ` +
    `promptEvalTokensPerSec (${promptEvalTokensPerSec} tok/s) = prompt_eval_count (${promptEvalCount}) / (prompt_eval_duration_ns (${promptEvalNs}) / 1e9). ` +
    `e2eTokensPerSec (${e2eTokensPerSec} tok/s) = (prompt_tokens (${promptEvalCount}) + eval_tokens (${evalCount})) / (total_duration_ns (${totalNs}) / 1e9). ` +
    `Discrepancy note: ~189-236 tok/s is canonical generation throughput; historical ~16.9 tok/s was client-side throttling from synchronous nvidia-smi sampling during chunk consumption, NOT server-side throughput.`;

  return {
    model: raw.model ?? 'unknown',
    createdAt: raw.created_at,
    done: Boolean(raw.done),
    raw: {
      totalDurationNs: totalNs,
      loadDurationNs: loadNs,
      promptEvalDurationNs: promptEvalNs,
      promptEvalCount,
      evalDurationNs: evalNs,
      evalCount
    },
    calculated: {
      totalDurationSec: Number(totalSec.toFixed(4)),
      loadDurationSec: Number(loadSec.toFixed(4)),
      promptEvalDurationSec: Number(promptEvalSec.toFixed(4)),
      evalDurationSec: Number(evalSec.toFixed(4)),
      evalTokensPerSec,
      promptEvalTokensPerSec,
      e2eTokensPerSec
    },
    explanation
  };
}
