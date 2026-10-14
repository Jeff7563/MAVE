import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type {
  BrainCapabilities,
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ProviderHealth
} from '@mave/contracts';
import { BrainCapabilitiesSchema, ProviderHealthSchema } from '@mave/contracts';
import { createLogger } from '@mave/shared';
import { buildCodexPrompt } from './codex/prompt.js';
import {
  classifyCodexError,
  mapCodexUsage,
  redactDiagnosticText,
  type CodexCliEvent,
  type CodexItemCompletedEvent,
  type CodexTurnCompletedEvent,
  type CodexTurnFailedEvent,
  type CodexErrorEvent
} from './codex/parser.js';
import {
  CODEX_PROVIDER_ID,
  discoverCodexRuntimeModels
} from './codex/models.js';
import type { RuntimeModelDescriptor } from './models/types.js';

const logger = createLogger({ name: 'mave:provider:codex' });

export type SpawnFactory = (
  command: string,
  args: string[],
  options: SpawnOptions
) => ChildProcess;

export interface CodexBrainProviderOptions {
  /** Executable name or path. Defaults to 'codex'. */
  executable?: string;
  /** Dedicated isolated workspace directory. Defaults to process.cwd(). */
  cwd?: string;
  workingDirectory?: string;
  /** Optional model identifier override (e.g. 'gpt-5.6-sol'). */
  model?: string;
  /** Factory for spawning child processes (used for testing and dependency injection). */
  spawnFactory?: SpawnFactory;
}

/**
 * CodexBrainProvider
 *
 * Canonical Subscription Runtime Provider for OpenAI Codex CLI.
 *
 * Conceptual Classification:
 * - providerKind: 'agent_runtime_provider'
 * - accessClass: 'subscription'
 * - transport: 'official_cli'
 *
 * Security & Billing Invariants:
 * 1. Subscription Billing Safety: Child environment explicitly strips OPENAI_API_KEY,
 *    OPENAI_KEY, OPENAI_BASE_URL, OPENAI_API_BASE, OPENAI_ORG_ID, OPENAI_ORGANIZATION,
 *    OPENAI_PROJECT_ID, and CODEX_API_KEY. Parent process environment is never modified globally.
 * 2. Zero Autonomous Tool Authority: Enforces `--sandbox read-only` and strictly terminates
 *    the process if Codex attempts tool execution. Zero dangerous approval bypass.
 * 3. Non-interactive Headless: Uses `exec --json --ephemeral --sandbox read-only --skip-git-repo-check -`
 *    with prompt piped strictly via stdin and closed immediately.
 * 4. Model Handoff: Receives resolved runtime model via `options.modelId` (or default provider model),
 *    never reading caller preferences directly.
 * 5. Prompt Cancellation: Child process is terminated promptly on AbortSignal or cancel().
 */
export class CodexBrainProvider implements BrainProvider {
  readonly id = CODEX_PROVIDER_ID;

  private readonly executable: string;
  private readonly cwd: string;
  private readonly defaultModel?: string;
  private readonly spawnFactory: SpawnFactory;

  private readonly activeProcesses = new Map<string, ChildProcess>();

  constructor(options: CodexBrainProviderOptions = {}) {
    this.executable = options.executable || 'codex';
    this.cwd = options.cwd || options.workingDirectory || process.cwd();
    this.defaultModel = options.model;
    this.spawnFactory = options.spawnFactory || spawn;
  }

  getCapabilities(): BrainCapabilities {
    return BrainCapabilitiesSchema.parse({
      streaming: true,
      fastChat: false, // agent_runtime_provider cannot fake model_provider for fast_conversation
      reasoning: true,
      coding: true,
      toolUse: false, // Pre-M5 invariant: tool execution strictly blocked
      multimodal: false,
      vision: false,
      webResearch: false,
      longContext: true,
      local: false,
      cancellation: true
    });
  }

  /**
   * Returns discovered or default runtime model descriptors for Codex.
   */
  async getRuntimeModels(): Promise<RuntimeModelDescriptor[]> {
    return discoverCodexRuntimeModels();
  }

