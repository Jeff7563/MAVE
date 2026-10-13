import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app, type BrowserWindow } from 'electron';
import {
  CHAT_IPC_CHANNELS,
  ChatCancelRequestSchema,
  type ChatCancelResponse,
  ChatLoadSessionRequestSchema,
  type ChatLoadSessionResponse,
  ChatSendRequestSchema,
  type ChatSendResponse,
  type ConversationRuntimeEvent,
  type ConversationStore,
  type ResponseDeltaEvent
} from '@mave/contracts';
import {
  BrainProviderRegistry,
  BrainRouter,
  ContextManager,
  ConversationRuntime,
  ConversationRuntimeError,
  SessionManager
} from '@mave/core';
import type { MaveDatabase } from '@mave/database';
import { SQLiteConversationStore } from '@mave/database';
import { MockBrainProvider, AntigravityBrainProvider } from '@mave/providers';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:conversation-manager' });

class DeltaCoalescer {
  private pendingDelta: ResponseDeltaEvent | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly windowMs: number,
    private readonly onFlush: (event: ResponseDeltaEvent) => void
  ) {}

  add(event: ResponseDeltaEvent): void {
    if (this.windowMs <= 0) {
      this.onFlush(event);
      return;
    }

    if (!this.pendingDelta) {
      this.pendingDelta = { ...event };
    } else {
      this.pendingDelta.text += event.text;
      this.pendingDelta.timestamp = event.timestamp;
    }

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.windowMs);
    }
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pendingDelta) {
      const delta = this.pendingDelta;
      this.pendingDelta = null;
      this.onFlush(delta);
    }
  }
}

export interface ConversationManagerOptions {
  database: MaveDatabase;
  getMainWindow?: () => BrowserWindow | null;
  coalesceWindowMs?: number;
  timeoutMs?: number;
  /** Optional overrides for testing & dependency injection */
  runtime?: ConversationRuntime;
  router?: BrainRouter;
  providerRegistry?: BrainProviderRegistry;
  mockProvider?: MockBrainProvider;
  antigravityProvider?: AntigravityBrainProvider;
  antigravityWorkspaceDir?: string;
  store?: ConversationStore;
  sessionManager?: SessionManager;
}

export class ConversationManager {
  private readonly database: MaveDatabase;
  private getMainWindow: () => BrowserWindow | null;
  private readonly coalesceWindowMs: number;
  private readonly timeoutMs: number;

  private readonly store: ConversationStore;
  private readonly providerRegistry: BrainProviderRegistry;
  private readonly mockProvider: MockBrainProvider;
  private readonly antigravityProvider: AntigravityBrainProvider;
  private readonly router: BrainRouter;
  private readonly sessionManager: SessionManager;
  private readonly contextManager: ContextManager;
  private readonly runtime: ConversationRuntime;

  private readonly activeAbortControllers = new Map<string, AbortController>();
  private readonly activeTasks = new Map<string, Promise<void>>();
  private readonly coalescerMap = new Map<string, DeltaCoalescer>();

  constructor(options: ConversationManagerOptions) {
    this.database = options.database;
    this.getMainWindow = options.getMainWindow ?? (() => null);
    this.coalesceWindowMs = options.coalesceWindowMs ?? 0;
    this.timeoutMs = options.timeoutMs ?? 30000;

    // 1. ConversationStore (SQLite)
    this.store = options.store ?? new SQLiteConversationStore(this.database);

    // 2. Provider Registry & Brain Providers
    this.providerRegistry = options.providerRegistry ?? new BrainProviderRegistry();
    this.mockProvider = options.mockProvider ?? new MockBrainProvider();
    if (!this.providerRegistry.has(this.mockProvider.id)) {
      this.providerRegistry.register(this.mockProvider);
    }

    let defaultAntigravityDir: string;
    try {
      defaultAntigravityDir = app?.getPath
        ? path.join(app.getPath('userData'), 'brain-workspaces', 'antigravity')
        : path.join(process.cwd(), '.tmp', 'brain-workspaces', 'antigravity');
    } catch {
      defaultAntigravityDir = path.join(process.cwd(), '.tmp', 'brain-workspaces', 'antigravity');
    }

    const workingDirectory = options.antigravityWorkspaceDir ?? defaultAntigravityDir;
    try {
      fs.mkdirSync(workingDirectory, { recursive: true });
    } catch (err) {
      logger.warn({ err, workingDirectory }, 'Could not ensure antigravity working directory exists');
    }

    this.antigravityProvider =
      options.antigravityProvider ??
      new AntigravityBrainProvider({ workingDirectory });

    if (!this.providerRegistry.has(this.antigravityProvider.id)) {
      this.providerRegistry.register(this.antigravityProvider);
    }

    // 3. Brain Router (default provider: 'mock')
    this.router =
      options.router ??
      new BrainRouter({
        registry: this.providerRegistry,
        defaultProvider: this.mockProvider.id
      });

    // 4. Session Manager
    this.sessionManager = options.sessionManager ?? new SessionManager();

    // 5. Context Manager
    this.contextManager = new ContextManager();

    // 6. Conversation Runtime
    this.runtime =
      options.runtime ??
      new ConversationRuntime({
        sessionManager: this.sessionManager,
        contextManager: this.contextManager,
        router: this.router,
        store: this.store,
        defaultTimeoutMs: this.timeoutMs
      });

    logger.info('ConversationManager initialized with MockBrainProvider, AntigravityBrainProvider and SQLite store');
  }

