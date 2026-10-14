export const CLAUDE_CODE_PROVIDER_ID = 'claude-code';

export type ClaudeModelAlias = 'haiku' | 'sonnet' | 'opus' | (string & {});

export type ClaudeSupportedRole = 'BALANCED' | 'REASONING' | 'CODING' | 'AGENT';

/**
 * Internal representation of a model discovered/available in the Claude Code subscription runtime.
 * Kept internal to avoid premature mutation of public frozen contracts.
 */
export interface ClaudeRuntimeModelSnapshot {
  readonly runtimeProviderId: typeof CLAUDE_CODE_PROVIDER_ID;
  readonly modelId: string;
  readonly alias?: string;
  readonly canonicalName?: string;
  readonly available: boolean;
  readonly supportedRoles: readonly ClaudeSupportedRole[];
  readonly selectionMechanism: '--model flag';
  readonly discoveryTimestamp: number;
}

/**
 * Semantic Model Role Mapping for Claude Code subscription runtime.
 * Empirically verified:
 * - FAST: Ineligible. Local benchmark confirmed CLI bootstrap (~1.2s) + TTFT (~2.3s)
 *   cannot satisfy sub-2s interactive voice, and agent_runtime_provider cannot fake model_provider.
 * - BALANCED: 'sonnet' (default)
 * - REASONING: 'opus' (primary) or 'sonnet'
 * - CODING: 'sonnet' (primary) or 'opus'
 * - AGENT: 'sonnet'
 */
export const CLAUDE_ROLE_MAPPING: Record<ClaudeSupportedRole, readonly string[]> = {
  REASONING: ['opus', 'sonnet'],
  CODING: ['sonnet', 'opus'],
  AGENT: ['sonnet'],
  BALANCED: ['sonnet']
};

/**
 * Resolves an internal model ID or alias for a requested Model Role.
 * Returns undefined if the role is unsupported (e.g. FAST).
 */
export function resolveClaudeModelForRole(role: string): string | undefined {
  const upper = role.toUpperCase() as ClaudeSupportedRole;
  const candidates = CLAUDE_ROLE_MAPPING[upper];
  if (!candidates || candidates.length === 0) {
    return undefined;
  }
  return candidates[0];
}

/**
 * Generates an internal runtime model snapshot list for Claude Code.
 */
export function getClaudeDefaultRuntimeModels(): ClaudeRuntimeModelSnapshot[] {
  const now = Date.now();
  return [
    {
      runtimeProviderId: CLAUDE_CODE_PROVIDER_ID,
      modelId: 'sonnet',
      alias: 'sonnet',
      canonicalName: 'claude-sonnet-5',
      available: true,
      supportedRoles: ['BALANCED', 'CODING', 'AGENT', 'REASONING'],
      selectionMechanism: '--model flag',
      discoveryTimestamp: now
    },
    {
      runtimeProviderId: CLAUDE_CODE_PROVIDER_ID,
      modelId: 'opus',
      alias: 'opus',
      canonicalName: 'claude-opus-5',
      available: true,
      supportedRoles: ['REASONING', 'CODING'],
      selectionMechanism: '--model flag',
      discoveryTimestamp: now
    },
    {
      runtimeProviderId: CLAUDE_CODE_PROVIDER_ID,
      modelId: 'haiku',
      alias: 'haiku',
      canonicalName: 'claude-haiku-4-5-20251001',
      available: true,
      // Note: Ineligible for FAST interactive voice, but available as lightweight balanced utility
      supportedRoles: ['BALANCED'],
      selectionMechanism: '--model flag',
      discoveryTimestamp: now
    }
  ];
}

