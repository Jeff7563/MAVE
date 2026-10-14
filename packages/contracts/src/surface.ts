import { z } from 'zod';

/**
 * Surface presentation modes.
 *
 * NOTE ON ARCHITECTURE:
 * Represents the high-level visual presentation state of the MAVE Ambient Surface.
 * This is decoupled from low-level voice coordination states (e.g. transcribing is
 * visually folded into listening; interrupted yields smoothly back to listening).
 * Pinned is represented as a boolean flag on the snapshot rather than a combinatorial mode.
 */
export const SurfaceModeSchema = z.enum([
  'hidden',
  'ambient',
  'listening',
  'thinking',
  'speaking',
  'compact_response',
  'expanded_response',
  'confirmation',
  'progress',
  'error'
]);
export type SurfaceMode = z.infer<typeof SurfaceModeSchema>;

/**
 * Visibility state of the native surface window.
 */
export const SurfaceVisibilitySchema = z.enum(['hidden', 'visible']);
export type SurfaceVisibility = z.infer<typeof SurfaceVisibilitySchema>;

/**
 * Discrete native window size envelope classes.
 *
 * - ambient: Level 0 mini indicator / dot (collapsed)
 * - compact: Level 1 Voice Capsule (~260x60 DIP / 280x80 envelope)
 * - card: Level 2 Quick Information Card (~340x140 DIP / 360x180 envelope)
 * - expanded: Level 3 Context Panel (~440x580 DIP envelope)
 */
export const SurfaceSizeClassSchema = z.enum(['ambient', 'compact', 'card', 'expanded']);
export type SurfaceSizeClass = z.infer<typeof SurfaceSizeClassSchema>;

/**
 * Interaction modes for mouse hit-testing and event forwarding.
 *
 * - passive: display-only, transparent pad forwards pointer events to OS windows
 * - interactive: intercepts clicks, scrolling, buttons, input focus
 * - click_through: explicitly passes pointer events through to desktop
 */
export const SurfaceInteractionModeSchema = z.enum(['passive', 'interactive', 'click_through']);
export type SurfaceInteractionMode = z.infer<typeof SurfaceInteractionModeSchema>;

/**
 * Focus intent signaling native OS window focus behavior.
 *
 * FOCUS SECURITY INVARIANT:
 * Passive MAVE events (wake, listen, think, speak, response arrival) MUST NEVER request focus.
 * Only explicit user actions (e.g. click text input, summon shortcut) may request focus.
 */
export const SurfaceFocusIntentSchema = z.enum(['preserve', 'request', 'release']);
export type SurfaceFocusIntent = z.infer<typeof SurfaceFocusIntentSchema>;

/**
 * High-level activity state indicator.
 */
export const SurfaceActivitySchema = z.enum([
  'idle',
  'listening',
  'thinking',
  'speaking',
  'working',
  'waiting_for_user',
  'error'
]);
export type SurfaceActivity = z.infer<typeof SurfaceActivitySchema>;

/**
 * Originating subsystem driving the surface presentation.
 */
export const SurfaceSourceSchema = z.enum([
  'voice',
  'conversation',
  'task',
  'permission',
  'system'
]);
export type SurfaceSource = z.infer<typeof SurfaceSourceSchema>;

/**
 * Priority classification for arbitration between simultaneous subsystems.
 */
export const SurfacePrioritySchema = z.enum(['low', 'normal', 'high', 'critical']);
export type SurfacePriority = z.infer<typeof SurfacePrioritySchema>;

export const SURFACE_PRIORITY_WEIGHTS: Record<SurfacePriority, number> = {
  low: 10,
  normal: 20,
  high: 30,
  critical: 40
} as const;

/**
 * Auto-collapse configuration descriptor.
 */
export const AutoCollapsePolicySchema = z.object({
  enabled: z.boolean(),
  afterMs: z.number().nonnegative(),
  targetMode: SurfaceModeSchema.default('ambient')
});
export type AutoCollapsePolicy = z.infer<typeof AutoCollapsePolicySchema>;

export const DEFAULT_AUTO_COLLAPSE_VOICE_MS = 3000;
export const DEFAULT_AUTO_COLLAPSE_COMPACT_MS = 30000;
export const DEFAULT_AUTO_COLLAPSE_EXPANDED_MS = 120000;
export const DEFAULT_AUTO_COLLAPSE_ERROR_MS = 5000;

/**
 * Surface error representation.
 */
export const SurfaceErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['warning', 'error']).default('error'),
  recoverable: z.boolean().default(true)
});
export type SurfaceError = z.infer<typeof SurfaceErrorSchema>;

/**
 * Real-time or finalized transcript descriptor.
 */
export const SurfaceTranscriptSchema = z.object({
  text: z.string(),
  isFinal: z.boolean(),
  confidence: z.number().min(0.0).max(1.0).optional(),
  language: z.string().optional()
});
export type SurfaceTranscript = z.infer<typeof SurfaceTranscriptSchema>;

