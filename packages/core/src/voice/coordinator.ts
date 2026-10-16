import { randomUUID } from 'node:crypto';
import type {
  AudioFrame,
  AudioInputProvider,
  AudioOutput,
  RouteTelemetry,
  STTProvider,
  TTSProvider,
  TranscriptEvent,
  VoiceLatencyDiagnostics,
  VoiceRuntimeEvent,
  VoiceSession,
  VoiceSessionStatus
} from '@mave/contracts';
import { createLogger } from '@mave/shared';
import type { ConversationRuntime } from '../conversation/runtime.js';
import {
  VoiceCoordinatorError,
  type StartVoiceSessionOptions,
  type VoiceAudioTurnDiagnostics,
  type VoiceInterruptOptions,
  type VoiceSessionCoordinatorOptions
} from './coordinator-types.js';
import { createSpeechRequestFromChunk, ProgressiveSpeechQueue } from './speech-planner.js';
import { StreamingTextChunker } from './text-chunker.js';
import type { StreamingTextChunkerOptions } from './types.js';

const log = createLogger({ name: 'mave:voice:coordinator' });

/**
 * Lightweight, thread-safe asynchronous queue for serializing streaming VoiceRuntimeEvents.
 */
export class AsyncEventQueue<T> {
  private readonly queue: T[] = [];
  private readonly resolvers: Array<(result: IteratorResult<T>) => void> = [];
  private isClosed = false;

  push(item: T): void {
    if (this.isClosed) {
      return;
    }
    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver({ value: item, done: false });
    } else {
      this.queue.push(item);
    }
  }

  close(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    while (this.resolvers.length > 0) {
      const resolver = this.resolvers.shift();
      resolver?.({ value: undefined as any, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
      } else if (this.isClosed) {
        return;
      } else {
        const result = await new Promise<IteratorResult<T>>((resolve) => {
          this.resolvers.push(resolve);
        });
        if (result.done) {
          return;
        }
        yield result.value;
      }
    }
  }
}

/**
 * Provider-independent VoiceSessionCoordinator runtime.
 * Orchestrates AudioInput -> STT -> ConversationRuntime -> StreamingTextChunker -> TTS -> AudioOutput
 * with progressive speech synthesis and strict lifecycle enforcement.
 */
export class VoiceSessionCoordinator {
  private readonly audioInput: AudioInputProvider;
  private readonly stt: STTProvider;
  private readonly tts: TTSProvider;
  private readonly audioOutput: AudioOutput;
  private readonly conversationRuntime: ConversationRuntime;
  private readonly voiceSessionIdFactory: () => string;
  private readonly clock: () => number;
  private readonly textChunkerOptions?: StreamingTextChunkerOptions;

  private activeSession: VoiceSession | null = null;
  private lastSession: VoiceSession | null = null;
  private isDisposed = false;

  private activeSessionController: AbortController | null = null;
  private activeBrainRequestId: string | null = null;
  private activeSTTRequestId: string | null = null;
  private activeTTSRequestId: string | null = null;
  private terminalEmitted: 'completed' | 'cancelled' | 'failed' | null = null;
  private inputLevelUnsubscribe: (() => void) | null = null;
  private levelUnsubscribe: (() => void) | null = null;
  private latencyDiagnostics: VoiceLatencyDiagnostics = {};
  private currentEventQueue: AsyncEventQueue<VoiceRuntimeEvent> | null = null;

  private currentTurnIndex = 0;
  private currentTurnEpoch = 0;
  private currentTurnController: AbortController | null = null;
  private isBrainCompletedForCurrentTurn = false;
  private isInterrupting = false;
  private chunkNotifier: (() => void) | null = null;
  private currentSpeechQueue: ProgressiveSpeechQueue | null = null;
  private currentTextChunker: StreamingTextChunker | null = null;
  private readonly options: VoiceSessionCoordinatorOptions;
  private lastRouteTelemetry?: RouteTelemetry;
  private lastAudioDiagnostics: VoiceAudioTurnDiagnostics = {};

  constructor(options: VoiceSessionCoordinatorOptions) {
    this.options = options;
    this.audioInput = options.audioInput;
    this.stt = options.stt;
    this.tts = options.tts;
    this.audioOutput = options.audioOutput;
    this.conversationRuntime = options.conversationRuntime;
    this.voiceSessionIdFactory = options.voiceSessionIdFactory ?? (() => randomUUID());
    this.clock = options.clock ?? (() => Date.now());
    this.textChunkerOptions = options.textChunkerOptions;
  }

