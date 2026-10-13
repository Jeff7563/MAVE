import { z } from 'zod';
import { ConversationModeSchema } from './state.js';

export const BrainConfigSchema = z.object({
  defaultProvider: z.string().min(1).default('mock'),
  fallbackChain: z.array(z.string()).default([]),
  timeoutMs: z.number().positive().default(30000)
});
export type BrainConfig = z.infer<typeof BrainConfigSchema>;

export const MaveConfigSchema = z.object({
  wake: z.object({
    enabled: z.boolean(),
    wakeProvider: z.string().default('openwakeword'),
    threshold: z.number().min(0).max(1).default(0.5),
    sensitivity: z.number().min(0).max(1).optional(),
    keywordModelPath: z.string().default('assets/wake/mave.onnx'),
    microphoneDeviceIndex: z.number().min(-1).default(-1)
  }),
  conversation: z.object({
    idleTimeoutMs: z.number().positive(),
    companionTimeoutMs: z.number().positive(),
    defaultMode: ConversationModeSchema
  }),
  brain: BrainConfigSchema.default({
    defaultProvider: 'mock',
    fallbackChain: [],
    timeoutMs: 30000
  }),
  /**
   * @deprecated Retained temporarily for backward compatibility with existing persisted settings.
   * Use `brain` configuration for generic MAVE AI conversation runtime settings.
   */
  realtime: z
    .object({
      model: z.string(),
      vad: z.enum(['semantic_vad', 'server_vad']),
      vadEagerness: z.enum(['low', 'medium', 'high', 'auto'])
    })
    .optional(),
  memory: z.object({
    storeTranscripts: z.boolean(),
    storeAudio: z.literal(false)
  })
});

export type MaveConfig = z.infer<typeof MaveConfigSchema>;

export const DefaultMaveConfig: MaveConfig = {
  wake: {
    enabled: true,
    wakeProvider: 'openwakeword',
    threshold: 0.5,
    sensitivity: 0.5,
    keywordModelPath: 'assets/wake/mave.onnx',
    microphoneDeviceIndex: -1
  },
  conversation: {
    idleTimeoutMs: 75000,
    companionTimeoutMs: 1800000,
    defaultMode: 'conversation'
  },
  brain: {
    defaultProvider: 'mock',
    fallbackChain: [],
    timeoutMs: 30000
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
