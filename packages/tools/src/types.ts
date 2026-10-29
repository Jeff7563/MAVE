import type { ToolCallSource, ToolRiskLevel } from '@mave/contracts';
import type { ZodType, ZodTypeDef } from 'zod';
import type { SystemAdapter } from './system-adapter.js';

export interface ToolExecutionContext {
  callId: string;
  source: ToolCallSource;
  signal: AbortSignal;
  system: SystemAdapter;
  /** Report a short human-readable progress line (streamed to UI). */
  progress(message: string): void;
}

export interface ToolExecutionOutput {
  /** Short text result for the user and for feeding back to a brain. */
  output: string;
  data?: unknown;
}

/**
 * A tool MAVE can run. Tools never decide their own permission:
 * they declare risk, and the ToolExecutor + PermissionPolicy decide.
 */
export interface ToolDefinition<TArgs = Record<string, unknown>> {
  id: string;
  title: string;
  description: string;
  /** Base risk. `classifyRisk` may raise (never lower) it for specific args. */
  riskLevel: ToolRiskLevel;
  timeoutMs: number;
  argsSchema: ZodType<TArgs, ZodTypeDef, unknown>;
  argsHint?: Record<string, string>;
  /** Dynamic risk for specific arguments, e.g. a destructive shell command. */
  classifyRisk?(args: TArgs): ToolRiskLevel;
  /** Return a reason to hard-block this call (never runs, even with approval). */
  block?(args: TArgs): string | undefined;
  /** One-line description of what this call will do, shown on approval cards. */
  summarize(args: TArgs): string;
  execute(args: TArgs, ctx: ToolExecutionContext): Promise<ToolExecutionOutput>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any>;

export class ToolExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}
