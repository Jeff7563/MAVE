// ============================================================================
// Route Telemetry Serialization & Benchmark Suites (C3.1 / C4-B)
//
// Invariant: Pure observational serialization.
// NEVER synthesize successful telemetry. Real runtime output only.
// ============================================================================

import type { BrainRouteDecision } from '../brain/types.js';
import type { SerializedRouteTelemetry } from './types.js';

/**
 * Standard test cases for RouteTelemetry inspection on Home PC.
 */
export const TELEMETRY_BENCHMARK_CASES = [
  {
    id: 'thai_quick_chat',
    name: 'Thai Quick Chat',
    prompt: 'สวัสดีครับ ขอคำแนะนำสั้นๆ หน่อย',
    taskIntent: 'quick_chat',
    expectedProfileId: 'fast_conversation',
    expectedRole: 'FAST'
  },
  {
    id: 'english_quick_chat',
    name: 'English Quick Chat',
    prompt: "Hello, what's a good way to organize files?",
    taskIntent: 'quick_chat',
    expectedProfileId: 'fast_conversation',
    expectedRole: 'FAST'
  },
  {
    id: 'flatmap_explanation',
    name: 'flatMap Code Explanation',
    prompt: 'Explain what Array.prototype.flatMap does',
    taskIntent: 'Explain what Array.prototype.flatMap does',
    expectedProfileId: 'fast_conversation',
    expectedRole: 'FAST'
  },
  {
    id: 'language_practice',
    name: 'Language Speaking Practice',
    prompt: "Let's practice ordering food in a restaurant",
    taskIntent: 'language_practice',
    expectedProfileId: 'fast_conversation',
    expectedRole: 'FAST'
  },
  {
    id: 'simple_rewrite',
    name: 'Simple Conversational Rewrite',
    prompt: 'Rewrite this sentence to be more polite: Give me the report',
    taskIntent: 'simple_rewrite',
    expectedProfileId: 'fast_conversation',
    expectedRole: 'FAST'
  }
] as const;

export type TelemetryBenchmarkCaseId = (typeof TELEMETRY_BENCHMARK_CASES)[number]['id'];

/**
 * Extracts and formats exact RouteTelemetry from a live BrainRouteDecision.
 */
export function serializeRouteTelemetry(decision: BrainRouteDecision): SerializedRouteTelemetry {
  const telemetry = decision.telemetry;
  const attemptedModels = telemetry?.attemptedModelIds ?? decision.attemptedModelIds ?? (decision.modelId ? [decision.modelId] : []);

  return {
    selectedProviderId: decision.providerId,
    selectedModelId: decision.modelId ?? telemetry?.selectedModelId ?? '',
    profileId: decision.profileId ?? telemetry?.profileId,
    providerKind: decision.providerKind,
    routeReason: decision.routeReason ?? telemetry?.routeReason ?? 'unknown',
    fallbackUsed: decision.fallbackUsed,
    attemptedProviderIds: telemetry?.attemptedProviderIds ?? decision.attemptedProviderIds ?? [decision.providerId],
    attemptedModelIds: attemptedModels.filter((m): m is string => typeof m === 'string'),
    routeAttempts: telemetry?.routeAttempts ?? decision.routeAttempts ?? 1,
    routingDurationMs: decision.diagnostics?.routingTimeMs
  };
}

/**
 * Formats a SerializedRouteTelemetry into human-readable console/log format.
 */
export function formatRouteTelemetry(telemetry: SerializedRouteTelemetry): string {
  return [
    `  selectedProviderId:   ${telemetry.selectedProviderId}`,
    `  selectedModelId:      ${telemetry.selectedModelId}`,
    `  profileId:            ${telemetry.profileId ?? 'none'}`,
    `  providerKind:         ${telemetry.providerKind ?? 'unknown'}`,
    `  routeReason:          ${telemetry.routeReason}`,
    `  fallbackUsed:         ${telemetry.fallbackUsed}`,
    `  attemptedProviderIds: [${telemetry.attemptedProviderIds.join(', ')}]`,
    `  attemptedModelIds:    [${telemetry.attemptedModelIds.join(', ')}]`,
    `  routeAttempts:        ${telemetry.routeAttempts}`,
    `  routingDurationMs:    ${telemetry.routingDurationMs ?? 'N/A'}ms`
  ].join('\n');
}
