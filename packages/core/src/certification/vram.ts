// ============================================================================
// NVIDIA VRAM & GPU Sampler Utility (C3.1 / C4-B)
//
// Invariant: Windows-safe. Handles systems without NVIDIA GPU gracefully.
// Captures empirical GPU memory stats across labeled lifecycle phases.
// NEVER invents or hardcodes a fake pass threshold.
// ============================================================================

import { execSync } from 'node:child_process';
import type { GpuPhaseLabel, GpuSampleResult } from './types.js';

export interface VramSamplerOptions {
  readonly phase?: GpuPhaseLabel;
  readonly execCommand?: (cmd: string) => string;
}

/**
 * Executes nvidia-smi safely and parses memory / utilization statistics.
 * If nvidia-smi is unavailable or errors, returns a safe fallback result with available: false.
 */
export function sampleNvidiaGpu(options?: VramSamplerOptions): GpuSampleResult {
  const timestamp = new Date().toISOString();
  const phase = options?.phase;
  const execFn =
    options?.execCommand ??
    ((cmd: string) =>
      execSync(cmd, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000
      }));

  try {
    // Query memory.used, memory.free, memory.total, utilization.gpu
    const cmd =
      'nvidia-smi --query-gpu=memory.used,memory.free,memory.total,utilization.gpu --format=csv,noheader,nounits';
    const stdout = execFn(cmd).trim();

    if (!stdout) {
      return {
        available: false,
        timestamp,
        phase,
        totalMiB: 0,
        usedMiB: 0,
        freeMiB: 0,
        utilizationGpuPct: 0,
        error: 'nvidia-smi returned empty output'
      };
    }
 
    const firstLine = (stdout.split('\n')[0] ?? '').trim();
    const parts = firstLine.split(',').map((s) => parseFloat(s.trim()));

    const part0 = parts[0];
    const part1 = parts[1];
    const part2 = parts[2];
    const part3 = parts[3];

    const usedMiB = typeof part0 === 'number' && Number.isFinite(part0) ? part0 : 0;
    const freeMiB = typeof part1 === 'number' && Number.isFinite(part1) ? part1 : 0;
    const totalMiB = typeof part2 === 'number' && Number.isFinite(part2) ? part2 : 0;
    const utilizationGpuPct = typeof part3 === 'number' && Number.isFinite(part3) ? part3 : 0;

    return {
      available: true,
      timestamp,
      phase,
      totalMiB,
      usedMiB,
      freeMiB,
      utilizationGpuPct,
      rawOutput: firstLine
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      timestamp,
      phase,
      totalMiB: 0,
      usedMiB: 0,
      freeMiB: 0,
      utilizationGpuPct: 0,
      error: `nvidia-smi unavailable or execution failed: ${errorMsg}`
    };
  }
}

/**
 * In-memory collector for recording VRAM snapshots across different certification phases.
 */
export class VramPhaseTimeline {
  private readonly samples: GpuSampleResult[] = [];

  record(phase: GpuPhaseLabel, execCommand?: (cmd: string) => string): GpuSampleResult {
    const sample = sampleNvidiaGpu({ phase, execCommand });
    this.samples.push(sample);
    return sample;
  }

  getSamples(): readonly GpuSampleResult[] {
    return this.samples;
  }

  getSampleForPhase(phase: GpuPhaseLabel): GpuSampleResult | undefined {
    return this.samples.find((s) => s.phase === phase);
  }

  formatMarkdownTable(): string {
    const lines: string[] = [
      '| Phase | Timestamp | GPU Total (MiB) | GPU Used (MiB) | GPU Free (MiB) | Utilization (%) | Available |',
      '|---|---|---|---|---|---|---|'
    ];

    for (const s of this.samples) {
      if (s.available) {
        lines.push(
          `| **${s.phase ?? 'UNKNOWN'}** | ${s.timestamp} | ${s.totalMiB.toFixed(0)} | ${s.usedMiB.toFixed(0)} | ${s.freeMiB.toFixed(0)} | ${s.utilizationGpuPct}% | YES |`
        );
      } else {
        lines.push(
          `| **${s.phase ?? 'UNKNOWN'}** | ${s.timestamp} | N/A | N/A | N/A | N/A | NO (${s.error ?? 'not available'}) |`
        );
      }
    }

    return lines.join('\n');
  }
}
