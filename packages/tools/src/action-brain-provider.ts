import type {
  BrainCapabilities,
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ProviderHealth,
  ToolCallRequestInput,
  ToolResult
} from '@mave/contracts';
import { BrainCapabilitiesSchema } from '@mave/contracts';
import type { ToolExecutor } from './executor.js';
import type { QuickCommandMatch } from './quick-commands.js';

export const ACTION_PROVIDER_ID = 'mave-actions';

interface PendingAction {
  match: QuickCommandMatch;
  thai: boolean;
}

/**
 * Runs a matched quick command as if it were a brain answer, so actions flow
 * through the normal ConversationRuntime: sessions, persistence, chat stream,
 * and voice (MAVE speaks "Opening YouTube" / "เปิด YouTube แล้วครับ").
 *
 * The router only selects it when a request explicitly prefers it.
 */
export class ActionBrainProvider implements BrainProvider {
  readonly id = ACTION_PROVIDER_ID;
  private readonly pending = new Map<string, PendingAction>();

  constructor(private readonly executor: ToolExecutor) {}

  /** Queue an action for the next chat() call with this request id. */
  enqueue(requestId: string, match: QuickCommandMatch, originalText: string): void {
    this.pending.set(requestId, { match, thai: containsThai(originalText) });
  }

  hasPending(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  getCapabilities(): BrainCapabilities {
    return BrainCapabilitiesSchema.parse({ streaming: true, fastChat: true, local: true, toolUse: true });
  }

  async health(): Promise<ProviderHealth> {
    return { status: 'healthy', message: 'MAVE action runner', checkedAt: Date.now() };
  }

  async *chat(request: BrainRequest, options?: BrainRequestOptions): AsyncIterable<BrainEvent> {
    const requestId = request.requestId;
    const action = this.pending.get(requestId);
    this.pending.delete(requestId);
    yield { type: 'started', requestId, providerId: this.id, timestamp: Date.now() };
    if (!action) {
      yield {
        type: 'error',
        requestId,
        error: { code: 'provider_invalid_response', message: 'No queued action for this request', retryable: false }
      };
      return;
    }

    const callRequest: ToolCallRequestInput = {
      ...action.match.request,
      callId: action.match.request.callId ?? `act-${requestId}`,
      sessionId: request.sessionId
    };
    const result = await this.executor.call(callRequest, options?.signal);
    if (options?.signal?.aborted || result.error?.code === 'cancelled') {
      yield { type: 'cancelled', requestId, reason: 'Action cancelled' };
      return;
    }
    const text = describeResult(action, result);
    yield { type: 'delta', requestId, text };
    yield { type: 'completed', requestId, text, finishReason: result.ok ? 'action_completed' : 'action_failed' };
  }
}

export function containsThai(text: string): boolean {
  return /[฀-๿]/.test(text);
}

function describeResult(action: PendingAction, result: ToolResult): string {
  const { thai, match } = action;
  if (result.ok) {
    const toolId = match.request.toolId;
    if (toolId === 'agent.delegate' || toolId === 'terminal.run_command' || toolId === 'git.status' || toolId.startsWith('fs.')) {
      const body = result.output.length > 1200 ? `${result.output.slice(0, 1200)}…` : result.output;
      return thai ? `เสร็จแล้วครับ\n${body}` : `Done.\n${body}`;
    }
    return thai ? `${toThaiAck(match.acknowledgement)} แล้วครับ` : `${match.acknowledgement}.`;
  }
  const reason = result.error?.message ?? 'unknown error';
  if (result.error?.code === 'denied') {
    return thai ? 'โอเคครับ ยกเลิกคำสั่งนี้แล้ว' : 'Okay, I won’t do that.';
  }
  return thai ? `ทำไม่สำเร็จครับ: ${reason}` : `I couldn’t do that: ${reason}`;
}

function toThaiAck(ack: string): string {
  return ack
    .replace(/^Opening /, 'เปิด ')
    .replace(/^Searching YouTube for /, 'ค้นหาใน YouTube: ')
    .replace(/^Searching for /, 'ค้นหา ')
    .replace(/^Playing (.+) on YouTube$/, 'เปิดเพลง $1 ใน YouTube')
    .replace(/^Running /, 'รัน ')
    .replace(/^Checking git status$/, 'เช็ค git status')
    .replace(/^Asking /, 'ส่งงานให้ ');
}
