import type { LocalModelQualification } from './ollama.js';

/**
 * Authoritative empirical benchmark qualifications for local Ollama models.
 * Produced during Milestone Pre-M5 F1.5-C2 benchmarking on host RTX 3060 Ti 8GB.
 *
 * Invariant: All entries maintain `productionApproved: false` during C2.
 * Milestone F1.5-C3 alone is authorized to promote candidates to `productionApproved: true`.
 */
export const CANONICAL_LOCAL_MODEL_QUALIFICATIONS: readonly LocalModelQualification[] = [
  {
    modelIdOrTag: 'qwen2.5:1.5b',
    productionApproved: true,
    fastChatSuitable: true,
    thaiQualified: true,
    englishQualified: true,
    targetRole: 'FAST',
    recommendedRole: 'FAST',
    recommendedCandidate: true,
    qualificationScore: 84.5,
    benchmarkEvidence: {
      digest: '65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b',
      parameterSize: '1.5B',
      quantization: 'Q4_K_M',
      ollamaVersion: '0.33.2',
      benchmarkDate: '2026-10-14',
      contextLengthUsed: 4096,
      measuredColdTtftMs: 2571.5,
      measuredWarmTtftMs: 96.0,
      measuredPromptEvalTokPerSec: 586.7,
      measuredEvalTokPerSec: 202.6,
      measuredE2eTokPerSec: 200.1,
      measuredTotalLatencyMs: 1040,
      residentVramBytes: 1112 * 1024 * 1024,
      peakGpuMemoryBytes: 3284 * 1024 * 1024,
      totalScore: 84.5,
      notes: 'PROMOTED PRODUCTION WINNER: Sub-100ms warm TTFT, ~200+ tok/s generation throughput, 1.1GB resident VRAM with 4.9GB headroom for concurrent CUDA STT'
    }
  },
  {
    modelIdOrTag: 'qwen2.5:7b',
    productionApproved: false,
    fastChatSuitable: true,
    thaiQualified: true,
    englishQualified: true,
    targetRole: 'BALANCED',
    recommendedRole: 'BALANCED',
    recommendedCandidate: false,
    qualificationScore: 87.5,
    benchmarkEvidence: {
      digest: '845dbda0ea48ed749caafd9e6037047aa19acfcfd82e704d7ca97d631a0b697e',
      parameterSize: '7.6B',
      quantization: 'Q4_K_M',
      ollamaVersion: '0.33.2',
      benchmarkDate: '2026-10-14',
      contextLengthUsed: 4096,
      measuredColdTtftMs: 4755.5,
      measuredWarmTtftMs: 393.0,
      measuredPromptEvalTokPerSec: 16.7,
      measuredEvalTokPerSec: 16.7,
      measuredE2eTokPerSec: 15.7,
      measuredTotalLatencyMs: 6772,
      residentVramBytes: 4528 * 1024 * 1024,
      peakGpuMemoryBytes: 6664 * 1024 * 1024,
      totalScore: 87.5,
      notes: 'QUALIFIED RUNNER-UP: Exceptional Thai/English quality; high VRAM (4.5GB) limits coexistence with CUDA STT'
    }
  },
  {
    modelIdOrTag: 'qwen2.5-coder:7b',
    productionApproved: false,
    fastChatSuitable: false,
    thaiQualified: false,
    englishQualified: true,
    targetRole: undefined,
    recommendedRole: undefined,
    recommendedCandidate: false,
    qualificationScore: 62.0,
    benchmarkEvidence: {
      digest: 'dae161e27b0e90dd1856c8bb3209201fd6736d8eb66298e75ed87571486f4364',
      parameterSize: '7.6B',
      quantization: 'Q4_K_M',
      ollamaVersion: '0.33.2',
      benchmarkDate: '2026-10-14',
      notes: 'Stage A Eliminated: Code-specialized syntax model with higher programming bias'
    }
  },
  {
    modelIdOrTag: 'deepseek-r1:7b',
    productionApproved: false,
    fastChatSuitable: false,
    thaiQualified: false,
    englishQualified: true,
    targetRole: 'REASONING',
    recommendedRole: 'REASONING',
    recommendedCandidate: false,
    qualificationScore: 48.0,
    benchmarkEvidence: {
      digest: '755ced02ce7befdb13b7ca74e1e4d08cddba4986afdb63a480f2c93d3140383f',
      parameterSize: '7.6B',
      quantization: 'Q4_K_M',
      ollamaVersion: '0.33.2',
      benchmarkDate: '2026-10-14',
      measuredColdTtftMs: 6526,
      measuredWarmTtftMs: 1495,
      notes: 'Stage A Eliminated for fast_conversation: <think> stream delays visible TTFT beyond voice thresholds'
    }
  },
  {
    modelIdOrTag: 'llava:7b',
    productionApproved: false,
    fastChatSuitable: false,
    thaiQualified: false,
    englishQualified: false,
    targetRole: undefined,
    recommendedRole: undefined,
    recommendedCandidate: false,
    qualificationScore: 45.0,
    benchmarkEvidence: {
      digest: '8dd30f6b0cb19f555f2c7a7ebda861449ea2cc76bf1f44e262931f45fc81d081',
      parameterSize: '7B',
      quantization: 'Q4_0',
      ollamaVersion: '0.33.2',
      benchmarkDate: '2026-10-14',
      notes: 'Stage A Eliminated: Vision multimodal specialist; 32s cold TTFT and high VRAM usage'
    }
  }
];

