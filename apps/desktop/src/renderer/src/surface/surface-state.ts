import type {
  ConversationRuntimeEvent,
  SurfaceMode,
  ToolApprovalRequest,
  ToolEvent,
  VoiceRuntimeEvent
} from '@mave/contracts';

/**
 * Surface state + Surface Policy (MAVE_AMBIENT_ADAPTIVE_SURFACE.md §9–13).
 * Pure functions so the policy is unit-testable without Electron.
 */

export type VoicePhase = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'error';

export interface SurfaceMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status: 'streaming' | 'done' | 'failed';
  providerId?: string;
}

export interface SurfaceTask {
  callId: string;
  toolId: string;
  summary: string;
  status: 'waiting_approval' | 'running' | 'done' | 'failed';
  lines: string[];
  result?: string;
  startedAt: number;
  endedAt?: number;
}

export type Importance = 'low' | 'medium' | 'high';

export interface SurfaceState {
  voice: VoicePhase;
  partialTranscript: string;
  inputLevel: number;
  outputLevel: number;
  messages: SurfaceMessage[];
  tasks: SurfaceTask[];
  approvals: ToolApprovalRequest[];
  /** User explicitly opened the panel (click / hotkey / typing). */
  open: boolean;
  pinned: boolean;
  lastInteractionAt: number;
  /** Importance of the latest assistant content. */
  lastImportance: Importance;
  sessionId?: string;
  activeRequestId?: string;
  errorText?: string;
}

export const initialSurfaceState = (now = Date.now()): SurfaceState => ({
  voice: 'idle',
  partialTranscript: '',
  inputLevel: 0,
  outputLevel: 0,
  messages: [],
  tasks: [],
  approvals: [],
  open: false,
  pinned: false,
  lastInteractionAt: now,
  lastImportance: 'low'
});

export type SurfaceAction =
  | { type: 'voice'; event: VoiceRuntimeEvent; now: number }
  | { type: 'chat'; event: ConversationRuntimeEvent; now: number }
  | { type: 'tool'; event: ToolEvent; now: number }
  | { type: 'user_sent'; text: string; requestId?: string; now: number }
  | { type: 'open'; now: number }
  | { type: 'close'; now: number }
  | { type: 'toggle'; now: number }
  | { type: 'pin'; pinned: boolean; now: number }
  | { type: 'approval_answered'; callId: string; now: number }
  | { type: 'touch'; now: number }
  | { type: 'clear_tasks' };

const MAX_MESSAGES = 60;
const MAX_TASK_LINES = 8;

export function classifyImportance(text: string): Importance {
  const t = text.trim();
  if (!t) return 'low';
  if (t.includes('```') || t.split('\n').length > 4 || t.length > 280) return 'high';
  if (t.length > 120 || /\n/.test(t)) return 'medium';
  return 'low';
}

export function surfaceReducer(state: SurfaceState, action: SurfaceAction): SurfaceState {
  switch (action.type) {
    case 'open':
      return { ...state, open: true, lastInteractionAt: action.now };
    case 'close':
      return { ...state, open: false, pinned: false, lastInteractionAt: action.now };
    case 'toggle':
      return state.open
        ? { ...state, open: false, pinned: false, lastInteractionAt: action.now }
        : { ...state, open: true, lastInteractionAt: action.now };
    case 'pin':
      return { ...state, pinned: action.pinned, open: action.pinned ? true : state.open, lastInteractionAt: action.now };
    case 'touch':
      return { ...state, lastInteractionAt: action.now };
    case 'clear_tasks':
      return { ...state, tasks: state.tasks.filter((t) => t.status === 'running' || t.status === 'waiting_approval') };
    case 'approval_answered':
      return { ...state, approvals: state.approvals.filter((a) => a.callId !== action.callId), lastInteractionAt: action.now };
    case 'user_sent':
      return {
        ...state,
        open: true,
        lastInteractionAt: action.now,
        messages: trim([...state.messages, { id: `u-${action.now}`, role: 'user', text: action.text, status: 'done' }])
      };
    case 'voice':
      return reduceVoice(state, action.event, action.now);
    case 'chat':
      return reduceChat(state, action.event, action.now);
    case 'tool':
      return reduceTool(state, action.event, action.now);
    default:
      return state;
  }
}

