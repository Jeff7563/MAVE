import { z } from 'zod';

/**
 * Lifecycle status of an individual VoiceSession.
 *
 * NOTE ON STATE TOPOLOGY:
 * VoiceSessionStatus represents session-level metadata within VoiceSessionCoordinator.
 * It is NOT a replacement for the global assistant macro-state machine (maveMachine).
 */
export const VoiceSessionStatusSchema = z.enum([
  'idle',
  'listening',
  'transcribing',
  'thinking',
  'speaking',
  'interrupted',
  'completed',
  'cancelled',
  'error'
]);
export type VoiceSessionStatus = z.infer<typeof VoiceSessionStatusSchema>;

/**
 * Canonical VoiceSession data model.
 */
export const VoiceSessionSchema = z.object({
  id: z.string().min(1),
  conversationSessionId: z.string().min(1).optional(),
  status: VoiceSessionStatusSchema.default('idle'),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
  languageHint: z.string().min(2).optional(),
  activeSTTProviderId: z.string().min(1).optional(),
  activeTTSProviderId: z.string().min(1).optional()
});
export type VoiceSession = z.infer<typeof VoiceSessionSchema>;

/**
 * IPC-Safe, Serializable Voice Runtime Events.
 *
 * CRITICAL SERIALIZATION RULES:
 * 1. These events cross the Electron Main -> Renderer boundary.
 * 2. They contain ZERO binary AudioFrame buffers or raw PCM data.
 * 3. They contain ZERO provider instances, child processes, or AbortSignals.
 * 4. Audio level telemetry is strictly normalized to [0.0, 1.0].
 */
