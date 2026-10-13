import { z } from 'zod';
import { ConversationModeSchema } from './state.js';

export const SessionStatusSchema = z.enum(['active', 'ended', 'error']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
  status: SessionStatusSchema.default('active'),
  mode: ConversationModeSchema.default('conversation'),
  activeProviderId: z.string().optional(),
  title: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});
export type Session = z.infer<typeof SessionSchema>;

export const ConversationRoleSchema = z.enum(['user', 'assistant', 'system']);
export type ConversationRole = z.infer<typeof ConversationRoleSchema>;

export const MaveMessageSchema = z.object({
  role: ConversationRoleSchema,
  content: z.string(),
  name: z.string().optional()
});
export type MaveMessage = z.infer<typeof MaveMessageSchema>;

export const ConversationTurnStatusSchema = z.enum([
  'pending',
  'streaming',
  'completed',
  'cancelled',
  'failed'
]);
export type ConversationTurnStatus = z.infer<typeof ConversationTurnStatusSchema>;

export const ConversationTurnSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  requestId: z.string().min(1),
  role: ConversationRoleSchema,
  content: z.string(),
  providerId: z.string().optional(),
  status: ConversationTurnStatusSchema.default('completed'),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

export const StreamingChunkSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  text: z.string(),
  isFinal: z.boolean().default(false),
  error: z.string().optional()
});
export type StreamingChunk = z.infer<typeof StreamingChunkSchema>;
