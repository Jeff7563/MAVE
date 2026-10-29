import { randomUUID } from 'node:crypto';
import type {
  ApprovalDecision,
  ToolApprovalRequest,
  ToolAuditRecord,
  ToolCallRequestInput,
  ToolErrorCode,
  ToolEvent,
  ToolResult,
  ToolRiskLevel
} from '@mave/contracts';
import { TOOL_RISK_ORDER, ToolCallRequestSchema } from '@mave/contracts';
import { createLogger } from '@mave/shared';
import { redactArgs, redactText, type ToolAuditSink } from './audit.js';
import { PermissionPolicy } from './permission-policy.js';
import type { ToolRegistry } from './registry.js';
import type { SystemAdapter } from './system-adapter.js';
import { NodeSystemAdapter } from './system-adapter.js';

const logger = createLogger({ name: 'mave:tools:executor' });

/**
 * Asks the human. Resolves with the decision, or with `deny` on timeout.
 * Desktop implements this with an Approval card over IPC.
 */
export type ApprovalHandler = (
  request: ToolApprovalRequest,
  signal: AbortSignal
) => Promise<Omit<ApprovalDecision, 'callId'>>;

export interface ToolExecutorOptions {
  registry: ToolRegistry;
  policy?: PermissionPolicy;
  system?: SystemAdapter;
  audit?: ToolAuditSink;
  /** If missing, anything that needs approval is denied. */
  approvalHandler?: ApprovalHandler;
  /** How long to wait for a human decision before denying. Default 5 minutes. */
  approvalTimeoutMs?: number;
  onEvent?: (event: ToolEvent) => void;
  clock?: () => number;
  idFactory?: () => string;
}

interface ActiveCall {
  controller: AbortController;
  toolId: string;
}

/**
 * The single entry point for running any tool.
 * validate → classify risk → block check → permission → (approval) → execute with timeout → audit.
 */
export class ToolExecutor {
  private readonly registry: ToolRegistry;
  private readonly policy: PermissionPolicy;
  private readonly system: SystemAdapter;
  private readonly audit?: ToolAuditSink;
  private readonly approvalHandler?: ApprovalHandler;
  private readonly approvalTimeoutMs: number;
  private readonly onEvent?: (event: ToolEvent) => void;
  private readonly clock: () => number;
  private readonly idFactory: () => string;
  private readonly active = new Map<string, ActiveCall>();

  constructor(options: ToolExecutorOptions) {
    this.registry = options.registry;
    this.policy = options.policy ?? new PermissionPolicy();
    this.system = options.system ?? new NodeSystemAdapter();
    this.audit = options.audit;
    this.approvalHandler = options.approvalHandler;
    this.approvalTimeoutMs = options.approvalTimeoutMs ?? 5 * 60 * 1000;
    this.onEvent = options.onEvent;
    this.clock = options.clock ?? (() => Date.now());
    this.idFactory = options.idFactory ?? (() => randomUUID());
  }

  getPolicy(): PermissionPolicy {
    return this.policy;
  }

  listActive(): string[] {
    return Array.from(this.active.keys());
  }

  /** Cancel an in-flight call (also cancels a pending approval). */
  cancel(callId: string): boolean {
    const call = this.active.get(callId);
    if (!call) return false;
    call.controller.abort('cancelled by user');
    return true;
  }

  cancelAll(): void {
    for (const call of this.active.values()) call.controller.abort('cancelled');
  }

  /** Allocate a call id up front (used when the caller needs it before `call` resolves). */
  newCallId(): string {
    return this.idFactory();
  }

