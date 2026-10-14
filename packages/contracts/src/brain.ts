import { z } from 'zod';
import { MaveMessageSchema } from './session.js';

// ============================================================================
// 1. Brain Capabilities
// ============================================================================

export const BrainCapabilitiesSchema = z.object({
  streaming: z.boolean().default(true),
  fastChat: z.boolean().default(false),
  reasoning: z.boolean().default(false),
  coding: z.boolean().default(false),
  toolUse: z.boolean().default(false),
  multimodal: z.boolean().default(false),
  vision: z.boolean().default(false),
  webResearch: z.boolean().default(false),
  longContext: z.boolean().default(false),
  local: z.boolean().default(false),
  structuredOutput: z.boolean().optional(),
  cancellation: z.boolean().optional(),
  supportsThai: z.boolean().optional(),
  supportsEnglish: z.boolean().optional()
});
export type BrainCapabilities = z.infer<typeof BrainCapabilitiesSchema>;

// ============================================================================
// 2. Canonical Brain Profiles (Profile != Capability)
// ============================================================================

export const BrainProfileIdSchema = z.enum([
  'fast_conversation',
  'deep_reasoning',
  'agent_work',
  'research',
  'local_offline'
]);
export type BrainProfileId = z.infer<typeof BrainProfileIdSchema>;

export const BrainLatencyClassSchema = z.enum([
  'interactive',
  'normal',
  'long_running'
]);
export type BrainLatencyClass = z.infer<typeof BrainLatencyClassSchema>;

export const BrainProfileDefinitionSchema = z.object({
  id: BrainProfileIdSchema,
  description: z.string(),
  requiredCapabilities: BrainCapabilitiesSchema.partial().default({}),
  latencyClass: BrainLatencyClassSchema,
  allowFallback: z.boolean().default(true)
});
export type BrainProfileDefinition = z.infer<typeof BrainProfileDefinitionSchema>;

export const DEFAULT_BRAIN_PROFILES: Record<BrainProfileId, BrainProfileDefinition> = {
  fast_conversation: {
    id: 'fast_conversation',
    description: 'Low-latency conversational interactions, language tutoring, and quick Q&A',
    requiredCapabilities: {
      streaming: true,
      fastChat: true
    },
    latencyClass: 'interactive',
    allowFallback: true
  },
  deep_reasoning: {
    id: 'deep_reasoning',
    description: 'Complex analytical decisions, architecture evaluation, and long-form reasoning',
    requiredCapabilities: {
      reasoning: true
    },
    latencyClass: 'normal',
    allowFallback: true
  },
  agent_work: {
    id: 'agent_work',
    description: 'Coding workflows, multi-step tasks, and workspace operations (conversation-only in M2)',
    requiredCapabilities: {
      coding: true
    },
    latencyClass: 'long_running',
    allowFallback: false
  },
  research: {
    id: 'research',
    description: 'Current information, source-grounded answers, and web research',
    requiredCapabilities: {
      webResearch: true
    },
    latencyClass: 'normal',
    allowFallback: false
  },
  local_offline: {
    id: 'local_offline',
    description: 'Private, offline-capable fallback and utility tasks',
    requiredCapabilities: {
      local: true
    },
    latencyClass: 'interactive',
    allowFallback: false
  }
};

// ============================================================================
// 3. Provider & Model Taxonomy
// ============================================================================