function reduceVoice(state: SurfaceState, event: VoiceRuntimeEvent, now: number): SurfaceState {
  switch (event.type) {
    case 'voice_session_started':
    case 'listening_started':
      return { ...state, voice: 'listening', partialTranscript: '', errorText: undefined, lastInteractionAt: now };
    case 'speech_started':
      return { ...state, voice: 'listening', lastInteractionAt: now };
    case 'partial_transcript':
      return { ...state, voice: 'transcribing', partialTranscript: event.text, lastInteractionAt: now };
    case 'final_transcript':
      return {
        ...state,
        voice: 'thinking',
        partialTranscript: '',
        lastInteractionAt: now,
        messages: trim([...state.messages, { id: `v-${event.timestamp}`, role: 'user', text: event.text, status: 'done' }])
      };
    case 'thinking_started':
      return { ...state, voice: 'thinking', lastInteractionAt: now };
    case 'speaking_started':
      return { ...state, voice: 'speaking', lastInteractionAt: now };
    case 'speaking_finished':
      return { ...state, voice: 'listening', outputLevel: 0, lastInteractionAt: now };
    case 'interrupted':
      return { ...state, voice: 'listening', outputLevel: 0, lastInteractionAt: now };
    case 'audio_level':
      return {
        ...state,
        inputLevel: event.inputLevel ?? state.inputLevel,
        outputLevel: event.outputLevel ?? state.outputLevel
      };
    case 'voice_session_completed':
    case 'voice_session_cancelled':
      return { ...state, voice: 'idle', inputLevel: 0, outputLevel: 0, partialTranscript: '', lastInteractionAt: now };
    case 'voice_session_failed':
      return { ...state, voice: 'error', errorText: event.errorMessage, inputLevel: 0, outputLevel: 0, lastInteractionAt: now };
    default:
      return state;
  }
}

function reduceChat(state: SurfaceState, event: ConversationRuntimeEvent, now: number): SurfaceState {
  switch (event.type) {
    case 'session_ready':
      return { ...state, sessionId: event.sessionId };
    case 'response_started': {
      const exists = state.messages.some((m) => m.id === event.requestId);
      if (exists) return { ...state, activeRequestId: event.requestId };
      return {
        ...state,
        activeRequestId: event.requestId,
        lastInteractionAt: now,
        messages: trim([
          ...state.messages,
          { id: event.requestId, role: 'assistant', text: '', status: 'streaming', providerId: event.providerId }
        ])
      };
    }
    case 'response_delta':
      return {
        ...state,
        lastInteractionAt: now,
        messages: upsertAssistant(state.messages, event.requestId, (m) => ({ ...m, text: m.text + event.text }))
      };
    case 'response_completed': {
      const importance = classifyImportance(event.text);
      return {
        ...state,
        lastInteractionAt: now,
        lastImportance: importance,
        activeRequestId: state.activeRequestId === event.requestId ? undefined : state.activeRequestId,
        messages: upsertAssistant(state.messages, event.requestId, (m) => ({ ...m, text: event.text, status: 'done' }))
      };
    }
    case 'request_failed':
      return {
        ...state,
        lastInteractionAt: now,
        lastImportance: 'medium',
        activeRequestId: undefined,
        messages: upsertAssistant(state.messages, event.requestId, (m) => ({
          ...m,
          text: m.text || event.error.message,
          status: 'failed'
        }))
      };
    case 'request_cancelled':
      return {
        ...state,
        activeRequestId: undefined,
        messages: upsertAssistant(state.messages, event.requestId, (m) => ({ ...m, status: 'done' }))
      };
    default:
      return state;
  }
}

