import { randomUUID } from 'node:crypto';
import type {
  BrainCapabilities,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ConversationStore,
  RouteTelemetry,
  Session
} from '@mave/contracts';
import type { BrainRouter } from '../brain/router.js';
import { ContextManager } from './context-manager.js';
import type { SessionManager } from './session-manager.js';
import {
  ConversationRuntimeError,
  type ConversationRequest,
  type ConversationRequestOptions,
  type ConversationRuntimeEvent
} from './runtime-types.js';

export interface ConversationRuntimeOptions {
  sessionManager: SessionManager;
  contextManager?: ContextManager;
  router: BrainRouter;
  store?: ConversationStore;
  requestIdFactory?: () => string;
  clock?: () => number;
  defaultTimeoutMs?: number;
}

interface ActiveRequestRecord {
  requestId: string;
  sessionId: string;
  abortController: AbortController;
  provider?: BrainProvider;
  assistantTurnId?: string;
  timeoutTimer: NodeJS.Timeout | null;
  isTimedOut: boolean;
  isExplicitlyCancelled: boolean;
  terminalEmitted: 'completed' | 'cancelled' | 'failed' | null;
  executionTelemetry?: RouteTelemetry;
}

const DEFAULT_REQUIRED_CAPABILITIES: Partial<BrainCapabilities> = {
  streaming: true,
  fastChat: true
};

export class ConversationRuntime {
  private readonly sessionManager: SessionManager;
  private readonly contextManager: ContextManager;
  private readonly router: BrainRouter;
  private readonly store?: ConversationStore;
  private readonly requestIdFactory: () => string;
  private readonly clock: () => number;
  private readonly defaultTimeoutMs: number;

  private readonly activeRequests = new Map<string, ActiveRequestRecord>();
  private readonly lastExecutionTelemetry = new Map<string, RouteTelemetry>();

  getExecutionTelemetry(requestId: string): RouteTelemetry | undefined {
    return this.activeRequests.get(requestId)?.executionTelemetry ?? this.lastExecutionTelemetry.get(requestId);
  }

  constructor(options: ConversationRuntimeOptions) {
    this.sessionManager = options.sessionManager;
    this.contextManager = options.contextManager ?? new ContextManager();
    this.router = options.router;
    this.store = options.store;
    this.requestIdFactory = options.requestIdFactory ?? (() => randomUUID());
    this.clock = options.clock ?? (() => Date.now());
    this.defaultTimeoutMs =
      options.defaultTimeoutMs !== undefined && options.defaultTimeoutMs > 0
        ? options.defaultTimeoutMs
        : 30000;
  }

  /**
   * Loads an existing session by ID. If not already in-memory, attempts to
   * load and hydrate from the persistent ConversationStore if available.
   */
  async loadSession(sessionId: string): Promise<Session | undefined> {
    if (!sessionId || typeof sessionId !== 'string') {
      return undefined;
    }
    const trimmed = sessionId.trim();
    if (this.sessionManager.hasSession(trimmed)) {
      return this.sessionManager.getSession(trimmed);
    }
    if (!this.store) {
      return undefined;
    }
    const storedSession = await this.store.getSession(trimmed);
    if (!storedSession) {
      return undefined;
    }
    const storedTurns = await this.store.getTurns(trimmed);
    return this.sessionManager.hydrateSession(storedSession, storedTurns);
  }