  /**
   * Performs a lightweight presence and health check without consuming AI subscription quota.
   * Runs `codex --version` and checks for official ChatGPT subscription authentication.
   */
  async health(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      const versionResult = await new Promise<{ ok: boolean; version?: string; error?: string }>(
        (resolve) => {
          let stdout = '';
          let stderr = '';
          let settled = false;

          const child = this.spawnFactory(this.executable, ['--version'], {
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe']
          });

          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              try {
                child.kill();
              } catch {}
              resolve({ ok: false, error: 'Health check timed out after 3000ms' });
            }
          }, 3000);

          child.stdout?.on('data', (d) => {
            stdout += d.toString();
          });
          child.stderr?.on('data', (d) => {
            stderr += d.toString();
          });

          child.on('error', (err) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve({ ok: false, error: err.message });
            }
          });

          child.on('close', (code) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              if (code === 0) {
                resolve({ ok: true, version: stdout.trim() });
              } else {
                resolve({
                  ok: false,
                  error: stderr.trim() || `CLI exited with code ${code}`
                });
              }
            }
          });
        }
      );

      const latencyMs = Date.now() - startTime;

      if (!versionResult.ok) {
        return ProviderHealthSchema.parse({
          status: 'unconfigured',
          message: `OpenAI Codex CLI (${this.executable}) is unavailable: ${versionResult.error}`,
          latencyMs,
          checkedAt: Date.now()
        });
      }

      // Check subscription auth in ~/.codex/auth.json without logging credentials
      let authDetail = '';
      try {
        const authPath = path.join(os.homedir(), '.codex', 'auth.json');
        if (fs.existsSync(authPath)) {
          const raw = fs.readFileSync(authPath, 'utf8');
          const parsed = JSON.parse(raw);
          const hasTokens = Boolean(parsed.tokens);
          const authMode = parsed.auth_mode || (hasTokens ? 'chatgpt' : undefined);
          if (authMode === 'chatgpt' || hasTokens) {
            authDetail = ' (ChatGPT Subscription Auth)';
          } else {
            return ProviderHealthSchema.parse({
              status: 'unconfigured',
              message: `OpenAI Codex CLI is installed but not authenticated with ChatGPT`,
              latencyMs,
              checkedAt: Date.now()
            });
          }
        } else {
          return ProviderHealthSchema.parse({
            status: 'unconfigured',
            message: `OpenAI Codex CLI is installed but auth configuration (~/.codex/auth.json) is missing`,
            latencyMs,
            checkedAt: Date.now()
          });
        }
      } catch {
        // Safe read failure; continue with unknown auth detail
      }

      return ProviderHealthSchema.parse({
        status: 'healthy',
        message: `OpenAI Codex CLI is ready (${versionResult.version || 'installed'})${authDetail}`,
        latencyMs,
        checkedAt: Date.now()
      });
    } catch (err) {
      return ProviderHealthSchema.parse({
        status: 'unconfigured',
        message: `Failed to inspect OpenAI Codex CLI: ${err instanceof Error ? err.message : String(err)}`,
        latencyMs: Date.now() - startTime,
        checkedAt: Date.now()
      });
    }
  }

  /**
   * Cancels an active in-flight request by terminating its dedicated child process.
   */
  async cancel(requestId: string): Promise<void> {
    if (!requestId) return;
    const child = this.activeProcesses.get(requestId);
    if (child) {
      try {
        child.kill();
      } catch {
        // Safe disposal
      }
      this.activeProcesses.delete(requestId);
    }
  }

  /**
   * Orchestrates a single text conversation request through the OpenAI Codex subscription runtime.
   */
  async *chat(
    request: BrainRequest,
    options?: BrainRequestOptions
  ): AsyncIterable<BrainEvent> {
    const requestId = request.requestId;

    // 1. Pre-flight cancellation check
    if (options?.signal?.aborted) {
      yield {
        type: 'cancelled',
        requestId,
        reason: String(options.signal.reason || 'Cancelled before execution')
      };
      return;
    }

    // 2. Resolve execution model: options.modelId > this.defaultModel
    // INVARIANT: Provider execution must NOT directly consume request.overrides.preferredModelId.
    // Only the routing/selection layer resolves caller preference into options.modelId.
    const effectiveModel = options?.modelId || this.defaultModel;

    // 3. Construct prompt strictly from BrainRequest
    const prompt = buildCodexPrompt(request);

    // 4. Build isolated arguments:
    // HARD INVARIANTS:
    // - Zero dangerous permission bypass
    // - Enforce read-only sandbox mode
    // - Noninteractive execution via stdin pipe ('-')
    // - Ephemeral session (no persisting session files)
    const args: string[] = [
      'exec',
      '--json',
      '--ephemeral',
      '--sandbox', 'read-only',
      '--skip-git-repo-check'
    ];
    if (effectiveModel) {
      args.push('-m', effectiveModel);
    }
    args.push('-');

    // 5. Subscription billing safety: sanitize child environment
    // Explicitly strip OPENAI_API_KEY and other metered billing variables.
    // Parent process environment is never modified globally.
    const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
    delete cleanEnv['OPENAI_API_KEY'];
    delete cleanEnv['OPENAI_KEY'];
    delete cleanEnv['OPENAI_BASE_URL'];
    delete cleanEnv['OPENAI_API_BASE'];
    delete cleanEnv['OPENAI_ORG_ID'];
    delete cleanEnv['OPENAI_ORGANIZATION'];
    delete cleanEnv['OPENAI_PROJECT_ID'];
    delete cleanEnv['CODEX_API_KEY'];

    // 6. Spawn dedicated child process with shell: false and piped stdin
    let child: ChildProcess;
    try {
      child = this.spawnFactory(this.executable, args, {
        cwd: this.cwd,
        shell: false,
        env: cleanEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err, requestId }, 'failed to spawn OpenAI Codex CLI process');
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'provider_unavailable',
          message: `Failed to spawn OpenAI Codex CLI (${this.executable}): ${errorMsg}`,
          retryable: false
        }
      };
      return;
    }

    this.activeProcesses.set(requestId, child);

    // Pipe prompt through stdin and immediately close stdin so Codex does not hang waiting for more input
    try {
      child.stdin?.write(prompt);
      child.stdin?.end();
    } catch (writeErr) {
      logger.warn({ writeErr, requestId }, 'failed to write prompt to Codex stdin');
    }

    // 7. Connect AbortSignal listener for prompt cancellation
    const onAbort = () => {
      try {
        child.kill();
      } catch {
        // Safe disposal
      }
    };

    if (options?.signal) {
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    // 8. Async event queue for streaming consumption
    type QueueItem =
      | { type: 'event'; event: CodexCliEvent }
      | { type: 'tool_blocked' }
      | { type: 'spawn_error'; message: string }
      | { type: 'closed'; code: number | null; signal: NodeJS.Signals | null };

    const queue: QueueItem[] = [];
    let resolveWait: (() => void) | null = null;

    const pushItem = (item: QueueItem) => {
      queue.push(item);
      if (resolveWait) {
        const r = resolveWait;
        resolveWait = null;
        r();
      }
    };

    let stderrBuffer = '';
    let stdoutRemainder = '';

    child.stderr?.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
    });

    child.stdout?.on('data', (chunk) => {
      stdoutRemainder += chunk.toString();
      const lines = stdoutRemainder.split('\n');
      stdoutRemainder = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as CodexCliEvent;

          // Security Guardrail: Tool execution is strictly blocked in Pre-M5
          if (parsed.type === 'item.completed' || (parsed as any).item) {
            const item = (parsed as any).item;
            const itemType = (item?.type || '').toLowerCase();
            const isToolAttempt =
              itemType === 'command_execution' ||
              itemType === 'file_change' ||
              itemType === 'tool_call' ||
              itemType === 'function_call' ||
              itemType === 'web_search' ||
              itemType === 'bash' ||
              itemType === 'tool_use' ||
              itemType === 'terminal' ||
              Boolean(item?.call) ||
              Boolean(item?.input && itemType !== 'agent_message');

            if (isToolAttempt) {
              logger.warn({ requestId, itemType }, 'OpenAI Codex attempted tool execution; terminating process');
              try {
                child.kill();
              } catch {}
              pushItem({ type: 'tool_blocked' });
              return;
            }
          }

          pushItem({ type: 'event', event: parsed });
        } catch {
          // Ignore malformed or non-JSON lines
        }
      }
    });

    child.on('error', (err) => {
      pushItem({ type: 'spawn_error', message: err.message });
    });

    child.on('close', (code, signal) => {
      if (stdoutRemainder.trim()) {
        try {
          const parsed = JSON.parse(stdoutRemainder.trim()) as CodexCliEvent;
          pushItem({ type: 'event', event: parsed });
        } catch {}
        stdoutRemainder = '';
      }
      pushItem({ type: 'closed', code, signal });
    });

    // 9. Emit canonical started event
    yield {
      type: 'started',
      requestId,
      providerId: this.id,
      modelId: effectiveModel,
      timestamp: Date.now()
    };

    let accumulatedText = '';
    let isTerminated = false;
    let finalUsage: ReturnType<typeof mapCodexUsage> = undefined;
    let fatalErrorMessage: string | undefined = undefined;

    try {
      while (!isTerminated) {
        if (options?.signal?.aborted) {
          try {
            child.kill();
          } catch {}
          yield {
            type: 'cancelled',
            requestId,
            reason: String(options.signal.reason || 'Cancelled during execution')
          };
          return;
        }

        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveWait = resolve;
          });
        }

        while (queue.length > 0) {
          const item = queue.shift()!;

          if (item.type === 'tool_blocked') {
            isTerminated = true;
            yield {
              type: 'error',
              requestId,
              error: {
                code: 'provider_unavailable',
                message: 'Tool execution was attempted by OpenAI Codex but is strictly prohibited in Pre-M5.',
                retryable: false
              }
            };
            return;
          }

          if (item.type === 'spawn_error') {
            isTerminated = true;
            yield {
              type: 'error',
              requestId,
              error: {
                code: 'provider_unavailable',
                message: `OpenAI Codex process error: ${redactDiagnosticText(item.message)}`,
                retryable: false
              }
            };
            return;
          }

          if (item.type === 'closed') {
            isTerminated = true;
            const isCancelled = item.signal === 'SIGTERM' || options?.signal?.aborted;

            if (isCancelled) {
              yield {
                type: 'cancelled',
                requestId,
                reason: 'Process terminated upon cancellation'
              };
              return;
            }

            if (item.code !== 0 || fatalErrorMessage) {
              const rawErr = fatalErrorMessage || stderrBuffer.trim() || `OpenAI Codex CLI exited with code ${item.code}`;
              const classifiedCode = classifyCodexError(rawErr);
              yield {
                type: 'error',
                requestId,
                error: {
                  code: classifiedCode,
                  message: redactDiagnosticText(rawErr),
                  retryable: classifiedCode === 'rate_limited'
                }
              };
              return;
            }

            // Normal completion
            yield {
              type: 'completed',
              requestId,
              text: accumulatedText,
              usage: finalUsage,
              finishReason: 'end_turn'
            };
            return;
          }

          if (item.type === 'event') {
            const ev = item.event;

            // Handle turn.completed (usage metrics)
            if (ev.type === 'turn.completed') {
              const turnComp = ev as CodexTurnCompletedEvent;
              if (turnComp.usage) {
                finalUsage = mapCodexUsage(turnComp.usage);
              }
            }

            // Handle item.completed (agent_message text)
            else if (ev.type === 'item.completed') {
              const compEv = ev as CodexItemCompletedEvent;
              if (compEv.item?.type === 'agent_message' && compEv.item.text) {
                const newText = compEv.item.text;
                // Emit delta if not already accumulated via incremental deltas
                if (!accumulatedText.includes(newText)) {
                  accumulatedText += newText;
                  yield {
                    type: 'delta',
                    requestId,
                    text: newText
                  };
                }
              }
            }

            // Handle item.delta (streaming text chunks if emitted)
            else if (ev.type === 'item.delta') {
              const deltaEv = ev as any;
              const deltaText = deltaEv.delta?.text || deltaEv.delta?.content;
              if (deltaText && typeof deltaText === 'string') {
                accumulatedText += deltaText;
                yield {
                  type: 'delta',
                  requestId,
                  text: deltaText
                };
              }
            }

            // Handle fatal errors in events (e.g. error, turn.failed)
            else if (ev.type === 'turn.failed') {
              const failedEv = ev as CodexTurnFailedEvent;
              fatalErrorMessage = failedEv.error?.message || 'OpenAI Codex turn failed';
            }

            else if (ev.type === 'error') {
              const errEv = ev as CodexErrorEvent;
              fatalErrorMessage = errEv.message || errEv.error?.message || 'OpenAI Codex reported error';
            }
          }
        }
      }
    } finally {
      if (options?.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      this.activeProcesses.delete(requestId);
      try {
        child.kill();
      } catch {}
    }
  }
}

