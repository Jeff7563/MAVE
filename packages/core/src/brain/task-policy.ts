// ============================================================================
// Internal Task Policy & Classification Engine (F1.5-S3)
//
// Invariant: Kept internal to @mave/core to preserve public frozen contracts.
// Task Policy operates strictly on abstract TaskIntent, BrainProfile, and ModelRole.
// It NEVER emits or references vendor or provider names (Claude, Codex, Antigravity).
// ============================================================================

import type { BrainProfileId } from '@mave/contracts';
import type { ModelRole } from './runtime-models/types.js';

export const TASK_INTENTS = [
  'quick_chat',
  'general_conversation',
  'language',
  'deep_reasoning',
  'planning',
  'coding',
  'agent_work',
  'research',
  'local_private'
] as const;
export type TaskIntent = (typeof TASK_INTENTS)[number];

export interface TaskContext {
  readonly planningType?: 'conversational' | 'project' | 'agent';
  readonly [key: string]: unknown;
}

export interface TaskClassificationInput {
  readonly taskIntent?: TaskIntent | string;
  readonly profileId?: BrainProfileId;
  readonly modelRole?: ModelRole;
  readonly intent?: string;
  readonly context?: Record<string, unknown>;
  readonly taskContext?: TaskContext;
}

export interface TaskRoutingDecision {
  readonly taskIntent: TaskIntent;
  readonly profileId: BrainProfileId;
  readonly modelRole: ModelRole;
  readonly reason: string;
}

/**
 * Normalizes an arbitrary intent string to canonical TaskIntent if recognized.
 */
export function normalizeTaskIntent(rawIntent: string | undefined): TaskIntent | undefined {
  if (!rawIntent || typeof rawIntent !== 'string') {
    return undefined;
  }
  const normalized = rawIntent.trim().toLowerCase().replace(/[- ]+/g, '_');
  switch (normalized) {
    case 'quick_chat':
    case 'quickchat':
    case 'fast_chat':
      return 'quick_chat';
    case 'general_conversation':
    case 'conversation':
    case 'chat':
      return 'general_conversation';
    case 'language':
    case 'language_learning':
    case 'translation':
      return 'language';
    case 'deep_reasoning':
    case 'reasoning':
    case 'analysis':
      return 'deep_reasoning';
    case 'planning':
      return 'planning';
    case 'coding':
    case 'code':
    case 'refactor':
    case 'refactoring':
      return 'coding';
    case 'agent_work':
    case 'agent':
    case 'workflow':
      return 'agent_work';
    case 'research':
    case 'web_research':
    case 'search':
      return 'research';
    case 'local_private':
    case 'local_offline':
    case 'offline':
    case 'local':
    case 'private':
      return 'local_private';
    default:
      return undefined;
  }
}

/**
 * TaskPolicy
 *
 * Deterministically resolves semantic TaskIntent into BrainProfileId and ModelRole.
 *
 * Architecture Invariants:
 * 1. PURE CLASSIFICATION: No network or LLM calls to classify requests. Pure deterministic policy.
 * 2. VENDOR AGNOSTIC: Must NEVER reference provider or model vendor names.
 * 3. BACKWARDS COMPATIBLE: Preserves safe default (general_conversation -> fast_conversation) when no intent is provided.
 * 4. SEPARATION OF CONCERNS: TaskIntent (user desire) != BrainProfile (architecture path) != ModelRole (semantic role).
 */
export class TaskPolicy {
  /**
   * Resolves TaskClassificationInput into a deterministic TaskRoutingDecision.
   */
  resolve(input: TaskClassificationInput = {}): TaskRoutingDecision {
    const rawIntent = input.taskIntent ?? input.intent;
    const recognizedIntent = normalizeTaskIntent(rawIntent);

    // If explicit modelRole was specified by caller, preserve it; otherwise derive from policy.
    const explicitRole = input.modelRole;

    // Case 1: Recognized TaskIntent
    if (recognizedIntent) {
      return this.resolveByIntent(recognizedIntent, input, explicitRole);
    }

    // Case 2: Explicit ProfileId provided without recognized TaskIntent
    if (input.profileId) {
      return this.resolveByProfile(input.profileId, explicitRole);
    }

    // Case 3: Safe Default (Section 10)
    // Preserves existing normal MAVE conversation behavior (fast_conversation with BALANCED role).
    return {
      taskIntent: 'general_conversation',
      profileId: 'fast_conversation',
      modelRole: explicitRole ?? 'BALANCED',
      reason: "Safe default applied: task 'general_conversation' resolved to profile 'fast_conversation' with role 'BALANCED'"
    };
  }