  /**
   * Starts a single end-to-end voice session.
   * Yields normalized, serializable VoiceRuntimeEvents.
   * Throws VoiceCoordinatorError('session_busy') if a session is already in progress.
   */
  startSession(options?: StartVoiceSessionOptions): AsyncIterable<VoiceRuntimeEvent> {
    if (this.isDisposed) {
      throw new VoiceCoordinatorError(
        'voice_runtime_error',
        'Cannot start voice session: VoiceSessionCoordinator has been disposed'
      );
    }

    if (this.activeSession && !this.isTerminalStatus(this.activeSession.status)) {
      throw new VoiceCoordinatorError(
        'session_busy',
        `A voice session ('${this.activeSession.id}') is already active`,
        { sessionId: this.activeSession.id }
      );
    }

    const sessionId = this.voiceSessionIdFactory();
    const now = this.clock();

    const session: VoiceSession = {
      id: sessionId,
      conversationSessionId: options?.conversationSessionId,
      status: 'listening',
      createdAt: now,
      updatedAt: now,
      languageHint: options?.languageHint,
      activeSTTProviderId: this.stt.id,
      activeTTSProviderId: this.tts.id
    };

    this.activeSession = session;
    this.terminalEmitted = null;
    this.currentTurnIndex = 0;
    this.currentTurnEpoch = 0;
    this.isInterrupting = false;
    this.latencyDiagnostics = {};
    if (options?.wakeDetectedAt) {
      this.latencyDiagnostics.wakeDetectedAt = options.wakeDetectedAt;
    }

    const controller = new AbortController();
    this.activeSessionController = controller;
    if (options?.signal) {
      if (options.signal.aborted) {
        controller.abort(options.signal.reason);
      } else {
        options.signal.addEventListener('abort', () => controller.abort(options.signal?.reason), { once: true });
      }
    }

    const eventQueue = new AsyncEventQueue<VoiceRuntimeEvent>();
    this.currentEventQueue = eventQueue;

    // Attach input level telemetry listener if available
    if (this.audioInput.onLevel) {
      this.inputLevelUnsubscribe = this.audioInput.onLevel((lvl) => {
        if (!this.terminalEmitted && this.activeSession?.id === sessionId) {
          eventQueue.push({
            type: 'audio_level',
            sessionId,
            inputLevel: lvl.rms,
            timestamp: this.clock()
          });
        }
      });
    }

    // Attach level telemetry listener if available
    if (this.audioOutput.onLevel) {
      this.levelUnsubscribe = this.audioOutput.onLevel((lvl) => {
        if (!this.terminalEmitted && this.activeSession?.id === sessionId) {
          eventQueue.push({
            type: 'audio_level',
            sessionId,
            outputLevel: lvl.rms,
            timestamp: this.clock()
          });
        }
      });
    }

    // Emit initial lifecycle events
    eventQueue.push({
      type: 'voice_session_started',
      sessionId,
      timestamp: this.clock()
    });
    eventQueue.push({
      type: 'listening_started',
      sessionId,
      timestamp: this.clock()
    });

    log.info({ sessionId }, 'Voice session started');
    log.info({ sessionId }, 'voice_session_started');

    // Run async orchestration worker in background
    void this.runSessionWorker(session, controller.signal, eventQueue);

    return eventQueue;
  }

  /**
   * Stops and cancels an active voice session cleanly.
   */
  async stopSession(reason?: string): Promise<void> {
    if (!this.activeSession || this.isTerminalStatus(this.activeSession.status)) {
      return;
    }

    const sessionId = this.activeSession.id;
    const cancelReason = reason ?? 'user_cancelled';

    log.info({ sessionId, reason: cancelReason }, 'Stopping voice session');

    // 1. Abort controllers
    if (this.activeSessionController) {
      this.activeSessionController.abort(cancelReason);
    }
    if (this.currentTurnController) {
      this.currentTurnController.abort(cancelReason);
    }

    // 2. Cancel STT if active
    if (this.activeSTTRequestId && this.stt.cancel) {
      try {
        await this.stt.cancel(this.activeSTTRequestId);
      } catch {
        // Safe cancellation
      }
    }

    // 3. Cancel Brain if active
    if (this.activeBrainRequestId) {
      try {
        await this.conversationRuntime.cancel(this.activeBrainRequestId);
      } catch {
        // Safe cancellation
      }
    }

    // 4. Cancel TTS if active
    if (this.activeTTSRequestId && this.tts.cancel) {
      try {
        await this.tts.cancel(this.activeTTSRequestId);
      } catch {
        // Safe cancellation
      }
    }

    // 5. Stop AudioOutput if playing
    try {
      if (this.audioOutput.getPlaybackState() === 'playing') {
        await this.audioOutput.stop();
      }
    } catch {
      // Safe cancellation
    }

    // 6. Emit terminal cancelled event
    if (this.currentEventQueue) {
      this.emitTerminal(this.currentEventQueue, {
        type: 'voice_session_cancelled',
        sessionId,
        reason: cancelReason,
        timestamp: this.clock()
      });
    }
  }

