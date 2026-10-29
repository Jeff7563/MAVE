import { describe, expect, it } from 'vitest';
import type { ToolApprovalRequest } from '@mave/contracts';
import {
  AUTO_HIDE_MS,
  classifyImportance,
  decideSurface,
  initialSurfaceState,
  surfaceReducer,
  type SurfaceAction,
  type SurfaceState
} from '../src/renderer/src/surface/surface-state';

const T0 = 1_000_000;

function run(actions: SurfaceAction[], start: SurfaceState = initialSurfaceState(T0)): SurfaceState {
  return actions.reduce(surfaceReducer, start);
}

const approval: ToolApprovalRequest = {
  callId: 'c1',
  toolId: 'agent.delegate',
  toolTitle: 'Ask a coding agent',
  riskLevel: 'external_side_effect',
  source: 'brain',
  summary: 'Ask Claude Code to look at C:\\project',
  args: {},
  requestedAt: T0
};

describe('Surface policy', () => {
  it('rests as an orb and never steals focus', () => {
    expect(decideSurface(initialSurfaceState(T0), T0)).toEqual({ mode: 'orb', interactive: false });
  });

  it('shows the voice capsule while listening, thinking and speaking', () => {
    let s = run([{ type: 'voice', event: { type: 'listening_started', sessionId: 'v', timestamp: T0 }, now: T0 }]);
    expect(decideSurface(s, T0)).toEqual({ mode: 'capsule', interactive: false });
    s = run([{ type: 'voice', event: { type: 'final_transcript', sessionId: 'v', text: 'hi', confidence: 0.9, timestamp: T0 }, now: T0 }], s);
    expect(s.voice).toBe('thinking');
    expect(s.messages.at(-1)).toMatchObject({ role: 'user', text: 'hi' });
    s = run([{ type: 'voice', event: { type: 'speaking_started', sessionId: 'v', timestamp: T0 }, now: T0 }], s);
    expect(decideSurface(s, T0).mode).toBe('capsule');
  });

  it('expands to card or panel by importance, then collapses after inactivity', () => {
    const answer = (text: string) =>
      run([
        { type: 'chat', event: { type: 'response_started', requestId: 'r', sessionId: 's', turnId: 't', providerId: 'fast', timestamp: T0 }, now: T0 },
        { type: 'chat', event: { type: 'response_completed', requestId: 'r', sessionId: 's', turnId: 't', text, timestamp: T0 }, now: T0 }
      ]);
    const short = answer('Sure!');
    expect(decideSurface(short, T0).mode).toBe('capsule');
    expect(decideSurface(short, T0 + AUTO_HIDE_MS.low + 1).mode).toBe('orb');

    const medium = answer('awkward = กระอักกระอ่วน. Example: That was awkward, but we laughed about it later and moved on, and everyone felt fine after that.');
    expect(decideSurface(medium, T0 + 1000).mode).toBe('card');
    expect(decideSurface(medium, T0 + AUTO_HIDE_MS.medium + 1).mode).toBe('orb');

    const long = answer('Here is the plan:\n1. a\n2. b\n3. c\n4. d\n```ts\ncode\n```');
    expect(decideSurface(long, T0 + 60_000).mode).toBe('panel');
    expect(decideSurface(long, T0 + AUTO_HIDE_MS.high + 1).mode).toBe('orb');
  });

  it('keeps approvals visible and interactive until answered', () => {
    let s = run([{ type: 'tool', event: { type: 'tool_approval_required', callId: 'c1', toolId: 'agent.delegate', approval, timestamp: T0 }, now: T0 }]);
    expect(decideSurface(s, T0 + 10 * 60_000)).toEqual({ mode: 'workspace', interactive: true });
    s = run([{ type: 'approval_answered', callId: 'c1', now: T0 }], s);
    expect(s.approvals).toEqual([]);
  });

  it('shows the workspace for long tasks but not for quick open actions', () => {
    const quick = run([{ type: 'tool', event: { type: 'tool_requested', callId: 'q', toolId: 'system.open_url', source: 'user', summary: 'Open', timestamp: T0 }, now: T0 }]);
    expect(decideSurface(quick, T0).mode).not.toBe('workspace');

    let long = run([{ type: 'tool', event: { type: 'tool_requested', callId: 'a', toolId: 'agent.delegate', source: 'user', summary: 'Ask Claude', timestamp: T0 }, now: T0 }]);
    long = run([{ type: 'tool', event: { type: 'tool_progress', callId: 'a', toolId: 'agent.delegate', message: 'reading files', timestamp: T0 }, now: T0 }], long);
    expect(decideSurface(long, T0 + 600_000).mode).toBe('workspace');
    expect(long.tasks[0]?.lines).toEqual(['reading files']);
  });

  it('opens interactively on toggle and pin keeps it open', () => {
    let s = run([{ type: 'toggle', now: T0 }]);
    expect(decideSurface(s, T0 + 999_999)).toEqual({ mode: 'panel', interactive: true });
    s = run([{ type: 'toggle', now: T0 }], s);
    expect(decideSurface(s, T0 + 999_999).mode).toBe('orb');
    s = run([{ type: 'pin', pinned: true, now: T0 }], s);
    expect(decideSurface(s, T0 + 999_999).mode).toBe('panel');
    s = run([{ type: 'close', now: T0 }], s);
    expect(s.pinned).toBe(false);
  });

  it('streams assistant deltas into one message', () => {
    const s = run([
      { type: 'user_sent', text: 'เปิดยูทูป', now: T0 },
      { type: 'chat', event: { type: 'response_delta', requestId: 'r', sessionId: 's', turnId: 't', text: 'เปิด ', timestamp: T0 }, now: T0 },
      { type: 'chat', event: { type: 'response_delta', requestId: 'r', sessionId: 's', turnId: 't', text: 'YouTube', timestamp: T0 }, now: T0 }
    ]);
    expect(s.messages.map((m) => [m.role, m.text])).toEqual([
      ['user', 'เปิดยูทูป'],
      ['assistant', 'เปิด YouTube']
    ]);
  });

  it('classifies importance', () => {
    expect(classifyImportance('ok')).toBe('low');
    expect(classifyImportance('x'.repeat(150))).toBe('medium');
    expect(classifyImportance('```js\n1\n```')).toBe('high');
  });
});
