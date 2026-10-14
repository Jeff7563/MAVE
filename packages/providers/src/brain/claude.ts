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
import { buildClaudeCodePrompt } from './claude/prompt.js';
import {
  classifyClaudeCodeError,
  mapClaudeCodeUsage,
  redactDiagnosticText,
  type ClaudeCliEvent,
  type ClaudeInitEvent,
  type ClaudeRateLimitEvent,
  type ClaudeResultEvent
} from './claude/parser.js';
import {
  CLAUDE_CODE_PROVIDER_ID,
  getClaudeDefaultRuntimeModels,
  type ClaudeRuntimeModelSnapshot
} from './claude/models.js';

const logger = createLogger({ name: 'mave:provider:claude-code' });

export type SpawnFactory = (
  command: string,
  args: string[],
  options: SpawnOptions
) => ChildProcess;

export interface ClaudeCodeBrainProviderOptions {
  /** Executable name or path. Defaults to 'claude'. */
  executable?: string;
  /** Dedicated isolated workspace directory. Defaults to process.cwd(). */
  cwd?: string;
  workingDirectory?: string;
  /** Optional model identifier override (e.g. 'sonnet', 'haiku', 'opus'). */
  model?: string;
  /** Optional reasoning effort for the session ('low' | 'medium' | 'high' | 'xhigh' | 'max'). */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Factory for spawning child processes (used for testing and dependency injection). */
  spawnFactory?: SpawnFactory;
}

/**
 * ClaudeCodeBrainProvider
 *
 * Canonical Subscription Runtime Provider for Anthropic Claude Code CLI.
 * 
 * Conceptual Classification:
 * - providerKind: 'agent_runtime_provider'
 * - accessClass: 'subscription'
 * - transport: 'official_cli'
 *
 * Security & Billing Invariants:
 * 1. Subscription Billing Safety: Child environment explicitly strips ANTHROPIC_API_KEY
 *    and other metered billing variables. Parent process environment is never modified globally.
 * 2. Zero Dangerous Permissions: Never uses --dangerously-skip-permissions.
 * 3. Tools Disabled: Enforces --tools "" and --safe-mode with zero tool execution authority.
 * 4. Non-interactive Headless: Uses -p with --output-format stream-json and closed stdin.
 * 5. Prompt Cancellation: Child process is terminated promptly on AbortSignal or cancel().
 */
export class ClaudeCodeBrainProvider implements BrainProvider {
  readonly id = CLAUDE_CODE_PROVIDER_ID;

  private readonly executable: string;
  private readonly cwd: string;
  private readonly defaultModel?: string;
  private readonly effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  private readonly spawnFactory: SpawnFactory;

  private readonly activeProcesses = new Map<string, ChildProcess>();