/* ------------------------------------------------------------------
 * Semantic Content Blocks
 * ------------------------------------------------------------------ */

export const SurfaceTextBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('text'),
  text: z.string()
});
export type SurfaceTextBlock = z.infer<typeof SurfaceTextBlockSchema>;

export const SurfaceMarkdownBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('markdown'),
  markdown: z.string()
});
export type SurfaceMarkdownBlock = z.infer<typeof SurfaceMarkdownBlockSchema>;

export const SurfaceCodeBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('code'),
  language: z.string().optional(),
  code: z.string(),
  filename: z.string().optional()
});
export type SurfaceCodeBlock = z.infer<typeof SurfaceCodeBlockSchema>;

export const SurfaceVocabularyBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('vocabulary'),
  word: z.string().min(1),
  phonetic: z.string().optional(),
  translation: z.string().min(1),
  partOfSpeech: z.string().optional(),
  examples: z.array(z.string()).optional()
});
export type SurfaceVocabularyBlock = z.infer<typeof SurfaceVocabularyBlockSchema>;

export const SurfaceConfirmationBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('confirmation'),
  actionId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  risk: z.enum(['low', 'medium', 'high']).default('medium'),
  confirmLabel: z.string().default('Approve'),
  rejectLabel: z.string().default('Deny'),
  timeoutMs: z.number().nonnegative().optional()
});
export type SurfaceConfirmationBlock = z.infer<typeof SurfaceConfirmationBlockSchema>;

export const SurfaceProgressBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('progress'),
  taskId: z.string().min(1),
  label: z.string().min(1),
  percentage: z.number().min(0).max(100).optional(),
  step: z.number().nonnegative().optional(),
  totalSteps: z.number().positive().optional(),
  status: z.enum(['running', 'completed', 'failed', 'paused']).default('running')
});
export type SurfaceProgressBlock = z.infer<typeof SurfaceProgressBlockSchema>;

export const SurfaceSourceBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('source'),
  title: z.string().min(1),
  url: z.string().url().optional(),
  snippet: z.string().optional(),
  domain: z.string().optional()
});
export type SurfaceSourceBlock = z.infer<typeof SurfaceSourceBlockSchema>;

export const SurfaceStatusBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('status'),
  label: z.string().min(1),
  status: z.enum(['info', 'success', 'warning', 'error']).default('info')
});
export type SurfaceStatusBlock = z.infer<typeof SurfaceStatusBlockSchema>;

export const SurfaceContentBlockSchema = z.discriminatedUnion('type', [
  SurfaceTextBlockSchema,
  SurfaceMarkdownBlockSchema,
  SurfaceCodeBlockSchema,
  SurfaceVocabularyBlockSchema,
  SurfaceConfirmationBlockSchema,
  SurfaceProgressBlockSchema,
  SurfaceSourceBlockSchema,
  SurfaceStatusBlockSchema
]);
export type SurfaceContentBlock = z.infer<typeof SurfaceContentBlockSchema>;

/* ------------------------------------------------------------------
 * Full Surface Snapshot
 * ------------------------------------------------------------------ */

export const SurfaceSnapshotSchema = z.object({
  version: z.literal(1).default(1),
  mode: SurfaceModeSchema,
  visibility: SurfaceVisibilitySchema.default('visible'),
  sizeClass: SurfaceSizeClassSchema,
  interactionMode: SurfaceInteractionModeSchema.default('passive'),
  focusIntent: SurfaceFocusIntentSchema.default('preserve'),
  pinned: z.boolean().default(false),
  activity: SurfaceActivitySchema.default('idle'),
  source: SurfaceSourceSchema.default('voice'),
  priority: SurfacePrioritySchema.default('normal'),
  inputLevel: z.number().min(0.0).max(1.0).default(0),
  outputLevel: z.number().min(0.0).max(1.0).default(0),
  transcript: SurfaceTranscriptSchema.optional(),
  assistantText: z.string().optional(),
  content: z.array(SurfaceContentBlockSchema).optional(),
  autoCollapse: AutoCollapsePolicySchema.optional(),
  error: SurfaceErrorSchema.optional(),
  sessionId: z.string().optional(),
  preferredDisplayId: z.number().nullable().optional(),
  updatedAt: z.number().nonnegative()
});
export type SurfaceSnapshot = z.infer<typeof SurfaceSnapshotSchema>;

/* ------------------------------------------------------------------
 * Actions & Intents
 * ------------------------------------------------------------------ */

export const SurfaceActionOriginSchema = z.enum(['user', 'system', 'runtime']);
export type SurfaceActionOrigin = z.infer<typeof SurfaceActionOriginSchema>;

