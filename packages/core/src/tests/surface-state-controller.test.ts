import { describe, it, expect, vi } from 'vitest';
import {
  SurfaceStateController,
  type ClockService
} from '../surface/surface-state-controller.js';
import type {
  SurfacePresentationIntent,
  SurfaceAction,
  SurfaceSnapshot
} from '@mave/contracts';

function createMockClock(): ClockService & {
  tick(ms: number): void;
  getTimerCount(): number;
} {
  let currentTime = 1000;
  const timers: Map<number, { cb: () => void; due: number }> = new Map();
  let nextTimerId = 1;

  return {
    now: () => currentTime,
    setTimeout: (cb: () => void, ms: number) => {
      const id = nextTimerId++;
      timers.set(id, { cb, due: currentTime + ms });
      return id;
    },
    clearTimeout: (id: unknown) => {
      timers.delete(id as number);
    },
    tick: (ms: number) => {
      currentTime += ms;
      for (const [id, timer] of Array.from(timers.entries())) {
        if (timer.due <= currentTime) {
          timers.delete(id);
          timer.cb();
        }
      }
    },
    getTimerCount: () => timers.size
  };
}

describe('SurfaceStateController', () => {
  describe('Initial State', () => {
    it('initializes to ambient, passive, preserve, idle', () => {
      const controller = new SurfaceStateController();
      const snapshot = controller.getSnapshot();

      expect(snapshot.version).toBe(1);
      expect(snapshot.mode).toBe('ambient');
      expect(snapshot.visibility).toBe('visible');
      expect(snapshot.sizeClass).toBe('ambient');
      expect(snapshot.interactionMode).toBe('passive');
      expect(snapshot.focusIntent).toBe('preserve');
      expect(snapshot.pinned).toBe(false);
      expect(snapshot.activity).toBe('idle');
      expect(snapshot.inputLevel).toBe(0);
      expect(snapshot.outputLevel).toBe(0);
    });
  });

  describe('Voice Lifecycle & Visual Folding', () => {
    it('transitions through voice lifecycle correctly', () => {
      const controller = new SurfaceStateController();

      // Waking
      let s = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'waking',
        sessionId: 'sess-1'
      });
      expect(s.mode).toBe('listening');
      expect(s.sizeClass).toBe('compact');
      expect(s.activity).toBe('listening');

      // Listening with input level
      s = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'listening',
        inputLevel: 0.65,
        sessionId: 'sess-1'
      });
      expect(s.mode).toBe('listening');
      expect(s.inputLevel).toBe(0.65);

      // Thinking
      s = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'thinking',
        sessionId: 'sess-1'
      });
      expect(s.mode).toBe('thinking');
      expect(s.inputLevel).toBe(0);
      expect(s.activity).toBe('thinking');

      // Speaking with output level
      s = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        outputLevel: 0.82,
        assistantText: 'Hello there',
        sessionId: 'sess-1'
      });
      expect(s.mode).toBe('speaking');
      expect(s.outputLevel).toBe(0.82);
      expect(s.assistantText).toBe('Hello there');
    });

    it('folds transcribing state visually into listening (flicker elimination)', () => {
      const controller = new SurfaceStateController();

      // Move to transcribing
      const s = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'transcribing',
        sessionId: 'sess-1'
      });

      expect(s.mode).toBe('listening'); // Visually folded into listening
      expect(s.sizeClass).toBe('compact');
      expect(s.activity).toBe('listening');
    });

    it('yields immediately on barge-in / interruption without error banner', () => {
      const controller = new SurfaceStateController();

      // Active speaking
      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        outputLevel: 0.9,
        sessionId: 'sess-1'
      });

      // User interrupts
      const interruptedSnapshot = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'interrupted',
        sessionId: 'sess-1'
      });

      expect(interruptedSnapshot.mode).toBe('listening');
      expect(interruptedSnapshot.activity).toBe('listening');
      expect(interruptedSnapshot.outputLevel).toBe(0); // Audio output cleared instantly
      expect(interruptedSnapshot.error).toBeUndefined(); // Never flashes red error text
    });
  });

  describe('Focus Security Invariant (Zero Focus Stealing)', () => {
    it('strictly preserves focus on all passive runtime events', () => {
      const controller = new SurfaceStateController();

      const passiveIntents: SurfacePresentationIntent[] = [
        { type: 'voice_activity', voiceState: 'waking' },
        { type: 'voice_activity', voiceState: 'listening' },
        { type: 'voice_activity', voiceState: 'transcribing' },
        { type: 'voice_activity', voiceState: 'thinking' },
        { type: 'voice_activity', voiceState: 'speaking' },
        { type: 'voice_activity', voiceState: 'interrupted' },
        { type: 'show_response', text: 'Passive answer arrival' },
        {
          type: 'show_confirmation',
          confirmation: {
            id: 'c1',
            type: 'confirmation',
            actionId: 'act-1',
            title: 'Permission Request',
            description: 'Access file system',
            risk: 'medium',
            confirmLabel: 'Approve',
            rejectLabel: 'Deny'
          }
        },
        {
          type: 'show_progress',
          progress: {
            id: 'p1',
            type: 'progress',
            taskId: 't-1',
            label: 'Indexing',
            status: 'running'
          }
        },
        {
          type: 'show_error',
          error: { code: 'E1', message: 'Non-fatal error', severity: 'warning', recoverable: true }
        },
        { type: 'reset_to_ambient', force: true }
      ];

      for (const intent of passiveIntents) {
        const snapshot = controller.applyIntent(intent);
        expect(snapshot.focusIntent).toBe('preserve');
      }
    });

    it('requests focus ONLY on explicit user text interaction', () => {
      const controller = new SurfaceStateController();

      const action: SurfaceAction = {
        type: 'submit_text',
        origin: 'user',
        text: 'Query from user input'
      };

      const snapshot = controller.dispatchAction(action);
      expect(snapshot.focusIntent).toBe('request');
      expect(snapshot.interactionMode).toBe('interactive');
    });

    it('releases focus when dismissed by user', () => {
      const controller = new SurfaceStateController();

      // Put into speaking
      controller.applyIntent({ type: 'voice_activity', voiceState: 'speaking' });

      // Dismiss
      const snapshot = controller.dispatchAction({ type: 'dismiss', origin: 'user' });
      expect(snapshot.mode).toBe('hidden');
      expect(snapshot.visibility).toBe('hidden');
      expect(snapshot.focusIntent).toBe('release');
    });
  });

  describe('Priority Arbitration', () => {
    it('critical error preempts normal voice activity', () => {
      const controller = new SurfaceStateController();

      // Speaking
      controller.applyIntent({ type: 'voice_activity', voiceState: 'speaking' });

      // Critical error
      const s = controller.applyIntent({
        type: 'show_error',
        priority: 'critical',
        source: 'system',
        error: { code: 'FATAL_CORE', message: 'Subsystem crashed', severity: 'error', recoverable: false }
      });

      expect(s.mode).toBe('error');
      expect(s.priority).toBe('critical');

      // Subsequent ordinary voice event cannot displace critical error
      const voiceAttempt = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'listening'
      });
      expect(voiceAttempt.mode).toBe('error');
    });

    it('confirmation modal takes precedence over incoming background progress', () => {
      const controller = new SurfaceStateController();

      // Confirmation active
      controller.applyIntent({
        type: 'show_confirmation',
        priority: 'high',
        source: 'permission',
        confirmation: {
          id: 'cf-1',
          type: 'confirmation',
          actionId: 'act-1',
          title: 'Permission Request',
          description: 'Grant camera access',
          risk: 'medium',
          confirmLabel: 'Approve',
          rejectLabel: 'Deny'
        }
      });

      expect(controller.getSnapshot().mode).toBe('confirmation');

      // Incoming background task progress arrives
      controller.applyIntent({
        type: 'show_progress',
        priority: 'normal',
        source: 'task',
        progress: {
          id: 'pr-1',
          type: 'progress',
          taskId: 't-9',
          label: 'Downloading...',
          status: 'running'
        }
      });

      // Confirmation remains the primary active mode
      expect(controller.getSnapshot().mode).toBe('confirmation');
    });

    it('user dismiss action resolves confirmation and resets to ambient', () => {
      const controller = new SurfaceStateController();

      controller.applyIntent({
        type: 'show_confirmation',
        priority: 'high',
        source: 'permission',
        confirmation: {
          id: 'cf-1',
          type: 'confirmation',
          actionId: 'act-1',
          title: 'Permission Request',
          description: 'Grant camera access',
          risk: 'medium',
          confirmLabel: 'Approve',
          rejectLabel: 'Deny'
        }
      });

      const s = controller.dispatchAction({
        type: 'dismiss',
        origin: 'user'
      });

      expect(s.mode).toBe('hidden');
      expect(s.visibility).toBe('hidden');
      expect(s.focusIntent).toBe('release');
    });
  });

  describe('Pinning & Auto-Collapse Policy', () => {
    it('disables auto-collapse when card is pinned', () => {
      const controller = new SurfaceStateController();

      // Show compact response
      let s = controller.applyIntent({
        type: 'show_response',
        text: 'The weather is pleasant.'
      });

      expect(s.mode).toBe('compact_response');
      expect(s.pinned).toBe(false);
      expect(s.autoCollapse?.enabled).toBe(true);

      // User pins card
      s = controller.dispatchAction({
        type: 'toggle_pin',
        origin: 'user'
      });

      expect(s.pinned).toBe(true);
      expect(s.autoCollapse?.enabled).toBe(false);

      // User unpins card
      s = controller.dispatchAction({
        type: 'toggle_pin',
        origin: 'user'
      });

      expect(s.pinned).toBe(false);
      expect(s.autoCollapse?.enabled).toBe(true);
    });

    it('auto-collapses to ambient on timer expiration when enabled', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      controller.applyIntent({
        type: 'show_response',
        text: 'Quick answer',
        autoCollapseMs: 5000
      });

      expect(controller.getSnapshot().mode).toBe('compact_response');
      expect(clock.getTimerCount()).toBe(1);

      // Fast forward clock by 4000ms -> still compact
      clock.tick(4000);
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // Fast forward past 5000ms -> collapsed to ambient
      clock.tick(1500);
      expect(controller.getSnapshot().mode).toBe('ambient');
      expect(clock.getTimerCount()).toBe(0);
    });

    it('cancels auto-collapse timer if user interacts or new voice turn begins', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      controller.applyIntent({
        type: 'show_response',
        text: 'Quick answer',
        autoCollapseMs: 5000
      });
      expect(clock.getTimerCount()).toBe(1);

      // New voice turn starts
      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'listening'
      });

      // Timer was cancelled and replaced by active listening
      expect(controller.getSnapshot().mode).toBe('listening');

      // Ticking past 5000ms does NOT collapse active listening to ambient
      clock.tick(6000);
      expect(controller.getSnapshot().mode).toBe('listening');
    });
  });

  describe('Subscribers', () => {
    it('notifies subscribers on snapshot changes and respects unsubscription', () => {
      const controller = new SurfaceStateController();
      const listener = vi.fn();

      const unsubscribe = controller.subscribe(listener);

      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'waking'
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const firstArg = listener.mock.calls[0]![0] as SurfaceSnapshot;
      expect(firstArg.mode).toBe('listening');

      unsubscribe();

      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'sleeping'
      });

      expect(listener).toHaveBeenCalledTimes(1); // not called again
    });
  });

  describe('Voice-Reactive Telemetry & Mode Source Switching', () => {
    it('updates inputLevel during listening without changing mode or flapping', () => {
      const controller = new SurfaceStateController();
      controller.applyIntent({ type: 'voice_activity', voiceState: 'listening' });
      expect(controller.getSnapshot().mode).toBe('listening');
      expect(controller.getSnapshot().inputLevel).toBe(0);

      const snap1 = controller.applyIntent({
        type: 'voice_activity',
        inputLevel: 0.42
      });
      expect(snap1.mode).toBe('listening');
      expect(snap1.inputLevel).toBe(0.42);
      expect(snap1.outputLevel).toBe(0);

      // Dropping back to silence does not exit listening
      const snap2 = controller.applyIntent({
        type: 'voice_activity',
        inputLevel: 0
      });
      expect(snap2.mode).toBe('listening');
      expect(snap2.inputLevel).toBe(0);
    });

    it('updates outputLevel during speaking without changing mode or flapping', () => {
      const controller = new SurfaceStateController();
      controller.applyIntent({ type: 'voice_activity', voiceState: 'speaking' });
      expect(controller.getSnapshot().mode).toBe('speaking');
      expect(controller.getSnapshot().outputLevel).toBe(0);

      const snap1 = controller.applyIntent({
        type: 'voice_activity',
        outputLevel: 0.78
      });
      expect(snap1.mode).toBe('speaking');
      expect(snap1.outputLevel).toBe(0.78);
      expect(snap1.inputLevel).toBe(0);

      // Natural speech silence gap (outputLevel = 0) relaxes mark without exiting speaking
      const snap2 = controller.applyIntent({
        type: 'voice_activity',
        outputLevel: 0
      });
      expect(snap2.mode).toBe('speaking');
      expect(snap2.outputLevel).toBe(0);
      expect(snap2.inputLevel).toBe(0);
    });

    it('ignores audio telemetry in ambient, thinking, and error modes', () => {
      const controller = new SurfaceStateController();
      expect(controller.getSnapshot().mode).toBe('ambient');

      // Telemetry in ambient is ignored
      const snapAmbient = controller.applyIntent({
        type: 'voice_activity',
        inputLevel: 0.5,
        outputLevel: 0.5
      });
      expect(snapAmbient.mode).toBe('ambient');
      expect(snapAmbient.inputLevel).toBe(0);
      expect(snapAmbient.outputLevel).toBe(0);

      // Thinking mode ignores audio telemetry
      controller.applyIntent({ type: 'voice_activity', voiceState: 'thinking' });
      expect(controller.getSnapshot().mode).toBe('thinking');
      const snapThinking = controller.applyIntent({
        type: 'voice_activity',
        inputLevel: 0.6,
        outputLevel: 0.6
      });
      expect(snapThinking.mode).toBe('thinking');
      expect(snapThinking.inputLevel).toBe(0);
      expect(snapThinking.outputLevel).toBe(0);

      // Error mode ignores audio telemetry
      controller.applyIntent({ type: 'voice_activity', voiceState: 'error' });
      expect(controller.getSnapshot().mode).toBe('error');
      const snapError = controller.applyIntent({
        type: 'voice_activity',
        inputLevel: 0.7,
        outputLevel: 0.7
      });
      expect(snapError.mode).toBe('error');
      expect(snapError.inputLevel).toBe(0);
      expect(snapError.outputLevel).toBe(0);
    });

    it('mode switch cleanses previous opposite level and prevents stale bleed', () => {
      const controller = new SurfaceStateController();

      // Listening with input=0.85
      controller.applyIntent({ type: 'voice_activity', voiceState: 'listening' });
      controller.applyIntent({ type: 'voice_activity', inputLevel: 0.85 });
      expect(controller.getSnapshot().inputLevel).toBe(0.85);

      // Transition to speaking -> inputLevel is immediately 0, outputLevel starts at 0
      const snapSpeaking = controller.applyIntent({ type: 'voice_activity', voiceState: 'speaking' });
      expect(snapSpeaking.mode).toBe('speaking');
      expect(snapSpeaking.inputLevel).toBe(0);
      expect(snapSpeaking.outputLevel).toBe(0);

      // Now speaking plays audio
      controller.applyIntent({ type: 'voice_activity', outputLevel: 0.65 });
      expect(controller.getSnapshot().outputLevel).toBe(0.65);

      // Interrupted yields to listening -> outputLevel is immediately 0
      const snapInterrupted = controller.applyIntent({ type: 'voice_activity', voiceState: 'interrupted' });
      expect(snapInterrupted.mode).toBe('listening');
      expect(snapInterrupted.outputLevel).toBe(0);
      expect(snapInterrupted.inputLevel).toBe(0);
    });
  });
});
