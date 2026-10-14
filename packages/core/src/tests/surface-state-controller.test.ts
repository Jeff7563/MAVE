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

  describe('M4.5 Adaptive Envelope & Pinned Footprint Preservation', () => {
    it('preserves expanded sizeClass when pinned during full voice lifecycle', () => {
      const controller = new SurfaceStateController();

      // Show response that classifies as expanded
      controller.applyIntent({
        type: 'show_response',
        text: 'Here is the implementation:\n```ts\nexport function example() { return 42; }\n```'
      });
      expect(controller.getSnapshot().sizeClass).toBe('expanded');

      // Pin the surface
      controller.dispatchAction({ type: 'toggle_pin', origin: 'user', pinned: true });
      expect(controller.getSnapshot().pinned).toBe(true);
      expect(controller.getSnapshot().sizeClass).toBe('expanded');

      // Voice enters listening -> mode updates, but sizeClass remains expanded!
      const snapListen = controller.applyIntent({ type: 'voice_activity', voiceState: 'listening' });
      expect(snapListen.mode).toBe('listening');
      expect(snapListen.sizeClass).toBe('expanded');
      expect(snapListen.pinned).toBe(true);

      // Voice enters thinking
      const snapThink = controller.applyIntent({ type: 'voice_activity', voiceState: 'thinking' });
      expect(snapThink.mode).toBe('thinking');
      expect(snapThink.sizeClass).toBe('expanded');

      // Voice enters speaking
      const snapSpeak = controller.applyIntent({ type: 'voice_activity', voiceState: 'speaking' });
      expect(snapSpeak.mode).toBe('speaking');
      expect(snapSpeak.sizeClass).toBe('expanded');

      // Barge-in interrupted
      const snapInterrupt = controller.applyIntent({ type: 'voice_activity', voiceState: 'interrupted' });
      expect(snapInterrupt.mode).toBe('listening');
      expect(snapInterrupt.sizeClass).toBe('expanded');

      // Sleep
      const snapSleep = controller.applyIntent({ type: 'voice_activity', voiceState: 'sleeping' });
      expect(snapSleep.mode).toBe('ambient');
      expect(snapSleep.sizeClass).toBe('expanded');
      expect(snapSleep.pinned).toBe(true);
    });

    it('supports sequential user expand and collapse actions across sizes', () => {
      const controller = new SurfaceStateController();
      expect(controller.getSnapshot().sizeClass).toBe('ambient');

      // Expand from ambient -> card
      const snap1 = controller.dispatchAction({ type: 'expand', origin: 'user' });
      expect(snap1.sizeClass).toBe('card');

      // Expand from card -> expanded
      const snap2 = controller.dispatchAction({ type: 'expand', origin: 'user' });
      expect(snap2.sizeClass).toBe('expanded');

      // Collapse from expanded -> card
      const snap3 = controller.dispatchAction({ type: 'collapse', origin: 'user' });
      expect(snap3.sizeClass).toBe('card');

      // Collapse from card -> compact
      const snap4 = controller.dispatchAction({ type: 'collapse', origin: 'user' });
      expect(snap4.sizeClass).toBe('compact');
    });

    it('allows user expand and collapse while pinned without unpinning', () => {
      const controller = new SurfaceStateController();
      controller.dispatchAction({ type: 'toggle_pin', origin: 'user', pinned: true });
      expect(controller.getSnapshot().pinned).toBe(true);

      // Expand to card
      const snap1 = controller.dispatchAction({ type: 'expand', origin: 'user' });
      expect(snap1.sizeClass).toBe('card');
      expect(snap1.pinned).toBe(true);

      // Expand to expanded
      const snap2 = controller.dispatchAction({ type: 'expand', origin: 'user' });
      expect(snap2.sizeClass).toBe('expanded');
      expect(snap2.pinned).toBe(true);

      // Collapse to card
      const snap3 = controller.dispatchAction({ type: 'collapse', origin: 'user' });
      expect(snap3.sizeClass).toBe('card');
      expect(snap3.pinned).toBe(true);
    });
  });

  describe('Milestone 4.6 — Compact Response Surface & Auto-Collapse', () => {
    it('Pre-flight audit: interrupted yields immediately to listening with zero error/flash', () => {
      const controller = new SurfaceStateController();
      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        assistantText: 'I am speaking right now',
        outputLevel: 0.8
      });
      expect(controller.getSnapshot().mode).toBe('speaking');

      // User interrupts
      const snap = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'interrupted'
      });

      expect(snap.mode).toBe('listening');
      expect(snap.activity).toBe('listening');
      expect(snap.outputLevel).toBe(0);
      expect(snap.error).toBeUndefined();
      expect(snap.assistantText).toBeUndefined();
    });

    it('progressive text expands capsule to card envelope when speakable threshold is reached', () => {
      const controller = new SurfaceStateController();
      // Single character or empty text remains compact
      const snap1 = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        assistantText: 'I'
      });
      expect(snap1.mode).toBe('speaking');
      expect(snap1.sizeClass).toBe('compact');

      // Speakable phrase (>= 4 chars) morphs envelope to card
      const snap2 = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        assistantText: "I'm exhausted today."
      });
      expect(snap2.mode).toBe('speaking');
      expect(snap2.sizeClass).toBe('card');
      expect(snap2.assistantText).toBe("I'm exhausted today.");
    });

    it('completing speech transitions to compact_response with 30-second hold timer', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        assistantText: "I'm exhausted today."
      });

      // TTS audio finishes
      const snap = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        isSpeakingFinished: true
      });

      expect(snap.mode).toBe('compact_response');
      expect(snap.sizeClass).toBe('card');
      expect(snap.activity).toBe('idle');
      expect(snap.autoCollapse).toEqual({
        enabled: true,
        afterMs: 30000,
        targetMode: 'ambient'
      });

      // Response hold is preserved when voice session terminates to sleeping
      const sleepSnap = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'sleeping'
      });
      expect(sleepSnap.mode).toBe('compact_response');
      expect(sleepSnap.sizeClass).toBe('card');

      // Advancing clock past 30 seconds triggers auto-collapse to ambient
      clock.tick(30000);
      const afterSnap = controller.getSnapshot();
      expect(afterSnap.mode).toBe('ambient');
      expect(afterSnap.sizeClass).toBe('ambient');
      // Privacy invariant: ephemeral text cleared on collapse
      expect(afterSnap.assistantText).toBeUndefined();
      expect(afterSnap.content).toBeUndefined();
    });

    it('hover pauses auto-collapse and unhover restarts 30-second inactivity timer', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        assistantText: 'Response text to read',
        isSpeakingFinished: true
      });
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // User moves mouse over visible response card
      controller.setUserHovering(true);

      // Advance clock past 35s - card must NOT collapse while reading!
      clock.tick(35000);
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // User moves mouse away - restarts 30s timer
      controller.setUserHovering(false);
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // Advance clock 20s - still visible
      clock.tick(20000);
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // Advance remaining 10s - collapses
      clock.tick(10000);
      expect(controller.getSnapshot().mode).toBe('ambient');
    });

    it('pin cancels auto-collapse timer, unpin restarts it safely', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        assistantText: 'Response text',
        isSpeakingFinished: true
      });
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // User pins the card
      const pinSnap = controller.dispatchAction({ type: 'toggle_pin', origin: 'user', pinned: true });
      expect(pinSnap.pinned).toBe(true);
      expect(pinSnap.autoCollapse?.enabled).toBe(false);

      // Advance time by 2 minutes - card remains visible
      clock.tick(120000);
      expect(controller.getSnapshot().mode).toBe('compact_response');
      expect(controller.getSnapshot().pinned).toBe(true);

      // User unpins
      const unpinSnap = controller.dispatchAction({ type: 'toggle_pin', origin: 'user', pinned: false });
      expect(unpinSnap.pinned).toBe(false);
      expect(unpinSnap.autoCollapse?.enabled).toBe(true);

      // Advance 30s - collapses cleanly
      clock.tick(30000);
      expect(controller.getSnapshot().mode).toBe('ambient');
    });

    it('stale timer protection: expanding supersedes old compact timer', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        assistantText: 'Short response',
        isSpeakingFinished: true
      });
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // User expands card after 10s
      clock.tick(10000);
      const expandSnap = controller.dispatchAction({ type: 'expand', origin: 'user' });
      expect(expandSnap.mode).toBe('expanded_response');
      expect(expandSnap.sizeClass).toBe('expanded');

      // Advance clock past initial 30s mark (another 25s = total 35s from start)
      clock.tick(25000);
      // Stale timer must NOT have collapsed expanded panel
      expect(controller.getSnapshot().mode).toBe('expanded_response');
      expect(controller.getSnapshot().sizeClass).toBe('expanded');
    });

    it('dismiss cancels timer, clears ephemeral response, and hides window', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        assistantText: 'Response text',
        isSpeakingFinished: true
      });

      const dismissSnap = controller.dispatchAction({ type: 'dismiss', origin: 'user' });
      expect(dismissSnap.mode).toBe('hidden');
      expect(dismissSnap.visibility).toBe('hidden');
      expect(dismissSnap.assistantText).toBeUndefined();

      // Advancing clock past 30s does not re-awaken or mutate
      clock.tick(35000);
      expect(controller.getSnapshot().mode).toBe('hidden');
    });

    it('short status block uses short 3-second auto-collapse timer', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      controller.applyIntent({
        type: 'show_response',
        blocks: [{ id: 'stat-1', type: 'status', label: 'Timer set', status: 'success' }]
      });

      expect(controller.getSnapshot().mode).toBe('compact_response');
      expect(controller.getSnapshot().sizeClass).toBe('card');

      // After 3 seconds, short status auto-collapses
      clock.tick(3000);
      expect(controller.getSnapshot().mode).toBe('ambient');
    });

    it('text-only show_response intent displays identical compact card with 30s hold', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      const snap = controller.applyIntent({
        type: 'show_response',
        text: 'Milestone 4 — Ambient Adaptive Surface',
        source: 'conversation'
      });

      expect(snap.mode).toBe('compact_response');
      expect(snap.sizeClass).toBe('card');
      expect(snap.assistantText).toBe('Milestone 4 — Ambient Adaptive Surface');
      expect(snap.autoCollapse?.afterMs).toBe(30000);

      clock.tick(30000);
      expect(controller.getSnapshot().mode).toBe('ambient');
    });

    it('semantics-first: 80-char code block expands immediately', () => {
      const controller = new SurfaceStateController();
      const codeSnippet = '```ts\nconst x = 42;\nconsole.log(x);\n```';
      expect(codeSnippet.length).toBeLessThan(100);

      const snap = controller.applyIntent({
        type: 'show_response',
        text: codeSnippet
      });

      expect(snap.mode).toBe('expanded_response');
      expect(snap.sizeClass).toBe('expanded');
    });

    it('semantics-first: 180-char markdown table expands immediately', () => {
      const controller = new SurfaceStateController();
      const tableMarkdown = '| Feature | Status |\n|---|---|\n| Wake | Done |\n| STT | Done |\n| TTS | Done |\n';
      expect(tableMarkdown.length).toBeLessThan(200);

      const snap = controller.applyIntent({
        type: 'show_response',
        text: tableMarkdown
      });

      expect(snap.mode).toBe('expanded_response');
      expect(snap.sizeClass).toBe('expanded');
    });

    it('semantics-first: 320-char plain conversational paragraph stays in compact card', () => {
      const controller = new SurfaceStateController();
      // 320 characters of plain natural prose without markdown fences or lists
      const longProse = 'In Milestone 4 we focus on the MAVE ambient surface architecture, ensuring that short conversational responses remain cleanly legible within the compact desktop card envelope while preserving strictly anchored bottom-right geometry, zero keyboard focus stealing, and fluid hardware-accelerated transitions.';
      expect(longProse.length).toBeGreaterThan(300);
      expect(longProse.length).toBeLessThan(380);

      const snap = controller.applyIntent({
        type: 'show_response',
        text: longProse
      });

      expect(snap.mode).toBe('compact_response');
      expect(snap.sizeClass).toBe('card');
    });

    it('semantics-first: confirmation mode is preserved regardless of text length', () => {
      const controller = new SurfaceStateController();
      const longDesc = 'A'.repeat(500);

      const snap = controller.applyIntent({
        type: 'show_confirmation',
        confirmation: {
          id: 'conf-1',
          type: 'confirmation',
          actionId: 'exec-1',
          title: 'Execute Command',
          description: longDesc,
          risk: 'high',
          confirmLabel: 'Approve',
          rejectLabel: 'Deny'
        }
      });

      expect(snap.mode).toBe('confirmation');
      expect(snap.sizeClass).toBe('card');
    });

    it('user_activity action resets auto-collapse countdown without modifying other state', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        assistantText: 'Test response',
        isSpeakingFinished: true
      });

      expect(controller.getSnapshot().mode).toBe('compact_response');

      // Advance 20 seconds
      clock.tick(20000);
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // User scrolls / interacts -> emits user_activity
      controller.dispatchAction({ type: 'user_activity', origin: 'user' });

      // Advance another 20 seconds (total 40s from start, but only 20s from reset)
      clock.tick(20000);
      // Still compact_response because timer was reset!
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // Advance remaining 10 seconds (total 30s from reset)
      clock.tick(10000);
      // Now auto-collapses to ambient
      expect(controller.getSnapshot().mode).toBe('ambient');
    });

    it('expanded response uses canonical 120-second auto-collapse timeout', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      const snap = controller.applyIntent({
        type: 'show_response',
        text: '```ts\nconst x = 1;\n```'
      });

      expect(snap.mode).toBe('expanded_response');
      expect(snap.sizeClass).toBe('expanded');
      expect(snap.autoCollapse?.afterMs).toBe(120000);

      // Advance 60s -> still expanded
      clock.tick(60000);
      expect(controller.getSnapshot().mode).toBe('expanded_response');

      // Advance another 60s -> 120s total -> auto-collapses to ambient
      clock.tick(60000);
      expect(controller.getSnapshot().mode).toBe('ambient');
    });
  });

  describe('M4.8 Interaction, Focus Lifecycle & User-Origin Security', () => {
    it('grants focusIntent: request only for user-origin request_focus', () => {
      const controller = new SurfaceStateController();

      // System origin spoof attempt -> rejected
      const spoofed = controller.dispatchAction({
        type: 'request_focus',
        origin: 'system' as any
      });
      expect(spoofed.focusIntent).toBe('preserve');

      // Valid user-origin action -> granted
      const granted = controller.dispatchAction({
        type: 'request_focus',
        origin: 'user'
      });
      expect(granted.focusIntent).toBe('request');
      expect(granted.interactionMode).toBe('interactive');
    });

    it('releases focus safely on release_focus action', () => {
      const controller = new SurfaceStateController();

      // Acquire focus
      controller.dispatchAction({ type: 'request_focus', origin: 'user' });
      expect(controller.getSnapshot().focusIntent).toBe('request');

      // Release focus
      const released = controller.dispatchAction({ type: 'release_focus', origin: 'user' });
      expect(released.focusIntent).toBe('release');
    });

    it('enforces hard invariant: pin does not equal focus', () => {
      const controller = new SurfaceStateController();

      // Pinning does NOT grant focus
      const pinned = controller.dispatchAction({ type: 'toggle_pin', origin: 'user' });
      expect(pinned.pinned).toBe(true);
      expect(pinned.focusIntent).toBe('preserve');

      // Requesting focus does NOT pin
      const focused = controller.dispatchAction({ type: 'request_focus', origin: 'user' });
      expect(focused.focusIntent).toBe('request');
      // Unpinning preserves focus state
      const unpinned = controller.dispatchAction({ type: 'toggle_pin', origin: 'user', pinned: false });
      expect(unpinned.pinned).toBe(false);
      expect(unpinned.focusIntent).toBe('preserve');
    });

    it('preserves intentional user focus when runtime updates arrive', () => {
      const controller = new SurfaceStateController();

      // User intentionally focuses Surface
      controller.dispatchAction({ type: 'request_focus', origin: 'user' });
      expect(controller.getSnapshot().focusIntent).toBe('request');

      // Audio telemetry arrives while speaking
      const speakingSnap = controller.applyIntent({
        type: 'voice_activity',
        voiceState: 'speaking',
        assistantText: 'Continuing speech...',
        outputLevel: 0.7
      });
      // Focus MUST be preserved
      expect(speakingSnap.focusIntent).toBe('request');

      // Show response streaming chunk arrives
      const responseSnap = controller.applyIntent({
        type: 'show_response',
        text: 'Streamed chunk'
      });
      // Focus MUST be preserved
      expect(responseSnap.focusIntent).toBe('request');
    });

    it('releases focus when collapsing expanded panel', () => {
      const controller = new SurfaceStateController();

      // Expand and focus
      controller.dispatchAction({ type: 'expand', origin: 'user' });
      controller.dispatchAction({ type: 'request_focus', origin: 'user' });
      expect(controller.getSnapshot().focusIntent).toBe('request');

      // Collapse
      const collapsed = controller.dispatchAction({ type: 'collapse', origin: 'user' });
      expect(collapsed.focusIntent).toBe('release');
    });

    it('pauses auto-collapse while surface is focused', () => {
      const clock = createMockClock();
      const controller = new SurfaceStateController({ clock, enableTimers: true });

      controller.applyIntent({
        type: 'show_response',
        text: 'Short response text'
      });
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // Advance 15s (halfway through 30s timeout)
      clock.tick(15000);
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // User focuses Surface
      controller.dispatchAction({ type: 'request_focus', origin: 'user' });

      // Advance another 20s (past original 30s timeout)
      clock.tick(20000);
      // Still in compact_response because user is focused!
      expect(controller.getSnapshot().mode).toBe('compact_response');

      // User releases focus
      controller.dispatchAction({ type: 'release_focus', origin: 'user' });

      // After release, 30s timeout runs
      clock.tick(29000);
      expect(controller.getSnapshot().mode).toBe('compact_response');
      clock.tick(2000);
      expect(controller.getSnapshot().mode).toBe('ambient');
    });

    it('updates preferredDisplayId in snapshot upon set_preferred_display action', () => {
      const controller = new SurfaceStateController();
      expect(controller.getSnapshot().preferredDisplayId).toBeUndefined();

      // Set display 2
      const updated = controller.dispatchAction({
        type: 'set_preferred_display',
        origin: 'user',
        displayId: 2
      });
      expect(updated.preferredDisplayId).toBe(2);
      expect(controller.getSnapshot().preferredDisplayId).toBe(2);

      // Clear preference
      const cleared = controller.dispatchAction({
        type: 'set_preferred_display',
        origin: 'user',
        displayId: null
      });
      expect(cleared.preferredDisplayId).toBeNull();
      expect(controller.getSnapshot().preferredDisplayId).toBeNull();
    });
  });
});

