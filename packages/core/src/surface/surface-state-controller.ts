import {
  type SurfaceSnapshot,
  type SurfacePresentationIntent,
  type SurfaceAction,
  type SurfaceMode,
  type AutoCollapsePolicy,
  DEFAULT_AUTO_COLLAPSE_VOICE_MS,
  DEFAULT_AUTO_COLLAPSE_COMPACT_MS,
  DEFAULT_AUTO_COLLAPSE_EXPANDED_MS,
  DEFAULT_AUTO_COLLAPSE_ERROR_MS,
  SURFACE_PRIORITY_WEIGHTS
} from '@mave/contracts';
import {
  classifyResponseContent,
  StreamingResponseClassifier,
  type ClassificationResult
} from './response-classifier.js';

export interface ClockService {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const defaultClock: ClockService = {
  now: () => Date.now(),
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (id) => clearTimeout(id as NodeJS.Timeout)
};

export interface SurfaceStateControllerOptions {
  clock?: ClockService;
  enableTimers?: boolean;
}

/**
 * Calculates priority weight score for current active surface state.
 */
export function getSurfacePriorityScore(snapshot: SurfaceSnapshot): number {
  if (snapshot.error && snapshot.priority === 'critical') return 40;
  if (snapshot.mode === 'confirmation') return 35;
  if (snapshot.pinned) return 30;
  if (snapshot.mode === 'error') return 25;
  if (['listening', 'thinking', 'speaking', 'compact_response', 'expanded_response'].includes(snapshot.mode)) {
    return 20;
  }
  if (snapshot.mode === 'progress') return 15;
  return 10;
}

/**
 * SurfaceStateController
 *
 * Side-effect-free, deterministic presentation state manager.
 * Owns the canonical SurfaceSnapshot and enforces priority arbitration,
 * the focus-invariance security invariant, transcribing/barge-in visual folds,
 * and stable streaming promotion.
 */
export class SurfaceStateController {
  private currentSnapshot: SurfaceSnapshot;
  private readonly subscribers = new Set<(snapshot: SurfaceSnapshot) => void>();
  private readonly streamingClassifier = new StreamingResponseClassifier();
  private readonly clock: ClockService;
  private readonly enableTimers: boolean;
  private activeTimerId: unknown = null;
  private activeTimerRevision = 0;
  private isUserHovering = false;
  private accumulatedAssistantText = '';

  constructor(options: SurfaceStateControllerOptions = {}) {
    this.clock = options.clock ?? defaultClock;
    this.enableTimers = options.enableTimers ?? false;

    this.currentSnapshot = {
      version: 1,
      mode: 'ambient',
      visibility: 'visible',
      sizeClass: 'ambient',
      interactionMode: 'passive',
      focusIntent: 'preserve',
      pinned: false,
      activity: 'idle',
      source: 'voice',
      priority: 'normal',
      inputLevel: 0,
      outputLevel: 0,
      updatedAt: this.clock.now()
    };
  }

  /**
   * Retrieves an immutable copy of the active snapshot.
   */
  public getSnapshot(): SurfaceSnapshot {
    return { ...this.currentSnapshot };
  }

