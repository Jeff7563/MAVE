import type {
  AudioInputProvider,
  AudioOutput,
  STTProvider,
  TTSProvider,
  VoiceDiagnosticState,
  VoiceRuntimeEvent,
  VoiceStatusSnapshot
} from '@mave/contracts';
import {
  VoiceSessionCoordinator,
  type MaveService,
  type ConversationRuntime
} from '@mave/core';
import {
  MockAudioInputProvider,
  MockAudioOutput,
  MockSTTProvider,
  MockTTSProvider
} from '@mave/providers';
import { createLogger } from '@mave/shared';
import type { WakeManager } from './wake-manager.js';

const logger = createLogger({ name: 'mave:voice-manager' });

export type MicOwnership = 'wake' | 'voice' | 'none';

export type VoiceManagerState =
  | 'idle'
  | 'handoff_to_voice'
  | 'voice_active'
  | 'handoff_to_wake'
  | 'disposed';

export interface VoiceManagerOptions {
  service: MaveService;
  wakeManager: WakeManager;
  voiceCoordinator?: VoiceSessionCoordinator;
  audioInput?: AudioInputProvider;
  stt?: STTProvider;
  tts?: TTSProvider;
  audioOutput?: AudioOutput;
  conversationRuntime?: ConversationRuntime;
  rearmGuardMs?: number;
  settleGuardMs?: number;
  sessionTimeoutMs?: number;
  telemetryThrottleMs?: number;
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onOwnershipChange?: (ownership: MicOwnership) => void;
  onVoiceRuntimeEvent?: (event: VoiceRuntimeEvent) => void;
  onStateChange?: (state: VoiceManagerState) => void;
  prewarmHook?: () => Promise<void>;
}

export class VoiceManager {
  private readonly service: MaveService;
  private readonly wakeManager: WakeManager;
  private readonly voiceCoordinator: VoiceSessionCoordinator;
  private readonly ownsVoiceCoordinator: boolean;
  private readonly rearmGuardMs: number;
  private readonly settleGuardMs: number;
  private readonly sessionTimeoutMs: number;
  private readonly telemetryThrottleMs: number;
  private readonly clock: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly options: VoiceManagerOptions;

  private micOwnership: MicOwnership = 'none';
  private state: VoiceManagerState = 'idle';
  private wakeEpoch = 0;
  private duplicateWakeCount = 0;
  private isHandlingHandoff = false;
  private activeVoiceSessionActive = false;
  private isRearming = false;
  private isDisposed = false;
  private unsubscribeService?: () => void;

  private lastLevelEmitTime = 0;
  private pendingLevelEvent: VoiceRuntimeEvent | null = null;
  private levelThrottleTimer: NodeJS.Timeout | null = null;
  private readonly voiceEventListeners = new Set<(event: VoiceRuntimeEvent) => void>();

  private currentSessionId?: string;
  private currentTurnIndex = 0;
  private lastTranscript?: { text: string; isFinal: boolean; confidence?: number; language?: string };
  private assistantText?: string;
  private lastError?: { code: string; message: string };
  private inputLevel = 0;
  private outputLevel = 0;

  private activeOperationPromise: Promise<void> = Promise.resolve();

