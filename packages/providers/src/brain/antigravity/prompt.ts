import type { BrainRequest } from '@mave/contracts';

export const MAVE_CONVERSATIONAL_INSTRUCTION = `You are the conversational brain used by MAVE, a personal AI assistant. Respond naturally and directly to the final user request. Use the supplied conversation history for context.

This M2 integration is conversation-only.

Do not use tools.
Do not modify files.
Do not execute commands.
Do not perform external actions.
Return only the conversational answer.`;

/**
 * Builds the canonical prompt for the Google Antigravity CLI process
 * strictly from BrainRequest contents (systemPrompt, messages, intent).
 * Does not inspect filesystem, screen, clipboard, or local repository.
 */
export function buildAntigravityPrompt(request: BrainRequest): string {
  const sections: string[] = [];

  // 1. Core provider instruction
  sections.push(MAVE_CONVERSATIONAL_INSTRUCTION);

  // 2. Optional system prompt passed by MAVE
  if (request.systemPrompt && request.systemPrompt.trim()) {
    sections.push(`System Context:\n${request.systemPrompt.trim()}`);
  }

  // 3. Conversation history from canonical MAVE turns
  if (request.messages && request.messages.length > 0) {
    sections.push('Conversation History:');
    for (let i = 0; i < request.messages.length; i++) {
      const msg = request.messages[i]!;
      const isLast = i === request.messages.length - 1;
      const role =
        msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'MAVE' : 'System';

      if (isLast && msg.role === 'user') {
        sections.push(`User (current message): ${msg.content.trim()}`);
      } else {
        sections.push(`${role}: ${msg.content.trim()}`);
      }
    }
  }

  return sections.join('\n\n');
}