function reduceTool(state: SurfaceState, event: ToolEvent, now: number): SurfaceState {
  switch (event.type) {
    case 'tool_requested':
      return {
        ...state,
        lastInteractionAt: now,
        tasks: upsertTask(state.tasks, event.callId, () => ({
          callId: event.callId,
          toolId: event.toolId,
          summary: event.summary,
          status: 'running',
          lines: [],
          startedAt: now
        }))
      };
    case 'tool_approval_required':
      return {
        ...state,
        lastInteractionAt: now,
        approvals: [...state.approvals.filter((a) => a.callId !== event.callId), event.approval],
        tasks: upsertTask(state.tasks, event.callId, (t) => ({ ...t, status: 'waiting_approval' }))
      };
    case 'tool_started':
      return {
        ...state,
        approvals: state.approvals.filter((a) => a.callId !== event.callId),
        tasks: upsertTask(state.tasks, event.callId, (t) => ({ ...t, status: 'running' }))
      };
    case 'tool_progress':
      return {
        ...state,
        lastInteractionAt: now,
        tasks: upsertTask(state.tasks, event.callId, (t) => ({ ...t, lines: [...t.lines, event.message].slice(-MAX_TASK_LINES) }))
      };
    case 'tool_completed':
      return {
        ...state,
        lastInteractionAt: now,
        tasks: upsertTask(state.tasks, event.callId, (t) => ({
          ...t,
          status: 'done',
          result: event.result.output.slice(0, 2000),
          endedAt: now
        }))
      };
    case 'tool_failed':
      return {
        ...state,
        lastInteractionAt: now,
        approvals: state.approvals.filter((a) => a.callId !== event.callId),
        tasks: upsertTask(state.tasks, event.callId, (t) => ({
          ...t,
          status: 'failed',
          result: event.result.error?.message ?? 'Failed',
          endedAt: now
        }))
      };
    default:
      return state;
  }
}

/** Tools that are "quick" (open app/url) don't need the task workspace. */
const QUICK_TOOLS = new Set(['system.open_url', 'system.web_search', 'system.launch_app', 'system.open_path']);

export interface SurfaceDecision {
  mode: SurfaceMode;
  interactive: boolean;
}

export const AUTO_HIDE_MS: Record<Importance | 'capsule', number> = {
  capsule: 4_000,
  low: 6_000,
  medium: 45_000,
  high: 180_000
};

/** Surface Policy Engine: what should be on screen right now? */
export function decideSurface(state: SurfaceState, now: number): SurfaceDecision {
  const longTaskRunning = state.tasks.some(
    (t) => (t.status === 'running' || t.status === 'waiting_approval') && !QUICK_TOOLS.has(t.toolId)
  );
  // Persistent: approvals and long tasks never auto-hide.
  if (state.approvals.length > 0) return { mode: 'workspace', interactive: true };
  if (longTaskRunning) return { mode: 'workspace', interactive: state.open };
  if (state.pinned || state.open) return { mode: 'panel', interactive: state.open || state.pinned };

  const voiceActive = state.voice !== 'idle' && state.voice !== 'error';
  if (voiceActive) return { mode: 'capsule', interactive: false };

  const idleFor = now - state.lastInteractionAt;
  if (state.voice === 'error' && idleFor < AUTO_HIDE_MS.medium) return { mode: 'capsule', interactive: false };

  const recentTaskFinished = state.tasks.some(
    (t) => t.endedAt !== undefined && !QUICK_TOOLS.has(t.toolId) && now - t.endedAt < AUTO_HIDE_MS.high
  );
  if (recentTaskFinished) return { mode: 'workspace', interactive: false };

  const last = [...state.messages].reverse().find((m) => m.role === 'assistant');
  if (last && last.status !== 'streaming') {
    if (state.lastImportance === 'high' && idleFor < AUTO_HIDE_MS.high) return { mode: 'panel', interactive: false };
    if (state.lastImportance === 'medium' && idleFor < AUTO_HIDE_MS.medium) return { mode: 'card', interactive: false };
    if (idleFor < AUTO_HIDE_MS.low) return { mode: 'capsule', interactive: false };
  }
  if (last?.status === 'streaming') return { mode: 'capsule', interactive: false };
  return { mode: 'orb', interactive: false };
}

function trim(messages: SurfaceMessage[]): SurfaceMessage[] {
  return messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;
}

function upsertAssistant(
  messages: SurfaceMessage[],
  requestId: string,
  update: (m: SurfaceMessage) => SurfaceMessage
): SurfaceMessage[] {
  const idx = messages.findIndex((m) => m.id === requestId);
  if (idx === -1) {
    return trim([...messages, update({ id: requestId, role: 'assistant', text: '', status: 'streaming' })]);
  }
  const next = messages.slice();
  next[idx] = update(next[idx]!);
  return next;
}

function upsertTask(tasks: SurfaceTask[], callId: string, update: (t: SurfaceTask) => SurfaceTask): SurfaceTask[] {
  const idx = tasks.findIndex((t) => t.callId === callId);
  if (idx === -1) {
    const created = update({ callId, toolId: 'unknown', summary: '', status: 'running', lines: [], startedAt: Date.now() });
    return [...tasks, created].slice(-12);
  }
  const next = tasks.slice();
  next[idx] = update(next[idx]!);
  return next;
}
