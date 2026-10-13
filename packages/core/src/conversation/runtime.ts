import { randomUUID } from 'node:crypto';
import type {
  BrainCapabilities,
  BrainProvider,
  BrainRequest
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
  requestIdFactory?: () => string;
  clock?: () => number;
}

interface ActiveRequestRecord {
  requestId: string;
  sessionId: string;
  abortController: AbortController;
  provider?: BrainProvider;
  assistantTurnId?: string;
}

const DEFAULT_REQUIRED_CAPABILITIES: Partial<BrainCapabilities> = {
  streaming: true,
  fastChat: true
};

export class ConversationRuntime {
  private readonly sessionManager: SessionManager;
  private readonly contextManager: ContextManager;
  private readonly router: BrainRouter;
  private readonly requestIdFactory: () => string;
  private readonly clock: () => number;

  private readonly activeRequests = new Map<string, ActiveRequestRecord>();

  constructor(options: ConversationRuntimeOptions) {
    this.sessionManager = options.sessionManager;
    this.contextManager = options.contextManager ?? new ContextManager();
    this.router = options.router;
    this.requestIdFactory = options.requestIdFactory ?? (() => randomUUID());
    this.clock = options.clock ?? (() => Date.now());
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

    const requestId = request.requestId ? request.requestId.trim() : this.requestIdFactory();

    // 3. Reject duplicate active requestId
    if (this.activeRequests.has(requestId)) {
      throw new ConversationRuntimeError(
        'duplicate_request',
        `An active request with ID '${requestId}' is already in progress`,
        { requestId }
      );
    }

    // 4. Resolve / Create Session
    let sessionId: string;
    if (request.sessionId !== undefined) {
      const trimmedSessionId = request.sessionId.trim();
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
    }

    // 5. Check same-session concurrency policy: reject concurrent request for same session
    for (const active of this.activeRequests.values()) {
      if (active.sessionId === sessionId) {
        throw new ConversationRuntimeError(
          'session_busy',
          `Session '${sessionId}' already has an active request in progress`,
          { requestId, sessionId }
        );
      }
    }

    // 6. Setup AbortController and active tracking
    const abortController = new AbortController();
    if (options?.signal) {
      if (options.signal.aborted) {
        abortController.abort();
      } else {
        options.signal.addEventListener('abort', () => abortController.abort(), { once: true });
      }
    }

    const record: ActiveRequestRecord = {
      requestId,
      sessionId,
      abortController
    };
    this.activeRequests.set(requestId, record);

    try {
      // 7. Emit request_started and session_ready
      yield {
        type: 'request_started',
        requestId,
        sessionId,
        timestamp: this.clock()
      };

      yield {
        type: 'session_ready',
        requestId,
        sessionId,
        timestamp: this.clock()
      };

      // Check abort before doing work
      if (abortController.signal.aborted) {
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
      this.sessionManager.appendTurn(sessionId, {
        requestId,
        role: 'user',
        content: request.message.trim(),
        status: 'completed'
      });

      // 9. Build conversation context
      const turns = this.sessionManager.getTurns(sessionId);
      const session = this.sessionManager.requireSession(sessionId);
      const contextBundle = this.contextManager.build(session, turns);

      // 10. Route to BrainProvider
      const requiredCapabilities: Partial<BrainCapabilities> = {
        ...DEFAULT_REQUIRED_CAPABILITIES,
        ...request.requiredCapabilities
      };

      let routeDecision;
      try {
        routeDecision = await this.router.route({
          preferredProviderId: request.preferredProviderId,
          requiredCapabilities
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorCode =
          err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
            ? err.code
            : 'routing_error';

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
      this.sessionManager.updateActiveProviderId(sessionId, providerId);

      yield {
        type: 'provider_selected',
        requestId,
        sessionId,
        providerId,
        fallbackUsed,
        reason,
        timestamp: this.clock()
      };

      if (abortController.signal.aborted) {
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

      // 12. Construct canonical BrainRequest
      const brainRequest: BrainRequest = {
        requestId,
        sessionId,
        intent: 'conversation',
        messages: contextBundle.messages,
        context: contextBundle.context
      };

      // 13. Consume BrainEvent stream from provider
      let accumulatedText = '';
      let hasStarted = false;

      try {
        for await (const event of provider.chat(brainRequest, { signal: abortController.signal })) {
          if (abortController.signal.aborted) {
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
            const finalText = accumulatedText.length > 0 ? accumulatedText : (event.text ?? '');
            this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'completed',
              content: finalText
            });

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
            this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'cancelled',
              content: accumulatedText
            });

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
            this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
              status: 'failed',
              content: accumulatedText,
              error: event.error.message
            });

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

        // Post-loop check: if aborted during stream
        if (abortController.signal.aborted) {
          this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
            status: 'cancelled',
            content: accumulatedText
          });

          yield {
            type: 'request_cancelled',
            requestId,
            sessionId,
            turnId: assistantTurn.id,
            reason: 'Request was cancelled',
            timestamp: this.clock()
          };
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
            status: 'cancelled',
            content: accumulatedText
          });

          yield {
            type: 'request_cancelled',
            requestId,
            sessionId,
            turnId: assistantTurn.id,
            reason: 'Request was cancelled',
            timestamp: this.clock()
          };
        } else {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.sessionManager.updateTurn(sessionId, assistantTurn.id, {
            status: 'failed',
            content: accumulatedText,
            error: errorMsg
          });

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
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Cancels an in-flight conversation request by requestId.
   * Returns true if the request was found and cancelled, false if not active.
   */
  async cancel(requestId: string): Promise<boolean> {
    if (!requestId || typeof requestId !== 'string') {
      return false;
    }
    const record = this.activeRequests.get(requestId.trim());
    if (!record) {
      return false;
    }

    record.abortController.abort();
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
