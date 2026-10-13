import { z } from 'zod';
import { MaveMessageSchema } from './session.js';

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
  local: z.boolean().default(false)
});
export type BrainCapabilities = z.infer<typeof BrainCapabilitiesSchema>;

export const ProviderHealthStatusSchema = z.enum([
  'healthy',
  'degraded',
  'unhealthy',
  'unconfigured'
]);
export type ProviderHealthStatus = z.infer<typeof ProviderHealthStatusSchema>;

export const ProviderHealthSchema = z.object({
  status: ProviderHealthStatusSchema,
  message: z.string().optional(),
  latencyMs: z.number().nonnegative().optional(),
  checkedAt: z.number().nonnegative().default(() => Date.now())
});
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;

export const BrainErrorCodeSchema = z.enum([
  'provider_unavailable',
  'provider_timeout',
  'provider_auth',
  'provider_limit',
  'provider_invalid_response',
  'cancelled',
  'runtime_error'
]);
export type BrainErrorCode = z.infer<typeof BrainErrorCodeSchema>;

export const BrainErrorSchema = z.object({
  code: BrainErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean().default(false),
  details: z.unknown().optional()
});
export type BrainError = z.infer<typeof BrainErrorSchema>;

export const BrainUsageSchema = z.object({
  promptTokens: z.number().nonnegative().optional(),
  completionTokens: z.number().nonnegative().optional(),
  totalTokens: z.number().nonnegative().optional()
});
export type BrainUsage = z.infer<typeof BrainUsageSchema>;

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
  systemPrompt: z.string().optional()
});
export type BrainRequest = z.infer<typeof BrainRequestSchema>;

export const BrainEventStartedSchema = z.object({
  type: z.literal('started'),
  requestId: z.string().min(1),
  providerId: z.string().min(1),
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
  text: z.string(),
  usage: BrainUsageSchema.optional(),
  finishReason: z.string().optional(),
  durationMs: z.number().nonnegative().optional()
});
export type BrainResponse = z.infer<typeof BrainResponseSchema>;

export interface BrainProvider {
  readonly id: string;
  getCapabilities(): BrainCapabilities;
  health(): Promise<ProviderHealth>;
  chat(request: BrainRequest, options?: BrainRequestOptions): AsyncIterable<BrainEvent>;
  cancel?(requestId: string): Promise<void>;
}