  /**
   * Interrupts an active turn (thinking or speaking) immediately.
   * Halts AudioOutput, clears speech queue, cancels active TTS and Brain requests,
   * invalidates turn epoch, and transitions session status to 'listening' for the next utterance.
   *
   * Returns true if an active turn was interrupted; false if idle, listening, or terminal.
   */
  async interrupt(options?: VoiceInterruptOptions): Promise<boolean> {
    if (this.isDisposed || this.isInterrupting) {
      return false;
    }
    if (!this.activeSession || this.isTerminalStatus(this.activeSession.status) || this.terminalEmitted) {
      return false;
    }
    if (this.activeSession.status !== 'thinking' && this.activeSession.status !== 'speaking') {
      return false;
    }

    this.isInterrupting = true;
    const sessionId = this.activeSession.id;
    const reason = options?.reason ?? 'user_speech_barge_in';

    log.info({ sessionId, reason, status: this.activeSession.status }, 'voice_barge_in');

    // 1. AudioOutput.stop() halt speakers immediately (first priority, provable ordering in tests)
    try {
      log.info({ sessionId }, 'voice_output_stop');
      await this.audioOutput.stop();
    } catch (err) {
      log.warn({ err, sessionId }, 'Failed to stop audio output during interrupt');
    }

    // 2. Invalidate turn generation / epoch & abort turn controller
    const previousEpoch = this.currentTurnEpoch;
    this.currentTurnEpoch++;
    log.info({ sessionId, previousEpoch, turnEpoch: this.currentTurnEpoch }, 'voice_turn_invalidated');
    if (this.currentTurnController) {
      this.currentTurnController.abort('barge_in_interrupted');
    }

    // 3. Cancel active TTS if active
    if (this.activeTTSRequestId && this.tts.cancel) {
      try {
        log.info({ sessionId, requestId: this.activeTTSRequestId }, 'voice_tts_cancel');
        await this.tts.cancel(this.activeTTSRequestId);
      } catch (err) {
        log.warn({ err, sessionId }, 'Failed to cancel TTS during interrupt');
      }
    }

    // 4. Clear speech queue & reset text chunker
    if (this.currentSpeechQueue) {
      this.currentSpeechQueue.clear();
    }
    if (this.currentTextChunker) {
      this.currentTextChunker.reset();
    }

    // 5. Cancel Brain if active AND NOT already completed for current turn
    if (this.activeBrainRequestId && !this.isBrainCompletedForCurrentTurn) {
      try {
        log.info({ sessionId, requestId: this.activeBrainRequestId }, 'voice_brain_cancel');
        await this.conversationRuntime.cancel(this.activeBrainRequestId);
      } catch (err) {
        log.warn({ err, sessionId }, 'Failed to cancel brain during interrupt');
      }
    }

    // 6. Notify any pending workers
    if (this.chunkNotifier) {
      const cb = this.chunkNotifier;
      this.chunkNotifier = null;
      cb();
    }

    // 7. Transition session status to listening and emit interrupted
    this.activeSession.status = 'listening';
    this.activeSession.updatedAt = this.clock();

    if (this.currentEventQueue && !this.terminalEmitted) {
      this.currentEventQueue.push({
        type: 'interrupted',
        sessionId,
        reason,
        timestamp: this.clock()
      });
    }

    this.isInterrupting = false;
    return true;
  }

  /**
   * Returns current 0-based turn index within the active voice session.
   */
  getCurrentTurnIndex(): number {
    return this.currentTurnIndex;
  }

  /**
   * Returns current monotonic turn epoch for stale event detection.
   */
  getCurrentTurnEpoch(): number {
    return this.currentTurnEpoch;
  }

  /**
   * Returns an immutable snapshot of the currently active voice session, or undefined if idle.
   */
  getActiveSession(): VoiceSession | undefined {
    return this.activeSession ? { ...this.activeSession } : undefined;
  }

  /**
   * Returns an immutable snapshot of the most recently finished session.
   */
  getLastSession(): VoiceSession | undefined {
    return this.lastSession ? { ...this.lastSession } : undefined;
  }

