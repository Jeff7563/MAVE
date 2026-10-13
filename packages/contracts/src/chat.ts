import { z } from 'zod';
import { BrainCapabilitiesSchema, BrainUsageSchema } from './brain.js';
import { SessionSchema } from './session.js';

export const ChatSendRequestSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, 'Message cannot be empty'),
    requestId: z
      .string()
      .refine((val) => val.trim().length > 0, 'RequestId cannot be empty')
      .optional(),
    sessionId: z
      .string()
      .refine((val) => val.trim().length > 0, 'SessionId cannot be empty')
      .optional(),
    preferredProviderId: z
      .string()
      .refine((val) => val.trim().length > 0, 'PreferredProviderId cannot be empty')
      .optional(),
    requiredCapabilities: BrainCapabilitiesSchema.partial().strict().optional()
  })
  .strict();
export type ChatSendRequest = z.infer<typeof ChatSendRequestSchema>;

export const ChatSendErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional()
});
export type ChatSendError = z.infer<typeof ChatSendErrorSchema>;

export const ChatSendAcceptedResponseSchema = z.object({
  accepted: z.literal(true),
  requestId: z.string().min(1)
});
export type ChatSendAcceptedResponse = z.infer<typeof ChatSendAcceptedResponseSchema>;

export const ChatSendRejectedResponseSchema = z.object({
  accepted: z.literal(false),
  error: ChatSendErrorSchema
});
export type ChatSendRejectedResponse = z.infer<typeof ChatSendRejectedResponseSchema>;

export const ChatSendResponseSchema = z.discriminatedUnion('accepted', [
  ChatSendAcceptedResponseSchema,
  ChatSendRejectedResponseSchema
]);
export type ChatSendResponse = z.infer<typeof ChatSendResponseSchema>;

export const ChatCancelRequestSchema = z
  .object({
    requestId: z
      .string()
      .refine((val) => val.trim().length > 0, 'RequestId cannot be empty')
  })
  .strict();
export type ChatCancelRequest = z.infer<typeof ChatCancelRequestSchema>;

export const ChatCancelResponseSchema = z.object({
  cancelled: z.boolean(),
  requestId: z.string()
});
export type ChatCancelResponse = z.infer<typeof ChatCancelResponseSchema>;

export const ChatLoadSessionRequestSchema = z
  .object({
    sessionId: z
      .string()
      .refine((val) => val.trim().length > 0, 'SessionId cannot be empty')
  })
  .strict();
export type ChatLoadSessionRequest = z.infer<typeof ChatLoadSessionRequestSchema>;

export const ChatLoadSessionResponseSchema = z.object({
  success: z.boolean(),
  session: SessionSchema.optional(),
  error: z.string().optional()
});
export type ChatLoadSessionResponse = z.infer<typeof ChatLoadSessionResponseSchema>;

export const RequestStartedEventSchema = z.object({
  type: z.literal('request_started'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  timestamp: z.number().nonnegative()
});
export type RequestStartedEvent = z.infer<typeof RequestStartedEventSchema>;

export const SessionReadyEventSchema = z.object({
  type: z.literal('session_ready'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  timestamp: z.number().nonnegative()
});
export type SessionReadyEvent = z.infer<typeof SessionReadyEventSchema>;

export const ProviderSelectedEventSchema = z.object({
  type: z.literal('provider_selected'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  providerId: z.string().min(1),
  fallbackUsed: z.boolean(),
  reason: z.string(),
  timestamp: z.number().nonnegative()
});
export type ProviderSelectedEvent = z.infer<typeof ProviderSelectedEventSchema>;

export const ResponseStartedEventSchema = z.object({
  type: z.literal('response_started'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  providerId: z.string().min(1),
  timestamp: z.number().nonnegative()
});
export type ResponseStartedEvent = z.infer<typeof ResponseStartedEventSchema>;

export const ResponseDeltaEventSchema = z.object({
  type: z.literal('response_delta'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  text: z.string(),
  timestamp: z.number().nonnegative()
});
export type ResponseDeltaEvent = z.infer<typeof ResponseDeltaEventSchema>;

export const ResponseCompletedEventSchema = z.object({
  type: z.literal('response_completed'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  text: z.string(),
  finishReason: z.string().optional(),
  usage: BrainUsageSchema.optional(),
  timestamp: z.number().nonnegative()
});
export type ResponseCompletedEvent = z.infer<typeof ResponseCompletedEventSchema>;

export const RequestCancelledEventSchema = z.object({
  type: z.literal('request_cancelled'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  turnId: z.string().optional(),
  reason: z.string().optional(),
  timestamp: z.number().nonnegative()
});
export type RequestCancelledEvent = z.infer<typeof RequestCancelledEventSchema>;

export const RequestFailedEventSchema = z.object({
  type: z.literal('request_failed'),
  requestId: z.string().min(1),
  sessionId: z.string().optional(),
  turnId: z.string().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean().optional(),
    details: z.unknown().optional()
  }),
  timestamp: z.number().nonnegative()
});
export type RequestFailedEvent = z.infer<typeof RequestFailedEventSchema>;

export const ConversationRuntimeEventSchema = z.discriminatedUnion('type', [
  RequestStartedEventSchema,
  SessionReadyEventSchema,
  ProviderSelectedEventSchema,
  ResponseStartedEventSchema,
  ResponseDeltaEventSchema,
  ResponseCompletedEventSchema,
  RequestCancelledEventSchema,
  RequestFailedEventSchema
]);
export type ConversationRuntimeEvent = z.infer<typeof ConversationRuntimeEventSchema>;

export const CHAT_IPC_CHANNELS = {
  SEND: 'mave:chat-send',
  CANCEL: 'mave:chat-cancel',
  STREAM: 'mave:chat-stream',
  LOAD_SESSION: 'mave:chat-load-session'
} as const;
