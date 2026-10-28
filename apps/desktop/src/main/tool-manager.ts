import path from 'node:path';
import os from 'node:os';
import type { BrowserWindow } from 'electron';
import {
  ApprovalDecisionSchema,
  TOOL_IPC_CHANNELS,
  ToolCallRequestSchema,
  ToolRunCommandRequestSchema,
  type ApprovalDecision,
  type ToolApprovalRequest,
  type ToolAuditRecord,
  type ToolDescriptor,
  type ToolEvent,
  type ToolResult,
  type ToolRunCommandResponse
} from '@mave/contracts';
import {
  ActionBrainProvider,
  buildToolPromptSection,
  createBuiltinTools,
  InMemoryToolAuditLog,
  NodeSystemAdapter,
  parseActionBlocks,
  PermissionPolicy,
  QuickCommandMatcher,
  ToolExecutor,
  ToolRegistry,
  WorkspaceScope,
  type QuickCommandMatch,
  type SystemAdapter
} from '@mave/tools';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:tool-manager' });

/** Electron's shell when available (correct default-browser handling), Node fallback otherwise. */
export interface ElectronShellLike {
  openExternal(url: string): Promise<void>;
  openPath(path: string): Promise<string>;
}

export class ElectronSystemAdapter extends NodeSystemAdapter implements SystemAdapter {
  constructor(private readonly shell: ElectronShellLike) {
    super();
  }

  override async openExternal(target: string): Promise<void> {
    await this.shell.openExternal(target);
  }

  override async openPath(target: string): Promise<void> {
    const error = await this.shell.openPath(target);
    if (error) throw new Error(error);
  }
}

/**
 * Default allowed folders: MAVE_TOOL_ROOTS (separated by ";" or ","), else the
 * repository folder plus its parent (e.g. C:\project when MAVE is C:\project\MAVE),
 * unless that parent is a drive root or the home folder.
 */
