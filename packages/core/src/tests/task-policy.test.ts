import { describe, expect, it } from 'vitest';
import {
  TaskPolicy,
  normalizeTaskIntent,
  TASK_INTENTS
} from '../brain/task-policy.js';

describe('TaskPolicy (F1.5-S3)', () => {
  const policy = new TaskPolicy();

  describe('Section 42: Task Intent Normalization & Mapping Matrix', () => {
    it('1. maps QUICK_CHAT -> fast_conversation + FAST', () => {
      const decision = policy.resolve({ taskIntent: 'quick_chat' });
      expect(decision.taskIntent).toBe('quick_chat');
      expect(decision.profileId).toBe('fast_conversation');
      expect(decision.modelRole).toBe('FAST');
      expect(decision.reason).toContain('quick_chat');
    });

    it('2. maps GENERAL_CONVERSATION -> fast_conversation + BALANCED', () => {
      const decision = policy.resolve({ taskIntent: 'general_conversation' });
      expect(decision.taskIntent).toBe('general_conversation');
      expect(decision.profileId).toBe('fast_conversation');
      expect(decision.modelRole).toBe('BALANCED');
    });

    it('3. maps LANGUAGE lightweight -> fast_conversation + FAST', () => {
      const decision = policy.resolve({ taskIntent: 'language' });
      expect(decision.taskIntent).toBe('language');
      expect(decision.profileId).toBe('fast_conversation');
      expect(decision.modelRole).toBe('FAST');
    });

    it('4. maps DEEP_REASONING -> deep_reasoning + REASONING', () => {
      const decision = policy.resolve({ taskIntent: 'deep_reasoning' });
      expect(decision.taskIntent).toBe('deep_reasoning');
      expect(decision.profileId).toBe('deep_reasoning');
      expect(decision.modelRole).toBe('REASONING');
    });

    it('5. maps PLANNING (conversational default) -> deep_reasoning + REASONING', () => {
      const decision = policy.resolve({ taskIntent: 'planning' });
      expect(decision.taskIntent).toBe('planning');
      expect(decision.profileId).toBe('deep_reasoning');
      expect(decision.modelRole).toBe('REASONING');
      expect(decision.reason).toContain('conversational');
    });

    it('6. maps PLANNING (project/agent workspace) -> agent_work + REASONING', () => {
      const decision = policy.resolve({
        taskIntent: 'planning',
        taskContext: { planningType: 'project' }
      });
      expect(decision.taskIntent).toBe('planning');
      expect(decision.profileId).toBe('agent_work');
      expect(decision.modelRole).toBe('REASONING');
      expect(decision.reason).toContain('project/agent');
    });

    it('7. maps CODING -> agent_work + CODING', () => {
      const decision = policy.resolve({ taskIntent: 'coding' });
      expect(decision.taskIntent).toBe('coding');
      expect(decision.profileId).toBe('agent_work');
      expect(decision.modelRole).toBe('CODING');
    });

    it('8. maps AGENT_WORK -> agent_work + AGENT', () => {
      const decision = policy.resolve({ taskIntent: 'agent_work' });
      expect(decision.taskIntent).toBe('agent_work');
      expect(decision.profileId).toBe('agent_work');
      expect(decision.modelRole).toBe('AGENT');
    });

    it('9. maps RESEARCH -> research + REASONING', () => {
      const decision = policy.resolve({ taskIntent: 'research' });
      expect(decision.taskIntent).toBe('research');
      expect(decision.profileId).toBe('research');
      expect(decision.modelRole).toBe('REASONING');
    });

    it('10. maps LOCAL_PRIVATE -> local_offline + BALANCED', () => {
      const decision = policy.resolve({ taskIntent: 'local_private' });
      expect(decision.taskIntent).toBe('local_private');
      expect(decision.profileId).toBe('local_offline');
      expect(decision.modelRole).toBe('BALANCED');
    });
  });

  describe('Architectural Invariants & Safeguards', () => {
    it('11. TaskPolicy NEVER emits vendor or provider names in reason or properties', () => {
      const forbiddenVendors = ['claude', 'codex', 'antigravity', 'openai', 'gemini', 'gpt'];

      for (const intent of TASK_INTENTS) {
        const decision = policy.resolve({ taskIntent: intent });
        const serialized = JSON.stringify(decision).toLowerCase();

        for (const vendor of forbiddenVendors) {
          expect(serialized).not.toContain(vendor);
        }
      }
    });

    it('12. default / unknown task preserves existing safe profile (fast_conversation)', () => {
      const decisionEmpty = policy.resolve({});
      expect(decisionEmpty.profileId).toBe('fast_conversation');
      expect(decisionEmpty.modelRole).toBe('BALANCED');

      const decisionUnknown = policy.resolve({ taskIntent: 'some_unknown_custom_intent' });
      expect(decisionUnknown.profileId).toBe('fast_conversation');
      expect(decisionUnknown.modelRole).toBe('BALANCED');
    });

    it('13. explicit caller modelRole overrides derived default role', () => {
      const decision = policy.resolve({
        taskIntent: 'coding',
        modelRole: 'REASONING' // explicitly requested reasoning for coding task
      });
      expect(decision.profileId).toBe('agent_work');
      expect(decision.modelRole).toBe('REASONING');
    });

    it('14. explicit profileId without taskIntent derives sensible default role', () => {
      expect(policy.resolve({ profileId: 'fast_conversation' }).modelRole).toBe('FAST');
      expect(policy.resolve({ profileId: 'deep_reasoning' }).modelRole).toBe('REASONING');
      expect(policy.resolve({ profileId: 'agent_work' }).modelRole).toBe('AGENT');
      expect(policy.resolve({ profileId: 'research' }).modelRole).toBe('REASONING');
      expect(policy.resolve({ profileId: 'local_offline' }).modelRole).toBe('BALANCED');
    });

    it('15. normalizeTaskIntent handles various aliases and casing', () => {
      expect(normalizeTaskIntent('QUICK_CHAT')).toBe('quick_chat');
      expect(normalizeTaskIntent('quick-chat')).toBe('quick_chat');
      expect(normalizeTaskIntent('fast_chat')).toBe('quick_chat');
      expect(normalizeTaskIntent('conversation')).toBe('general_conversation');
      expect(normalizeTaskIntent('refactoring')).toBe('coding');
      expect(normalizeTaskIntent('offline')).toBe('local_private');
      expect(normalizeTaskIntent(undefined)).toBeUndefined();
    });
  });
});
