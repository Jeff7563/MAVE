import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { ApprovalScope, SurfaceMode, ToolApprovalRequest } from '@mave/contracts';
import {
  decideSurface,
  initialSurfaceState,
  surfaceReducer,
  type SurfaceMessage,
  type SurfaceState,
  type SurfaceTask,
  type VoicePhase
} from './surface-state';
import './surface.css';

const PHASE_LABEL: Record<VoicePhase, string> = {
  idle: 'Ready',
  listening: 'Listening…',
  transcribing: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'MAVE',
  error: 'Something went wrong'
};

const RISK_LABEL: Record<ToolApprovalRequest['riskLevel'], string> = {
  read_only: 'Read only',
  safe_local: 'Safe local action',
  external_side_effect: 'Changes things outside MAVE',
  destructive: 'Destructive — cannot be undone'
};

export const Surface: React.FC = () => {
  const [state, dispatch] = useReducer(surfaceReducer, undefined, () => initialSurfaceState());
  const [now, setNow] = useState(() => Date.now());
  const appliedMode = useRef<string>('');

  // 1. Runtime subscriptions
  useEffect(() => {
    const api = window.mave;
    if (!api) return undefined;
    const unsubs: Array<() => void> = [];
    if (api.voice) unsubs.push(api.voice.subscribe((event) => dispatch({ type: 'voice', event, now: Date.now() })));
    if (api.chat) unsubs.push(api.chat.onEvent((event) => dispatch({ type: 'chat', event, now: Date.now() })));
    if (api.tools) {
      unsubs.push(api.tools.onEvent((event) => dispatch({ type: 'tool', event, now: Date.now() })));
      void api.tools.list().then((res) => {
        for (const approval of res.pendingApprovals) {
          dispatch({
            type: 'tool',
            event: { type: 'tool_approval_required', callId: approval.callId, toolId: approval.toolId, approval, timestamp: Date.now() },
            now: Date.now()
          });
        }
      }).catch(() => undefined);
    }
    if (api.surface) unsubs.push(api.surface.onToggle(() => dispatch({ type: 'toggle', now: Date.now() })));
    return () => unsubs.forEach((u) => u());
  }, []);

  // 2. Policy clock (auto-hide)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const decision = decideSurface(state, now);

  // 3. Apply window mode through main process
  useEffect(() => {
    const key = `${decision.mode}:${decision.interactive}`;
    if (appliedMode.current === key) return;
    appliedMode.current = key;
    void window.mave?.surface?.setMode(decision.mode, decision.interactive);
  }, [decision.mode, decision.interactive]);

  const open = useCallback(() => dispatch({ type: 'open', now: Date.now() }), []);
  const close = useCallback(() => dispatch({ type: 'close', now: Date.now() }), []);

  // Escape closes the panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className={`surface-root mode-${decision.mode}`} data-testid="surface-root" data-mode={decision.mode}>
      {decision.mode === 'orb' && <Orb phase={state.voice} onClick={open} />}
      {decision.mode === 'capsule' && <Capsule state={state} onClick={open} />}
      {decision.mode === 'card' && <QuickCard state={state} onOpen={open} />}
      {(decision.mode === 'panel' || decision.mode === 'workspace') && (
        <Panel state={state} dispatch={dispatch} mode={decision.mode} onClose={close} />
      )}
    </div>
  );
};

/* ---------- Level 0: Orb ---------- */

const Orb: React.FC<{ phase: VoicePhase; onClick: () => void }> = ({ phase, onClick }) => (
  <button className={`orb phase-${phase}`} onClick={onClick} title="MAVE — click or Ctrl+Alt+M" aria-label="Open MAVE">
    <span className="orb-core" />
  </button>
);

/* ---------- Level 1: Voice Capsule ---------- */

const Capsule: React.FC<{ state: SurfaceState; onClick: () => void }> = ({ state, onClick }) => {
  const level = state.voice === 'speaking' ? state.outputLevel : state.inputLevel;
  const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant');
  const caption =
    state.voice === 'transcribing' && state.partialTranscript
      ? state.partialTranscript
      : (state.voice === 'idle' || state.voice === 'speaking') && lastAssistant?.text
        ? lastAssistant.text
        : state.voice === 'error'
          ? state.errorText ?? PHASE_LABEL.error
          : PHASE_LABEL[state.voice];
  return (
    <button className={`capsule phase-${state.voice}`} onClick={onClick} aria-label="Open MAVE conversation">
      <span className={`orb-mini phase-${state.voice}`} />
      <Waveform level={level} phase={state.voice} />
      <span className="capsule-caption">{caption}</span>
    </button>
  );
};

