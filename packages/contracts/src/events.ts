import { z } from 'zod';
import { AssistantStateSnapshotSchema } from './state.js';

export const MaveCommandSchema = z.enum([
  'simulate-wake',
  'return-to-sleep',
  'toggle-mute',
  'simulate-error',
  'open-mave',
  'open-settings',
  'quit',
  'restart-wake-engine',
  'set-microphone',
  'set-sensitivity',
  'set-threshold',
  'test-audio-file'
]);
export type MaveCommand = z.infer<typeof MaveCommandSchema>;

export const SendCommandPayloadSchema = z.object({
  command: MaveCommandSchema,
  payload: z.record(z.unknown()).optional()
});
export type SendCommandPayload = z.infer<typeof SendCommandPayloadSchema>;

export const StateChangeEventSchema = z.object({
  previousState: z.string(),
  currentState: z.string(),
  snapshot: AssistantStateSnapshotSchema
});
export type StateChangeEvent = z.infer<typeof StateChangeEventSchema>;
