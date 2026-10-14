import type {
  ModelRole,
  RuntimeModelDescriptor
} from '../models/types.js';

export const CLAUDE_CODE_PROVIDER_ID = 'claude-code';

export type ClaudeModelAlias = 'haiku' | 'sonnet' | 'opus' | (string & {});

export type ClaudeSupportedRole = ModelRole;

/**
 * Backward-compatible alias for RuntimeModelDescriptor within the Claude Code provider.
 */
export type ClaudeRuntimeModelSnapshot = RuntimeModelDescriptor;

/**
 * Semantic Model Role Mapping for Claude Code subscription runtime.
 *
 * Invariant Note:
 * Haiku satisfies ModelRole.FAST (fast relative model within the CLI runtime)
 * and ModelRole.BALANCED. However, Claude Code remains an agent_runtime_provider
 * with CLI bootstrap overhead (~1.1–1.7s) and cannot satisfy the low-latency
 * voice profile BrainProfile.fast_conversation (NO CANONICAL SUBSCRIPTION FAST_CONVERSATION ROUTE YET).
 */
export const CLAUDE_ROLE_MAPPING: Record<ModelRole, readonly string[]> = {
  FAST: ['haiku'],
  BALANCED: ['sonnet', 'haiku'],
  REASONING: ['opus', 'sonnet'],
  CODING: ['sonnet', 'opus'],
  AGENT: ['sonnet']
};

/**
 * Resolves an internal model ID or alias for a requested Model Role.
 */
export function resolveClaudeModelForRole(role: string): string | undefined {
  const upper = role.toUpperCase() as ModelRole;
  const candidates = CLAUDE_ROLE_MAPPING[upper];
  if (!candidates || candidates.length === 0) {
    return undefined;
  }
  return candidates[0];
}

/**
 * Creates an observed runtime model descriptor when a Claude session emits an init event.
 */
export function createClaudeObservedRuntimeModel(
  canonicalModelName: string,
  alias?: string
): RuntimeModelDescriptor {
  const trimmed = canonicalModelName.trim();
  const lower = trimmed.toLowerCase();

  let roles: ModelRole[] = ['BALANCED'];
  let displayName = trimmed;
  let priority = 5;

  if (lower.includes('opus')) {
    roles = ['REASONING', 'CODING'];
    displayName = `Claude Opus (${trimmed})`;
    priority = 1;
  } else if (lower.includes('sonnet')) {
    roles = ['BALANCED', 'CODING', 'AGENT', 'REASONING'];
    displayName = `Claude Sonnet (${trimmed})`;
    priority = 1;
  } else if (lower.includes('haiku')) {
    roles = ['FAST', 'BALANCED'];
    displayName = `Claude Haiku (${trimmed})`;
    priority = 2;
  }

  return {
    modelId: alias || trimmed,
    runtimeProviderId: CLAUDE_CODE_PROVIDER_ID,
    displayName,
    alias,
    canonicalName: trimmed,
    supportedRoles: roles,
    discoverySource: 'runtime_observed',
    availability: 'available',
    discoveredAt: Date.now(),
    selectionMechanism: '--model flag',
    metadata: {
      priority,
      observedModel: trimmed
    }
  };
}

/**
 * Generates an internal runtime model descriptor list for Claude Code.
 */
export function getClaudeDefaultRuntimeModels(): RuntimeModelDescriptor[] {
  const now = Date.now();
  return [
    {
      modelId: 'sonnet',
      runtimeProviderId: CLAUDE_CODE_PROVIDER_ID,
      displayName: 'Claude Sonnet',
      alias: 'sonnet',
      canonicalName: 'claude-sonnet-5',
      supportedRoles: ['BALANCED', 'CODING', 'AGENT', 'REASONING'],
      discoverySource: 'runtime_alias',
      availability: 'available',
      discoveredAt: now,
      selectionMechanism: '--model flag',
      metadata: {
        priority: 1,
        rolePriority: {
          BALANCED: 1,
          CODING: 1,
          AGENT: 1,
          REASONING: 2
        },
        defaultFor: ['BALANCED', 'CODING', 'AGENT']
      }
    },
    {
      modelId: 'opus',
      runtimeProviderId: CLAUDE_CODE_PROVIDER_ID,
      displayName: 'Claude Opus',
      alias: 'opus',
      canonicalName: 'claude-opus-5',
      supportedRoles: ['REASONING', 'CODING'],
      discoverySource: 'runtime_alias',
      availability: 'available',
      discoveredAt: now,
      selectionMechanism: '--model flag',
      metadata: {
        priority: 1,
        rolePriority: {
          REASONING: 1,
          CODING: 2
        },
        defaultFor: ['REASONING']
      }
    },
    {
      modelId: 'haiku',
      runtimeProviderId: CLAUDE_CODE_PROVIDER_ID,
      displayName: 'Claude Haiku',
      alias: 'haiku',
      canonicalName: 'claude-haiku-4-5-20251001',
      supportedRoles: ['FAST', 'BALANCED'],
      discoverySource: 'runtime_alias',
      availability: 'available',
      discoveredAt: now,
      selectionMechanism: '--model flag',
      metadata: {
        priority: 2,
        rolePriority: {
          FAST: 1,
          BALANCED: 2
        },
        defaultFor: ['FAST']
      }
    }
  ];
}
