// ============================================================================
// MAVE C3.1 / C4-B Certification Measurement Utilities Tests
// ============================================================================

import { describe, expect, it } from 'vitest';
import type { BrainRouteDecision } from '../brain/types.js';
import {
  formatNanosecondsToSeconds,
  calculateTokensPerSecond,
  calculateOllamaTiming
} from '../certification/timing.js';
import {
  calculateMedian,
  calculateMetricStats,
  aggregateLatencySamples
} from '../certification/latency.js';
import {
  verifyModelDigest,
  checkLocalOllamaDigest
} from '../certification/digest.js';
import {
  sampleNvidiaGpu,
  VramPhaseTimeline
} from '../certification/vram.js';
import {
  serializeRouteTelemetry,
  formatRouteTelemetry,
  TELEMETRY_BENCHMARK_CASES
} from '../certification/telemetry.js';
import { captureResidencyCheckpoint } from '../certification/residency.js';
import { gatherSystemInfo, formatSystemInfo } from '../certification/system-info.js';

describe('Certification Measurement Utilities (C3.1 / C4-B)', () => {
  // --------------------------------------------------------------------------
  // 1. Nanosecond Conversion
  // --------------------------------------------------------------------------
  describe('Nanosecond Conversion', () => {
    it('converts positive nanoseconds to fractional seconds with high precision', () => {
      expect(formatNanosecondsToSeconds(1_000_000_000)).toBe(1.0);
      expect(formatNanosecondsToSeconds(500_000_000)).toBe(0.5);
      expect(formatNanosecondsToSeconds(123_456_789)).toBeCloseTo(0.123456789, 8);
    });

    it('returns 0 for zero, negative, or invalid nanosecond inputs', () => {
      expect(formatNanosecondsToSeconds(0)).toBe(0);
      expect(formatNanosecondsToSeconds(-100)).toBe(0);
      expect(formatNanosecondsToSeconds(undefined)).toBe(0);
      expect(formatNanosecondsToSeconds(NaN)).toBe(0);
      expect(formatNanosecondsToSeconds(Infinity)).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Tokens/sec Calculation & Historical Discrepancy Resolution
  // --------------------------------------------------------------------------
  describe('Tokens/sec Calculation', () => {
    it('calculates generation throughput correctly from token count and nanoseconds', () => {
      // 100 tokens generated in 529,100,529 ns (~0.529s) -> ~189.00 tok/s
      const tps = calculateTokensPerSecond(100, 529_100_529);
      expect(tps).toBe(189.0);
    });

    it('returns 0 for zero or non-positive token counts or durations', () => {
      expect(calculateTokensPerSecond(0, 1_000_000_000)).toBe(0);
      expect(calculateTokensPerSecond(100, 0)).toBe(0);
      expect(calculateTokensPerSecond(-5, 1_000_000_000)).toBe(0);
      expect(calculateTokensPerSecond(undefined, 1_000_000_000)).toBe(0);
      expect(calculateTokensPerSecond(100, undefined)).toBe(0);
    });

    it('resolves historical ~189 tok/s vs ~16.9 tok/s discrepancy explicitly', () => {
      // Simulate raw Ollama payload where generation only is fast (~189 tok/s)
      // but total turn included prompt evaluation + model loading (~16.9 tok/s)
      const rawPayload = {
        model: 'qwen2.5:1.5b',
        created_at: '2026-10-16T03:00:00Z',
        done: true,
        total_duration: 6_200_000_000, // 6.2s total turn duration
        load_duration: 500_000_000,    // 0.5s cold/re-lease load
        prompt_eval_count: 30,         // 30 prompt tokens
        prompt_eval_duration: 5_170_899_471, // ~5.17s prompt evaluation
        eval_count: 100,               // 100 generation tokens
        eval_duration: 529_100_529     // ~0.529s generation duration
      };

      const metrics = calculateOllamaTiming(rawPayload);

      // Raw preserved exactly
      expect(metrics.raw.totalDurationNs).toBe(6_200_000_000);
      expect(metrics.raw.evalDurationNs).toBe(529_100_529);
      expect(metrics.raw.evalCount).toBe(100);

      // Generation throughput reflects ~189 tok/s
      expect(metrics.calculated.evalTokensPerSec).toBe(189.0);

      // E2E throughput (including prompt eval + load) reflects turn throughput (~20.9 tok/s across 130 tokens / 6.2s)
      expect(metrics.calculated.e2eTokensPerSec).toBeCloseTo(20.97, 1);

      // Explanation includes explicit discrepancy resolution text
      expect(metrics.explanation).toContain('189');
      expect(metrics.explanation).toContain('generation-only');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Median Calculation & Latency Aggregation
  // --------------------------------------------------------------------------
  describe('Median & Latency Stats Calculation', () => {
    it('calculates median for odd-length numeric array', () => {
      expect(calculateMedian([10, 50, 20])).toBe(20);
      expect(calculateMedian([1, 2, 3, 4, 5])).toBe(3);
    });

    it('calculates median for even-length numeric array by averaging middle two', () => {
      expect(calculateMedian([10, 20, 30, 40])).toBe(25);
      expect(calculateMedian([100, 200])).toBe(150);
    });

    it('calculates median for single-element array', () => {
      expect(calculateMedian([42])).toBe(42);
    });

    it('returns 0 for empty or invalid array', () => {
      expect(calculateMedian([])).toBe(0);
      expect(calculateMedian([NaN])).toBe(0);
    });

    it('aggregates latency samples with min, median, max correctly', () => {
      const samples = [
        { sampleId: 's1', isWarm: true, promptText: 'hello', brainTtftMs: 1200, brainTotalMs: 2500 },
        { sampleId: 's2', isWarm: true, promptText: 'hi', brainTtftMs: 1000, brainTotalMs: 2100 },
        { sampleId: 's3', isWarm: false, promptText: 'cold test', brainTtftMs: 2800, brainTotalMs: 4000 }
      ];

      const summary = aggregateLatencySamples(samples);
      expect(summary.totalSamples).toBe(3);
      expect(summary.warmSamples).toBe(2);
      expect(summary.coldSamples).toBe(1);

      expect(summary.brainTtftMs?.min).toBe(1000);
      expect(summary.brainTtftMs?.median).toBe(1200);
      expect(summary.brainTtftMs?.max).toBe(2800);
      expect(summary.brainTtftMs?.count).toBe(3);

      expect(summary.brainTotalMs?.min).toBe(2100);
      expect(summary.brainTotalMs?.median).toBe(2500);
      expect(summary.brainTotalMs?.max).toBe(4000);
    });

    it('calculates metric stats (min, median, max, count) directly', () => {
      const stats = calculateMetricStats([10, 20, 30]);
      expect(stats.count).toBe(3);
      expect(stats.min).toBe(10);
      expect(stats.median).toBe(20);
      expect(stats.max).toBe(30);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Model Digest Verification (MATCH, MISMATCH, MODEL_NOT_FOUND, DAEMON_UNAVAILABLE)
  // --------------------------------------------------------------------------
  describe('Model Digest Verification', () => {
    const QUALIFIED_DIGEST = '65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b';

    it('returns MATCH when exact model tag and digest match', () => {
      const mockTags = {
        models: [
          {
            name: 'qwen2.5:1.5b',
            digest: `sha256:${QUALIFIED_DIGEST}`
          }
        ]
      };

      const result = verifyModelDigest(mockTags, 'qwen2.5:1.5b', QUALIFIED_DIGEST);
      expect(result.status).toBe('MATCH');
      expect(result.actualDigest).toBe(QUALIFIED_DIGEST);
    });

    it('returns MISMATCH when model exists but digest differs', () => {
      const mockTags = {
        models: [
          {
            name: 'qwen2.5:1.5b',
            digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111'
          }
        ]
      };

      const result = verifyModelDigest(mockTags, 'qwen2.5:1.5b', QUALIFIED_DIGEST);
      expect(result.status).toBe('MISMATCH');
      expect(result.actualDigest).not.toBe(QUALIFIED_DIGEST);
    });

    it('returns MODEL_NOT_FOUND when model tag is not in tags list', () => {
      const mockTags = {
        models: [
          {
            name: 'llama3:8b',
            digest: 'sha256:abc'
          }
        ]
      };

      const result = verifyModelDigest(mockTags, 'qwen2.5:1.5b', QUALIFIED_DIGEST);
      expect(result.status).toBe('MODEL_NOT_FOUND');
    });

    it('returns DAEMON_UNAVAILABLE when null or undefined tags response provided', () => {
      const result = verifyModelDigest(null, 'qwen2.5:1.5b', QUALIFIED_DIGEST);
      expect(result.status).toBe('DAEMON_UNAVAILABLE');
    });

    it('gracefully reports DAEMON_UNAVAILABLE when fetch fails (Work PC safe)', async () => {
      const mockFailingFetch = async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
      };

      const result = await checkLocalOllamaDigest(
        'http://127.0.0.1:11434',
        'qwen2.5:1.5b',
        QUALIFIED_DIGEST,
        mockFailingFetch as any
      );

      expect(result.status).toBe('DAEMON_UNAVAILABLE');
      expect(result.details).toContain('ECONNREFUSED');
    });
  });

  // --------------------------------------------------------------------------
  // 5. NVIDIA VRAM Sampling (Graceful fallback when nvidia-smi missing)
  // --------------------------------------------------------------------------
  describe('NVIDIA VRAM Sampling', () => {
    it('gracefully handles missing nvidia-smi without throwing', () => {
      const mockFailingExec = () => {
        throw new Error('Command failed: nvidia-smi is not recognized');
      };

      const result = sampleNvidiaGpu({ phase: 'BASELINE', execCommand: mockFailingExec });
      expect(result.available).toBe(false);
      expect(result.phase).toBe('BASELINE');
      expect(result.totalMiB).toBe(0);
      expect(result.usedMiB).toBe(0);
      expect(result.error).toContain('nvidia-smi unavailable');
    });

    it('parses valid nvidia-smi csv output accurately', () => {
      const mockExec = () => '2100, 6092, 8192, 12\n';

      const result = sampleNvidiaGpu({ phase: 'ACTIVE_INFERENCE', execCommand: mockExec });
      expect(result.available).toBe(true);
      expect(result.phase).toBe('ACTIVE_INFERENCE');
      expect(result.usedMiB).toBe(2100);
      expect(result.freeMiB).toBe(6092);
      expect(result.totalMiB).toBe(8192);
      expect(result.utilizationGpuPct).toBe(12);
    });

    it('records VRAM timeline across labeled phases', () => {
      const timeline = new VramPhaseTimeline();
      const mockExec = () => '1500, 6692, 8192, 5\n';

      timeline.record('BASELINE', mockExec);
      timeline.record('STT_PLUS_BRAIN', mockExec);

      expect(timeline.getSamples().length).toBe(2);
      expect(timeline.getSampleForPhase('BASELINE')?.phase).toBe('BASELINE');
      expect(timeline.getSampleForPhase('STT_PLUS_BRAIN')?.phase).toBe('STT_PLUS_BRAIN');
      expect(timeline.formatMarkdownTable()).toContain('STT_PLUS_BRAIN');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Route Telemetry Serialization
  // --------------------------------------------------------------------------
  describe('Route Telemetry Serialization', () => {
    it('serializes BrainRouteDecision into exact RouteTelemetry fields', () => {
      const decision: BrainRouteDecision = {
        provider: { id: 'ollama', getCapabilities: () => ({} as any), health: async () => ({ status: 'healthy', checkedAt: Date.now() }) } as any,
        providerId: 'ollama',
        modelId: 'ollama-qwen2.5-1.5b',
        profileId: 'fast_conversation',
        providerKind: 'model_provider',
        reason: 'matched',
        routeReason: 'primary_healthy',
        fallbackUsed: false,
        attemptedProviderIds: ['ollama'],
        telemetry: {
          selectedProviderId: 'ollama',
          selectedModelId: 'ollama-qwen2.5-1.5b',
          profileId: 'fast_conversation',
          routeReason: 'primary_healthy',
          fallbackUsed: false,
          attemptedProviderIds: ['ollama'],
          attemptedModelIds: ['ollama-qwen2.5-1.5b'],
          routeAttempts: 1
        },
        diagnostics: {
          routingTimeMs: 4.5,
          providersEvaluated: 1,
          modelsEvaluated: 1
        }
      };

      const serialized = serializeRouteTelemetry(decision);

      expect(serialized.selectedProviderId).toBe('ollama');
      expect(serialized.selectedModelId).toBe('ollama-qwen2.5-1.5b');
      expect(serialized.profileId).toBe('fast_conversation');
      expect(serialized.providerKind).toBe('model_provider');
      expect(serialized.routeReason).toBe('primary_healthy');
      expect(serialized.fallbackUsed).toBe(false);
      expect(serialized.routeAttempts).toBe(1);
      expect(serialized.routingDurationMs).toBe(4.5);

      const formatted = formatRouteTelemetry(serialized);
      expect(formatted).toContain('selectedProviderId:   ollama');
      expect(formatted).toContain('selectedModelId:      ollama-qwen2.5-1.5b');
    });

    it('contains all 5 canonical telemetry benchmark test cases', () => {
      expect(TELEMETRY_BENCHMARK_CASES.length).toBe(5);
      const caseIds = TELEMETRY_BENCHMARK_CASES.map((c) => c.id);
      expect(caseIds).toContain('thai_quick_chat');
      expect(caseIds).toContain('english_quick_chat');
      expect(caseIds).toContain('flatmap_explanation');
      expect(caseIds).toContain('language_practice');
      expect(caseIds).toContain('simple_rewrite');
    });
  });

  // --------------------------------------------------------------------------
  // 7. Residency Observation & System Info (Graceful Handling)
  // --------------------------------------------------------------------------
  describe('Residency & System Info Graceful Handling', () => {
    it('captureResidencyCheckpoint reports daemonReachable: false when daemon is down', async () => {
      const failingFetch = async () => {
        throw new Error('ECONNREFUSED');
      };

      const checkpoint = await captureResidencyCheckpoint('before_prewarm', {
        fetchFn: failingFetch as any
      });

      expect(checkpoint.phase).toBe('before_prewarm');
      expect(checkpoint.daemonReachable).toBe(false);
      expect(checkpoint.loadedModels.length).toBe(0);
    });

    it('gatherSystemInfo safely collects environment without throwing on missing tools', async () => {
      const info = await gatherSystemInfo();
      expect(info.os).toBeDefined();
      expect(info.nodeVersion).toBe(process.version);
      expect(info.totalRamGiB).toBeGreaterThan(0);
      expect(formatSystemInfo(info)).toContain('Node');
    });
  });
});
