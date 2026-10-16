// ============================================================================
// MAVE C3.1 / C4-B Live Certification Types & Contracts
// Pure observational and empirical measurement interfaces.
// Invariant: NEVER synthesize or fake hardware/live results.
// ============================================================================

import type { ProviderKind, RouteReason } from '@mave/contracts';

/**
 * Expected qualified Fast Brain candidate constants.
 */
export const QUALIFIED_FAST_BRAIN_TAG = 'qwen2.5:1.5b';
export const QUALIFIED_FAST_BRAIN_DIGEST =
  '65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b';

/**
 * Model digest verification outcomes.
 */
export type DigestVerificationStatus = 'MATCH' | 'MISMATCH' | 'MODEL_NOT_FOUND' | 'DAEMON_UNAVAILABLE';

export interface DigestCheckResult {
  readonly status: DigestVerificationStatus;
  readonly modelTag: string;
  readonly expectedDigest: string;
  readonly actualDigest?: string;
  readonly details: string;
}

/**
 * Raw Ollama /api/generate or /api/chat response timing fields.
 * Direct, unmanipulated fields emitted by Ollama daemon.
 */
export interface OllamaRawTimingResponse {
  readonly model?: string;
  readonly created_at?: string;
  readonly done?: boolean;
  readonly total_duration?: number; // nanoseconds
  readonly load_duration?: number; // nanoseconds
  readonly prompt_eval_count?: number; // token count
  readonly prompt_eval_duration?: number; // nanoseconds
  readonly eval_count?: number; // token count
  readonly eval_duration?: number; // nanoseconds
  readonly response?: string;
  readonly message?: {
    readonly role?: string;
    readonly content?: string;
  };
}

/**
 * Normalized Ollama timing metrics.
 * Clearly separates raw nanoseconds from calculated seconds and token throughput.
 * This directly resolves the historical ~189 tok/s vs ~16.9 tok/s discrepancy.
 */
export interface OllamaTimingMetrics {
  readonly model: string;
  readonly createdAt?: string;
  readonly done: boolean;

  // Raw fields directly from daemon (nanoseconds)
  readonly raw: {
    readonly totalDurationNs: number;
    readonly loadDurationNs: number;
    readonly promptEvalDurationNs: number;
    readonly promptEvalCount: number;
    readonly evalDurationNs: number;
    readonly evalCount: number;
  };

  // Calculated duration fields (seconds)
  readonly calculated: {
    readonly totalDurationSec: number;
    readonly loadDurationSec: number;
    readonly promptEvalDurationSec: number;
    readonly evalDurationSec: number;
    /** Generation throughput: eval_count / (eval_duration / 1e9) */
    readonly evalTokensPerSec: number;
    /** Prompt ingestion throughput: prompt_eval_count / (prompt_eval_duration / 1e9) */
    readonly promptEvalTokensPerSec: number;
    /** End-to-end throughput: (prompt_eval_count + eval_count) / (total_duration / 1e9) */
    readonly e2eTokensPerSec: number;
  };

  // Explanation of calculation to eliminate ambiguity
  readonly explanation: string;
}

/**
 * Labeled phases for NVIDIA VRAM sampling.
 */
export type GpuPhaseLabel =
  | 'BASELINE'
  | 'STT_LOADED'
  | 'BRAIN_RESIDENT'
  | 'STT_PLUS_BRAIN'
  | 'ACTIVE_STT'
  | 'ACTIVE_INFERENCE'
  | 'POST_IDLE_UNLOAD';

export interface GpuSampleResult {
  readonly available: boolean;
  readonly timestamp: string;
  readonly phase?: GpuPhaseLabel;
  readonly totalMiB: number;
  readonly usedMiB: number;
  readonly freeMiB: number;
  readonly utilizationGpuPct: number;
  readonly rawOutput?: string;
  readonly error?: string;
}

/**
 * Checkpoint phases for local model residency observation.
 */
export type ResidencyCheckpointPhase =
  | 'before_prewarm'
  | 'after_prewarm'
  | 'during_chat'
  | 'after_chat'
  | 'after_idle_timeout';

export interface OllamaPsModelInfo {
  readonly name: string;
  readonly model: string;
  readonly size: number;
  readonly sizeVram: number;
  readonly expiresAt: string;
}

export interface ResidencyCheckpoint {
  readonly phase: ResidencyCheckpointPhase;
  readonly timestamp: string;
  readonly daemonReachable: boolean;
  readonly loadedModels: readonly OllamaPsModelInfo[];
  readonly lifecycleState?: 'unloaded' | 'loading' | 'resident' | 'unloading';
  readonly activeLeases?: number;
  readonly rawPsData?: unknown;
}

/**
 * Latency recorder turn metrics.
 */
export interface TurnLatencySample {
  readonly sampleId: string;
  readonly isWarm: boolean;
  readonly promptText: string;
  readonly sttLatencyMs?: number;
  readonly brainTtftMs?: number;
  readonly brainTotalMs?: number;
  readonly ttsTtfaMs?: number;
  readonly timeToFirstAudibleMs?: number;
  readonly totalTurnDurationMs?: number;
  readonly tokenCount?: number;
  readonly evalTokensPerSec?: number;
}

export interface LatencyMetricStats {
  readonly count: number;
  readonly min: number;
  readonly median: number;
  readonly max: number;
}

export interface LatencyAggregationSummary {
  readonly totalSamples: number;
  readonly warmSamples: number;
  readonly coldSamples: number;
  readonly brainTtftMs?: LatencyMetricStats;
  readonly brainTotalMs?: LatencyMetricStats;
  readonly sttLatencyMs?: LatencyMetricStats;
  readonly ttsTtfaMs?: LatencyMetricStats;
  readonly totalTurnDurationMs?: LatencyMetricStats;
}

/**
 * Exact serialized RouteTelemetry for live certification inspection.
 */
export interface SerializedRouteTelemetry {
  readonly selectedProviderId: string;
  readonly selectedModelId: string;
  readonly profileId?: string;
  readonly providerKind?: ProviderKind;
  readonly routeReason: RouteReason | string;
  readonly fallbackUsed: boolean;
  readonly attemptedProviderIds: readonly string[];
  readonly attemptedModelIds: readonly string[];
  readonly routeAttempts: number;
  readonly routingDurationMs?: number;
}

/**
 * System and execution environment details.
 */
export interface SystemEnvironmentInfo {
  readonly os: string;
  readonly platform: string;
  readonly arch: string;
  readonly cpuModel: string;
  readonly cpuCores: number;
  readonly totalRamBytes: number;
  readonly totalRamGiB: number;
  readonly freeRamGiB: number;
  readonly nodeVersion: string;
  readonly pnpmVersion: string;
  readonly gitHead: string;
  readonly gpuInfo: GpuSampleResult;
  readonly ollamaVersion?: string;
  readonly ollamaHealthy: boolean;
}
