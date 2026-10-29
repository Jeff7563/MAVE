import { z } from 'zod';

/**
 * M5 — Tool & Permission contracts.
 *
 * Rule: an LLM (or agent) may PROPOSE a tool call. The MAVE runtime decides
 * whether it is allowed. These schemas are the only shapes that cross the
 * tool boundary and the Electron IPC boundary.
 */

/**
 * Risk levels from MAVE_TOOL_AND_PERMISSION_MODEL.md
 * - read_only            (Level 0) read file, list dir, git status
 * - safe_local           (Level 1) open file/folder/url, launch app, run tests
 * - external_side_effect (Level 2) changes things outside MAVE (agents editing code, sending, uploading)
 * - destructive          (Level 3) delete, reset, overwrite — always confirmed
 */
export const ToolRiskLevelSchema = z.enum([
  'read_only',
  'safe_local',
  'external_side_effect',
  'destructive'
]);
export type ToolRiskLevel = z.infer<typeof ToolRiskLevelSchema>;

export const TOOL_RISK_ORDER: Record<ToolRiskLevel, number> = {
  read_only: 0,
  safe_local: 1,
  external_side_effect: 2,
  destructive: 3
};

export const ToolCallSourceSchema = z.enum([
  /** Typed/spoken directly by the user and matched deterministically (quick command). */
  'user',
  /** Proposed by a brain provider inside its response. */
  'brain',
  /** Proposed by a delegated agent runtime. */
  'agent'
]);
export type ToolCallSource = z.infer<typeof ToolCallSourceSchema>;

export const ToolDescriptorSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  riskLevel: ToolRiskLevelSchema,
  timeoutMs: z.number().int().positive(),
  /** Human readable argument hints, used for prompts and UI. */
  argsHint: z.record(z.string()).default({})
});
export type ToolDescriptor = z.infer<typeof ToolDescriptorSchema>;

export const ToolCallRequestSchema = z
  .object({
    callId: z.string().min(1).optional(),
    toolId: z.string().min(1),
    args: z.record(z.unknown()).default({}),
    source: ToolCallSourceSchema.default('user'),
    /** Why the caller wants to run this (shown on approval cards). */
    reason: z.string().max(500).optional(),
    sessionId: z.string().min(1).optional()
  })
  .strict();
export type ToolCallRequest = z.infer<typeof ToolCallRequestSchema>;
export type ToolCallRequestInput = z.input<typeof ToolCallRequestSchema>;

export const ApprovalScopeSchema = z.enum([
  /** Only this call. */
  'once',
  /** Same tool for the rest of this app session (never applies to destructive). */
  'session'
]);
export type ApprovalScope = z.infer<typeof ApprovalScopeSchema>;

export const ApprovalDecisionSchema = z
  .object({
    callId: z.string().min(1),
    decision: z.enum(['allow', 'deny']),
    scope: ApprovalScopeSchema.default('once')
  })
  .strict();
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export const ToolApprovalRequestSchema = z.object({
  callId: z.string().min(1),
  toolId: z.string().min(1),
  toolTitle: z.string(),
  riskLevel: ToolRiskLevelSchema,
  source: ToolCallSourceSchema,
  /** One-line summary of what will happen, e.g. `Run "pnpm test" in C:\project\MAVE`. */
  summary: z.string(),
  reason: z.string().optional(),
  args: z.record(z.unknown()),
  requestedAt: z.number().nonnegative()
});
export type ToolApprovalRequest = z.infer<typeof ToolApprovalRequestSchema>;

export const ToolErrorCodeSchema = z.enum([
  'unknown_tool',
  'invalid_args',
  'denied',
  'blocked',
  'timeout',
  'cancelled',
  'execution_failed'
]);
export type ToolErrorCode = z.infer<typeof ToolErrorCodeSchema>;

export const ToolResultSchema = z.object({
  callId: z.string().min(1),
  toolId: z.string().min(1),
  ok: z.boolean(),
  /** Short text result safe to show to the user and to feed back to a brain. */
  output: z.string().default(''),
  data: z.unknown().optional(),
  error: z
    .object({
      code: ToolErrorCodeSchema,
      message: z.string()
    })
    .optional(),
  durationMs: z.number().nonnegative()
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

export const ToolAuditRecordSchema = z.object({
  callId: z.string().min(1),
  toolId: z.string().min(1),
  source: ToolCallSourceSchema,
  riskLevel: ToolRiskLevelSchema,
  /** Arguments with sensitive values redacted. */
  args: z.record(z.unknown()),
  decision: z.enum(['auto_allowed', 'approved', 'session_approved', 'denied', 'blocked']),
  status: z.enum(['completed', 'failed', 'denied', 'blocked', 'cancelled', 'timeout']),
  startedAt: z.number().nonnegative(),
  endedAt: z.number().nonnegative(),
  summary: z.string(),
  error: z.string().optional()
});
export type ToolAuditRecord = z.infer<typeof ToolAuditRecordSchema>;

const ToolEventBase = z.object({
  callId: z.string().min(1),
  toolId: z.string().min(1),
  timestamp: z.number().nonnegative()
});

export const ToolEventSchema = z.discriminatedUnion('type', [
  ToolEventBase.extend({
    type: z.literal('tool_requested'),
    source: ToolCallSourceSchema,
    summary: z.string()
  }),
  ToolEventBase.extend({
    type: z.literal('tool_approval_required'),
    approval: ToolApprovalRequestSchema
  }),
  ToolEventBase.extend({
    type: z.literal('tool_started')
  }),
  ToolEventBase.extend({
    type: z.literal('tool_progress'),
    message: z.string()
  }),
  ToolEventBase.extend({
    type: z.literal('tool_completed'),
    result: ToolResultSchema
  }),
  ToolEventBase.extend({
    type: z.literal('tool_failed'),
    result: ToolResultSchema
  })
]);
export type ToolEvent = z.infer<typeof ToolEventSchema>;

/** Result of trying to run a free-form command line ("เปิด youtube"). */
export const ToolRunCommandRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(2000)
  })
  .strict();
export type ToolRunCommandRequest = z.infer<typeof ToolRunCommandRequestSchema>;

export const ToolRunCommandResponseSchema = z.object({
  matched: z.boolean(),
  callId: z.string().optional(),
  toolId: z.string().optional(),
  summary: z.string().optional()
});
export type ToolRunCommandResponse = z.infer<typeof ToolRunCommandResponseSchema>;

export const TOOL_IPC_CHANNELS = {
  LIST: 'mave:tools:list',
  CALL: 'mave:tools:call',
  RUN_COMMAND: 'mave:tools:run-command',
  RESPOND_APPROVAL: 'mave:tools:respond-approval',
  CANCEL: 'mave:tools:cancel',
  GET_AUDIT: 'mave:tools:get-audit',
  EVENT: 'mave:tools:event'
} as const;