const BAR_SHAPE = [0.55, 0.85, 1, 0.8, 0.6, 0.9, 0.5];

const Waveform: React.FC<{ level: number; phase: VoicePhase }> = ({ level, phase }) => {
  const active = phase === 'speaking' || phase === 'listening' || phase === 'transcribing';
  return (
    <span className={`waveform phase-${phase}`} aria-hidden="true">
      {BAR_SHAPE.map((shape, i) => {
        const h = active ? 4 + Math.min(1, level * 2.2) * 22 * shape : 4;
        return <span key={i} className="wave-bar" style={{ height: `${h}px`, animationDelay: `${i * 90}ms` }} />;
      })}
    </span>
  );
};

/* ---------- Level 2: Quick Card ---------- */

const QuickCard: React.FC<{ state: SurfaceState; onOpen: () => void }> = ({ state, onOpen }) => {
  const last = [...state.messages].reverse().find((m) => m.role === 'assistant');
  return (
    <div className="quick-card" onClick={onOpen} role="button" tabIndex={0}>
      <div className="quick-card-head">
        <span className={`orb-mini phase-${state.voice}`} />
        <span>MAVE</span>
      </div>
      <div className="quick-card-body">{last?.text}</div>
    </div>
  );
};

/* ---------- Level 3/4: Conversation Panel & Task Workspace ---------- */

const Panel: React.FC<{
  state: SurfaceState;
  mode: SurfaceMode;
  dispatch: React.Dispatch<Parameters<typeof surfaceReducer>[1]>;
  onClose: () => void;
}> = ({ state, mode, dispatch, onClose }) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.messages, state.tasks, state.approvals]);

  useEffect(() => {
    if (state.open) inputRef.current?.focus();
  }, [state.open]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !window.mave?.chat) return;
    setSending(true);
    setDraft('');
    dispatch({ type: 'user_sent', text, now: Date.now() });
    try {
      const res = await window.mave.chat.send({ message: text, sessionId: state.sessionId });
      if (!res.accepted) {
        dispatch({
          type: 'chat',
          event: {
            type: 'request_failed',
            requestId: `local-${Date.now()}`,
            error: { code: res.error.code, message: res.error.message, retryable: false },
            timestamp: Date.now()
          },
          now: Date.now()
        });
      }
    } finally {
      setSending(false);
    }
  };

  const stop = async () => {
    if (state.activeRequestId) await window.mave?.chat?.cancel(state.activeRequestId);
    if (state.voice === 'speaking') await window.mave?.voice?.interrupt('user_surface_stop');
  };

  const answer = async (approval: ToolApprovalRequest, decision: 'allow' | 'deny', scope: ApprovalScope = 'once') => {
    await window.mave?.tools?.respondApproval({ callId: approval.callId, decision, scope });
    dispatch({ type: 'approval_answered', callId: approval.callId, now: Date.now() });
  };

  const visibleTasks = state.tasks.filter((t) => t.toolId !== 'unknown').slice(-6);
  const busy = Boolean(state.activeRequestId) || state.voice === 'speaking';

  return (
    <div className={`panel ${mode === 'workspace' ? 'is-workspace' : ''}`} onMouseDown={() => dispatch({ type: 'touch', now: Date.now() })}>
      <header className="panel-head">
        <span className={`orb-mini phase-${state.voice}`} />
        <div className="panel-title">
          <strong>MAVE</strong>
          <span className="panel-sub">{state.voice === 'idle' ? (mode === 'workspace' ? 'Working on it' : 'Ready') : PHASE_LABEL[state.voice]}</span>
        </div>
        <div className="panel-actions">
          <button
            className={`icon-btn ${state.pinned ? 'is-on' : ''}`}
            onClick={() => dispatch({ type: 'pin', pinned: !state.pinned, now: Date.now() })}
            title={state.pinned ? 'Unpin' : 'Keep open'}
            aria-label="Pin"
          >
            <PinIcon />
          </button>
          <button className="icon-btn" onClick={() => void window.mave?.surface?.openConsole()} title="Developer console" aria-label="Developer console">
            <ConsoleIcon />
          </button>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)" aria-label="Close">
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="panel-body" ref={listRef}>
        {state.messages.length === 0 && visibleTasks.length === 0 && (
          <div className="empty">
            <p className="empty-title">Hey, I'm MAVE.</p>
            <p>Try “เปิดยูทูป”, “open vscode”, “ค้นหา ราคาทอง”, or “ให้ claude ช่วยสรุปโปรเจกต์”.</p>
          </div>
        )}
        {state.messages.map((m) => (
          <MessageRow key={m.id} message={m} />
        ))}
        {visibleTasks.map((t) => (
          <TaskCard key={t.callId} task={t} onCancel={() => void window.mave?.tools?.cancel(t.callId)} />
        ))}
        {state.approvals.map((a) => (
          <ApprovalCard key={a.callId} approval={a} onAnswer={answer} />
        ))}
        {state.partialTranscript && <div className="msg msg-user is-partial">{state.partialTranscript}</div>}
      </div>

      <footer className="panel-input">
        <textarea
          ref={inputRef}
          value={draft}
          rows={1}
          placeholder="Ask MAVE… or tell it to open something"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          data-testid="surface-input"
        />
        {busy ? (
          <button className="send-btn is-stop" onClick={() => void stop()} aria-label="Stop">
            <StopIcon />
          </button>
        ) : (
          <button className="send-btn" onClick={() => void send()} disabled={!draft.trim() || sending} aria-label="Send">
            <SendIcon />
          </button>
        )}
      </footer>
    </div>
  );
};