  constructor(options: VoiceManagerOptions) {
    this.options = options;
    this.service = options.service;
    this.wakeManager = options.wakeManager;
    this.rearmGuardMs = options.rearmGuardMs ?? 300;
    this.settleGuardMs = options.settleGuardMs ?? 0;
    this.sessionTimeoutMs = options.sessionTimeoutMs ?? 15000;
    this.telemetryThrottleMs = options.telemetryThrottleMs ?? 50;
    this.clock = options.clock ?? (() => Date.now());
    this.sleep =
      options.sleep ??
      ((ms: number) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        }));

    if (options.voiceCoordinator) {
      this.voiceCoordinator = options.voiceCoordinator;
      this.ownsVoiceCoordinator = false;
    } else {
      if (!options.conversationRuntime) {
        throw new Error(
          'VoiceManager requires either a voiceCoordinator or conversationRuntime option'
        );
      }
      const audioInput = options.audioInput ?? new MockAudioInputProvider();
      const stt = options.stt ?? new MockSTTProvider();
      const tts = options.tts ?? new MockTTSProvider();
      const audioOutput = options.audioOutput ?? new MockAudioOutput();

      this.voiceCoordinator = new VoiceSessionCoordinator({
        audioInput,
        stt,
        tts,
        audioOutput,
        conversationRuntime: options.conversationRuntime,
        clock: this.clock
      });
      this.ownsVoiceCoordinator = true;
    }
  }

  async start(): Promise<void> {
    if (this.isDisposed) {
      throw new Error('Cannot start disposed VoiceManager');
    }

    logger.info('starting VoiceManager lifecycle orchestrator');

    // Hook WakeManager to route wake detections through this manager
    this.wakeManager.setWakeHandler(() => this.handleWakeDetected());

    // Initialize initial mic ownership based on wake engine state
    const snapshot = this.service.getSnapshot();
    if (snapshot.state === 'sleeping' && !snapshot.isMuted) {
      if (this.wakeManager.isListening()) {
        this.setOwnership('wake');
      } else {
        try {
          await this.wakeManager.start(false);
          this.setOwnership('wake');
        } catch (err) {
          logger.warn({ err }, 'failed initial wake start in VoiceManager');
          this.setOwnership('none');
        }
      }
    } else {
      this.setOwnership('none');
    }

    // Subscribe to state machine transitions to handle APP_READY (starting -> sleeping) and TOGGLE_MUTE
    this.unsubscribeService = this.service.subscribe(async (currentSnapshot) => {
      if (this.isDisposed) return;

      if (currentSnapshot.state === 'sleeping' && !currentSnapshot.isMuted) {
        if (
          !this.activeVoiceSessionActive &&
          !this.isHandlingHandoff &&
          !this.isRearming &&
          !this.wakeManager.isListening()
        ) {
          try {
            await this.wakeManager.start(false);
            this.setOwnership('wake');
          } catch (err) {
            logger.warn({ err }, 'failed to start wake capture on sleeping state in VoiceManager');
          }
        }
      } else if (currentSnapshot.isMuted || currentSnapshot.state === 'muted') {
        if (this.wakeManager.isListening()) {
          try {
            await this.wakeManager.stop();
          } catch {}
          this.setOwnership('none');
        }
      }
    });

    this.setState('idle');
  }

  /**
   * Main orchestrator for Wake -> Voice handoff and subsequent Voice -> Wake rearm.
   * Ensures zero microphone overlap invariant and deterministic handoffs.
   */
  async handleWakeDetected(): Promise<void> {
    if (this.isDisposed) {
      logger.warn('ignoring wake event: VoiceManager is disposed');
      return;
    }

    // Reentrancy and state guard:
    // If handoff is running, voice session is active, or rearming is in progress:
    if (this.isHandlingHandoff || this.activeVoiceSessionActive || this.isRearming) {
      logger.warn(
        {
          isHandlingHandoff: this.isHandlingHandoff,
          activeVoiceSessionActive: this.activeVoiceSessionActive,
          isRearming: this.isRearming
        },
        'ignoring wake event: handoff, voice session, or rearm already active'
      );
      this.duplicateWakeCount++;
      return;
    }

    const snapshot = this.service.getSnapshot();
    if (snapshot.isMuted) {
      logger.warn('ignoring wake event: assistant is muted');
      return;
    }

    // Set synchronously to block any concurrent wake events before async mutex acquires
    this.isHandlingHandoff = true;

    return this.runExclusive(async () => {
      // Re-verify guards inside mutex
      if (this.isDisposed) {
        this.isHandlingHandoff = false;
        return;
      }

      const epoch = ++this.wakeEpoch;
      logger.info({ epoch }, 'voice_handoff_begin');
      this.setState('handoff_to_voice');

      if (this.options.prewarmHook) {
        try {
          void this.options.prewarmHook();
        } catch {
          // safe background prewarm
        }
      }

      // 1. Transition macro state toward waking
      const currentSnap = this.service.getSnapshot();
      if (currentSnap.state === 'sleeping') {
        this.service.send({ type: 'WAKE_DETECTED' });
      }

      // 2. Stop wake provider & await complete stop resolution (Barrier)
      logger.info({ epoch }, 'wake_stop_begin');
      try {
        await Promise.race([
          this.wakeManager.stop(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout awaiting wakeManager.stop()')), 5000)
          )
        ]);
      } catch (err) {
        logger.error({ err, epoch }, 'failed to stop wake engine; aborting voice session start');
        this.isHandlingHandoff = false;
        this.setState('idle');
        this.service.send({ type: 'SLEEP_REQUESTED' });
        return;
      }
      logger.info({ epoch }, 'wake_stop_complete');

      this.setOwnership('none');
      logger.info({ epoch }, 'wake_release_complete');

      // 3. Optional hardware settle guard
      if (this.settleGuardMs > 0) {
        await this.sleep(this.settleGuardMs);
      }

      // Guard against disposal or epoch invalidation during stop/settle
      if (this.isDisposed || this.wakeEpoch !== epoch) {
        logger.warn({ epoch }, 'handoff aborted during wake release or settle');
        this.isHandlingHandoff = false;
        this.setState('idle');
        return;
      }

      // 4. Start VoiceSessionCoordinator
      const wakeDetectedAt = this.clock();
      this.lastError = undefined;
      this.assistantText = undefined;
      this.lastTranscript = undefined;
      this.inputLevel = 0;
      this.outputLevel = 0;

      let eventStream: AsyncIterable<VoiceRuntimeEvent>;
      logger.info({ epoch }, 'voice_session_start_begin');
      try {
        this.setOwnership('voice');
        this.activeVoiceSessionActive = true;
        this.setState('voice_active');
        logger.info({ epoch }, 'voice_session_begin');
        eventStream = this.voiceCoordinator.startSession({ wakeDetectedAt });
      } catch (err) {
        logger.error({ err, epoch }, 'failed to start voice session; recovering to wake');
        this.setOwnership('none');
        this.activeVoiceSessionActive = false;
        this.isHandlingHandoff = false;
        this.setState('idle');
        await this.rearmWakeSafe(epoch);
        return;
      } finally {
        this.isHandlingHandoff = false;
      }

      // 5. Stream voice runtime events until terminal event
      let sessionTimeoutTimer: NodeJS.Timeout | null = null;
      if (this.sessionTimeoutMs > 0) {
        sessionTimeoutTimer = setTimeout(() => {
          logger.warn(
            { epoch, sessionTimeoutMs: this.sessionTimeoutMs },
            'voice session timed out; aborting active session'
          );
          void this.cancelActiveVoiceSession('voice_session_timeout');
        }, this.sessionTimeoutMs);
      }

      try {
        for await (const event of eventStream) {
          if (this.isDisposed) {
            break;
          }

          this.dispatchVoiceRuntimeEvent(event);

          if (event.type === 'audio_level') {
            if (event.inputLevel !== undefined) this.inputLevel = event.inputLevel;
            if (event.outputLevel !== undefined) this.outputLevel = event.outputLevel;
          } else if (event.type === 'listening_started') {
            this.currentSessionId = event.sessionId;
            this.currentTurnIndex = this.voiceCoordinator.getCurrentTurnIndex();
            if (this.service.getSnapshot().state === 'waking') {
              this.service.send({ type: 'START_LISTENING' });
            }
          } else if (event.type === 'speech_started') {
            // User speaking
          } else if (event.type === 'partial_transcript') {
            this.lastTranscript = {
              text: event.text,
              isFinal: false,
              confidence: event.confidence
            };
          } else if (event.type === 'final_transcript') {
            this.lastTranscript = {
              text: event.text,
              isFinal: true,
              confidence: event.confidence,
              language: event.language
            };
          } else if (event.type === 'assistant_chunk') {
            this.assistantText = (this.assistantText ?? '') + event.text;
          } else if (event.type === 'thinking_started') {
            if (this.service.getSnapshot().state === 'listening') {
              this.service.send({ type: 'USER_SPEECH_ENDED' });
            }
          } else if (event.type === 'speaking_started') {
            if (this.service.getSnapshot().state === 'thinking') {
              this.service.send({ type: 'ASSISTANT_SPEAKING' });
            }
          } else if (event.type === 'interrupted') {
            this.assistantText = undefined;
            logger.info({ epoch, sessionId: event.sessionId, reason: event.reason }, 'voice_barge_in_event_received');
            const state = this.service.getSnapshot().state;
            if (state === 'speaking' || state === 'thinking') {
              this.service.send({ type: 'USER_SPEECH_STARTED' });
            }
          } else if (
            event.type === 'voice_session_completed' ||
            event.type === 'voice_session_cancelled'
          ) {
            this.inputLevel = 0;
            this.outputLevel = 0;
            logger.info({ epoch, sessionId: event.sessionId, type: event.type }, 'voice_session_terminal');
            break;
          } else if (event.type === 'voice_session_failed') {
            this.inputLevel = 0;
            this.outputLevel = 0;
            this.lastError = { code: event.errorCode, message: event.errorMessage };
            logger.info({ epoch, sessionId: event.sessionId, type: event.type }, 'voice_session_terminal');
            break;
          }
        }
      } catch (err) {
        logger.error({ err, epoch }, 'error during voice runtime event streaming');
      } finally {
        this.flushPendingLevelEvent();
        if (sessionTimeoutTimer) {
          clearTimeout(sessionTimeoutTimer);
          sessionTimeoutTimer = null;
        }
        this.activeVoiceSessionActive = false;
        this.setOwnership('none');
        this.inputLevel = 0;
        this.outputLevel = 0;
      }

      // 6. Safe rearm after terminal event
      if (this.isDisposed) {
        logger.info({ epoch }, 'VoiceManager disposed; skipping wake rearm');
        return;
      }

      await this.rearmWakeSafe(epoch);
    });
  }

  private async rearmWakeSafe(epoch: number): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    this.isRearming = true;
    this.setState('handoff_to_wake');
    logger.info({ epoch, rearmGuardMs: this.rearmGuardMs }, 'wake_rearm_begin');

    try {
      if (this.rearmGuardMs > 0) {
        await this.sleep(this.rearmGuardMs);
      }

      if (this.isDisposed) {
        return;
      }

      // Start wake engine capture
      await this.wakeManager.start();
      this.setOwnership('wake');

      // Return global macro state to sleeping
      this.service.send({ type: 'SLEEP_REQUESTED' });
      this.setState('idle');
      logger.info({ epoch }, 'wake_rearm_complete');
    } catch (err) {
      logger.error({ err, epoch }, 'failed to rearm wake engine');
      this.setOwnership('none');
      this.setState('idle');
      this.service.send({
        type: 'SET_WAKE_ENGINE_STATUS',
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to rearm wake engine'
      });
    } finally {
      this.isRearming = false;
    }
  }

  /**
   * Triggers barge-in interruption of the active voice session turn.
   * Returns true if an active turn was interrupted, false otherwise.
   */
  async interrupt(options?: { reason?: string }): Promise<boolean> {
    if (this.isDisposed || !this.activeVoiceSessionActive) {
      return false;
    }
    const result = await this.voiceCoordinator.interrupt(options);
    if (result) {
      const state = this.service.getSnapshot().state;
      if (state === 'speaking' || state === 'thinking') {
        this.service.send({ type: 'USER_SPEECH_STARTED' });
      }
    }
    return result;
  }

  async cancelActiveVoiceSession(reason?: string): Promise<void> {
    if (!this.activeVoiceSessionActive) {
      return;
    }
    logger.info({ reason }, 'cancelling active voice session');
    try {
      await this.voiceCoordinator.stopSession(reason ?? 'user_cancelled');
    } catch (err) {
      logger.error({ err }, 'error during stopSession in VoiceManager');
    }
  }

  async stop(): Promise<void> {
    await this.cancelActiveVoiceSession('voice_manager_stopped');
    try {
      await this.wakeManager.stop();
    } catch (err) {
      logger.warn({ err }, 'error stopping wake manager');
    }
    this.setOwnership('none');
    this.setState('idle');
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.setState('disposed');
    logger.info('disposing VoiceManager and releasing all voice resources');

    if (this.activeVoiceSessionActive || this.voiceCoordinator.getActiveSession()) {
      try {
        await this.voiceCoordinator.stopSession('app_shutdown');
      } catch (err) {
        logger.warn({ err }, 'error stopping voice session on VoiceManager disposal');
      }
    }

    this.activeVoiceSessionActive = false;
    this.isHandlingHandoff = false;
    this.isRearming = false;
    this.setOwnership('none');
    this.unsubscribeService?.();

    if (this.levelThrottleTimer) {
      clearTimeout(this.levelThrottleTimer);
      this.levelThrottleTimer = null;
    }
    this.pendingLevelEvent = null;

    if (this.ownsVoiceCoordinator) {
      try {
        await this.voiceCoordinator.dispose();
      } catch (err) {
        logger.warn({ err }, 'error disposing voiceCoordinator');
      }
      try {
        await (this.options.audioInput as any)?.dispose?.();
        await (this.options.stt as any)?.dispose?.();
        await (this.options.tts as any)?.dispose?.();
        await (this.options.audioOutput as any)?.dispose?.();
      } catch (err) {
        logger.warn({ err }, 'error disposing voice providers');
      }
    }
  }

  private dispatchVoiceRuntimeEvent(event: VoiceRuntimeEvent): void {
    if (event.type === 'audio_level') {
      if (event.inputLevel !== undefined) {
        this.inputLevel = event.inputLevel;
      }
      if (event.outputLevel !== undefined) {
        this.outputLevel = event.outputLevel;
      }
      const now = this.clock();
      this.pendingLevelEvent = event;
      if (this.telemetryThrottleMs <= 0 || now - this.lastLevelEmitTime >= this.telemetryThrottleMs) {
        this.flushPendingLevelEvent();
      } else if (!this.levelThrottleTimer) {
        const delay = Math.max(1, this.telemetryThrottleMs - (now - this.lastLevelEmitTime));
        this.levelThrottleTimer = setTimeout(() => {
          this.levelThrottleTimer = null;
          this.flushPendingLevelEvent();
        }, delay);
      }
      return;
    }

    // Flush any pending level event first so event order is preserved
    if (this.pendingLevelEvent) {
      this.flushPendingLevelEvent();
    }
    this.options.onVoiceRuntimeEvent?.(event);
    for (const listener of this.voiceEventListeners) {
      try {
        listener(event);
      } catch {}
    }
  }

  private flushPendingLevelEvent(): void {
    if (this.levelThrottleTimer) {
      clearTimeout(this.levelThrottleTimer);
      this.levelThrottleTimer = null;
    }
    if (this.pendingLevelEvent) {
      const event = this.pendingLevelEvent;
      this.pendingLevelEvent = null;
      this.lastLevelEmitTime = this.clock();
      this.options.onVoiceRuntimeEvent?.(event);
      for (const listener of this.voiceEventListeners) {
        try {
          listener(event);
        } catch {}
      }
    }
  }

  onVoiceEvent(listener: (event: VoiceRuntimeEvent) => void): () => void {
    this.voiceEventListeners.add(listener);
    return () => {
      this.voiceEventListeners.delete(listener);
    };
  }

  private setOwnership(newOwnership: MicOwnership): void {
    if (
      (this.micOwnership === 'wake' && newOwnership === 'voice') ||
      (this.micOwnership === 'voice' && newOwnership === 'wake')
    ) {
      const err = new Error(
        `Microphone ownership invariant violation: illegal transition from '${this.micOwnership}' to '${newOwnership}' without passing through 'none'`
      );
      logger.error(err.message);
      throw err;
    }

    const previous = this.micOwnership;
    this.micOwnership = newOwnership;
    if (previous !== newOwnership) {
      logger.debug({ from: previous, to: newOwnership }, 'microphone ownership changed');
      this.options.onOwnershipChange?.(newOwnership);
    }
  }

  private setState(state: VoiceManagerState): void {
    this.state = state;
    this.options.onStateChange?.(state);
  }

  private async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.activeOperationPromise;
    let resolveCurrent: () => void;
    this.activeOperationPromise = new Promise<void>((resolve) => {
      resolveCurrent = resolve;
    });

    try {
      await previous;
      return await fn();
    } finally {
      resolveCurrent!();
    }
  }

  getState(): VoiceManagerState {
    return this.state;
  }

  getMicOwnership(): MicOwnership {
    return this.micOwnership;
  }

  isVoiceActive(): boolean {
    return this.activeVoiceSessionActive;
  }

  getDuplicateWakeCount(): number {
    return this.duplicateWakeCount;
  }

  getVoiceCoordinator(): VoiceSessionCoordinator {
    return this.voiceCoordinator;
  }

  getStatusSnapshot(): VoiceStatusSnapshot {
    const macroSnapshot = this.service.getSnapshot();
    let diagState: VoiceDiagnosticState = 'sleeping';

    if (this.isDisposed) {
      diagState = 'sleeping';
    } else if (macroSnapshot.state === 'error' || this.lastError) {
      diagState = 'error';
    } else if (this.state === 'handoff_to_voice' || macroSnapshot.state === 'waking') {
      diagState = 'waking';
    } else if (this.state === 'voice_active') {
      const activeSession = this.voiceCoordinator.getActiveSession();
      if (activeSession) {
        if (activeSession.status === 'listening') diagState = 'listening';
        else if (activeSession.status === 'transcribing') diagState = 'transcribing';
        else if (activeSession.status === 'thinking') diagState = 'thinking';
        else if (activeSession.status === 'speaking') diagState = 'speaking';
        else if (activeSession.status === 'interrupted') diagState = 'interrupted';
        else if (activeSession.status === 'error') diagState = 'error';
        else diagState = 'listening';
      } else {
        if (macroSnapshot.state === 'thinking') diagState = 'thinking';
        else if (macroSnapshot.state === 'speaking') diagState = 'speaking';
        else diagState = 'listening';
      }
    } else if (this.state === 'handoff_to_wake') {
      diagState = 'sleeping';
    } else {
      diagState = 'sleeping';
    }

    const wakeProvider = this.wakeManager.getProvider();
    const wakeDiag = typeof (wakeProvider as any)?.getDiagnostics === 'function'
      ? (wakeProvider as any).getDiagnostics()
      : undefined;
    const wakeProviderId =
      wakeDiag?.wakeProvider ??
      ('id' in wakeProvider && typeof (wakeProvider as any).id === 'string'
        ? (wakeProvider as any).id
        : 'openwakeword');

    const activeSession = this.voiceCoordinator.getActiveSession() ?? this.voiceCoordinator.getLastSession();

    return {
      enabled: !this.isDisposed && (macroSnapshot.mode === 'conversation' || (macroSnapshot as any).mode === 'voice'),
      state: diagState,
      micOwnership: this.micOwnership,
      sessionId: this.currentSessionId ?? activeSession?.id,
      conversationSessionId: activeSession?.conversationSessionId,
      turnIndex: this.currentTurnIndex,
      wake: {
        provider: wakeProviderId,
        listening: this.wakeManager.isListening(),
        lastScore: macroSnapshot.lastWakeScore,
        threshold: macroSnapshot.threshold
      },
      audioInput: {
        provider: this.voiceCoordinator.getAudioInput?.()?.id ?? 'sounddevice-audio-input',
        deviceLabel: macroSnapshot.microphoneName
      },
      stt: {
        provider: this.voiceCoordinator.getSTT?.()?.id ?? 'faster-whisper-local',
        status: this.activeVoiceSessionActive ? 'active' : 'idle',
        language: this.lastTranscript?.language,
        model: 'large-v3-turbo'
      },
      tts: {
        provider: this.voiceCoordinator.getTTS?.()?.id ?? 'EdgeTTS',
        status: this.activeVoiceSessionActive && diagState === 'speaking' ? 'active' : 'idle',
        voiceId: 'th-TH-PremwadeeNeural / en-US-JennyNeural'
      },
      output: {
        provider: this.voiceCoordinator.getAudioOutput?.()?.id ?? 'sounddevice-audio-output',
        state: this.voiceCoordinator.getAudioOutput?.()?.getPlaybackState?.() ?? 'idle'
      },
      inputLevel: this.inputLevel,
      outputLevel: this.outputLevel,
      lastTranscript: this.lastTranscript,
      assistantText: this.assistantText,
      lastError: this.lastError,
      latency: this.voiceCoordinator.getLatencyDiagnostics?.()
    };
  }

  async startDiagnosticTurn(): Promise<{ success: boolean; error?: string }> {
    if (this.isDisposed) {
      return { success: false, error: 'VoiceManager is disposed' };
    }
    try {
      void this.handleWakeDetected().catch((err) => {
        logger.error({ err }, 'error in diagnostic voice turn');
      });
      return { success: true };
    } catch (err: any) {
      logger.error({ err }, 'failed to start diagnostic voice turn');
      return { success: false, error: err.message };
    }
  }
}
