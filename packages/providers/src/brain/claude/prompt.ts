import type { BrainRequest } from '@mave/contracts';

export const MAVE_CLAUDE_CONVERSATIONAL_INSTRUCTION = `You are the intelligence engine for MAVE, a personal AI operating layer. Respond naturally and directly to the user request. Use the supplied conversation history for context.

This execution is text-only.
Do not use tools.
Do not modify files.
Do not execute shell commands.
Do not perform external operations.
Return only the response text.`;

/**
 * Builds the canonical prompt for Claude Code CLI strictly from BrainRequest
 * contents (systemPrompt, messages, intent).
 * Does not inspect filesystem, screen, clipboard, or local repository.
 */
export function buildClaudeCodePrompt(request: BrainRequest): string {
  const sections: string[] = [];

  // 1. Core provider instruction
  sections.push(MAVE_CLAUDE_CONVERSATIONAL_INSTRUCTION);

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