  async call(input: ToolCallRequestInput, outerSignal?: AbortSignal): Promise<ToolResult> {
    const startedAt = this.clock();
    const parsed = ToolCallRequestSchema.safeParse(input);
    const callId =
      (parsed.success ? parsed.data.callId : undefined) ?? this.idFactory();
    const toolIdRaw = parsed.success ? parsed.data.toolId : String((input as { toolId?: unknown })?.toolId ?? 'unknown');

    if (!parsed.success) {
      return this.fail(callId, toolIdRaw, 'invalid_args', parsed.error.message, startedAt);
    }
    const request = parsed.data;
    const tool = this.registry.get(request.toolId);
    if (!tool) {
      return this.fail(callId, request.toolId, 'unknown_tool', `MAVE has no tool called '${request.toolId}'`, startedAt);
    }

    const argsResult = tool.argsSchema.safeParse(request.args);
    if (!argsResult.success) {
      const message = argsResult.error.issues.map((i) => `${i.path.join('.') || 'args'}: ${i.message}`).join('; ');
      return this.fail(callId, tool.id, 'invalid_args', message, startedAt);
    }
    const args = argsResult.data;
    const safeArgs = redactArgs(request.args);

    let summary: string;
    let risk: ToolRiskLevel = tool.riskLevel;
    try {
      summary = redactText(tool.summarize(args));
      if (tool.classifyRisk) {
        const dynamic = tool.classifyRisk(args);
        // Dynamic classification may only raise risk.
        if (TOOL_RISK_ORDER[dynamic] > TOOL_RISK_ORDER[risk]) risk = dynamic;
      }
    } catch (err) {
      return this.fail(callId, tool.id, 'invalid_args', errorMessage(err), startedAt);
    }

    this.emit({ type: 'tool_requested', callId, toolId: tool.id, source: request.source, summary, timestamp: this.clock() });

    const controller = new AbortController();
    const onOuterAbort = () => controller.abort(outerSignal?.reason ?? 'cancelled');
    if (outerSignal?.aborted) controller.abort(outerSignal.reason);
    outerSignal?.addEventListener('abort', onOuterAbort, { once: true });
    this.active.set(callId, { controller, toolId: tool.id });

    const auditBase = {
      callId,
      toolId: tool.id,
      source: request.source,
      riskLevel: risk,
      args: safeArgs,
      startedAt,
      summary
    };

    try {
      // 1. Hard blocks
      let blockReason: string | undefined;
      try {
        blockReason = tool.block?.(args);
      } catch (err) {
        blockReason = errorMessage(err);
      }
      if (blockReason) {
        this.record({ ...auditBase, decision: 'blocked', status: 'blocked', endedAt: this.clock(), error: blockReason });
        return this.fail(callId, tool.id, 'blocked', blockReason, startedAt);
      }

      // 2. Permission
      const verdict = this.policy.evaluate(tool.id, risk, request.source);
      let decision: ToolAuditRecord['decision'];
      if (verdict.kind === 'allow') {
        decision = verdict.via === 'auto' ? 'auto_allowed' : 'session_approved';
      } else {
        const approval = await this.askApproval(
          {
            callId,
            toolId: tool.id,
            toolTitle: tool.title,
            riskLevel: risk,
            source: request.source,
            summary,
            reason: request.reason,
            args: safeArgs,
            requestedAt: this.clock()
          },
          controller.signal
        );
        if (controller.signal.aborted) {
          this.record({ ...auditBase, decision: 'denied', status: 'cancelled', endedAt: this.clock() });
          return this.fail(callId, tool.id, 'cancelled', 'Cancelled before it started', startedAt);
        }
        if (approval.decision !== 'allow') {
          this.record({ ...auditBase, decision: 'denied', status: 'denied', endedAt: this.clock() });
          return this.fail(callId, tool.id, 'denied', 'You declined this action', startedAt);
        }
        this.policy.recordApproval(tool.id, risk, request.source, approval.scope);
        decision = 'approved';
      }

      // 3. Execute with timeout
      this.emit({ type: 'tool_started', callId, toolId: tool.id, timestamp: this.clock() });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort('timeout');
      }, tool.timeoutMs);

      try {
        const output = await raceAbort(
          tool.execute(args, {
            callId,
            source: request.source,
            signal: controller.signal,
            system: this.system,
            progress: (message: string) =>
              this.emit({ type: 'tool_progress', callId, toolId: tool.id, message: redactText(message).slice(0, 500), timestamp: this.clock() })
          }),
          controller.signal
        );
        const result: ToolResult = {
          callId,
          toolId: tool.id,
          ok: true,
          output: redactText(output.output),
          data: output.data,
          durationMs: this.clock() - startedAt
        };
        this.record({ ...auditBase, decision, status: 'completed', endedAt: this.clock() });
        this.emit({ type: 'tool_completed', callId, toolId: tool.id, result, timestamp: this.clock() });
        return result;
      } catch (err) {
        const code: ToolErrorCode = timedOut ? 'timeout' : controller.signal.aborted ? 'cancelled' : 'execution_failed';
        const message =
          code === 'timeout'
            ? `Timed out after ${Math.round(tool.timeoutMs / 1000)}s`
            : code === 'cancelled'
              ? 'Cancelled'
              : errorMessage(err);
        this.record({
          ...auditBase,
          decision,
          status: code === 'timeout' ? 'timeout' : code === 'cancelled' ? 'cancelled' : 'failed',
          endedAt: this.clock(),
          error: message
        });
        logger.warn({ callId, toolId: tool.id, code, message }, 'tool execution failed');
        return this.fail(callId, tool.id, code, message, startedAt);
      } finally {
        clearTimeout(timer);
      }
    } finally {
      outerSignal?.removeEventListener('abort', onOuterAbort);
      this.active.delete(callId);
    }
  }

  private async askApproval(
    request: ToolApprovalRequest,
    signal: AbortSignal
  ): Promise<Omit<ApprovalDecision, 'callId'>> {
    if (!this.approvalHandler) {
      return { decision: 'deny', scope: 'once' };
    }
    this.emit({ type: 'tool_approval_required', callId: request.callId, toolId: request.toolId, approval: request, timestamp: this.clock() });
    const timeoutController = new AbortController();
    const onAbort = () => timeoutController.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => timeoutController.abort('approval timeout'), this.approvalTimeoutMs);
    try {
      return await raceAbort(this.approvalHandler(request, timeoutController.signal), timeoutController.signal);
    } catch {
      return { decision: 'deny', scope: 'once' };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }

  private fail(callId: string, toolId: string, code: ToolErrorCode, message: string, startedAt: number): ToolResult {
    const result: ToolResult = {
      callId,
      toolId,
      ok: false,
      output: '',
      error: { code, message: redactText(message) },
      durationMs: Math.max(0, this.clock() - startedAt)
    };
    this.emit({ type: 'tool_failed', callId, toolId, result, timestamp: this.clock() });
    return result;
  }

  private record(entry: ToolAuditRecord): void {
    if (!this.audit) return;
    try {
      void Promise.resolve(this.audit.record(entry)).catch((err) =>
        logger.warn({ err }, 'failed to write tool audit record')
      );
    } catch (err) {
      logger.warn({ err }, 'failed to write tool audit record');
    }
  }

  private emit(event: ToolEvent): void {
    try {
      this.onEvent?.(event);
    } catch (err) {
      logger.warn({ err }, 'tool event listener threw');
    }
  }
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error('aborted'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error('aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      }
    );
  });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