  /**
   * Disposes the coordinator and halts any active voice sessions.
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    if (this.activeSession && !this.isTerminalStatus(this.activeSession.status)) {
      await this.stopSession('coordinator_disposed');
    } else {
      this.cleanup();
    }
  }

  private isTerminalStatus(status: VoiceSessionStatus): boolean {
    return status === 'completed' || status === 'cancelled' || status === 'error';
  }

  private emitTerminal(
    eventQueue: AsyncEventQueue<VoiceRuntimeEvent>,
    event: VoiceRuntimeEvent
  ): void {
    if (this.terminalEmitted) {
      return;
    }
    this.terminalEmitted = event.type as any;
    const sid = this.activeSession?.id ?? (event as any).sessionId;
    log.info({ sessionId: sid, type: event.type }, 'voice_session_terminal');

    if (this.activeSession) {
      if (event.type === 'voice_session_completed') {
        this.activeSession.status = 'completed';
      } else if (event.type === 'voice_session_cancelled') {
        this.activeSession.status = 'cancelled';
      } else if (event.type === 'voice_session_failed') {
        this.activeSession.status = 'error';
      }
      this.activeSession.updatedAt = this.clock();
      this.lastSession = { ...this.activeSession };
    }

    eventQueue.push(event);
    this.cleanup();
    eventQueue.close();
  }

  private cleanup(): void {
    const sid = this.activeSession?.id;
    if (this.inputLevelUnsubscribe) {
      this.inputLevelUnsubscribe();
      this.inputLevelUnsubscribe = null;
    }
    if (this.levelUnsubscribe) {
      this.levelUnsubscribe();
      this.levelUnsubscribe = null;
    }
    this.activeSessionController = null;
    this.currentTurnController = null;
    this.activeBrainRequestId = null;
    this.activeSTTRequestId = null;
    this.activeTTSRequestId = null;
    this.currentSpeechQueue = null;
    this.currentTextChunker = null;
    this.chunkNotifier = null;
    this.isInterrupting = false;
    this.activeSession = null;
    this.currentEventQueue = null;
    log.info({ sessionId: sid }, 'voice_cleanup_complete');
  }

  private normalizeError(err: unknown): { code: string; message: string } {
    if (err instanceof VoiceCoordinatorError) {
      return { code: err.code, message: err.message };
    }
    if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
      const msg = 'message' in err && typeof err.message === 'string' ? err.message : 'Voice operation failed';
      return { code: err.code, message: msg };
    }
    if (err instanceof Error) {
      return { code: 'voice_runtime_error', message: err.message };
    }
    return { code: 'voice_runtime_error', message: String(err) };
  }

  private async runSessionWorker(
    session: VoiceSession,
    sessionSignal: AbortSignal,
    eventQueue: AsyncEventQueue<VoiceRuntimeEvent>
  ): Promise<void> {
    const sessionId = session.id;

    try {
      while (!sessionSignal.aborted && !this.terminalEmitted) {
        const turnIndex = this.currentTurnIndex;
        const turnEpoch = ++this.currentTurnEpoch;
        const turnController = new AbortController();
        this.currentTurnController = turnController;
        this.isBrainCompletedForCurrentTurn = false;

        const onSessionAbort = () => {
          turnController.abort(sessionSignal.reason);
        };
        sessionSignal.addEventListener('abort', onSessionAbort, { once: true });

        try {
          if (turnIndex > 0) {
            session.status = 'listening';
            session.updatedAt = this.clock();
            log.info({ sessionId, turnIndex, turnEpoch }, 'voice_relisten_begin');
            eventQueue.push({
              type: 'listening_started',
              sessionId,
              timestamp: this.clock()
            });
          }

          const turnResult = await this.runTurn(
            session,
            turnIndex,
            turnEpoch,
            turnController.signal,
            sessionSignal,
            eventQueue
          );

          if (turnResult === 'completed') {
            session.status = 'completed';
            session.updatedAt = this.clock();
            this.emitTerminal(eventQueue, {
              type: 'voice_session_completed',
              sessionId,
              timestamp: this.clock()
            });
            break;
          } else if (turnResult === 'interrupted') {
            log.info({ sessionId, turnIndex, turnEpoch }, 'voice_turn_interrupted');
            this.currentTurnIndex++;
            continue;
          } else {
            // 'cancelled' or 'failed' (terminal already emitted)
            break;
          }
        } finally {
          sessionSignal.removeEventListener('abort', onSessionAbort);
          if (this.currentTurnController === turnController) {
            this.currentTurnController = null;
          }
        }
      }
    } catch (err) {
      if (sessionSignal.aborted) {
        this.emitTerminal(eventQueue, {
          type: 'voice_session_cancelled',
          sessionId,
          reason: 'Session cancelled during processing',
          timestamp: this.clock()
        });
      } else {
        const { code, message } = this.normalizeError(err);
        this.emitTerminal(eventQueue, {
          type: 'voice_session_failed',
          sessionId,
          errorCode: code,
          errorMessage: message,
          timestamp: this.clock()
        });
      }
    }
  }

  private async runTurn(
    session: VoiceSession,
    turnIndex: number,
    turnEpoch: number,
    turnSignal: AbortSignal,
    sessionSignal: AbortSignal,
    eventQueue: AsyncEventQueue<VoiceRuntimeEvent>
  ): Promise<'completed' | 'interrupted' | 'cancelled' | 'failed'> {
    const sessionId = session.id;

    if (sessionSignal.aborted) {
      this.emitTerminal(eventQueue, {
        type: 'voice_session_cancelled',
        sessionId,
        reason: 'Session aborted before audio capture',
        timestamp: this.clock()
      });
      return 'cancelled';
    }

    if (turnSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
      return 'interrupted';
    }

    // 1. Audio Input -> STT Pipeline
    let finalTranscript: TranscriptEvent | null = null;
    this.activeSTTRequestId = `${sessionId}:turn:${turnIndex}:stt`;

    if (turnIndex === 0 && !this.latencyDiagnostics.voiceCaptureStartedAt) {
      this.latencyDiagnostics.voiceCaptureStartedAt = this.clock();
      if (this.latencyDiagnostics.wakeDetectedAt) {
        this.latencyDiagnostics.wakeToCaptureMs =
          this.latencyDiagnostics.voiceCaptureStartedAt - this.latencyDiagnostics.wakeDetectedAt;
      }
    }

    try {
      log.info({ sessionId, turnIndex, turnEpoch }, 'audio_capture_started');
      const audioStream = this.audioInput.capture({ signal: turnSignal });
      log.info({ sessionId, requestId: this.activeSTTRequestId, turnIndex }, 'stt_started');
      const sttStream = this.stt.transcribe(audioStream, {
        requestId: this.activeSTTRequestId,
        languageHint: session.languageHint,
        signal: turnSignal
      });

      for await (const event of sttStream) {
        if (sessionSignal.aborted || turnSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
          break;
        }

        if (event.type === 'speech_started') {
          if (!this.latencyDiagnostics.speechStartedAt) {
            this.latencyDiagnostics.speechStartedAt = this.clock();
          }
          eventQueue.push({
            type: 'speech_started',
            sessionId,
            timestamp: this.clock()
          });
        } else if (event.type === 'partial_transcript') {
          eventQueue.push({
            type: 'partial_transcript',
            sessionId,
            text: event.text,
            confidence: event.confidence,
            timestamp: this.clock()
          });
        } else if (event.type === 'final_transcript') {
          finalTranscript = event;
          const now = this.clock();
          this.latencyDiagnostics.sttFinalAt = now;
          if (this.latencyDiagnostics.speechEndedAt) {
            this.latencyDiagnostics.speechEndToSttMs = now - this.latencyDiagnostics.speechEndedAt;
          } else if (this.latencyDiagnostics.speechStartedAt) {
            this.latencyDiagnostics.speechEndToSttMs = now - this.latencyDiagnostics.speechStartedAt;
          }
          log.info(
            { sessionId, turnIndex, text: event.text, confidence: event.confidence },
            'final_transcript_received'
          );
          eventQueue.push({
            type: 'final_transcript',
            sessionId,
            text: event.text,
            confidence: event.confidence,
            language: event.language,
            timestamp: this.clock()
          });
        } else if (event.type === 'error') {
          throw new VoiceCoordinatorError('stt_error', event.error.message, { sessionId });
        } else if (event.type === 'cancelled') {
          if (sessionSignal.aborted) {
            this.emitTerminal(eventQueue, {
              type: 'voice_session_cancelled',
              sessionId,
              reason: event.reason,
              timestamp: this.clock()
            });
            return 'cancelled';
          }
          if (turnSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
            return 'interrupted';
          }
        }
      }
    } catch (err) {
      if (sessionSignal.aborted) {
        this.emitTerminal(eventQueue, {
          type: 'voice_session_cancelled',
          sessionId,
          reason: 'Audio capture / STT was cancelled',
          timestamp: this.clock()
        });
        return 'cancelled';
      }
      if (turnSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
        return 'interrupted';
      }
      if (err instanceof VoiceCoordinatorError) {
        throw err;
      }
      throw new VoiceCoordinatorError(
        'audio_input_error',
        err instanceof Error ? err.message : 'Audio capture or STT failed',
        { sessionId, cause: err }
      );
    } finally {
      this.activeSTTRequestId = null;
    }

    if (sessionSignal.aborted) {
      this.emitTerminal(eventQueue, {
        type: 'voice_session_cancelled',
        sessionId,
        reason: 'Session cancelled after STT',
        timestamp: this.clock()
      });
      return 'cancelled';
    }

    if (turnSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
      return 'interrupted';
    }

    // 2. Validate Final Transcript
    if (!finalTranscript || !finalTranscript.text || !finalTranscript.text.trim()) {
      this.emitTerminal(eventQueue, {
        type: 'voice_session_failed',
        sessionId,
        errorCode: 'no_speech_detected',
        errorMessage: 'No speech was recognized during the turn',
        timestamp: this.clock()
      });
      return 'failed';
    }

    // 3. Transition to Thinking State
    session.status = 'thinking';
    session.updatedAt = this.clock();
    eventQueue.push({
      type: 'thinking_started',
      sessionId,
      timestamp: this.clock()
    });

    // 4. ConversationRuntime & Progressive Speech Pipeline
    return await this.runConversationAndProgressiveSpeech(
      session,
      turnIndex,
      turnEpoch,
      finalTranscript.text,
      turnSignal,
      sessionSignal,
      eventQueue
    );
  }

  private async runConversationAndProgressiveSpeech(
    session: VoiceSession,
    turnIndex: number,
    turnEpoch: number,
    message: string,
    turnSignal: AbortSignal,
    sessionSignal: AbortSignal,
    eventQueue: AsyncEventQueue<VoiceRuntimeEvent>
  ): Promise<'completed' | 'interrupted' | 'cancelled'> {
    const sessionId = session.id;
    const chunker = new StreamingTextChunker(this.textChunkerOptions);
    const speechQueue = new ProgressiveSpeechQueue({ maxPendingChunks: 8 });

    this.currentTextChunker = chunker;
    this.currentSpeechQueue = speechQueue;
    this.isBrainCompletedForCurrentTurn = false;

    let speakingStartedEmitted = false;
    let brainDone = false;
    let brainError: Error | null = null;

    const notify = () => {
      if (this.chunkNotifier) {
        const cb = this.chunkNotifier;
        this.chunkNotifier = null;
        cb();
      }
    };

    // Task A: Brain Ingestion & Chunking
    const brainTask = async () => {
      try {
        this.latencyDiagnostics.brainStartedAt = this.clock();
        const convStream = this.conversationRuntime.send(
          {
            sessionId: session.conversationSessionId,
            message,
            profileId: 'fast_conversation'
          },
          { signal: turnSignal }
        );

        for await (const convEvent of convStream) {
          if (sessionSignal.aborted || turnSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
            break;
          }

          if (convEvent.type === 'request_started') {
            this.activeBrainRequestId = convEvent.requestId;
            log.info({ sessionId, requestId: convEvent.requestId, turnIndex }, 'conversation_started');
          } else if (convEvent.type === 'session_ready') {
            session.conversationSessionId = convEvent.sessionId;
            session.updatedAt = this.clock();
          } else if (convEvent.type === 'response_delta') {
            if (turnSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
              break;
            }
            if (!this.latencyDiagnostics.brainFirstTokenAt) {
              const now = this.clock();
              this.latencyDiagnostics.brainFirstTokenAt = now;
              if (this.latencyDiagnostics.sttFinalAt) {
                this.latencyDiagnostics.sttToBrainTtftMs = now - this.latencyDiagnostics.sttFinalAt;
              }
            }
            eventQueue.push({
              type: 'assistant_chunk',
              sessionId,
              text: convEvent.text,
              timestamp: this.clock()
            });
            const chunks = chunker.push(convEvent.text);
            for (const c of chunks) {
              speechQueue.enqueue(c);
              notify();
            }
          } else if (convEvent.type === 'response_completed') {
            this.isBrainCompletedForCurrentTurn = true;
            const routeTelemetry = this.conversationRuntime.getExecutionTelemetry(this.activeBrainRequestId ?? undefined);
            if (routeTelemetry) {
              this.lastRouteTelemetry = routeTelemetry;
              log.info(
                {
                  sessionId,
                  turnIndex,
                  selectedProviderId: routeTelemetry.selectedProviderId,
                  selectedModelId: routeTelemetry.selectedModelId,
                  profileId: routeTelemetry.profileId,
                  fallbackUsed: routeTelemetry.fallbackUsed,
                  routeAttempts: routeTelemetry.routeAttempts
                },
                'voice_turn_route_telemetry'
              );
            }
            log.info({ sessionId, requestId: this.activeBrainRequestId, turnIndex }, 'conversation_completed');
            if (turnSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
              break;
            }
            const flushed = chunker.flush();
            for (const c of flushed) {
              speechQueue.enqueue(c);
              notify();
            }
          } else if (convEvent.type === 'request_failed') {
            if (turnSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
              return;
            }
            throw new VoiceCoordinatorError('conversation_error', convEvent.error.message, { sessionId });
          } else if (convEvent.type === 'request_cancelled') {
            return;
          }
        }
      } catch (err) {
        if (!turnSignal.aborted && !sessionSignal.aborted && turnEpoch === this.currentTurnEpoch) {
          brainError = err instanceof Error ? err : new Error(String(err));
        }
      } finally {
        brainDone = true;
        this.activeBrainRequestId = null;
        notify();
      }
    };

    // Task B: Progressive TTS Synthesis & Audio Playback
    const speechTask = async () => {
      while (!sessionSignal.aborted && !turnSignal.aborted && turnEpoch === this.currentTurnEpoch) {
        if (brainError) {
          throw brainError;
        }

        if (speechQueue.isEmpty()) {
          if (brainDone) {
            break;
          }
          await new Promise<void>((resolve) => {
            if (sessionSignal.aborted || turnSignal.aborted || turnEpoch !== this.currentTurnEpoch || brainDone) {
              resolve();
              return;
            }
            const onAbort = () => {
              turnSignal.removeEventListener('abort', onAbort);
              sessionSignal.removeEventListener('abort', onAbort);
              resolve();
            };
            turnSignal.addEventListener('abort', onAbort, { once: true });
            sessionSignal.addEventListener('abort', onAbort, { once: true });
            this.chunkNotifier = () => {
              turnSignal.removeEventListener('abort', onAbort);
              sessionSignal.removeEventListener('abort', onAbort);
              resolve();
            };
          });
          continue;
        }

        const chunk = speechQueue.dequeue();
        if (!chunk || turnSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
          continue;
        }

        const speechReq = createSpeechRequestFromChunk(chunk, {
          voiceTurnId: `${sessionId}:turn:${turnIndex}`,
          language: session.languageHint
        });
        this.activeTTSRequestId = speechReq.requestId;
        if (!this.latencyDiagnostics.ttsRequestedAt) {
          this.latencyDiagnostics.ttsRequestedAt = this.clock();
        }

        const currentDiag: VoiceAudioTurnDiagnostics = {
          ttsRequestId: speechReq.requestId,
          requestedText: chunk.text,
          selectedVoice: speechReq.voiceId,
          language: speechReq.language,
          framesEmitted: false,
          frameCount: 0,
          totalAudioBytes: 0,
          audioOutputPlayInvoked: false,
          resolvedOutputDevice:
            (this.audioOutput as any)?.getResolvedDevice?.()?.deviceName ?? this.audioOutput.id
        };

        log.info(
          { sessionId, turnIndex, requestId: speechReq.requestId, sequence: chunk.sequence, selectedVoice: speechReq.voiceId },
          'tts_started'
        );

        const audioFrames: AudioFrame[] = [];
        let ttsError: Error | null = null;
        try {
          for await (const speechEvent of this.tts.synthesize(speechReq, { signal: turnSignal })) {
            if (turnSignal.aborted || sessionSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
              break;
            }
            if (speechEvent.type === 'audio') {
              currentDiag.framesEmitted = true;
              currentDiag.frameCount = (currentDiag.frameCount ?? 0) + 1;
              currentDiag.totalAudioBytes = (currentDiag.totalAudioBytes ?? 0) + speechEvent.frame.data.byteLength;
              if (!this.latencyDiagnostics.ttsFirstAudioAt) {
                const now = this.clock();
                this.latencyDiagnostics.ttsFirstAudioAt = now;
                currentDiag.ttsFirstAudioAt = now;
                if (this.latencyDiagnostics.ttsRequestedAt) {
                  this.latencyDiagnostics.ttsTtfaMs = now - this.latencyDiagnostics.ttsRequestedAt;
                }
              }
              audioFrames.push(speechEvent.frame);
            } else if (speechEvent.type === 'error') {
              ttsError = new VoiceCoordinatorError('tts_error', speechEvent.error.message, { sessionId });
              break;
            } else if (speechEvent.type === 'cancelled') {
              return;
            }
          }
        } catch (err: any) {
          ttsError = err instanceof Error ? err : new Error(String(err));
        } finally {
          this.activeTTSRequestId = null;
        }

        if (turnSignal.aborted || sessionSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
          break;
        }

        if (ttsError) {
          currentDiag.playbackError = ttsError.message;
          log.warn(
            { sessionId, turnIndex, requestId: speechReq.requestId, err: ttsError.message, diagnostics: currentDiag },
            'tts_synthesis_failed'
          );
          this.lastAudioDiagnostics = currentDiag;
          if (this.options?.degradeToTextOnTtsFailure === false) {
            throw ttsError;
          }
          // Degrade gracefully to text: do not emit speaking_started and continue to allow text response
          continue;
        }

        if (audioFrames.length > 0) {
          if (!speakingStartedEmitted) {
            speakingStartedEmitted = true;
            session.status = 'speaking';
            session.updatedAt = this.clock();
            eventQueue.push({
              type: 'speaking_started',
              sessionId,
              requestId: chunk.text,
              timestamp: this.clock()
            });
          }

          if (!this.latencyDiagnostics.playbackStartedAt) {
            const now = this.clock();
            this.latencyDiagnostics.playbackStartedAt = now;
            currentDiag.playbackStartedAt = now;
            const refSpeechEnd = this.latencyDiagnostics.speechEndedAt ?? this.latencyDiagnostics.sttFinalAt;
            if (refSpeechEnd) {
              this.latencyDiagnostics.speechEndToSpokenResponseMs = now - refSpeechEnd;
            }
          }
          currentDiag.audioOutputPlayInvoked = true;
          log.info({ sessionId, turnIndex, frameCount: audioFrames.length, diagnostics: currentDiag }, 'audio_output_started');
          async function* frameStream() {
            for (const f of audioFrames) {
              yield f;
            }
          }
          try {
            await this.audioOutput.playStream(frameStream(), { signal: turnSignal });
            currentDiag.playbackCompletedAt = this.clock();
          } catch (err) {
            currentDiag.playbackError = err instanceof Error ? err.message : 'Audio playback failed';
            this.lastAudioDiagnostics = currentDiag;
            if (turnSignal.aborted || sessionSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
              return;
            }
            throw new VoiceCoordinatorError(
              'audio_output_error',
              currentDiag.playbackError,
              { sessionId, cause: err }
            );
          }
        } else {
          currentDiag.playbackError = 'No audio frames emitted by TTS provider';
          log.warn({ sessionId, turnIndex, diagnostics: currentDiag }, 'tts_zero_frames_emitted');
        }

        this.lastAudioDiagnostics = currentDiag;
        log.info({ sessionId, turnIndex, diagnostics: currentDiag }, 'voice_turn_audio_diagnostics');
      }
    };

    try {
      await Promise.all([brainTask(), speechTask()]);
    } finally {
      this.currentTextChunker = null;
      this.currentSpeechQueue = null;
    }

    if (sessionSignal.aborted) {
      this.emitTerminal(eventQueue, {
        type: 'voice_session_cancelled',
        sessionId,
        reason: 'Session cancelled during playback',
        timestamp: this.clock()
      });
      return 'cancelled';
    }

    if (turnSignal.aborted || turnEpoch !== this.currentTurnEpoch) {
      return 'interrupted';
    }

    if (speakingStartedEmitted) {
      const now = this.clock();
      this.latencyDiagnostics.playbackCompletedAt = now;
      if (this.latencyDiagnostics.speechStartedAt) {
        this.latencyDiagnostics.turnDurationMs = now - this.latencyDiagnostics.speechStartedAt;
      } else if (this.latencyDiagnostics.voiceCaptureStartedAt) {
        this.latencyDiagnostics.turnDurationMs = now - this.latencyDiagnostics.voiceCaptureStartedAt;
      }
      eventQueue.push({
        type: 'speaking_finished',
        sessionId,
        timestamp: this.clock()
      });
    }

    return 'completed';
  }

  getLatencyDiagnostics(): VoiceLatencyDiagnostics {
    return { ...this.latencyDiagnostics };
  }

  getAudioInput(): AudioInputProvider {
    return this.audioInput;
  }

  getSTT(): STTProvider {
    return this.stt;
  }

  getTTS(): TTSProvider {
    return this.tts;
  }

  getAudioOutput(): AudioOutput {
    return this.audioOutput;
  }

  getAudioDiagnostics(): VoiceAudioTurnDiagnostics {
    return { ...this.lastAudioDiagnostics };
  }

  getRouteTelemetry(): RouteTelemetry | undefined {
    return this.lastRouteTelemetry;
  }
}
