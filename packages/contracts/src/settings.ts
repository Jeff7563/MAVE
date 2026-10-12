import { z } from 'zod';
import { ConversationModeSchema } from './state.js';

export const MaveConfigSchema = z.object({
  wake: z.object({
    enabled: z.boolean(),
    sensitivity: z.number().min(0).max(1),
    keywordModelPath: z.string(),
    microphoneDeviceIndex: z.number().min(-1)
  }),
  conversation: z.object({
    idleTimeoutMs: z.number().positive(),
    companionTimeoutMs: z.number().positive(),
    defaultMode: ConversationModeSchema
  }),
  realtime: z.object({
    model: z.string(),
    vad: z.enum(['semantic_vad', 'server_vad']),
    vadEagerness: z.enum(['low', 'medium', 'high', 'auto'])
  }),
  memory: z.object({
    storeTranscripts: z.boolean(),
    storeAudio: z.literal(false)
  })
});

export type MaveConfig = z.infer<typeof MaveConfigSchema>;

export const DefaultMaveConfig: MaveConfig = {
  wake: {
    enabled: true,
    sensitivity: 0.5,
    keywordModelPath: 'assets/wake/mave_windows.ppn',
    microphoneDeviceIndex: -1
  },
  conversation: {
    idleTimeoutMs: 75000,
    companionTimeoutMs: 1800000,
    defaultMode: 'conversation'
  },
  realtime: {
    model: 'gpt-4o-realtime-preview',
    vad: 'semantic_vad',
    vadEagerness: 'auto'
  },
  memory: {
    storeTranscripts: true,
    storeAudio: false
  }
};