  constructor(options: ClaudeCodeBrainProviderOptions = {}) {
    this.executable = options.executable || 'claude';
    this.cwd = options.cwd || options.workingDirectory || process.cwd();
    this.defaultModel = options.model;
    this.effort = options.effort;
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
   * Returns internal runtime model snapshot list discovered for Claude Code.
   */
  getRuntimeModels(): ClaudeRuntimeModelSnapshot[] {
    return getClaudeDefaultRuntimeModels();
  }

  /**
   * Performs a lightweight presence and health check without consuming AI subscription quota.
   * Runs `claude --version` and checks for official subscription authentication.
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
          message: `Claude Code CLI (${this.executable}) is unavailable: ${versionResult.error}`,
          latencyMs,
          checkedAt: Date.now()
        });
      }

      // Check subscription OAuth presence in ~/.claude.json without logging credentials
      let subscriptionDetail = '';
      try {
        const configPath = path.join(os.homedir(), '.claude.json');
        if (fs.existsSync(configPath)) {
          const raw = fs.readFileSync(configPath, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed.oauthAccount) {
            const orgType = parsed.oauthAccount.organizationType;
            subscriptionDetail = orgType ? ` (Subscription: ${orgType})` : ' (OAuth Authenticated)';
          }
        }
      } catch {
        // Safe read failure; non-fatal
      }

      return ProviderHealthSchema.parse({
        status: 'healthy',
        message: `Claude Code CLI is ready (${versionResult.version || 'v2.x'})${subscriptionDetail}`,
        latencyMs,
        checkedAt: Date.now()
      });
    } catch (err) {
      return ProviderHealthSchema.parse({
        status: 'unconfigured',
        message: `Failed to inspect Claude Code CLI: ${err instanceof Error ? err.message : String(err)}`,
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
   * Orchestrates a single text conversation request through the Claude Code subscription runtime.
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

    // 2. Resolve model: options.modelId > overrides.preferredModelId > this.defaultModel
    const effectiveModel =
      options?.modelId ||
      request.overrides?.preferredModelId ||
      this.defaultModel;

    // 3. Construct prompt strictly from BrainRequest
    const prompt = buildClaudeCodePrompt(request);

    // 4. Build isolated arguments:
    // HARD INVARIANT: Zero dangerous permission bypass, zero tools, safe-mode enabled
    const args: string[] = [
      '-p', prompt,
      '--verbose',
      '--tools', '',
      '--safe-mode',
      '--disable-slash-commands',
      '--strict-mcp-config',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--no-session-persistence'
    ];
    if (effectiveModel) {
      args.push('--model', effectiveModel);
    }
    if (this.effort) {
      args.push('--effort', this.effort);
    }

    // 5. Subscription billing safety: sanitize child environment
    // Explicitly strip ANTHROPIC_API_KEY and other metered billing variables.
    // Parent process environment is never modified globally.
    const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
    delete cleanEnv['ANTHROPIC_API_KEY'];
    delete cleanEnv['ANTHROPIC_AUTH_TOKEN'];
    delete cleanEnv['ANTHROPIC_BASE_URL'];
    delete cleanEnv['ANTHROPIC_CUSTOM_HEADERS'];
    delete cleanEnv['CLAUDE_API_KEY'];
    delete cleanEnv['CLAUDE_CODE_API_KEY'];

    // 6. Spawn dedicated child process with shell: false and closed stdin
    let child: ChildProcess;
    try {
      child = this.spawnFactory(this.executable, args, {
        cwd: this.cwd,
        shell: false,
        env: cleanEnv,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err, requestId }, 'failed to spawn Claude Code CLI process');
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'provider_unavailable',
          message: `Failed to spawn Claude Code CLI (${this.executable}): ${errorMsg}`,
          retryable: false
        }
      };
      return;
    }

    this.activeProcesses.set(requestId, child);

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
      | { type: 'event'; event: ClaudeCliEvent }
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
          const parsed = JSON.parse(trimmed) as ClaudeCliEvent;

          // Security Guardrail: Tool use is strictly blocked in Pre-M5
          const isToolAttempt =
            (parsed.type === 'stream_event' && (
              Boolean((parsed as any).event?.type?.includes('tool')) ||
              (parsed as any).event?.content_block?.type === 'tool_use' ||
              (parsed as any).event?.delta?.type === 'input_json_delta'
            )) ||
            Boolean((parsed as any).tool_use) ||
            Boolean((parsed as any).server_tool_use) ||
            (parsed as any).type === 'tool_use';

          if (isToolAttempt) {
            logger.warn({ requestId }, 'Claude Code attempted tool execution; terminating process');
            try {
              child.kill();
            } catch {}
            pushItem({ type: 'tool_blocked' });
            return;
          }

          pushItem({ type: 'event', event: parsed });
        } catch {
          // Ignore malformed or partial NDJSON lines
        }
      }
    });

    child.on('error', (err) => {
      pushItem({ type: 'spawn_error', message: err.message });
    });

    child.on('close', (code, signal) => {
      if (stdoutRemainder.trim()) {
        try {
          const parsed = JSON.parse(stdoutRemainder.trim()) as ClaudeCliEvent;
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
    let resolvedModel: string | undefined = effectiveModel;
    let finalUsage: ReturnType<typeof mapClaudeCodeUsage> = undefined;
    let finishReason: string | undefined = undefined;

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
                message: 'Tool execution was attempted by Claude Code but is strictly prohibited in Pre-M5.',
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
                message: `Claude Code process error: ${redactDiagnosticText(item.message)}`,
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

            if (item.code !== 0) {
              const rawErr = stderrBuffer.trim() || `Claude Code CLI exited with code ${item.code}`;
              const classifiedCode = classifyClaudeCodeError(rawErr);
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
              finishReason: finishReason || 'end_turn'
            };
            return;
          }

          if (item.type === 'event') {
            const ev = item.event;

            // Handle Init Event
            if (ev.type === 'system' && (ev as ClaudeInitEvent).subtype === 'init') {
              const initEv = ev as ClaudeInitEvent;
              if (initEv.model) {
                resolvedModel = initEv.model;
                logger.debug({ requestId, resolvedModel }, 'Claude Code session initialized with resolved model');
              }
            }

            // Handle Rate Limit Event
            else if (ev.type === 'rate_limit_event') {
              const rlEv = ev as ClaudeRateLimitEvent;
              if (rlEv.rate_limit_info?.status === 'rejected') {
                isTerminated = true;
                try {
                  child.kill();
                } catch {}
                yield {
                  type: 'error',
                  requestId,
                  error: {
                    code: 'quota_limited',
                    message: 'Claude Code subscription quota limit reached (5-hour window).',
                    retryable: false
                  }
                };
                return;
              }
            }

            // Handle Stream Events (Token Deltas)
            else if (ev.type === 'stream_event') {
              const streamEv = (ev as any).event;
              if (
                streamEv?.type === 'content_block_delta' &&
                streamEv?.delta?.type === 'text_delta' &&
                streamEv?.delta?.text
              ) {
                const deltaText = streamEv.delta.text;
                accumulatedText += deltaText;
                yield {
                  type: 'delta',
                  requestId,
                  text: deltaText
                };
              } else if (streamEv?.type === 'message_delta') {
                if (streamEv.delta?.stop_reason) {
                  finishReason = streamEv.delta.stop_reason;
                }
                if (streamEv.usage) {
                  finalUsage = mapClaudeCodeUsage(streamEv.usage);
                }
              }
            }

            // Handle Assistant Full Message (fallback if no deltas received)
            else if (ev.type === 'assistant') {
              const asstEv = ev as any;
              if (!accumulatedText && asstEv.message?.content) {
                const textBlocks = asstEv.message.content
                  .filter((b: any) => b.type === 'text' && b.text)
                  .map((b: any) => b.text);
                const fullText = textBlocks.join('');
                if (fullText) {
                  accumulatedText = fullText;
                  yield {
                    type: 'delta',
                    requestId,
                    text: fullText
                  };
                }
              }
            }

            // Handle Result Event
            else if (ev.type === 'result') {
              const resEv = ev as ClaudeResultEvent;
              if (resEv.usage) {
                finalUsage = mapClaudeCodeUsage(resEv.usage);
              }
              if (resEv.is_error || resEv.subtype === 'error') {
                isTerminated = true;
                try {
                  child.kill();
                } catch {}
                const errMsg = resEv.error || 'Claude Code generation failed';
                const classifiedCode = classifyClaudeCodeError(errMsg);
                yield {
                  type: 'error',
                  requestId,
                  error: {
                    code: classifiedCode,
                    message: redactDiagnosticText(errMsg),
                    retryable: classifiedCode === 'rate_limited'
                  }
                };
                return;
              }
              if (!accumulatedText && resEv.result) {
                accumulatedText = resEv.result;
                yield {
                  type: 'delta',
                  requestId,
                  text: resEv.result
                };
              }
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
