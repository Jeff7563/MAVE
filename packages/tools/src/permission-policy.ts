import type { ApprovalScope, ToolCallSource, ToolRiskLevel } from '@mave/contracts';
import { TOOL_RISK_ORDER } from '@mave/contracts';

export type PermissionVerdict =
  | { kind: 'allow'; via: 'auto' | 'session_grant' }
  | { kind: 'ask' };

export interface PermissionPolicyOptions {
  /**
   * Highest risk that runs without asking when the USER typed/spoke the
   * command directly. Default: safe_local (open app/url/folder runs instantly).
   */
  userAutoAllowUpTo?: ToolRiskLevel;
  /**
   * Highest risk that runs without asking when a BRAIN or AGENT proposed it.
   * Default: read_only. LLM output never equals execution authority.
   */
  modelAutoAllowUpTo?: ToolRiskLevel;
}

/**
 * Deterministic permission policy (MAVE_TOOL_AND_PERMISSION_MODEL.md).
 * - Level 3 (destructive) always asks, and session grants never apply to it.
 * - Session grants are per tool id and per source class (user vs model).
 */
export class PermissionPolicy {
  private readonly userAutoAllowUpTo: ToolRiskLevel;
  private readonly modelAutoAllowUpTo: ToolRiskLevel;
  private readonly sessionGrants = new Set<string>();

  constructor(options: PermissionPolicyOptions = {}) {
    this.userAutoAllowUpTo = options.userAutoAllowUpTo ?? 'safe_local';
    this.modelAutoAllowUpTo = options.modelAutoAllowUpTo ?? 'read_only';
    if (TOOL_RISK_ORDER[this.userAutoAllowUpTo] >= TOOL_RISK_ORDER.destructive) {
      throw new Error('destructive actions can never be auto-allowed');
    }
    if (TOOL_RISK_ORDER[this.modelAutoAllowUpTo] >= TOOL_RISK_ORDER.destructive) {
      throw new Error('destructive actions can never be auto-allowed');
    }
  }

  evaluate(toolId: string, risk: ToolRiskLevel, source: ToolCallSource): PermissionVerdict {
    if (risk === 'destructive') {
      return { kind: 'ask' };
    }
    const limit = source === 'user' ? this.userAutoAllowUpTo : this.modelAutoAllowUpTo;
    if (TOOL_RISK_ORDER[risk] <= TOOL_RISK_ORDER[limit]) {
      return { kind: 'allow', via: 'auto' };
    }
    if (this.sessionGrants.has(grantKey(toolId, source))) {
      return { kind: 'allow', via: 'session_grant' };
    }
    return { kind: 'ask' };
  }

  recordApproval(toolId: string, risk: ToolRiskLevel, source: ToolCallSource, scope: ApprovalScope): void {
    if (scope === 'session' && risk !== 'destructive') {
      this.sessionGrants.add(grantKey(toolId, source));
    }
  }

  revokeAll(): void {
    this.sessionGrants.clear();
  }

  listSessionGrants(): string[] {
    return Array.from(this.sessionGrants);
  }
}

function grantKey(toolId: string, source: ToolCallSource): string {
  return `${source === 'user' ? 'user' : 'model'}:${toolId}`;
}
