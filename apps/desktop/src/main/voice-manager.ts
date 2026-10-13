import type {
  AudioInputProvider,
  AudioOutput,
  STTProvider,
  TTSProvider,
  VoiceRuntimeEvent
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
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onOwnershipChange?: (ownership: MicOwnership) => void;
  onVoiceRuntimeEvent?: (event: VoiceRuntimeEvent) => void;
  onStateChange?: (state: VoiceManagerState) => void;
}

export class VoiceManager {
  private readonly service: MaveService;
  private readonly wakeManager: WakeManager;
  private readonly voiceCoordinator: VoiceSessionCoordinator;
  private readonly ownsVoiceCoordinator: boolean;
  private readonly rearmGuardMs: number;
  private readonly settleGuardMs: number;
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

  private activeOperationPromise: Promise<void> = Promise.resolve();

  constructor(options: VoiceManagerOptions) {
    this.options = options;
    this.service = options.service;
    this.wakeManager = options.wakeManager;
    this.rearmGuardMs = options.rearmGuardMs ?? 300;
    this.settleGuardMs = options.settleGuardMs ?? 0;
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

      // 1. Transition macro state toward waking
      const currentSnap = this.service.getSnapshot();
      if (currentSnap.state === 'sleeping') {
        this.service.send({ type: 'WAKE_DETECTED' });
      }

      // 2. Stop wake provider & await complete stop resolution (Barrier)
      try {
        await this.wakeManager.stop();
      } catch (err) {
        logger.error({ err, epoch }, 'failed to stop wake engine; aborting voice session start');
        this.isHandlingHandoff = false;
        this.setState('idle');
        this.service.send({ type: 'SLEEP_REQUESTED' });
        return;
      }

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
      let eventStream: AsyncIterable<VoiceRuntimeEvent>;
      try {
        this.setOwnership('voice');
        this.activeVoiceSessionActive = true;
        this.setState('voice_active');
        logger.info({ epoch }, 'voice_session_begin');
        eventStream = this.voiceCoordinator.startSession();
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
      try {
        for await (const event of eventStream) {
          if (this.isDisposed) {
            break;
          }

          this.options.onVoiceRuntimeEvent?.(event);

          if (event.type === 'listening_started') {
            if (this.service.getSnapshot().state === 'waking') {
              this.service.send({ type: 'START_LISTENING' });
            }
          } else if (event.type === 'speech_started') {
            // User speaking
          } else if (event.type === 'thinking_started') {
            if (this.service.getSnapshot().state === 'listening') {
              this.service.send({ type: 'USER_SPEECH_ENDED' });
            }
          } else if (event.type === 'speaking_started') {
            if (this.service.getSnapshot().state === 'thinking') {
              this.service.send({ type: 'ASSISTANT_SPEAKING' });
            }
          } else if (
            event.type === 'voice_session_completed' ||
            event.type === 'voice_session_cancelled' ||
            event.type === 'voice_session_failed'
          ) {
            logger.info({ epoch, type: event.type }, 'voice_session_terminal');
            break;
          }
        }
      } catch (err) {
        logger.error({ err, epoch }, 'error during voice runtime event streaming');
      } finally {
        this.activeVoiceSessionActive = false;
        this.setOwnership('none');
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

    if (this.ownsVoiceCoordinator) {
      try {
        await this.voiceCoordinator.dispose();
      } catch (err) {
        logger.warn({ err }, 'error disposing voiceCoordinator');
      }
    }
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
}