  /**
   * Orchestrates a single conversation request end-to-end, yielding normalized streaming events.
   */
  async *send(
    request: ConversationRequest,
    options?: ConversationRequestOptions
  ): AsyncIterable<ConversationRuntimeEvent> {
    // 1. Validate request message
    if (!request || typeof request.message !== 'string' || !request.message.trim()) {
      throw new ConversationRuntimeError('invalid_request', 'Message cannot be empty');
    }

    // 2. Validate explicit requestId if provided
    if (request.requestId !== undefined) {
      if (typeof request.requestId !== 'string' || !request.requestId.trim()) {
        throw new ConversationRuntimeError('invalid_request', 'Explicit requestId cannot be empty');
      }
    }

    // 3. Validate timeoutMs if provided
    if (options?.timeoutMs !== undefined) {
      if (
        typeof options.timeoutMs !== 'number' ||
        Number.isNaN(options.timeoutMs) ||
        options.timeoutMs <= 0 ||
        !Number.isFinite(options.timeoutMs)
      ) {
        throw new ConversationRuntimeError('invalid_request', 'timeoutMs must be a positive number');
      }
    }

    const effectiveTimeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const requestId = request.requestId ? request.requestId.trim() : this.requestIdFactory();

    // 4. Reject duplicate active requestId
    if (this.activeRequests.has(requestId)) {
      throw new ConversationRuntimeError(
        'duplicate_request',
        `An active request with ID '${requestId}' is already in progress`,
        { requestId }
      );
    }

    // Setup AbortController and active tracking early so cleanup always executes
    const abortController = new AbortController();
    if (options?.signal) {
      if (options.signal.aborted) {
        abortController.abort(options.signal.reason);
      } else {
        options.signal.addEventListener('abort', () => abortController.abort(options.signal?.reason), { once: true });
      }
    }

    const record: ActiveRequestRecord = {
      requestId,
      sessionId: request.sessionId ? request.sessionId.trim() : '',
      abortController,
      timeoutTimer: null,
      isTimedOut: false,
      isExplicitlyCancelled: false,
      terminalEmitted: null
    };
    this.activeRequests.set(requestId, record);

    if (effectiveTimeoutMs > 0 && Number.isFinite(effectiveTimeoutMs)) {
      record.timeoutTimer = setTimeout(() => {
        if (record.terminalEmitted) {
          return;
        }
        record.isTimedOut = true;
        abortController.abort(`Request exceeded timeout of ${effectiveTimeoutMs}ms`);
        if (record.provider?.cancel) {
          record.provider.cancel(requestId).catch(() => {});
        }
      }, effectiveTimeoutMs);
    }

    try {
      // 5. Resolve / Create Session
      let sessionId: string;
      let isNewSession = false;

      if (request.sessionId !== undefined) {
        const trimmedSessionId = request.sessionId.trim();
        if (!this.sessionManager.hasSession(trimmedSessionId)) {
          // Attempt on-demand load and hydration from persistent store
          if (this.store) {
            try {
              const storedSession = await this.store.getSession(trimmedSessionId);
              if (storedSession) {
                const storedTurns = await this.store.getTurns(trimmedSessionId);
                this.sessionManager.hydrateSession(storedSession, storedTurns);
              }
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Persistence error loading session';
              record.terminalEmitted = 'failed';
              yield {
                type: 'request_failed',
                requestId,
                sessionId: trimmedSessionId,
                error: {
                  code: 'persistence_error',
                  message: errorMsg
                },
                timestamp: this.clock()
              };
              if (options?.throwOnError) {
                throw new ConversationRuntimeError('persistence_error', errorMsg, {
                  requestId,
                  sessionId: trimmedSessionId
                });
              }
              return;
            }
          }
        }

        if (!this.sessionManager.hasSession(trimmedSessionId)) {
          throw new ConversationRuntimeError(
            'session_not_found',
            `Session '${trimmedSessionId}' not found`,
            { requestId, sessionId: trimmedSessionId }
          );
        }

        const existingSession = this.sessionManager.requireSession(trimmedSessionId);
        if (existingSession.status === 'ended') {
          throw new ConversationRuntimeError(
            'session_ended',
            `Session '${trimmedSessionId}' has already ended`,
            { requestId, sessionId: trimmedSessionId }
          );
        }
        sessionId = trimmedSessionId;
      } else {
        const createdSession = this.sessionManager.createSession();
        sessionId = createdSession.id;
        isNewSession = true;
      }

      record.sessionId = sessionId;

      // 6. Check same-session concurrency policy: reject concurrent request for same session
      for (const [activeReqId, active] of this.activeRequests.entries()) {
        if (activeReqId !== requestId && active.sessionId === sessionId) {
          throw new ConversationRuntimeError(
            'session_busy',
            `Session '${sessionId}' already has an active request in progress`,
            { requestId, sessionId }
          );
        }
      }

      // Early timeout / cancellation check
      if (record.isTimedOut) {
        record.terminalEmitted = 'failed';
        yield {
          type: 'request_failed',
          requestId,
          sessionId,
          error: {
            code: 'provider_timeout',
            message: `Request exceeded timeout of ${effectiveTimeoutMs}ms`,
            retryable: true
          },
          timestamp: this.clock()
        };
        if (options?.throwOnError) {
          throw new ConversationRuntimeError('provider_timeout', `Request exceeded timeout of ${effectiveTimeoutMs}ms`, {
            requestId,
            sessionId
          });
        }
        return;
      }

      if (abortController.signal.aborted) {
        record.terminalEmitted = 'cancelled';
        yield {
          type: 'request_cancelled',
          requestId,
          sessionId,
          reason: 'Request was aborted before execution',
          timestamp: this.clock()
        };
        return;
      }

      // 7. Emit request_started and session_ready
      yield {
        type: 'request_started',
        requestId,
        sessionId,
        timestamp: this.clock()
      };

      // Persist newly created session to store
      if (isNewSession && this.store) {
        try {
          const session = this.sessionManager.requireSession(sessionId);
          await this.store.createSession(session);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to persist created session';
          record.terminalEmitted = 'failed';
          yield {
            type: 'request_failed',
            requestId,
            sessionId,
            error: {
              code: 'persistence_error',
              message: errorMsg
            },
            timestamp: this.clock()
          };
          if (options?.throwOnError) {
            throw new ConversationRuntimeError('persistence_error', errorMsg, { requestId, sessionId });
          }
          return;
        }
      }

      yield {
        type: 'session_ready',
        requestId,
        sessionId,
        timestamp: this.clock()
      };

      if (record.isTimedOut) {
        record.terminalEmitted = 'failed';
        yield {
          type: 'request_failed',
          requestId,
          sessionId,
          error: {
            code: 'provider_timeout',
            message: `Request exceeded timeout of ${effectiveTimeoutMs}ms`,
            retryable: true
          },
          timestamp: this.clock()
        };
        if (options?.throwOnError) {
          throw new ConversationRuntimeError('provider_timeout', `Request exceeded timeout of ${effectiveTimeoutMs}ms`, {
            requestId,
            sessionId
          });
        }
        return;
      }

      if (abortController.signal.aborted) {
        record.terminalEmitted = 'cancelled';
        yield {
          type: 'request_cancelled',
          requestId,
          sessionId,
          reason: 'Request was aborted before execution',
          timestamp: this.clock()
        };
        return;
      }

      // 8. Append user turn as completed
      const userTurn = this.sessionManager.appendTurn(sessionId, {
        requestId,
        role: 'user',
        content: request.message.trim(),
        status: 'completed'
      });

      if (this.store) {
        try {
          await this.store.createTurn(userTurn);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to persist user turn';
          record.terminalEmitted = 'failed';
          yield {
            type: 'request_failed',
            requestId,
            sessionId,
            error: {
              code: 'persistence_error',
              message: errorMsg
            },
            timestamp: this.clock()
          };
          if (options?.throwOnError) {
            throw new ConversationRuntimeError('persistence_error', errorMsg, { requestId, sessionId });
          }
          return;
        }
      }

      // 9. Build conversation context
      const turns = this.sessionManager.getTurns(sessionId);
      const session = this.sessionManager.requireSession(sessionId);
      const contextBundle = this.contextManager.build(session, turns);

      // 10. Route to BrainProvider
      const requiredCapabilities: Partial<BrainCapabilities> | undefined =
        request.requiredCapabilities !== undefined
          ? request.requiredCapabilities
          : request.profileId !== undefined
            ? undefined
            : DEFAULT_REQUIRED_CAPABILITIES;

      let routeDecision;
      try {
        routeDecision = await this.router.route({
          preferredProviderId: request.preferredProviderId,
          preferredModelId: request.preferredModelId,
          profileId: request.profileId,
          requiredCapabilities,
          overrides: request.overrides,
          localOnly: request.localOnly,
          allowFallback: request.allowFallback,
          signal: abortController.signal
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorCode =
          err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
            ? err.code
            : 'routing_error';

        record.terminalEmitted = 'failed';
        yield {
          type: 'request_failed',
          requestId,
          sessionId,
          error: {
            code: errorCode,
            message: errorMsg
          },
          timestamp: this.clock()
        };

        if (options?.throwOnError) {
          throw new ConversationRuntimeError('routing_error', errorMsg, { requestId, sessionId });
        }
        return;
      }

      const { provider, providerId, fallbackUsed, reason } = routeDecision;
      record.provider = provider;
      const updatedSession = this.sessionManager.updateActiveProviderId(sessionId, providerId);

      if (this.store) {
        try {
          await this.store.updateSession(updatedSession);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to persist session provider update';
          record.terminalEmitted = 'failed';
          yield {
            type: 'request_failed',
            requestId,
            sessionId,
            error: {
              code: 'persistence_error',
              message: errorMsg
            },
            timestamp: this.clock()
          };
          if (options?.throwOnError) {
            throw new ConversationRuntimeError('persistence_error', errorMsg, { requestId, sessionId });
          }
          return;
        }
      }

      yield {
        type: 'provider_selected',
        requestId,
        sessionId,
        providerId,
        fallbackUsed,
        reason,
        timestamp: this.clock()
      };

      if (record.isTimedOut) {
        record.terminalEmitted = 'failed';
        yield {
          type: 'request_failed',
          requestId,
          sessionId,
          error: {
            code: 'provider_timeout',
            message: `Request exceeded timeout of ${effectiveTimeoutMs}ms`,
            retryable: true
          },
          timestamp: this.clock()
        };
        if (options?.throwOnError) {
          throw new ConversationRuntimeError('provider_timeout', `Request exceeded timeout of ${effectiveTimeoutMs}ms`, {
            requestId,
            sessionId
          });
        }
        return;
      }

      if (abortController.signal.aborted) {
        record.terminalEmitted = 'cancelled';
        yield {
          type: 'request_cancelled',
          requestId,
          sessionId,
          reason: 'Request was cancelled before provider stream started',
          timestamp: this.clock()
        };
        return;
      }

      // 11. Create assistant pending turn
      const assistantTurn = this.sessionManager.appendTurn(sessionId, {
        requestId,
        role: 'assistant',
        content: '',
        providerId,
        status: 'pending'
      });
      record.assistantTurnId = assistantTurn.id;

      if (this.store) {
        try {
          await this.store.createTurn(assistantTurn);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to persist assistant turn';
          record.terminalEmitted = 'failed';
          yield {
            type: 'request_failed',
            requestId,
            sessionId,
            turnId: assistantTurn.id,
            error: {
              code: 'persistence_error',
              message: errorMsg
            },
            timestamp: this.clock()
          };
          if (options?.throwOnError) {
            throw new ConversationRuntimeError('persistence_error', errorMsg, { requestId, sessionId });
          }
          return;
        }
      }

      // 12. Enforce Direct Model Invariant & Transition Execution Telemetry
      const isAgentRuntime =
        routeDecision.providerKind === 'agent_runtime_provider' ||
        routeDecision.providerId === 'antigravity' ||
        routeDecision.providerId === 'claude-code' ||
        routeDecision.providerId === 'codex';

      if (!isAgentRuntime && !routeDecision.modelId) {
        const errorMsg = `Direct model provider '${providerId}' requires a resolved modelId for execution`;
        record.terminalEmitted = 'failed';
        yield {
          type: 'request_failed',
          requestId,
          sessionId,
          error: {
            code: 'routing_error',
            message: errorMsg
          },
          timestamp: this.clock()
        };
        if (options?.throwOnError) {
          throw new ConversationRuntimeError('routing_error', errorMsg, { requestId, sessionId });
        }
        return;
      }

      const executionTelemetry: RouteTelemetry = {
        selectedProviderId: routeDecision.providerId,
        selectedModelId: routeDecision.modelId,
        profileId: routeDecision.profileId,
        routeReason: routeDecision.routeReason,
        fallbackUsed: routeDecision.fallbackUsed,
        attemptedProviderIds: [routeDecision.providerId],
        attemptedModelIds: isAgentRuntime || !routeDecision.modelId
          ? []
          : [routeDecision.modelId],
        routeAttempts: 1
      };
      record.executionTelemetry = executionTelemetry;
      this.lastExecutionTelemetry.set(requestId, executionTelemetry);

      // 13. Construct canonical BrainRequest preserving caller context and provenance
      const brainRequest: BrainRequest = {
        requestId,
        sessionId,
        intent: 'conversation',
        messages: contextBundle.messages,
        context: {
          ...contextBundle.context,
          ...request.context
        },
        overrides: request.overrides,
        localOnly: request.localOnly
      };

      // 14. Consume BrainEvent stream from provider with typed invocation options
      let accumulatedText = '';
      let hasStarted = false;

      const brainOptions: BrainRequestOptions = {
        signal: abortController.signal,
        modelId: routeDecision.modelId
      };

      const chatIterator = provider.chat(brainRequest, brainOptions)[Symbol.asyncIterator]();

      try {
        while (true) {
          if (record.terminalEmitted) {
            break;
          }

          if (record.isTimedOut || abortController.signal.aborted) {
            try {
              await chatIterator.return?.();
            } catch {
              // safe disposal
            }
            break;
          }

          // Race next() against abort signal
          let abortListener: (() => void) | undefined;
          const abortPromise = new Promise<{ done: true; value: undefined; aborted: true }>((resolve) => {
            if (abortController.signal.aborted || record.isTimedOut) {
              resolve({ done: true, value: undefined, aborted: true });
            } else {
              abortListener = () => resolve({ done: true, value: undefined, aborted: true });
              abortController.signal.addEventListener('abort', abortListener, { once: true });
            }
          });

          const nextResult = await Promise.race([
            chatIterator.next().then((res) => ({ ...res, aborted: false as const })),
            abortPromise
          ]);

          if (abortListener) {
            abortController.signal.removeEventListener('abort', abortListener);
          }

          if (nextResult.aborted || record.isTimedOut || abortController.signal.aborted) {
            try {
              await chatIterator.return?.();
            } catch {
              // safe disposal
            }
            break;
          }

          if (nextResult.done) {
            break;
          }

          const event = nextResult.value;

          if (record.terminalEmitted) {
            break;
          }

          if (event.type === 'started') {
            hasStarted = true;
            this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'streaming'
            });
            yield {
              type: 'response_started',
              requestId,
              sessionId,
              turnId: assistantTurn.id,
              providerId,
              timestamp: this.clock()
            };
          } else if (event.type === 'delta') {
            if (record.terminalEmitted) {
              break;
            }

            if (!hasStarted) {
              hasStarted = true;
              this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
                status: 'streaming'
              });
              yield {
                type: 'response_started',
                requestId,
                sessionId,
                turnId: assistantTurn.id,
                providerId,
                timestamp: this.clock()
              };
            }

            accumulatedText += event.text;
            this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'streaming',
              content: accumulatedText
            });

            yield {
              type: 'response_delta',
              requestId,
              sessionId,
              turnId: assistantTurn.id,
              text: event.text,
              timestamp: this.clock()
            };
          } else if (event.type === 'completed') {
            if (record.terminalEmitted) {
              break;
            }

            record.terminalEmitted = 'completed';
            if (record.timeoutTimer) {
              clearTimeout(record.timeoutTimer);
              record.timeoutTimer = null;
            }

            const finalText = accumulatedText.length > 0 ? accumulatedText : (event.text ?? '');
            const finalCompletedTurn = this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'completed',
              content: finalText
            });

            if (this.store) {
              try {
                await this.store.updateTurn(finalCompletedTurn);
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Failed to persist completed assistant turn';
                yield {
                  type: 'request_failed',
                  requestId,
                  sessionId,
                  turnId: assistantTurn.id,
                  error: {
                    code: 'persistence_error',
                    message: errorMsg
                  },
                  timestamp: this.clock()
                };
                if (options?.throwOnError) {
                  throw new ConversationRuntimeError('persistence_error', errorMsg, {
                    requestId,
                    sessionId
                  });
                }
                return;
              }
            }

            yield {
              type: 'response_completed',
              requestId,
              sessionId,
              turnId: assistantTurn.id,
              text: finalText,
              finishReason: event.finishReason,
              usage: event.usage,
              timestamp: this.clock()
            };
            return;
          } else if (event.type === 'cancelled') {
            if (record.terminalEmitted) {
              break;
            }

            if (record.isTimedOut) {
              // Timeout takes precedence over provider cancelled event
              record.terminalEmitted = 'failed';
              if (record.timeoutTimer) {
                clearTimeout(record.timeoutTimer);
                record.timeoutTimer = null;
              }

              const timeoutMsg = `Request exceeded timeout of ${effectiveTimeoutMs}ms`;
              const finalFailedTurn = this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
                status: 'failed',
                content: accumulatedText,
                error: timeoutMsg
              });

              if (this.store) {
                try {
                  await this.store.updateTurn(finalFailedTurn);
                } catch {
                  // Safe error handling
                }
              }

              yield {
                type: 'request_failed',
                requestId,
                sessionId,
                turnId: assistantTurn.id,
                error: {
                  code: 'provider_timeout',
                  message: timeoutMsg,
                  retryable: true
                },
                timestamp: this.clock()
              };

              if (options?.throwOnError) {
                throw new ConversationRuntimeError('provider_timeout', timeoutMsg, {
                  requestId,
                  sessionId
                });
              }
              return;
            }

            record.terminalEmitted = 'cancelled';
            if (record.timeoutTimer) {
              clearTimeout(record.timeoutTimer);
              record.timeoutTimer = null;
            }

            const finalCancelledTurn = this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'cancelled',
              content: accumulatedText
            });

            if (this.store) {
              try {
                await this.store.updateTurn(finalCancelledTurn);
              } catch {
                // Safe cancellation handling
              }
            }

            yield {
              type: 'request_cancelled',
              requestId,
              sessionId,
              turnId: assistantTurn.id,
              reason: event.reason,
              timestamp: this.clock()
            };
            return;
          } else if (event.type === 'error') {
            if (record.terminalEmitted) {
              break;
            }

            if (record.isTimedOut) {
              record.terminalEmitted = 'failed';
              if (record.timeoutTimer) {
                clearTimeout(record.timeoutTimer);
                record.timeoutTimer = null;
              }

              const timeoutMsg = `Request exceeded timeout of ${effectiveTimeoutMs}ms`;
              const finalFailedTurn = this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
                status: 'failed',
                content: accumulatedText,
                error: timeoutMsg
              });

              if (this.store) {
                try {
                  await this.store.updateTurn(finalFailedTurn);
                } catch {
                  // Safe error handling
                }
              }

              yield {
                type: 'request_failed',
                requestId,
                sessionId,
                turnId: assistantTurn.id,
                error: {
                  code: 'provider_timeout',
                  message: timeoutMsg,
                  retryable: true
                },
                timestamp: this.clock()
              };

              if (options?.throwOnError) {
                throw new ConversationRuntimeError('provider_timeout', timeoutMsg, {
                  requestId,
                  sessionId
                });
              }
              return;
            }

            record.terminalEmitted = 'failed';
            if (record.timeoutTimer) {
              clearTimeout(record.timeoutTimer);
              record.timeoutTimer = null;
            }

            const finalFailedTurn = this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'failed',
              content: accumulatedText,
              error: event.error.message
            });

            if (this.store) {
              try {
                await this.store.updateTurn(finalFailedTurn);
              } catch {
                // Safe error handling
              }
            }

            yield {
              type: 'request_failed',
              requestId,
              sessionId,
              turnId: assistantTurn.id,
              error: {
                code: event.error.code,
                message: event.error.message,
                retryable: event.error.retryable,
                details: event.error.details
              },
              timestamp: this.clock()
            };

            if (options?.throwOnError) {
              throw new ConversationRuntimeError('provider_error', event.error.message, {
                requestId,
                sessionId
              });
            }
            return;
          }
        }

        // Post-loop terminal event arbitration
        if (!record.terminalEmitted) {
          if (record.isTimedOut) {
            record.terminalEmitted = 'failed';
            if (record.timeoutTimer) {
              clearTimeout(record.timeoutTimer);
              record.timeoutTimer = null;
            }

            const timeoutMsg = `Request exceeded timeout of ${effectiveTimeoutMs}ms`;
            const finalFailedTurn = this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'failed',
              content: accumulatedText,
              error: timeoutMsg
            });

            if (this.store) {
              try {
                await this.store.updateTurn(finalFailedTurn);
              } catch {
                // Safe error handling
              }
            }

            yield {
              type: 'request_failed',
              requestId,
              sessionId,
              turnId: assistantTurn.id,
              error: {
                code: 'provider_timeout',
                message: timeoutMsg,
                retryable: true
              },
              timestamp: this.clock()
            };

            if (options?.throwOnError) {
              throw new ConversationRuntimeError('provider_timeout', timeoutMsg, {
                requestId,
                sessionId
              });
            }
            return;
          } else if (abortController.signal.aborted) {
            record.terminalEmitted = 'cancelled';
            if (record.timeoutTimer) {
              clearTimeout(record.timeoutTimer);
              record.timeoutTimer = null;
            }

            const finalCancelledTurn = this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'cancelled',
              content: accumulatedText
            });

            if (this.store) {
              try {
                await this.store.updateTurn(finalCancelledTurn);
              } catch {
                // Safe cancellation handling
              }
            }

            yield {
              type: 'request_cancelled',
              requestId,
              sessionId,
              turnId: assistantTurn.id,
              reason: record.isExplicitlyCancelled ? 'Request was cancelled' : String(abortController.signal.reason || 'Request was cancelled'),
              timestamp: this.clock()
            };
            return;
          }
        }
      } catch (err) {
        if (err instanceof ConversationRuntimeError) {
          throw err;
        }
        if (!record.terminalEmitted) {
          if (record.isTimedOut) {
            record.terminalEmitted = 'failed';
            if (record.timeoutTimer) {
              clearTimeout(record.timeoutTimer);
              record.timeoutTimer = null;
            }

            const timeoutMsg = `Request exceeded timeout of ${effectiveTimeoutMs}ms`;
            const finalFailedTurn = this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'failed',
              content: accumulatedText,
              error: timeoutMsg
            });

            if (this.store) {
              try {
                await this.store.updateTurn(finalFailedTurn);
              } catch {
                // Safe error handling
              }
            }

            yield {
              type: 'request_failed',
              requestId,
              sessionId,
              turnId: assistantTurn.id,
              error: {
                code: 'provider_timeout',
                message: timeoutMsg,
                retryable: true
              },
              timestamp: this.clock()
            };

            if (options?.throwOnError) {
              throw new ConversationRuntimeError('provider_timeout', timeoutMsg, {
                requestId,
                sessionId
              });
            }
          } else if (abortController.signal.aborted) {
            record.terminalEmitted = 'cancelled';
            if (record.timeoutTimer) {
              clearTimeout(record.timeoutTimer);
              record.timeoutTimer = null;
            }

            const finalCancelledTurn = this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'cancelled',
              content: accumulatedText
            });

            if (this.store) {
              try {
                await this.store.updateTurn(finalCancelledTurn);
              } catch {
                // Safe cancellation handling
              }
            }

            yield {
              type: 'request_cancelled',
              requestId,
              sessionId,
              turnId: assistantTurn.id,
              reason: record.isExplicitlyCancelled ? 'Request was cancelled' : String(abortController.signal.reason || 'Request was cancelled'),
              timestamp: this.clock()
            };
          } else {
            record.terminalEmitted = 'failed';
            if (record.timeoutTimer) {
              clearTimeout(record.timeoutTimer);
              record.timeoutTimer = null;
            }

            const errorMsg = err instanceof Error ? err.message : String(err);
            const finalFailedTurn = this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'failed',
              content: accumulatedText,
              error: errorMsg
            });

            if (this.store) {
              try {
                await this.store.updateTurn(finalFailedTurn);
              } catch {
                // Safe error handling
              }
            }

            yield {
              type: 'request_failed',
              requestId,
              sessionId,
              turnId: assistantTurn.id,
              error: {
                code: 'provider_error',
                message: errorMsg
              },
              timestamp: this.clock()
            };

            if (options?.throwOnError) {
              throw new ConversationRuntimeError('provider_error', errorMsg, {
                requestId,
                sessionId
              });
            }
          }
        }
      }
    } finally {
      if (record.timeoutTimer) {
        clearTimeout(record.timeoutTimer);
        record.timeoutTimer = null;
      }
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Ends an active session and persists the terminal session status if store is configured.
   */
  async endSession(sessionId: string): Promise<Session> {
    const session = this.sessionManager.endSession(sessionId);
    if (this.store) {
      try {
        await this.store.updateSession(session);
      } catch (err) {
        throw new ConversationRuntimeError(
          'persistence_error',
          err instanceof Error ? err.message : 'Failed to persist ended session state',
          { sessionId }
        );
      }
    }
    return session;
  }

  /**
   * Cancels an in-flight conversation request by requestId.
   * Returns true if the request was found and cancelled, false if not active or already finalized.
   */
  async cancel(requestId: string): Promise<boolean> {
    if (!requestId || typeof requestId !== 'string') {
      return false;
    }
    const record = this.activeRequests.get(requestId.trim());
    if (!record) {
      return false;
    }

    if (record.isTimedOut || record.terminalEmitted || record.isExplicitlyCancelled) {
      return false;
    }

    record.isExplicitlyCancelled = true;
    if (record.timeoutTimer) {
      clearTimeout(record.timeoutTimer);
      record.timeoutTimer = null;
    }

    record.abortController.abort('Request was cancelled');
    if (record.provider?.cancel) {
      try {
        await record.provider.cancel(record.requestId);
      } catch {
        // Safe disposal: ignore provider cancel hook failure
      }
    }
    return true;
  }

  /**
   * Returns the count of currently active requests.
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }
}