export const SurfaceActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('expand'),
    origin: SurfaceActionOriginSchema.default('user')
  }),
  z.object({
    type: z.literal('collapse'),
    origin: SurfaceActionOriginSchema.default('user')
  }),
  z.object({
    type: z.literal('toggle_pin'),
    origin: SurfaceActionOriginSchema.default('user'),
    pinned: z.boolean().optional()
  }),
  z.object({
    type: z.literal('dismiss'),
    origin: SurfaceActionOriginSchema.default('user')
  }),
  z.object({
    type: z.literal('confirm_action'),
    origin: SurfaceActionOriginSchema.default('user'),
    actionId: z.string().min(1),
    approved: z.boolean()
  }),
  z.object({
    type: z.literal('submit_text'),
    origin: SurfaceActionOriginSchema.default('user'),
    text: z.string().min(1).max(2048)
  }),
  z.object({
    type: z.literal('set_interaction_mode'),
    origin: SurfaceActionOriginSchema.default('user'),
    mode: SurfaceInteractionModeSchema
  }),
  z.object({
    type: z.literal('request_focus'),
    origin: SurfaceActionOriginSchema.default('user')
  }),
  z.object({
    type: z.literal('release_focus'),
    origin: SurfaceActionOriginSchema.default('user')
  }),
  z.object({
    type: z.literal('open_link'),
    origin: SurfaceActionOriginSchema.default('user'),
    url: z.string().max(2048)
  }),
  z.object({
    type: z.literal('open_source'),
    origin: SurfaceActionOriginSchema.default('user'),
    sourceId: z.string().max(256).optional(),
    url: z.string().max(2048).optional()
  }),
  z.object({
    type: z.literal('copy_text'),
    origin: SurfaceActionOriginSchema.default('user'),
    text: z.string().max(100000)
  }),
  z.object({
    type: z.literal('user_activity'),
    origin: SurfaceActionOriginSchema.default('user')
  }),
  z.object({
    type: z.literal('set_preferred_display'),
    origin: SurfaceActionOriginSchema.default('user'),
    displayId: z.number().nullable()
  })
]);
export type SurfaceAction = z.infer<typeof SurfaceActionSchema>;

export const SurfacePresentationIntentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('voice_activity'),
    voiceState: z.enum([
      'sleeping',
      'waking',
      'listening',
      'transcribing',
      'thinking',
      'speaking',
      'interrupted',
      'error'
    ]).optional(),
    inputLevel: z.number().min(0.0).max(1.0).optional(),
    outputLevel: z.number().min(0.0).max(1.0).optional(),
    transcript: SurfaceTranscriptSchema.optional(),
    assistantText: z.string().optional(),
    error: SurfaceErrorSchema.optional(),
    sessionId: z.string().optional(),
    isSpeakingFinished: z.boolean().optional(),
    timestamp: z.number().nonnegative().optional()
  }),
  z.object({
    type: z.literal('show_response'),
    source: SurfaceSourceSchema.optional(),
    priority: SurfacePrioritySchema.optional(),
    text: z.string().optional(),
    blocks: z.array(SurfaceContentBlockSchema).optional(),
    autoCollapseMs: z.number().nonnegative().optional(),
    sessionId: z.string().optional(),
    streaming: z.boolean().optional()
  }),
  z.object({
    type: z.literal('show_confirmation'),
    source: SurfaceSourceSchema.optional(),
    priority: SurfacePrioritySchema.optional(),
    confirmation: SurfaceConfirmationBlockSchema,
    autoRejectMs: z.number().nonnegative().optional()
  }),
  z.object({
    type: z.literal('show_progress'),
    source: SurfaceSourceSchema.optional(),
    priority: SurfacePrioritySchema.optional(),
    progress: SurfaceProgressBlockSchema
  }),
  z.object({
    type: z.literal('show_error'),
    source: SurfaceSourceSchema.optional(),
    priority: SurfacePrioritySchema.optional(),
    error: SurfaceErrorSchema,
    autoDismissMs: z.number().nonnegative().optional()
  }),
  z.object({
    type: z.literal('user_action'),
    action: SurfaceActionSchema
  }),
  z.object({
    type: z.literal('reset_to_ambient'),
    force: z.boolean().default(false)
  })
]);
export type SurfacePresentationIntent = z.infer<typeof SurfacePresentationIntentSchema>;

/* ------------------------------------------------------------------
 * IPC Events & Channels
 * ------------------------------------------------------------------ */

export const SurfaceEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('snapshot_updated'),
    snapshot: SurfaceSnapshotSchema,
    timestamp: z.number().nonnegative()
  }),
  z.object({
    type: z.literal('action_dispatched'),
    action: SurfaceActionSchema,
    timestamp: z.number().nonnegative()
  })
]);
export type SurfaceEvent = z.infer<typeof SurfaceEventSchema>;

export const SURFACE_IPC_CHANNELS = {
  GET_SNAPSHOT: 'mave:surface:get-snapshot',
  EVENT: 'mave:surface:event',
  DISPATCH_ACTION: 'mave:surface:dispatch-action'
} as const;
