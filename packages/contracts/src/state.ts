import { z } from 'zod';

export const MaveStateSchema = z.enum([
  'starting',
  'sleeping',
  'waking',
  'listening',
  'thinking',
  'speaking',
  'reconnecting',
  'muted',
  'error',
  'shuttingDown'
]);

export type MaveState = z.infer<typeof MaveStateSchema>;

export const WakeEngineStatusSchema = z.enum([
  'not_configured',
  'initializing',
  'ready',
  'listening',
  'active',
  'error'
]);
export type WakeEngineStatus = z.infer<typeof WakeEngineStatusSchema>;

export const AiStatusSchema = z.enum([
  'offline',
  'connecting',
  'connected',
  'error'
]);
export type AiStatus = z.infer<typeof AiStatusSchema>;

export const DatabaseStatusSchema = z.enum([
  'initializing',
  'ready',
  'error'
]);
export type DatabaseStatus = z.infer<typeof DatabaseStatusSchema>;

export const ConversationModeSchema = z.enum([
  'conversation',
  'teacher',
  'immersion',
  'quick'
]);
export type ConversationMode = z.infer<typeof ConversationModeSchema>;

export const AssistantStateSnapshotSchema = z.object({
  state: MaveStateSchema,
  wakeEngineStatus: WakeEngineStatusSchema,
  aiStatus: AiStatusSchema,
  databaseStatus: DatabaseStatusSchema,
  isMuted: z.boolean(),
  mode: ConversationModeSchema,
  errorMessage: z.string().optional(),
  lastActiveAt: z.number(),
  microphoneName: z.string().optional(),
  microphoneIndex: z.number().optional(),
  availableDevices: z.array(z.string()).optional(),
  wakeWord: z.string().optional(),
  sensitivity: z.number().optional(),
  threshold: z.number().optional(),
  wakeProvider: z.string().optional(),
  lastWakeAt: z.number().optional(),
  isWakeConfigured: z.boolean().optional(),
  latestScore: z.number().optional(),
  peakScore: z.number().optional(),
  lastWakeScore: z.number().optional()
});

export type AssistantStateSnapshot = z.infer<typeof AssistantStateSnapshotSchema>;