const MessageRow: React.FC<{ message: SurfaceMessage }> = ({ message }) => (
  <div className={`msg msg-${message.role} ${message.status === 'failed' ? 'is-failed' : ''}`}>
    {message.text || (message.status === 'streaming' ? <TypingDots /> : '')}
    {message.role === 'assistant' && message.providerId && message.status === 'done' && (
      <span className="msg-meta">{message.providerId === 'mave-actions' ? 'action' : message.providerId}</span>
    )}
  </div>
);

const TypingDots: React.FC = () => (
  <span className="typing" aria-label="MAVE is typing">
    <span />
    <span />
    <span />
  </span>
);

const TaskCard: React.FC<{ task: SurfaceTask; onCancel: () => void }> = ({ task, onCancel }) => (
  <div className={`task-card status-${task.status}`}>
    <div className="task-head">
      <span className="task-dot" />
      <span className="task-summary">{task.summary}</span>
      {task.status === 'running' && (
        <button className="text-btn" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
    {task.lines.length > 0 && task.status === 'running' && (
      <pre className="task-lines">{task.lines.join('\n')}</pre>
    )}
    {task.result && task.status !== 'running' && <pre className="task-result">{task.result}</pre>}
  </div>
);

const ApprovalCard: React.FC<{
  approval: ToolApprovalRequest;
  onAnswer: (a: ToolApprovalRequest, d: 'allow' | 'deny', s?: ApprovalScope) => void;
}> = ({ approval, onAnswer }) => (
  <div className={`approval-card risk-${approval.riskLevel}`} data-testid="approval-card">
    <div className="approval-label">{approval.source === 'user' ? 'Confirm' : 'MAVE wants to'}</div>
    <div className="approval-summary">{approval.summary}</div>
    {approval.reason && <div className="approval-reason">Why: {approval.reason}</div>}
    <div className="approval-risk">{RISK_LABEL[approval.riskLevel]}</div>
    <div className="approval-actions">
      <button className="btn btn-primary" onClick={() => onAnswer(approval, 'allow', 'once')}>
        Allow
      </button>
      {approval.riskLevel !== 'destructive' && (
        <button className="btn" onClick={() => onAnswer(approval, 'allow', 'session')}>
          Allow this session
        </button>
      )}
      <button className="btn btn-ghost" onClick={() => onAnswer(approval, 'deny')}>
        Deny
      </button>
    </div>
  </div>
);

/* ---------- Icons (inline SVG, currentColor) ---------- */

const svg = (d: React.ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const PinIcon = () => svg(<><path d="M12 17v5" /><path d="M9 3h6l-1 6 4 4H6l4-4z" /></>);
const ConsoleIcon = () => svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3" /><path d="M13 15h4" /></>);
const CloseIcon = () => svg(<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>);
const SendIcon = () => svg(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>);
const StopIcon = () => svg(<rect x="7" y="7" width="10" height="10" rx="2" />);