  /**
   * Subscribes to snapshot updates.
   */
  public subscribe(listener: (snapshot: SurfaceSnapshot) => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /**
   * Applies an incoming presentation intent and returns the updated snapshot.
   */
  public applyIntent(intent: SurfacePresentationIntent): SurfaceSnapshot {
    const prev = this.currentSnapshot;

    switch (intent.type) {
      case 'voice_activity':
        return this.handleVoiceActivity(intent);

      case 'show_response':
        return this.handleShowResponse(intent);

      case 'show_confirmation':
        return this.handleShowConfirmation(intent);

      case 'show_progress':
        return this.handleShowProgress(intent);

      case 'show_error':
        return this.handleShowError(intent);

      case 'user_action':
        return this.dispatchAction(intent.action);

      case 'reset_to_ambient':
        return this.handleResetToAmbient(intent.force);

      default:
        return prev;
    }
  }

  /**
   * Dispatches an explicit surface action (user or system initiated).
   */
  public dispatchAction(action: SurfaceAction): SurfaceSnapshot {
    const prev = this.currentSnapshot;
    const now = this.clock.now();

    switch (action.type) {
      case 'expand': {
        this.clearActiveTimer();
        if (prev.mode === 'compact_response' || prev.sizeClass === 'card') {
          const autoCollapse: AutoCollapsePolicy | undefined = prev.pinned
            ? { enabled: false, afterMs: 0, targetMode: 'ambient' }
            : { enabled: true, afterMs: DEFAULT_AUTO_COLLAPSE_EXPANDED_MS, targetMode: 'ambient' };

          if (autoCollapse.enabled) {
            this.scheduleCollapse(autoCollapse.afterMs, autoCollapse.targetMode);
          }

          return this.updateSnapshot({
            mode: prev.mode === 'compact_response' ? 'expanded_response' : prev.mode,
            sizeClass: 'expanded',
            interactionMode: 'interactive',
            focusIntent: 'preserve', // expanding container does not steal OS focus
            autoCollapse,
            updatedAt: now
          });
        }
        if (prev.sizeClass === 'compact' || prev.sizeClass === 'ambient') {
          return this.updateSnapshot({
            sizeClass: 'card',
            interactionMode: 'passive',
            focusIntent: 'preserve',
            updatedAt: now
          });
        }
        return prev;
      }

      case 'collapse': {
        this.clearActiveTimer();
        if (prev.mode === 'expanded_response' || prev.sizeClass === 'expanded') {
          const autoCollapse: AutoCollapsePolicy | undefined = prev.pinned
            ? { enabled: false, afterMs: 0, targetMode: 'ambient' }
            : { enabled: true, afterMs: DEFAULT_AUTO_COLLAPSE_COMPACT_MS, targetMode: 'ambient' };

          if (autoCollapse.enabled) {
            this.scheduleCollapse(autoCollapse.afterMs, autoCollapse.targetMode);
          }

          return this.updateSnapshot({
            mode: prev.mode === 'expanded_response' ? 'compact_response' : prev.mode,
            sizeClass: 'card',
            interactionMode: 'passive',
            focusIntent: prev.focusIntent === 'request' ? 'release' : 'preserve',
            autoCollapse,
            updatedAt: now
          });
        }
        if (prev.sizeClass === 'card') {
          return this.updateSnapshot({
            mode: prev.mode === 'compact_response' ? 'ambient' : prev.mode,
            sizeClass: 'compact',
            interactionMode: 'passive',
            focusIntent: prev.focusIntent === 'request' ? 'release' : 'preserve',
            autoCollapse: undefined,
            updatedAt: now
          });
        }
        return prev;
      }

      case 'toggle_pin': {
        const nextPinned = action.pinned !== undefined ? action.pinned : !prev.pinned;
        this.clearActiveTimer();

        let autoCollapse: AutoCollapsePolicy | undefined;
        if (nextPinned) {
          autoCollapse = { enabled: false, afterMs: 0, targetMode: 'ambient' };
        } else if (prev.mode === 'compact_response') {
          autoCollapse = { enabled: true, afterMs: DEFAULT_AUTO_COLLAPSE_COMPACT_MS, targetMode: 'ambient' };
          this.scheduleCollapse(autoCollapse.afterMs, autoCollapse.targetMode);
        } else if (prev.mode === 'expanded_response') {
          autoCollapse = { enabled: true, afterMs: DEFAULT_AUTO_COLLAPSE_EXPANDED_MS, targetMode: 'ambient' };
          this.scheduleCollapse(autoCollapse.afterMs, autoCollapse.targetMode);
        } else {
          autoCollapse = prev.autoCollapse;
        }

        return this.updateSnapshot({
          pinned: nextPinned,
          focusIntent: 'preserve',
          autoCollapse,
          updatedAt: now
        });
      }

      case 'dismiss': {
        this.clearActiveTimer();
        this.streamingClassifier.reset();
        this.accumulatedAssistantText = '';
        return this.updateSnapshot({
          mode: 'hidden',
          visibility: 'hidden',
          sizeClass: 'ambient',
          interactionMode: 'passive',
          focusIntent: 'release', // Release focus back to OS on dismissal
          pinned: false,
          activity: 'idle',
          inputLevel: 0,
          outputLevel: 0,
          assistantText: undefined,
          content: undefined,
          autoCollapse: undefined,
          error: undefined,
          updatedAt: now
        });
      }

      case 'confirm_action': {
        // Confirmation resolved: return to ambient or compact response
        this.clearActiveTimer();
        return this.updateSnapshot({
          mode: 'ambient',
          sizeClass: 'ambient',
          interactionMode: 'passive',
          focusIntent: 'release',
          activity: 'idle',
          autoCollapse: undefined,
          updatedAt: now
        });
      }

      case 'submit_text': {
        // Explicit text query initiated by user -> focus may be requested
        return this.updateSnapshot({
          mode: 'thinking',
          sizeClass: 'compact',
          interactionMode: 'interactive',
          focusIntent: 'request', // User explicitly interacted with input
          activity: 'thinking',
          updatedAt: now
        });
      }

      case 'request_focus': {
        // Explicit user-origin keyboard interaction requested
        if (action.origin !== 'user') {
          return prev;
        }
        this.resetInactivityTimer();
        return this.updateSnapshot({
          interactionMode: 'interactive',
          focusIntent: 'request',
          updatedAt: now
        });
      }

      case 'release_focus': {
        this.resetInactivityTimer();
        return this.updateSnapshot({
          interactionMode: prev.mode === 'expanded_response' ? 'interactive' : 'passive',
          focusIntent: 'release',
          updatedAt: now
        });
      }

      case 'set_interaction_mode': {
        return this.updateSnapshot({
          interactionMode: action.mode,
          focusIntent: 'preserve',
          updatedAt: now
        });
      }

      case 'user_activity':
      case 'open_link':
      case 'open_source':
      case 'copy_text': {
        this.resetInactivityTimer();
        return prev;
      }

      default:
        return prev;
    }
  }

  /* ------------------------------------------------------------------
   * Private Intent Handlers
   * ------------------------------------------------------------------ */

  private handleVoiceActivity(
    intent: Extract<SurfacePresentationIntent, { type: 'voice_activity' }>
  ): SurfaceSnapshot {
    const prev = this.currentSnapshot;
    const now = intent.timestamp ?? this.clock.now();

    // Priority Check: Critical error or active confirmation cannot be clobbered by standard voice
    const currentScore = getSurfacePriorityScore(prev);
    if (currentScore >= 35 && intent.voiceState !== 'error') {
      // Retain active confirmation or critical error
      return prev;
    }

    // Cancel collapse timer when active voice interaction resumes (except sleeping during response hold)
    if (intent.voiceState !== 'sleeping' || (prev.mode !== 'compact_response' && prev.mode !== 'expanded_response')) {
      this.clearActiveTimer();
    }

    // Pure telemetry update: preserve current mode/activity, only update levels appropriate for active mode
    if (!intent.voiceState) {
      if (prev.mode === 'listening') {
        const nextInputLevel = intent.inputLevel ?? prev.inputLevel;
        if (nextInputLevel === prev.inputLevel && prev.outputLevel === 0) {
          return prev;
        }
        return this.updateSnapshot({
          inputLevel: nextInputLevel,
          outputLevel: 0,
          updatedAt: now
        });
      }

      if (prev.mode === 'speaking') {
        const nextOutputLevel = intent.outputLevel ?? prev.outputLevel;
        if (nextOutputLevel === prev.outputLevel && prev.inputLevel === 0) {
          return prev;
        }
        return this.updateSnapshot({
          inputLevel: 0,
          outputLevel: nextOutputLevel,
          updatedAt: now
        });
      }

      // In ambient, thinking, or error modes, audio level telemetry is ignored to avoid jitter
      return prev;
    }

    const activeSizeClass = prev.pinned ? prev.sizeClass : 'compact';
    const activeFocusIntent = prev.focusIntent === 'request' ? 'request' : 'preserve';

    switch (intent.voiceState) {
      case 'sleeping': {
        if (prev.mode === 'compact_response' || prev.mode === 'expanded_response') {
          // Response Hold Invariant (M4.6):
          // Preserve response card until hold timer expires or user dismisses/interacts.
          return prev;
        }
        this.clearActiveTimer();
        this.streamingClassifier.reset();
        this.accumulatedAssistantText = '';
        return this.updateSnapshot({
          mode: 'ambient',
          sizeClass: prev.pinned ? prev.sizeClass : 'ambient',
          interactionMode: 'passive',
          focusIntent: prev.focusIntent === 'request' ? 'release' : 'preserve', // Clean release on return to ambient
          activity: 'idle',
          source: 'voice',
          priority: 'normal',
          inputLevel: 0,
          outputLevel: 0,
          assistantText: undefined,
          content: undefined,
          autoCollapse: undefined,
          sessionId: intent.sessionId,
          updatedAt: now
        });
      }

      case 'waking': {
        this.clearActiveTimer();
        this.streamingClassifier.reset();
        this.accumulatedAssistantText = '';
        return this.updateSnapshot({
          mode: 'listening',
          visibility: 'visible',
          sizeClass: activeSizeClass,
          interactionMode: 'passive',
          focusIntent: activeFocusIntent,
          activity: 'listening',
          source: 'voice',
          priority: 'normal',
          inputLevel: intent.inputLevel ?? 0,
          outputLevel: 0,
          assistantText: undefined,
          content: undefined,
          autoCollapse: undefined,
          sessionId: intent.sessionId,
          updatedAt: now
        });
      }

      case 'listening': {
        this.clearActiveTimer();
        return this.updateSnapshot({
          mode: 'listening',
          visibility: 'visible',
          sizeClass: activeSizeClass,
          interactionMode: 'passive',
          focusIntent: activeFocusIntent,
          activity: 'listening',
          source: 'voice',
          inputLevel: intent.inputLevel ?? prev.inputLevel,
          outputLevel: 0,
          transcript: intent.transcript ?? prev.transcript,
          sessionId: intent.sessionId ?? prev.sessionId,
          updatedAt: now
        });
      }

      case 'transcribing': {
        // TRANSCRIBING FOLD:
        // Visually folded into 'listening' to eliminate high-frequency visual flicker (<600ms)
        return this.updateSnapshot({
          mode: 'listening',
          visibility: 'visible',
          sizeClass: activeSizeClass,
          interactionMode: 'passive',
          focusIntent: activeFocusIntent,
          activity: 'listening',
          source: 'voice',
          inputLevel: intent.inputLevel ?? prev.inputLevel,
          outputLevel: 0,
          transcript: intent.transcript ?? prev.transcript,
          sessionId: intent.sessionId ?? prev.sessionId,
          updatedAt: now
        });
      }

      case 'thinking': {
        this.clearActiveTimer();
        return this.updateSnapshot({
          mode: 'thinking',
          visibility: 'visible',
          sizeClass: activeSizeClass,
          interactionMode: 'passive',
          focusIntent: activeFocusIntent,
          activity: 'thinking',
          source: 'voice',
          inputLevel: 0,
          outputLevel: 0,
          transcript: intent.transcript ?? prev.transcript,
          sessionId: intent.sessionId ?? prev.sessionId,
          updatedAt: now
        });
      }

      case 'speaking': {
        this.clearActiveTimer();
        let currentAssistantText = prev.assistantText;
        if (intent.assistantText !== undefined) {
          if (this.accumulatedAssistantText.length > 0 && intent.assistantText.startsWith(this.accumulatedAssistantText)) {
            this.accumulatedAssistantText = intent.assistantText;
          } else if (this.accumulatedAssistantText.length > 0 && !intent.assistantText.includes(this.accumulatedAssistantText)) {
            this.accumulatedAssistantText += intent.assistantText;
          } else {
            this.accumulatedAssistantText = intent.assistantText;
          }
          currentAssistantText = this.accumulatedAssistantText;
        }

        let classification: ClassificationResult | undefined;
        if (currentAssistantText && currentAssistantText.length > 0) {
          classification = this.streamingClassifier.feedChunk(
            intent.assistantText && !intent.assistantText.startsWith(this.streamingClassifier.getAccumulatedText())
              ? intent.assistantText
              : currentAssistantText
          );
        }

        // Determine sizeClass:
        // Pinned state preserves user footprint
        // Semantic classifier promotes to expanded if code/table/long
        // Minimum speakable content (>= 4 chars trimmed) expands capsule to card envelope
        let targetSizeClass = activeSizeClass;
        if (!prev.pinned) {
          if (classification?.isExpanded) {
            targetSizeClass = 'expanded';
          } else if (currentAssistantText && currentAssistantText.trim().length >= 4) {
            targetSizeClass = 'card';
          }
        }

        // When assistant speech concludes (isSpeakingFinished: true)
        const isSpeakingFinished = intent.isSpeakingFinished === true;
        if (isSpeakingFinished && currentAssistantText && currentAssistantText.trim().length > 0) {
          const mode: SurfaceMode = classification?.isExpanded ? 'expanded_response' : 'compact_response';
          const isShortStatus =
            classification?.blocks.some((b) => b.type === 'status') ||
            (currentAssistantText.trim().length > 0 && currentAssistantText.trim().length <= 6);
          const afterMs = prev.pinned
            ? 0
            : isShortStatus
            ? DEFAULT_AUTO_COLLAPSE_VOICE_MS
            : classification?.isExpanded
            ? DEFAULT_AUTO_COLLAPSE_EXPANDED_MS
            : DEFAULT_AUTO_COLLAPSE_COMPACT_MS;

          const autoCollapse: AutoCollapsePolicy | undefined = prev.pinned
            ? { enabled: false, afterMs: 0, targetMode: 'ambient' }
            : { enabled: true, afterMs, targetMode: 'ambient' };

          if (autoCollapse.enabled) {
            this.scheduleCollapse(autoCollapse.afterMs, autoCollapse.targetMode);
          }

          return this.updateSnapshot({
            mode,
            visibility: 'visible',
            sizeClass: targetSizeClass,
            interactionMode: classification?.isExpanded ? 'interactive' : 'passive',
            focusIntent: activeFocusIntent,
            activity: 'idle',
            source: 'voice',
            inputLevel: 0,
            outputLevel: 0,
            assistantText: currentAssistantText,
            content: classification?.blocks,
            autoCollapse,
            sessionId: intent.sessionId ?? prev.sessionId,
            updatedAt: now
          });
        }

        return this.updateSnapshot({
          mode: 'speaking',
          visibility: 'visible',
          sizeClass: targetSizeClass,
          interactionMode: 'passive',
          focusIntent: activeFocusIntent,
          activity: 'speaking',
          source: 'voice',
          inputLevel: 0,
          outputLevel: intent.outputLevel ?? prev.outputLevel,
          assistantText: currentAssistantText,
          content: classification?.blocks ?? prev.content,
          sessionId: intent.sessionId ?? prev.sessionId,
          updatedAt: now
        });
      }

      case 'interrupted': {
        // BARGE-IN VISUAL YIELD:
        // Pivots immediately from speaking waveform to listening waveform in <50ms.
        // Never displays warning rings, error banners, or interrupt flashes.
        this.clearActiveTimer();
        this.accumulatedAssistantText = '';
        this.streamingClassifier.reset();
        return this.updateSnapshot({
          mode: 'listening',
          visibility: 'visible',
          sizeClass: activeSizeClass,
          interactionMode: 'passive',
          focusIntent: activeFocusIntent,
          activity: 'listening',
          source: 'voice',
          inputLevel: intent.inputLevel ?? 0,
          outputLevel: 0, // Clears assistant audio output level instantly
          assistantText: undefined,
          content: undefined,
          autoCollapse: undefined,
          sessionId: intent.sessionId ?? prev.sessionId,
          updatedAt: now
        });
      }

      case 'error': {
        const error = intent.error ?? {
          code: 'VOICE_ERROR',
          message: 'Voice error occurred',
          severity: 'error',
          recoverable: true
        };
        const autoCollapse: AutoCollapsePolicy = {
          enabled: true,
          afterMs: DEFAULT_AUTO_COLLAPSE_ERROR_MS,
          targetMode: 'ambient'
        };
        this.scheduleCollapse(autoCollapse.afterMs, autoCollapse.targetMode);

        return this.updateSnapshot({
          mode: 'error',
          sizeClass: activeSizeClass,
          interactionMode: 'passive',
          focusIntent: 'preserve',
          activity: 'error',
          source: 'voice',
          priority: 'high',
          error,
          autoCollapse,
          sessionId: intent.sessionId ?? prev.sessionId,
          updatedAt: now
        });
      }
    }
  }

  private handleShowResponse(
    intent: Extract<SurfacePresentationIntent, { type: 'show_response' }>
  ): SurfaceSnapshot {
    const prev = this.currentSnapshot;
    const now = this.clock.now();

    // Priority Check
    const currentScore = getSurfacePriorityScore(prev);
    const incomingScore = SURFACE_PRIORITY_WEIGHTS[intent.priority || 'normal'];
    if (currentScore > incomingScore && !prev.pinned) {
      return prev;
    }

    let classification: ClassificationResult;
    if (intent.streaming && intent.text) {
      classification = this.streamingClassifier.feedChunk(intent.text);
    } else {
      classification = classifyResponseContent({
        text: intent.text,
        blocks: intent.blocks,
        priority: intent.priority
      });
    }

    const mode = classification.mode;
    const sizeClass = classification.sizeClass;
    const content = classification.blocks;
    const assistantText = intent.text || this.streamingClassifier.getAccumulatedText();

    let autoCollapse: AutoCollapsePolicy | undefined;
    if (prev.pinned) {
      autoCollapse = { enabled: false, afterMs: 0, targetMode: 'ambient' };
    } else {
      const isShortStatus = classification.blocks.some((b) => b.type === 'status');
      const defaultTimeout = classification.isExpanded
        ? DEFAULT_AUTO_COLLAPSE_EXPANDED_MS
        : isShortStatus
        ? DEFAULT_AUTO_COLLAPSE_VOICE_MS
        : DEFAULT_AUTO_COLLAPSE_COMPACT_MS;
      autoCollapse = {
        enabled: true,
        afterMs: intent.autoCollapseMs ?? defaultTimeout,
        targetMode: 'ambient'
      };
      this.scheduleCollapse(autoCollapse.afterMs, autoCollapse.targetMode);
    }

    return this.updateSnapshot({
      mode,
      sizeClass,
      interactionMode: classification.isExpanded ? 'interactive' : 'passive',
      focusIntent: prev.focusIntent === 'request' ? 'request' : 'preserve', // Response presentation never steals OS focus
      activity: 'idle',
      source: intent.source ?? 'conversation',
      priority: intent.priority || 'normal',
      assistantText: assistantText.length > 0 ? assistantText : undefined,
      content: content.length > 0 ? content : undefined,
      autoCollapse,
      sessionId: intent.sessionId ?? prev.sessionId,
      updatedAt: now
    });
  }

  private handleShowConfirmation(
    intent: Extract<SurfacePresentationIntent, { type: 'show_confirmation' }>
  ): SurfaceSnapshot {
    this.clearActiveTimer();
    const now = this.clock.now();

    const autoCollapse: AutoCollapsePolicy | undefined = intent.autoRejectMs
      ? { enabled: true, afterMs: intent.autoRejectMs, targetMode: 'ambient' }
      : undefined;

    if (autoCollapse) {
      this.scheduleCollapse(autoCollapse.afterMs, autoCollapse.targetMode);
    }

    return this.updateSnapshot({
      mode: 'confirmation',
      sizeClass: 'card',
      interactionMode: 'interactive',
      focusIntent: 'preserve', // Passive arrival preserves focus until user clicks
      activity: 'waiting_for_user',
      source: intent.source ?? 'permission',
      priority: intent.priority ?? 'high',
      content: [intent.confirmation],
      autoCollapse,
      updatedAt: now
    });
  }

  private handleShowProgress(
    intent: Extract<SurfacePresentationIntent, { type: 'show_progress' }>
  ): SurfaceSnapshot {
    const prev = this.currentSnapshot;
    const now = this.clock.now();

    // Priority Check: If higher priority item is active, don't displace primary mode
    const currentScore = getSurfacePriorityScore(prev);
    const incomingScore = SURFACE_PRIORITY_WEIGHTS[intent.priority || 'normal'];
    if (currentScore > incomingScore) {
      return prev;
    }

    return this.updateSnapshot({
      mode: 'progress',
      sizeClass: 'compact',
      interactionMode: 'passive',
      focusIntent: 'preserve',
      activity: 'working',
      source: intent.source ?? 'task',
      priority: intent.priority ?? 'normal',
      content: [intent.progress],
      updatedAt: now
    });
  }

  private handleShowError(
    intent: Extract<SurfacePresentationIntent, { type: 'show_error' }>
  ): SurfaceSnapshot {
    this.clearActiveTimer();
    const now = this.clock.now();

    const autoCollapse: AutoCollapsePolicy = {
      enabled: true,
      afterMs: intent.autoDismissMs ?? DEFAULT_AUTO_COLLAPSE_ERROR_MS,
      targetMode: 'ambient'
    };
    this.scheduleCollapse(autoCollapse.afterMs, autoCollapse.targetMode);

    return this.updateSnapshot({
      mode: 'error',
      sizeClass: 'compact',
      interactionMode: 'passive',
      focusIntent: 'preserve',
      activity: 'error',
      source: intent.source ?? 'system',
      priority: intent.priority ?? 'high',
      error: intent.error,
      autoCollapse,
      updatedAt: now
    });
  }

  private handleResetToAmbient(force = false): SurfaceSnapshot {
    const prev = this.currentSnapshot;
    if (prev.pinned && !force) {
      return prev;
    }

    this.clearActiveTimer();
    this.streamingClassifier.reset();
    this.accumulatedAssistantText = '';

    return this.updateSnapshot({
      mode: 'ambient',
      sizeClass: 'ambient',
      interactionMode: 'passive',
      focusIntent: 'preserve',
      pinned: false,
      activity: 'idle',
      source: 'voice',
      priority: 'normal',
      inputLevel: 0,
      outputLevel: 0,
      assistantText: undefined,
      content: undefined,
      autoCollapse: undefined,
      error: undefined,
      updatedAt: this.clock.now()
    });
  }

  /* ------------------------------------------------------------------
   * Helper Methods
   * ------------------------------------------------------------------ */

  private updateSnapshot(partial: Partial<SurfaceSnapshot>): SurfaceSnapshot {
    this.currentSnapshot = {
      ...this.currentSnapshot,
      ...partial
    };

    const immutableCopy = this.getSnapshot();
    for (const listener of this.subscribers) {
      try {
        listener(immutableCopy);
      } catch (err) {
        console.error('Error in SurfaceStateController subscriber:', err);
      }
    }

    return immutableCopy;
  }

  /**
   * Reports pointer enter/leave over the visible surface container.
   * Pauses auto-collapse while hovering and restarts inactivity timer on unhover.
   */
  public setUserHovering(hovering: boolean): void {
    this.isUserHovering = hovering;
    if (hovering) {
      // Pause active collapse timer while user is interacting with visible card
      this.clearActiveTimer();
    } else {
      // Mouse left: restart inactivity timer if in response mode and unpinned
      const current = this.currentSnapshot;
      if (!current.pinned && (current.mode === 'compact_response' || current.mode === 'expanded_response')) {
        const afterMs = current.mode === 'expanded_response'
          ? DEFAULT_AUTO_COLLAPSE_EXPANDED_MS
          : DEFAULT_AUTO_COLLAPSE_COMPACT_MS;
        this.scheduleCollapse(afterMs, 'ambient');
      }
    }
  }

  /**
   * Resets the canonical response inactivity timer.
   */
  public resetInactivityTimer(): void {
    const current = this.currentSnapshot;
    if (!current.pinned && (current.mode === 'compact_response' || current.mode === 'expanded_response')) {
      const afterMs = current.mode === 'expanded_response'
        ? DEFAULT_AUTO_COLLAPSE_EXPANDED_MS
        : DEFAULT_AUTO_COLLAPSE_COMPACT_MS;
      this.scheduleCollapse(afterMs, 'ambient');
    }
  }

  private clearActiveTimer(): void {
    this.activeTimerRevision++;
    if (this.activeTimerId !== null) {
      this.clock.clearTimeout(this.activeTimerId);
      this.activeTimerId = null;
    }
  }

  private scheduleCollapse(afterMs: number, targetMode: SurfaceMode): void {
    if (!this.enableTimers) return;
    this.clearActiveTimer();
    const scheduledRevision = this.activeTimerRevision;

    this.activeTimerId = this.clock.setTimeout(() => {
      this.activeTimerId = null;
      // Stale protection: reject if another transition or action superseded this timer
      if (this.activeTimerRevision !== scheduledRevision) {
        return;
      }
      // Hover and focus protection: do not collapse while user is reading, hovering, or focused
      if (this.isUserHovering || this.currentSnapshot.focusIntent === 'request') {
        return;
      }
      if (!this.currentSnapshot.pinned) {
        this.accumulatedAssistantText = '';
        this.streamingClassifier.reset();
        this.updateSnapshot({
          mode: targetMode,
          sizeClass: targetMode === 'ambient' ? 'ambient' : 'compact',
          interactionMode: 'passive',
          focusIntent: 'preserve',
          activity: 'idle',
          inputLevel: 0,
          outputLevel: 0,
          assistantText: undefined,
          content: undefined,
          autoCollapse: undefined,
          updatedAt: this.clock.now()
        });
      }
    }, afterMs);
  }
}