  setMainWindowGetter(getter: () => BrowserWindow | null): void {
    this.getMainWindow = getter;
  }

  getRuntime(): ConversationRuntime {
    return this.runtime;
  }

  getStore(): ConversationStore {
    return this.store;
  }

  getRouter(): BrainRouter {
    return this.router;
  }

  getProviderRegistry(): BrainProviderRegistry {
    return this.providerRegistry;
  }

  getMockProvider(): MockBrainProvider {
    return this.mockProvider;
  }

  getAntigravityProvider(): AntigravityBrainProvider {
    return this.antigravityProvider;
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  async handleSend(rawPayload: unknown): Promise<ChatSendResponse> {
    const parseResult = ChatSendRequestSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.message;
      logger.warn({ error: errorMessage }, 'rejected chat send request');
      return {
        accepted: false,
        error: {
          code: 'invalid_request',
          message: errorMessage
        }
      };
    }

    const data = parseResult.data;
    const requestId = data.requestId ? data.requestId.trim() : randomUUID();

    const abortController = new AbortController();
    this.activeAbortControllers.set(requestId, abortController);

    // Initialize coalescer for this request if batching is enabled
    const coalescer = new DeltaCoalescer(this.coalesceWindowMs, (deltaEvent) => {
      this.emitToRenderer(deltaEvent);
    });
    this.coalescerMap.set(requestId, coalescer);

    // Start streaming asynchronously in the background — do not await before acknowledging
    const streamTask = (async () => {
      try {
        const stream = this.runtime.send(
          {
            ...data,
            requestId
          },
          { signal: abortController.signal }
        );

        for await (const event of stream) {
          if (event.type === 'response_delta') {
            coalescer.add(event);
          } else {
            // Flush any pending coalesced deltas before emitting non-delta events
            coalescer.flush();
            this.emitToRenderer(event);
          }
        }
      } catch (err) {
        logger.error({ err, requestId }, 'error in conversation stream');
        coalescer.flush();

        const code =
          err instanceof ConversationRuntimeError
            ? err.code
            : err instanceof Error
              ? 'runtime_error'
              : 'unknown_error';
        const message = err instanceof Error ? err.message : String(err);

        this.emitToRenderer({
          type: 'request_failed',
          requestId,
          sessionId: data.sessionId,
          error: {
            code,
            message,
            retryable: false
          },
          timestamp: Date.now()
        });
      } finally {
        coalescer.flush();
        this.coalescerMap.delete(requestId);
        this.activeAbortControllers.delete(requestId);
        this.activeTasks.delete(requestId);
      }
    })();
    this.activeTasks.set(requestId, streamTask);

    return {
      accepted: true,
      requestId
    };
  }

  async handleCancel(rawPayload: unknown): Promise<ChatCancelResponse> {
    const parseResult = ChatCancelRequestSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      logger.warn({ error: parseResult.error.message }, 'rejected chat cancel request');
      return {
        cancelled: false,
        requestId: ''
      };
    }

    const { requestId } = parseResult.data;
    const localController = this.activeAbortControllers.get(requestId);
    if (localController) {
      localController.abort();
    }

    const coalescer = this.coalescerMap.get(requestId);
    if (coalescer) {
      coalescer.flush();
    }

    const cancelled = await this.runtime.cancel(requestId);
    return {
      cancelled,
      requestId
    };
  }

  async handleLoadSession(rawPayload: unknown): Promise<ChatLoadSessionResponse> {
    const parseResult = ChatLoadSessionRequestSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.message
      };
    }

    try {
      const session = await this.runtime.loadSession(parseResult.data.sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session '${parseResult.data.sessionId}' not found`
        };
      }
      return {
        success: true,
        session
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  private emitToRenderer(event: ConversationRuntimeEvent): void {
    const win = this.getMainWindow();
    if (!win || win.isDestroyed()) {
      return;
    }

    try {
      win.webContents.send(CHAT_IPC_CHANNELS.STREAM, event);
    } catch (err) {
      logger.warn({ err }, 'failed to send conversation event to webContents');
    }
  }

  async dispose(): Promise<void> {
    logger.info('disposing ConversationManager and cancelling active requests');

    // Flush and clear all coalescers
    for (const coalescer of this.coalescerMap.values()) {
      coalescer.flush();
    }
    this.coalescerMap.clear();

    // Cancel all in-flight requests
    const activeIds = Array.from(this.activeAbortControllers.keys());
    await Promise.allSettled(
      activeIds.map(async (requestId) => {
        const controller = this.activeAbortControllers.get(requestId);
        controller?.abort();
        await this.runtime.cancel(requestId);
      })
    );

    // Wait for in-flight tasks to fully complete
    await Promise.allSettled(Array.from(this.activeTasks.values()));
    this.activeAbortControllers.clear();
    this.activeTasks.clear();
  }
}