export const VoiceSessionStartedRuntimeEventSchema = z.object({
  type: z.literal('voice_session_started'),
  sessionId: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const ListeningStartedRuntimeEventSchema = z.object({
  type: z.literal('listening_started'),
  sessionId: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const SpeechStartedRuntimeEventSchema = z.object({
  type: z.literal('speech_started'),
  sessionId: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const PartialTranscriptRuntimeEventSchema = z.object({
  type: z.literal('partial_transcript'),
  sessionId: z.string().min(1),
  text: z.string(),
  confidence: z.number().min(0.0).max(1.0).optional(),
  timestamp: z.number().nonnegative()
});

export const FinalTranscriptRuntimeEventSchema = z.object({
  type: z.literal('final_transcript'),
  sessionId: z.string().min(1),
  text: z.string().min(1),
  confidence: z.number().min(0.0).max(1.0),
  language: z.string().optional(),
  timestamp: z.number().nonnegative()
});

export const AssistantChunkRuntimeEventSchema = z.object({
  type: z.literal('assistant_chunk'),
  sessionId: z.string().min(1),
  text: z.string(),
  timestamp: z.number().nonnegative()
});

export const ThinkingStartedRuntimeEventSchema = z.object({
  type: z.literal('thinking_started'),
  sessionId: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const SpeakingStartedRuntimeEventSchema = z.object({
  type: z.literal('speaking_started'),
  sessionId: z.string().min(1),
  requestId: z.string().optional(),
  timestamp: z.number().nonnegative()
});

export const SpeakingFinishedRuntimeEventSchema = z.object({
  type: z.literal('speaking_finished'),
  sessionId: z.string().min(1),
  requestId: z.string().optional(),
  timestamp: z.number().nonnegative()
});

export const InterruptedRuntimeEventSchema = z.object({
  type: z.literal('interrupted'),
  sessionId: z.string().min(1),
  reason: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const AudioLevelRuntimeEventSchema = z.object({
  type: z.literal('audio_level'),
  sessionId: z.string().min(1),
  inputLevel: z.number().min(0.0).max(1.0).optional(),
  outputLevel: z.number().min(0.0).max(1.0).optional(),
  timestamp: z.number().nonnegative()
});

export const VoiceSessionCompletedRuntimeEventSchema = z.object({
  type: z.literal('voice_session_completed'),
  sessionId: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const VoiceSessionCancelledRuntimeEventSchema = z.object({
  type: z.literal('voice_session_cancelled'),
  sessionId: z.string().min(1),
  reason: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const VoiceSessionFailedRuntimeEventSchema = z.object({
  type: z.literal('voice_session_failed'),
  sessionId: z.string().min(1),
  errorCode: z.string().min(1),
  errorMessage: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const VoiceRuntimeEventSchema = z.discriminatedUnion('type', [
  VoiceSessionStartedRuntimeEventSchema,
  ListeningStartedRuntimeEventSchema,
  SpeechStartedRuntimeEventSchema,
  PartialTranscriptRuntimeEventSchema,
  FinalTranscriptRuntimeEventSchema,
  AssistantChunkRuntimeEventSchema,
  ThinkingStartedRuntimeEventSchema,
  SpeakingStartedRuntimeEventSchema,
  SpeakingFinishedRuntimeEventSchema,
  InterruptedRuntimeEventSchema,
  AudioLevelRuntimeEventSchema,
  VoiceSessionCompletedRuntimeEventSchema,
  VoiceSessionCancelledRuntimeEventSchema,
  VoiceSessionFailedRuntimeEventSchema
]);
export type VoiceRuntimeEvent = z.infer<typeof VoiceRuntimeEventSchema>;

/**
 * IPC Channels for Voice Subsystem.
 */
export const VOICE_IPC_CHANNELS = {
  GET_STATUS: 'mave:voice:get-status',
  EVENT: 'mave:voice:event',
  INTERRUPT: 'mave:voice:interrupt',
  CANCEL: 'mave:voice:cancel',
  START_DIAGNOSTIC: 'mave:voice:start-diagnostic'
} as const;

/**
 * Developer latency instrumentation timestamps & derived metrics.
 * Non-persistent, strictly diagnostic telemetry.
 */
export const VoiceLatencyDiagnosticsSchema = z.object({
  wakeDetectedAt: z.number().nonnegative().optional(),
  voiceCaptureStartedAt: z.number().nonnegative().optional(),
  speechStartedAt: z.number().nonnegative().optional(),
  speechEndedAt: z.number().nonnegative().optional(),
  sttFinalAt: z.number().nonnegative().optional(),
  brainStartedAt: z.number().nonnegative().optional(),
  brainFirstTokenAt: z.number().nonnegative().optional(),
  ttsRequestedAt: z.number().nonnegative().optional(),
  ttsFirstAudioAt: z.number().nonnegative().optional(),
  playbackStartedAt: z.number().nonnegative().optional(),
  playbackCompletedAt: z.number().nonnegative().optional(),

  // Derived metrics (ms)
  wakeToCaptureMs: z.number().nonnegative().optional(),
  speechEndToSttMs: z.number().nonnegative().optional(),
  sttToBrainTtftMs: z.number().nonnegative().optional(),
  ttsTtfaMs: z.number().nonnegative().optional(),
  speechEndToSpokenResponseMs: z.number().nonnegative().optional(),
  turnDurationMs: z.number().nonnegative().optional()
});
export type VoiceLatencyDiagnostics = z.infer<typeof VoiceLatencyDiagnosticsSchema>;

/**
 * Macro voice diagnostic state shown in developer UI.
 */
export const VoiceDiagnosticStateSchema = z.enum([
  'sleeping',
  'waking',
  'listening',
  'transcribing',
  'thinking',
  'speaking',
  'interrupted',
  'error'
]);
export type VoiceDiagnosticState = z.infer<typeof VoiceDiagnosticStateSchema>;

/**
 * Full Voice Status Snapshot for IPC hydration and UI state inspection.
 */
export const VoiceStatusSnapshotSchema = z.object({
  enabled: z.boolean(),
  state: VoiceDiagnosticStateSchema,
  micOwnership: z.enum(['wake', 'voice', 'none']),
  sessionId: z.string().optional(),
  conversationSessionId: z.string().optional(),
  turnIndex: z.number().nonnegative().optional(),
  wake: z.object({
    provider: z.string(),
    listening: z.boolean(),
    lastScore: z.number().optional(),
    threshold: z.number().optional()
  }),
  audioInput: z.object({
    provider: z.string(),
    deviceLabel: z.string().optional()
  }),
  stt: z.object({
    provider: z.string(),
    status: z.string(),
    language: z.string().optional(),
    model: z.string().optional()
  }),
  tts: z.object({
    provider: z.string(),
    status: z.string(),
    voiceId: z.string().optional()
  }),
  output: z.object({
    provider: z.string(),
    state: z.string(),
    deviceLabel: z.string().optional()
  }),
  inputLevel: z.number().min(0.0).max(1.0).default(0),
  outputLevel: z.number().min(0.0).max(1.0).default(0),
  lastTranscript: z
    .object({
      text: z.string(),
      isFinal: z.boolean(),
      confidence: z.number().min(0.0).max(1.0).optional(),
      language: z.string().optional()
    })
    .optional(),
  assistantText: z.string().optional(),
  lastError: z
    .object({
      code: z.string(),
      message: z.string()
    })
    .optional(),
  latency: VoiceLatencyDiagnosticsSchema.optional()
});
export type VoiceStatusSnapshot = z.infer<typeof VoiceStatusSnapshotSchema>;
