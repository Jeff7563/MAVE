import { randomUUID } from 'node:crypto';
import type {
  AudioFrame,
  AudioInputProvider,
  AudioOutput,
  STTProvider,
  TTSProvider,
  TranscriptEvent,
  VoiceRuntimeEvent,
  VoiceSession,
  VoiceSessionStatus
} from '@mave/contracts';
import { createLogger } from '@mave/shared';
import type { ConversationRuntime } from '../conversation/runtime.js';
import {
  VoiceCoordinatorError,
  type StartVoiceSessionOptions,
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
  private levelUnsubscribe: (() => void) | null = null;
  private currentEventQueue: AsyncEventQueue<VoiceRuntimeEvent> | null = null;

  constructor(options: VoiceSessionCoordinatorOptions) {
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

    // 1. Abort local controller
    if (this.activeSessionController) {
      this.activeSessionController.abort(cancelReason);
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
    if (this.levelUnsubscribe) {
      this.levelUnsubscribe();
      this.levelUnsubscribe = null;
    }
    this.activeSessionController = null;
    this.activeBrainRequestId = null;
    this.activeSTTRequestId = null;
    this.activeTTSRequestId = null;
    this.activeSession = null;
    this.currentEventQueue = null;
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
    signal: AbortSignal,
    eventQueue: AsyncEventQueue<VoiceRuntimeEvent>
  ): Promise<void> {
    const sessionId = session.id;

    try {
      if (signal.aborted) {
        this.emitTerminal(eventQueue, {
          type: 'voice_session_cancelled',
          sessionId,
          reason: 'Session aborted before audio capture',
          timestamp: this.clock()
        });
        return;
      }

      // 1. Audio Input -> STT Pipeline
      let finalTranscript: TranscriptEvent | null = null;
      this.activeSTTRequestId = `stt-${sessionId}`;

      try {
        const audioStream = this.audioInput.capture({ signal });
        const sttStream = this.stt.transcribe(audioStream, {
          requestId: this.activeSTTRequestId,
          languageHint: session.languageHint,
          signal
        });

        for await (const event of sttStream) {
          if (signal.aborted) {
            break;
          }

          if (event.type === 'speech_started') {
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
            this.emitTerminal(eventQueue, {
              type: 'voice_session_cancelled',
              sessionId,
              reason: event.reason,
              timestamp: this.clock()
            });
            return;
          }
        }
      } catch (err) {
        if (signal.aborted) {
          this.emitTerminal(eventQueue, {
            type: 'voice_session_cancelled',
            sessionId,
            reason: 'Audio capture / STT was cancelled',
            timestamp: this.clock()
          });
          return;
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

      if (signal.aborted) {
        this.emitTerminal(eventQueue, {
          type: 'voice_session_cancelled',
          sessionId,
          reason: 'Session cancelled after STT',
          timestamp: this.clock()
        });
        return;
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
        return;
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
      await this.runConversationAndProgressiveSpeech(session, finalTranscript.text, signal, eventQueue);
    } catch (err) {
      if (signal.aborted) {
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

  private async runConversationAndProgressiveSpeech(
    session: VoiceSession,
    message: string,
    signal: AbortSignal,
    eventQueue: AsyncEventQueue<VoiceRuntimeEvent>
  ): Promise<void> {
    const sessionId = session.id;
    const chunker = new StreamingTextChunker(this.textChunkerOptions);
    const speechQueue = new ProgressiveSpeechQueue({ maxPendingChunks: 8 });

    let speakingStartedEmitted = false;
    let brainDone = false;
    let brainError: Error | null = null;
    let chunkNotifier: (() => void) | null = null;

    const notify = () => {
      if (chunkNotifier) {
        const cb = chunkNotifier;
        chunkNotifier = null;
        cb();
      }
    };

    // Task A: Brain Ingestion & Chunking
    const brainTask = async () => {
      try {
        const convStream = this.conversationRuntime.send(
          {
            sessionId: session.conversationSessionId,
            message,
            profileId: 'fast_conversation'
          },
          { signal }
        );

        for await (const convEvent of convStream) {
          if (signal.aborted) {
            break;
          }

          if (convEvent.type === 'request_started') {
            this.activeBrainRequestId = convEvent.requestId;
          } else if (convEvent.type === 'session_ready') {
            session.conversationSessionId = convEvent.sessionId;
            session.updatedAt = this.clock();
          } else if (convEvent.type === 'response_delta') {
            const chunks = chunker.push(convEvent.text);
            for (const c of chunks) {
              speechQueue.enqueue(c);
              notify();
            }
          } else if (convEvent.type === 'response_completed') {
            const flushed = chunker.flush();
            for (const c of flushed) {
              speechQueue.enqueue(c);
              notify();
            }
          } else if (convEvent.type === 'request_failed') {
            throw new VoiceCoordinatorError('conversation_error', convEvent.error.message, { sessionId });
          } else if (convEvent.type === 'request_cancelled') {
            return;
          }
        }
      } catch (err) {
        brainError = err instanceof Error ? err : new Error(String(err));
      } finally {
        brainDone = true;
        this.activeBrainRequestId = null;
        notify();
      }
    };

    // Task B: Progressive TTS Synthesis & Audio Playback
    const speechTask = async () => {
      while (!signal.aborted) {
        if (brainError) {
          throw brainError;
        }

        if (speechQueue.isEmpty()) {
          if (brainDone) {
            break; // Brain finished and all chunks processed
          }
          await new Promise<void>((resolve) => {
            chunkNotifier = resolve;
          });
          continue;
        }

        const chunk = speechQueue.dequeue();
        if (!chunk) {
          continue;
        }

        // Emit speaking_started on the first chunk
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

        const speechReq = createSpeechRequestFromChunk(chunk, {
          voiceTurnId: sessionId,
          language: session.languageHint
        });
        this.activeTTSRequestId = speechReq.requestId;

        const audioFrames: AudioFrame[] = [];
        try {
          for await (const speechEvent of this.tts.synthesize(speechReq, { signal })) {
            if (signal.aborted) {
              break;
            }
            if (speechEvent.type === 'audio') {
              audioFrames.push(speechEvent.frame);
            } else if (speechEvent.type === 'error') {
              throw new VoiceCoordinatorError('tts_error', speechEvent.error.message, { sessionId });
            } else if (speechEvent.type === 'cancelled') {
              return;
            }
          }
        } finally {
          this.activeTTSRequestId = null;
        }

        if (signal.aborted) {
          break;
        }

        // Play audio frames through AudioOutput
        if (audioFrames.length > 0) {
          async function* frameStream() {
            for (const f of audioFrames) {
              yield f;
            }
          }
          try {
            await this.audioOutput.playStream(frameStream(), { signal });
          } catch (err) {
            throw new VoiceCoordinatorError(
              'audio_output_error',
              err instanceof Error ? err.message : 'Audio playback failed',
              { sessionId, cause: err }
            );
          }
        }
      }
    };

    // Run Brain generation and progressive speech worker concurrently
    await Promise.all([brainTask(), speechTask()]);

    if (signal.aborted) {
      this.emitTerminal(eventQueue, {
        type: 'voice_session_cancelled',
        sessionId,
        reason: 'Session cancelled during playback',
        timestamp: this.clock()
      });
      return;
    }

    if (speakingStartedEmitted) {
      eventQueue.push({
        type: 'speaking_finished',
        sessionId,
        timestamp: this.clock()
      });
    }

    session.status = 'completed';
    session.updatedAt = this.clock();
    this.emitTerminal(eventQueue, {
      type: 'voice_session_completed',
      sessionId,
      timestamp: this.clock()
    });
  }
}
