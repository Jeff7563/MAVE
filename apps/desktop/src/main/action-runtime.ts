import { randomUUID } from 'node:crypto';
import type { ConversationRuntimeEvent } from '@mave/contracts';
import {
  ConversationRuntime,
  type ConversationRequest,
  type ConversationRequestOptions,
  type ConversationRuntimeOptions
} from '@mave/core';
import { ACTION_PROVIDER_ID, StreamingActionFilter } from '@mave/tools';
import type { ToolManager } from './tool-manager.js';

/**
 * ConversationRuntime with M5 actions, used by both text chat and voice:
 *
 * 1. Quick commands ("เปิดยูทูป", "open vscode") are routed to the local
 *    action provider — no brain round trip, so they feel instant. This wins
 *    over an explicit brain choice: a typed command is the user's direct ask.
 * 2. Every brain gets the tool list in its system prompt.
 * 3. ```mave-action blocks are hidden from the streamed/spoken text and run
 *    through the ToolExecutor after the answer completes.
 *
 * The underlying runtime (sessions, persistence, cancel, timeouts) is unchanged.
 */
export class ActionAwareConversationRuntime extends ConversationRuntime {
  constructor(
    options: ConversationRuntimeOptions,
    private readonly tools: ToolManager
  ) {
    super({
      ...options,
      systemPromptProvider: (input) => {
        const base = options.systemPromptProvider?.(input);
        return [base, tools.getPromptSection()].filter(Boolean).join('\n\n');
      }
    });
  }

  override async *send(
    request: ConversationRequest,
    options?: ConversationRequestOptions
  ): AsyncIterable<ConversationRuntimeEvent> {
    const match = request.message ? this.tools.matchQuickCommand(request.message) : undefined;
    if (match) {
      const requestId = request.requestId?.trim() || randomUUID();
      this.tools.actionProvider.enqueue(requestId, match, request.message);
      yield* super.send(
        {
          ...request,
          requestId,
          preferredProviderId: ACTION_PROVIDER_ID
        },
        options
      );
      return;
    }

    const filters = new Map<string, StreamingActionFilter>();
    for await (const event of super.send(request, options)) {
      if (event.type === 'response_delta') {
        let filter = filters.get(event.requestId);
        if (!filter) {
          filter = new StreamingActionFilter();
          filters.set(event.requestId, filter);
        }
        const visible = filter.push(event.text);
        if (visible) yield { ...event, text: visible };
        continue;
      }
      if (event.type === 'response_completed') {
        const raw = filters.get(event.requestId)?.rawText ?? event.text;
        filters.delete(event.requestId);
        if (raw.includes('```mave-action')) {
          this.tools.runBrainActions(raw, event.sessionId);
          const visibleText = raw.replace(/```mave-action[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim();
          yield { ...event, text: visibleText };
          continue;
        }
      }
      yield event;
    }
  }
}
