// ============================================================================
// Latency Recorder & Statistical Aggregator (C3.1 / C4-B)
//
// Canonical Guidance:
// Fast conversational Brain TTFT is approximately 1–3 seconds where hardware permits.
// Invariant: Record empirical values as-is. NEVER invent rigid sub-ranges or thresholds.
// ============================================================================

import type {
  LatencyAggregationSummary,
  LatencyMetricStats,
  TurnLatencySample
} from './types.js';

/**
 * Calculates the numerical median of an array of numbers.
 * Handles empty, single-element, even, and odd counts deterministically.
 */
export function calculateMedian(values: number[]): number {
  if (!values || values.length === 0) {
    return 0;
  }
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) {
    return 0;
  }
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  const midVal = sorted[mid];
  if (midVal === undefined) {
    return 0;
  }
  if (sorted.length % 2 !== 0) {
    return Number(midVal.toFixed(2));
  }
  const prevVal = sorted[mid - 1];
  if (prevVal === undefined) {
    return Number(midVal.toFixed(2));
  }
  const avg = (prevVal + midVal) / 2;
  return Number(avg.toFixed(2));
}

/**
 * Computes min, median, max summary for a numeric series.
 */
export function calculateMetricStats(values: (number | undefined)[]): LatencyMetricStats {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  if (valid.length === 0) {
    return { count: 0, min: 0, median: 0, max: 0 };
  }
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const median = calculateMedian(valid);

  return {
    count: valid.length,
    min: Number(min.toFixed(2)),
    median,
    max: Number(max.toFixed(2))
  };
}

/**
 * Aggregates an array of individual TurnLatencySamples into summary metrics.
 */
export function aggregateLatencySamples(samples: readonly TurnLatencySample[]): LatencyAggregationSummary {
  const totalSamples = samples.length;
  const warmSamples = samples.filter((s) => s.isWarm).length;
  const coldSamples = samples.filter((s) => !s.isWarm).length;

  return {
    totalSamples,
    warmSamples,
    coldSamples,
    brainTtftMs: calculateMetricStats(samples.map((s) => s.brainTtftMs)),
    brainTotalMs: calculateMetricStats(samples.map((s) => s.brainTotalMs)),
    sttLatencyMs: calculateMetricStats(samples.map((s) => s.sttLatencyMs)),
    ttsTtfaMs: calculateMetricStats(samples.map((s) => s.ttsTtfaMs)),
    totalTurnDurationMs: calculateMetricStats(samples.map((s) => s.totalTurnDurationMs))
  };
}

/**
 * In-memory recorder for capturing latency benchmarks.
 */
export class LatencyBenchmarkRecorder {
  private readonly samples: TurnLatencySample[] = [];

  record(sample: TurnLatencySample): void {
    this.samples.push(sample);
  }

  getSamples(): readonly TurnLatencySample[] {
    return this.samples;
  }

  getSummary(): LatencyAggregationSummary {
    return aggregateLatencySamples(this.samples);
  }

  formatMarkdownTable(): string {
    const lines: string[] = [
      '| Sample ID | Mode | Prompt | STT (ms) | Brain TTFT (ms) | Brain Total (ms) | TTS TTFA (ms) | Turn Duration (ms) | tok/s |',
      '|---|---|---|---|---|---|---|---|---|'
    ];

    for (const s of this.samples) {
      lines.push(
        `| ${s.sampleId} | ${s.isWarm ? 'WARM' : 'COLD'} | "${s.promptText.slice(0, 30)}..." | ${s.sttLatencyMs ?? 'N/A'} | ${s.brainTtftMs ?? 'N/A'} | ${s.brainTotalMs ?? 'N/A'} | ${s.ttsTtfaMs ?? 'N/A'} | ${s.totalTurnDurationMs ?? 'N/A'} | ${s.evalTokensPerSec ?? 'N/A'} |`
      );
    }

    const summary = this.getSummary();
    lines.push('');
    lines.push('### Summary Aggregation');
    lines.push('| Metric | Samples | Min (ms) | Median (ms) | Max (ms) |');
    lines.push('|---|---|---|---|---|');

    if (summary.brainTtftMs && summary.brainTtftMs.count > 0) {
      lines.push(`| **Brain TTFT** | ${summary.brainTtftMs.count} | ${summary.brainTtftMs.min} | ${summary.brainTtftMs.median} | ${summary.brainTtftMs.max} |`);
    }
    if (summary.brainTotalMs && summary.brainTotalMs.count > 0) {
      lines.push(`| **Brain Total Time** | ${summary.brainTotalMs.count} | ${summary.brainTotalMs.min} | ${summary.brainTotalMs.median} | ${summary.brainTotalMs.max} |`);
    }
    if (summary.sttLatencyMs && summary.sttLatencyMs.count > 0) {
      lines.push(`| **STT Latency** | ${summary.sttLatencyMs.count} | ${summary.sttLatencyMs.min} | ${summary.sttLatencyMs.median} | ${summary.sttLatencyMs.max} |`);
    }
    if (summary.ttsTtfaMs && summary.ttsTtfaMs.count > 0) {
      lines.push(`| **TTS TTFA** | ${summary.ttsTtfaMs.count} | ${summary.ttsTtfaMs.min} | ${summary.ttsTtfaMs.median} | ${summary.ttsTtfaMs.max} |`);
    }
    if (summary.totalTurnDurationMs && summary.totalTurnDurationMs.count > 0) {
      lines.push(`| **Total Turn Duration** | ${summary.totalTurnDurationMs.count} | ${summary.totalTurnDurationMs.min} | ${summary.totalTurnDurationMs.median} | ${summary.totalTurnDurationMs.max} |`);
    }

    return lines.join('\n');
  }
}