  private resolveByIntent(
    intent: TaskIntent,
    input: TaskClassificationInput,
    explicitRole?: ModelRole
  ): TaskRoutingDecision {
    switch (intent) {
      case 'quick_chat':
        return {
          taskIntent: 'quick_chat',
          profileId: 'fast_conversation',
          modelRole: explicitRole ?? 'FAST',
          reason: "Task 'quick_chat' resolved to profile 'fast_conversation' with role 'FAST'"
        };

      case 'general_conversation':
        return {
          taskIntent: 'general_conversation',
          profileId: 'fast_conversation',
          modelRole: explicitRole ?? 'BALANCED',
          reason: "Task 'general_conversation' resolved to profile 'fast_conversation' with role 'BALANCED'"
        };

      case 'language':
        // Section 34: Lightweight language learning/translation preserves conversational profile semantics.
        return {
          taskIntent: 'language',
          profileId: 'fast_conversation',
          modelRole: explicitRole ?? 'FAST',
          reason: "Task 'language' resolved to conversational profile 'fast_conversation' with role 'FAST'"
        };

      case 'deep_reasoning':
        return {
          taskIntent: 'deep_reasoning',
          profileId: 'deep_reasoning',
          modelRole: explicitRole ?? 'REASONING',
          reason: "Task 'deep_reasoning' resolved to profile 'deep_reasoning' with role 'REASONING'"
        };

      case 'planning': {
        // Section 4: Distinguish conversational planning from agent/project planning
        const planningType =
          input.taskContext?.planningType ??
          (input.context?.planningType as 'conversational' | 'project' | 'agent' | undefined);

        if (planningType === 'project' || planningType === 'agent') {
          return {
            taskIntent: 'planning',
            profileId: 'agent_work',
            modelRole: explicitRole ?? 'REASONING',
            reason: "Task 'planning' (project/agent workspace context) resolved to profile 'agent_work' with role 'REASONING'"
          };
        }

        return {
          taskIntent: 'planning',
          profileId: 'deep_reasoning',
          modelRole: explicitRole ?? 'REASONING',
          reason: "Task 'planning' (conversational) resolved to profile 'deep_reasoning' with role 'REASONING'"
        };
      }

      case 'coding':
        return {
          taskIntent: 'coding',
          profileId: 'agent_work',
          modelRole: explicitRole ?? 'CODING',
          reason: "Task 'coding' resolved to profile 'agent_work' with role 'CODING'"
        };

      case 'agent_work':
        return {
          taskIntent: 'agent_work',
          profileId: 'agent_work',
          modelRole: explicitRole ?? 'AGENT',
          reason: "Task 'agent_work' resolved to profile 'agent_work' with role 'AGENT'"
        };

      case 'research':
        return {
          taskIntent: 'research',
          profileId: 'research',
          modelRole: explicitRole ?? 'REASONING',
          reason: "Task 'research' resolved to profile 'research' with role 'REASONING'"
        };

      case 'local_private':
        return {
          taskIntent: 'local_private',
          profileId: 'local_offline',
          modelRole: explicitRole ?? 'BALANCED',
          reason: "Task 'local_private' resolved to profile 'local_offline' with role 'BALANCED'"
        };
    }
  }

  private resolveByProfile(
    profileId: BrainProfileId,
    explicitRole?: ModelRole
  ): TaskRoutingDecision {
    switch (profileId) {
      case 'fast_conversation':
        return {
          taskIntent: 'general_conversation',
          profileId: 'fast_conversation',
          modelRole: explicitRole ?? 'FAST',
          reason: "Explicit profile 'fast_conversation' resolved with role 'FAST'"
        };

      case 'deep_reasoning':
        return {
          taskIntent: 'deep_reasoning',
          profileId: 'deep_reasoning',
          modelRole: explicitRole ?? 'REASONING',
          reason: "Explicit profile 'deep_reasoning' resolved with role 'REASONING'"
        };

      case 'agent_work':
        return {
          taskIntent: 'agent_work',
          profileId: 'agent_work',
          modelRole: explicitRole ?? 'AGENT',
          reason: "Explicit profile 'agent_work' resolved with role 'AGENT'"
        };

      case 'research':
        return {
          taskIntent: 'research',
          profileId: 'research',
          modelRole: explicitRole ?? 'REASONING',
          reason: "Explicit profile 'research' resolved with role 'REASONING'"
        };

      case 'local_offline':
        return {
          taskIntent: 'local_private',
          profileId: 'local_offline',
          modelRole: explicitRole ?? 'BALANCED',
          reason: "Explicit profile 'local_offline' resolved with role 'BALANCED'"
        };
    }
  }
}
