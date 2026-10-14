// ============================================================================
// Internal Runtime Policy & Selection Engine (F1.5-S3)
//
// Invariant: Kept internal to @mave/core to preserve public frozen contracts.
// Manages deterministic agent runtime selection (AUTO, PREFERRED, LOCKED)
// for subscription runtimes (Claude Code, Codex, Antigravity).
// ============================================================================

import type { ModelRole } from './runtime-models/types.js';

export const RUNTIME_SELECTION_MODES = [
  'AUTO',
  'PREFERRED',
  'LOCKED'
] as const;
export type RuntimeSelectionMode = (typeof RUNTIME_SELECTION_MODES)[number];

/**
 * Canonical default runtime priorities by ModelRole.
 *
 * Invariant Note:
 * Documented as MAVE policy defaults, not objective model quality claims.
 * Configurable via BrainRouterOptions.runtimePriorities.
 */
export const DEFAULT_RUNTIME_PRIORITIES: Record<ModelRole, readonly string[]> = {
  CODING: ['claude-code', 'codex', 'antigravity'],
  AGENT: ['antigravity', 'claude-code', 'codex'],
  REASONING: ['claude-code', 'codex', 'antigravity'],
  BALANCED: ['claude-code', 'antigravity', 'codex'],
  FAST: ['claude-code', 'antigravity', 'codex']
};

/**
 * Normalizes runtime provider identifiers (e.g. 'claude_code' -> 'claude-code').
 */
export function normalizeRuntimeProviderId(id: string | undefined): string | undefined {
  if (!id || typeof id !== 'string') return undefined;
  const trimmed = id.trim().toLowerCase();
  if (trimmed === 'claude_code' || trimmed === 'claude-code') return 'claude-code';
  if (trimmed === 'antigravity') return 'antigravity';
  if (trimmed === 'codex') return 'codex';
  return trimmed;
}

export type RuntimeSelectionErrorCode =
  | 'no_eligible_runtime'
  | 'runtime_not_registered'
  | 'runtime_unhealthy'
  | 'runtime_not_executable'
  | 'runtime_role_not_supported'
  | 'runtime_locked_unavailable'
  | 'paid_api_blocked';

export class RuntimeSelectionError extends Error {
  readonly code: RuntimeSelectionErrorCode;
  readonly runtimeProviderId?: string;
  readonly role?: ModelRole;
  readonly mode?: RuntimeSelectionMode;

  constructor(
    code: RuntimeSelectionErrorCode,
    message: string,
    context?: {
      runtimeProviderId?: string;
      role?: ModelRole;
      mode?: RuntimeSelectionMode;
    }
  ) {
    super(message);
    this.name = 'RuntimeSelectionError';
    this.code = code;
    this.runtimeProviderId = context?.runtimeProviderId;
    this.role = context?.role;
    this.mode = context?.mode;
  }
}