export function resolveToolRoots(env: NodeJS.ProcessEnv, repoRoot: string): string[] {
  const configured = env['MAVE_TOOL_ROOTS']
    ?.split(/[;,]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (configured && configured.length > 0) return configured;
  const roots = [repoRoot];
  const parent = path.dirname(repoRoot);
  const isDriveRoot = path.parse(parent).root === parent;
  if (!isDriveRoot && path.resolve(parent) !== path.resolve(os.homedir())) roots.push(parent);
  return roots;
}

export interface ToolManagerOptions {
  repoRoot: string;
  getMainWindow?: () => BrowserWindow | null;
  system?: SystemAdapter;
  env?: NodeJS.ProcessEnv;
  approvalTimeoutMs?: number;
}

interface PendingApproval {
  request: ToolApprovalRequest;
  resolve: (decision: Omit<ApprovalDecision, 'callId'>) => void;
}

export class ToolManager {
  readonly registry = new ToolRegistry();
  readonly audit = new InMemoryToolAuditLog();
  readonly policy = new PermissionPolicy();
  readonly scope: WorkspaceScope;
  readonly executor: ToolExecutor;
  readonly actionProvider: ActionBrainProvider;
  readonly matcher = new QuickCommandMatcher();

  private getMainWindow: () => BrowserWindow | null;
  private readonly pendingApprovals = new Map<string, PendingApproval>();
  private readonly listeners = new Set<(event: ToolEvent) => void>();

  constructor(options: ToolManagerOptions) {
    this.getMainWindow = options.getMainWindow ?? (() => null);
    const roots = resolveToolRoots(options.env ?? process.env, options.repoRoot);
    this.scope = new WorkspaceScope(roots);
    this.registry.registerAll(createBuiltinTools({ scope: this.scope }));
    this.executor = new ToolExecutor({
      registry: this.registry,
      policy: this.policy,
      system: options.system ?? new NodeSystemAdapter(),
      audit: this.audit,
      approvalTimeoutMs: options.approvalTimeoutMs,
      approvalHandler: (request, signal) => this.waitForApproval(request, signal),
      onEvent: (event) => this.emit(event)
    });
    this.actionProvider = new ActionBrainProvider(this.executor);
    logger.info({ roots: this.scope.listRoots(), tools: this.registry.list().map((t) => t.id) }, 'tool manager ready');
  }

  setMainWindowGetter(getter: () => BrowserWindow | null): void {
    this.getMainWindow = getter;
  }

  onEvent(listener: (event: ToolEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  listTools(): ToolDescriptor[] {
    return this.registry.describe();
  }

  /** System prompt section so any brain knows which actions it may request. */
  getPromptSection(): string {
    return buildToolPromptSection(this.registry.describe());
  }

  matchQuickCommand(text: string): QuickCommandMatch | undefined {
    return this.matcher.match(text);
  }

  listPendingApprovals(): ToolApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).map((p) => p.request);
  }

  getAudit(limit = 50): ToolAuditRecord[] {
    return this.audit.list(limit);
  }

  async handleCall(raw: unknown): Promise<ToolResult> {
    const parsed = ToolCallRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        callId: 'invalid',
        toolId: 'unknown',
        ok: false,
        output: '',
        error: { code: 'invalid_args', message: parsed.error.message },
        durationMs: 0
      };
    }
    // Calls from the UI are the user's own clicks.
    return this.executor.call({ ...parsed.data, source: 'user' });
  }

  /** Runs a typed command like "เปิดยูทูป" directly. Returns matched=false if it isn't a command. */
  async handleRunCommand(raw: unknown): Promise<ToolRunCommandResponse> {
    const parsed = ToolRunCommandRequestSchema.safeParse(raw);
    if (!parsed.success) return { matched: false };
    const match = this.matcher.match(parsed.data.text);
    if (!match) return { matched: false };
    const callId = this.executor.newCallId();
    void this.executor.call({ ...match.request, callId });
    return { matched: true, callId, toolId: match.request.toolId, summary: match.acknowledgement };
  }

  handleApprovalResponse(raw: unknown): { ok: boolean; error?: string } {
    const parsed = ApprovalDecisionSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    const pending = this.pendingApprovals.get(parsed.data.callId);
    if (!pending) return { ok: false, error: 'No pending approval with that id' };
    this.pendingApprovals.delete(parsed.data.callId);
    pending.resolve({ decision: parsed.data.decision, scope: parsed.data.scope });
    return { ok: true };
  }

  handleCancel(raw: unknown): { cancelled: boolean } {
    const callId = raw && typeof raw === 'object' && typeof (raw as { callId?: unknown }).callId === 'string'
      ? (raw as { callId: string }).callId
      : '';
    return { cancelled: callId ? this.executor.cancel(callId) : false };
  }

  /**
   * Called when a brain answer is complete. Any ```mave-action blocks become
   * tool calls with source "brain" (so anything beyond reading asks first).
   */
  runBrainActions(responseText: string, sessionId?: string): void {
    const { actions, errors } = parseActionBlocks(responseText);
    for (const error of errors) logger.warn({ error }, 'ignored malformed brain action');
    for (const action of actions) {
      void this.executor.call({ ...action, source: 'brain', sessionId });
    }
  }

  async dispose(): Promise<void> {
    for (const pending of this.pendingApprovals.values()) {
      pending.resolve({ decision: 'deny', scope: 'once' });
    }
    this.pendingApprovals.clear();
    this.executor.cancelAll();
    this.listeners.clear();
  }

  private waitForApproval(
    request: ToolApprovalRequest,
    signal: AbortSignal
  ): Promise<Omit<ApprovalDecision, 'callId'>> {
    return new Promise((resolve) => {
      const finish = (decision: Omit<ApprovalDecision, 'callId'>) => {
        signal.removeEventListener('abort', onAbort);
        resolve(decision);
      };
      const onAbort = () => {
        this.pendingApprovals.delete(request.callId);
        finish({ decision: 'deny', scope: 'once' });
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.pendingApprovals.set(request.callId, { request, resolve: finish });
    });
  }

  private emit(event: ToolEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        logger.warn({ err }, 'tool event listener failed');
      }
    }
    const win = this.getMainWindow();
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send(TOOL_IPC_CHANNELS.EVENT, event);
    } catch (err) {
      logger.warn({ err }, 'failed to send tool event to renderer');
    }
  }
}