export const ProviderKindSchema = z.enum([
  'model_provider',
  'agent_runtime_provider',
  'knowledge_provider'
]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

export const ProviderIdSchema = z.string().trim().min(1);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const ModelIdSchema = z.string().trim().min(1);
export type ModelId = z.infer<typeof ModelIdSchema>;

export const ProviderAccessPathSchema = z.enum([
  'official_api',
  'official_cli',
  'official_client',
  'local_runtime'
]);
export type ProviderAccessPath = z.infer<typeof ProviderAccessPathSchema>;

// ============================================================================
// 4. Provider & Model Health / Availability
// ============================================================================

export const ProviderHealthStatusSchema = z.enum([
  'healthy',
  'degraded',
  'unhealthy',
  'unconfigured',
  'quota_limited',
  'rate_limited',
  'auth_error',
  'unavailable'
]);
export type ProviderHealthStatus = z.infer<typeof ProviderHealthStatusSchema>;

export const ProviderHealthSchema = z.object({
  status: ProviderHealthStatusSchema,
  message: z.string().optional(),
  latencyMs: z.number().nonnegative().optional(),
  checkedAt: z.number().nonnegative().default(() => Date.now())
});
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;

export const ModelAvailabilityStatusSchema = z.enum([
  'available',
  'quota_limited',
  'rate_limited',
  'deprecated',
  'unavailable'
]);
export type ModelAvailabilityStatus = z.infer<typeof ModelAvailabilityStatusSchema>;

// ============================================================================
// 5. Model Qualitative Classes (Roles & Capacities)
// ============================================================================

export const ModelLatencyClassSchema = z.enum([
  'interactive',
  'balanced',
  'heavy'
]);
export type ModelLatencyClass = z.infer<typeof ModelLatencyClassSchema>;

export const ModelQualityClassSchema = z.enum([
  'fast',
  'balanced',
  'reasoning'
]);
export type ModelQualityClass = z.infer<typeof ModelQualityClassSchema>;

export const ModelCostClassSchema = z.enum([
  'free',
  'low',
  'medium',
  'high'
]);
export type ModelCostClass = z.infer<typeof ModelCostClassSchema>;

export const ModelContextClassSchema = z.enum([
  'standard',
  'large',
  'massive'
]);
export type ModelContextClass = z.infer<typeof ModelContextClassSchema>;

export const ModelPrivacyClassSchema = z.enum([
  'public_cloud',
  'private_cloud',
  'local_airgapped'
]);
export type ModelPrivacyClass = z.infer<typeof ModelPrivacyClassSchema>;

// ============================================================================
// 6. Model & Provider Descriptors
// ============================================================================

export const ModelDescriptorSchema = z.object({
  id: ModelIdSchema,
  providerId: ProviderIdSchema,
  displayName: z.string().trim().min(1),
  status: ModelAvailabilityStatusSchema,
  latencyClass: ModelLatencyClassSchema,
  qualityClass: ModelQualityClassSchema,
  costClass: ModelCostClassSchema.default('low'),
  contextClass: ModelContextClassSchema.default('standard'),
  contextWindowTokens: z.number().int().positive().optional(),
  capabilities: BrainCapabilitiesSchema,
  privacyClass: ModelPrivacyClassSchema
});
export type ModelDescriptor = z.infer<typeof ModelDescriptorSchema>;

export const ProviderDescriptorSchema = z.object({
  id: ProviderIdSchema,
  kind: ProviderKindSchema,
  displayName: z.string().trim().min(1),
  accessPath: ProviderAccessPathSchema,
  capabilities: BrainCapabilitiesSchema,
  health: ProviderHealthSchema,
  supportedModelIds: z.array(ModelIdSchema).default([])
});
export type ProviderDescriptor = z.infer<typeof ProviderDescriptorSchema>;

export const ModelCatalogSnapshotSchema = z.object({
  providerId: ProviderIdSchema,
  models: z.array(ModelDescriptorSchema),
  refreshedAt: z.number().nonnegative().default(() => Date.now())
}).superRefine((data, ctx) => {
  for (let i = 0; i < data.models.length; i++) {
    const model = data.models[i];
    if (model && model.providerId !== data.providerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Model descriptor '${model.id}' providerId '${model.providerId}' does not match catalog providerId '${data.providerId}'`,
        path: ['models', i, 'providerId']
      });
    }
  }
});
export type ModelCatalogSnapshot = z.infer<typeof ModelCatalogSnapshotSchema>;

// ============================================================================
// 7. Telemetry & Timing Contracts
// ============================================================================

export const GenerationUsageSchema = z.object({
  promptTokens: z.number().nonnegative().optional(),
  completionTokens: z.number().nonnegative().optional(),
  totalTokens: z.number().nonnegative().optional(),
  estimatedCostUsd: z.number().nonnegative().optional()
});
export type GenerationUsage = z.infer<typeof GenerationUsageSchema>;

export const GenerationTimingSchema = z.object({
  timeToFirstTokenMs: z.number().nonnegative().optional(),
  totalDurationMs: z.number().nonnegative().optional()
});
export type GenerationTiming = z.infer<typeof GenerationTimingSchema>;

export const RouteReasonSchema = z.enum([
  'primary_default',
  'primary_healthy',
  'fallback_healthy',
  'fallback_degraded',
  'explicit_override',
  'capability_match',
  'privacy_constraint'
]);
export type RouteReason = z.infer<typeof RouteReasonSchema>;

export const RouteTelemetrySchema = z.object({
  selectedProviderId: ProviderIdSchema,
  selectedModelId: ModelIdSchema.optional(),
  profileId: BrainProfileIdSchema.optional(),
  routeReason: RouteReasonSchema.or(z.string()).optional(),
  fallbackUsed: z.boolean().default(false),
  attemptedProviderIds: z.array(ProviderIdSchema).default([]),
  attemptedModelIds: z.array(ModelIdSchema).default([]),
  routeAttempts: z.number().int().nonnegative().default(1)
});
export type RouteTelemetry = z.infer<typeof RouteTelemetrySchema>;

export const BrainTelemetrySchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  route: RouteTelemetrySchema,
  timing: GenerationTimingSchema.optional(),
  usage: GenerationUsageSchema.optional(),
  finishReason: z.string().optional()
});
export type BrainTelemetry = z.infer<typeof BrainTelemetrySchema>;

export const BrainUsageSchema = z.object({
  promptTokens: z.number().nonnegative().optional(),
  completionTokens: z.number().nonnegative().optional(),
  totalTokens: z.number().nonnegative().optional(),
  estimatedCostUsd: z.number().nonnegative().optional()
});
export type BrainUsage = z.infer<typeof BrainUsageSchema>;

// ============================================================================
// 8. Intelligence Error Taxonomy
// ============================================================================

export const BrainErrorCodeSchema = z.enum([
  // M2 codes
  'provider_unavailable',
  'provider_timeout',
  'provider_auth',
  'provider_limit',
  'provider_invalid_response',
  'cancelled',
  'runtime_error',
  // Pre-M5 normalized codes (lowercase)
  'fast_brain_unavailable',
  'profile_unavailable',
  'model_unavailable',
  'provider_unconfigured',
  'quota_limited',
  'rate_limited',
  'auth_required',
  'local_provider_unavailable',
  'routing_timeout',
  'generation_cancelled',
  // Pre-M5 normalized codes (uppercase)
  'FAST_BRAIN_UNAVAILABLE',
  'PROFILE_UNAVAILABLE',
  'MODEL_UNAVAILABLE',
  'PROVIDER_UNCONFIGURED',
  'QUOTA_LIMITED',
  'RATE_LIMITED',
  'AUTH_REQUIRED',
  'LOCAL_PROVIDER_UNAVAILABLE',
  'ROUTING_TIMEOUT',
  'GENERATION_CANCELLED'
]);
export type BrainErrorCode = z.infer<typeof BrainErrorCodeSchema>;

export const BrainErrorSchema = z.object({
  code: BrainErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean().default(false),
  providerId: ProviderIdSchema.optional(),
  modelId: ModelIdSchema.optional(),
  details: z.unknown().optional()
});
export type BrainError = z.infer<typeof BrainErrorSchema>;

// ============================================================================
// 9. Request Options & Request Contract
// ============================================================================

export const BrainRouteOverridesSchema = z.object({
  profileId: BrainProfileIdSchema.optional(),
  preferredProviderId: ProviderIdSchema.optional(),
  preferredModelId: ModelIdSchema.optional(),
  localOnly: z.boolean().default(false)
});
export type BrainRouteOverrides = z.infer<typeof BrainRouteOverridesSchema>;

export const BrainRequestOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  timeoutMs: z.number().positive().optional()
});
export interface BrainRequestOptions extends z.infer<typeof BrainRequestOptionsSchema> {
  signal?: AbortSignal;
}

export const BrainRequestSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  intent: z.string().default('conversation'),
  messages: z.array(MaveMessageSchema).min(1),
  context: z.record(z.unknown()).optional(),
  systemPrompt: z.string().optional(),
  overrides: BrainRouteOverridesSchema.optional(),
  localOnly: z.boolean().optional()
});
export type BrainRequest = z.infer<typeof BrainRequestSchema>;

// ============================================================================
// 10. Streaming Events & Response Contracts
// ============================================================================

export const BrainEventStartedSchema = z.object({
  type: z.literal('started'),
  requestId: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1).optional(),
  profileId: BrainProfileIdSchema.optional(),
  timestamp: z.number().nonnegative().optional()
});
export type BrainEventStarted = z.infer<typeof BrainEventStartedSchema>;

export const BrainEventDeltaSchema = z.object({
  type: z.literal('delta'),
  requestId: z.string().min(1),
  text: z.string()
});
export type BrainEventDelta = z.infer<typeof BrainEventDeltaSchema>;

export const BrainEventCompletedSchema = z.object({
  type: z.literal('completed'),
  requestId: z.string().min(1),
  text: z.string().optional(),
  usage: BrainUsageSchema.optional(),
  timing: GenerationTimingSchema.optional(),
  finishReason: z.string().optional()
});
export type BrainEventCompleted = z.infer<typeof BrainEventCompletedSchema>;

export const BrainEventCancelledSchema = z.object({
  type: z.literal('cancelled'),
  requestId: z.string().min(1),
  reason: z.string().optional()
});
export type BrainEventCancelled = z.infer<typeof BrainEventCancelledSchema>;

export const BrainEventErrorSchema = z.object({
  type: z.literal('error'),
  requestId: z.string().min(1),
  error: BrainErrorSchema
});
export type BrainEventError = z.infer<typeof BrainEventErrorSchema>;

export const BrainEventSchema = z.discriminatedUnion('type', [
  BrainEventStartedSchema,
  BrainEventDeltaSchema,
  BrainEventCompletedSchema,
  BrainEventCancelledSchema,
  BrainEventErrorSchema
]);
export type BrainEvent = z.infer<typeof BrainEventSchema>;

export const BrainResponseSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1).optional(),
  profileId: BrainProfileIdSchema.optional(),
  text: z.string(),
  usage: BrainUsageSchema.optional(),
  timing: GenerationTimingSchema.optional(),
  finishReason: z.string().optional(),
  durationMs: z.number().nonnegative().optional()
});
export type BrainResponse = z.infer<typeof BrainResponseSchema>;

// ============================================================================
// 11. Provider & Catalog Interfaces
// ============================================================================

export interface BrainProvider {
  readonly id: string;
  getCapabilities(): BrainCapabilities;
  health(): Promise<ProviderHealth>;
  chat(request: BrainRequest, options?: BrainRequestOptions): AsyncIterable<BrainEvent>;
  cancel?(requestId: string): Promise<void>;
  getCatalog?(): Promise<ModelCatalogSnapshot | ModelDescriptor[]>;
  getDescriptor?(): ProviderDescriptor;
}

export interface ModelCatalogProvider extends BrainProvider {
  getCatalog(): Promise<ModelCatalogSnapshot>;
  getDescriptor(): ProviderDescriptor;
}
