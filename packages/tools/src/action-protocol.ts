import type { ToolCallRequestInput, ToolDescriptor } from '@mave/contracts';

/**
 * Provider-neutral action protocol.
 *
 * Any brain (Antigravity CLI, OpenAI-compatible, local) can propose actions by
 * writing a fenced block in its normal text answer:
 *
 * ```mave-action
 * {"tool": "system.open_url", "args": {"url": "https://youtube.com"}, "reason": "user asked"}
 * ```
 *
 * The runtime strips these blocks from what is spoken/shown, and sends each one
 * through ToolExecutor as source "brain" (so anything above read-only asks first).
 * Native function-calling can replace this later without changing the executor.
 */

const ACTION_BLOCK = /```mave-action\s*\n([\s\S]*?)```/g;
const MAX_ACTIONS_PER_RESPONSE = 3;

export interface ParsedActions {
  /** Response text with action blocks removed. */
  text: string;
  actions: ToolCallRequestInput[];
  errors: string[];
}

export function parseActionBlocks(responseText: string): ParsedActions {
  const actions: ToolCallRequestInput[] = [];
  const errors: string[] = [];
  const text = responseText.replace(ACTION_BLOCK, (_match, body: string) => {
    try {
      const raw = JSON.parse(body.trim()) as unknown;
      const list = Array.isArray(raw) ? raw : [raw];
      for (const item of list) {
        if (actions.length >= MAX_ACTIONS_PER_RESPONSE) {
          errors.push(`Ignored extra actions (max ${MAX_ACTIONS_PER_RESPONSE} per answer)`);
          break;
        }
        const obj = item as { tool?: unknown; toolId?: unknown; args?: unknown; reason?: unknown };
        const toolId = typeof obj.tool === 'string' ? obj.tool : typeof obj.toolId === 'string' ? obj.toolId : '';
        if (!toolId) {
          errors.push('Action block without a "tool" field');
          continue;
        }
        const args = obj.args && typeof obj.args === 'object' && !Array.isArray(obj.args) ? (obj.args as Record<string, unknown>) : {};
        actions.push({
          toolId,
          args,
          source: 'brain',
          reason: typeof obj.reason === 'string' ? obj.reason.slice(0, 500) : undefined
        });
      }
    } catch (err) {
      errors.push(`Unreadable action block: ${err instanceof Error ? err.message : String(err)}`);
    }
    return '';
  });
  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), actions, errors };
}

/** Removes complete and still-streaming action blocks from partial text (for live display / TTS). */
export function stripActionBlocksForDisplay(partialText: string): string {
  const withoutComplete = partialText.replace(ACTION_BLOCK, '');
  const open = withoutComplete.indexOf('```mave-action');
  return (open >= 0 ? withoutComplete.slice(0, open) : withoutComplete).trimEnd();
}

/** System prompt section that teaches a brain how to request actions. Versioned. */
export const ACTION_PROTOCOL_VERSION = 'mave-action/1';

export function buildToolPromptSection(tools: ToolDescriptor[]): string {
  const lines = tools.map((t) => {
    const args = Object.entries(t.argsHint)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
    return `- ${t.id} — ${t.description}${args ? ` Args: ${args}.` : ''}`;
  });
  return [
    `## Actions (${ACTION_PROTOCOL_VERSION})`,
    'You are MAVE, running on the user\'s own computer. You can ask MAVE\'s runtime to perform actions.',
    'To request an action, add a fenced block exactly like this (JSON, one object or an array of up to 3):',
    '```mave-action',
    '{"tool": "<tool id>", "args": {...}, "reason": "<short why>"}',
    '```',
    'Rules:',
    '- Only use the tools listed below. Never invent tool ids.',
    '- Request an action only when the user clearly asked for it. Otherwise just answer.',
    '- MAVE will ask the user to approve anything beyond reading. Never claim an action is done; say you are starting it.',
    '- Keep the spoken part of your answer short when you request an action.',
    'Available tools:',
    ...lines
  ].join('\n');
}
